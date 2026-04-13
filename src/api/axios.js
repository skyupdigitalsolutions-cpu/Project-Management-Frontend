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
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

/**
 * Fetch the current user's leave requests.
 * Silently returns [] if the backend doesn't support leaves yet.
 */
export async function fetchMyLeaves() {
  const routes = ['/leaves/my', '/leaves/mine', '/leaves']
  for (const route of routes) {
    try {
      const res = await api.get(route)
      return res.data.data ?? []
    } catch (err) {
      if (err.response?.status !== 404) break
    }
  }
  return []
}

/**
 * Fetch all leave requests (admin/manager view).
 * Returns [] silently if the backend doesn't support leaves yet.
 */
export async function fetchAllLeaves(params = {}) {
  try {
    const res = await api.get('/leaves', { params })
    return res.data.data ?? []
  } catch (err) {
    if (err.response?.status === 404) return []
    throw err
  }
}

/**
 * Submit a leave application.
 * Returns { ok: true } on success, or { ok: false, unsupported, message } on failure.
 */
export async function submitLeave(payload, isMultipart = false) {
  try {
    const config = isMultipart ? { headers: { 'Content-Type': 'multipart/form-data' } } : {}
    await api.post('/leaves', payload, config)
    return { ok: true }
  } catch (err) {
    if (err.response?.status === 404) {
      return { ok: false, unsupported: true, message: 'Leave requests are not yet enabled on this server.' }
    }
    return { ok: false, message: err.response?.data?.message || 'Submission failed' }
  }
}

/**
 * Approve or reject a leave (admin).
 * Returns { ok: true } on success, or { ok: false, unsupported, message } on failure.
 */
export async function updateLeaveStatus(leaveId, status, adminNote = '') {
  try {
    await api.patch(`/leaves/${leaveId}`, { status, admin_note: adminNote })
    return { ok: true }
  } catch (err) {
    if (err.response?.status === 404) {
      return { ok: false, unsupported: true, message: 'Leave management is not yet enabled on this server.' }
    }
    return { ok: false, message: err.response?.data?.message || 'Action failed' }
  }
}

export default api
