import { useEffect, useState } from 'react'

/**
 * The website uses hash routes (`#/trips/12`) so pages are linkable and the
 * back button works, without needing server rewrite rules.
 */
export function parseRoute(hash) {
  const [path, query = ''] = hash.replace(/^#/, '').split('?')
  const params = new URLSearchParams(query)
  let match

  if ((match = path.match(/^\/trips\/(\d+)\/book$/))) {
    return { name: 'checkout', tripId: Number(match[1]), travelers: Number(params.get('n')) || 1 }
  }
  if ((match = path.match(/^\/trips\/(\d+)$/))) return { name: 'trip', tripId: Number(match[1]) }
  if (path === '/my-trips') return { name: 'my-trips' }
  return { name: 'browse' }
}

export function formatDays(days) {
  return `${days} ${days === 1 ? 'day' : 'days'}`
}

export function navigate(path) {
  window.location.hash = path
}

export function useHashRoute() {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash))

  useEffect(() => {
    function handleChange() {
      setRoute(parseRoute(window.location.hash))
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', handleChange)
    return () => window.removeEventListener('hashchange', handleChange)
  }, [])

  return route
}

/**
 * Where to send someone after they sign in. Kept in localStorage because the
 * email-confirmation link opens in a new tab.
 */
const RETURN_KEY = 'ogod_return_to'

export function rememberReturnTo(hash) {
  try {
    localStorage.setItem(RETURN_KEY, hash)
  } catch {
    // Storage can be blocked; the visitor just lands on the home page instead.
  }
}

export function takeReturnTo() {
  try {
    const hash = localStorage.getItem(RETURN_KEY)
    localStorage.removeItem(RETURN_KEY)
    return hash
  } catch {
    return null
  }
}
