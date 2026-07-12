import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL + '/api',
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Handle 401 globally
//
// A 401 should only ever mean "your APP session (JWT) is missing/expired" — in
// which case we clear the session and send the user to /login. But some
// endpoints legitimately return 401/4xx for OTHER reasons (e.g. connecting a
// Hostinger mailbox with a wrong password). Those must NOT log the user out.
//
// Rules:
//   1. Never auto-logout for mail routes — a mailbox-credential failure is not
//      an app-session failure. (The mail pages surface their own error toast.)
//   2. Only redirect if the user actually had a token (a genuine expiry), and
//      not when we're already on the login screen — this avoids redirect loops.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status
    const url = err.config?.url || ''
    const isMailRoute = url.includes('/mail/')

    if (status === 401 && !isMailRoute) {
      const hadToken = !!localStorage.getItem('token')
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      if (hadToken && !window.location.pathname.startsWith('/login')) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

// ─────────────────────────────────────────────────────────────────────────────
// LEAVES FEATURE FLAG
// The /leaves endpoint does not exist on this backend yet.
// Set this to true once the backend exposes /leaves routes.
// While false, ALL leave helpers return empty data immediately —
// no HTTP requests are made, so there are zero 404 errors in the console.
// ─────────────────────────────────────────────────────────────────────────────
export const LEAVES_ENABLED = true

export async function fetchMyLeaves()               { if (!LEAVES_ENABLED) return []; try { const r = await api.get('/leaves/my'); return r.data.data ?? [] } catch { return [] } }
export async function fetchAllLeaves(params = {})   { if (!LEAVES_ENABLED) return []; try { const r = await api.get('/leaves', { params }); return r.data.data ?? [] } catch { return [] } }
export async function submitLeave(payload, isMultipart = false) {
  if (!LEAVES_ENABLED) return { ok: false, unsupported: true, message: 'Leave requests are not yet available.' }
  try {
    const config = isMultipart ? { headers: { 'Content-Type': 'multipart/form-data' } } : {}
    await api.post('/leaves', payload, config)
    return { ok: true }
  } catch (err) {
    return { ok: false, message: err.response?.data?.message || 'Submission failed' }
  }
}
export async function updateLeaveStatus(leaveId, status, adminNote = '') {
  if (!LEAVES_ENABLED) return { ok: false, unsupported: true, message: 'Leave management is not yet available.' }
  try {
    await api.patch(`/leaves/${leaveId}`, { status, admin_note: adminNote })
    return { ok: true }
  } catch (err) {
    return { ok: false, message: err.response?.data?.message || 'Action failed' }
  }
}

export default api