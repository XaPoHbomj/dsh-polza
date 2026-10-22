/**
 * Unit tests for the pure host math and the local cache primitives: billing
 * periods, history folds, fingerprints, merge/re-check/persistence. Run with
 * `node test/units.mjs`.
 */
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import {
  addDays, aggregate, billingDate, billingStart, exactCostFor, normalizeGeneration, resolvePeriod,
} from '../src/host/aggregate.js'
import { HistoryCache, historyQueryKey, keyFingerprint, RecencyMap } from '../src/host/cache.js'

// --- aggregate.js: billing-day math -------------------------------------
// Polza's billing day starts at 01:00 MSK = 22:00 UTC of the previous day.
assert.equal(billingDate(Date.parse('2026-10-21T21:59:59.999Z')), '2026-10-21')
assert.equal(billingDate(Date.parse('2026-10-21T22:00:00.000Z')), '2026-10-22')
assert.equal(billingStart('2026-10-22').toISOString(), '2026-10-21T22:00:00.000Z')
assert.equal(addDays('2026-12-31', 1), '2027-01-01')
assert.equal(addDays('2026-03-01', -1), '2026-02-28')

const wednesday = new Date('2026-10-21T12:00:00.000Z')
const week = resolvePeriod('week', undefined, undefined, wednesday)
assert.equal(week.fromDate, '2026-10-19', 'week starts on Monday')
assert.equal(week.toDate, '2026-10-21')
assert.equal(resolvePeriod('nope', undefined, undefined, wednesday).key, '30d', 'unknown period falls back to 30d')
const custom = resolvePeriod('custom', '2026-10-10', '2026-10-12', wednesday)
assert.equal(custom.fromDate, '2026-10-10')
assert.equal(custom.toDate, '2026-10-12')
assert.equal(custom.to, billingStart(addDays('2026-10-12', 1)).toISOString(), 'custom covers the whole last day')

// --- aggregate.js: folds -------------------------------------------------
const row = (id, at, extra = {}) => normalizeGeneration({
  id,
  model: 'm',
  requestType: 'chat',
  status: 'completed',
  cost: '0.5',
  usage: { prompt_tokens: 2, completion_tokens: 3, total_tokens: 5 },
  createdAt: at,
  ...extra,
})

const rows = [
  row('a', '2026-10-21T20:00:00.000Z'),
  row('b', '2026-10-21T22:30:00.000Z', { model: 'other' }),
  row('c', '2026-10-22T08:00:00.000Z', { model: 'other' }),
]
const folded = aggregate(rows, { fromDate: '2026-10-21', toDate: '2026-10-22' })
assert.equal(folded.totals.cost, 1.5)
assert.equal(folded.totals.requests, 3)
assert.equal(folded.totals.totalTokens, 15)
assert.equal(folded.days.length, 2, 'the series is gap-filled over the period')
assert.equal(folded.days[0].date, '2026-10-21')
assert.equal(folded.days[0].requests, 1, '22:30 UTC belongs to the next billing day')
assert.equal(folded.days[1].requests, 2)
assert.equal(folded.models.length, 2)

const many = Array.from({ length: 10 }, (_, index) => row(`m${index}`, '2026-10-22T08:00:00.000Z', { model: `model-${index}` }))
const foldedMany = aggregate(many, {})
assert.equal(foldedMany.models.length, 9, 'top 8 models plus one other bucket')
assert.equal(foldedMany.models.at(-1).key, 'other')
assert.equal(foldedMany.models.at(-1).count, 2)

assert.equal(exactCostFor('7d', { usageDaily: 1 }), null, 'internal periods have no exact rollup')
assert.equal(exactCostFor('today', { usageDaily: 1.5 }).cost, 1.5)
assert.equal(exactCostFor('month', null), null)
assert.equal(normalizeGeneration({ id: 'x', clientCost: '0.25' }).cost, 0.25, 'clientCost is a cost fallback')

// --- cache.js: fingerprints ---------------------------------------------
const fingerprint = keyFingerprint('pza_secret')
assert.equal(fingerprint.length, 20)
assert.equal(fingerprint, keyFingerprint('pza_secret'), 'fingerprint is stable')
assert.notEqual(fingerprint, keyFingerprint('pza_other'))
assert.ok(!fingerprint.includes('pza'), 'fingerprint hides the key')

// --- cache.js: marker identity and LRU map -------------------------------
const range = { from: '2026-10-21T22:00:00.000Z', to: '2026-10-22T10:00:00.000Z' }
assert.notEqual(
  historyQueryKey({ ...range, periodKey: 'today' }),
  historyQueryKey({ ...range, periodKey: 'custom' }),
  'today and custom[today,today] keep separate markers',
)
assert.notEqual(
  historyQueryKey({ ...range, periodKey: 'week', model: 'm' }),
  historyQueryKey({ ...range, periodKey: 'week' }),
  'filters are part of the marker identity',
)
assert.ok(historyQueryKey({ periodKey: 'all', from: null, to: range.to }).includes('|all|'), 'unbounded ranges key as all')

