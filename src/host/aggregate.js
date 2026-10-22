/**
 * Billing-period math and pure folds over Polza generation rows. Moscow is a
 * fixed UTC+3 zone, and Polza's billing day starts at 01:00 MSK; shifting a
 * timestamp by +2h therefore names the billing date directly.
 */
import { toNumber } from './polza.js'

const MSK_OFFSET_MS = 3 * 60 * 60 * 1000
const BILLING_SHIFT_MS = MSK_OFFSET_MS - 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

/** Billing date (`YYYY-MM-DD`) of one timestamp. */
export function billingDate(timestamp) {
  return new Date(timestamp + BILLING_SHIFT_MS).toISOString().slice(0, 10)
}

/** First instant of one billing date. */
export function billingStart(date) {
  return new Date(Date.parse(`${date}T00:00:00.000Z`) - BILLING_SHIFT_MS)
}

/** Shift one `YYYY-MM-DD` date by whole days. */
export function addDays(date, days) {
  return new Date(Date.parse(`${date}T00:00:00.000Z`) + days * DAY_MS).toISOString().slice(0, 10)
}

/** Whether one string is a plain calendar date. */
export function isDateString(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

/**
 * Resolve the browser's period choice into an inclusive/exclusive range.
 * `custom` requires both dates; every other key ignores them.
 */
export function resolvePeriod(period, from, to, now = new Date()) {
  const today = billingDate(now.getTime())
  const end = now.toISOString()

  switch (period) {
    case 'today':
      return { key: 'today', from: billingStart(today).toISOString(), to: end, fromDate: today, toDate: today }
    case 'week': {
      const weekday = new Date(`${today}T00:00:00.000Z`).getUTCDay()
      const sinceMonday = (weekday + 6) % 7
      const start = addDays(today, -sinceMonday)
      return { key: 'week', from: billingStart(start).toISOString(), to: end, fromDate: start, toDate: today }
    }
    case '7d': {
      const start = addDays(today, -6)
      return { key: '7d', from: billingStart(start).toISOString(), to: end, fromDate: start, toDate: today }
    }
    case '30d': {
      const start = addDays(today, -29)
      return { key: '30d', from: billingStart(start).toISOString(), to: end, fromDate: start, toDate: today }
    }
    case 'month': {
      const start = `${today.slice(0, 8)}01`
      return { key: 'month', from: billingStart(start).toISOString(), to: end, fromDate: start, toDate: today }
    }
    case 'all':
      return { key: 'all', from: null, to: end, fromDate: null, toDate: today }
    case 'custom': {
      const startDate = isDateString(from) ? from : today
      const endDate = isDateString(to) && to >= startDate ? to : today
      return {
        key: 'custom',
        from: billingStart(startDate).toISOString(),
        to: billingStart(addDays(endDate, 1)).toISOString(),
        fromDate: startDate,
        toDate: endDate,
      }
    }
    default:
      return resolvePeriod('30d', undefined, undefined, now)
  }
}

/** Normalize one history row to the browser contract. */
export function normalizeGeneration(item) {
  const usage = item?.usage ?? {}
  return {
    id: String(item?.id ?? ''),
    model: String(item?.model ?? 'unknown'),
    modelDisplayName: item?.modelDisplayName ? String(item.modelDisplayName) : null,
    requestType: String(item?.requestType ?? 'chat'),
    provider: item?.provider == null ? null : String(item.provider),
    status: String(item?.status ?? 'unknown'),
    cost: toNumber(item?.cost ?? item?.clientCost),
    usage: {
      promptTokens: toNumber(usage.prompt_tokens),
      completionTokens: toNumber(usage.completion_tokens),
      totalTokens: toNumber(usage.total_tokens),
      cachedTokens: toNumber(usage.prompt_tokens_details?.cached_tokens),
      cacheWriteTokens: toNumber(
        usage.prompt_tokens_details?.cache_write_tokens
        ?? usage.cache_write_tokens
        ?? usage.prompt_tokens_details?.cache_write,
      ),
      reasoningTokens: toNumber(usage.completion_tokens_details?.reasoning_tokens),
    },
    generationTimeMs: Number.isFinite(Number(item?.generationTimeMs)) ? Number(item.generationTimeMs) : null,
    createdAt: item?.createdAt ? String(item.createdAt) : null,
    apiKeyShort: item?.apiKeyShort ? String(item.apiKeyShort) : null,
    stepsCount: Number.isFinite(Number(item?.stepsCount)) ? Number(item.stepsCount) : null,
  }
}

/** Empty mutable bucket. */
function bucket() {
  return { cost: 0, requests: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, cachedTokens: 0, reasoningTokens: 0 }
}

/**
 * Fold one normalized row into one bucket. Money is settled money: a pending
 * row is a reservation hold, so it counts as a request and carries its tokens,
 * but its cost lands in the buckets only once the generation settles.
 */
function add(bucketValue, row) {
  if (row.status !== 'pending') bucketValue.cost += row.cost
  bucketValue.requests += 1
  bucketValue.promptTokens += row.usage.promptTokens
  bucketValue.completionTokens += row.usage.completionTokens
  bucketValue.totalTokens += row.usage.totalTokens
  bucketValue.cachedTokens += row.usage.cachedTokens
  bucketValue.reasoningTokens += row.usage.reasoningTokens
}

/** Round currency noise while keeping sub-kopeck precision for sums. */
function money(value) {
  return Math.round(value * 1e6) / 1e6
}

/** Finalize one bucket for JSON. */
function finish(bucketValue) {
  return {
    ...bucketValue,
    cost: money(bucketValue.cost),
    averageCost: bucketValue.requests === 0 ? 0 : money(bucketValue.cost / bucketValue.requests),
  }
}

/** Add an "other" aggregate when the model list is truncated. */
function foldModels(entries, limit) {
  const sorted = entries
    .map(entry => ({ ...finish(entry), key: entry.key, label: entry.label, model: entry.model }))
    .sort((a, b) => b.cost - a.cost)
  if (sorted.length <= limit) return sorted
  const top = sorted.slice(0, limit)
  const rest = sorted.slice(limit)
  const other = bucket()
  for (const entry of rest) {
    other.cost += entry.cost
    other.requests += entry.requests
    other.promptTokens += entry.promptTokens
    other.completionTokens += entry.completionTokens
    other.totalTokens += entry.totalTokens
    other.cachedTokens += entry.cachedTokens
    other.reasoningTokens += entry.reasoningTokens
  }
  top.push({ ...finish(other), key: 'other', label: 'Другое', model: null, count: rest.length })
  return top
}

/**
 * Fold normalized rows into totals, a daily series, and breakdowns.
 * @param rows - normalized generation rows.
 * @param options - period bounds for gap filling.
 */
export function aggregate(rows, options = {}) {
  const totals = bucket()
  const days = new Map()
  const models = new Map()
  const types = new Map()
  const statuses = new Map()
  let earliest = null
  let latest = null

  for (const row of rows) {
    add(totals, row)

    const timestamp = row.createdAt === null ? Number.NaN : Date.parse(row.createdAt)
    if (Number.isFinite(timestamp)) {
      const date = billingDate(timestamp)
      if (earliest === null || date < earliest) earliest = date
      if (latest === null || date > latest) latest = date
      const day = days.get(date) ?? bucket()
      add(day, row)
      days.set(date, day)
    }

    const modelKey = row.model
    const model = models.get(modelKey) ?? { ...bucket(), key: modelKey, label: row.modelDisplayName ?? modelKey, model: modelKey }
    add(model, row)
    models.set(modelKey, model)

    const typeKey = row.requestType
    const type = types.get(typeKey) ?? { ...bucket(), key: typeKey }
    add(type, row)
    types.set(typeKey, type)

    const status = statuses.get(row.status) ?? { ...bucket(), key: row.status }
    add(status, row)
    statuses.set(row.status, status)
  }

  const fromDate = options.fromDate ?? earliest
  const toDate = options.toDate ?? latest
  const span = fromDate !== null && toDate !== null
    ? Math.round((Date.parse(`${toDate}T00:00:00Z`) - Date.parse(`${fromDate}T00:00:00Z`)) / DAY_MS) + 1
    : 0

  let series
  if (fromDate !== null && toDate !== null && span > 0 && span <= 62) {
    series = []
    for (let index = 0; index < span; index += 1) {
      const date = addDays(fromDate, index)
      series.push({ date, ...(days.has(date) ? finish(days.get(date)) : { ...finish(bucket()), date }) })
    }
  } else {
    series = [...days.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({ date, ...finish(value) }))
  }

  const modelList = foldModels([...models.values()], 8)
  const typeList = [...types.values()].map(value => ({ key: value.key, ...finish(value) })).sort((a, b) => b.cost - a.cost)
  const statusList = [...statuses.values()].map(value => ({ key: value.key, ...finish(value) })).sort((a, b) => b.requests - a.requests)

  return {
    totals: finish(totals),
    days: series,
    models: modelList,
    types: typeList,
    statuses: statusList,
  }
}

/** Exact cost from the key rollup when the period maps onto one of its fields. */
export function exactCostFor(periodKey, key) {
  if (key === null || key === undefined) return null
  if (periodKey === 'today') return { cost: toNumber(key.usageDaily), source: 'usage_daily' }
  if (periodKey === 'week') return { cost: toNumber(key.usageWeekly), source: 'usage_weekly' }
  if (periodKey === 'month') return { cost: toNumber(key.usageMonthly), source: 'usage_monthly' }
  if (periodKey === 'all') return { cost: toNumber(key.usage), source: 'usage' }
  return null
}
