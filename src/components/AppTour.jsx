import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

/** Room (px) left around a highlighted element. */
const PAD = 6
/** Gap between the highlight and the card. */
const GAP = 14
/** The card never comes closer than this to the edge of the screen. */
const GUTTER = 16

/**
 * Each step points at the element carrying `data-tour="<target>"`. A step with
 * no target, or whose target is not on screen, shows its card in the middle.
 * `scroll: false` is for the header and bottom nav, which never scroll away.
 */
export const TOUR_STEPS = [
  {
    title: 'Welcome to OGod',
    body: 'Trips run by verified local guides, and stories from the travellers who went. Here’s a quick look around — it takes under a minute.',
  },
  {
    target: 'search',
    title: 'Search anywhere',
    body: 'Look up a destination or a trip by name. Results update as you type.',
  },
  {
    target: 'filters',
    title: 'Filter to fit your plans',
    body: 'Narrow trips by dates, budget, group size, guide rating, difficulty and language.',
  },
  {
    target: 'stories',
    title: 'Travel stories',
    body: 'Photos and videos from people who’ve been there. Open one to vote on it or message the author.',
  },
  {
    target: 'categories',
    title: 'Browse by category',
    body: 'Pick a category to see only those trips. Tap it again to go back to everything.',
  },
  {
    target: 'trips',
    title: 'Find your next trip',
    body: 'Tap See more for the day-by-day itinerary, the guide and the full price. Save it with the heart, or book seats for your whole group.',
  },
  {
    target: 'create',
    scroll: false,
    title: 'Create',
    body: (user) =>
      user.canPostTrips
        ? 'Post a new trip, share a travel story, or jump into your messages.'
        : 'Share a travel story from your own trip, or jump into your messages.',
  },
  {
    target: 'nav-trips',
    scroll: false,
    title: 'My Trips',
    body: (user) =>
      user.canPostTrips
        ? 'Your bookings and saved trips — plus your listings, where you review applicants and move trips through their lifecycle.'
        : 'Your upcoming and past bookings, and every trip you’ve saved for later.',
  },
  {
    target: 'messages',
    scroll: false,
    title: 'Messages',
    body: 'Chat with guides before you book. Once you book, your guide’s payment details arrive here.',
  },
  {
    target: 'profile',
    scroll: false,
    title: 'Your profile',
    body: (user) =>
      user.canPostTrips
        ? 'Edit your details, add the payment details travellers pay you with, and change settings. Replay this tour from Settings anytime.'
        : 'Edit your details and settings, or apply to become a verified guide and post trips of your own. Replay this tour from Settings anytime.',
  },
]

function findTarget(step) {
  return step.target ? document.querySelector(`[data-tour="${step.target}"]`) : null
}

/** The highlight's box in viewport pixels, clamped so it never runs off screen. */
function measure(step) {
  const el = findTarget(step)
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (r.width === 0 && r.height === 0) return null

  const top = Math.max(r.top - PAD, 8)
  const bottom = Math.min(r.bottom + PAD, window.innerHeight - 8)
  const left = Math.max(r.left - PAD, 8)
  const right = Math.min(r.right + PAD, window.innerWidth - 8)
  if (bottom <= top || right <= left) return null
  return { top, left, width: right - left, height: bottom - top }
}

/**
 * Puts the card below the highlight if it fits, above if not, and over the
 * bottom of the screen when the highlight leaves no room on either side.
 */
function placeCard(rect, card, viewport) {
  if (!rect) {
    return {
      top: Math.max(GUTTER, (viewport.height - card.height) / 2),
      left: (viewport.width - card.width) / 2,
      arrow: null,
    }
  }

  const centerX = rect.left + rect.width / 2
  const left = Math.min(
    Math.max(centerX - card.width / 2, GUTTER),
    viewport.width - card.width - GUTTER,
  )
  const arrowX = Math.min(Math.max(centerX - left, 22), card.width - 22)
  const below = rect.top + rect.height + GAP
  const above = rect.top - GAP - card.height

  if (below + card.height <= viewport.height - GUTTER) return { top: below, left, arrow: { side: 'top', x: arrowX } }
  if (above >= GUTTER) return { top: above, left, arrow: { side: 'bottom', x: arrowX } }
  return { top: viewport.height - card.height - GUTTER, left, arrow: null }
}

