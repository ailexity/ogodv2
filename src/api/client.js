const TOKEN_KEY = 'ogod_token'

// "Remember me" keeps the token across browser restarts (localStorage);
// otherwise it lives only as long as the tab (sessionStorage).
export function getToken() {
  return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY)
}

/** Whether the current session was saved with "Remember me" (localStorage). */
export function isRemembered() {
  return localStorage.getItem(TOKEN_KEY) !== null
}

export function setToken(token, { remember = false } = {}) {
  localStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(TOKEN_KEY)
  if (token) (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token)
}

let onSessionExpired = () => {}

/** Called when the server rejects the stored session, so the app can return to sign-in. */
export function setSessionExpiredHandler(handler) {
  onSessionExpired = handler
}

async function request(method, path, { body, form } = {}) {
  const headers = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  if (body) headers['Content-Type'] = 'application/json'

  let response
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers,
      body: form ?? (body ? JSON.stringify(body) : undefined),
    })
  } catch {
    throw new Error('Cannot reach the server. Is the API running on port 4000?')
  }

  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    if (response.status === 401 && token) {
      setToken(null)
      onSessionExpired(payload.error)
    }
    const error = new Error(payload.error ?? 'Something went wrong')
    error.status = response.status
    error.code = payload.code
    error.email = payload.email
    throw error
  }

  return payload
}

/**
 * Private images (chat photos) need the auth header, which an <img src> can't
 * send, so they are fetched here and shown from an object URL.
 */
