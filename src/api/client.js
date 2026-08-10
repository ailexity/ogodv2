const TOKEN_KEY = 'ogod_token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
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
    if (response.status === 401) setToken(null)
    const error = new Error(payload.error ?? 'Something went wrong')
    error.status = response.status
    throw error
  }

  return payload
}

export const api = {
  register: (data) => request('POST', '/auth/register', { body: data }),
  login: (email, password) => request('POST', '/auth/login', { body: { email, password } }),
  resetPassword: (email, password) => request('POST', '/auth/reset-password', { body: { email, password } }),
  me: () => request('GET', '/auth/me'),
  updateProfile: (data) => request('PATCH', '/auth/me', { body: data }),

  applyAsGuide: (form) => request('POST', '/guides/apply', { form }),
  myApplication: () => request('GET', '/guides/application'),

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
  approveBooking: (id, note) => request('POST', `/bookings/${id}/approve`, { body: { note } }),
  declineBooking: (id, note) => request('POST', `/bookings/${id}/decline`, { body: { note } }),
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

  adminListBlogs: () => request('GET', '/admin/blogs'),
  hideBlog: (id) => request('POST', `/admin/blogs/${id}/hide`),
  unhideBlog: (id) => request('POST', `/admin/blogs/${id}/unhide`),
}
