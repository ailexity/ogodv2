import { useCallback, useEffect, useState } from 'react'
import Login from './components/Login.jsx'
import Register from './components/Register.jsx'
import ForgotPassword from './components/ForgotPassword.jsx'
import ResetPassword from './components/ResetPassword.jsx'
import CheckEmail from './components/CheckEmail.jsx'
import Home from './components/Home.jsx'
import Welcome from './components/Welcome.jsx'
import AdminApp from './components/admin/AdminApp.jsx'
import WebSite from './components/web/WebSite.jsx'
import { rememberReturnTo, takeReturnTo } from './components/web/route.js'
import { ChevronLeftIcon } from './components/icons.jsx'
import { useMediaQuery } from './hooks/useMediaQuery.js'
import { api, getToken, setSessionExpiredHandler, setToken } from './api/client.js'

/**
 * Emailed links land on `/?verify=<token>` or `/?reset=<token>`. Read the token
 * once and strip it from the address bar so it isn't left in history. Both the
 * read and the verify call are cached at module level: StrictMode runs state
 * initialisers and effects twice, and a token only works once.
 */
let emailLink
let verification

function takeEmailLink() {
  if (emailLink !== undefined) return emailLink
  const params = new URLSearchParams(window.location.search)
  emailLink = params.has('verify')
    ? { kind: 'verify', token: params.get('verify') }
    : params.has('reset')
      ? { kind: 'reset', token: params.get('reset') }
      : null
  if (emailLink) window.history.replaceState(null, '', window.location.pathname)
  return emailLink
}

