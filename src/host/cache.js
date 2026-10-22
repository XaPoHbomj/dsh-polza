/**
 * Local cache of parsed Polza generations. Finished and failed generations are
 * immutable, so a row fetched once can be reused by later period queries; only
 * the newest page is refreshed on each open. `pending` rows are mutable and get
 * revalidated: a page fetch counts as one check, and rows whose page is no
 * longer re-read are re-checked by id at a bounded rate. The cache lives under
 * the harness home and is keyed by a hash of the API key, never by the key
 * itself.
 */
import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

const VERSION = 1
const MAX_ROWS = 60_000
const MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000

// A stuck `pending` row is re-checked by id at most this often, and at most
// this many rows per scan, so a burst of long-running generations cannot turn
// into a request storm.
const PENDING_RECHECK_MS = 2 * 60_000
const PENDING_RECHECK_LIMIT = 25
const PENDING_CHECKS_MAX = 5_000

/** Stable, non-reversible fingerprint for one resolved API key. */
export function keyFingerprint(value) {
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 20)
}

/**
 * Stable identity of one history scan: period, range, and filters. The period
 * key is part of the identity on purpose: `today` and `custom[today,today]`
 * cover slightly different instants and must not share one marker.
 */
export function historyQueryKey({ periodKey, from, to, requestType, status, model }) {
  const fromPart = from === null || from === undefined ? 'all' : String(from).slice(0, 10)
  return `${periodKey ?? ''}|${fromPart}|${String(to).slice(0, 10)}|${requestType ?? ''}|${status ?? ''}|${model ?? ''}`
}

/**
 * Insertion-ordered map with least-recently-used eviction: reads move a key to
 * the recency tail, so dropping the first key always drops the coldest one.
 */
export class RecencyMap {
  constructor(limit) {
    this.limit = limit
    this.map = new Map()
  }

  get size() {
    return this.map.size
  }

  /** Read one value and move its key to the recency tail. */
  get(key) {
    const value = this.map.get(key)
    if (value === undefined) return undefined
    this.map.delete(key)
    this.map.set(key, value)
    return value
  }

  set(key, value) {
    if (this.map.has(key)) this.map.delete(key)
    this.map.set(key, value)
    while (this.map.size > this.limit) {
      const oldest = this.map.keys().next().value
      if (oldest === undefined) break
      this.map.delete(oldest)
    }
    return this
  }

  delete(key) {
    return this.map.delete(key)
  }

  clear() {
    this.map.clear()
  }
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

/** Millisecond bounds of one ISO range. */
function rangeMs(from, to) {
  return [
    from === null || from === undefined ? Number.NEGATIVE_INFINITY : Date.parse(from),
    to === null || to === undefined ? Number.POSITIVE_INFINITY : Date.parse(to),
  ]
}

/** Drop oldest pending-check stamps so the map stays bounded. */
function prunePendingChecks(store) {
  if (store.pendingChecks.size <= PENDING_CHECKS_MAX) return
  let excess = store.pendingChecks.size - PENDING_CHECKS_MAX
  for (const key of store.pendingChecks.keys()) {
    if (excess <= 0) break
    store.pendingChecks.delete(key)
    excess -= 1
  }
}

/** One fingerprint's in-memory rows plus persistence metadata. */
class Store {
  constructor() {
    this.rows = new Map()
    this.queries = new Map()
    // In-memory only: when each `pending` row was last seen fresh (serialized
    // stores never carry it, so a restart re-checks pending rows once).
    this.pendingChecks = new Map()
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
    this.writes = new Map()
    this.writeSeq = 0
    this.loading = new Map()
  }

  /** Load (once) and return one fingerprint's store. */
  async open(fingerprint) {
    if (this.stores.has(fingerprint)) return this.stores.get(fingerprint)
    const running = this.loading.get(fingerprint)
    if (running !== undefined) return running

    // Concurrent panel routes used to parse the same 6.5 MB file three times.
    const pending = (async () => {
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
    })()
    this.loading.set(fingerprint, pending)
    try {
      return await pending
    } finally {
      if (this.loading.get(fingerprint) === pending) this.loading.delete(fingerprint)
    }
  }

