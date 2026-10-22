/**
 * Polza balance and spend surface, host half. The plugin keeps the API key on
 * the host, folds generation history into small aggregates, and serves a
 * read-only JSON API to its browser half. Routes are loopback-only by default
 * and never emit CORS headers, so a foreign page cannot read the answers.
 */
import z from '@deepseek-ai/schemastery'
import { aggregate, exactCostFor, normalizeGeneration, resolvePeriod } from './aggregate.js'
import { HistoryCache, historyQueryKey, RecencyMap } from './cache.js'
import { asPolzaError, PolzaError, readInt, readString, sendError, sendJson } from './http.js'
import { createPolzaClient, toNumber, toOptionalNumber } from './polza.js'

/** Live-editable plugin settings shown on the Plugins page. */
export const Config = z.object({
  apiKeyRef: z.string().default('POLZA_API_KEY').description('Имя ссылки на ключ Polza в хранилище DSH (refs в .credentials.yaml).'),
  apiBaseUrl: z.string().default('https://polza.ai/api').description('Базовый URL Polza API.'),
  routePrefix: z.string().default('/polza/api').description('Префикс read-only роутов плагина.'),
  refreshSeconds: z.number().step(1).min(15).max(3600).default(60)
    .description('Автообновление баланса и TTL кэша, секунды.')
    .volatile(),
  lowBalanceThreshold: z.number().min(0).max(1_000_000).default(100)
    .description('Порог жёлтого предупреждения о балансе, ₽.')
    .volatile(),
  criticalBalanceThreshold: z.number().min(0).max(1_000_000).default(20)
    .description('Порог красного предупреждения о балансе, ₽.')
    .volatile(),
  historyMaxPages: z.number().step(1).min(1).max(200).default(100)
    .description('Сколько страниц по 100 генераций читать для графика и разбивок.')
    .volatile(),
  requestTimeoutMs: z.number().step(1).min(2_000).max(60_000).default(15_000)
    .description('Таймаут одного запроса к Polza, миллисекунды.'),
  allowRemote: z.boolean().default(false).description('Разрешить роуты не только с loopback.'),
})

export const name = 'dsh-polza'
export const inject = ['credentials', 'webServer']

const DEFAULTS = {
  apiKeyRef: 'POLZA_API_KEY',
  apiBaseUrl: 'https://polza.ai/api',
  routePrefix: '/polza/api',
  refreshSeconds: 60,
  lowBalanceThreshold: 100,
  criticalBalanceThreshold: 20,
  historyMaxPages: 100,
  requestTimeoutMs: 15_000,
  allowRemote: false,
}

const KEY_REF_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/
const ROUTE_PREFIX_PATTERN = /^\/[A-Za-z0-9/_-]*$/

// Concurrent by-id re-checks of stuck `pending` rows, and the total time the
// response may wait for them; slower answers still land in the cache later.
const DETAIL_BATCH = 5
const RECHECK_BUDGET_MS = 4_000

// How often a marker with unfilled holes may trigger a retry walk.
const HOLE_RETRY_MS = 60_000

/** Resolve after one bounded wait without holding the process open. */
function budgetExpired(ms) {
  return new Promise(resolve => {
    const timer = setTimeout(resolve, ms)
    timer.unref?.()
  })
}

/** Clamp one integer option. */
function integer(value, fallback, min, max) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, Math.trunc(number)))
}

/** Read a plain value or a live `Volatile` wrapper. */
function unwrap(value) {
  if (value !== null && typeof value === 'object' && typeof value.get === 'function') {
    try {
      return value.get()
    } catch {
      return undefined
    }
  }
  return value
}

