/**
 * Host smoke test without a running DSH: a fake Cordis context, canned Polza
 * responses, and the real route handler. Run with `node test/host-smoke.mjs`.
 */
import assert from 'node:assert/strict'
import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { apply } from '../src/host/index.js'

// Keep the persistent history cache out of the real harness home.
const testHome = join(process.cwd(), 'test/.tmp', `cache-${Date.now()}-${Math.random().toString(16).slice(2)}`)
mkdirSync(testHome, { recursive: true })
process.env.DSH_HOME = testHome

const now = Date.now()
const rows = Array.from({ length: 250 }, (_, index) => ({
  id: `gen_${index}`,
  model: index % 3 === 0 ? 'model/a' : 'model/b',
  modelDisplayName: index % 3 === 0 ? 'Model A' : 'Model B',
  requestType: index % 5 === 0 ? 'image' : 'chat',
  provider: 'test',
  status: index % 17 === 0 ? 'failed' : 'completed',
  cost: '0.25',
  usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
  createdAt: new Date(now - index * 60_000).toISOString(),
}))

// One long-running generation on page 2: its page is not re-read by later
// scans, so only the by-id re-check can learn that it completed.
const pendingCreatedAt = new Date(now - 150 * 60_000).toISOString()
rows[150] = { ...rows[150], id: 'gen_pending', status: 'pending', cost: '0.10' }
let pendingDetailCalls = 0
let gen429Calls = 0
let pendingDetail = {
  id: 'gen_pending',
  model: 'model/a',
  modelDisplayName: 'Model A',
  requestType: 'chat',
  provider: 'test',
  status: 'pending',
  clientCost: '0.10',
  usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
  createdAt: pendingCreatedAt,
}

