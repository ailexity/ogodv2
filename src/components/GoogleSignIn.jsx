import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client.js'

const GIS_SRC = 'https://accounts.google.com/gsi/client'

let configPromise
let scriptPromise

function loadConfig() {
  configPromise ??= api.authConfig().catch((error) => {
    configPromise = undefined
    throw error
  })
  return configPromise
}

function loadGoogleScript() {
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = GIS_SRC
    script.async = true
    script.onload = () => resolve(window.google)
    script.onerror = () => {
      scriptPromise = undefined
      reject(new Error('Could not load Google sign-in. Check your connection.'))
    }
    document.head.appendChild(script)
  })
  return scriptPromise
}

function GoogleMark() {
  return (
    <svg className="google-icon" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.9-2.26 5.36-4.78 7.02l7.73 6c4.51-4.18 7.09-10.36 7.09-17.49z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59A14.5 14.5 0 0 1 9.5 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.94 23.94 0 0 0 0 24c0 3.86.92 7.51 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.92-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.97 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  )
}

/**
 * Google's own "Continue with Google" button (Google Identity Services). Google
 * hands back a signed ID token, which the API verifies before signing anyone in.
 * The client ID comes from the server (GOOGLE_CLIENT_ID), so the frontend needs
 * no build-time configuration.
 */
export default function GoogleSignIn({ remember = false, onAuthenticated, onError }) {
  const containerRef = useRef(null)
  const latest = useRef({ remember, onAuthenticated, onError })
  latest.current = { remember, onAuthenticated, onError }

  const [state, setState] = useState('loading') // 'loading' | 'ready' | 'unavailable' | 'failed'
  const [signingIn, setSigningIn] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function handleCredential({ credential }) {
      setSigningIn(true)
      try {
        const result = await api.googleSignIn(credential, latest.current.remember)
        latest.current.onAuthenticated(result, { remember: latest.current.remember })
      } catch (err) {
        latest.current.onError?.(err.message)
        setSigningIn(false)
      }
    }

    async function setUp() {
      try {
        const { googleClientId } = await loadConfig()
        if (!googleClientId) {
          if (!cancelled) setState('unavailable')
          return
        }
        const google = await loadGoogleScript()
        if (cancelled || !containerRef.current) return

        google.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleCredential,
          ux_mode: 'popup',
          auto_select: false,
          cancel_on_tap_outside: true,
        })
        google.accounts.id.renderButton(containerRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          logo_alignment: 'center',
          width: Math.min(400, Math.max(200, containerRef.current.offsetWidth)),
        })
        setState('ready')
      } catch (err) {
        if (!cancelled) setState('failed')
      }
    }

    setUp()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="google-signin">
      <div
        ref={containerRef}
        className="google-signin-slot"
        hidden={state === 'unavailable' || state === 'failed'}
        aria-busy={signingIn}
      />
      {state === 'loading' && (
        <button type="button" className="google-btn" disabled>
          <GoogleMark />
          Continue with Google
        </button>
      )}
      {(state === 'unavailable' || state === 'failed') && (
        <>
          <button type="button" className="google-btn" disabled>
            <GoogleMark />
            Continue with Google
          </button>
          <p className="form-hint">
            {state === 'failed'
              ? 'Google sign-in couldn’t load. Check your connection and reload the page.'
              : 'Google sign-in isn’t set up on this server yet.'}
          </p>
        </>
      )}
      {signingIn && <p className="form-hint">Signing you in with Google…</p>}
    </div>
  )
}