const lru = new RecencyMap(2)
lru.set('a', 1)
lru.set('b', 2)
assert.equal(lru.get('a'), 1, 'a read returns the value')
lru.set('c', 3)
assert.equal(lru.get('b'), undefined, 'the cold key is evicted first')
assert.equal(lru.get('a'), 1, 'a touched key survives the eviction')
assert.equal(lru.get('c'), 3)

// --- cache.js: store primitives -----------------------------------------
const testHome = join(process.cwd(), 'test/.tmp', `units-${Date.now()}-${Math.random().toString(16).slice(2)}`)
mkdirSync(testHome, { recursive: true })
process.env.DSH_HOME = testHome

const cache = new HistoryCache()
const store = await cache.open(fingerprint)

cache.merge(store, [
  row('n1', '2026-10-21T10:00:00.000Z'),
  row('n2', '2026-10-21T11:00:00.000Z', { status: 'pending', cost: 0 }),
])
assert.equal(store.dirty, true, 'new rows mark the store dirty')
store.dirty = false
cache.merge(store, [row('n1', '2026-10-21T10:00:00.000Z')])
assert.equal(store.dirty, false, 'an identical merge is a no-op')

const inRange = cache.rowsInRange(store, '2026-10-21T00:00:00.000Z', '2026-10-21T23:59:59.000Z')
assert.equal(inRange.length, 2, 'pending rows stay visible')
assert.equal(cache.rowsInRange(store, '2026-10-22T00:00:00.000Z', null).length, 0)

// Pending re-checks: a page fetch counts as one, then the rate limit applies.
assert.deepEqual(cache.pendingToRefresh(store, null, null), [], 'a fresh fetch counts as a pending check')
cache.resetPendingChecks()
assert.deepEqual(cache.pendingToRefresh(store, null, null), ['n2'], 'oldest pending first')
assert.deepEqual(cache.pendingToRefresh(store, null, null, row => row.model === 'other'), [], 'keep narrows by query filters')
cache.touchPending(store, ['n2'])
assert.deepEqual(cache.pendingToRefresh(store, null, null), [], 'touch starts the rate limit')

// rowsInRange returns store order; consumers that need a sequence re-sort.
assert.deepEqual(cache.rowsInRange(store, null, null).map(entry => entry.id), ['n1', 'n2'], 'rows come back in store order')

cache.markQuery(store, 'k', { total: 10, actualTotal: 10, maxPages: 5, pages: 5, ended: true, partial: false })
const marker = cache.query(store, 'k')
assert.equal(marker.ended, true)
cache.markQuery(store, 'k', { total: 10, actualTotal: 10, maxPages: 5, pages: 5, ended: true, partial: false })
assert.equal(cache.query(store, 'k'), marker, 'an identical fresh marker is not rewritten')
cache.markQuery(store, 'k', { total: 10, actualTotal: 10, maxPages: 5, pages: 5, ended: true, partial: true, failedPages: 1 })
assert.equal(cache.query(store, 'k').partial, true, 'a differing partial flag rewrites the marker')

// --- cache.js: persistence ----------------------------------------------
await cache.save(fingerprint, store)
assert.equal(store.dirty, false)
const file = join(testHome, 'cache', 'dsh-polza', `${fingerprint}.json`)
assert.equal(statSync(file).mode & 0o777, 0o600, 'the cache file is private')
const reopened = new HistoryCache()
const store2 = await reopened.open(fingerprint)
assert.equal(store2.rows.size, 2, 'rows survive the roundtrip')
assert.equal(reopened.query(store2, 'k').ended, true, 'markers survive the roundtrip')

// Overlapping saves must serialize into one valid, newest payload.
cache.merge(store, [row('n3', '2026-10-21T12:00:00.000Z')])
const firstSave = cache.save(fingerprint, store)
cache.merge(store, [row('n4', '2026-10-21T13:00:00.000Z')])
const secondSave = cache.save(fingerprint, store)
await Promise.all([firstSave, secondSave])
const payload = JSON.parse(readFileSync(file, 'utf8'))
assert.ok(payload.rows.some(entry => entry.id === 'n4'), 'serialized saves keep the newest rows')

// The store stays bounded: the oldest rows are dropped first.
const bulk = Array.from({ length: 60_001 }, (_, index) => row(
  `bulk-${index}`,
  new Date(Date.parse('2026-01-01T00:00:00.000Z') + index * 1000).toISOString(),
))
cache.merge(store, bulk)
assert.equal(store.rows.size, 60_000, 'row bound holds')
assert.equal(store.rows.has('bulk-0'), false, 'the oldest row is dropped')
assert.equal(store.rows.has('bulk-60000'), true)

rmSync(testHome, { recursive: true, force: true })
console.log('[units] ok:', {
  billing: ['2026-10-21', '2026-10-22'],
  models: foldedMany.models.length,
  rows: store.rows.size,
})
