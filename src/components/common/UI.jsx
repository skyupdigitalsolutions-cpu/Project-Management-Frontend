import { X, AlertTriangle } from 'lucide-react'

// ─── Status & Priority badges ─────────────────────────────────────────────────
export const StatusBadge = ({ status }) => {
  if (!status) return null
  const cls = `badge status-${status.replace(/\s+/g, '-')}`
  return <span className={cls}>{status}</span>
}

export const PriorityBadge = ({ priority }) => {
  if (!priority) return null
  return <span className={`badge priority-${priority}`}>{priority}</span>
}

// ─── Stat card ────────────────────────────────────────────────────────────────
export const StatCard = ({ label, value, icon: Icon, color = 'brand', trend }) => {
  const colors = {
    brand:   'text-brand-400 bg-brand-500/10',
    emerald: 'text-emerald-400 bg-emerald-500/10',
    amber:   'text-amber-400 bg-amber-500/10',
    red:     'text-red-400 bg-red-500/10',
    blue:    'text-blue-400 bg-blue-500/10',
    purple:  'text-purple-400 bg-purple-500/10',
  }
  return (
    <div className="stat-card animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
          <p className="text-3xl font-bold text-white mt-2">{value ?? '—'}</p>
          {trend && <p className="text-xs text-slate-500 mt-1">{trend}</p>}
        </div>
        {Icon && (
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors[color]}`}>
            <Icon size={20} />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Modal wrapper ────────────────────────────────────────────────────────────
export const Modal = ({ open, onClose, title, children, footer }) => {
  if (!open) return null
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-white/5 flex justify-end gap-3">{footer}</div>}
      </div>
    </div>
  )
}

// ─── Confirm dialog ───────────────────────────────────────────────────────────
export const ConfirmModal = ({ open, onClose, onConfirm, title, message, loading }) => (
  <Modal open={open} onClose={onClose} title={title}
    footer={
      <>
        <button className="btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
        <button className="btn-danger" onClick={onConfirm} disabled={loading}>
          {loading ? <Spinner size="sm" /> : null}
          Confirm
        </button>
      </>
    }
  >
    <div className="flex gap-3 items-start">
      <AlertTriangle size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
      <p className="text-sm text-slate-300">{message}</p>
    </div>
  </Modal>
)

// ─── Spinner ──────────────────────────────────────────────────────────────────
export const Spinner = ({ size = 'md' }) => {
  const s = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-8 h-8' : 'w-6 h-6'
  return <div className={`${s} border-2 border-brand-500 border-t-transparent rounded-full animate-spin`} />
}

// ─── Empty state ──────────────────────────────────────────────────────────────
export const EmptyState = ({ icon: Icon, title, description }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    {Icon && <Icon size={40} className="text-slate-600 mb-4" />}
    <p className="text-slate-400 font-medium">{title}</p>
    {description && <p className="text-slate-500 text-sm mt-1">{description}</p>}
  </div>
)

// ─── Form field ───────────────────────────────────────────────────────────────
export const FormField = ({ label, error, children }) => (
  <div>
    {label && <label className="label">{label}</label>}
    {children}
    {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
  </div>
)

// ─── Page header ─────────────────────────────────────────────────────────────
export const PageHeader = ({ title, subtitle, action }) => (
  <div className="page-header flex items-start justify-between">
    <div>
      <h1 className="page-title">{title}</h1>
      {subtitle && <p className="page-subtitle">{subtitle}</p>}
    </div>
    {action && <div>{action}</div>}
  </div>
)

// ─── Search input ─────────────────────────────────────────────────────────────
export const SearchInput = ({ value, onChange, placeholder = 'Search…' }) => (
  <div className="relative">
    <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" width="15" height="15" viewBox="0 0 15 15" fill="none">
      <path d="M10 6.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Zm-.793 3.914a4.5 4.5 0 1 1 .707-.707l2.7 2.7a.5.5 0 0 1-.707.706l-2.7-2.699Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
    </svg>
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="input pl-9"
    />
  </div>
)

// ─── Select ───────────────────────────────────────────────────────────────────
export const SelectInput = ({ value, onChange, options, placeholder, className = '' }) => (
  <select
    value={value}
    onChange={e => onChange(e.target.value)}
    className={`input ${className} appearance-none cursor-pointer`}
  >
    {placeholder && <option value="">{placeholder}</option>}
    {options.map(o => (
      <option key={o.value} value={o.value}>{o.label}</option>
    ))}
  </select>
)
