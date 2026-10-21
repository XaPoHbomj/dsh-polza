import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Run one async read whenever `deps` change. The previous value stays visible
 * while the next request is in flight, so a filter change does not blank the
 * panel.
 */
export function useAsync(load, deps) {
  const [state, setState] = useState({ data: null, error: null, loading: true })
  const generation = useRef(0)

  useEffect(() => {
    const current = generation.current + 1
    generation.current = current
    let alive = true
    setState(previous => ({ data: previous.data, error: null, loading: true }))
    load().then(
      data => {
        if (!alive || generation.current !== current) return
        setState({ data, error: null, loading: false })
      },
      error => {
        if (!alive || generation.current !== current) return
        setState({ data: null, error, loading: false })
      },
    )
    return () => { alive = false }
    // The caller owns the dependency list; `load` is recreated with it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return state
}

/** A counter that ticks on an interval and when the page regains focus. */
export function useRefreshTick(seconds) {
  const [tick, setTick] = useState(0)
  const bump = useCallback(() => setTick(value => value + 1), [])

  useEffect(() => {
    const interval = setInterval(bump, Math.max(15, seconds) * 1000)
    const onFocus = () => bump()
    const onVisible = () => { if (document.visibilityState === 'visible') bump() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [bump, seconds])

  return [tick, bump]
}
