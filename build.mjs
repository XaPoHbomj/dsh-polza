/**
 * Build the browser half into the lazy-CJS factory format the DSH client
 * module system serves: one script that registers the package id and a
 * factory(require) closure. React stays external and resolves through the
 * module table seeded by the shell.
 */
import { build, context } from 'esbuild'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const watch = process.argv.includes('--watch')
const packageName = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8')).name

/** Wrap the compiled CJS body in the loader handoff. */
function loaderWrapper() {
  return {
    name: 'dsh-client-loader-wrapper',
    setup(build) {
      build.onEnd(async result => {
        if (result.errors.length > 0) return
        const outfile = resolve(root, 'lib/client.js')
        const { readFile: read, writeFile } = await import('node:fs/promises')
        const body = await read(outfile, 'utf8')
        const wrapped = [
          'window.__ModuleLoader__.load({',
          `\tid: ${JSON.stringify(packageName)},`,
          '\tfactory: (require) => {',
          '\t\tvar module = { exports: {} };',
          '\t\tvar exports = module.exports;',
          body,
          '\t\treturn module.exports;',
          '\t}',
          '});',
          '',
        ].join('\n')
        await writeFile(outfile, wrapped)
      })
    },
  }
}

const options = {
  entryPoints: [resolve(root, 'src/client/index.jsx')],
  outfile: resolve(root, 'lib/client.js'),
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: ['es2022'],
  jsx: 'automatic',
  jsxImportSource: 'react',
  external: ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client'],
  define: { 'process.env.NODE_ENV': '"production"' },
  sourcemap: true,
  logLevel: 'info',
  plugins: [loaderWrapper()],
}

if (watch) {
  const ctx = await context(options)
  await ctx.watch()
  console.log('[dsh-polza] watching client bundle')
} else {
  await build(options)
  console.log('[dsh-polza] client bundle built')
}
