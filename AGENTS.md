# AGENTS.md

Instructions for AI agents and maintainers working on `dsh-polza`.

## What this project is

`dsh-polza` is an **unofficial** DeepSeek Harness (DSH) plugin that shows the
Polza.ai organization balance and per-key spend statistics in the Web GUI. It is
not affiliated with Polza.ai or DeepSeek.

The repository contains both halves of one DSH plugin:

- **Host half** (`src/host/`) runs in the DSH Node process, resolves the API key
  through `ctx.credentials`, talks to the Polza API, aggregates history, caches
  rows locally, and serves read-only JSON routes under `/polza/api`.
- **Client half** (`src/client/`) runs in the browser, registers the sidebar
  balance chip, the full Polza panel, and the settings card on the Plugins page.

## Ground rules

- Never commit API keys, tokens, `.credentials.yaml`, cookies, or captured
  headers. The API key must only ever reach the host process.
- Do not put the key into plugin config. Config names a credential reference
  (`apiKeyRef`, default `POLZA_API_KEY`), and the host resolves its value per
  request.
- Do not edit `_dsh-src/`. It is a read-only reference checkout of DSH and is
  ignored by git. Use it to inspect DSH APIs, not to patch the host.
- Do not hand-edit `lib/client.js`; it is a generated bundle. Change
  `src/client/` and run `pnpm build`.
- The plugin is unofficial. Keep the disclaimer at the top of `README.md`.
- User-facing copy is Russian. Code comments and this file are English.
- Keep the runtime dependency surface small. The host currently depends only on
  `@deepseek-ai/schemastery`; the browser bundle externalizes React and uses
  plain DOM/CSS rather than additional UI packages.

## Commands

```bash
pnpm install       # install dev deps (esbuild, jsdom, react for tests)
pnpm build         # rebuild lib/client.js from src/client/
pnpm watch         # rebuild the client bundle on change
pnpm test          # host smoke + server render + jsdom DOM tests
```

Install into the local DSH Web profile:

```bash
dsh plugin --profile web add "$(pwd)"
# then restart dsh web
```

After changing only `src/client/`, rebuild and refresh the page; DSH HMR serves
the new bundle. After changing `src/host/` or `package.json` metadata, restart
`dsh web` — the host imports its modules at process start.

## Layout

```
src/host/index.js       plugin entry, routes, config, orchestration
src/host/polza.js       Polza HTTP client, retries, error mapping
src/host/aggregate.js   MSK billing periods and history folds
src/host/cache.js       local history cache and query markers
src/host/http.js        JSON responses and the shared error vocabulary
src/client/index.jsx    slot registrations
src/client/PolzaPanel.jsx  chip, panel, chart, table, hover card
src/client/PolzaSettings.jsx  Plugins-page settings form
src/client/api.js       same-origin client for /polza/api
src/client/format.js    RUB precision, dates, labels
src/client/hooks.js     async read and refresh hooks
src/client/styles.js    scoped stylesheet and DSH theme tokens
test/                   host and DOM smoke tests
cordis.patch.yml        bundle layer that inserts the host row
build.mjs               esbuild wrapper for the lazy-CJS client bundle
```

## DSH integration details

- Package manifest declares `dsh.bundle.patch`, `dsh.client.platform: "web"`,
  and `engines.dsh: ">=0.2.0-rc.2 <0.3.0-0"`.
- Client bundle format is `window.__ModuleLoader__.load({ id, factory })` with a
  CJS `factory(require)` body. `build.mjs` adds that wrapper. React and
  `react/jsx-runtime` stay external and resolve from the shell's platform table.
- Registered slots:
  - `sidebar.footer.action` — balance chip;
  - `sidebar.panellist` + `main` keyed `polza` — full panel;
  - `plugins.bundle.config` keyed `dsh-polza` — settings card;
  - `plugins.row.config` keyed `dsh-polza#polza` — same card from the row page.
- The settings form binds to `ctx.configForms.get('polza')`. The `polza` row id
  is the config namespace. `refreshSeconds`, `lowBalanceThreshold`,
  `criticalBalanceThreshold`, and `historyMaxPages` are `volatile`: change them
  without a restart. Other fields need a restart.
- Host routes are GET-only, loopback-only by default (`allowRemote: false`), and
  send no CORS headers. They never return the API key.

## Data semantics

- Balance comes from `GET /api/v2/balance`: `amount`, `available`,
  `reservedAmount`, `spentAmount`, `updatedAt`.
