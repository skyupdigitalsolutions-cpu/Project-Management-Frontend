/**
 * Profile.jsx — read-only profile with tabbed sections.
 *
 * - Profile is FULLY read-only; all personal fields are display-only.
 * - Tab navigation: Personal, Professional, Banking, Health, Emergency, Security.
 * - Security tab is the ONLY editable section (Change Password).
 * - Sensitive fields masked: Aadhaar shows last 4 digits only.
 */

import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import {
  User, Mail, Phone, Briefcase, Building, Calendar,
  Lock, Eye, EyeOff, CreditCard, Heart, AlertCircle,
  FileText, Hash, MapPin, Shield
} from 'lucide-react'
import { PageHeader, FormField, Spinner, StatusBadge } from '../components/common/UI'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d) {
  if (!d) return '—'
  try { return format(new Date(d), 'dd MMM yyyy') } catch { return '—' }
}

// ─── Reusable read-only row ───────────────────────────────────────────────────

function InfoRow({ label, value, mono = false }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</span>
      <span className={`text-sm text-gray-800 ${mono ? 'font-mono' : ''}`}>{value || '—'}</span>
    </div>
  )
}

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

// ─── Main Profile Page ────────────────────────────────────────────────────────

export default function Profile() {
  const { user: authUser } = useAuth()

  // The auth-context user is typically a thin object from login.
  // Fetch the full record so every tab has its data; fall back to context.
  const [user,     setUser]     = useState(authUser)
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    let active = true
    if (!authUser?._id) { setLoading(false); return }
    ;(async () => {
      try {
        const { data } = await api.get(`/users/${authUser._id}/profile`)
        if (active && data?.data) setUser(data.data)
      } catch {
        if (active) setUser(authUser)   // silent fallback
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [authUser?._id])

  const [tab,      setTab]      = useState('personal')
  const [pwForm,   setPwForm]   = useState({ current_password: '', new_password: '', confirm: '' })
  const [savingPw, setSavingPw] = useState(false)
  const [showPw,   setShowPw]   = useState(false)

  const handleChangePassword = async () => {
    if (!pwForm.current_password)              { toast.error('Current password is required'); return }
    if (pwForm.new_password.length < 6)        { toast.error('New password must be at least 6 characters'); return }
    if (pwForm.new_password !== pwForm.confirm) { toast.error('Passwords do not match'); return }
    setSavingPw(true)
    try {
      await api.patch('/auth/change-password', {
        current_password: pwForm.current_password,
        new_password:     pwForm.new_password,
      })
      toast.success('Password changed successfully!')
      setPwForm({ current_password: '', new_password: '', confirm: '' })
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to change password')
    } finally { setSavingPw(false) }
  }

  const ROLE_COLOR = {
    admin:    'bg-purple-50 text-primary border-primary/30',
    manager:  'bg-emerald-600/20 text-emerald-300 border-emerald-500/30',
    employee: 'bg-amber-600/20 text-amber-300 border-amber-500/30',
  }

  const tabs = [
    { id: 'personal',     label: 'Personal',     icon: User },
    { id: 'professional', label: 'Professional', icon: Briefcase },
    { id: 'banking',      label: 'Banking',      icon: CreditCard },
    { id: 'health',       label: 'Health',       icon: Heart },
    { id: 'emergency',    label: 'Emergency',    icon: AlertCircle },
    { id: 'security',     label: 'Security',     icon: Shield },
  ]

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <PageHeader
        title="My Profile"
        subtitle="View your personal information. Contact your admin to make changes."
      />

      {/* Profile header card */}
      <div className="card flex items-center gap-5 flex-wrap">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-3xl flex-shrink-0">
          {user?.name?.charAt(0)?.toUpperCase()}
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-gray-800">{user?.name}</h2>
          <p className="text-neutral mt-0.5">{user?.email}</p>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className={`badge border ${ROLE_COLOR[user?.role] ?? ''}`}>{user?.role}</span>
            <StatusBadge status={user?.status} />
            {user?.joining_date && (
              <span className="text-[13px] text-neutral font-mono">
                Joined {fmtDate(user.joining_date)}
              </span>
            )}
          </div>
        </div>
        {/* Read-only notice */}
        <div className="px-3 py-2 rounded-lg bg-blue-50 border border-blue-100 text-xs text-blue-600 font-medium flex items-center gap-2">
          {loading && <Spinner size="sm" />}
          🔒 Read-only — contact admin to update
        </div>
      </div>

      {/* Tabs */}
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

        <div className="p-6 space-y-5">

          {/* ── Personal ── */}
          {tab === 'personal' && (
            <>
              <SectionHeader icon={User} title="Personal Information" color="blue" />
              <div className="grid grid-cols-2 gap-5">
                <InfoRow label="Full Name"      value={user?.name} />
                <InfoRow label="Email"          value={user?.email} />
                <InfoRow label="Phone"          value={user?.phone} />
                <InfoRow label="Date of Birth"  value={fmtDate(user?.dateOfBirth)} />
                <InfoRow label="Gender"         value={user?.gender} />
                <InfoRow label="Nationality"    value={user?.nationality} />
                <InfoRow label="Marital Status" value={user?.maritalStatus} />
              </div>
              {user?.permanentAddress && (
                <InfoRow label="Permanent Address" value={user.permanentAddress} />
              )}
              {user?.currentAddress && (
                <InfoRow label="Current Address" value={user.currentAddress} />
              )}

              <SectionHeader icon={Building} title="Employment Details" color="green" />
              <div className="grid grid-cols-2 gap-5">
                <InfoRow label="Department"       value={user?.department} />
                <InfoRow label="Designation"      value={user?.designation} />
                <InfoRow label="Role"             value={user?.role} />
                <InfoRow label="Status"           value={user?.status} />
                <InfoRow label="Employment Type"  value={user?.isFresher ? 'Fresher' : 'Experienced'} />
                <InfoRow label="Joined On"        value={fmtDate(user?.joining_date)} />
              </div>
            </>
          )}

          {/* ── Professional ── */}
          {tab === 'professional' && (
            <>
              {user?.isFresher ? (
                <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 text-center">
                  <p className="text-sm font-semibold text-blue-700">You are marked as a Fresher</p>
                  <p className="text-xs text-blue-500 mt-1">No prior employment records on file.</p>
                </div>
              ) : (
                <>
                  <SectionHeader icon={Briefcase} title="Previous Employment" color="purple" />
                  <div className="grid grid-cols-2 gap-5">
                    <InfoRow label="Previous Company"     value={user?.previousCompany} />
                    <InfoRow label="Previous Designation" value={user?.previousDesignation} />
                    <InfoRow label="Previous CTC"         value={user?.previousCTC} />
                    <InfoRow label="Experience (Years)"   value={user?.workExperienceYears} />
                    <InfoRow label="Reason for Leaving"   value={user?.reasonForLeaving} />
                    <InfoRow label="PF Details"           value={user?.pfDetails} mono />
                    <InfoRow label="UAN Number"           value={user?.uanNumber} mono />
                    <InfoRow label="ESIC Number"          value={user?.esicNumber} mono />
                  </div>
                </>
              )}
            </>
          )}

          {/* ── Banking ── */}
          {tab === 'banking' && (
            <>
              <SectionHeader icon={CreditCard} title="Bank Account Details" color="green" />
              <div className="grid grid-cols-2 gap-5">
                <InfoRow label="Bank Name"      value={user?.bankName} />
                <InfoRow label="Account Holder" value={user?.accountHolderName} />
                <InfoRow label="Account Number" value={user?.accountNumber} mono />
                <InfoRow label="IFSC Code"      value={user?.ifscCode} mono />
              </div>
              <SectionHeader icon={Hash} title="Statutory / Tax Details" color="amber" />
              <div className="grid grid-cols-2 gap-5">
                <InfoRow label="PAN Number" value={user?.panNumber} mono />
                <InfoRow
                  label="Aadhaar Number"
                  value={user?.aadhaarNumber ? `XXXX-XXXX-${user.aadhaarNumber.slice(-4)}` : null}
                  mono
                />
                <InfoRow label="UAN Number"  value={user?.uanNumber} mono />
                <InfoRow label="ESIC Number" value={user?.esicNumber} mono />
              </div>
            </>
          )}

          {/* ── Health ── */}
          {tab === 'health' && (
            <>
              <SectionHeader icon={Heart} title="Health Information" color="red" />
              <div className="grid grid-cols-2 gap-5">
                <InfoRow label="Blood Group"          value={user?.bloodGroup} />
                <InfoRow label="Medical Conditions"   value={user?.medicalConditions || 'None declared'} />
              </div>
              <SectionHeader icon={User} title="Insurance Nominee" color="purple" />
              <div className="grid grid-cols-2 gap-5">
                <InfoRow label="Nominee Name"         value={user?.insuranceNomineeName} />
                <InfoRow label="Nominee Relationship" value={user?.insuranceNomineeRelation} />
              </div>
            </>
          )}

          {/* ── Emergency ── */}
          {tab === 'emergency' && (
            <>
              <SectionHeader icon={AlertCircle} title="Emergency Contact" color="red" />
              <div className="grid grid-cols-2 gap-5">
                <InfoRow label="Contact Name"  value={user?.emergencyContactName} />
                <InfoRow label="Relationship"  value={user?.emergencyContactRelation} />
                <InfoRow label="Phone"         value={user?.emergencyContactPhone} />
                <InfoRow label="Email"         value={user?.emergencyContactEmail} />
              </div>
            </>
          )}

          {/* ── Security (Change Password) ── */}
          {tab === 'security' && (
            <>
              <SectionHeader icon={Lock} title="Change Password" color="indigo" />
              <p className="text-xs text-gray-400 bg-gray-50 px-3 py-2 rounded-lg mb-4">
                This is the only section you can update. Enter your current password to set a new one.
              </p>
              <div className="space-y-4 max-w-sm">
                <FormField label="Current Password">
                  <div className="relative">
                    <input
                      className="input pr-10"
                      type={showPw ? 'text' : 'password'}
                      value={pwForm.current_password}
                      onChange={e => setPwForm(f => ({ ...f, current_password: e.target.value }))}
                      placeholder="••••••••"
                    />
                    <button
                      onClick={() => setShowPw(s => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral hover:text-gray-600"
                    >
                      {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </FormField>

                <FormField label="New Password">
                  <input
                    className="input"
                    type={showPw ? 'text' : 'password'}
                    value={pwForm.new_password}
                    onChange={e => setPwForm(f => ({ ...f, new_password: e.target.value }))}
                    placeholder="Min 6 characters"
                  />
                </FormField>

                <FormField label="Confirm New Password">
                  <input
                    className="input"
                    type={showPw ? 'text' : 'password'}
                    value={pwForm.confirm}
                    onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
                    placeholder="Repeat new password"
                  />
                  {pwForm.confirm && pwForm.new_password !== pwForm.confirm && (
                    <p className="text-red-400 text-xs mt-1">Passwords do not match</p>
                  )}
                </FormField>

                <button
                  className="btn-primary w-full justify-center flex items-center gap-2"
                  onClick={handleChangePassword}
                  disabled={savingPw || !pwForm.current_password || !pwForm.new_password}
                >
                  {savingPw ? <Spinner size="sm" /> : <Lock size={14} />}
                  Change Password
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  )
}