let historyPageOneCalls = 0
const pageCalls = new Map()
const failingPages = new Set()
let reportedTotal = 200
let reportedTotalPages = 2
let pending2Calls = 0
let pending2Detail = {
  id: 'gen_pending2',
  model: 'model/a',
  modelDisplayName: 'Model A',
  requestType: 'chat',
  provider: 'test',
  status: 'pending',
  clientCost: '0.30',
  usage: { prompt_tokens: 4, completion_tokens: 2, total_tokens: 6 },
  createdAt: new Date(now - 220 * 60_000).toISOString(),
}
globalThis.fetch = async input => {
  const url = new URL(String(input))
  if (url.pathname.endsWith('/v2/balance')) {
    return new Response(JSON.stringify({
      amount: '100.5',
      available: '90.25',
      reservedAmount: '1.5',
      spentAmount: '500',
      updatedAt: new Date(now).toISOString(),
    }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  if (url.pathname.endsWith('/v1/key')) {
    return new Response(JSON.stringify({
      label: 'pza_test••••0000',
      limit: 10,
      limit_remaining: 7.5,
      limit_reset: 'monthly',
      usage: 100,
      usage_daily: 3,
      usage_weekly: 25,
      usage_monthly: 60,
    }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  if (url.pathname.endsWith('/v1/history/generations/gen_pending2')) {
    pending2Calls += 1
    return new Response(JSON.stringify(pending2Detail), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  if (url.pathname.endsWith('/v1/history/generations/gen_pending')) {
    pendingDetailCalls += 1
    return new Response(JSON.stringify(pendingDetail), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  if (url.pathname.endsWith('/v1/history/generations/gen_503')) {
    return new Response(JSON.stringify({ error: { message: 'upstream down' } }), {
      status: 503,
      headers: { 'content-type': 'application/json', 'retry-after': '0' },
    })
  }
  if (url.pathname.endsWith('/v1/history/generations/gen_429')) {
    gen429Calls += 1
    if (gen429Calls === 1) {
      return new Response(JSON.stringify({ error: { message: 'slow down' } }), {
        status: 429,
        headers: { 'content-type': 'application/json', 'retry-after': '1' },
      })
    }
    return new Response(JSON.stringify({
      id: 'gen_429',
      model: 'model/a',
      requestType: 'chat',
      status: 'completed',
      clientCost: '0.10',
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      createdAt: new Date(now).toISOString(),
    }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  if (/\/v1\/history\/generations\/gen_/.test(url.pathname)) {
    return new Response(JSON.stringify({
      id: 'gen_1',
      model: 'model/a',
      modelDisplayName: 'Model A',
      requestType: 'chat',
      status: 'completed',
      clientCost: '0.18137669',
      usage: { prompt_tokens: 249067, completion_tokens: 1280, total_tokens: 250347, prompt_tokens_details: { cached_tokens: 248832, cache_write_tokens: 0 }, completion_tokens_details: { reasoning_tokens: 281 } },
      costLines: [
        { kind: 'prompt', unit: 'token', quantity: 235, clientRub: '0.00412554' },
        { kind: 'cached_read', unit: 'token', quantity: 248832, clientRub: '0.08736720' },
        { kind: 'completion', unit: 'token', quantity: 1280, clientRub: '0.08988395' },
      ],
      createdAt: new Date(now).toISOString(),
    }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  if (url.pathname.endsWith('/v1/history/generations')) {
    const page = Number(url.searchParams.get('page') ?? '1')
    if (page === 1) historyPageOneCalls += 1
    pageCalls.set(page, (pageCalls.get(page) ?? 0) + 1)
    if (failingPages.has(page)) {
      return new Response(JSON.stringify({ error: { message: 'page failed' } }), {
        status: 503,
        headers: { 'content-type': 'application/json', 'retry-after': '0' },
      })
    }
    const limit = Number(url.searchParams.get('limit') ?? '100')
    const start = (page - 1) * limit
    const items = rows.slice(start, start + limit)
    return new Response(JSON.stringify({
      items,
      // Simulate Polza's metadata caps: pages beyond the reported total still
      // return rows. `reportedTotal` can also overstate what pages really hold.
      meta: { page, limit, total: reportedTotal, totalPages: reportedTotalPages },
    }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  return new Response(JSON.stringify({ error: { message: 'not found' } }), { status: 404 })
}

let handler
const disposed = []
const ctx = {
  credentials: {
    resolve: async () => ({ value: 'test-key', source: 'file' }),
    describe: async () => ({ configured: true, source: 'file', writable: true }),
  },
  webServer: {
    register: route => {
      handler = route.handler
      return () => disposed.push('route')
    },
  },
  effect: run => {
    const dispose = run()
    return () => dispose?.()
  },
  on: () => {},
  logger: { info: () => {} },
}

let liveRefresh = 900
let liveMaxPages = 3
apply(ctx, { historyMaxPages: { get: () => liveMaxPages }, refreshSeconds: { get: () => liveRefresh } })

function call(url, method = 'GET') {
  const req = { method, url, socket: { remoteAddress: '127.0.0.1' }, headers: {} }
  let payload = ''
  const res = {
    statusCode: 0,
    headers: {},
    setHeader(name, value) { this.headers[name] = value },
    end(chunk) { payload = chunk ?? '' },
  }
  return handler(req, res).then(() => ({
    status: res.statusCode,
    body: payload === '' ? null : JSON.parse(payload),
  }))
}

const health = await call('/polza/api/health')
assert.equal(health.status, 200)
assert.equal(health.body.configured, true)
assert.equal(health.body.config.refreshSeconds, 900)
liveRefresh = 120
const changed = await call('/polza/api/health')
assert.equal(changed.body.config.refreshSeconds, 120)

const overview = await call('/polza/api/overview?period=week')
assert.equal(overview.status, 200)
assert.equal(overview.body.period.key, 'week')
assert.equal(overview.body.exactCost.source, 'usage_weekly')
assert.equal(overview.body.exactCost.cost, 25)
assert.equal(overview.body.history.pages, 3)
assert.equal(overview.body.history.total, 250)
assert.equal(overview.body.history.partial, false)
assert.equal(overview.body.balance.available, 90.25)
assert.ok(overview.body.days.length >= 1)
assert.ok(overview.body.models.length >= 1)

historyPageOneCalls = 0
const cacheOnlyOverview = await call('/polza/api/overview?period=week&cache=1')
assert.equal(historyPageOneCalls, 0, 'cache-only overview must not touch the network')
assert.equal(cacheOnlyOverview.status, 200)
assert.equal(cacheOnlyOverview.body.cache.source, 'memory')
assert.ok(cacheOnlyOverview.body.history.scanned > 0)

const freshOverview = await call('/polza/api/overview?period=week&fresh=1')
assert.equal(freshOverview.status, 200)
assert.equal(freshOverview.body.cache.source, 'live')

historyPageOneCalls = 0
const cacheOnlyTable = await call('/polza/api/generations?period=week&limit=5&page=1&cache=1')
assert.equal(historyPageOneCalls, 0, 'cache-only table must not touch the network')
assert.equal(cacheOnlyTable.status, 200)
assert.equal(cacheOnlyTable.body.cache.source, 'disk')
assert.equal(cacheOnlyTable.body.items.length, 5)

await call('/polza/api/refresh')
historyPageOneCalls = 0
const diskOverview = await call('/polza/api/overview?period=week&cache=1')
assert.equal(historyPageOneCalls, 0, 'disk cache-only overview must not touch the network')
assert.equal(diskOverview.status, 200)
assert.equal(diskOverview.body.cache.source, 'disk')
assert.ok(diskOverview.body.history.scanned > 0)
const cachedOverview = await call('/polza/api/overview?period=week')
assert.equal(cachedOverview.status, 200)
assert.equal(cachedOverview.body.history.pages, 1, 'second read uses the local history cache')

const generations = await call('/polza/api/generations?period=week&limit=5&page=2')
assert.equal(generations.status, 200)
assert.equal(generations.body.items.length, 5)
assert.equal(generations.body.meta.page, 2)

const detail = await call('/polza/api/generation?id=gen_1')
assert.equal(detail.status, 200)
assert.equal(detail.body.cost, 0.18137669)
assert.equal(detail.body.usage.cacheWriteTokens, 0)
assert.equal(detail.body.costLines.length, 3)

const models = await call('/polza/api/models')
assert.equal(models.status, 200)
assert.ok(models.body.items.length >= 1)

historyPageOneCalls = 0
const concurrent = await Promise.all([
  call('/polza/api/overview?period=day&fresh=1'),
  call('/polza/api/overview?period=day&fresh=1'),
])
assert.ok(concurrent.every(item => item.status === 200))
assert.equal(historyPageOneCalls, 1, 'concurrent overviews share one page-1 request')

const forbidden = await call('/polza/api/health')
assert.equal(forbidden.status, 200)

const foreign = await (async () => {
  const req = { method: 'GET', url: '/polza/api/health', socket: { remoteAddress: '192.168.1.10' }, headers: {} }
  let payload = ''
  const res = { statusCode: 0, setHeader() {}, end(chunk) { payload = chunk ?? '' } }
  await handler(req, res)
  return { status: res.statusCode, body: JSON.parse(payload) }
})()
assert.equal(foreign.status, 403)

const missing = await call('/polza/api/nope')
assert.equal(missing.status, 404)

// --- pending lifecycle: visible everywhere, re-checked by id, rate-limited ---
// Earlier calls may already have re-checked the row once, so assert deltas.
const detailCallsBefore = pendingDetailCalls
const pendingOverview = await call('/polza/api/overview?period=week&status=pending&fresh=1')
assert.equal(pendingOverview.status, 200)
assert.equal(pendingOverview.body.totals.requests, 1, 'pending rows take part in totals')
assert.equal(pendingOverview.body.exactCost, null, 'exact cost is suppressed while filters are active')

const pendingTable = await call('/polza/api/generations?period=week&status=pending&cache=1')
assert.equal(pendingTable.status, 200)
assert.equal(pendingTable.body.items.length, 1, 'the pending filter finds pending rows in the cache')
assert.equal(pendingTable.body.items[0].id, 'gen_pending')
assert.equal(pendingDetailCalls, detailCallsBefore, 'a fresh page fetch counts as a pending check')

// The row completes upstream, but its page is no longer re-read by scans.
pendingDetail = { ...pendingDetail, status: 'completed', clientCost: '0.55' }
const rateLimited = await call('/polza/api/overview?period=week&fresh=1')
assert.equal(rateLimited.status, 200)
assert.equal(pendingDetailCalls, detailCallsBefore, 'the by-id re-check respects its rate limit')

// «Обновить» clears the rate limit, so the very next scan re-checks the row.
await call('/polza/api/refresh')
const afterRefresh = await call('/polza/api/overview?period=week&fresh=1')
assert.equal(afterRefresh.status, 200)
assert.equal(pendingDetailCalls, detailCallsBefore + 1, 'refresh re-checks stuck pending rows by id')
assert.equal(afterRefresh.body.totals.requests, 250, 'completed rows keep counting in totals')

const settledTable = await call('/polza/api/generations?period=week&model=model/a&limit=100&cache=1')
const settled = settledTable.body.items.find(item => item.id === 'gen_pending')
assert.equal(settled.status, 'completed', 'the by-id re-check updates the cached status')
assert.equal(settled.cost, 0.55, 'the by-id re-check updates the cached cost')

const gonePending = await call('/polza/api/generations?period=week&status=pending&cache=1')
assert.equal(gonePending.body.items.length, 0, 'completed rows leave the pending filter')

const filteredOverview = await call('/polza/api/overview?period=week&model=model/a&fresh=1')
assert.equal(filteredOverview.status, 200)
assert.equal(filteredOverview.body.exactCost, null, 'model filters also suppress the exact cost')

// --- failure vocabulary and Retry-After ---------------------------------
const unavailable = await call('/polza/api/generation?id=gen_503')
assert.equal(unavailable.status, 502)
assert.equal(unavailable.body.error.code, 'polza/unavailable', 'upstream outages keep their own error code')

const retriedStartedAt = Date.now()
const retried = await call('/polza/api/generation?id=gen_429')
assert.equal(retried.status, 200)
assert.equal(retried.body.id, 'gen_429', 'a rate-limited call is retried')
assert.ok(Date.now() - retriedStartedAt >= 950, 'the retry honors Retry-After')

// --- deepened resume: continue past the pages the marker verified --------
liveMaxPages = 2
reportedTotal = 400
const thin = await call('/polza/api/overview?period=month&fresh=1&requestType=image')
assert.equal(thin.status, 200)
assert.equal(thin.body.history.partial, true, 'a page-capped scan reports partial')

const monthPageTwo = pageCalls.get(2) ?? 0
const monthPageThree = pageCalls.get(3) ?? 0
liveMaxPages = 3
const deepened = await call('/polza/api/overview?period=month&fresh=1&requestType=image')
assert.equal(pageCalls.get(2) ?? 0, monthPageTwo, 'the resumed scan skips pages the marker verified')
assert.equal(pageCalls.get(3) ?? 0, monthPageThree + 1, 'the resumed scan continues from the marker depth')
assert.equal(deepened.body.history.partial, false, 'reaching the end clears partial')

// --- a failed page marks the scan partial and the next walk heals it -----
failingPages.add(2)
liveMaxPages = 2
reportedTotal = 400
const broken = await call('/polza/api/overview?period=today&fresh=1&requestType=image')
assert.equal(broken.body.history.partial, true, 'a failed page marks the scan partial')

const todayPageTwo = pageCalls.get(2) ?? 0
failingPages.clear()
liveMaxPages = 3
const healed = await call('/polza/api/overview?period=today&fresh=1&requestType=image')
assert.equal(pageCalls.get(2) ?? 0, todayPageTwo + 1, 'the walk restarts at the hole')
assert.equal(healed.body.history.partial, false, 'the successful walk clears partial')

// --- a stuck partial flag clears when a later scan completes -------------
failingPages.add(2)
liveMaxPages = 3
reportedTotal = 400
await call('/polza/api/overview?period=7d&fresh=1&requestType=image')
failingPages.clear()
reportedTotal = 0 // no totals reported: the scan must walk and verify the end
const unstuck = await call('/polza/api/overview?period=7d&fresh=1&requestType=image')
assert.equal(unstuck.status, 200)
assert.equal(unstuck.body.history.partial, false, 'a successful scan clears a stuck partial flag')

// --- the marker stops at the first hole, so widening the cap re-reads it -
rows.push(...Array.from({ length: 100 }, (_, index) => ({
  ...rows[index],
  id: `hole_${index}`,
  createdAt: new Date(now - (300 + index) * 60_000).toISOString(),
})))
failingPages.add(2)
liveMaxPages = 3
reportedTotal = 400
const holed = await call('/polza/api/overview?period=week&fresh=1&requestType=image')
assert.equal(holed.body.history.partial, true, 'a hole keeps the scan partial')

const weekPageTwo = pageCalls.get(2) ?? 0
failingPages.clear()
liveMaxPages = 4
const repaired = await call('/polza/api/overview?period=week&fresh=1&requestType=image')
assert.equal(pageCalls.get(2) ?? 0, weekPageTwo + 1, 'the verified depth stops at the hole, so the hole is re-read')
assert.equal(repaired.body.history.partial, false, 'the repaired walk confirms the range')

// --- a hole outranks the actualTotal > total heuristic -------------------
rows.splice(220, 0, ...Array.from({ length: 40 }, (_, index) => ({
  id: `embed_${index}`,
  model: 'model/a',
  modelDisplayName: 'Model A',
  requestType: 'embed',
  provider: 'test',
  status: 'completed',
  cost: '0.05',
  usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 },
  createdAt: new Date(now - (200 + index) * 60_000).toISOString(),
})))
reportedTotalPages = 100
reportedTotal = 20
liveMaxPages = 150
failingPages.add(2)
const holeScan = await call('/polza/api/overview?period=month&fresh=1&requestType=embed')
assert.equal(holeScan.body.history.partial, true, 'a hole keeps the scan partial')

failingPages.clear()
const cappedHeal = await call('/polza/api/overview?period=month&fresh=1&requestType=embed')
assert.equal(cappedHeal.body.history.partial, false, 'a hole outranks the actualTotal > total completeness guess')

// --- «Обновить» re-opens a range whose walk left a hole -----------------
reportedTotalPages = 2
reportedTotal = 200
liveMaxPages = 3
failingPages.add(2)
await call('/polza/api/overview?period=7d&fresh=1&requestType=embed')

const holePageTwo = pageCalls.get(2) ?? 0
failingPages.clear()
await call('/polza/api/refresh')
const refreshedHole = await call('/polza/api/overview?period=7d&fresh=1&requestType=embed')
assert.equal(refreshedHole.status, 200)
assert.equal(pageCalls.get(2) ?? 0, holePageTwo + 1, 'refresh retries the hole at the same page cap')

// --- a fresh re-walk supersedes an old marker's depth --------------------
reportedTotal = 400
liveMaxPages = 3
await call('/polza/api/overview?period=week&fresh=1&requestType=embed') // healthy depth 3

failingPages.add(2)
reportedTotal = 600
liveMaxPages = 4
const rewalk = await call('/polza/api/overview?period=week&fresh=1&requestType=embed')
assert.equal(rewalk.body.history.partial, true, 'a re-walk that hits a hole reports partial')

const rewalkPageTwo = pageCalls.get(2) ?? 0
failingPages.clear()
await call('/polza/api/refresh')
const rewalkHealed = await call('/polza/api/overview?period=week&fresh=1&requestType=embed')
assert.equal(pageCalls.get(2) ?? 0, rewalkPageTwo + 1, 'an old depth is not trusted after a re-walk, so the hole is re-read')
assert.equal(rewalkHealed.body.history.partial, false)

// --- pending re-checks run for status filters too ------------------------
rows.splice(250, 0, {
  ...rows[0],
  id: 'gen_pending2',
  model: 'model/a',
  modelDisplayName: 'Model A',
  requestType: 'chat',
  status: 'pending',
  cost: '0.30',
  createdAt: new Date(now - 220 * 60_000).toISOString(),
})
reportedTotalPages = 100
reportedTotal = 150
liveMaxPages = 150
await call('/polza/api/overview?period=month&status=completed&model=model/a&fresh=1') // merges the deep row
pending2Detail = { ...pending2Detail, status: 'completed', clientCost: '0.55' }
await call('/polza/api/refresh')

const completedView = await call('/polza/api/overview?period=month&status=completed&model=model/a&fresh=1')
assert.equal(completedView.status, 200)
assert.equal(pending2Calls, 1, 'a completed-only query still re-checks pending rows')

const settledPending2 = await call('/polza/api/generations?period=month&model=model/a&limit=100&cache=1')
const settled2 = settledPending2.body.items.find(item => item.id === 'gen_pending2')
assert.equal(settled2.status, 'completed', 'the re-check lands in the cached row')
assert.equal(settled2.cost, 0.55)

await new Promise(resolve => setTimeout(resolve, 700))
rmSync(testHome, { recursive: true, force: true })

console.log('[host-smoke] ok:', {
  period: overview.body.period.key,
  exact: overview.body.exactCost,
  pages: overview.body.history.pages,
  models: models.body.items.length,
  generations: generations.body.items.length,
})
