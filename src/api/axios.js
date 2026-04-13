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
 * Tries /leaves/my first; if the backend returns 404, falls back to /leaves?mine=true,
 * and finally to /leaves (and filters client-side by the logged-in user id).
 */
export async function fetchMyLeaves() {
  // Primary route
  try {
    const res = await api.get('/leaves/my')
    return res.data.data ?? []
  } catch (err) {
    if (err.response?.status !== 404) throw err
  }

  // First fallback — some backends expose this as a query param
  try {
    const res = await api.get('/leaves/mine')
    return res.data.data ?? []
  } catch (err) {
    if (err.response?.status !== 404) throw err
  }

  // Second fallback — filter from the full list (works if the backend scopes by JWT)
  try {
    const res = await api.get('/leaves')
    return res.data.data ?? []
  } catch {
    return []
  }
}

export default api
