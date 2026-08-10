import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api/client.js'
import { randomFact } from '../data/facts.js'
import { ArrowUpIcon, ChevronUpIcon, CompassIcon, StarIcon, VerifiedIcon } from './icons.jsx'

/** Drag distance (px) past which releasing dismisses instead of springing back. */
const DISMISS_AFTER = 90
/** How long the exit transition runs — keep in sync with .welcome-leaving. */
const EXIT_MS = 320
/** Wheel deltas stop accumulating this long after the last event. */
const WHEEL_IDLE_MS = 400

export function ordinalSuffix(day) {
  if (day > 3 && day < 21) return 'th'
  return { 1: 'st', 2: 'nd', 3: 'rd' }[day % 10] ?? 'th'
}

function guideNote(user) {
  if (user.guideStatus === 'verified') {
    return user.certified ? 'You are a certified guide' : 'You can post trips'
  }
  if (user.guideStatus === 'pending') return 'Your verification is under review'
  if (user.guideStatus === 'rejected') return 'Fix your application and reapply'
  if (user.guideStatus === 'suspended') return 'Your guide account is suspended'
  return 'Become a verified guide'
}

export default function Welcome({ user, onDismiss }) {
  const [drag, setDrag] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [trips, setTrips] = useState([])
  // Picked once per mount so the fact does not shuffle on every re-render.
  const [fact] = useState(randomFact)

  const startY = useRef(0)
  const wheelTotal = useRef(0)
  const wheelTimer = useRef(null)
  const exitTimer = useRef(null)

  useEffect(() => {
    let cancelled = false
    api
      .listTrips()
      .then(({ trips: rows }) => !cancelled && setTrips(rows))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const dismiss = useCallback(() => {
    setLeaving((already) => {
      if (already) return already
      exitTimer.current = setTimeout(onDismiss, EXIT_MS)
      return true
    })
  }, [onDismiss])

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape' || e.key === 'ArrowUp' || e.key === 'PageUp') dismiss()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [dismiss])

  useEffect(
    () => () => {
      clearTimeout(wheelTimer.current)
      clearTimeout(exitTimer.current)
    },
    [],
  )

  function handleTouchStart(e) {
    startY.current = e.touches[0].clientY
    setDragging(true)
  }

  function handleTouchMove(e) {
    if (!dragging) return
    setDrag(Math.max(0, startY.current - e.touches[0].clientY))
  }

  function handleTouchEnd() {
    setDragging(false)
    if (drag >= DISMISS_AFTER) dismiss()
    else setDrag(0)
  }

  // Trackpads and mice scroll the board up the same way a swipe drags it.
  function handleWheel(e) {
    if (e.deltaY <= 0) return
    wheelTotal.current += e.deltaY

    if (wheelTotal.current >= DISMISS_AFTER * 1.6) {
      dismiss()
      return
    }

    setDrag(wheelTotal.current)
    clearTimeout(wheelTimer.current)
    wheelTimer.current = setTimeout(() => {
      wheelTotal.current = 0
      setDrag(0)
    }, WHEEL_IDLE_MS)
  }

  const now = new Date()
  const day = now.getDate()
  const featured = trips[0]
  const second = trips[1]

  return (
    <div
      className={`welcome${leaving ? ' welcome-leaving' : ''}${dragging ? ' welcome-dragging' : ''}`}
      style={leaving ? undefined : { transform: `translateY(${-drag}px)` }}
      role="dialog"
      aria-label={`Welcome back, ${user.name}`}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <div className="welcome-inner">
        <header className="welcome-head">
          <div>
            <h1 className="welcome-date">
              <span className="date-strong">Today&apos;s</span>{' '}
              <span className="date-light">
                {day}
                {ordinalSuffix(day)}
              </span>
              <br />
              <span className="date-light">
                {now.toLocaleString('en-US', { month: 'long' })}
              </span>{' '}
              <span className="date-strong">
                {now.toLocaleString('en-US', { weekday: 'long' })}
              </span>
            </h1>
            <p className="welcome-greeting">
              Welcome back, {user.name.split(' ')[0]} <span aria-hidden="true">👋</span>
            </p>
          </div>

          <button type="button" className="welcome-skip" onClick={dismiss}>
            <ArrowUpIcon />
            <span>Skip</span>
          </button>
        </header>

        <div className="welcome-bento" aria-hidden="true">
          <div className="bento-col">
            <div className="bento-card bento-photo bento-tall">
              {featured?.coverImage && <img src={featured.coverImage} alt="" decoding="async" />}
              <span className="bento-pill">
                <StarIcon />
                {featured ? featured.rating.toFixed(1) : 'Top rated'}
              </span>
              {featured && <span className="bento-photo-title">{featured.title}</span>}
            </div>

            <div className="bento-card bento-stat bento-short">
              <span className="bento-stat-value">{trips.length || '—'}</span>
              <span className="bento-stat-label">Trips live now</span>
            </div>
          </div>

          <div className="bento-col">
            <div className="bento-card bento-note bento-short">
              <span className="bento-note-label">
                {user.guideStatus === 'verified' && <VerifiedIcon />}
                Your status
              </span>
              <p className="bento-note-text">{guideNote(user)}</p>
            </div>

            <div className="bento-card bento-photo bento-accent bento-tall">
              {second?.coverImage && <img src={second.coverImage} alt="" decoding="async" />}
              <span className="bento-pill">Explore</span>
              {second && <span className="bento-photo-title">{second.destination}</span>}
            </div>
          </div>
        </div>

        <div className="bento-card bento-wide">
          <span className="bento-avatar" aria-hidden="true">
            <CompassIcon />
          </span>
          <div className="bento-fact">
            <span className="bento-fact-label">Did you know</span>
            <p className="bento-fact-text">{fact}</p>
          </div>
        </div>

        <button type="button" className="welcome-hint" onClick={dismiss}>
          <ChevronUpIcon />
          <span>Swipe up to continue</span>
        </button>
      </div>
    </div>
  )
}