- Key rollups come from `GET /api/v1/key`: daily/weekly/monthly/all-time usage,
  limit, reset period.
- History comes from `GET /api/v1/history/generations` with date, type, status,
  sort, and page filters. The API key sees only its own generations, not the
  whole organization.
- Polza bills in Moscow time and starts its day at 01:00 MSK. `aggregate.js`
  shifts timestamps by +2h to derive the billing date; do not replace this with
  a plain UTC midnight.
- Periods: `today`, `week` (Monday), `month`, `all`, plus internal `7d`/`30d`
  and `custom` support. Exact KPI totals use the key rollups where they map to
  a period; charts and breakdowns fold history rows. The exact total is
  suppressed when request/status/model filters are active, because the key
  rollups cannot answer a filtered query.
- Polza caps `meta.total` at 10 000 and `meta.totalPages` at 100. Pages beyond
  100 can still return rows. `fetchHistory` reads until a short or empty page
  (within `historyMaxPages`) and does not trust the reported total page count.
  When the page cap grows since the last scan, it resumes past the pages the
  store already holds instead of walking the range again.
- The table pagination also keeps “next” available while a full page is
  returned, so it can go past page 100.
- The local cache assumes **completed and failed generations are immutable**.
  `pending` rows are mutable and revalidated: a page fetch counts as one check,
  and rows whose page is no longer re-read are re-checked by id (at most 25 per
  scan, at most once per 2 minutes per row); `/refresh` clears that rate limit.
  Pending rows take part in results and totals like any other row. If the
  immutability assumption is ever wrong for a provider field, bump the cache
  version or add a revalidation path.

## Local cache

- Path: `$DSH_HOME/cache/dsh-polza/<fingerprint>.json`, defaulting to
  `~/.dsh/cache/dsh-polza/`.
- `<fingerprint>` is the first 20 hex characters of SHA-256 over the resolved
  API key. The key itself is never written.
- The cache stores normalized rows, query markers, and timestamps. It is
  bounded to 60 000 rows and 180 days, written atomically with mode `0600`.
- A fresh page 1 is always fetched to pick up new rows; older pages come from
  cache. A query marker records that a range was scanned to the end, so repeat
  period switches skip the deep scan.
- Saves for one fingerprint are chained and each write uses a unique temporary
  file, so concurrent saves can never interleave into one corrupt payload.
- Cache failures are non-fatal: the plugin logs a warning and continues.

## Verification checklist

Before handing off a change:

```bash
pnpm test
pnpm build
```

Then, with a running DSH:

```bash
curl -s http://127.0.0.1:3080/polza/api/health | python3 -m json.tool
curl -s "http://127.0.0.1:3080/polza/api/overview?period=month" | python3 -m json.tool | head
```

Check in the Web GUI:

1. Sidebar chip shows the available balance with kopecks and changes tone when
   thresholds are crossed.
2. Polza panel opens, chart and table load, filters narrow the table.
3. Hovering a history row shows token and cost-line breakdown.
4. Plugins → `dsh-polza` shows the settings card; save a field and verify it
   applies without a restart.
5. Reload the panel for a period already scanned: it should be fast and must not
   silently drop rows.

## Releasing

Releases are published from a git tag, never from an uncommitted working tree.
The npm package is `dsh-polza`; version, tag, and npm must agree.

```bash
npm version patch --no-git-tag-version
pnpm build
pnpm test
git add package.json lib/client.js
git commit -m "Release vX.Y.Z"
git tag -a vX.Y.Z -m "vX.Y.Z"
git push origin main --follow-tags
```

The `release.yml` workflow then:

1. verifies that `GITHUB_REF_NAME` equals `v` + the `package.json` version;
2. installs with the frozen lockfile and runs `pnpm test`;
3. publishes with `npm publish --provenance --access public`;
4. creates a GitHub Release for the tag.

Publishing uses npm **Trusted Publishing** over OIDC: the workflow requests
`id-token: write` and carries no `NPM_TOKEN`. Configure the package once on
npmjs.com under Settings → Trusted Publisher → GitHub Actions with
organization/user `XaPoHbomj`, repository `dsh-polza`, workflow `release.yml`,
and no environment. If the trusted publisher is unavailable, a granular
`NPM_TOKEN` can be restored temporarily as `NODE_AUTH_TOKEN` on the publish
step.

Do not include `_dsh-src/`, `node_modules/`, `test/.tmp/`, or the local
`.credentials.yaml` in a release. `lib/client.js` is the distributed browser
artifact and must be committed before tagging.
