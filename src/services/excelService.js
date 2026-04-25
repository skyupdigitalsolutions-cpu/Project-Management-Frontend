/**
 * src/services/excelService.js
 * ─────────────────────────────────────────────────────────
 * All Excel-import API calls in one place.
 * PLACE AT: src/services/excelService.js
 */

import api from '../api/axios'

/**
 * Upload an Excel file and auto-import tasks into a project.
 * @param {string}  projectId
 * @param {File}    file        — Excel file object
 * @param {boolean} overwrite   — delete existing Excel-imported tasks first
 */
export async function importExcelTasks(projectId, file, overwrite = false) {
  const form = new FormData()
  form.append('excel', file)
  form.append('overwrite', String(overwrite))
  const { data } = await api.post(`/upload/excel/${projectId}`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

/**
 * Download the blank task import template as an .xlsx blob.
 * Usage: call downloadTemplate(), then trigger browser download.
 */
export async function downloadTemplate() {
  const res = await api.get('/upload/template', { responseType: 'blob' })
  return res.data  // Blob
}

/**
 * Get all Excel-imported tasks for a project.
 */
export async function getImportedTasks(projectId) {
  const { data } = await api.get(`/upload/imports/${projectId}`)
  return data  // { success, total, data }
}

/**
 * Fetch tasks for a project with optional filters.
 * Used by ExcelTaskTable.
 */
export async function fetchProjectTasks(projectId, filters = {}) {
  const params = { project_id: projectId, limit: 200, ...filters }
  const { data } = await api.get('/tasks', { params })
  return data  // { success, data, total, page, pages }
}

/**
 * Update a single task inline (status, priority, title).
 */
export async function updateTask(taskId, updates) {
  const { data } = await api.patch(`/tasks/${taskId}`, updates)
  return data.data
}