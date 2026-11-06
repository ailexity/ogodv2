import { useEffect, useRef } from 'react'

/**
 * The app has no router — its screens are React state — so on their own the
 * phone's back button, the browser's back button and the Backspace key all leave
 * the site instead of closing what's on top.
 *
 * Anything that can be backed out of registers a layer while it's open, and
 * history keeps one entry per layer above the page. Going back lands on a lower
 * entry, and every layer above that entry gets closed.
 */
const layers = []
// Our own history.go() is in flight, so the popstate it fires isn't the user going back.
let traversing = false
let syncQueued = false

/** Back unwinds the highest level first, whichever order things were opened in. */
export const BACK_LEVEL = { screen: 0, tab: 1, overlay: 2 }

function entryDepth() {
  return window.history.state?.backDepth ?? 0
}

function sync() {
  syncQueued = false
  if (traversing) return

  const depth = entryDepth()
  if (layers.length < depth) {
    // Closed with its own button: step back over the entries it no longer needs.
    traversing = true
    window.history.go(layers.length - depth)
    return
  }
  for (let next = depth + 1; next <= layers.length; next += 1) {
    window.history.pushState({ backDepth: next }, '')
  }
}

/** Waits a microtask, so a layer that closes as another opens reuses its entry. */
function queueSync() {
  if (syncQueued) return
  syncQueued = true
  queueMicrotask(sync)
}

function handlePopState() {
  if (traversing) {
    traversing = false
    queueSync()
    return
  }
  layers
    .slice(entryDepth())
    .reverse()
    .forEach((layer) => layer.close())
  // Closed layers remove themselves once React commits. This tidies up after any
  // that stayed open, and after Forward landing on an entry nothing uses any more.
  setTimeout(queueSync)
}

/** Text typed into a form shouldn't vanish because focus happened to be outside a field. */
function hasTypedInput() {
  return [...document.querySelectorAll('form input, form textarea, .sheet textarea')].some(
    (el) => el.value && !['checkbox', 'radio', 'hidden', 'search', 'submit', 'button'].includes(el.type),
  )
}

/** One step back, without ever leaving the app. */
function goBack() {
  if (layers.length > 0 || !window.history.state?.backRoot) {
    window.history.back()
  } else if (window.location.hash.replace(/^#\/?/, '')) {
    // Opened straight on a deep link, so there's no page behind this one in the app.
    window.location.hash = '/'
  }
}

function handleKeyDown(e) {
  if (e.key !== 'Backspace' || e.altKey || e.ctrlKey || e.metaKey) return
  const el = e.target
  // In a field it edits the text, and the browser handles that.
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable) return

  // Some browsers still treat Backspace on the page as "leave the site".
  e.preventDefault()
  if (!e.repeat && !hasTypedInput()) goBack()
}

/** Mounted once at the root: wires back navigation and the Backspace key to the layers. */
export function useBackNavigation() {
  useEffect(() => {
    // Marks where the app was entered, so Backspace knows not to go back past it.
    if (window.history.state === null) window.history.replaceState({ backRoot: true }, '')

    window.addEventListener('popstate', handlePopState)
    window.addEventListener('keydown', handleKeyDown)
    // A reload can start on an entry whose layer is gone.
    queueSync()
    return () => {
      window.removeEventListener('popstate', handlePopState)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])
}

/** While `open`, going back calls `onClose` instead of leaving the screen underneath. */
export function useBackLayer(open, onClose, level = BACK_LEVEL.overlay) {
  const latestClose = useRef(onClose)
  latestClose.current = onClose

  useEffect(() => {
    if (!open) return undefined
    const layer = { level, close: () => latestClose.current() }
    const above = layers.findIndex((other) => other.level > level)
    layers.splice(above === -1 ? layers.length : above, 0, layer)
    queueSync()
    return () => {
      layers.splice(layers.indexOf(layer), 1)
      queueSync()
    }
  }, [open, level])
}
