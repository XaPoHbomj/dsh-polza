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
async function request(path, params) {
  const response = await fetch(`${BASE}${path}${query(params)}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    credentials: 'same-origin',
    cache: 'no-store',
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
  health: () => request('/health'),
  refresh: () => request('/refresh'),
  summary: () => request('/summary'),
  models: () => request('/models'),
  overview: params => request('/overview', params),
  generations: params => request('/generations', params),
  generation: id => request('/generation', { id }),
}
