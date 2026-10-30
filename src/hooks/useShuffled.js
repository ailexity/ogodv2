import { useEffect, useMemo, useState } from 'react'

function shuffle(items) {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/**
 * `items` in a random order that reshuffles every `intervalMs` (and whenever
 * the list itself changes). Skips the reshuffle while the tab is in the
 * background, so nothing moves while nobody is looking.
 */
export function useShuffled(items, intervalMs = 30_000) {
  const [round, setRound] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      if (!document.hidden) setRound((n) => n + 1)
    }, intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])

  // `round` is listed only so each tick produces a new order.
  return useMemo(() => shuffle(items), [items, round])
}
