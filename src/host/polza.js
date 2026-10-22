/**
 * Minimal Polza.ai API client. The API key only ever reaches this module's
 * Authorization header; it is never logged, returned, or echoed in failures.
 */
import { createRequire } from 'node:module'
import { keyFingerprint } from './cache.js'
import { PolzaError } from './http.js'

const { version: packageVersion } = createRequire(import.meta.url)('../../package.json')

const RETRYABLE = new Set([429, 500, 502, 503, 504])

/** Convert one monetary string/number to a finite number. */
export function toNumber(value) {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : 0
}

/** Convert an optional monetary value, preserving absence as null. */
export function toOptionalNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

/** Sleep for one retry backoff. */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/** Honor one Retry-After header, capped so a single route call cannot hang. */
function retryAfterMs(response) {
  const raw = response.headers?.get?.('retry-after')
  if (raw === null || raw === undefined || raw === '') return null
  const seconds = Number(raw)
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 10_000)
  const at = Date.parse(raw)
  return Number.isFinite(at) ? Math.min(Math.max(0, at - Date.now()), 10_000) : null
}

/** Map an HTTP status onto the public failure vocabulary. */
function failureFor(status, message, traceId) {
  if (status === 401) return new PolzaError('polza/unauthorized', 'Polza отклонила API-ключ (401)', { status, traceId })
  if (status === 402) return new PolzaError('polza/insufficient-funds', 'Недостаточно средств или исчерпан лимит ключа (402)', { status, traceId })
  if (status === 403) return new PolzaError('polza/forbidden', 'Ключу запрещён доступ к этому ресурсу (403)', { status, traceId })
  if (status === 404) return new PolzaError('polza/not-found', 'Ресурс Polza не найден (404)', { status, traceId })
  if (status === 429) return new PolzaError('polza/rate-limited', 'Polza просит снизить частоту запросов (429)', { status, traceId })
  if (status === 502 || status === 503 || status === 504) {
    return new PolzaError('polza/unavailable', message || `Polza временно недоступна (${status})`, { status: 502, traceId })
  }
  return new PolzaError('polza/upstream', message || `Polza ответила ошибкой ${status}`, { status: 502, traceId })
}

/**
 * Create the request face used by the host routes.
 * @param options - base URL, key resolver, and timeout.
 */
export function createPolzaClient({ baseUrl, resolveKey, timeoutMs }) {
  async function request(path, params) {
    const resolved = await resolveKey()
    const url = new URL(baseUrl.replace(/\/+$/, '') + path)
    if (params !== undefined) {
      for (const [name, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && value !== '') url.searchParams.set(name, String(value))
      }
    }

    let lastFailure
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${resolved.value}`,
            Accept: 'application/json',
            'User-Agent': `dsh-polza/${packageVersion}`,
          },
          signal: AbortSignal.timeout(timeoutMs),
        })
        const text = await response.text()
        let body
        try {
          body = text === '' ? undefined : JSON.parse(text)
        } catch {
          body = undefined
        }
        if (!response.ok) {
          const failure = failureFor(
            response.status,
            body?.error?.message,
            body?.error?.trace_id ?? body?.trace_id,
          )
          if (RETRYABLE.has(response.status) && attempt < 2) {
            lastFailure = failure
            await sleep(retryAfterMs(response) ?? 300 * (attempt + 1) + Math.floor(Math.random() * 120))
            continue
          }
          throw failure
        }
        return body ?? {}
      } catch (error) {
        if (error instanceof PolzaError) {
          if (RETRYABLE.has(error.status ?? 0) && attempt < 2) {
            lastFailure = error
            await sleep(300 * (attempt + 1))
            continue
          }
          throw error
        }
        if (attempt < 2) {
          lastFailure = new PolzaError('polza/network', 'Не удалось связаться с Polza', { cause: error, status: 502 })
          await sleep(300 * (attempt + 1))
          continue
        }
        throw new PolzaError('polza/network', 'Не удалось связаться с Polza', { cause: error, status: 502 })
      }
    }
    throw lastFailure ?? new PolzaError('polza/network', 'Не удалось связаться с Polza', { status: 502 })
  }

  return {
    /** Organization balance and spendable amount. */
    async balance() {
      return await request('/v2/balance')
    },
    /** Per-key limits and usage rollups. */
    async key() {
      return await request('/v1/key')
    },
    /** One page of generation history. */
    async generations(params) {
      return await request('/v1/history/generations', params)
    },
    /** One generation's full detail, including cost lines when Polza returns them. */
    async generation(id) {
      return await request(`/v1/history/generations/${encodeURIComponent(id)}`)
    },
    /** Non-reversible identity of the current key, for per-key local caches. */
    async fingerprint() {
      const resolved = await resolveKey()
      return keyFingerprint(resolved.value)
    },
  }
}
