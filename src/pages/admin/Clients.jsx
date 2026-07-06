/**
 * pages/admin/Clients.jsx — COMPLETE UPDATED VERSION
 *
 * Full client onboarding form with all 10 sections:
 * 1. Basic Information
 * 2. Contact Details
 * 3. Legal & Tax Details (with doc upload)
 * 4. Billing & Payment Details
 * 5. Project Details
 * 6. Technical Requirements
 * 7. Communication & Reporting
 * 8. Legal Agreements
 * 9. Approval Authority
 * 10. Additional Notes
 *
 * All data stored in admin records + client profile view.
 */

import { useEffect, useState, useCallback } from 'react'
import {
  Plus, Pencil, Trash2, RefreshCw, Building2,
  Mail, Phone, MapPin, Hash, FileText, Eye,
  Upload, X, User, CreditCard, Briefcase,
  Monitor, MessageSquare, Shield, CheckSquare,
  Users, AlertTriangle, ChevronRight, Globe,
  Calendar, DollarSign, Layers, Zap, Bell
} from 'lucide-react'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import {
  PageHeader, StatCard, SearchInput, Modal, ConfirmModal,
  FormField, StatusBadge, Spinner, EmptyState
} from '../../components/common/UI'

// ─── Constants ────────────────────────────────────────────────────────────────

const BUSINESS_TYPES = ['Pvt Ltd', 'LLP', 'Partnership', 'Individual', 'Startup', 'NGO', 'Government', 'Other']
const INDUSTRIES = [
  'Technology', 'E-commerce', 'Healthcare', 'Education', 'Finance & Banking',
  'Real Estate', 'Manufacturing', 'Retail', 'Media & Entertainment',
  'Travel & Hospitality', 'Food & Beverage', 'Logistics', 'FMCG', 'Other'
]
const PAYMENT_TERMS = ['Advance (100%)', 'Net 15 days', 'Net 30 days', 'Net 45 days', 'Net 60 days', 'Milestone-based', 'Monthly Retainer']
const PAYMENT_METHODS = ['Bank Transfer (NEFT/RTGS)', 'UPI', 'Cheque', 'PayPal', 'Wire Transfer', 'Other']
const PLATFORMS = ['Web', 'iOS', 'Android', 'Cloud (AWS)', 'Cloud (GCP)', 'Cloud (Azure)', 'Desktop', 'Other']
const COMM_MODES = ['Email', 'Slack', 'Microsoft Teams', 'WhatsApp', 'Phone Calls', 'Google Meet', 'Zoom']
const MEETING_FREQ = ['As needed', 'Weekly', 'Bi-weekly', 'Monthly', 'Quarterly']
const REPORT_FORMATS = ['Weekly', 'Bi-weekly', 'Monthly', 'Milestone-based', 'On-demand']

