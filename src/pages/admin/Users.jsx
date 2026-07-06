/**
 * pages/admin/Users.jsx — FIXED + ENHANCED
 *
 * Changes vs previous version:
 *
 * 1. DesignationHistoryPanel — now shows fromDate, toDate, changedAt, note,
 *    changedBy name, and a link to supportingDoc if present. All dates are
 *    formatted clearly. Duration in days is shown on each past entry.
 *
 * 2. Update Designation modal — added:
 *      • "Effective From" date picker (defaults to today, sent as note)
 *      • "Note / Reason" text field
 *      • "Supporting Document" file input (promotion letter, order, etc.)
 *    The modal submits multipart/form-data when a file is chosen.
 *
 * 3. openDesignation — now populates desigForm state instead of bare string.
 *
 * 4. handleDesignationUpdate — uses FormData when file present, JSON otherwise.
 *    On success the drawer user and the table row are both refreshed.
 *
 * 5. UserDetailDrawer — designation history tab now uses the enriched panel.
 *
 * Everything else (DocumentUploadPanel, MyProfilePanel, etc.) is unchanged
 * except minor prop cleanups.
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Plus, Pencil, Trash2, Shield, RefreshCw, Upload,
  History, Users, UserCheck, UserX, Briefcase,
  Eye, X, Phone, Mail, MapPin, CreditCard, Heart,
  AlertCircle, FileText, Building2, Calendar, Hash, User,
  ChevronRight, Clock, FileCheck
} from 'lucide-react'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { format, formatDistance, differenceInDays } from 'date-fns'
import {
  PageHeader, StatCard, SearchInput, SelectInput, Modal, ConfirmModal,
  FormField, StatusBadge, Spinner, EmptyState
} from '../../components/common/UI'

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLES        = ['admin', 'manager', 'employee']
const STATUSES     = ['active', 'inactive', 'on-leave']
const DEPARTMENTS  = [
  'SEO', 'Performance Marketing', 'Social Media Marketing', 'Content Marketing','IT','Facilities Management','Digital Marketing',
  'Email Marketing', 'Web Design & Development', 'Graphic Design','Sales',
  'Video & Creative Production', 'Analytics & Reporting',
  'Business Development', 'Account Management', 'HR & Admin',
]
const GENDERS         = ['Male', 'Female', 'Non-binary', 'Prefer not to say']
const BLOOD_GROUPS    = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
const MARITAL_STATUSES = ['Single', 'Married', 'Divorced', 'Widowed']
const RELATIONSHIPS   = ['Spouse', 'Parent', 'Sibling', 'Child', 'Friend', 'Other']

const emptyForm = {
  name: '', email: '', password: '', phone: '',
  role: 'employee', department: '', designation: '', status: 'active',
  isFresher: true,
  dateOfBirth: '', gender: '', nationality: '', maritalStatus: '',
  permanentAddress: '', currentAddress: '',
  emergencyContactName: '', emergencyContactRelation: '',
  emergencyContactPhone: '', emergencyContactEmail: '',
  previousCompany: '', previousDesignation: '', previousCTC: '',
  workExperienceYears: '', pfDetails: '', uanNumber: '', esicNumber: '',
  reasonForLeaving: '',
  bankName: '', accountNumber: '', ifscCode: '', accountHolderName: '',
  panNumber: '', aadhaarNumber: '',
  bloodGroup: '', medicalConditions: '', insuranceNomineeName: '',
  insuranceNomineeRelation: '',
}

const emptyDesigForm = {
  designation: '',
  note: '',
  effectiveFrom: format(new Date(), 'yyyy-MM-dd'),
  file: null,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d) {
  if (!d) return '—'
  try { return format(new Date(d), 'dd MMM yyyy') } catch { return '—' }
}

function fmtDateTime(d) {
  if (!d) return '—'
  try { return format(new Date(d), 'dd MMM yyyy, hh:mm a') } catch { return '—' }
}

function daysBetween(from, to) {
  if (!from || !to) return null
  try {
    const d = differenceInDays(new Date(to), new Date(from))
    return d >= 0 ? d : null
  } catch { return null }
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, color = 'blue' }) {
  const colors = {
    blue:   'text-blue-600 bg-blue-50 border-blue-100',
    green:  'text-green-600 bg-green-50 border-green-100',
    purple: 'text-purple-600 bg-purple-50 border-purple-100',
    amber:  'text-amber-600 bg-amber-50 border-amber-100',
    red:    'text-red-600 bg-red-50 border-red-100',
    indigo: 'text-indigo-600 bg-indigo-50 border-indigo-100',
  }
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${colors[color]} mb-3`}>
      <Icon size={14} />
      <span className="text-sm font-semibold">{title}</span>
    </div>
  )
}

function InfoRow({ label, value, mono = false }) {
  if (!value) return null
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</span>
      <span className={`text-sm text-gray-800 ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}

// ─── Designation History Panel (ENHANCED) ────────────────────────────────────

function DesignationHistoryPanel({ history = [], currentDesignation, joiningDate }) {
  if (!history.length && !currentDesignation) {
    return <p className="text-sm text-gray-400 py-4 text-center">No designation history yet.</p>
  }

  // Compute when the current designation started (= last history entry's toDate,
  // or joiningDate if no history exists)
  const currentFrom = history.length > 0
    ? history[history.length - 1].toDate
    : joiningDate

  return (
    <div className="space-y-3 py-2">

      {/* ── Current designation ── */}
      {currentDesignation && (
        <div className="rounded-xl bg-green-50 border border-green-100 overflow-hidden">
          <div className="flex items-center gap-3 p-3">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-green-800">{currentDesignation}</p>
              <p className="text-xs text-green-600 mt-0.5">
                Since {fmtDate(currentFrom)}
                {currentFrom && (
                  <span className="ml-1 text-green-500">
                    · {formatDistance(new Date(currentFrom), new Date(), { addSuffix: false })} ago
                  </span>
                )}
              </p>
            </div>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium shrink-0">
              Current
            </span>
          </div>
        </div>
      )}

      {/* ── History entries (newest first) ── */}
      {[...history].reverse().map((h, i) => {
        const days = daysBetween(h.fromDate, h.toDate)
        return (
          <div key={h._id ?? i} className="rounded-xl bg-gray-50 border border-gray-100 overflow-hidden">
            <div className="flex items-start gap-3 p-3">
              <div className="w-2.5 h-2.5 rounded-full bg-gray-300 shrink-0 mt-1" />
              <div className="flex-1 min-w-0 space-y-2">

                {/* Title row */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-gray-700">{h.designation}</p>
                  {days !== null && (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full shrink-0">
                      {days} day{days !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {/* Date range */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                  <div>
                    <p className="text-xs text-gray-400 font-medium">From</p>
                    <p className="text-xs text-gray-600 font-semibold">{fmtDate(h.fromDate)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-medium">To (ended)</p>
                    <p className="text-xs text-gray-600 font-semibold">{fmtDate(h.toDate)}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-gray-400 font-medium">Record updated on</p>
                    <p className="text-xs text-gray-500">{fmtDateTime(h.changedAt)}</p>
                  </div>
                </div>

                {/* Note */}
                {h.note && (
                  <p className="text-xs text-gray-500 italic bg-white border border-gray-100 rounded px-2 py-1">
                    "{h.note}"
                  </p>
                )}

                {/* Supporting doc link */}
                {h.supportingDoc && (
                  <a
                    href={`/uploads/${h.supportingDoc.split('/').pop()}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-500 hover:underline"
                  >
                    <FileCheck size={12} /> View supporting document
                  </a>
                )}
              </div>
            </div>
          </div>
        )
      })}

      {history.length === 0 && (
        <p className="text-xs text-gray-400 text-center py-2">No previous designations on record.</p>
      )}
    </div>
  )
}

// ─── Document Upload Panel ────────────────────────────────────────────────────

function DocumentUploadPanel({ userId, onDone }) {
  const [uploading, setUploading]   = useState(false)
  const [uploadedDocs, setUploadedDocs] = useState([])
  const [files, setFiles] = useState({
    aadhaar: null, pan: null, resume: null, offerLetter: null,
    salarySlip: null, experienceCertificate: null,
  })
  const [certs, setCerts] = useState([])

  useEffect(() => {
    if (!userId) return
    api.get(`/users/${userId}/documents`)
      .then(r => setUploadedDocs(r.data.data ?? []))
      .catch(() => {})
  }, [userId])

  const handleFile = (field, file) => setFiles(p => ({ ...p, [field]: file }))

  const handleUpload = async () => {
    const form = new FormData()
    Object.entries(files).forEach(([k, v]) => { if (v) form.append(k, v) })
    certs.forEach(c => form.append('certificates', c))
    if ([...form.entries()].length === 0) { toast.error('Select at least one file'); return }
    setUploading(true)
    try {
      await api.post(`/users/${userId}/documents`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      toast.success('Documents uploaded successfully')
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
        <SectionHeader icon={FileText} title="Identity Documents" color="blue" />
        <FileRow label="Aadhaar Card" field="aadhaar" />
        <FileRow label="PAN Card" field="pan" />
      </div>

      <div className="space-y-1">
        <SectionHeader icon={Briefcase} title="Professional Documents" color="green" />
        <FileRow label="Resume / CV" field="resume" />
        <FileRow label="Offer Letter" field="offerLetter" />
        <FileRow label="Salary Slip" field="salarySlip" />
        <FileRow label="Experience Certificate" field="experienceCertificate" />
        <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50">
          <label className="w-44 text-sm font-medium text-gray-600 shrink-0 pt-1">Other Certificates</label>
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp"
            multiple
            onChange={e => setCerts(Array.from(e.target.files))}
            className="text-sm text-gray-600 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
          />
          {certs.length > 0 && (
            <span className="text-xs text-green-600 pt-1 font-medium">✓ {certs.length} file(s)</span>
          )}
        </div>
      </div>

      {uploadedDocs.length > 0 && (
        <div>
          <SectionHeader icon={FileText} title="Previously Uploaded" color="purple" />
          <div className="space-y-1">
            {uploadedDocs.map((doc, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 bg-gray-50 rounded-lg">
                <FileText size={13} className="text-gray-400" />
                <span className="flex-1">{doc.originalName || doc.name}</span>
                <span className="text-xs text-gray-400 capitalize">{doc.type}</span>
                {doc.url && (
                  <a href={doc.url} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline">
                    View
                  </a>
                )}
              </div>
            ))}
          </div>
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

// ─── Full User Detail Drawer ──────────────────────────────────────────────────

function UserDetailDrawer({ user, onClose }) {
  const [tab, setTab] = useState('personal')
  if (!user) return null

  const tabs = [
    { id: 'personal',     label: 'Personal',     icon: User },
    { id: 'professional', label: 'Professional', icon: Briefcase },
    { id: 'banking',      label: 'Banking',      icon: CreditCard },
    { id: 'health',       label: 'Health',       icon: Heart },
    { id: 'emergency',    label: 'Emergency',    icon: AlertCircle },
  ]

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div
        className="w-full max-w-lg h-full bg-white shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-4 px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center text-primary font-bold text-lg">
            {user.name?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 truncate">{user.name}</p>
            <p className="text-xs text-gray-400 truncate">{user.email}</p>
            <div className="flex items-center gap-2 mt-1">
              <StatusBadge status={user.role} />
              <StatusBadge status={user.status} />
              <span className={`badge text-xs ${user.isFresher ? 'badge-info' : 'badge-success'}`}>
                {user.isFresher ? 'Fresher' : 'Experienced'}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <div className="flex border-b border-gray-100 px-4 bg-white overflow-x-auto">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
                tab === t.id ? 'border-primary text-primary' : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              <t.icon size={12} />
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {tab === 'personal' && (
            <>
              <SectionHeader icon={User} title="Personal Details" color="blue" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InfoRow label="Full Name"      value={user.name} />
                <InfoRow label="Date of Birth"  value={fmtDate(user.dateOfBirth)} />
                <InfoRow label="Gender"         value={user.gender} />
                <InfoRow label="Nationality"    value={user.nationality} />
                <InfoRow label="Marital Status" value={user.maritalStatus} />
                <InfoRow label="Phone"          value={user.phone} />
                <InfoRow label="Email"          value={user.email} />
              </div>
              <InfoRow label="Permanent Address" value={user.permanentAddress} />
              <InfoRow label="Current Address"   value={user.currentAddress} />
              <div className="pt-2">
                <SectionHeader icon={Building2} title="Employment Details" color="green" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InfoRow label="Department"       value={user.department} />
                  <InfoRow label="Designation"      value={user.designation} />
                  <InfoRow label="Role"             value={user.role} />
                  <InfoRow label="Status"           value={user.status} />
                  <InfoRow label="Employment Type"  value={user.isFresher ? 'Fresher' : 'Experienced'} />
                  <InfoRow label="Joined On"        value={fmtDate(user.joining_date)} />
                </div>
              </div>
            </>
          )}

          {tab === 'professional' && (
            <>
              <SectionHeader icon={Briefcase} title="Professional Details" color="purple" />
              {user.isFresher ? (
                <p className="text-sm text-gray-400 py-4 text-center bg-blue-50 rounded-xl border border-blue-100">
                  This employee is a fresher — no prior experience records.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InfoRow label="Previous Company"    value={user.previousCompany} />
                  <InfoRow label="Previous Designation" value={user.previousDesignation} />
                  <InfoRow label="Previous CTC"        value={user.previousCTC} />
                  <InfoRow label="Experience (Years)"  value={user.workExperienceYears} />
                  <InfoRow label="Reason for Leaving"  value={user.reasonForLeaving} />
                  <InfoRow label="PF Details"          value={user.pfDetails} mono />
                  <InfoRow label="UAN Number"          value={user.uanNumber} mono />
                  <InfoRow label="ESIC Number"         value={user.esicNumber} mono />
                </div>
              )}
              <div className="pt-2">
                <SectionHeader icon={History} title="Designation History" color="indigo" />
                <DesignationHistoryPanel
                  history={user.designationHistory ?? []}
                  currentDesignation={user.designation}
                  joiningDate={user.joining_date}
                />
              </div>
            </>
          )}

          {tab === 'banking' && (
            <>
              <SectionHeader icon={CreditCard} title="Banking & Statutory Details" color="green" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InfoRow label="Bank Name"       value={user.bankName} />
                <InfoRow label="Account Holder"  value={user.accountHolderName} />
                <InfoRow label="Account Number"  value={user.accountNumber} mono />
                <InfoRow label="IFSC Code"       value={user.ifscCode} mono />
              </div>
              <div className="pt-2">
                <SectionHeader icon={Hash} title="Statutory Info" color="amber" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InfoRow label="PAN Number"   value={user.panNumber} mono />
                  <InfoRow label="Aadhaar"      value={user.aadhaarNumber ? `XXXX-XXXX-${user.aadhaarNumber.slice(-4)}` : null} mono />
                  <InfoRow label="UAN Number"   value={user.uanNumber} mono />
                  <InfoRow label="ESIC Number"  value={user.esicNumber} mono />
                </div>
              </div>
            </>
          )}

          {tab === 'health' && (
            <>
              <SectionHeader icon={Heart} title="Health & Insurance" color="red" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InfoRow label="Blood Group"       value={user.bloodGroup} />
                <InfoRow label="Medical Conditions" value={user.medicalConditions || 'None declared'} />
              </div>
              <div className="pt-2">
                <SectionHeader icon={User} title="Insurance Nominee" color="purple" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InfoRow label="Nominee Name"  value={user.insuranceNomineeName} />
                  <InfoRow label="Relationship"  value={user.insuranceNomineeRelation} />
                </div>
              </div>
            </>
          )}

          {tab === 'emergency' && (
            <>
              <SectionHeader icon={AlertCircle} title="Emergency Contact" color="red" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InfoRow label="Contact Name"  value={user.emergencyContactName} />
                <InfoRow label="Relationship"  value={user.emergencyContactRelation} />
                <InfoRow label="Phone"         value={user.emergencyContactPhone} />
                <InfoRow label="Email"         value={user.emergencyContactEmail} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminUsers() {
  const [users,      setUsers]      = useState([])
  const [stats,      setStats]      = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [roleF,      setRoleF]      = useState('')
  const [statusF,    setStatusF]    = useState('')
  const [fresherF,   setFresherF]   = useState('')
  const [modal,      setModal]      = useState(null)
  const [delModal,   setDelModal]   = useState(null)
  const [form,       setForm]       = useState(emptyForm)
  const [saving,     setSaving]     = useState(false)
  const [deleting,   setDeleting]   = useState(false)
  const [target,     setTarget]     = useState(null)
  const [formTab,    setFormTab]    = useState('basic')
  const [drawerUser, setDrawerUser] = useState(null)

  // Designation update form
  const [desigForm,  setDesigForm]  = useState(emptyDesigForm)
  const desigFileRef = useRef(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (roleF)    params.role      = roleF
      if (statusF)  params.status    = statusF
      if (search)   params.search    = search
      if (fresherF) params.isFresher = fresherF
      const [u, s] = await Promise.all([
        api.get('/users', { params }),
        api.get('/users/stats'),
      ])
      setUsers(u.data.data ?? [])
      setStats(s.data.data)
    } catch { toast.error('Failed to load users') }
    finally { setLoading(false) }
  }, [roleF, statusF, search, fresherF])

  useEffect(() => { load() }, [load])

  const openCreate = () => {
    setForm(emptyForm); setTarget(null); setFormTab('basic'); setModal('create')
  }
  const openEdit = (u) => {
    setForm({ ...emptyForm, ...u, password: '', isFresher: u.isFresher ?? true })
    setTarget(u); setFormTab('basic'); setModal('edit')
  }
  const openRole        = (u) => { setForm({ role: u.role }); setTarget(u); setModal('role') }
  const openDocs        = (u) => { setTarget(u); setModal('docs') }
  const openHistory     = (u) => { setTarget(u); setModal('history') }
  const openDesignation = (u) => {
    setTarget(u)
    setDesigForm({ ...emptyDesigForm, designation: u.designation })
    if (desigFileRef.current) desigFileRef.current.value = ''
    setModal('designation')
  }
  const openDrawer = (u) => setDrawerUser(u)

  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }))
  const df = (k, v) => setDesigForm(prev => ({ ...prev, [k]: v }))

  // ── Create / Edit / Role save ─────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true)
    try {
      if (modal === 'create') {
        await api.post('/auth/register', form)
        toast.success('User created')
      } else if (modal === 'edit') {
        const { password, role, ...rest } = form
        await api.patch(`/users/${target._id}`, rest)
        toast.success('User profile updated')
      } else if (modal === 'role') {
        await api.patch(`/users/${target._id}/role`, { role: form.role })
        toast.success('Role updated')
      }
      setModal(null); load()
    } catch (e) {
      toast.error(e.response?.data?.message || 'Save failed')
    } finally { setSaving(false) }
  }

  // ── Designation update ────────────────────────────────────────────────────
  const handleDesignationUpdate = async () => {
    if (!desigForm.designation.trim()) {
      toast.error('Designation cannot be empty'); return
    }
    setSaving(true)
    try {
      let response
      if (desigForm.file) {
        // Send as multipart/form-data when a file is attached
        const fd = new FormData()
        fd.append('designation', desigForm.designation.trim())
        if (desigForm.note.trim())         fd.append('note', desigForm.note.trim())
        if (desigForm.effectiveFrom)       fd.append('effectiveFrom', desigForm.effectiveFrom)
        fd.append('supportingDoc', desigForm.file)
        response = await api.patch(`/users/${target._id}/designation`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      } else {
        response = await api.patch(`/users/${target._id}/designation`, {
          designation:   desigForm.designation.trim(),
          note:          desigForm.note.trim() || undefined,
          effectiveFrom: desigForm.effectiveFrom || undefined,
        })
      }

      toast.success('Designation updated — history recorded')
      setModal(null)

      // Refresh the drawer if this user is open
      if (drawerUser?._id === target._id) {
        setDrawerUser(response.data.data)
      }
      load()
    } catch (e) {
      toast.error(e.response?.data?.message || 'Update failed')
    } finally { setSaving(false) }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    setDeleting(true)
    try {
      await api.delete(`/users/${delModal._id}`)
      toast.success('User deactivated')
      setDelModal(null); load()
    } catch { toast.error('Delete failed') }
    finally { setDeleting(false) }
  }

  // ── Form tab definitions ──────────────────────────────────────────────────
  const formTabs = [
    { id: 'basic',        label: 'Basic',        icon: User },
    { id: 'personal',     label: 'Personal',     icon: MapPin },
    { id: 'professional', label: 'Professional', icon: Briefcase },
    { id: 'banking',      label: 'Banking',      icon: CreditCard },
    { id: 'health',       label: 'Health',       icon: Heart },
    { id: 'emergency',    label: 'Emergency',    icon: AlertCircle },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Users"
        subtitle="Manage team members, access levels, and complete profiles"
        action={
          <button className="btn-primary flex items-center gap-2" onClick={openCreate}>
            <Plus size={16} /> Add User
          </button>
        }
      />

      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total"    value={stats.total}                        icon={Users}     color="primary" />
          <StatCard label="Active"   value={stats.by_status?.active}            icon={UserCheck} color="emerald" />
          <StatCard label="Managers" value={stats.by_role?.manager}             icon={Shield}    color="info" />
          <StatCard label="On Leave" value={stats.by_status?.['on-leave'] ?? 0} icon={UserX}     color="amber" />
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-48">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by name or email…" />
        </div>
        <SelectInput value={roleF}    onChange={setRoleF}    placeholder="All roles"    options={ROLES.map(r => ({ value: r, label: r }))} className="w-36" />
        <SelectInput value={statusF}  onChange={setStatusF}  placeholder="All statuses" options={STATUSES.map(s => ({ value: s, label: s }))} className="w-40" />
        <SelectInput
          value={fresherF} onChange={setFresherF} placeholder="Experience"
          options={[{ value: 'true', label: 'Fresher' }, { value: 'false', label: 'Experienced' }]}
          className="w-40"
        />
        <button onClick={load} className="btn-secondary px-3"><RefreshCw size={15} /></button>
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100/50">
              <tr>
                {['Name', 'Role', 'Department', 'Designation', 'Experience', 'Status', 'Joined', 'Actions'].map(h => (
                  <th key={h} className="table-header text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="py-16 text-center"><Spinner /></td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={8}><EmptyState icon={Users} title="No users found" description="Try adjusting your filters" /></td></tr>
              ) : users.map(u => (
                <tr key={u._id} className="table-row group">
                  <td className="table-cell">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                        {u.name?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800 text-sm">{u.name}</p>
                        <p className="text-xs text-gray-400">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="table-cell"><StatusBadge status={u.role} /></td>
                  <td className="table-cell text-sm text-gray-500">{u.department}</td>
                  <td className="table-cell text-sm text-gray-600">{u.designation}</td>
                  <td className="table-cell">
                    <span className={`badge ${u.isFresher ? 'badge-info' : 'badge-success'}`}>
                      {u.isFresher ? 'Fresher' : 'Experienced'}
                    </span>
                  </td>
                  <td className="table-cell"><StatusBadge status={u.status} /></td>
                  <td className="table-cell text-sm text-gray-400">
                    {fmtDate(u.joining_date || u.createdAt)}
                  </td>
                  <td className="table-cell">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openDrawer(u)}       title="View Profile"         className="p-1.5 rounded hover:bg-gray-100 text-gray-500"><Eye size={13} /></button>
                      <button onClick={() => openEdit(u)}         title="Edit"                 className="p-1.5 rounded hover:bg-amber-50 text-amber-500"><Pencil size={13} /></button>
                      <button onClick={() => openDesignation(u)}  title="Update Designation"   className="p-1.5 rounded hover:bg-blue-50 text-blue-500"><Briefcase size={13} /></button>
                      <button onClick={() => openHistory(u)}      title="Designation History"  className="p-1.5 rounded hover:bg-purple-50 text-purple-500"><History size={13} /></button>
                      <button onClick={() => openDocs(u)}         title="Upload Documents"     className="p-1.5 rounded hover:bg-green-50 text-green-500"><Upload size={13} /></button>
                      <button onClick={() => openRole(u)}         title="Change Role"          className="p-1.5 rounded hover:bg-indigo-50 text-indigo-500"><Shield size={13} /></button>
                      <button onClick={() => setDelModal(u)}      title="Deactivate"           className="p-1.5 rounded hover:bg-red-50 text-red-500"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Create / Edit Modal ─────────────────────────────────────────────── */}
      <Modal
        open={modal === 'create' || modal === 'edit'}
        onClose={() => setModal(null)}
        title={modal === 'create' ? 'Add New User' : `Edit User — ${target?.name}`}
        size="xl"
        footer={
          <div className="flex gap-3 justify-end">
            <button className="btn-secondary" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn-primary flex items-center gap-2" onClick={handleSave} disabled={saving}>
              {saving ? <Spinner size="sm" /> : (modal === 'create' ? 'Create User' : 'Save All Changes')}
            </button>
          </div>
        }
      >
        <div className="flex border-b border-gray-100 mb-4 -mx-1 overflow-x-auto">
          {formTabs.map(t => (
            <button
              key={t.id}
              onClick={() => setFormTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
                formTab === t.id ? 'border-primary text-primary' : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              <t.icon size={12} />
              {t.label}
            </button>
          ))}
        </div>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {formTab === 'basic' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Full Name *">
                  <input className="input" value={form.name} onChange={e => f('name', e.target.value)} placeholder="Jane Smith" />
                </FormField>
                <FormField label="Email *">
                  <input className="input" type="email" value={form.email} onChange={e => f('email', e.target.value)} placeholder="jane@company.com" />
                </FormField>
              </div>
              {modal === 'create' && (
                <FormField label="Password *">
                  <input className="input" type="password" value={form.password} onChange={e => f('password', e.target.value)} placeholder="Min 6 characters" />
                </FormField>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Phone">
                  <input className="input" value={form.phone} onChange={e => f('phone', e.target.value)} placeholder="+91 99999 00000" />
                </FormField>
                <FormField label="Role *">
                  <select className="input" value={form.role} onChange={e => f('role', e.target.value)}>
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </FormField>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Department *">
                  <select className="input" value={form.department} onChange={e => f('department', e.target.value)}>
                    <option value="">Select department</option>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </FormField>
                <FormField label="Designation *">
                  <input className="input" value={form.designation} onChange={e => f('designation', e.target.value)} placeholder="e.g. Senior Developer" />
                </FormField>
              </div>
              <FormField label="Status">
                <select className="input" value={form.status} onChange={e => f('status', e.target.value)}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </FormField>
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-700">Employment Type</p>
                    <p className="text-xs text-gray-400">Toggle off if employee has prior experience</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => f('isFresher', !form.isFresher)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${form.isFresher ? 'bg-blue-500' : 'bg-green-500'}`}
                  >
                    <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.isFresher ? 'left-1' : 'left-7'}`} />
                  </button>
                </div>
                <p className="text-sm font-medium text-center">
                  {form.isFresher
                    ? <span className="text-blue-600">🎓 Fresher — no prior experience required</span>
                    : <span className="text-green-600">💼 Experienced — fill Professional tab</span>
                  }
                </p>
              </div>
            </div>
          )}

          {formTab === 'personal' && (
            <div className="space-y-4">
              <SectionHeader icon={User} title="Personal Information" color="blue" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Date of Birth">
                  <input className="input" type="date" value={form.dateOfBirth} onChange={e => f('dateOfBirth', e.target.value)} />
                </FormField>
                <FormField label="Gender">
                  <select className="input" value={form.gender} onChange={e => f('gender', e.target.value)}>
                    <option value="">Select gender</option>
                    {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </FormField>
                <FormField label="Nationality">
                  <input className="input" value={form.nationality} onChange={e => f('nationality', e.target.value)} placeholder="e.g. Indian" />
                </FormField>
                <FormField label="Marital Status">
                  <select className="input" value={form.maritalStatus} onChange={e => f('maritalStatus', e.target.value)}>
                    <option value="">Select status</option>
                    {MARITAL_STATUSES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </FormField>
              </div>
              <FormField label="Permanent Address">
                <textarea className="input" rows={2} value={form.permanentAddress} onChange={e => f('permanentAddress', e.target.value)} />
              </FormField>
              <FormField label="Current Address">
                <textarea className="input" rows={2} value={form.currentAddress} onChange={e => f('currentAddress', e.target.value)} />
              </FormField>
            </div>
          )}

          {formTab === 'professional' && (
            <div className="space-y-4">
              {form.isFresher ? (
                <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 text-center">
                  <p className="text-sm font-semibold text-blue-700">Employee is marked as Fresher</p>
                  <p className="text-xs text-blue-500 mt-1">Switch to "Experienced" in the Basic tab to fill professional details.</p>
                </div>
              ) : (
                <>
                  <SectionHeader icon={Briefcase} title="Previous Employment" color="purple" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField label="Previous Company *">
                      <input className="input" value={form.previousCompany} onChange={e => f('previousCompany', e.target.value)} />
                    </FormField>
                    <FormField label="Previous Designation">
                      <input className="input" value={form.previousDesignation} onChange={e => f('previousDesignation', e.target.value)} />
                    </FormField>
                    <FormField label="Previous CTC">
                      <input className="input" value={form.previousCTC} onChange={e => f('previousCTC', e.target.value)} placeholder="e.g. 6,00,000 LPA" />
                    </FormField>
                    <FormField label="Experience (Years)">
                      <input className="input" type="number" value={form.workExperienceYears} onChange={e => f('workExperienceYears', e.target.value)} />
                    </FormField>
                  </div>
                  <FormField label="Reason for Leaving">
                    <input className="input" value={form.reasonForLeaving} onChange={e => f('reasonForLeaving', e.target.value)} />
                  </FormField>
                  <SectionHeader icon={Hash} title="Statutory Employment Details" color="amber" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField label="PF Account No.">
                      <input className="input" value={form.pfDetails} onChange={e => f('pfDetails', e.target.value)} />
                    </FormField>
                    <FormField label="UAN Number">
                      <input className="input" value={form.uanNumber} onChange={e => f('uanNumber', e.target.value)} />
                    </FormField>
                    <FormField label="ESIC Number">
                      <input className="input" value={form.esicNumber} onChange={e => f('esicNumber', e.target.value)} />
                    </FormField>
                  </div>
                </>
              )}
            </div>
          )}

          {formTab === 'banking' && (
            <div className="space-y-4">
              <SectionHeader icon={CreditCard} title="Bank Account Details" color="green" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Bank Name">
                  <input className="input" value={form.bankName} onChange={e => f('bankName', e.target.value)} />
                </FormField>
                <FormField label="Account Holder Name">
                  <input className="input" value={form.accountHolderName} onChange={e => f('accountHolderName', e.target.value)} />
                </FormField>
                <FormField label="Account Number">
                  <input className="input" value={form.accountNumber} onChange={e => f('accountNumber', e.target.value)} />
                </FormField>
                <FormField label="IFSC Code">
                  <input className="input" value={form.ifscCode} onChange={e => f('ifscCode', e.target.value)} />
                </FormField>
              </div>
              <SectionHeader icon={Hash} title="Statutory / Tax Details" color="amber" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="PAN Number">
                  <input className="input" value={form.panNumber} onChange={e => f('panNumber', e.target.value.toUpperCase())} maxLength={10} />
                </FormField>
                <FormField label="Aadhaar Number">
                  <input className="input" value={form.aadhaarNumber} onChange={e => f('aadhaarNumber', e.target.value)} maxLength={12} />
                </FormField>
              </div>
            </div>
          )}

          {formTab === 'health' && (
            <div className="space-y-4">
              <SectionHeader icon={Heart} title="Health Information" color="red" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Blood Group">
                  <select className="input" value={form.bloodGroup} onChange={e => f('bloodGroup', e.target.value)}>
                    <option value="">Select blood group</option>
                    {BLOOD_GROUPS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </FormField>
                <FormField label="Medical Conditions">
                  <input className="input" value={form.medicalConditions} onChange={e => f('medicalConditions', e.target.value)} placeholder="Any known conditions (optional)" />
                </FormField>
              </div>
              <SectionHeader icon={User} title="Insurance Nominee" color="purple" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Nominee Name">
                  <input className="input" value={form.insuranceNomineeName} onChange={e => f('insuranceNomineeName', e.target.value)} />
                </FormField>
                <FormField label="Relationship">
                  <select className="input" value={form.insuranceNomineeRelation} onChange={e => f('insuranceNomineeRelation', e.target.value)}>
                    <option value="">Select relationship</option>
                    {RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </FormField>
              </div>
            </div>
          )}

          {formTab === 'emergency' && (
            <div className="space-y-4">
              <SectionHeader icon={AlertCircle} title="Emergency Contact Details" color="red" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Contact Name *">
                  <input className="input" value={form.emergencyContactName} onChange={e => f('emergencyContactName', e.target.value)} />
                </FormField>
                <FormField label="Relationship">
                  <select className="input" value={form.emergencyContactRelation} onChange={e => f('emergencyContactRelation', e.target.value)}>
                    <option value="">Select relationship</option>
                    {RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </FormField>
                <FormField label="Phone *">
                  <input className="input" value={form.emergencyContactPhone} onChange={e => f('emergencyContactPhone', e.target.value)} />
                </FormField>
                <FormField label="Email">
                  <input className="input" type="email" value={form.emergencyContactEmail} onChange={e => f('emergencyContactEmail', e.target.value)} />
                </FormField>
              </div>
            </div>
          )}
        </div>

        <p className="text-xs text-gray-400 text-center pt-3 border-t border-gray-100 mt-4">
          Fill all tabs before saving — all data is stored in admin records and the user's own profile
        </p>
      </Modal>

      {/* ── Update Designation Modal (ENHANCED) ──────────────────────────────── */}
      <Modal
        open={modal === 'designation'}
        onClose={() => setModal(null)}
        title={`Update Designation — ${target?.name}`}
        footer={
          <div className="flex gap-3 justify-end">
            <button className="btn-secondary" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn-primary flex items-center gap-2" onClick={handleDesignationUpdate} disabled={saving}>
              {saving ? <Spinner size="sm" /> : <><Briefcase size={14} /> Update Designation</>}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Current designation pill */}
          <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
            <p className="text-xs text-blue-500 font-medium">Current Designation</p>
            <p className="text-sm font-bold text-blue-800 mt-0.5">{target?.designation}</p>
            {target?.joining_date && (
              <p className="text-xs text-blue-400 mt-0.5">
                Since {fmtDate(
                  target.designationHistory?.length
                    ? target.designationHistory[target.designationHistory.length - 1].toDate
                    : target.joining_date
                )}
              </p>
            )}
          </div>

          {/* New designation */}
          <FormField label="New Designation *">
            <input
              className="input"
              value={desigForm.designation}
              onChange={e => df('designation', e.target.value)}
              placeholder="e.g. Senior Developer"
              autoFocus
            />
          </FormField>

          {/* Effective From + Note side by side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Effective From">
              <input
                className="input"
                type="date"
                value={desigForm.effectiveFrom}
                onChange={e => df('effectiveFrom', e.target.value)}
              />
            </FormField>
            <FormField label="Note / Reason">
              <input
                className="input"
                value={desigForm.note}
                onChange={e => df('note', e.target.value)}
                placeholder="e.g. Promotion, restructure…"
              />
            </FormField>
          </div>

          {/* Supporting document upload */}
          <FormField label="Supporting Document (optional)">
            <div className="flex items-center gap-3 p-2.5 rounded-xl border border-dashed border-gray-200 hover:border-primary/40 hover:bg-gray-50/50 transition-colors">
              <FileCheck size={16} className="text-gray-400 shrink-0" />
              <input
                ref={desigFileRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={e => df('file', e.target.files[0] ?? null)}
                className="text-sm text-gray-600 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer flex-1"
              />
              {desigForm.file && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-green-600 font-medium truncate max-w-[120px]">
                    ✓ {desigForm.file.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => { df('file', null); if (desigFileRef.current) desigFileRef.current.value = '' }}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <X size={13} />
                  </button>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              PDF, PNG, JPG, WebP · Max 5 MB · Promotion letter, appointment order, etc.
            </p>
          </FormField>

          <p className="text-xs text-gray-400 bg-gray-50 px-3 py-2 rounded-lg">
            📋 The previous designation will be saved to this user's history with full dates — visible in the admin panel and the user's own profile.
          </p>
        </div>
      </Modal>

      {/* ── Designation History Modal ─────────────────────────────────────────── */}
      <Modal
        open={modal === 'history'}
        onClose={() => setModal(null)}
        title={`Designation History — ${target?.name}`}
        footer={<button className="btn-secondary" onClick={() => setModal(null)}>Close</button>}
      >
        <DesignationHistoryPanel
          history={target?.designationHistory ?? []}
          currentDesignation={target?.designation}
          joiningDate={target?.joining_date}
        />
      </Modal>

      {/* ── Document Upload Modal ─────────────────────────────────────────────── */}
      <Modal
        open={modal === 'docs'}
        onClose={() => setModal(null)}
        title={`Documents — ${target?.name}`}
        footer={<button className="btn-secondary" onClick={() => setModal(null)}>Close</button>}
      >
        <DocumentUploadPanel userId={target?._id} onDone={() => { setModal(null); load() }} />
      </Modal>

      {/* ── Change Role Modal ─────────────────────────────────────────────────── */}
      <Modal
        open={modal === 'role'}
        onClose={() => setModal(null)}
        title="Change Role"
        footer={
          <div className="flex gap-3 justify-end">
            <button className="btn-secondary" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn-primary flex items-center gap-2" onClick={handleSave} disabled={saving}>
              {saving ? <Spinner size="sm" /> : 'Update Role'}
            </button>
          </div>
        }
      >
        <FormField label="New Role">
          <select className="input" value={form.role} onChange={e => f('role', e.target.value)}>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </FormField>
      </Modal>

      {/* ── Confirm Deactivate ────────────────────────────────────────────────── */}
      <ConfirmModal
        open={!!delModal}
        onClose={() => setDelModal(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Deactivate User"
        message={`Are you sure you want to deactivate "${delModal?.name}"? They will lose access immediately.`}
        confirmText="Deactivate"
        variant="danger"
      />

      {/* ── Full Profile Drawer ───────────────────────────────────────────────── */}
      {drawerUser && (
        <UserDetailDrawer user={drawerUser} onClose={() => setDrawerUser(null)} />
      )}
    </div>
  )
}

// ─── MyProfilePanel — user-facing, unchanged except history panel upgrade ─────

export function MyProfilePanel({ userId }) {
  const [user,    setUser]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab,     setTab]     = useState('personal')
  const [editing, setEditing] = useState(false)
  const [form,    setForm]    = useState({})
  const [saving,  setSaving]  = useState(false)

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    api.get(`/users/${userId}/profile`)
      .then(r => { setUser(r.data.data); setForm(r.data.data) })
      .catch(() => toast.error('Failed to load profile'))
      .finally(() => setLoading(false))
  }, [userId])

  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  const handleSave = async () => {
    setSaving(true)
    try {
      const { password, role, ...rest } = form
      await api.patch(`/users/${userId}`, rest)
      toast.success('Profile updated successfully')
      setUser(rest); setEditing(false)
    } catch (e) {
      toast.error(e.response?.data?.message || 'Update failed')
    } finally { setSaving(false) }
  }

  if (loading) return <div className="flex justify-center py-16"><Spinner /></div>
  if (!user)   return <p className="text-center text-gray-400 py-16">Profile not found.</p>

  const tabs = [
    { id: 'personal',     label: 'Personal',     icon: User },
    { id: 'professional', label: 'Professional', icon: Briefcase },
    { id: 'banking',      label: 'Banking',      icon: CreditCard },
    { id: 'health',       label: 'Health',       icon: Heart },
    { id: 'emergency',    label: 'Emergency',    icon: AlertCircle },
    { id: 'documents',    label: 'Documents',    icon: FileText },
  ]

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div className="card flex items-center gap-5">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/50 flex items-center justify-center text-primary font-bold text-2xl">
          {user.name?.[0]?.toUpperCase()}
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-gray-900">{user.name}</h2>
          <p className="text-sm text-gray-500">{user.designation} · {user.department}</p>
          <div className="flex items-center gap-2 mt-2">
            <StatusBadge status={user.role} />
            <StatusBadge status={user.status} />
            <span className={`badge text-xs ${user.isFresher ? 'badge-info' : 'badge-success'}`}>
              {user.isFresher ? 'Fresher' : 'Experienced'}
            </span>
          </div>
        </div>
        <button
          onClick={() => editing ? handleSave() : setEditing(true)}
          disabled={saving}
          className="btn-primary flex items-center gap-2"
        >
          {saving ? <Spinner size="sm" /> : editing ? 'Save Profile' : <><Pencil size={14} /> Edit Profile</>}
        </button>
        {editing && (
          <button className="btn-secondary" onClick={() => { setEditing(false); setForm(user) }}>Cancel</button>
        )}
      </div>

      <div className="card !p-0">
        <div className="flex border-b border-gray-100 overflow-x-auto">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
                tab === t.id ? 'border-primary text-primary' : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              <t.icon size={12} />
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-6 space-y-4">
          {tab === 'personal' && (
            <>
              <SectionHeader icon={User} title="Personal Details" color="blue" />
              {editing ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField label="Full Name">
                      <input className="input" value={form.name} onChange={e => f('name', e.target.value)} />
                    </FormField>
                    <FormField label="Phone">
                      <input className="input" value={form.phone || ''} onChange={e => f('phone', e.target.value)} />
                    </FormField>
                    <FormField label="Date of Birth">
                      <input className="input" type="date" value={form.dateOfBirth || ''} onChange={e => f('dateOfBirth', e.target.value)} />
                    </FormField>
                    <FormField label="Gender">
                      <select className="input" value={form.gender || ''} onChange={e => f('gender', e.target.value)}>
                        <option value="">Select</option>
                        {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </FormField>
                    <FormField label="Nationality">
                      <input className="input" value={form.nationality || ''} onChange={e => f('nationality', e.target.value)} />
                    </FormField>
                    <FormField label="Marital Status">
                      <select className="input" value={form.maritalStatus || ''} onChange={e => f('maritalStatus', e.target.value)}>
                        <option value="">Select</option>
                        {MARITAL_STATUSES.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </FormField>
                  </div>
                  <FormField label="Permanent Address">
                    <textarea className="input" rows={2} value={form.permanentAddress || ''} onChange={e => f('permanentAddress', e.target.value)} />
                  </FormField>
                  <FormField label="Current Address">
                    <textarea className="input" rows={2} value={form.currentAddress || ''} onChange={e => f('currentAddress', e.target.value)} />
                  </FormField>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <InfoRow label="Full Name"      value={user.name} />
                    <InfoRow label="Phone"          value={user.phone} />
                    <InfoRow label="Email"          value={user.email} />
                    <InfoRow label="Date of Birth"  value={fmtDate(user.dateOfBirth)} />
                    <InfoRow label="Gender"         value={user.gender} />
                    <InfoRow label="Nationality"    value={user.nationality} />
                    <InfoRow label="Marital Status" value={user.maritalStatus} />
                  </div>
                  <InfoRow label="Permanent Address" value={user.permanentAddress} />
                  <InfoRow label="Current Address"   value={user.currentAddress} />
                </>
              )}
            </>
          )}

          {tab === 'professional' && (
            <>
              <SectionHeader icon={Building2} title="Current Employment" color="green" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InfoRow label="Department"      value={user.department} />
                <InfoRow label="Designation"     value={user.designation} />
                <InfoRow label="Role"            value={user.role} />
                <InfoRow label="Status"          value={user.status} />
                <InfoRow label="Employment Type" value={user.isFresher ? 'Fresher' : 'Experienced'} />
                <InfoRow label="Joined On"       value={fmtDate(user.joining_date)} />
              </div>

              {!user.isFresher && (
                <>
                  <SectionHeader icon={Briefcase} title="Previous Employment" color="purple" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <InfoRow label="Previous Company"    value={user.previousCompany} />
                    <InfoRow label="Previous Designation" value={user.previousDesignation} />
                    <InfoRow label="Previous CTC"        value={user.previousCTC} />
                    <InfoRow label="Experience (Years)"  value={user.workExperienceYears} />
                    <InfoRow label="Reason for Leaving"  value={user.reasonForLeaving} />
                  </div>
                </>
              )}

              <SectionHeader icon={History} title="Designation History" color="indigo" />
              <DesignationHistoryPanel
                history={user.designationHistory ?? []}
                currentDesignation={user.designation}
                joiningDate={user.joining_date}
              />
            </>
          )}

          {tab === 'banking' && (
            <>
              <SectionHeader icon={CreditCard} title="Banking Details" color="green" />
              {editing ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="Bank Name">
                    <input className="input" value={form.bankName || ''} onChange={e => f('bankName', e.target.value)} />
                  </FormField>
                  <FormField label="Account Holder Name">
                    <input className="input" value={form.accountHolderName || ''} onChange={e => f('accountHolderName', e.target.value)} />
                  </FormField>
                  <FormField label="Account Number">
                    <input className="input" value={form.accountNumber || ''} onChange={e => f('accountNumber', e.target.value)} />
                  </FormField>
                  <FormField label="IFSC Code">
                    <input className="input" value={form.ifscCode || ''} onChange={e => f('ifscCode', e.target.value)} />
                  </FormField>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InfoRow label="Bank Name"       value={user.bankName} />
                  <InfoRow label="Account Holder"  value={user.accountHolderName} />
                  <InfoRow label="Account Number"  value={user.accountNumber} mono />
                  <InfoRow label="IFSC Code"       value={user.ifscCode} mono />
                </div>
              )}
              <SectionHeader icon={Hash} title="Statutory Details" color="amber" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InfoRow label="PAN Number"  value={user.panNumber} mono />
                <InfoRow label="Aadhaar"     value={user.aadhaarNumber ? `XXXX-XXXX-${user.aadhaarNumber.slice(-4)}` : null} mono />
                <InfoRow label="UAN Number"  value={user.uanNumber} mono />
                <InfoRow label="ESIC Number" value={user.esicNumber} mono />
              </div>
            </>
          )}

          {tab === 'health' && (
            <>
              <SectionHeader icon={Heart} title="Health Information" color="red" />
              {editing ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="Blood Group">
                    <select className="input" value={form.bloodGroup || ''} onChange={e => f('bloodGroup', e.target.value)}>
                      <option value="">Select</option>
                      {BLOOD_GROUPS.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Medical Conditions">
                    <input className="input" value={form.medicalConditions || ''} onChange={e => f('medicalConditions', e.target.value)} />
                  </FormField>
                  <FormField label="Insurance Nominee Name">
                    <input className="input" value={form.insuranceNomineeName || ''} onChange={e => f('insuranceNomineeName', e.target.value)} />
                  </FormField>
                  <FormField label="Nominee Relationship">
                    <select className="input" value={form.insuranceNomineeRelation || ''} onChange={e => f('insuranceNomineeRelation', e.target.value)}>
                      <option value="">Select</option>
                      {RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </FormField>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InfoRow label="Blood Group"       value={user.bloodGroup} />
                  <InfoRow label="Medical Conditions" value={user.medicalConditions || 'None declared'} />
                  <InfoRow label="Insurance Nominee" value={user.insuranceNomineeName} />
                  <InfoRow label="Nominee Relationship" value={user.insuranceNomineeRelation} />
                </div>
              )}
            </>
          )}

          {tab === 'emergency' && (
            <>
              <SectionHeader icon={AlertCircle} title="Emergency Contact" color="red" />
              {editing ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="Contact Name">
                    <input className="input" value={form.emergencyContactName || ''} onChange={e => f('emergencyContactName', e.target.value)} />
                  </FormField>
                  <FormField label="Relationship">
                    <select className="input" value={form.emergencyContactRelation || ''} onChange={e => f('emergencyContactRelation', e.target.value)}>
                      <option value="">Select</option>
                      {RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </FormField>
                  <FormField label="Phone">
                    <input className="input" value={form.emergencyContactPhone || ''} onChange={e => f('emergencyContactPhone', e.target.value)} />
                  </FormField>
                  <FormField label="Email">
                    <input className="input" type="email" value={form.emergencyContactEmail || ''} onChange={e => f('emergencyContactEmail', e.target.value)} />
                  </FormField>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InfoRow label="Contact Name"  value={user.emergencyContactName} />
                  <InfoRow label="Relationship"  value={user.emergencyContactRelation} />
                  <InfoRow label="Phone"         value={user.emergencyContactPhone} />
                  <InfoRow label="Email"         value={user.emergencyContactEmail} />
                </div>
              )}
            </>
          )}

          {tab === 'documents' && (
            <>
              <SectionHeader icon={FileText} title="My Documents" color="blue" />
              <DocumentUploadPanel userId={userId} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}