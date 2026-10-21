/** Thin same-origin client for the host half's read-only API. */

const BASE = '/polza/api'

/** Build a query string, omitting empty values. */
function query(params) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === undefined || value === null || value === '') continue
    search.set(key, String(value))
  }
  const text = search.toString()
  return text === '' ? '' : `?${text}`
}

/** One JSON request with the host's normalized error vocabulary. */
async function request(path, params, options = {}) {
  const url = `${BASE}${path}${query(params)}`
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    credentials: 'same-origin',
    cache: 'no-store',
    signal: options.signal,
  })
  let body
  try {
    body = await response.json()
  } catch {
    body = undefined
  }
  if (!response.ok) {
    const error = new Error(body?.error?.message ?? `HTTP ${response.status}`)
    error.code = body?.error?.code ?? 'polza/http'
    error.status = response.status
    throw error
  }
  if (body === undefined) throw new Error('Пустой ответ хоста')
  return body
}

export const api = {
  health: options => request('/health', undefined, options),
  refresh: options => request('/refresh', undefined, options),
  summary: options => request('/summary', undefined, options),
  models: options => request('/models', undefined, options),
  overview: (params, options) => request('/overview', params, options),
  generations: (params, options) => request('/generations', params, options),
  generation: (id, options) => request('/generation', { id }, options),
}
