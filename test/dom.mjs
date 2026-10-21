/** Mount the browser components in jsdom against a mocked host API. */
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { build } from 'esbuild'
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div><div id="chip"></div></body></html>', {
  url: 'http://127.0.0.1:3080/',
  pretendToBeVisual: true,
})
globalThis.window = dom.window
globalThis.document = dom.window.document
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true })
globalThis.HTMLElement = dom.window.HTMLElement
globalThis.Node = dom.window.Node
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const json = body => Promise.resolve(new Response(JSON.stringify(body), {
  status: 200,
  headers: { 'content-type': 'application/json' },
}))

globalThis.fetch = async input => {
  const url = new URL(String(input), 'http://127.0.0.1:3080')
  if (url.pathname.endsWith('/health')) {
    return json({ ok: true, ref: 'POLZA_API_KEY', configured: true, source: 'file', writable: true, config: { refreshSeconds: 60, lowBalanceThreshold: 100, criticalBalanceThreshold: 20, historyMaxPages: 30 } })
  }
  if (url.pathname.endsWith('/summary')) {
    return json({ balance: { amount: 1250, available: 1240, reservedAmount: 10, spentAmount: 900, updatedAt: new Date().toISOString() }, key: { label: 'pza_test••••0000', limit: 10, limitRemaining: 7.5, limitReset: 'monthly', usage: 100, usageDaily: 3, usageWeekly: 25, usageMonthly: 60 }, keyError: null, fetchedAt: new Date().toISOString() })
  }
  if (url.pathname.endsWith('/models')) {
    return json({ items: [{ key: 'model/a', label: 'Model A', requests: 10, cost: 5 }], partial: false })
  }
  if (url.pathname.endsWith('/overview')) {
    return json({
      balance: { amount: 1250, available: 1240, reservedAmount: 10, spentAmount: 900, updatedAt: new Date().toISOString() },
      key: { label: 'pza_test••••0000', limit: 10, limitRemaining: 7.5, limitReset: 'monthly', usage: 100, usageDaily: 3, usageWeekly: 25, usageMonthly: 60 },
      keyError: null,
      period: { key: 'week', from: '2026-10-19T22:00:00.000Z', to: '2026-10-21T10:00:00.000Z', fromDate: '2026-10-19', toDate: '2026-10-21' },
      filters: {},
      totals: { cost: 12.5, requests: 25, promptTokens: 1000, completionTokens: 200, totalTokens: 1200, cachedTokens: 100, reasoningTokens: 20, averageCost: 0.5 },
      days: [{ date: '2026-10-19', cost: 5, requests: 10, promptTokens: 100, completionTokens: 20, totalTokens: 120, cachedTokens: 0, reasoningTokens: 0, averageCost: 0.5 }, { date: '2026-10-20', cost: 7.5, requests: 15, promptTokens: 200, completionTokens: 30, totalTokens: 230, cachedTokens: 0, reasoningTokens: 0, averageCost: 0.5 }],
      models: [{ key: 'model/a', label: 'Model A', model: 'model/a', cost: 10, requests: 20, promptTokens: 1, completionTokens: 1, totalTokens: 2, cachedTokens: 0, reasoningTokens: 0, averageCost: 0.5 }, { key: 'model/b', label: 'Model B', model: 'model/b', cost: 2.5, requests: 5, promptTokens: 1, completionTokens: 1, totalTokens: 2, cachedTokens: 0, reasoningTokens: 0, averageCost: 0.5 }],
      types: [{ key: 'chat', ...{ cost: 12.5, requests: 25, promptTokens: 1, completionTokens: 1, totalTokens: 2, cachedTokens: 0, reasoningTokens: 0, averageCost: 0.5 } }],
      statuses: [],
      exactCost: { cost: 25, source: 'usage_weekly' },
      history: { scanned: 25, total: 25, partial: false, pages: 1, totalPages: 1, maxPages: 30 },
      fetchedAt: new Date().toISOString(),
    })
  }
  if (url.pathname.endsWith('/generations')) {
    return json({ items: [{ id: 'gen_1', model: 'model/a', modelDisplayName: 'Model A', requestType: 'chat', status: 'completed', cost: 0.18137669, usage: { promptTokens: 249067, completionTokens: 1280, totalTokens: 250347, cachedTokens: 248832, cacheWriteTokens: 0, reasoningTokens: 281 }, createdAt: '2026-10-21T09:00:00.000Z' }], meta: { page: 1, limit: 25, total: 1, totalPages: 1 }, partial: false })
  }
  if (url.pathname.endsWith('/generation')) {
    return json({ id: 'gen_1', model: 'model/a', modelDisplayName: 'Model A', requestType: 'chat', status: 'completed', cost: 0.18137669, usage: { promptTokens: 249067, completionTokens: 1280, totalTokens: 250347, cachedTokens: 248832, cacheWriteTokens: 0, reasoningTokens: 281 }, costLines: [
      { kind: 'prompt', quantity: 235, unit: 'token', cost: 0.00412554 },
      { kind: 'cached_read', quantity: 248832, unit: 'token', cost: 0.08736720 },
      { kind: 'completion', quantity: 1280, unit: 'token', cost: 0.08988395 },
    ], createdAt: '2026-10-21T09:00:00.000Z' })
  }
  return json({})
}

