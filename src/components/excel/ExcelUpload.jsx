/**
 * src/components/excel/ExcelUpload.jsx
 * ─────────────────────────────────────────────────────────
 * Self-contained Excel import panel for a project.
 * Renders as a collapsible card — drop anywhere in ProjectDetail or AdminTasks.
 *
 * PLACE AT: src/components/excel/ExcelUpload.jsx
 *
 * PROPS:
 *   projectId   {string}   required — MongoDB project _id
 *   projectName {string}   optional — displayed in heading
 *   onImported  {Function} optional — called with imported task array after success
 */

import { useState, useRef } from 'react'
import {
  Upload, FileSpreadsheet, Download, CheckCircle2, XCircle,
  AlertTriangle, ChevronDown, ChevronUp, Loader2, RefreshCw, X
} from 'lucide-react'
import api from '../../api/axios'
import toast from 'react-hot-toast'

// ─── Priority colours (matches existing tailwind theme) ──────────────────────
const PRIORITY_DOT = {
  critical: 'bg-red-500',
  high:     'bg-orange-400',
  medium:   'bg-yellow-400',
  low:      'bg-emerald-400',
}

const STATUS_PILL = {
  todo:        'bg-blue-50 text-blue-700',
  'in-progress':'bg-purple-50 text-purple-700',
  completed:   'bg-green-50 text-green-700',
  unassigned:  'bg-gray-100 text-gray-500',
  blocked:     'bg-red-50 text-red-600',
}

