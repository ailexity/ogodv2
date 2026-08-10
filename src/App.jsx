import { useCallback, useEffect, useState } from 'react'
import Login from './components/Login.jsx'
import Register from './components/Register.jsx'
import ForgotPassword from './components/ForgotPassword.jsx'
import Home from './components/Home.jsx'
import Welcome from './components/Welcome.jsx'
import AdminApp from './components/admin/AdminApp.jsx'
import { api, getToken, setToken } from './api/client.js'

export default function App() {
  const [user, setUser] = useState(null)
  const [authView, setAuthView] = useState('login')
  const [booting, setBooting] = useState(true)
  // Only a fresh sign-in shows the welcome board; restoring a stored session
  // on reload drops straight into the app.
  const [showWelcome, setShowWelcome] = useState(false)

  useEffect(() => {
    if (!getToken()) {
      setBooting(false)
      return
    }

    api
      .me()
      .then(({ user: current }) => setUser(current))
      .catch(() => setToken(null))
      .finally(() => setBooting(false))
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

  const handleAuthenticated = useCallback(({ token, user: authed }) => {
    setToken(token)
    setUser(authed)
    setShowWelcome(true)
  }, [])

  const handleLogout = useCallback(() => {
    setToken(null)
    setUser(null)
    setShowWelcome(false)
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

  if (user) {
    return (
      <>
        <Home user={user} onUserChange={setUser} onLogout={handleLogout} />
        {showWelcome && <Welcome user={user} onDismiss={() => setShowWelcome(false)} />}
      </>
    )
  }

  if (authView === 'register') {
    return (
      <Register
        onAuthenticated={handleAuthenticated}
        onSwitchToLogin={() => setAuthView('login')}
      />
    )
  }

  if (authView === 'forgot') {
    return <ForgotPassword onBackToLogin={() => setAuthView('login')} />
  }

  return (
    <Login
      onAuthenticated={handleAuthenticated}
      onSwitchToRegister={() => setAuthView('register')}
      onForgotPassword={() => setAuthView('forgot')}
    />
  )
}