const emptyForm = {
  // 1. Basic
  companyName: '', businessType: '', industry: '', website: '',
  registeredAddress: '', operationalAddress: '',

  // 2. Contact
  primaryContactName: '', primaryDesignation: '', email: '', phone: '',
  secondaryContactName: '', secondaryEmail: '', secondaryPhone: '',

  // 3. Legal & Tax
  panNumber: '', gstNumber: '', companyRegNumber: '',

  // 4. Billing & Payment
  billingAddress: '', paymentTerms: '', preferredPaymentMethod: '',
  bankName: '', bankAccountNumber: '', ifscCode: '', accountHolderName: '',
  purchaseOrderRequired: 'No',

  // 5. Project
  projectName: '', projectDescription: '', scopeOfWork: '',
  deliverables: '', timeline: '', budget: '',

  // 6. Technical
  platforms: [], techPreferences: '', accessRequired: '', existingSystems: '',

  // 7. Communication
  preferredCommMode: '', meetingFrequency: '', reportingFormat: '',

  // 8. Legal
  ndaRequired: 'No', contractSigned: 'No', slaRequired: 'No',

  // 9. Approval
  projectApproverName: '', billingApproverName: '',

  // 10. Notes
  specialInstructions: '', risksConstraints: '',

  // Legacy
  name: '', address: '', notes: '',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, color = 'blue' }) {
  const colors = {
    blue: 'text-blue-600 bg-blue-50 border-blue-100',
    green: 'text-emerald-600 bg-emerald-50 border-emerald-100',
    purple: 'text-purple-600 bg-purple-50 border-purple-100',
    amber: 'text-amber-600 bg-amber-50 border-amber-100',
    red: 'text-red-600 bg-red-50 border-red-100',
    indigo: 'text-indigo-600 bg-indigo-50 border-indigo-100',
    teal: 'text-teal-600 bg-teal-50 border-teal-100',
    rose: 'text-rose-600 bg-rose-50 border-rose-100',
    slate: 'text-slate-600 bg-slate-50 border-slate-100',
    orange: 'text-orange-600 bg-orange-50 border-orange-100',
  }
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${colors[color]} mb-3`}>
      <Icon size={14} />
      <span className="text-sm font-semibold">{title}</span>
    </div>
  )
}

function InfoRow({ label, value, mono = false, badge = false }) {
  if (!value && value !== false) return null
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</span>
      {badge ? (
        <span className={`badge w-fit text-xs ${value === 'Yes' ? 'badge-success' : 'badge-secondary'}`}>{value}</span>
      ) : (
        <span className={`text-sm text-gray-800 ${mono ? 'font-mono' : ''}`}>{value}</span>
      )}
    </div>
  )
}

function MultiSelect({ options, value = [], onChange, placeholder }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {options.map(opt => (
          <button
            key={opt}
            type="button"
            onClick={() => {
              const next = value.includes(opt)
                ? value.filter(v => v !== opt)
                : [...value, opt]
              onChange(next)
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              value.includes(opt)
                ? 'bg-primary text-white border-primary'
                : 'bg-white text-gray-600 border-gray-200 hover:border-primary/50'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
      {value.length > 0 && (
        <p className="text-xs text-gray-400">Selected: {value.join(', ')}</p>
      )}
    </div>
  )
}

// ─── Document Upload for Clients ──────────────────────────────────────────────

function ClientDocUpload({ clientId, onDone }) {
  const [uploading, setUploading] = useState(false)
  const [uploadedDocs, setUploadedDocs] = useState([])
  const [files, setFiles] = useState({ pan: null, gst: null, incorporation: null, nda: null, contract: null })
  const [others, setOthers] = useState([])

  useEffect(() => {
    if (!clientId) return
    api.get(`/clients/${clientId}/documents`)
      .then(r => setUploadedDocs(r.data.data ?? []))
      .catch(() => {})
  }, [clientId])

  const handleFile = (field, file) => setFiles(p => ({ ...p, [field]: file }))

  const handleUpload = async () => {
    const form = new FormData()
    Object.entries(files).forEach(([k, v]) => { if (v) form.append(k, v) })
    others.forEach(f => form.append('others', f))
    if ([...form.entries()].length === 0) { toast.error('Select at least one file'); return }
    setUploading(true)
    try {
      await api.post(`/clients/${clientId}/documents`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      toast.success('Documents uploaded')
      onDone?.()
    } catch (e) {
      toast.error(e.response?.data?.message || 'Upload failed')
    } finally { setUploading(false) }
  }

  const FileRow = ({ label, field }) => (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
      <label className="w-44 text-sm font-medium text-gray-600 shrink-0">{label}</label>
      <input
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.webp"
        onChange={e => handleFile(field, e.target.files[0])}
        className="text-sm text-gray-600 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
      />
      {files[field] && <span className="text-xs text-green-600 font-medium">✓ {files[field].name}</span>}
    </div>
  )

  return (
    <div className="space-y-5 py-2">
      <p className="text-xs text-gray-400 bg-gray-50 px-3 py-2 rounded-lg">
        📎 Accepted: PDF, PNG, JPG, WebP · Max 5 MB each
      </p>
      <div className="space-y-1">
        <SectionHeader icon={Shield} title="Legal & Tax Documents" color="indigo" />
        <FileRow label="PAN Card" field="pan" />
        <FileRow label="GST Certificate" field="gst" />
        <FileRow label="Certificate of Incorporation" field="incorporation" />
      </div>
      <div className="space-y-1">
        <SectionHeader icon={FileText} title="Agreement Documents" color="purple" />
        <FileRow label="NDA Document" field="nda" />
        <FileRow label="Signed Contract" field="contract" />
        <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50">
          <label className="w-44 text-sm font-medium text-gray-600 shrink-0 pt-1">Other Documents</label>
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp"
            multiple
            onChange={e => setOthers(Array.from(e.target.files))}
            className="text-sm text-gray-600 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
          />
          {others.length > 0 && <span className="text-xs text-green-600 pt-1">✓ {others.length} file(s)</span>}
        </div>
      </div>
      {uploadedDocs.length > 0 && (
        <div>
          <SectionHeader icon={FileText} title="Uploaded Documents" color="green" />
          {uploadedDocs.map((doc, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 bg-gray-50 rounded-lg mb-1">
              <FileText size={13} className="text-gray-400" />
              <span className="flex-1">{doc.originalName || doc.name}</span>
              <span className="text-xs text-gray-400">{doc.type}</span>
              {doc.url && <a href={doc.url} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline">View</a>}
            </div>
          ))}
        </div>
      )}
      <div className="flex justify-end pt-2 border-t border-gray-100">
        <button className="btn-primary flex items-center gap-2" onClick={handleUpload} disabled={uploading}>
          {uploading ? <Spinner size="sm" /> : <><Upload size={14} /> Upload Documents</>}
        </button>
      </div>
    </div>
  )
}

// ─── Client Detail Drawer ─────────────────────────────────────────────────────

function ClientDetailDrawer({ client, onClose, onEdit }) {
  const [tab, setTab] = useState('basic')
  if (!client) return null

  const tabs = [
    { id: 'basic',    label: 'Company',    icon: Building2 },
    { id: 'contact',  label: 'Contacts',   icon: User },
    { id: 'legal',    label: 'Legal',      icon: Shield },
    { id: 'billing',  label: 'Billing',    icon: CreditCard },
    { id: 'project',  label: 'Project',    icon: Briefcase },
    { id: 'tech',     label: 'Technical',  icon: Monitor },
    { id: 'comm',     label: 'Comms',      icon: MessageSquare },
    { id: 'approvals',label: 'Approvals',  icon: CheckSquare },
  ]

  const c = client

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div
        className="w-full max-w-xl h-full bg-white shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-4 px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center">
            <Building2 size={20} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 truncate">{c.companyName}</p>
            <p className="text-xs text-gray-400">{c.businessType} · {c.industry}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`badge text-xs ${c.isActive ? 'badge-success' : 'badge-secondary'}`}>
                {c.isActive ? 'Active' : 'Inactive'}
              </span>
              {c.contractSigned === 'Yes' && <span className="badge badge-info text-xs">Contract Signed</span>}
              {c.ndaRequired === 'Yes' && <span className="badge badge-warning text-xs">NDA</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onEdit} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5">
              <Pencil size={12} /> Edit
            </button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 overflow-x-auto bg-white">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1 px-3 py-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
                tab === t.id ? 'border-primary text-primary' : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              <t.icon size={11} />
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {tab === 'basic' && (
            <>
              <SectionHeader icon={Building2} title="Company Information" color="blue" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InfoRow label="Company Name" value={c.companyName} />
                <InfoRow label="Business Type" value={c.businessType} />
                <InfoRow label="Industry" value={c.industry} />
                <InfoRow label="Website" value={c.website} />
              </div>
              <InfoRow label="Registered Address" value={c.registeredAddress || c.address} />
              <InfoRow label="Operational Address" value={c.operationalAddress} />
              {c.notes && (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-100">
                  <p className="text-xs font-semibold text-amber-700 mb-1">Notes</p>
                  <p className="text-sm text-amber-800">{c.notes}</p>
                </div>
              )}
            </>
          )}

          {tab === 'contact' && (
            <>
              <SectionHeader icon={User} title="Primary Contact" color="blue" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InfoRow label="Name" value={c.primaryContactName || c.name} />
                <InfoRow label="Designation" value={c.primaryDesignation} />
                <InfoRow label="Email" value={c.email} />
                <InfoRow label="Phone" value={c.phone} />
              </div>
              {(c.secondaryContactName || c.secondaryEmail) && (
                <>
                  <SectionHeader icon={User} title="Secondary Contact" color="teal" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <InfoRow label="Name" value={c.secondaryContactName} />
                    <InfoRow label="Email" value={c.secondaryEmail} />
                    <InfoRow label="Phone" value={c.secondaryPhone} />
                  </div>
                </>
              )}
            </>
          )}

          {tab === 'legal' && (
            <>
              <SectionHeader icon={Shield} title="Legal & Tax Details" color="indigo" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InfoRow label="PAN Number" value={c.panNumber} mono />
                <InfoRow label="GST Number" value={c.gstNumber} mono />
                <InfoRow label="Company Reg. No." value={c.companyRegNumber} mono />
              </div>
              <SectionHeader icon={CheckSquare} title="Legal Agreements" color="purple" />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <InfoRow label="NDA Required" value={c.ndaRequired || '—'} badge />
                <InfoRow label="Contract Signed" value={c.contractSigned || '—'} badge />
                <InfoRow label="SLA Required" value={c.slaRequired || '—'} badge />
              </div>
            </>
          )}

          {tab === 'billing' && (
            <>
              <SectionHeader icon={CreditCard} title="Billing Details" color="green" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InfoRow label="Payment Terms" value={c.paymentTerms} />
                <InfoRow label="Payment Method" value={c.preferredPaymentMethod} />
                <InfoRow label="PO Required" value={c.purchaseOrderRequired || '—'} badge />
              </div>
              <InfoRow label="Billing Address" value={c.billingAddress} />
              {(c.bankName || c.bankAccountNumber) && (
                <>
                  <SectionHeader icon={Hash} title="Bank Details" color="amber" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <InfoRow label="Bank Name" value={c.bankName} />
                    <InfoRow label="Account Holder" value={c.accountHolderName} />
                    <InfoRow label="Account Number" value={c.bankAccountNumber} mono />
                    <InfoRow label="IFSC Code" value={c.ifscCode} mono />
                  </div>
                </>
              )}
            </>
          )}

          {tab === 'project' && (
            <>
              <SectionHeader icon={Briefcase} title="Project Details" color="orange" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InfoRow label="Project Name" value={c.projectName} />
                <InfoRow label="Timeline / Deadline" value={c.timeline} />
                <InfoRow label="Budget" value={c.budget} />
              </div>
              <InfoRow label="Project Description" value={c.projectDescription} />
              <InfoRow label="Scope of Work" value={c.scopeOfWork} />
              <InfoRow label="Deliverables" value={c.deliverables} />
            </>
          )}

          {tab === 'tech' && (
            <>
              <SectionHeader icon={Monitor} title="Technical Requirements" color="teal" />
              {c.platforms?.length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">Platforms</p>
                  <div className="flex flex-wrap gap-2">
                    {c.platforms.map(p => (
                      <span key={p} className="badge badge-info text-xs">{p}</span>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 gap-4">
                <InfoRow label="Technology Preferences" value={c.techPreferences} />
                <InfoRow label="Access Required" value={c.accessRequired} />
                <InfoRow label="Existing Systems" value={c.existingSystems} />
              </div>
            </>
          )}

          {tab === 'comm' && (
            <>
              <SectionHeader icon={MessageSquare} title="Communication Preferences" color="rose" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InfoRow label="Preferred Mode" value={c.preferredCommMode} />
                <InfoRow label="Meeting Frequency" value={c.meetingFrequency} />
                <InfoRow label="Reporting Format" value={c.reportingFormat} />
              </div>
              {(c.specialInstructions || c.risksConstraints) && (
                <>
                  <SectionHeader icon={AlertTriangle} title="Notes & Risks" color="amber" />
                  <InfoRow label="Special Instructions" value={c.specialInstructions} />
                  <InfoRow label="Risks / Constraints" value={c.risksConstraints} />
                </>
              )}
            </>
          )}

          {tab === 'approvals' && (
            <>
              <SectionHeader icon={CheckSquare} title="Approval Authority" color="slate" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InfoRow label="Project Approver" value={c.projectApproverName} />
                <InfoRow label="Billing Approver" value={c.billingApproverName} />
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Added {format(new Date(c.createdAt), 'dd MMM yyyy, HH:mm')}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Clients() {
  const [clients,  setClients]  = useState([])
  const [total,    setTotal]    = useState(0)
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [modal,    setModal]    = useState(null)
  const [delModal, setDelModal] = useState(null)
  const [form,     setForm]     = useState(emptyForm)
  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [target,   setTarget]   = useState(null)
  const [formTab,  setFormTab]  = useState('basic')
  const [drawerClient, setDrawerClient] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (search) params.search = search
      const { data } = await api.get('/clients', { params })
      setClients(data.data ?? [])
      setTotal(data.total ?? 0)
    } catch {
      toast.error('Failed to load clients')
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => { load() }, [load])

  const openCreate = () => {
    setForm(emptyForm)
    setTarget(null)
    setFormTab('basic')
    setModal('create')
  }
  const openEdit = (c) => {
    setForm({ ...emptyForm, ...c })
    setTarget(c)
    setFormTab('basic')
    setModal('edit')
    setDrawerClient(null)
  }
  const openDocs = (c) => { setTarget(c); setModal('docs') }

  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  const handleSave = async () => {
    if (!form.companyName || !form.email) {
      toast.error('Company Name and Email are required')
      return
    }
    setSaving(true)
    try {
      // Sync legacy fields
      const payload = {
        ...form,
        name: form.primaryContactName || form.name,
        address: form.registeredAddress || form.address,
        notes: form.specialInstructions || form.notes,
      }
      if (modal === 'create') {
        await api.post('/clients', payload)
        toast.success('Client onboarded successfully')
      } else {
        await api.put(`/clients/${target._id}`, payload)
        toast.success('Client updated successfully')
      }
      setModal(null)
      load()
    } catch (e) {
      toast.error(e.response?.data?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await api.delete(`/clients/${delModal._id}`)
      toast.success('Client deactivated')
      setDelModal(null)
      load()
    } catch {
      toast.error('Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  // Form tabs
  const formTabs = [
    { id: 'basic',    label: 'Company',    icon: Building2,    step: 1 },
    { id: 'contact',  label: 'Contacts',   icon: User,         step: 2 },
    { id: 'legal',    label: 'Legal',      icon: Shield,       step: 3 },
    { id: 'billing',  label: 'Billing',    icon: CreditCard,   step: 4 },
    { id: 'project',  label: 'Project',    icon: Briefcase,    step: 5 },
    { id: 'tech',     label: 'Technical',  icon: Monitor,      step: 6 },
    { id: 'comm',     label: 'Comms',      icon: MessageSquare,step: 7 },
    { id: 'approvals',label: 'Approvals',  icon: CheckSquare,  step: 8 },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Clients"
        subtitle="Full client onboarding — company info, legal, billing, project & comms"
        action={
          <button className="btn-primary flex items-center gap-2" onClick={openCreate}>
            <Plus size={16} /> Onboard Client
          </button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Clients"  value={total}                                    icon={Building2} color="primary" />
        <StatCard label="Active"         value={clients.filter(c => c.isActive).length}   icon={Building2} color="emerald" />
        <StatCard label="Contract Signed" value={clients.filter(c => c.contractSigned === 'Yes').length} icon={CheckSquare} color="info" />
        <StatCard label="Inactive"       value={clients.filter(c => !c.isActive).length}  icon={Building2} color="amber" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-48">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by company, contact or email…" />
        </div>
        <button onClick={load} className="btn-secondary px-3"><RefreshCw size={15} /></button>
      </div>

      {/* Table */}
      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100/50">
              <tr>
                {['Company', 'Contact', 'Industry', 'Email', 'Phone', 'Contract', 'Status', 'Added', 'Actions'].map(h => (
                  <th key={h} className="table-header text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="py-16 text-center"><Spinner /></td></tr>
              ) : clients.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <EmptyState icon={Building2} title="No clients found" description="Onboard your first client to get started" />
                  </td>
                </tr>
              ) : clients.map(c => (
                <tr key={c._id} className="table-row group">
                  <td className="table-cell">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Building2 size={14} className="text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800 text-sm">{c.companyName}</p>
                        {c.businessType && <p className="text-xs text-gray-400">{c.businessType}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="table-cell text-sm font-medium text-gray-700">
                    {c.primaryContactName || c.name}
                    {c.primaryDesignation && <p className="text-xs text-gray-400">{c.primaryDesignation}</p>}
                  </td>
                  <td className="table-cell text-sm text-gray-500">{c.industry || '—'}</td>
                  <td className="table-cell text-sm text-gray-500">{c.email}</td>
                  <td className="table-cell text-sm text-gray-500">{c.phone || '—'}</td>
                  <td className="table-cell">
                    <span className={`badge text-xs ${c.contractSigned === 'Yes' ? 'badge-success' : 'badge-secondary'}`}>
                      {c.contractSigned === 'Yes' ? '✓ Signed' : 'Pending'}
                    </span>
                  </td>
                  <td className="table-cell">
                    <span className={`badge text-xs ${c.isActive ? 'status-active' : 'status-inactive'}`}>
                      {c.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="table-cell text-sm text-gray-400">
                    {format(new Date(c.createdAt), 'dd MMM yyyy')}
                  </td>
                  <td className="table-cell">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setDrawerClient(c)}  title="View Profile"  className="p-1.5 rounded hover:bg-blue-50 text-blue-500"><Eye size={13} /></button>
                      <button onClick={() => openEdit(c)}          title="Edit"          className="p-1.5 rounded hover:bg-amber-50 text-amber-500"><Pencil size={13} /></button>
                      <button onClick={() => openDocs(c)}          title="Documents"     className="p-1.5 rounded hover:bg-green-50 text-green-500"><Upload size={13} /></button>
                      <button onClick={() => setDelModal(c)}       title="Deactivate"    className="p-1.5 rounded hover:bg-red-50 text-red-500"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Create / Edit Modal ──────────────────────────────────────────────── */}
      <Modal
        open={modal === 'create' || modal === 'edit'}
        onClose={() => setModal(null)}
        title={modal === 'create' ? 'Client Onboarding Form' : `Edit Client — ${target?.companyName}`}
        size="xl"
        footer={
          <div className="flex items-center gap-3 justify-between">
            <p className="text-xs text-gray-400">
              Fill all tabs · data saved to admin records & client profile
            </p>
            <div className="flex gap-3">
              <button className="btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn-primary flex items-center gap-2" onClick={handleSave} disabled={saving}>
                {saving ? <Spinner size="sm" /> : (modal === 'create' ? 'Onboard Client' : 'Save All Changes')}
              </button>
            </div>
          </div>
        }
      >
        {/* Stepper tabs */}
        <div className="flex border-b border-gray-100 mb-4 -mx-1 overflow-x-auto">
          {formTabs.map(t => (
            <button
              key={t.id}
              onClick={() => setFormTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
                formTab === t.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              <span className={`w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center ${
                formTab === t.id ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400'
              }`}>{t.step}</span>
              {t.label}
            </button>
          ))}
        </div>

        <div className="space-y-4 max-h-[58vh] overflow-y-auto pr-1">

          {/* ── 1. BASIC ── */}
          {formTab === 'basic' && (
            <div className="space-y-4">
              <SectionHeader icon={Building2} title="Basic Company Information" color="blue" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Company Name *">
                  <input className="input" value={form.companyName} onChange={e => f('companyName', e.target.value)} placeholder="Acme Corp" />
                </FormField>
                <FormField label="Business Type *">
                  <select className="input" value={form.businessType} onChange={e => f('businessType', e.target.value)}>
                    <option value="">Select type</option>
                    {BUSINESS_TYPES.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </FormField>
                <FormField label="Industry">
                  <select className="input" value={form.industry} onChange={e => f('industry', e.target.value)}>
                    <option value="">Select industry</option>
                    {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </FormField>
                <FormField label="Website">
                  <input className="input" value={form.website} onChange={e => f('website', e.target.value)} placeholder="https://acmecorp.com" />
                </FormField>
              </div>
              <FormField label="Registered Address">
                <textarea className="input resize-none" rows={2} value={form.registeredAddress} onChange={e => f('registeredAddress', e.target.value)} placeholder="Official registered address" />
              </FormField>
              <FormField label="Operational Address (if different)">
                <textarea className="input resize-none" rows={2} value={form.operationalAddress} onChange={e => f('operationalAddress', e.target.value)} placeholder="Day-to-day operating address" />
              </FormField>
            </div>
          )}

          {/* ── 2. CONTACT ── */}
          {formTab === 'contact' && (
            <div className="space-y-4">
              <SectionHeader icon={User} title="Primary Contact" color="blue" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Contact Name *">
                  <input className="input" value={form.primaryContactName} onChange={e => f('primaryContactName', e.target.value)} placeholder="John Doe" />
                </FormField>
                <FormField label="Designation">
                  <input className="input" value={form.primaryDesignation} onChange={e => f('primaryDesignation', e.target.value)} placeholder="CEO / Manager" />
                </FormField>
                <FormField label="Email *">
                  <input className="input" type="email" value={form.email} onChange={e => f('email', e.target.value)} placeholder="john@acmecorp.com" />
                </FormField>
                <FormField label="Phone">
                  <input className="input" value={form.phone} onChange={e => f('phone', e.target.value)} placeholder="+91 98765 43210" />
                </FormField>
              </div>

              <SectionHeader icon={User} title="Secondary Contact" color="teal" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Contact Name">
                  <input className="input" value={form.secondaryContactName} onChange={e => f('secondaryContactName', e.target.value)} placeholder="Jane Smith" />
                </FormField>
                <FormField label="Email">
                  <input className="input" type="email" value={form.secondaryEmail} onChange={e => f('secondaryEmail', e.target.value)} placeholder="jane@acmecorp.com" />
                </FormField>
                <FormField label="Phone">
                  <input className="input" value={form.secondaryPhone} onChange={e => f('secondaryPhone', e.target.value)} placeholder="+91 98765 43211" />
                </FormField>
              </div>
            </div>
          )}

          {/* ── 3. LEGAL ── */}
          {formTab === 'legal' && (
            <div className="space-y-4">
              <SectionHeader icon={Shield} title="Legal & Tax Details" color="indigo" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="PAN Number">
                  <input className="input font-mono uppercase" value={form.panNumber} onChange={e => f('panNumber', e.target.value.toUpperCase())} placeholder="ABCDE1234F" maxLength={10} />
                </FormField>
                <FormField label="GST Number">
                  <input className="input font-mono uppercase" value={form.gstNumber} onChange={e => f('gstNumber', e.target.value.toUpperCase())} placeholder="22AAAAA0000A1Z5" maxLength={15} />
                </FormField>
                <FormField label="Company Registration Number">
                  <input className="input font-mono" value={form.companyRegNumber} onChange={e => f('companyRegNumber', e.target.value)} placeholder="U12345MH2020PTC123456" />
                </FormField>
              </div>

              <SectionHeader icon={CheckSquare} title="Legal Agreements" color="purple" />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FormField label="NDA Required?">
                  <select className="input" value={form.ndaRequired} onChange={e => f('ndaRequired', e.target.value)}>
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                  </select>
                </FormField>
                <FormField label="Contract Signed?">
                  <select className="input" value={form.contractSigned} onChange={e => f('contractSigned', e.target.value)}>
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                  </select>
                </FormField>
                <FormField label="SLA Required?">
                  <select className="input" value={form.slaRequired} onChange={e => f('slaRequired', e.target.value)}>
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                  </select>
                </FormField>
              </div>
              <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                📎 Upload PAN, GST Certificate, Certificate of Incorporation & signed agreements via the Documents button after saving.
              </p>
            </div>
          )}

          {/* ── 4. BILLING ── */}
          {formTab === 'billing' && (
            <div className="space-y-4">
              <SectionHeader icon={CreditCard} title="Billing & Payment Details" color="green" />
              <FormField label="Billing Address">
                <textarea className="input resize-none" rows={2} value={form.billingAddress} onChange={e => f('billingAddress', e.target.value)} placeholder="Billing address (if different from registered)" />
              </FormField>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Payment Terms">
                  <select className="input" value={form.paymentTerms} onChange={e => f('paymentTerms', e.target.value)}>
                    <option value="">Select terms</option>
                    {PAYMENT_TERMS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </FormField>
                <FormField label="Preferred Payment Method">
                  <select className="input" value={form.preferredPaymentMethod} onChange={e => f('preferredPaymentMethod', e.target.value)}>
                    <option value="">Select method</option>
                    {PAYMENT_METHODS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </FormField>
                <FormField label="Purchase Order Required?">
                  <select className="input" value={form.purchaseOrderRequired} onChange={e => f('purchaseOrderRequired', e.target.value)}>
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                  </select>
                </FormField>
              </div>

              <SectionHeader icon={Hash} title="Bank Details (if required)" color="amber" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Bank Name">
                  <input className="input" value={form.bankName} onChange={e => f('bankName', e.target.value)} placeholder="e.g. HDFC Bank" />
                </FormField>
                <FormField label="Account Holder Name">
                  <input className="input" value={form.accountHolderName} onChange={e => f('accountHolderName', e.target.value)} placeholder="As per bank" />
                </FormField>
                <FormField label="Account Number">
                  <input className="input font-mono" value={form.bankAccountNumber} onChange={e => f('bankAccountNumber', e.target.value)} placeholder="Account number" />
                </FormField>
                <FormField label="IFSC Code">
                  <input className="input font-mono uppercase" value={form.ifscCode} onChange={e => f('ifscCode', e.target.value.toUpperCase())} placeholder="HDFC0001234" />
                </FormField>
              </div>
            </div>
          )}

          {/* ── 5. PROJECT ── */}
          {formTab === 'project' && (
            <div className="space-y-4">
              <SectionHeader icon={Briefcase} title="Project Details" color="orange" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Project Name">
                  <input className="input" value={form.projectName} onChange={e => f('projectName', e.target.value)} placeholder="e.g. Brand Redesign 2025" />
                </FormField>
                <FormField label="Timeline / Deadline">
                  <input className="input" value={form.timeline} onChange={e => f('timeline', e.target.value)} placeholder="e.g. 3 months / 30 Sep 2025" />
                </FormField>
                <FormField label="Budget">
                  <input className="input" value={form.budget} onChange={e => f('budget', e.target.value)} placeholder="e.g. ₹5,00,000" />
                </FormField>
              </div>
              <FormField label="Project Description">
                <textarea className="input resize-none" rows={2} value={form.projectDescription} onChange={e => f('projectDescription', e.target.value)} placeholder="Brief overview of the project" />
              </FormField>
              <FormField label="Scope of Work">
                <textarea className="input resize-none" rows={3} value={form.scopeOfWork} onChange={e => f('scopeOfWork', e.target.value)} placeholder="Detailed scope and boundaries of work" />
              </FormField>
              <FormField label="Deliverables">
                <textarea className="input resize-none" rows={2} value={form.deliverables} onChange={e => f('deliverables', e.target.value)} placeholder="List key deliverables" />
              </FormField>
            </div>
          )}

          {/* ── 6. TECHNICAL ── */}
          {formTab === 'tech' && (
            <div className="space-y-4">
              <SectionHeader icon={Monitor} title="Technical Requirements" color="teal" />
              <FormField label="Platforms">
                <MultiSelect
                  options={PLATFORMS}
                  value={form.platforms}
                  onChange={v => f('platforms', v)}
                />
              </FormField>
              <FormField label="Technology Preferences">
                <input className="input" value={form.techPreferences} onChange={e => f('techPreferences', e.target.value)} placeholder="e.g. React, Node.js, AWS, Figma" />
              </FormField>
              <FormField label="Access Required">
                <input className="input" value={form.accessRequired} onChange={e => f('accessRequired', e.target.value)} placeholder="e.g. APIs, Git repo, Hosting credentials" />
              </FormField>
              <FormField label="Existing Systems (if any)">
                <textarea className="input resize-none" rows={2} value={form.existingSystems} onChange={e => f('existingSystems', e.target.value)} placeholder="Current tools, CRMs, or platforms the client uses" />
              </FormField>
            </div>
          )}

          {/* ── 7. COMMUNICATION ── */}
          {formTab === 'comm' && (
            <div className="space-y-4">
              <SectionHeader icon={MessageSquare} title="Communication & Reporting" color="rose" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Preferred Communication Mode">
                  <select className="input" value={form.preferredCommMode} onChange={e => f('preferredCommMode', e.target.value)}>
                    <option value="">Select mode</option>
                    {COMM_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </FormField>
                <FormField label="Meeting Frequency">
                  <select className="input" value={form.meetingFrequency} onChange={e => f('meetingFrequency', e.target.value)}>
                    <option value="">Select frequency</option>
                    {MEETING_FREQ.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </FormField>
                <FormField label="Reporting Format">
                  <select className="input" value={form.reportingFormat} onChange={e => f('reportingFormat', e.target.value)}>
                    <option value="">Select format</option>
                    {REPORT_FORMATS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </FormField>
              </div>

              <SectionHeader icon={AlertTriangle} title="Additional Notes" color="amber" />
              <FormField label="Special Instructions">
                <textarea className="input resize-none" rows={2} value={form.specialInstructions} onChange={e => f('specialInstructions', e.target.value)} placeholder="Any special requirements or instructions" />
              </FormField>
              <FormField label="Risks / Constraints">
                <textarea className="input resize-none" rows={2} value={form.risksConstraints} onChange={e => f('risksConstraints', e.target.value)} placeholder="Known risks or project constraints" />
              </FormField>
            </div>
          )}

          {/* ── 8. APPROVALS ── */}
          {formTab === 'approvals' && (
            <div className="space-y-4">
              <SectionHeader icon={CheckSquare} title="Approval Authority" color="slate" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Project Approver Name">
                  <input className="input" value={form.projectApproverName} onChange={e => f('projectApproverName', e.target.value)} placeholder="Name of project sign-off authority" />
                </FormField>
                <FormField label="Billing Approver Name">
                  <input className="input" value={form.billingApproverName} onChange={e => f('billingApproverName', e.target.value)} placeholder="Name of billing/payment authority" />
                </FormField>
              </div>
              <div className="p-4 rounded-xl bg-green-50 border border-green-100 space-y-2">
                <p className="text-sm font-semibold text-green-800">✅ Ready to Onboard</p>
                <p className="text-xs text-green-600">
                  All 10 sections of the client onboarding form are available. Fill what you have now — you can always edit later.
                  After saving, upload legal documents (PAN, GST, NDA, Contract) via the Documents button.
                </p>
                <div className="text-xs text-green-700 space-y-1 pt-1">
                  <p>• Data stored in admin records & client profile</p>
                  <p>• Designation history tracked automatically</p>
                  <p>• Documents linked to this client's record</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* ── Document Upload Modal ──────────────────────────────────────────── */}
      <Modal
        open={modal === 'docs'}
        onClose={() => setModal(null)}
        title={`Documents — ${target?.companyName}`}
        footer={<button className="btn-secondary" onClick={() => setModal(null)}>Close</button>}
      >
        <ClientDocUpload clientId={target?._id} onDone={() => { setModal(null); load() }} />
      </Modal>

      {/* ── Confirm Deactivate ─────────────────────────────────────────────── */}
      <ConfirmModal
        open={!!delModal}
        onClose={() => setDelModal(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Deactivate Client"
        message={`Are you sure you want to deactivate "${delModal?.companyName}"? This won't delete existing project data.`}
        confirmText="Deactivate"
        variant="danger"
      />

      {/* ── Client Detail Drawer ───────────────────────────────────────────── */}
      {drawerClient && (
        <ClientDetailDrawer
          client={drawerClient}
          onClose={() => setDrawerClient(null)}
          onEdit={() => openEdit(drawerClient)}
        />
      )}
    </div>
  )
}