import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Run one async read whenever `deps` change. The previous value stays visible
 * while the next request is in flight, and the previous request is aborted.
 */
export function useAsync(load, deps) {
  const [state, setState] = useState({ data: null, error: null, loading: true })
  const generation = useRef(0)

  useEffect(() => {
    const current = generation.current + 1
    generation.current = current
    let alive = true
    const controller = new AbortController()
    setState(previous => ({ data: previous.data, error: null, loading: true }))
    load(controller.signal).then(
      data => {
        if (!alive || generation.current !== current) return
        setState({ data, error: null, loading: false })
      },
      error => {
        if (!alive || generation.current !== current || error?.name === 'AbortError') return
        setState({ data: null, error, loading: false })
      },
    )
    return () => {
      alive = false
      controller.abort()
    }
    // The caller owns the dependency list; `load` is recreated with it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return state
}

/**
 * Two-phase read: paint the cached answer immediately, then replace it with
 * the live one unless the cache is still fresh. The cache request never blocks
 * the fresh request for long, and both are aborted when the caller moves on.
 */
export function useCachedAsync(loadCache, loadFresh, deps, resetKey = null) {
  const [state, setState] = useState({ data: null, error: null, loading: true, stale: false })
  const generation = useRef(0)
  const resetRef = useRef(resetKey)

  useEffect(() => {
    const current = generation.current + 1
    generation.current = current
    const shouldReset = resetRef.current !== resetKey
    resetRef.current = resetKey
    if (shouldReset) {
      setState({ data: null, error: null, loading: true, stale: false })
    } else {
      // A refresh tick should keep the table visible while it revalidates.
      setState(previous => ({ ...previous, error: null, loading: true }))
    }
    let alive = true
    let freshStarted = false
    const cacheController = new AbortController()
    const freshController = new AbortController()

    const startFresh = () => {
      if (freshStarted || !alive) return
      freshStarted = true
      loadFresh(freshController.signal).then(
        data => {
          if (!alive || generation.current !== current) return
          setState({ data, error: null, loading: false, stale: false })
        },
        error => {
          if (!alive || generation.current !== current || error?.name === 'AbortError') return
          setState(previous => previous.data !== null
            ? { ...previous, loading: false, stale: true }
            : { data: null, error, loading: false, stale: false })
        },
      )
    }

    loadCache(cacheController.signal).then(
      data => {
        if (!alive || generation.current !== current) return
        const source = data?.cache?.source
        if (source !== undefined && source !== 'none') {
          const stale = data.cache.stale !== false
          setState({ data, error: null, loading: stale, stale })
          if (!stale) {
            freshStarted = true
            return
          }
        }
        startFresh()
      },
      () => startFresh(),
    )

    return () => {
      alive = false
      cacheController.abort()
      freshController.abort()
    }
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