/** Coach marks over the phone app. Closing it any way — Done, Skip or Escape — calls `onClose`. */
export default function AppTour({ user, steps = TOUR_STEPS, onClose }) {
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState(null)
  const [card, setCard] = useState({ width: 320, height: 200 })
  const cardRef = useRef(null)
  const primaryRef = useRef(null)

  const step = steps[index]
  const isFirst = index === 0
  const isLast = index === steps.length - 1
  const body = typeof step.body === 'function' ? step.body(user) : step.body

  const next = useCallback(() => {
    if (isLast) onClose()
    else setIndex((i) => i + 1)
  }, [isLast, onClose])

  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), [])

  // Bring the step's element into view, then keep the highlight on it while the
  // page scrolls, resizes, or shifts as trips and stories finish loading.
  useEffect(() => {
    const el = findTarget(step)
    if (el && step.scroll !== false) {
      const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      el.scrollIntoView({ block: 'center', behavior: smooth ? 'smooth' : 'auto' })
    }

    let frame = 0
    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => setRect(measure(step)))
    }
    update()

    // html and body are pinned to the viewport height, so watch the app itself.
    const observer = new ResizeObserver(update)
    observer.observe(document.querySelector('.app-shell') ?? document.body)
    window.addEventListener('scroll', update, { passive: true, capture: true })
    window.addEventListener('resize', update)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('scroll', update, { capture: true })
      window.removeEventListener('resize', update)
    }
  }, [step])

  // The card's size depends on its text, so read it back after every render.
  useLayoutEffect(() => {
    const el = cardRef.current
    if (!el) return
    const width = el.offsetWidth
    const height = el.offsetHeight
    setCard((prev) => (prev.width === width && prev.height === height ? prev : { width, height }))
  })

  useEffect(() => {
    primaryRef.current?.focus({ preventScroll: true })
  }, [index])

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') next()
      else if (e.key === 'ArrowLeft') back()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [next, back, onClose])

  const viewport = { width: window.innerWidth, height: window.innerHeight }
  const position = placeCard(rect, card, viewport)
  // With nothing to point at, the hole shrinks to a point in the middle, so the
  // whole screen dims and the next step grows out of it.
  const hole = rect ?? { top: viewport.height / 2, left: viewport.width / 2, width: 0, height: 0 }

  return (
    <div className="tour">
      <div className="tour-spotlight" style={hole} aria-hidden="true" />

      <div
        ref={cardRef}
        className="tour-card"
        style={{ top: position.top, left: position.left }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
      >
        {position.arrow && (
          <span
            className={`tour-arrow tour-arrow-${position.arrow.side}`}
            style={{ left: position.arrow.x }}
            aria-hidden="true"
          />
        )}

        <div className="tour-progress">
          <span className="tour-count">
            {index + 1} of {steps.length}
          </span>
          <span className="tour-dots" aria-hidden="true">
            {steps.map((s, i) => (
              <span key={s.title} className={`tour-dot${i === index ? ' tour-dot-active' : ''}`} />
            ))}
          </span>
        </div>

        <h2 id="tour-title" className="tour-title">
          {step.title}
        </h2>
        <p id="tour-body" className="tour-body">
          {body}
        </p>

        <div className="tour-actions">
          {!isLast && (
            <button type="button" className="tour-skip" onClick={onClose}>
              Skip tour
            </button>
          )}
          <span className="tour-actions-spacer" />
          {!isFirst && (
            <button type="button" className="ghost-btn" onClick={back}>
              Back
            </button>
          )}
          <button ref={primaryRef} type="button" className="tour-next" onClick={next}>
            {isFirst ? 'Show me around' : isLast ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}