/** Normalize the Loader row's config into one resolved shape. */
function normalizeConfig(config) {
  const unwrapped = unwrap(config)
  const input = unwrapped !== null && typeof unwrapped === 'object' ? unwrapped : {}
  const read = name => unwrap(input[name])
  const apiKeyRefRaw = read('apiKeyRef')
  const apiKeyRef = typeof apiKeyRefRaw === 'string' && KEY_REF_PATTERN.test(apiKeyRefRaw.trim())
    ? apiKeyRefRaw.trim()
    : DEFAULTS.apiKeyRef
  const prefixRaw = read('routePrefix')
  const rawPrefix = typeof prefixRaw === 'string' ? prefixRaw.trim().replace(/\/+$/, '') : DEFAULTS.routePrefix
  const routePrefix = ROUTE_PREFIX_PATTERN.test(rawPrefix) ? rawPrefix : DEFAULTS.routePrefix
  const baseRaw = read('apiBaseUrl')
  const apiBaseUrl = typeof baseRaw === 'string' && /^https?:\/\//.test(baseRaw)
    ? baseRaw.replace(/\/+$/, '')
    : DEFAULTS.apiBaseUrl
  return {
    apiKeyRef,
    apiBaseUrl,
    routePrefix,
    refreshSeconds: integer(read('refreshSeconds'), DEFAULTS.refreshSeconds, 15, 3600),
    lowBalanceThreshold: Math.max(0, toNumber(read('lowBalanceThreshold') ?? DEFAULTS.lowBalanceThreshold)),
    criticalBalanceThreshold: Math.max(0, toNumber(read('criticalBalanceThreshold') ?? DEFAULTS.criticalBalanceThreshold)),
    historyMaxPages: integer(read('historyMaxPages'), DEFAULTS.historyMaxPages, 1, 200),
    requestTimeoutMs: integer(read('requestTimeoutMs'), DEFAULTS.requestTimeoutMs, 2_000, 60_000),
    allowRemote: read('allowRemote') === true,
  }
}

/** Normalize one provider cost line for the hover breakdown. */
function normalizeCostLines(lines) {
  if (!Array.isArray(lines)) return []
  return lines
    .map(line => ({
      kind: String(line?.kind ?? ''),
      quantity: toNumber(line?.quantity),
      unit: line?.unit == null ? null : String(line.unit),
      cost: toNumber(line?.clientRub ?? line?.costRub ?? line?.cost),
      status: line?.status == null ? null : String(line.status),
    }))
    .filter(line => line.cost !== 0 || line.quantity !== 0)
}

/** Normalize the v2 balance payload. */
function normalizeBalance(raw) {
  return {
    amount: toNumber(raw?.amount),
    available: toNumber(raw?.available),
    reservedAmount: toOptionalNumber(raw?.reservedAmount),
    spentAmount: toOptionalNumber(raw?.spentAmount),
    updatedAt: raw?.updatedAt ? String(raw.updatedAt) : null,
  }
}

/** Normalize the v1 key payload. */
function normalizeKey(raw) {
  if (raw === null || raw === undefined) return null
  return {
    label: raw.label ? String(raw.label) : null,
    limit: toOptionalNumber(raw.limit),
    limitRemaining: toOptionalNumber(raw.limit_remaining),
    limitReset: raw.limit_reset ? String(raw.limit_reset) : null,
    usage: toNumber(raw.usage),
    usageDaily: toNumber(raw.usage_daily),
    usageWeekly: toNumber(raw.usage_weekly),
    usageMonthly: toNumber(raw.usage_monthly),
  }
}

/** Whether a socket address belongs to this machine. */
function isLoopback(address) {
  if (typeof address !== 'string') return false
  return address === '::1' || address === '::ffff:127.0.0.1' || address.startsWith('127.')
}

/**
 * Fetch pages of history up to the configured cap, optionally narrowing to one
 * model. Polza has no model query parameter, so that filter folds here.
 */
function matchesFilters(row, { requestType, status, model }) {
  if (requestType !== undefined && row.requestType !== requestType) return false
  if (status !== undefined && row.status !== status) return false
  if (model !== undefined && row.model !== model && row.modelDisplayName !== model) return false
  return true
}

/**
 * Read one period from the disk cache and/or Polza. `cacheOnly` never touches
 * the network; it is the first phase that lets the panel paint immediately.
 * `flight` collapses concurrent page-1 requests for the same query.
 */