await build({
  entryPoints: ['src/client/index.jsx'],
  outfile: 'test/.tmp/index.cjs',
  bundle: true,
  format: 'cjs',
  platform: 'node',
  jsx: 'automatic',
  external: ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client'],
  logLevel: 'silent',
})

await build({
  entryPoints: ['src/client/PolzaPanel.jsx'],
  outfile: 'test/.tmp/dom.cjs',
  bundle: true,
  format: 'cjs',
  platform: 'node',
  jsx: 'automatic',
  external: ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client'],
  logLevel: 'silent',
})

const require = createRequire(import.meta.url)
const React = require('react')
const { createRoot } = require('react-dom/client')
const { PolzaPanel, BalanceChip } = require('./.tmp/dom.cjs')
const clientPlugin = require('./.tmp/index.cjs')

const originalError = console.error
console.error = (...args) => {
  if (String(args[0]).includes('not wrapped in act')) return
  originalError(...args)
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

const root = createRoot(document.getElementById('root'))
root.render(React.createElement(PolzaPanel))
await sleep(120)

const text = document.getElementById('root').textContent
assert.ok(text.includes('Polza'), 'panel title')
assert.ok(text.includes('Доступно к трате'), 'kpi')
assert.ok(/1\s?240/.test(text), 'available amount')
assert.ok(text.includes('Model A'), 'model breakdown')
assert.ok(text.includes('История генераций'), 'table title')
assert.ok(text.includes('Лимит ключа'), 'key limit block')
const limitSelect = document.querySelector('.polza-panel-head .polza-select')
assert.ok(limitSelect !== null, 'limit select')
assert.ok([...limitSelect.options].every(option => option.value !== ''), 'no empty limit option')
assert.ok(text.includes('0,18137669'), 'precise per-request cost')

const row = document.querySelector('.polza-table tbody tr')
row.dispatchEvent(new dom.window.MouseEvent('mouseover', { bubbles: true }))
await sleep(120)
assert.ok(document.body.textContent.includes('Из чего сложилась цена'), 'hover title')
assert.ok(document.body.textContent.includes('из них из кэша'), 'hover token rows')
assert.ok(document.body.textContent.includes('Вход из кэша'), 'hover cost lines')

let opened = 0
const chipRoot = createRoot(document.getElementById('chip'))
chipRoot.render(React.createElement(BalanceChip, { wide: true, openPanel: () => { opened += 1 } }))
await sleep(80)
const chip = document.querySelector('.polza-chip')
assert.ok(chip !== null, 'chip rendered')
chip.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
assert.equal(opened, 1)

const registered = []
const fakeCtx = {
  slots: {
    inject(name, callback) { callback() },
    register(options) { registered.push(options); return () => {} },
  },
  layout: { selectPanel() {} },
  configForms: { get: () => ({ subscribe: () => () => {}, getSnapshot: () => ({ status: 'unavailable' }), mutate: async () => true }) },
}
clientPlugin.apply(fakeCtx)
assert.ok(registered.some(item => item.name === 'plugins.bundle.config' && item.key === 'dsh-polza'), 'bundle settings slot')
assert.ok(registered.some(item => item.name === 'plugins.row.config' && item.key === 'dsh-polza#polza'), 'row settings slot')
assert.ok(registered.some(item => item.name === 'sidebar.footer.action'), 'balance chip slot')
assert.ok(clientPlugin.inject.includes('configForms'), 'config form service')

root.unmount()
chipRoot.unmount()
console.log('[dom-smoke] ok', { text: text.length, chip: chip.textContent })
