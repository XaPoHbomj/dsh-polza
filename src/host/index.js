/**
 * Polza balance and spend surface, host half. The plugin keeps the API key on
 * the host, folds generation history into small aggregates, and serves a
 * read-only JSON API to its browser half. Routes are loopback-only by default
 * and never emit CORS headers, so a foreign page cannot read the answers.
 */
import z from '@deepseek-ai/schemastery'
import { aggregate, exactCostFor, normalizeGeneration, resolvePeriod } from './aggregate.js'
import { HistoryCache } from './cache.js'
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
  const input = unwrap(config) !== null && typeof unwrap(config) === 'object' ? unwrap(config) : {}
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
async function fetchHistory(client, options, cache) {
  const { from, to, requestType, status, model, maxPages } = options
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

  const first = await client.generations(params(1))
  const meta = first?.meta ?? null
  const reportedPages = Number(first?.meta?.totalPages) > 0 ? Number(first.meta.totalPages) : 1
  const fingerprint = await client.fingerprint()
  const store = await cache.open(fingerprint)
  const queryKey = `${from === null ? 'all' : String(from).slice(0, 10)}|${String(to).slice(0, 10)}|${requestType ?? ''}|${status ?? ''}`

  const firstItems = Array.isArray(first?.items) ? first.items : []
  cache.merge(store, firstItems.map(item => normalizeGeneration(item)))

  const expectedTotal = Number(meta?.total) > 0 ? Number(meta.total) : 0
  const needed = expectedTotal > 0 ? Math.min(expectedTotal, maxPages * 100) : 0
  let rows = cache.rowsInRange(store, from, to)
  let coverage = cache.rowsInRange(store, from, to, true).length
  let pagesFetched = 1
  let failedPages = 0
  let reachedEnd = firstItems.length < 100

  // A completed query marker is stronger than a row count: the previous scan
  // may have hit the page cap or covered a wider range. One fresh page still
  // picks up new generations; the rest of the range is already local.
  const marker = cache.query(store, queryKey)
  const markerFresh = marker !== undefined
    && Number(marker.maxPages ?? 0) >= maxPages
    && Date.now() - Number(marker.at ?? 0) < 24 * 60 * 60 * 1000
  // One page of slack absorbs the page cap, a pending row, or a boundary row.
  // Re-scanning a hundred pages to recover a handful of rows is the worse trade.
  const tolerance = Math.min(100, Math.floor(needed * 0.05))
  const approximatelyCovered = needed > 0 && coverage >= needed - tolerance
  const markerComplete = markerFresh && (marker.ended === true || Number(marker.actualTotal ?? 0) > Number(marker.total ?? 0))
  // `meta.totalPages` stops at 100 while pages beyond it can still hold rows.
  // Until one scan has actually reached the end, a larger page budget must be
  // spent even when the cached row count already equals the reported total.
  const capUnresolved = reportedPages >= 100 && maxPages > 100 && !markerComplete

  if (needed === 0 || capUnresolved || (!markerFresh && !approximatelyCovered)) {
    // Polza caps `meta.totalPages` at 100 even when more rows exist, so pages
    // are read until a short or empty page rather than trusting that field.
    let nextPage = 2
    while (nextPage <= maxPages && !reachedEnd) {
      const batch = []
      for (let index = 0; index < 8 && nextPage <= maxPages; index += 1) {
        batch.push(nextPage)
        nextPage += 1
      }
      const results = await Promise.allSettled(batch.map(page => client.generations(params(page))))
      for (const result of results) {
        if (result.status === 'rejected') {
          failedPages += 1
          continue
        }
        const batchItems = Array.isArray(result.value?.items) ? result.value.items : []
        if (batchItems.length === 0) {
          reachedEnd = true
          continue
        }
        cache.merge(store, batchItems.map(item => normalizeGeneration(item)))
        pagesFetched += 1
        if (batchItems.length < 100) reachedEnd = true
      }
    }
    rows = cache.rowsInRange(store, from, to)
    coverage = cache.rowsInRange(store, from, to, true).length
  }

  const actualTotal = rows.length
  const total = Math.max(expectedTotal, actualTotal)
  const partial = markerFresh
    ? Boolean(marker.partial)
    : failedPages > 0
      || (expectedTotal > 0 && coverage < needed && !reachedEnd)
      || (!reachedEnd && pagesFetched >= maxPages)

  cache.markQuery(store, queryKey, {
    total: expectedTotal,
    actualTotal,
    totalPages: reportedPages,
    maxPages,
    pages: markerFresh ? Number(marker.pages ?? pagesFetched) : pagesFetched,
    ended: reachedEnd,
    partial,
  })
  cache.scheduleSave(fingerprint, store)

  const filtered = model === undefined
    ? rows
    : rows.filter(row => row.model === model || row.modelDisplayName === model)

  return {
    rows: filtered,
    scanned: rows.length,
    total: model === undefined ? total : filtered.length,
    pages: pagesFetched,
    totalPages: Math.max(reportedPages, Math.ceil(actualTotal / 100)),
    partial,
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
  const cache = new Map()
  const historyCache = new HistoryCache(ctx.logger)

  /** Re-read live settings on every request; `Volatile` fields may change in the UI. */
  const current = () => normalizeConfig(config)

  function clearCache() {
    cache.clear()
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

  /** Read-through cache with a small bound. */
  async function cached(key, ttlMs, load) {
    const hit = cache.get(key)
    const now = Date.now()
    if (hit !== undefined) {
      if (hit.expires > now) return hit.value
      // Stale-while-revalidate: keep the last answer visible and refresh it
      // behind the request instead of blocking the panel on a long history scan.
      if (!hit.refreshing) {
        hit.refreshing = true
        Promise.resolve()
          .then(load)
          .then(value => {
            cache.set(key, { value, expires: Date.now() + ttlMs })
          })
          .catch(() => { hit.refreshing = false })
      }
      return hit.value
    }
    const value = await load()
    cache.set(key, { value, expires: Date.now() + ttlMs })
    if (cache.size > 80) {
      const oldest = cache.keys().next().value
      if (oldest !== undefined) cache.delete(oldest)
    }
    return value
  }

  async function loadSummary() {
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

  async function handleOverview(params) {
    const options = current()
    const query = readQuery(params)
    const cacheKey = `overview:${query.period.key}:${query.period.from}:${query.period.to}:${query.requestType}:${query.status}:${query.model}`
    return await cached(cacheKey, Math.max(300_000, options.refreshSeconds * 1000), async () => {
      const [summary, history] = await Promise.all([
        loadSummary(),
        fetchHistory(client, {
          from: query.period.from,
          to: query.period.to,
          requestType: query.requestType,
          status: query.status,
          model: query.model,
          maxPages: options.historyMaxPages,
        }, historyCache),
      ])
      const folded = aggregate(history.rows, {
        fromDate: query.period.fromDate,
        toDate: query.period.toDate,
      })
      return {
        ...summary,
        period: query.period,
        filters: {
          requestType: query.requestType ?? null,
          status: query.status ?? null,
          model: query.model ?? null,
        },
        ...folded,
        exactCost: exactCostFor(query.period.key, summary.key),
        history: {
          scanned: history.scanned,
          total: history.total,
          partial: history.partial,
          pages: history.pages,
          totalPages: history.totalPages,
          maxPages: options.historyMaxPages,
        },
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
        maxPages: Math.min(options.historyMaxPages, 10),
      }, historyCache)
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

    if (query.model !== undefined) {
      const history = await fetchHistory(client, {
        from: query.period.from,
        to: query.period.to,
        requestType: query.requestType,
        status: query.status,
        model: query.model,
        maxPages: options.historyMaxPages,
      }, historyCache)
      const start = (page - 1) * limit
      return {
        items: history.rows.slice(start, start + limit),
        meta: {
          page,
          limit,
          total: history.rows.length,
          totalPages: Math.max(1, Math.ceil(history.rows.length / limit)),
        },
        partial: history.partial,
        fetchedAt: new Date().toISOString(),
      }
    }

    const data = await client.generations({
      page,
      limit,
      dateFrom: query.period.from ?? undefined,
      dateTo: query.period.to,
      requestType: query.requestType,
      status: query.status,
      sortBy,
      sortOrder,
    })
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
        const summary = await cached('summary', 15_000, loadSummary)
        sendJson(res, 200, summary)
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