async function fetchHistory(client, options, cache, control = {}) {
  const { from, to, requestType, status, model, maxPages, periodKey } = options
  const cacheOnly = control.cacheOnly === true
  const flight = control.flight
  const filters = { requestType, status, model }
  const filterRows = rows => rows.filter(row => matchesFilters(row, filters))
  const params = page => ({
    page,
    limit: 100,
    dateFrom: from ?? undefined,
    dateTo: to,
    requestType,
    status,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  })
  const queryKey = historyQueryKey({ periodKey, from, to, requestType, status, model })

  const fingerprint = await client.fingerprint()
  const store = await cache.open(fingerprint)
  const marker = cache.query(store, queryKey)
  const markerFresh = marker !== undefined
    && Number(marker.maxPages ?? 0) >= maxPages
    && Date.now() - Number(marker.at ?? 0) < 24 * 60 * 60 * 1000
  // A marker only counts as complete when its walk reached the end (or walked
  // past the provider-capped total) AND left no failed pages behind; a hole
  // must keep the range looking unverified either way.
  const markerComplete = markerFresh
    && Number(marker.failedPages ?? 0) === 0
    && (marker.ended === true || Number(marker.actualTotal ?? 0) > Number(marker.total ?? 0))
  let cacheRows = filterRows(cache.rowsInRange(store, from, to))
  let coverage = cacheRows.length

  if (cacheOnly) {
    const expected = Number(marker?.total ?? 0)
    const needed = expected > 0 ? Math.min(expected, maxPages * 100) : 0
    const tolerance = Math.min(100, Math.floor(needed * 0.05))
    const approximatelyCovered = needed > 0 && coverage >= needed - tolerance
    const total = Math.max(Number(marker?.actualTotal ?? 0), cacheRows.length)
    return {
      rows: cacheRows,
      scanned: cacheRows.length,
      total,
      pages: 0,
      totalPages: Math.max(1, Math.ceil(total / 100)),
      partial: !(markerComplete || approximatelyCovered),
      cached: cacheRows.length > 0,
      meta: null,
    }
  }

  // Collapse the entire scan, not just page 1. Several panel mounts asking for
  // the same period must share one 146-page walk instead of starting five.
  if (flight !== undefined && control.direct !== true) {
    const scanKey = `history:${queryKey}:${maxPages}`
    return await flight(scanKey, () => fetchHistory(client, options, cache, { ...control, direct: true }))
  }

  const first = flight !== undefined
    ? await flight(`page1:${queryKey}`, () => client.generations(params(1)))
    : await client.generations(params(1))
  const meta = first?.meta ?? null
  const reportedPages = Number(first?.meta?.totalPages) > 0 ? Number(first.meta.totalPages) : 1
  const firstItems = Array.isArray(first?.items) ? first.items : []
  cache.merge(store, firstItems.map(item => normalizeGeneration(item)))

  const expectedTotal = Number(meta?.total) > 0 ? Number(meta.total) : 0
  const needed = expectedTotal > 0 ? Math.min(expectedTotal, maxPages * 100) : 0
  let rows = filterRows(cache.rowsInRange(store, from, to))
  coverage = rows.length
  let pagesFetched = 1
  let failedPages = 0
  let reachedEnd = firstItems.length < 100

  const tolerance = Math.min(100, Math.floor(needed * 0.05))
  const approximatelyCovered = needed > 0 && coverage >= needed - tolerance
  const capUnresolved = reportedPages >= 100 && maxPages > 100 && !markerComplete
  // A marker with unfilled holes is retried on its own clock: at most once per
  // HOLE_RETRY_MS, and «Обновить» zeroes that clock via `resetHoleRetries`.
  const holeRetryDue = marker !== undefined
    && Number(marker.failedPages ?? 0) > 0
    && Date.now() - Number(marker.holeAt ?? marker.at ?? 0) >= HOLE_RETRY_MS
  const willFetch = needed === 0 || capUnresolved || holeRetryDue || (!markerFresh && !approximatelyCovered)
  const cacheSufficient = markerFresh && !capUnresolved
  const batchSize = cacheSufficient ? 2 : 8
  // A previous scan may have been cut short by a lower page cap (`/models`
  // reads a thin slice first; `historyMaxPages` can be raised) or left a hole
  // on a failed page. Its verified rows are already in the store, so continue
  // past them instead of walking the range again. Resuming trusts only the
  // marker's *contiguous* depth — a row count cannot prove that pages 1..N
  // hold no holes after failed pages or pruning. New rows shift every page, so
  // resuming also requires that shift to fit the always-fetched first page and
  // the totals to be uncapped.
  const markerDepth = Number(marker?.pages ?? 0)
  const markerTotal = Number(marker?.total ?? 0)
  const shift = expectedTotal - markerTotal
  const shiftSafe = markerTotal > 0 && expectedTotal > 0 && expectedTotal < 10_000
    && shift >= 0 && shift < 100
  const deepened = marker !== undefined
    && marker.ended !== true
    && Number(marker.maxPages ?? 0) < maxPages
    && shiftSafe
  const resumePage = markerDepth > 1 && ((shiftSafe && (deepened || holeRetryDue)) || (capUnresolved && coverage >= needed))
    ? markerDepth + 1
    : 2

  // Page 1 is always fetched, so it always anchors the run; deeper pages join
  // the contiguous walk only when they succeed.
  const donePages = new Set([1])
  if (willFetch) {
    // Polza caps `meta.totalPages` at 100 even when more rows exist, so pages
    // are read until a short or empty page rather than trusting that field.
    // A verified cache only needs a thin refresh, so its request concurrency
    // drops. A cold cache, or one whose end is still unconfirmed, keeps 8.
    let nextPage = resumePage
    while (nextPage <= maxPages && !reachedEnd) {
      const batch = []
      for (let index = 0; index < batchSize && nextPage <= maxPages; index += 1) {
        batch.push(nextPage)
        nextPage += 1
      }
      const results = await Promise.allSettled(batch.map(page => client.generations(params(page))))
      for (const [index, result] of results.entries()) {
        if (result.status === 'rejected') {
          failedPages += 1
          continue
        }
        const items = Array.isArray(result.value?.items) ? result.value.items : []
        if (items.length === 0) {
          reachedEnd = true
          continue
        }
        donePages.add(batch[index])
        cache.merge(store, items.map(item => normalizeGeneration(item)))
        pagesFetched += 1
        if (items.length < 100) reachedEnd = true
      }
    }
    rows = filterRows(cache.rowsInRange(store, from, to))
    coverage = rows.length
  }

  // A `pending` row can sit on a page this scan no longer re-reads, so its
  // status would freeze forever. Re-check such rows by id: bounded per scan,
  // rate-limited per row, scoped to this query's filters, and skipped when a
  // page fetch already saw them. The response must not wait on slow detail
  // calls — a budget bounds the wait and late answers merge into the store
  // for the next read.
  // Scope re-checks by the query's *stable* fields only: `status` is exactly
  // what may change under us, so a `status=completed` query must still be the
  // one that learns a pending row has finished.
  const stalePending = cache.pendingToRefresh(store, from, to, row => matchesFilters(row, { requestType, model }))
  if (stalePending.length > 0) {
    let next = 0
    const checkOne = async id => {
      try {
        const call = flight !== undefined
          ? flight(`pending:${id}`, () => client.generation(id))
          : client.generation(id)
        const value = await call
        const record = value?.data ?? value
        if (record !== null && typeof record === 'object') {
          cache.merge(store, [normalizeGeneration(record)])
        }
      } catch {
        // A failed re-check is not fatal; its stamp keeps the retry rate sane.
      } finally {
        cache.touchPending(store, [id])
        cache.scheduleSave(fingerprint, store)
      }
    }
    const workers = Array.from({ length: Math.min(DETAIL_BATCH, stalePending.length) }, async () => {
      while (next < stalePending.length) {
        const id = stalePending[next]
        next += 1
        await checkOne(id)
      }
    })
    await Promise.race([Promise.all(workers), budgetExpired(RECHECK_BUDGET_MS)])
    rows = filterRows(cache.rowsInRange(store, from, to))
    coverage = rows.length
  }

  // Depth walked without holes: a failed page stops the run even when later
  // pages succeed, so a future resume can never skip a missing page. When the
  // walk really ran from page 2, an older marker's depth is superseded by what
  // this walk verified — only a cache-answered read keeps the old depth.
  let contiguousDepth = resumePage - 1
  while (donePages.has(contiguousDepth + 1)) contiguousDepth += 1
  const scanDepth = willFetch ? contiguousDepth : Math.max(markerDepth, contiguousDepth)
  const actualTotal = rows.length
  const total = model !== undefined ? actualTotal : Math.max(expectedTotal, actualTotal)
  // `partial` describes the answer being returned: a scan that walked the
  // range reports its own verdict, without a walk the marker's verdict stands.
  // Either way, a later successful scan can clear a previously stuck flag.
  const partial = willFetch
    ? failedPages > 0 || (!reachedEnd && (coverage < needed || scanDepth >= maxPages))
    : Boolean(marker?.partial)

  const effectiveFailedPages = willFetch
    ? failedPages
    : Number(marker?.failedPages ?? 0)
  cache.markQuery(store, queryKey, {
    total: expectedTotal,
    actualTotal,
    totalPages: reportedPages,
    maxPages,
    pages: scanDepth,
    failedPages: effectiveFailedPages,
    // Only a scan that reaches the end clears the cooldown; a cache-answered
    // read must preserve the marker's hole state.
    holeAt: willFetch
      ? (effectiveFailedPages > 0 ? Date.now() : 0)
      : Number(marker?.holeAt ?? 0),
    // A page-1-only refresh must not erase a previously confirmed end.
    ended: reachedEnd || (!willFetch && marker?.ended === true),
    partial,
  })
  cache.scheduleSave(fingerprint, store)

  return {
    rows,
    scanned: rows.length,
    total,
    pages: pagesFetched,
    totalPages: Math.max(reportedPages, Math.ceil(actualTotal / 100)),
    partial,
    cached: true,
    meta,
  }
}


