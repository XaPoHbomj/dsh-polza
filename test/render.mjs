/** Server-render smoke test for the browser components (no DOM effects). */
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { build } from 'esbuild'
import React from 'react'
import { renderToString } from 'react-dom/server'

await build({
  entryPoints: ['src/client/PolzaPanel.jsx'],
  outfile: 'test/.tmp/panel.cjs',
  bundle: true,
  format: 'cjs',
  platform: 'node',
  jsx: 'automatic',
  external: ['react', 'react/jsx-runtime', 'react-dom'],
  logLevel: 'silent',
})

await build({
  entryPoints: ['src/client/PolzaSettings.jsx'],
  outfile: 'test/.tmp/settings.cjs',
  bundle: true,
  format: 'cjs',
  platform: 'node',
  jsx: 'automatic',
  external: ['react', 'react/jsx-runtime', 'react-dom'],
  logLevel: 'silent',
})

const require = createRequire(import.meta.url)
const { PolzaPanel, BalanceChip } = require('./.tmp/panel.cjs')
const { PolzaSettings } = require('./.tmp/settings.cjs')

const panel = renderToString(React.createElement(PolzaPanel))
assert.ok(panel.includes('Polza'))
assert.ok(panel.includes('Доступно к трате'))
assert.ok(panel.includes('История генераций'))

const chip = renderToString(React.createElement(BalanceChip, { wide: true, openPanel: () => {} }))
assert.ok(chip.includes('polza-chip'))

let snapshot = {
  status: 'ready',
  value: { refreshSeconds: 60, lowBalanceThreshold: 100, criticalBalanceThreshold: 20, historyMaxPages: 100 },
  base: undefined,
  user: undefined,
  revision: 1,
  writable: true,
}
const form = {
  subscribe: () => () => {},
  getSnapshot: () => snapshot,
  mutate: async (ops, revision) => {
    const next = { ...snapshot.value }
    for (const op of ops) next[op.path[0]] = op.value
    snapshot = { ...snapshot, value: next, revision: revision + 1 }
    return true
  },
}
const settings = renderToString(React.createElement(PolzaSettings, { form }))
assert.ok(settings.includes('Настройки Polza'))
assert.ok(settings.includes('Автообновление'))
assert.ok(settings.includes('Жёлтый порог'))

console.log('[render-smoke] ok', { panel: panel.length, chip: chip.length, settings: settings.length })