export default function ExcelUpload({ projectId, projectName = 'this project', onImported }) {
  const [open,         setOpen]         = useState(false)
  const [dragging,     setDragging]     = useState(false)
  const [file,         setFile]         = useState(null)
  const [overwrite,    setOverwrite]    = useState(false)
  const [uploading,    setUploading]    = useState(false)
  const [result,       setResult]       = useState(null)  // import result
  const [showInvalid,  setShowInvalid]  = useState(false)
  const [existingCount,setExistingCount]= useState(null)
  const fileRef = useRef(null)

  // ── File selection ─────────────────────────────────────────────────────────
  const pickFile = (f) => {
    if (!f) return
    const ext = f.name.split('.').pop().toLowerCase()
    if (!['xlsx', 'xls'].includes(ext)) {
      toast.error('Only .xlsx or .xls files are allowed')
      return
    }
    if (f.size > 5 * 1024 * 1024) {
      toast.error('File must be under 5 MB')
      return
    }
    setFile(f)
    setResult(null)
    checkExistingImports()
  }

  const onInputChange  = (e) => pickFile(e.target.files?.[0])
  const onDrop         = (e) => { e.preventDefault(); setDragging(false); pickFile(e.dataTransfer.files?.[0]) }
  const onDragOver     = (e) => { e.preventDefault(); setDragging(true) }
  const onDragLeave    = () => setDragging(false)
  const clearFile      = () => { setFile(null); setResult(null); if (fileRef.current) fileRef.current.value = '' }

  // ── Check how many Excel tasks already exist ───────────────────────────────
  const checkExistingImports = async () => {
    try {
      const { data } = await api.get(`/upload/imports/${projectId}`)
      setExistingCount(data.total || 0)
    } catch { setExistingCount(0) }
  }

  // ── Download template ──────────────────────────────────────────────────────
  const downloadTemplate = async () => {
    try {
      const res = await api.get('/upload/template', { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a   = document.createElement('a')
      a.href     = url
      a.download = 'task-import-template.xlsx'
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Template downloaded!')
    } catch {
      toast.error('Failed to download template')
    }
  }

  // ── Submit import ──────────────────────────────────────────────────────────
  const handleImport = async () => {
    if (!file) return
    setUploading(true)
    setResult(null)
    try {
      const form = new FormData()
      form.append('excel', file)
      form.append('overwrite', String(overwrite))

      const { data } = await api.post(`/upload/excel/${projectId}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      setResult(data)
      if (data.success) {
        toast.success(`✅ Imported ${data.summary.imported} tasks successfully`)
        onImported?.(data.data)
        clearFile()
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Import failed'
      toast.error(msg)
      setResult(err.response?.data || { success: false, message: msg })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="card border border-purple-100">
      {/* ── Header toggle ── */}
      <button
        onClick={() => { setOpen(o => !o); if (!open) checkExistingImports() }}
        className="w-full flex items-center justify-between group"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
            <FileSpreadsheet size={18} className="text-emerald-600" />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-gray-800">Excel Task Import</p>
            <p className="text-xs text-neutral">
              Upload .xlsx → auto-assign tasks by role &amp; department
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {existingCount !== null && existingCount > 0 && (
            <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full font-medium">
              {existingCount} imported
            </span>
          )}
          {open ? <ChevronUp size={16} className="text-neutral" /> : <ChevronDown size={16} className="text-neutral" />}
        </div>
      </button>

      {open && (
        <div className="mt-5 space-y-4 animate-fade-in">

          {/* ── Template download ── */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50 border border-blue-100">
            <div>
              <p className="text-sm font-semibold text-blue-800">Download Template</p>
              <p className="text-xs text-blue-600 mt-0.5">
                Columns: Task, Subtask, Role, Department, Priority, Duration, Dependency, Description, Module
              </p>
            </div>
            <button onClick={downloadTemplate} className="btn-secondary text-xs px-3 py-1.5 gap-1.5">
              <Download size={13} /> Template
            </button>
          </div>

          {/* ── Drop zone ── */}
          {!file ? (
            <div
              onClick={() => fileRef.current?.click()}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all
                ${dragging ? 'border-primary bg-purple-50' : 'border-gray-200 hover:border-primary hover:bg-gray-50'}`}
            >
              <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={onInputChange} />
              <Upload size={28} className={`mx-auto mb-3 ${dragging ? 'text-primary' : 'text-gray-300'}`} />
              <p className="text-sm font-semibold text-gray-700">
                {dragging ? 'Drop your Excel file here' : 'Click or drag your .xlsx file here'}
              </p>
              <p className="text-xs text-neutral mt-1">Max 5 MB · .xlsx and .xls only</p>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
              <FileSpreadsheet size={20} className="text-emerald-600 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{file.name}</p>
                <p className="text-xs text-emerald-600">{(file.size / 1024).toFixed(1)} KB · Ready to import</p>
              </div>
              <button onClick={clearFile} className="text-gray-400 hover:text-gray-600 p-1">
                <X size={16} />
              </button>
            </div>
          )}

          {/* ── Overwrite toggle ── */}
          {existingCount !== null && existingCount > 0 && (
            <label className="flex items-start gap-3 p-3 rounded-xl border border-orange-100 bg-orange-50 cursor-pointer">
              <input
                type="checkbox"
                checked={overwrite}
                onChange={e => setOverwrite(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-orange-500"
              />
              <div>
                <p className="text-sm font-semibold text-orange-800">
                  Overwrite existing Excel import ({existingCount} tasks)
                </p>
                <p className="text-xs text-orange-600 mt-0.5">
                  Deletes all previously Excel-imported tasks for this project before re-importing.
                  Manually created tasks are never deleted.
                </p>
              </div>
            </label>
          )}

          {/* ── Import button ── */}
          <button
            onClick={handleImport}
            disabled={!file || uploading}
            className="btn-primary w-full justify-center py-2.5 disabled:opacity-50"
          >
            {uploading
              ? <><Loader2 size={15} className="animate-spin" /> Importing…</>
              : <><Upload size={15} /> Import Tasks from Excel</>
            }
          </button>

          {/* ── Result panel ── */}
          {result && (
            <ImportResultPanel
              result={result}
              showInvalid={showInvalid}
              toggleInvalid={() => setShowInvalid(v => !v)}
            />
          )}
        </div>
      )}
    </div>
  )
}

// ─── Import Result Sub-component ──────────────────────────────────────────────

function ImportResultPanel({ result, showInvalid, toggleInvalid }) {
  if (!result) return null

  const isSuccess = result.success
  const s         = result.summary || {}
  const tasks     = result.data    || []
  const invalids  = result.invalid_rows || result.errors || []

  return (
    <div className={`rounded-2xl border p-4 ${isSuccess ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
      {/* Status header */}
      <div className="flex items-center gap-2 mb-3">
        {isSuccess
          ? <CheckCircle2 size={18} className="text-green-600" />
          : <XCircle     size={18} className="text-red-500" />
        }
        <p className={`text-sm font-bold ${isSuccess ? 'text-green-800' : 'text-red-700'}`}>
          {result.message}
        </p>
      </div>

      {/* Summary chips */}
      {isSuccess && (
        <div className="flex flex-wrap gap-2 mb-3">
          <Chip color="green"  label={`${s.imported} imported`} />
          <Chip color="blue"   label={`${s.assigned} assigned`} />
          {s.unassigned > 0 && <Chip color="orange" label={`${s.unassigned} unassigned`} />}
          {s.with_deps  > 0 && <Chip color="purple" label={`${s.with_deps} dependencies`} />}
          {s.skipped_invalid > 0 && <Chip color="red" label={`${s.skipped_invalid} rows skipped`} />}
        </div>
      )}

      {/* Imported tasks mini-table */}
      {tasks.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-green-200 bg-white mb-3">
          <table className="min-w-full text-xs">
            <thead className="bg-green-50">
              <tr>
                {['Title','Priority','Status','Assigned To','Due Date'].map(h => (
                  <th key={h} className="text-left px-3 py-2 font-semibold text-gray-600 uppercase tracking-wide text-[10px]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tasks.map((t) => (
                <tr key={t._id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium text-gray-800 max-w-[180px] truncate">{t.title}</td>
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${PRIORITY_DOT[t.priority] || 'bg-gray-400'}`} />
                      {t.priority}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_PILL[t.status] || 'bg-gray-100 text-gray-600'}`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-600">{t.assigned_to?.name || '—'}</td>
                  <td className="px-3 py-2 font-mono text-gray-500">
                    {t.due_date ? new Date(t.due_date).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Invalid rows toggle */}
      {invalids.length > 0 && (
        <div>
          <button
            onClick={toggleInvalid}
            className="flex items-center gap-1.5 text-xs text-orange-700 font-medium mb-2"
          >
            <AlertTriangle size={13} />
            {invalids.length} row{invalids.length !== 1 ? 's' : ''} skipped
            {showInvalid ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          {showInvalid && (
            <div className="space-y-2">
              {invalids.map((inv, i) => (
                <div key={i} className="bg-orange-50 border border-orange-200 rounded-xl px-3 py-2">
                  <p className="text-xs font-semibold text-orange-800 mb-1">Row {inv.row}</p>
                  <ul className="space-y-0.5">
                    {(inv.errors || []).map((e, j) => (
                      <li key={j} className="text-xs text-orange-700">• {e}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Chip({ color, label }) {
  const colors = {
    green:  'bg-green-100 text-green-700',
    blue:   'bg-blue-100 text-blue-700',
    orange: 'bg-orange-100 text-orange-700',
    purple: 'bg-purple-100 text-purple-700',
    red:    'bg-red-100 text-red-700',
  }
  return (
    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${colors[color] || colors.green}`}>
      {label}
    </span>
  )
}