export default function App() {
  const [link] = useState(takeEmailLink)
  const [user, setUser] = useState(null)
  const [authView, setAuthView] = useState(link?.kind === 'reset' ? 'reset' : 'login')
  const [pendingEmail, setPendingEmail] = useState({ address: '', reason: 'registered' })
  const [notice, setNotice] = useState(null)
  const [booting, setBooting] = useState(true)
  // Only a fresh sign-in shows the welcome board; restoring a stored session
  // on reload drops straight into the app.
  const [showWelcome, setShowWelcome] = useState(false)
  // Desktop visitors get the website; `siteMode` is off while they are on the
  // sign-in screens or using the full app (profile, guide tools).
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const [siteMode, setSiteMode] = useState(!link)

  const handleAuthenticated = useCallback(({ token, user: authed }, { remember = false } = {}) => {
    setToken(token, { remember })
    setUser(authed)
    setShowWelcome(true)
    setNotice(null)
    setSiteMode(true)
    // Send someone who signed in mid-booking back to the trip they were booking.
    const returnTo = takeReturnTo()
    if (returnTo) window.location.hash = returnTo
  }, [])

  useEffect(() => {
    if (link?.kind === 'verify') {
      verification ??= api.verifyEmail(link.token)
      verification
        .then((result) => handleAuthenticated(result))
        .catch((err) => setNotice({ tone: 'error', text: err.message }))
        .finally(() => setBooting(false))
      return
    }

    // A reset link always shows the reset form, even if this browser has a session.
    if (link?.kind === 'reset' || !getToken()) {
      setBooting(false)
      return
    }

    api
      .me()
      .then(({ user: current }) => setUser(current))
      .catch(() => setToken(null))
      .finally(() => setBooting(false))
  }, [])

  // Without this, an expired or revoked token leaves the app on screen with
  // every request failing.
  useEffect(() => {
    setSessionExpiredHandler((message) => {
      setUser(null)
      setShowWelcome(false)
      setAuthView('login')
      setSiteMode(false)
      setNotice({ tone: 'error', text: message ?? 'Your session has ended, please sign in again' })
    })
  }, [])

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key !== 'Backspace') return
      const el = e.target
      const isEditable =
        el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable
      if (!isEditable) {
        // Without this, pressing Backspace while focus sits on a button (not
        // a text field) triggers the browser's default "navigate back"
        // behavior, which can knock the user out of the app entirely.
        e.preventDefault()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleLogout = useCallback(() => {
    setToken(null)
    setUser(null)
    setShowWelcome(false)
    setAuthView('login')
    setSiteMode(true)
  }, [])

  /** From the website: remember where the visitor was, then show sign-in or sign-up. */
  const requireAuth = useCallback((view) => {
    rememberReturnTo(window.location.hash)
    setNotice(null)
    setAuthView(view)
    setSiteMode(false)
  }, [])

  const backToSite = useCallback(() => {
    takeReturnTo()
    setNotice(null)
    setAuthView('login')
    setSiteMode(true)
  }, [])

  const showCheckEmail = useCallback((address, reason) => {
    setPendingEmail({ address, reason })
    setAuthView('check-email')
  }, [])

  const backToLogin = useCallback(() => {
    setNotice(null)
    setAuthView('login')
  }, [])

  if (booting) {
    return (
      <div className="page page-centered">
        <div className="brand">
          <span className="brand-mark">O</span>
          <span className="brand-name">OGod</span>
        </div>
      </div>
    )
  }

  // Admins get the moderation console, not the traveler app.
  if (user?.role === 'admin') {
    return <AdminApp user={user} onLogout={handleLogout} />
  }

  if (isDesktop && siteMode && authView !== 'reset') {
    return (
      <WebSite
        user={user}
        onSignIn={requireAuth}
        onOpenApp={() => setSiteMode(false)}
        onLogout={handleLogout}
      />
    )
  }

  if (user && authView !== 'reset') {
    return (
      <>
        <Home
          user={user}
          onUserChange={setUser}
          onLogout={handleLogout}
          onSignIn={requireAuth}
          tourReady={!showWelcome || isDesktop}
        />
        {showWelcome && !isDesktop && <Welcome user={user} onDismiss={() => setShowWelcome(false)} />}
        {isDesktop && (
          <button type="button" className="web-app-back" onClick={() => setSiteMode(true)}>
            <ChevronLeftIcon /> Back to website
          </button>
        )}
      </>
    )
  }

  // Phones: signed-out visitors browse first and sign in when they book, vote,
  // message or post.
  if (!user && siteMode && authView !== 'reset') {
    return <Home user={null} onUserChange={setUser} onLogout={handleLogout} onSignIn={requireAuth} />
  }

  return (
    <>
      {siteMode === false && (
        <button type="button" className="web-auth-back" onClick={backToSite}>
          <ChevronLeftIcon /> Back to trips
        </button>
      )}
      {renderAuthScreen()}
    </>
  )

  function renderAuthScreen() {
    if (authView === 'register') {
      return (
        <Register
          onAuthenticated={(result, options) => handleAuthenticated(result, options)}
          onRegistered={(address, sent) => showCheckEmail(address, sent ? 'registered' : 'send_failed')}
          onSwitchToLogin={backToLogin}
        />
      )
    }

    if (authView === 'check-email') {
      return (
        <CheckEmail
          key={pendingEmail.address}
          email={pendingEmail.address}
          reason={pendingEmail.reason}
          onBackToLogin={backToLogin}
        />
      )
    }

    if (authView === 'forgot') {
      return <ForgotPassword onBackToLogin={backToLogin} />
    }

    if (authView === 'reset') {
      return (
        <ResetPassword
          token={link?.token}
          onDone={() => {
            setToken(null)
            setUser(null)
            setNotice({ tone: 'success', text: 'Password updated. Sign in with your new password.' })
            setAuthView('login')
          }}
          onRequestNewLink={() => setAuthView('forgot')}
        />
      )
    }

    return (
      <Login
        notice={notice}
        onAuthenticated={handleAuthenticated}
        onUnverified={(address) => showCheckEmail(address, 'unverified')}
        onSwitchToRegister={() => setAuthView('register')}
        onForgotPassword={() => setAuthView('forgot')}
      />
    )
  }
}
