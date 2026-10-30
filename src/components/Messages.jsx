import { useCallback, useEffect, useRef, useState } from 'react'
import { api, downloadTicket, fetchPrivateImage } from '../api/client.js'
import { formatMoney, getInitials } from './TripDetail.jsx'
import { cancelBookingWithConfirm } from './cancelBooking.js'
import { formatDateRange } from '../data/dates.js'
import {
  ChevronLeftIcon,
  CloseIcon,
  ImageIcon,
  MessageIcon,
  SendIcon,
  TicketIcon,
  VerifiedIcon,
} from './icons.jsx'

const THREAD_POLL_MS = 4000
const INBOX_POLL_MS = 10000
const MAX_IMAGE_BYTES = 8 * 1024 * 1024

/** SQLite stores UTC as "YYYY-MM-DD HH:MM:SS". */
function parseTimestamp(value) {
  return new Date(`${value.replace(' ', 'T')}Z`)
}

function formatTime(value) {
  const date = parseTimestamp(value)
  const today = new Date()
  return date.toDateString() === today.toDateString()
    ? date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/**
 * Freezes the page behind a chat overlay. Without it, scrolling past the end
 * of the message list scrolls the page underneath, which on phones moves the
 * address bar and makes the composer jump. Counted, because the inbox and a
 * thread can be open at once.
 */
let scrollLocks = 0

function useScrollLock() {
  useEffect(() => {
    scrollLocks += 1
    const root = document.documentElement
    root.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    return () => {
      scrollLocks -= 1
      if (scrollLocks === 0) {
        root.style.overflow = ''
        document.body.style.overflow = ''
      }
    }
  }, [])
}

/**
 * Fits the overlay to the part of the screen the on-screen keyboard leaves
 * visible, so the composer sits right above the keyboard instead of the
 * browser panning the page to reveal it.
 */
function useVisualViewportFit(ref) {
  useEffect(() => {
    const viewport = window.visualViewport
    const element = ref.current
    if (!viewport || !element) return undefined

    function fit() {
      const keyboardOpen = viewport.height < window.innerHeight - 1
      element.style.top = keyboardOpen ? `${viewport.offsetTop}px` : ''
      element.style.bottom = keyboardOpen ? 'auto' : ''
      element.style.height = keyboardOpen ? `${viewport.height}px` : ''
    }

    fit()
    viewport.addEventListener('resize', fit)
    viewport.addEventListener('scroll', fit)
    return () => {
      viewport.removeEventListener('resize', fit)
      viewport.removeEventListener('scroll', fit)
    }
  }, [ref])
}

/** Polls the total unread count for a badge. */
export function useUnreadMessages(enabled = true) {
  const [unread, setUnread] = useState(0)

  const refresh = useCallback(() => {
    api
      .unreadMessages()
      .then(({ unread: count }) => setUnread(count))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!enabled) return undefined
    refresh()
    const timer = setInterval(refresh, 20000)
    return () => clearInterval(timer)
  }, [enabled, refresh])

  return [unread, refresh]
}