export async function fetchPrivateImage(path) {
  const token = getToken()
  const response = await fetch(`/api${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!response.ok) throw new Error('Could not load photo')
  return URL.createObjectURL(await response.blob())
}

/** Downloads a booking's PDF ticket (an auth-only file) and saves it. */
export async function downloadTicket(bookingId) {
  const token = getToken()
  const response = await fetch(`/api/bookings/${bookingId}/ticket`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    throw new Error(payload.error ?? 'Could not download the ticket')
  }
  const name = /filename="([^"]+)"/.exec(response.headers.get('content-disposition') ?? '')?.[1]
  const url = URL.createObjectURL(await response.blob())
  const link = document.createElement('a')
  link.href = url
  link.download = name ?? 'OGod-ticket.pdf'
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}

export const api = {
  authConfig: () => request('GET', '/auth/config'),
  register: (data) => request('POST', '/auth/register', { body: data }),
  login: (email, password, remember) =>
    request('POST', '/auth/login', { body: { email, password, remember } }),
  googleSignIn: (credential, remember) =>
    request('POST', '/auth/google', { body: { credential, remember } }),
  verifyEmail: (token) => request('POST', '/auth/verify-email', { body: { token } }),
  resendVerification: (email) => request('POST', '/auth/resend-verification', { body: { email } }),
  forgotPassword: (email) => request('POST', '/auth/forgot-password', { body: { email } }),
  resetPassword: (token, password) =>
    request('POST', '/auth/reset-password', { body: { token, password } }),
  logoutAll: () => request('POST', '/auth/logout-all'),
  changePassword: (currentPassword, newPassword, remember) =>
    request('POST', '/auth/change-password', { body: { currentPassword, newPassword, remember } }),
  me: () => request('GET', '/auth/me'),
  updateProfile: (data) => request('PATCH', '/auth/me', { body: data }),
  updatePayout: (data) => request('PUT', '/auth/me/payout', { body: data }),
  completeTour: () => request('POST', '/auth/me/tour'),

  applyAsGuide: (form) => request('POST', '/guides/apply', { form }),
  myApplication: () => request('GET', '/guides/application'),
  subscriptionInfo: () => request('GET', '/guides/subscription'),
  renewSubscription: (form) => request('POST', '/guides/renew', { form }),

  listApplications: (status) =>
    request('GET', `/admin/applications${status ? `?status=${status}` : ''}`),
  approveApplication: (id, data) => request('POST', `/admin/applications/${id}/approve`, { body: data }),
  rejectApplication: (id, notes) => request('POST', `/admin/applications/${id}/reject`, { body: { notes } }),
  listGuides: () => request('GET', '/admin/guides'),
  stats: () => request('GET', '/admin/stats'),
  listUsers: ({ role, q } = {}) => {
    const params = new URLSearchParams()
    if (role) params.set('role', role)
    if (q) params.set('q', q)
    const query = params.toString()
    return request('GET', `/admin/users${query ? `?${query}` : ''}`)
  },
  getSettings: () => request('GET', '/admin/settings'),
  updateSettings: (settings) => request('PATCH', '/admin/settings', { body: { settings } }),
  suspendGuide: (id) => request('POST', `/admin/guides/${id}/suspend`),
  reinstateGuide: (id) => request('POST', `/admin/guides/${id}/reinstate`),
  updateUser: (id, data) => request('PATCH', `/admin/users/${id}`, { body: data }),
  updateUserRole: (id, role) => request('PATCH', `/admin/users/${id}/role`, { body: { role } }),
  resetUserPassword: (id, password) =>
    request('POST', `/admin/users/${id}/reset-password`, { body: { password } }),
  verifyUserEmail: (id) => request('POST', `/admin/users/${id}/verify-email`),
  disableUser: (id) => request('POST', `/admin/users/${id}/disable`),
  enableUser: (id) => request('POST', `/admin/users/${id}/enable`),
  deleteUser: (id) => request('DELETE', `/admin/users/${id}`),

  listTrips: (filters = {}) => {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(filters)) {
      if (value !== null && value !== undefined && value !== '') params.set(key, value)
    }
    const query = params.toString()
    return request('GET', `/trips${query ? `?${query}` : ''}`)
  },
  myTrips: () => request('GET', '/trips/mine'),
  myBookings: () => request('GET', '/bookings/mine'),
  quoteBooking: (tripId, travelers) =>
    request('GET', `/bookings/quote?trip=${tripId}&travelers=${travelers}`),
  createBooking: (data) => request('POST', '/bookings', { body: data }),
  tripBookings: (tripId) => request('GET', `/bookings/trip/${tripId}`),
  bookingRequests: () => request('GET', '/bookings/requests'),
  approveBooking: (id, note, paymentReceived = false) =>
    request('POST', `/bookings/${id}/approve`, { body: { note, paymentReceived } }),
  declineBooking: (id, note) => request('POST', `/bookings/${id}/decline`, { body: { note } }),
  cancelBooking: (id, reason) => request('POST', `/bookings/${id}/cancel`, { body: { reason } }),
  getTrip: (id) => request('GET', `/trips/${id}`),
  createTrip: (data) => request('POST', '/trips', { body: data }),
  updateTrip: (id, data) => request('PATCH', `/trips/${id}`, { body: data }),
  setTripStatus: (id, status, reason) =>
    request('POST', `/trips/${id}/status`, { body: { status, reason } }),
  duplicateTrip: (id) => request('POST', `/trips/${id}/duplicate`),
  deleteTrip: (id) => request('DELETE', `/trips/${id}`),

  listBlogs: (filters = {}) => {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(filters)) {
      if (value !== null && value !== undefined && value !== '') params.set(key, value)
    }
    const query = params.toString()
    return request('GET', `/blogs${query ? `?${query}` : ''}`)
  },
  myBlogs: () => request('GET', '/blogs/mine'),
  getBlog: (id) => request('GET', `/blogs/${id}`),
  createBlog: (form) => request('POST', '/blogs', { form }),
  deleteBlog: (id) => request('DELETE', `/blogs/${id}`),
  voteBlog: (id, value) => request('POST', `/blogs/${id}/vote`, { body: { value } }),

  conversations: () => request('GET', '/messages'),
  unreadMessages: () => request('GET', '/messages/unread'),
  startConversation: (userId, tripId, blogId) =>
    request('POST', '/messages', { body: { userId, tripId, blogId } }),
  wishlist: () => request('GET', '/wishlist'),
  saveTrip: (tripId) => request('POST', `/wishlist/${tripId}`),
  unsaveTrip: (tripId) => request('DELETE', `/wishlist/${tripId}`),
  conversation: (id, after) => request('GET', `/messages/${id}${after ? `?after=${after}` : ''}`),
  sendMessage: (id, form) => request('POST', `/messages/${id}`, { form }),

  adminListBlogs: () => request('GET', '/admin/blogs'),
  hideBlog: (id) => request('POST', `/admin/blogs/${id}/hide`),
  unhideBlog: (id) => request('POST', `/admin/blogs/${id}/unhide`),
}
