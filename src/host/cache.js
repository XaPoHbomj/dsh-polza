/**
 * Local cache of parsed Polza generations. Finished and failed generations are
 * immutable, so a row fetched once can be reused by later period queries; only
 * the newest page is refreshed on each open. The cache lives under the harness
 * home and is keyed by a hash of the API key, never by the key itself.
 */
import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

const VERSION = 1
const MAX_ROWS = 60_000
const MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000

/** Stable, non-reversible fingerprint for one resolved API key. */
export function keyFingerprint(value) {
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 20)
}

/** Cache directory under the harness home. */
function cacheRoot() {
  const configured = process.env.DSH_HOME?.trim()
  const home = configured !== undefined && configured !== '' ? configured : join(homedir(), '.dsh')
  return join(home, 'cache', 'dsh-polza')
}

/** Parse one cached timestamp, or null. */
function timeOf(row) {
  const value = Date.parse(row?.createdAt ?? '')
  return Number.isFinite(value) ? value : null
}

/** One fingerprint's in-memory rows plus persistence metadata. */
class Store {
  constructor() {
    this.rows = new Map()
    this.queries = new Map()
    this.loadedAt = 0
    this.dirty = false
  }
}

/** Read one cache file, returning an empty store on any problem. */
async function loadStore(file) {
  const store = new Store()
  store.loadedAt = Date.now()
  try {
    const payload = JSON.parse(await readFile(file, 'utf8'))
    if (payload?.version !== VERSION || !Array.isArray(payload.rows)) return store
    const cutoff = Date.now() - MAX_AGE_MS
    for (const row of payload.rows) {
      const at = timeOf(row)
      if (row?.id === undefined || at === null || at < cutoff) continue
      store.rows.set(String(row.id), row)
    }
    if (payload.queries !== null && typeof payload.queries === 'object') {
      for (const [key, value] of Object.entries(payload.queries)) {
        if (typeof key !== 'string' || value === null || typeof value !== 'object') continue
        store.queries.set(key, value)
      }
    }
  } catch {
    // A missing, unreadable, or corrupt cache is simply a cold cache.
  }
  return store
}

/** Drop the oldest rows so the file stays bounded. */
function prune(store) {
  if (store.rows.size <= MAX_ROWS) return
  const ordered = [...store.rows.values()]
    .map(row => ({ row, at: timeOf(row) ?? 0 }))
    .sort((a, b) => b.at - a.at)
  store.rows = new Map(ordered.slice(0, MAX_ROWS).map(entry => [String(entry.row.id), entry.row]))
}

/** Serialized cache with one file per API key fingerprint. */
export class HistoryCache {
  /** @param logger - optional Cordis logger for non-fatal cache diagnostics. */
  constructor(logger) {
    this.logger = logger
    this.root = cacheRoot()
    this.stores = new Map()
    this.saves = new Map()
  }

  /** Load (once) and return one fingerprint's store. */
  async open(fingerprint) {
    if (this.stores.has(fingerprint)) return this.stores.get(fingerprint)
    let store
    try {
      await mkdir(this.root, { recursive: true, mode: 0o700 })
      store = await loadStore(join(this.root, `${fingerprint}.json`))
    } catch (error) {
      this.logger?.warn?.(`dsh-polza: history cache unavailable: ${error instanceof Error ? error.message : String(error)}`)
      store = new Store()
      store.loadedAt = Date.now()
    }
    this.stores.set(fingerprint, store)
    return store
  }

  /** Merge rows into a store, keeping the newest value for one id. */
  merge(store, rows) {
    let changed = false
    for (const row of rows) {
      if (row?.id === undefined) continue
      const id = String(row.id)
      const previous = store.rows.get(id)
      if (
        previous === undefined
        || previous.status !== row.status
        || previous.cost !== row.cost
        || previous.createdAt !== row.createdAt
      ) {
        store.rows.set(id, row)
        changed = true
      }
    }
    if (changed) store.dirty = true
    prune(store)
  }

  /** Rows inside one ISO range; pending rows are excluded unless coverage counting asks for them. */
  rowsInRange(store, from, to, includePending = false) {
    const fromMs = from === null || from === undefined ? Number.NEGATIVE_INFINITY : Date.parse(from)
    const toMs = to === null || to === undefined ? Number.POSITIVE_INFINITY : Date.parse(to)
    const rows = []
    for (const row of store.rows.values()) {
      if (!includePending && row.status === 'pending') continue
      const at = timeOf(row)
      if (at === null || at < fromMs || at > toMs) continue
      rows.push(row)
    }
    rows.sort((a, b) => (timeOf(b) ?? 0) - (timeOf(a) ?? 0))
    return rows
  }

  /** One completed page-range marker for a period/filter combination. */
  query(store, key) {
    return store.queries.get(key)
  }

  /** Remember that one range was fetched up to a page depth. */
  markQuery(store, key, marker) {
    const previous = store.queries.get(key)
    if (
      previous !== undefined
      && Number(previous.maxPages ?? 0) >= Number(marker.maxPages ?? 0)
      && previous.ended === marker.ended
      && previous.actualTotal === marker.actualTotal
      && Date.now() - Number(previous.at ?? 0) < 5 * 60_000
    ) return
    store.queries.set(key, { ...marker, at: Date.now() })
    store.dirty = true
    if (store.queries.size > 200) {
      const oldest = [...store.queries.entries()].sort((a, b) => (a[1].at ?? 0) - (b[1].at ?? 0))[0]
      if (oldest !== undefined) store.queries.delete(oldest[0])
    }
  }

  /** Queue an atomic write for one store; rapid saves coalesce. */
  scheduleSave(fingerprint, store) {
    if (!store.dirty) return
    const pending = this.saves.get(fingerprint)
    if (pending !== undefined) return
    const timer = setTimeout(() => {
      this.saves.delete(fingerprint)
      void this.save(fingerprint, store)
    }, 500)
    timer.unref?.()
    this.saves.set(fingerprint, timer)
  }

  /** Write one store atomically. */
  async save(fingerprint, store) {
    if (!store.dirty) return
    store.dirty = false
    const file = join(this.root, `${fingerprint}.json`)
    const temporary = `${file}.${process.pid}.tmp`
    const payload = {
      version: VERSION,
      savedAt: new Date().toISOString(),
      rows: [...store.rows.values()],
      queries: Object.fromEntries(store.queries),
    }
    try {
      await mkdir(this.root, { recursive: true, mode: 0o700 })
      await writeFile(temporary, JSON.stringify(payload), { mode: 0o600 })
      await rename(temporary, file)
    } catch (error) {
      store.dirty = true
      this.logger?.warn?.(`dsh-polza: history cache write failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}
