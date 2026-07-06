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

// ─── Badge ────────────────────────────────────────────────────────────────────
export const Badge = ({ variant = 'neutral', children }) => {
  const variants = {
    success: 'badge-success',
    warning: 'badge-warning',
    danger:  'badge-danger',
    info:    'badge-info',
    neutral: 'badge-neutral',
  }
  return <span className={`badge ${variants[variant] ?? variants.neutral}`}>{children}</span>
}

// ─── Button ───────────────────────────────────────────────────────────────────
export const Button = ({ variant = 'primary', children, className = '', ...props }) => {
  const variants = {
    primary:   'btn-primary',
    secondary: 'btn-secondary',
    accent:    'btn-accent',
    danger:    'btn-danger',
  }
  return (
    <button className={`${variants[variant] ?? variants.primary} ${className}`} {...props}>
      {children}
    </button>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────
export const StatCard = ({ label, value, icon: Icon, color = 'primary', trend }) => {
  const colors = {
    primary: 'text-primary bg-purple-100',
    brand:   'text-primary bg-purple-100',
    emerald: 'text-success bg-green-100',
    success: 'text-success bg-green-100',
    amber:   'text-warning bg-yellow-100',
    warning: 'text-warning bg-yellow-100',
    red:     'text-danger bg-red-100',
    danger:  'text-danger bg-red-100',
    blue:    'text-blue-600 bg-blue-100',
    purple:  'text-info bg-purple-100',
    info:    'text-info bg-purple-100',
  }
  return (
    <div className="stat-card animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-neutral uppercase tracking-wider">{label}</p>
          <p className="text-2xl sm:text-3xl font-bold text-gray-800 mt-2">{value ?? '—'}</p>
          {trend && <p className="text-xs text-neutral mt-1">{trend}</p>}
        </div>
        {Icon && (
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${colors[color]}`}>
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
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-800 pr-2 min-w-0 truncate">{title}</h2>
          <button onClick={onClose} className="text-neutral hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="px-4 sm:px-6 py-5 overflow-y-auto flex-1 min-h-0">{children}</div>
        {footer && <div className="px-4 sm:px-6 py-4 border-t border-gray-100 flex flex-wrap justify-end gap-3 flex-shrink-0">{footer}</div>}
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
      <AlertTriangle size={20} className="text-danger flex-shrink-0 mt-0.5" />
      <p className="text-sm text-gray-600">{message}</p>
    </div>
  </Modal>
)

// ─── Spinner ──────────────────────────────────────────────────────────────────
export const Spinner = ({ size = 'md' }) => {
  const s = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-8 h-8' : 'w-6 h-6'
  return <div className={`${s} border-2 border-primary border-t-transparent rounded-full animate-spin`} />
}

// ─── Empty state ──────────────────────────────────────────────────────────────
export const EmptyState = ({ icon: Icon, title, description }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    {Icon && <Icon size={40} className="text-gray-300 mb-4" />}
    <p className="text-gray-500 font-medium">{title}</p>
    {description && <p className="text-neutral text-sm mt-1">{description}</p>}
  </div>
)

// ─── Form field ───────────────────────────────────────────────────────────────
export const FormField = ({ label, error, children }) => (
  <div>
    {label && <label className="label">{label}</label>}
    {children}
    {error && <p className="text-danger text-xs mt-1">{error}</p>}
  </div>
)

// ─── Page header ─────────────────────────────────────────────────────────────
export const PageHeader = ({ title, subtitle, action }) => (
  <div className="page-header flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
    <div className="min-w-0">
      <h1 className="page-title">{title}</h1>
      {subtitle && <p className="page-subtitle">{subtitle}</p>}
    </div>
    {action && <div className="flex flex-wrap gap-2">{action}</div>}
  </div>
)

// ─── Search input ─────────────────────────────────────────────────────────────
export const SearchInput = ({ value, onChange, placeholder = 'Search…' }) => (
  <div className="relative">
    <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral" width="15" height="15" viewBox="0 0 15 15" fill="none">
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