/**
 * Mount the host plugin.
 * @param ctx - Cordis host context.
 * @param config - Loader row config.
 */
export function apply(ctx, config) {
  const initial = normalizeConfig(config)
  const routePrefix = initial.routePrefix
  const apiKeyRef = initial.apiKeyRef
  const cache = new RecencyMap(80)
  const flights = new Map()
  const historyCache = new HistoryCache(ctx.logger)

  /** Re-read live settings on every request; `Volatile` fields may change in the UI. */
  const current = () => normalizeConfig(config)

  function clearCache() {
    cache.clear()
    // «Обновить» must refresh everything the user can see, including stuck
    // pending rows whose by-id re-check is still inside its rate limit.
    historyCache.resetPendingChecks()
    // «Обновить» must also re-open ranges whose walk left holes: zeroing their
    // retry clock makes the very next scan walk the hole again.
    historyCache.resetHoleRetries()
    // Keep an in-flight history walk joinable. Repeated "Обновить" clicks used
    // to clear this map and start another 146-page scan while the first one was
    // still running. Non-history work is safe to restart.
    for (const key of flights.keys()) {
      if (!key.startsWith('history:') && !key.startsWith('page1:')) flights.delete(key)
    }
  }

  /** One in-flight operation per key, so duplicate callers share the same work. */
  function once(key, load) {
    const running = flights.get(key)
    if (running !== undefined) {
      return running
    }
    const promise = Promise.resolve().then(load)
    flights.set(key, promise)
    promise.then(
      () => flights.delete(key),
      () => flights.delete(key),
    )
    return promise
  }

  /** Resolve the configured reference for one operation. */
  async function resolveKey() {
    const options = current()
    let resolved
    try {
      resolved = await ctx.credentials.resolve(options.apiKeyRef)
    } catch (error) {
      throw new PolzaError('polza/config', `Не удалось прочитать ключ ${options.apiKeyRef}: ${error instanceof Error ? error.message : String(error)}`, { cause: error })
    }
    if (resolved === undefined || resolved.value === '') {
      throw new PolzaError(
        'polza/unconfigured',
        `Ключ ${options.apiKeyRef} не найден. Добавь его в ~/.dsh/.credentials.yaml или в окружение.`,
        { status: 503 },
      )
    }
    return resolved
  }

  const client = createPolzaClient({
    baseUrl: initial.apiBaseUrl,
    resolveKey,
    timeoutMs: initial.requestTimeoutMs,
  })

  /** Read-through cache with a small bound; eviction is least-recently-used. */
  async function cached(key, ttlMs, load) {
    const hit = cache.get(key)
    const now = Date.now()
    if (hit !== undefined) {
      if (hit.expires > now) {
        return hit.value
      }
      // Stale-while-revalidate: keep the last answer visible and refresh it
      // behind the request instead of blocking the panel on a long history scan.
      if (!hit.refreshing) {
        hit.refreshing = true
        once(key, load)
          .then(value => {
            cache.set(key, { value, expires: Date.now() + ttlMs, createdAt: Date.now() })
          })
          .catch(() => {
            hit.refreshing = false
          })
      }
      return hit.value
    }
    const value = await once(key, load)
    cache.set(key, { value, expires: Date.now() + ttlMs, createdAt: Date.now() })
    return value
  }

  async function loadSummaryUncached() {
    const [balance, keyResult] = await Promise.all([
      client.balance(),
      client.key().then(
        value => ({ value, error: null }),
        error => ({ value: null, error: asPolzaError(error) }),
      ),
    ])
    return {
      balance: normalizeBalance(balance),
      key: keyResult.value === null ? null : normalizeKey(keyResult.value),
      keyError: keyResult.error === null ? null : { code: keyResult.error.code, message: keyResult.error.message },
      fetchedAt: new Date().toISOString(),
    }
  }

  async function loadSummary() {
    return await cached('summary', 15_000, loadSummaryUncached)
  }

  /** Public, value-free configuration and credential facts. */
  async function loadHealth() {
    const options = current()
    let configured = false
    let source = null
    let writable = false
    let describeError = null
    try {
      const info = await ctx.credentials.describe(options.apiKeyRef)
      configured = info.configured === true
      source = info.source ?? null
      writable = info.writable === true
    } catch (error) {
      describeError = error instanceof Error ? error.message : String(error)
    }
    return {
      ok: configured,
      ref: options.apiKeyRef,
      configured,
      source,
      writable,
      describeError,
      config: {
        refreshSeconds: options.refreshSeconds,
        lowBalanceThreshold: options.lowBalanceThreshold,
        criticalBalanceThreshold: options.criticalBalanceThreshold,
        historyMaxPages: options.historyMaxPages,
      },
      fetchedAt: new Date().toISOString(),
    }
  }

  /** Period, filters, and page size from one query string. */
  function readQuery(params) {
    const period = resolvePeriod(
      readString(params, 'period', 16) ?? '30d',
      readString(params, 'from', 10),
      readString(params, 'to', 10),
    )
    return {
      period,
      requestType: readString(params, 'requestType', 24),
      status: readString(params, 'status', 24),
      model: readString(params, 'model', 200),
    }
  }

  function buildOverview(summary, history, query, options) {
    const folded = aggregate(history.rows, {
      fromDate: query.period.fromDate,
      toDate: query.period.toDate,
    })
    // The key rollups are unfiltered, so they cannot answer a filtered query;
    // a filtered period falls back to the folded history sum.
    const filtered = query.requestType !== undefined || query.status !== undefined || query.model !== undefined
    // Money figures show settled spend only: Polza folds in-flight reservation
    // holds into the balance and the usage rollups (the cabinet displays
    // `usage - reserved` and the wallet amount), and the panel must match it.
    // History folds are settled too — `add()` skips pending costs — so the
    // chart and the breakdowns agree with this number.
    const exactCost = filtered ? null : exactCostFor(query.period.key, summary?.key ?? null)
    const reserved = Number(summary?.balance?.reservedAmount)
    const reservedNow = Number.isFinite(reserved) ? reserved : 0
    const periodCost = Math.max(0, exactCost === null ? folded.totals.cost : exactCost.cost - reservedNow)
    return {
      ...(summary ?? { balance: null, key: null, keyError: null, fetchedAt: null }),
      period: query.period,
      filters: {
        requestType: query.requestType ?? null,
        status: query.status ?? null,
        model: query.model ?? null,
      },
      ...folded,
      exactCost,
      periodCost,
      history: {
        scanned: history.scanned,
        total: history.total,
        partial: history.partial,
        pages: history.pages,
        totalPages: history.totalPages,
        maxPages: options.historyMaxPages,
      },
    }
  }

  async function handleOverview(params) {
    const options = current()
    const query = readQuery(params)
    const cacheOnly = params.get('cache') === '1'
    const forceFresh = params.get('fresh') === '1'
    const cacheKey = `overview:${query.period.key}:${query.period.fromDate ?? 'all'}:${query.period.toDate}:${query.requestType ?? ''}:${query.status ?? ''}:${query.model ?? ''}:${options.historyMaxPages}`

    if (cacheOnly) {
      const memory = cache.get(cacheKey)
      if (memory !== undefined) {
        return {
          ...memory.value,
          cache: {
            source: 'memory',
            stale: memory.expires <= Date.now(),
            cachedAt: new Date(memory.createdAt ?? Date.now()).toISOString(),
          },
        }
      }

      const summaryEntry = cache.get('summary')
      const summary = summaryEntry?.value ?? null
      const history = await fetchHistory(client, {
        from: query.period.from,
        to: query.period.to,
        periodKey: query.period.key,
        requestType: query.requestType,
        status: query.status,
        model: query.model,
        maxPages: options.historyMaxPages,
      }, historyCache, { cacheOnly: true })
      if (history.rows.length === 0) {
        return { cache: { source: 'none' } }
      }
      return {
        ...buildOverview(summary, history, query, options),
        cache: {
          source: 'disk',
          cachedAt: summary?.fetchedAt ?? null,
        },
      }
    }

    if (forceFresh) cache.delete(cacheKey)
    // One refresh period, no floor: the panel's tick is the update schedule and
    // must find this entry expired, so `refreshSeconds` is the real cadence.
    return await cached(cacheKey, options.refreshSeconds * 1000, async () => {
      const [summary, history] = await Promise.all([
        loadSummary(),
        fetchHistory(client, {
          from: query.period.from,
          to: query.period.to,
          periodKey: query.period.key,
          requestType: query.requestType,
          status: query.status,
          model: query.model,
          maxPages: options.historyMaxPages,
        }, historyCache, { flight: once }),
      ])
      return {
        ...buildOverview(summary, history, query, options),
        cache: { source: 'live', cachedAt: new Date().toISOString() },
      }
    })
  }

  async function handleModels() {
    const options = current()
    return await cached('models', 10 * 60_000, async () => {
      const period = resolvePeriod('30d')
      const history = await fetchHistory(client, {
        from: period.from,
        to: period.to,
        periodKey: period.key,
        maxPages: Math.min(options.historyMaxPages, 10),
      }, historyCache, { flight: once })
      const seen = new Map()
      for (const row of history.rows) {
        const entry = seen.get(row.model) ?? {
          key: row.model,
          label: row.modelDisplayName ?? row.model,
          requests: 0,
          cost: 0,
        }
        entry.requests += 1
        entry.cost += row.cost
        seen.set(row.model, entry)
      }
      return {
        items: [...seen.values()].sort((a, b) => b.cost - a.cost),
        partial: history.partial,
        fetchedAt: new Date().toISOString(),
      }
    })
  }

  async function handleGenerations(params) {
    const options = current()
    const query = readQuery(params)
    const page = readInt(params, 'page', 1, 1, 100_000)
    const limit = readInt(params, 'limit', 25, 1, 100)
    const sortBy = readString(params, 'sortBy', 24) === 'clientCost' ? 'clientCost' : 'createdAt'
    const sortOrder = readString(params, 'sortOrder', 8) === 'asc' ? 'asc' : 'desc'
    const cacheFirst = params.get('cache') === '1'

    const pageOf = (rows, source, partial) => {
      const sorted = [...rows].sort((a, b) => {
        const left = sortBy === 'clientCost' ? a.cost : Date.parse(a.createdAt ?? '')
        const right = sortBy === 'clientCost' ? b.cost : Date.parse(b.createdAt ?? '')
        return (Number.isFinite(left) ? left : 0) - (Number.isFinite(right) ? right : 0)
      })
      if (sortOrder === 'desc') sorted.reverse()
      const start = (page - 1) * limit
      const items = sorted.slice(start, start + limit)
      return {
        items,
        meta: {
          page,
          limit,
          total: sorted.length,
          totalPages: Math.max(1, Math.ceil(sorted.length / limit)),
        },
        partial,
        cache: { source },
        fetchedAt: new Date().toISOString(),
      }
    }

    if (cacheFirst) {
      const history = await fetchHistory(client, {
        from: query.period.from,
        to: query.period.to,
        periodKey: query.period.key,
        requestType: query.requestType,
        status: query.status,
        model: query.model,
        maxPages: options.historyMaxPages,
      }, historyCache, { cacheOnly: true })
      if (history.rows.length === 0) {
        return {
          items: [],
          meta: { page, limit, total: 0, totalPages: 1 },
          partial: true,
          cache: { source: 'none' },
          fetchedAt: new Date().toISOString(),
        }
      }
      return pageOf(history.rows, 'disk', history.partial)
    }

    if (query.model !== undefined) {
      const history = await fetchHistory(client, {
        from: query.period.from,
        to: query.period.to,
        periodKey: query.period.key,
        requestType: query.requestType,
        status: query.status,
        model: query.model,
        maxPages: options.historyMaxPages,
      }, historyCache, { flight: once })
      return pageOf(history.rows, 'disk', history.partial)
    }

    const flightKey = `generations:${query.period.fromDate ?? 'all'}:${query.period.toDate}:${query.requestType ?? ''}:${query.status ?? ''}:${page}:${limit}:${sortBy}:${sortOrder}`
    const data = await once(flightKey, () => client.generations({
      page,
      limit,
      dateFrom: query.period.from ?? undefined,
      dateTo: query.period.to,
      requestType: query.requestType,
      status: query.status,
      sortBy,
      sortOrder,
    }))
    const items = (Array.isArray(data?.items) ? data.items : []).map(item => normalizeGeneration(item))
    const reportedTotal = Number(data?.meta?.total) || 0
    const reportedPages = Number(data?.meta?.totalPages) || 1
    // The provider caps the reported total and total pages at 10 000 / 100,
    // but later pages still return rows. Keep "next" available while a page is
    // full and report at least the rows reached so far.
    const hasMore = items.length >= limit
    const reached = (page - 1) * limit + items.length
    return {
      items,
      meta: {
        page: Number(data?.meta?.page) || page,
        limit: Number(data?.meta?.limit) || limit,
        total: Math.max(reportedTotal, reached + (hasMore ? 1 : 0)),
        totalPages: Math.max(reportedPages, page + (hasMore ? 1 : 0)),
      },
      partial: false,
      cache: { source: 'api' },
      fetchedAt: new Date().toISOString(),
    }
  }

  async function handleGeneration(id) {
    const data = await client.generation(id)
    const record = data?.data ?? data
    return {
      ...normalizeGeneration(record),
      costLines: normalizeCostLines(record?.costLines),
      completedAt: record?.completedAt ? String(record.completedAt) : null,
      latencyMs: Number.isFinite(Number(record?.latencyMs)) ? Number(record.latencyMs) : null,
      queueTimeMs: Number.isFinite(Number(record?.queueTimeMs)) ? Number(record.queueTimeMs) : null,
      attemptsCount: Number.isFinite(Number(record?.attemptsCount)) ? Number(record.attemptsCount) : null,
    }
  }

  async function route(req, res) {
    const options = current()
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      sendJson(res, 405, { error: { code: 'polza/method', message: 'Только GET' } })
      return
    }
    if (!options.allowRemote && !isLoopback(req.socket?.remoteAddress)) {
      sendJson(res, 403, { error: { code: 'polza/forbidden', message: 'Роут доступен только с этой машины' } })
      return
    }

    const url = new URL(req.url ?? '/', 'http://localhost')
    const path = url.pathname.slice(routePrefix.length) || '/'

    try {
      if (path === '/health') {
        sendJson(res, 200, await loadHealth())
        return
      }
      if (path === '/refresh') {
        clearCache()
        sendJson(res, 200, { ok: true, fetchedAt: new Date().toISOString() })
        return
      }
      if (path === '/summary') {
        sendJson(res, 200, await loadSummary())
        return
      }
      if (path === '/overview') {
        sendJson(res, 200, await handleOverview(url.searchParams))
        return
      }
      if (path === '/generations') {
        sendJson(res, 200, await handleGenerations(url.searchParams))
        return
      }
      if (path === '/models') {
        sendJson(res, 200, await handleModels())
        return
      }
      if (path === '/generation') {
        const id = readString(url.searchParams, 'id', 200)
        if (id === undefined) throw new PolzaError('polza/bad-request', 'Не указан id генерации', { status: 400 })
        sendJson(res, 200, await handleGeneration(id))
        return
      }
      sendJson(res, 404, { error: { code: 'polza/not-found', message: `Неизвестный роут ${path}` } })
    } catch (error) {
      sendError(res, error)
    }
  }

  ctx.effect(
    () => ctx.webServer.register({ kind: 'prefix', path: routePrefix, handler: route }),
    'dsh-polza: api routes',
  )
  ctx.on('credentials/reference-updated', ref => {
    if (ref === apiKeyRef) clearCache()
  })
  ctx.logger?.info?.('dsh-polza: mounted at %s (key ref %s)', routePrefix, apiKeyRef)
}
