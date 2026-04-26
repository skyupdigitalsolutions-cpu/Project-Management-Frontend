/**
 * services/clientService.js
 * All API calls related to the Client module.
 */
import api from '../api/axios'

export const clientService = {
  /** GET /clients */
  getAll: (params = {}) => api.get('/clients', { params }),

  /** GET /clients/:id */
  getById: (id) => api.get(`/clients/${id}`),

  /** POST /clients */
  create: (data) => api.post('/clients', data),

  /** PUT /clients/:id */
  update: (id, data) => api.put(`/clients/${id}`, data),

  /** DELETE /clients/:id */
  delete: (id) => api.delete(`/clients/${id}`),
}