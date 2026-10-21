/**
 * One failure vocabulary for the Polza host half. Every route answers a JSON
 * error body with a stable `code`, so the browser can branch without parsing
 * provider prose.
 */
export class PolzaError extends Error {
  constructor(code, message, options = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause })
    this.name = 'PolzaError'
    this.code = code
    this.status = options.status ?? 502
    this.traceId = options.traceId ?? null
  }
}

/** Map an arbitrary thrown value onto the route vocabulary. */
export function asPolzaError(error) {
  if (error instanceof PolzaError) return error
  const message = error instanceof Error ? error.message : String(error)
  return new PolzaError('polza/internal', message, { cause: error })
}

/** Write one JSON response with no-store semantics. */
export function sendJson(res, status, body) {
  const payload = JSON.stringify(body)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.end(payload)
}

/** Write one normalized error response. */
export function sendError(res, error) {
  const failure = asPolzaError(error)
  sendJson(res, failure.status, {
    error: {
      code: failure.code,
      message: failure.message,
      traceId: failure.traceId,
    },
  })
}

/** Read a positive bounded integer from a query string. */
export function readInt(params, name, fallback, min, max) {
  const raw = params.get(name)
  if (raw === null || raw === '') return fallback
  const value = Number(raw)
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.trunc(value)))
}

/** Read one optional query value, trimmed and length-capped. */
export function readString(params, name, maxLength = 200) {
  const raw = params.get(name)
  if (raw === null) return undefined
  const value = raw.trim()
  if (value === '') return undefined
  return value.slice(0, maxLength)
}