export function MessagesInbox({ onClose, onOpen }) {
  const [conversations, setConversations] = useState(null)
  const [error, setError] = useState('')
  useScrollLock()

  useEffect(() => {
    let cancelled = false
    function load() {
      api
        .conversations()
        .then(({ conversations: rows }) => !cancelled && setConversations(rows))
        .catch((err) => !cancelled && setError(err.message))
    }
    load()
    const timer = setInterval(load, INBOX_POLL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  return (
    <div className="edit-overlay chat-overlay">
      <header className="edit-header">
        <button type="button" className="edit-icon-btn" onClick={onClose} aria-label="Close">
          <CloseIcon />
        </button>
        <h2 className="edit-header-title">Messages</h2>
        <span className="edit-header-spacer" />
      </header>

      <div className="edit-body chat-inbox">
        {error && <p className="form-error">{error}</p>}
        {!conversations && !error && <p className="trip-list-empty">Loading messages…</p>}

        {conversations?.length === 0 && (
          <div className="empty-state">
            <MessageIcon />
            <p>No messages yet.</p>
            <p className="field-hint">
              Open a trip and tap “Message guide” to ask about dates, gear or anything else.
            </p>
          </div>
        )}

        {conversations?.map((conversation) => (
          <button
            key={conversation.id}
            type="button"
            className="chat-inbox-row"
            onClick={() => onOpen(conversation.id)}
          >
            <span className="profile-avatar chat-avatar">{getInitials(conversation.other.name)}</span>
            <span className="chat-inbox-text">
              <span className="chat-inbox-top">
                <span className="chat-inbox-name">
                  {conversation.other.name}
                  {conversation.other.verified && <VerifiedIcon />}
                </span>
                {conversation.lastMessage && (
                  <span className="chat-inbox-time">{formatTime(conversation.lastMessage.createdAt)}</span>
                )}
              </span>
              {conversation.trip && <span className="chat-inbox-trip">{conversation.trip.title}</span>}
              <span className={`chat-inbox-preview${conversation.unread ? ' unread' : ''}`}>
                {conversation.lastMessage?.fromMe && 'You: '}
                {conversation.lastMessage?.body || (conversation.lastMessage?.hasImage ? 'Photo' : '')}
              </span>
            </span>
            {conversation.unread > 0 && <span className="pending-badge">{conversation.unread}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

export function ChatThread({ conversationId, onClose }) {
  const [conversation, setConversation] = useState(null)
  const [messages, setMessages] = useState([])
  const [error, setError] = useState('')
  const [text, setText] = useState('')
  const [image, setImage] = useState(null)
  const [sending, setSending] = useState(false)
  // Bumped after approving or declining from a booking card, to refetch the
  // thread so every card shows the booking's new state.
  const [reloadKey, setReloadKey] = useState(0)
  const lastIdRef = useRef(0)
  const overlayRef = useRef(null)
  const listRef = useRef(null)
  const fileRef = useRef(null)
  useScrollLock()
  useVisualViewportFit(overlayRef)

  const append = useCallback((incoming) => {
    if (!incoming.length) return
    setMessages((prev) => {
      const known = new Set(prev.map((m) => m.id))
      const fresh = incoming.filter((m) => !known.has(m.id))
      return fresh.length ? [...prev, ...fresh] : prev
    })
    lastIdRef.current = Math.max(lastIdRef.current, ...incoming.map((m) => m.id))
  }, [])

  useEffect(() => {
    let cancelled = false
    lastIdRef.current = 0
    setMessages([])
    function load() {
      api
        .conversation(conversationId, lastIdRef.current)
        .then((result) => {
          if (cancelled) return
          setConversation(result.conversation)
          append(result.messages)
          setError('')
        })
        .catch((err) => !cancelled && setError(err.message))
    }
    load()
    const timer = setInterval(load, THREAD_POLL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [conversationId, append, reloadKey])

  useEffect(() => {
    const list = listRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [messages.length])

  // The preview's object URL must be released when it is replaced or removed.
  useEffect(() => () => image && URL.revokeObjectURL(image.preview), [image])

  function pickImage(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) return setError('Choose a photo to share')
    if (file.size > MAX_IMAGE_BYTES) return setError('Photos must be 8 MB or smaller')
    setError('')
    setImage({ file, preview: URL.createObjectURL(file) })
  }

  async function handleSend(e) {
    e.preventDefault()
    const body = text.trim()
    if ((!body && !image) || sending) return

    const form = new FormData()
    form.append('body', body)
    if (image) form.append('image', image.file)

    setSending(true)
    setError('')
    try {
      const { message } = await api.sendMessage(conversationId, form)
      append([message])
      setText('')
      setImage(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  const other = conversation?.other

  return (
    <div className="edit-overlay chat-overlay" ref={overlayRef}>
      <header className="edit-header chat-header">
        <button type="button" className="edit-icon-btn" onClick={onClose} aria-label="Back">
          <ChevronLeftIcon />
        </button>
        <div className="chat-header-who">
          <span className="profile-avatar chat-avatar chat-avatar-sm">{getInitials(other?.name)}</span>
          <div>
            <p className="chat-header-name">
              {other?.name ?? '…'}
              {other?.verified && <VerifiedIcon />}
            </p>
            <p className="chat-header-sub">
              {conversation?.trip?.title ?? (other?.isGuide ? 'Guide' : 'Traveller')}
            </p>
          </div>
        </div>
      </header>

      <div className="chat-messages" ref={listRef}>
        {conversation && messages.length === 0 && (
          <p className="chat-empty">
            Say hello to {other?.name.split(' ')[0]} — ask about dates, meeting points or what to pack.
          </p>
        )}
        {messages.map((message) => (
          <div key={message.id} className={`chat-bubble-row${message.fromMe ? ' mine' : ''}`}>
            <div className="chat-bubble">
              {message.image && <ChatImage path={message.image} />}
              {message.body && <p>{message.body}</p>}
              {message.booking && (
                <BookingCard
                  message={message}
                  role={conversation?.role}
                  onChanged={() => setReloadKey((key) => key + 1)}
                />
              )}
            </div>
            <span className="chat-time">{formatTime(message.createdAt)}</span>
          </div>
        ))}
      </div>

      <form className="chat-composer" onSubmit={handleSend}>
        {error && <p className="form-error chat-error">{error}</p>}
        {image && (
          <div className="chat-attachment">
            <img src={image.preview} alt="Photo to send" />
            <button type="button" onClick={() => setImage(null)} aria-label="Remove photo">
              <CloseIcon />
            </button>
          </div>
        )}
        <div className="chat-composer-row">
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={pickImage} />
          <button
            type="button"
            className="chat-icon-btn"
            onClick={() => fileRef.current?.click()}
            aria-label="Attach a photo"
          >
            <ImageIcon />
          </button>
          <textarea
            rows={1}
            value={text}
            maxLength={2000}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) handleSend(e)
            }}
            placeholder="Write a message"
            aria-label="Message"
          />
          <button
            type="submit"
            className="chat-send-btn"
            disabled={sending || (!text.trim() && !image)}
            aria-label="Send"
          >
            <SendIcon />
          </button>
        </div>
      </form>
    </div>
  )
}

/** Where a booking stands, worded for whoever is looking at it. */
function bookingStatusText(booking, isGuide) {
  if (booking.status === 'cancelled') {
    if (booking.cancelledBy === 'traveler') return isGuide ? 'Cancelled by the traveller' : 'You cancelled this booking'
    if (booking.cancelledBy === 'trip') return 'The trip was cancelled'
    return 'Declined'
  }
  if (booking.status === 'confirmed' || booking.status === 'completed') return 'Confirmed · payment verified'
  if (booking.paymentStatus === 'proof_sent') {
    return isGuide
      ? 'Payment screenshot received — check your account, then approve.'
      : 'Screenshot sent — waiting for the guide to verify it.'
  }
  return isGuide
    ? 'Waiting for the traveller’s payment.'
    : 'Pay the amount above, then send a screenshot of the payment here.'
}

/**
 * The card under the guide's automatic messages: the booking request (with the
 * guide's approve/decline actions) or the confirmation with the PDF ticket.
 */
function BookingCard({ message, role, onChanged }) {
  const { booking, kind } = message
  const isGuide = role === 'guide'
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const amount = formatMoney(booking.total, booking.currency)
  const summary = `${booking.travelers} ${booking.travelers === 1 ? 'traveller' : 'travellers'} · ${amount}`

  async function run(action) {
    setBusy(true)
    setError('')
    try {
      await action()
      onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  function approve() {
    if (!window.confirm(`Approve this booking? Only do this once ${amount} has reached your account.`)) return
    run(() => api.approveBooking(booking.id, '', true))
  }

  function decline() {
    const note = window.prompt('Why are you declining? This is sent to the traveller.')
    if (note?.trim()) run(() => api.declineBooking(booking.id, note.trim()))
  }

  if (kind === 'ticket') {
    return (
      <div className="chat-card">
        <p className="chat-card-title">
          <TicketIcon /> Booking confirmed
        </p>
        <p className="chat-card-meta">
          {booking.tripTitle}
          {booking.startDate && ` · ${formatDateRange(booking.startDate)}`}
        </p>
        <p className="chat-card-meta">{summary}</p>
        <button
          type="button"
          className="chat-card-btn"
          disabled={busy}
          onClick={() => run(() => downloadTicket(booking.id))}
        >
          Download ticket (PDF)
        </button>
        {error && <p className="form-error">{error}</p>}
      </div>
    )
  }

  if (kind !== 'booking_request') return null

  return (
    <div className="chat-card">
      <p className="chat-card-title">Booking request</p>
      <p className="chat-card-meta">{booking.tripTitle}</p>
      <p className="chat-card-meta">{summary}</p>
      <p className={`chat-card-status chat-card-status-${booking.status}`}>
        {bookingStatusText(booking, isGuide)}
      </p>
      {!isGuide && ['pending', 'confirmed'].includes(booking.status) && (
        <div className="chat-card-actions">
          <button
            type="button"
            className="chat-card-btn chat-card-btn-ghost"
            disabled={busy}
            onClick={() => run(() => cancelBookingWithConfirm(booking, booking.tripTitle))}
          >
            {booking.status === 'pending' ? 'Cancel request' : 'Cancel booking'}
          </button>
        </div>
      )}
      {isGuide && booking.status === 'pending' && (
        <div className="chat-card-actions">
          <button type="button" className="chat-card-btn" disabled={busy} onClick={approve}>
            Payment verified · Approve
          </button>
          <button type="button" className="chat-card-btn chat-card-btn-ghost" disabled={busy} onClick={decline}>
            Decline
          </button>
        </div>
      )}
      {error && <p className="form-error">{error}</p>}
    </div>
  )
}

function ChatImage({ path }) {
  const [src, setSrc] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let url
    let cancelled = false
    fetchPrivateImage(path)
      .then((objectUrl) => {
        url = objectUrl
        if (!cancelled) setSrc(objectUrl)
      })
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [path])

  if (failed) return <span className="chat-image-missing">Photo unavailable</span>
  if (!src) return <span className="chat-image-loading" />
  return (
    <a href={src} target="_blank" rel="noreferrer">
      <img className="chat-image" src={src} alt="Shared photo" />
    </a>
  )
}

/**
 * Starts (or reopens) a thread and shows it. Used from trip pages and the
 * guide's applicant list, which only know who to talk to, not the thread id.
 */
export function useChatLauncher() {
  const [chatId, setChatId] = useState(null)
  const [inboxOpen, setInboxOpen] = useState(false)
  const [error, setError] = useState('')

  const openChatWith = useCallback(async (userId, tripId) => {
    setError('')
    try {
      const { conversation } = await api.startConversation(userId, tripId)
      setChatId(conversation.id)
    } catch (err) {
      setError(err.message)
    }
  }, [])

  return { chatId, setChatId, inboxOpen, setInboxOpen, openChatWith, error, setError }
}