  /** Merge rows into a store, keeping the newest value for one id. */
  merge(store, rows) {
    let changed = false
    const now = Date.now()
    for (const row of rows) {
      if (row?.id === undefined) continue
      const id = String(row.id)
      // A freshly fetched `pending` row is as current as a re-check can make
      // it, so the fetch itself counts as one.
      if (row.status === 'pending') store.pendingChecks.set(id, now)
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
    prunePendingChecks(store)
  }

  /**
   * Rows inside one ISO range, in store order. Callers that need a sequence
   * sort it themselves (the table re-sorts by its own key anyway), so scans
   * over a 60 000-row store stay linear.
   */
  rowsInRange(store, from, to) {
    const [fromMs, toMs] = rangeMs(from, to)
    const rows = []
    for (const row of store.rows.values()) {
      const at = timeOf(row)
      if (at === null || at < fromMs || at > toMs) continue
      rows.push(row)
    }
    return rows
  }

  /**
   * Ids of `pending` rows in one range that no page fetch or re-check has
   * refreshed recently, oldest first. Oldest rows are the most likely to have
   * finished without their page being re-read. `keep` optionally narrows the
   * rows to the calling query's filters.
   */
  pendingToRefresh(store, from, to, keep = null) {
    const [fromMs, toMs] = rangeMs(from, to)
    const cutoff = Date.now() - PENDING_RECHECK_MS
    const rows = []
    for (const row of store.rows.values()) {
      if (row.status !== 'pending') continue
      if (keep !== null && !keep(row)) continue
      const at = timeOf(row)
      if (at === null || at < fromMs || at > toMs) continue
      if (Number(store.pendingChecks.get(String(row.id)) ?? 0) > cutoff) continue
      rows.push(row)
    }
    rows.sort((a, b) => (timeOf(a) ?? 0) - (timeOf(b) ?? 0))
    return rows.slice(0, PENDING_RECHECK_LIMIT).map(row => String(row.id))
  }

  /** Record that one batch of pending rows was re-checked now. */
  touchPending(store, ids) {
    const now = Date.now()
    for (const id of ids) store.pendingChecks.set(String(id), now)
    prunePendingChecks(store)
  }

  /** Forget pending-check stamps so the next scan re-checks them at once. */
  resetPendingChecks() {
    for (const store of this.stores.values()) store.pendingChecks.clear()
  }

  /** Clear the failed-page cooldown so the next scans retry holes immediately. */
  resetHoleRetries() {
    for (const [fingerprint, store] of this.stores) {
      let changed = false
      for (const marker of store.queries.values()) {
        if (Number(marker.failedPages ?? 0) > 0 && marker.holeAt !== 0) {
          marker.holeAt = 0
          changed = true
        }
      }
      if (changed) {
        store.dirty = true
        this.scheduleSave(fingerprint, store)
      }
    }
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
      && Number(previous.pages ?? 0) === Number(marker.pages ?? 0)
      && previous.ended === marker.ended
      && previous.partial === marker.partial
      && previous.actualTotal === marker.actualTotal
      && Number(previous.failedPages ?? 0) === Number(marker.failedPages ?? 0)
      && Number(previous.holeAt ?? 0) === Number(marker.holeAt ?? 0)
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

  /**
   * Write one store atomically. Writes for one fingerprint are chained, so two
   * saves can never interleave in the same temporary file.
   */
  async save(fingerprint, store) {
    if (!store.dirty) return
    store.dirty = false
    const previous = this.writes.get(fingerprint) ?? Promise.resolve()
    const task = previous.then(() => this.writeOut(fingerprint, store))
    const tail = task.catch(() => {})
    this.writes.set(fingerprint, tail)
    try {
      await task
    } finally {
      if (this.writes.get(fingerprint) === tail) this.writes.delete(fingerprint)
    }
  }

  /** Serialize one store to a unique temporary file, then rename it in place. */
  async writeOut(fingerprint, store) {
    const file = join(this.root, `${fingerprint}.json`)
    this.writeSeq += 1
    const temporary = `${file}.${process.pid}.${this.writeSeq}.tmp`
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
      await rm(temporary, { force: true }).catch(() => {})
      this.logger?.warn?.(`dsh-polza: history cache write failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}
