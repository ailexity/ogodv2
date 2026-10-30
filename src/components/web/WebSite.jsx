import { useEffect, useRef, useState } from 'react'
import { getInitials } from '../TripDetail.jsx'
import { navigate, useHashRoute } from './route.js'
import WebBrowse from './WebBrowse.jsx'
import WebTripPage from './WebTripPage.jsx'
import WebCheckout from './WebCheckout.jsx'
import WebMyTrips from './WebMyTrips.jsx'
import { ChatThread, MessagesInbox, useChatLauncher, useUnreadMessages } from '../Messages.jsx'
import { MessageIcon } from '../icons.jsx'
import './web.css'

/**
 * The desktop website: anyone can browse and price trips, and an account is
 * only needed at checkout. Phones keep using the app shell in Home.jsx.
 */
export default function WebSite({ user, onSignIn, onOpenApp, onLogout }) {
  const route = useHashRoute()
  const chat = useChatLauncher()
  const [unread, refreshUnread] = useUnreadMessages(Boolean(user))

  /** Signed-out visitors are asked to sign in first, then come back to this trip. */
  function messageGuide(trip) {
    if (!user) onSignIn('login')
    else chat.openChatWith(trip.guide.id, trip.id)
  }

  function messageAuthor(blog) {
    if (!user) onSignIn('login')
    else chat.openChatWith(blog.author.id, null, blog.id)
  }

  // Pages that need an account fall back to the home page when signed out.
  useEffect(() => {
    if (route.name === 'my-trips' && !user) navigate('/')
  }, [route.name, user])

  return (
    <div className="web">
      <WebNav
        user={user}
        route={route}
        unread={unread}
        onOpenMessages={() => chat.setInboxOpen(true)}
        onSignIn={onSignIn}
        onOpenApp={onOpenApp}
        onLogout={onLogout}
      />

      <main className="web-main">
        {route.name === 'browse' && (
          <WebBrowse user={user} onSignIn={onSignIn} onMessageAuthor={messageAuthor} />
        )}
        {route.name === 'trip' && (
          <WebTripPage
            key={route.tripId}
            tripId={route.tripId}
            user={user}
            onMessageGuide={messageGuide}
            onSignIn={onSignIn}
          />
        )}
        {route.name === 'checkout' && (
          <WebCheckout
            key={route.tripId}
            tripId={route.tripId}
            initialTravelers={route.travelers}
            user={user}
            onSignIn={onSignIn}
            onOpenChat={chat.setChatId}
          />
        )}
        {route.name === 'my-trips' && user && <WebMyTrips />}
      </main>

      {(chat.inboxOpen || chat.chatId) && (
        <div
          className="web-drawer-backdrop"
          onClick={() => {
            chat.setInboxOpen(false)
            chat.setChatId(null)
            refreshUnread()
          }}
        />
      )}
      {chat.inboxOpen && (
        <MessagesInbox
          onOpen={chat.setChatId}
          onClose={() => {
            chat.setInboxOpen(false)
            refreshUnread()
          }}
        />
      )}
      {chat.chatId && (
        <ChatThread
          conversationId={chat.chatId}
          onClose={() => {
            chat.setChatId(null)
            refreshUnread()
          }}
        />
      )}
      {chat.error && (
        <button type="button" className="chat-toast" onClick={() => chat.setError('')}>
          {chat.error}
        </button>
      )}

      <footer className="web-footer">
        <div className="web-container web-footer-inner">
          <div className="brand">
            <span className="brand-mark brand-mark-sm">O</span>
            <span className="brand-name">OGod</span>
          </div>
          <p>Small-group trips with verified local guides.</p>
          <p className="web-footer-faint">© {new Date().getFullYear()} OGod</p>
        </div>
      </footer>
    </div>
  )
}

function WebNav({ user, route, unread, onOpenMessages, onSignIn, onOpenApp, onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!menuOpen) return undefined
    function handleClick(e) {
      if (!menuRef.current?.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  return (
    <header className="web-nav">
      <div className="web-container web-nav-inner">
        <a href="#/" className="brand web-brand">
          <span className="brand-mark brand-mark-sm">O</span>
          <span className="brand-name">OGod</span>
        </a>

        <nav className="web-nav-links">
          <a href="#/" className={route.name === 'browse' ? 'active' : ''}>
            Explore trips
          </a>
          {user && (
            <a href="#/my-trips" className={route.name === 'my-trips' ? 'active' : ''}>
              My trips
            </a>
          )}
        </nav>

        <div className="web-nav-actions">
          {user && (
            <button
              type="button"
              className="web-icon-btn"
              onClick={onOpenMessages}
              aria-label={unread ? `Messages, ${unread} unread` : 'Messages'}
            >
              <MessageIcon />
              {unread > 0 && <span className="header-badge">{unread}</span>}
            </button>
          )}
          {user ? (
            <div className="web-account" ref={menuRef}>
              <button
                type="button"
                className="web-account-btn"
                onClick={() => setMenuOpen((open) => !open)}
                aria-expanded={menuOpen}
              >
                <span className="web-avatar">{getInitials(user.name)}</span>
                <span>{user.name.split(' ')[0]}</span>
              </button>
              {menuOpen && (
                <div className="web-menu" role="menu">
                  <p className="web-menu-email">{user.email}</p>
                  <button type="button" role="menuitem" onClick={() => navigate('/my-trips')}>
                    My trips
                  </button>
                  <button type="button" role="menuitem" onClick={onOpenApp}>
                    {user.canPostTrips ? 'Guide dashboard' : 'Profile & guide tools'}
                  </button>
                  <button type="button" role="menuitem" onClick={onLogout}>
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <button type="button" className="web-btn-ghost" onClick={() => onSignIn('login')}>
                Sign in
              </button>
              <button type="button" className="web-btn" onClick={() => onSignIn('register')}>
                Create account
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
