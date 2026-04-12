import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { User, Mail, Phone, Briefcase, Building, Calendar, Lock, Eye, EyeOff } from 'lucide-react'
import { PageHeader, FormField, Spinner, StatusBadge } from '../components/common/UI'

export default function Profile() {
  const { user, updateUser } = useAuth()

  const [form,     setForm]     = useState({
    name:        user?.name        ?? '',
    phone:       user?.phone       ?? '',
    department:  user?.department  ?? '',
    designation: user?.designation ?? '',
  })
  const [pwForm,   setPwForm]   = useState({ current_password: '', new_password: '', confirm: '' })
  const [saving,   setSaving]   = useState(false)
  const [savingPw, setSavingPw] = useState(false)
  const [showPw,   setShowPw]   = useState(false)

  const handleSaveProfile = async () => {
    setSaving(true)
    try {
      const { data } = await api.patch(`/users/${user._id}`, { name: form.name, phone: form.phone })
      updateUser({ ...user, ...data.data })
      toast.success('Profile updated!')
    } catch (e) { toast.error(e.response?.data?.message || 'Update failed') }
    finally { setSaving(false) }
  }

  const handleChangePassword = async () => {
    if (pwForm.new_password !== pwForm.confirm) { toast.error('Passwords do not match'); return }
    if (pwForm.new_password.length < 6) { toast.error('Password must be at least 6 characters'); return }
    setSavingPw(true)
    try {
      await api.patch('/auth/change-password', {
        current_password: pwForm.current_password,
        new_password:     pwForm.new_password,
      })
      toast.success('Password changed!')
      setPwForm({ current_password: '', new_password: '', confirm: '' })
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to change password') }
    finally { setSavingPw(false) }
  }

  const ROLE_COLOR = {
    admin:    'bg-brand-600/20 text-brand-300 border-brand-500/30',
    manager:  'bg-emerald-600/20 text-emerald-300 border-emerald-500/30',
    employee: 'bg-amber-600/20 text-amber-300 border-amber-500/30',
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <PageHeader title="My Profile" subtitle="Manage your personal information and account settings" />

      {/* Profile header card */}
      <div className="card flex items-center gap-5 flex-wrap">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-bold text-3xl flex-shrink-0">
          {user?.name?.charAt(0)?.toUpperCase()}
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">{user?.name}</h2>
          <p className="text-slate-400 mt-0.5">{user?.email}</p>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className={`badge border ${ROLE_COLOR[user?.role] ?? ''}`}>{user?.role}</span>
            <StatusBadge status={user?.status} />
            {user?.joining_date && (
              <span className="text-xs text-slate-500 font-mono">
                Joined {format(new Date(user.joining_date), 'MMM d, yyyy')}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Edit profile */}
        <div className="card">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <User size={16} className="text-brand-400"/> Personal Information
          </h3>
          <div className="space-y-4">
            <FormField label="Full Name">
              <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </FormField>
            <FormField label="Email">
              <input className="input opacity-60 cursor-not-allowed" value={user?.email} disabled />
            </FormField>
            <FormField label="Phone">
              <input className="input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+91 98765 43210" />
            </FormField>

            {/* Read-only fields */}
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Department">
                <input className="input opacity-60 cursor-not-allowed" value={user?.department} disabled />
              </FormField>
              <FormField label="Designation">
                <input className="input opacity-60 cursor-not-allowed" value={user?.designation} disabled />
              </FormField>
            </div>

            <button className="btn-primary w-full justify-center" onClick={handleSaveProfile} disabled={saving}>
              {saving ? <Spinner size="sm"/> : null} Save Changes
            </button>
          </div>
        </div>

        {/* Change password */}
        <div className="card">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Lock size={16} className="text-brand-400"/> Change Password
          </h3>
          <div className="space-y-4">
            <FormField label="Current Password">
              <div className="relative">
                <input
                  className="input pr-10"
                  type={showPw ? 'text' : 'password'}
                  value={pwForm.current_password}
                  onChange={e => setPwForm(f => ({ ...f, current_password: e.target.value }))}
                  placeholder="••••••••"
                />
                <button onClick={() => setShowPw(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                  {showPw ? <EyeOff size={15}/> : <Eye size={15}/>}
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
              className="btn-primary w-full justify-center"
              onClick={handleChangePassword}
              disabled={savingPw || !pwForm.current_password || !pwForm.new_password}
            >
              {savingPw ? <Spinner size="sm"/> : <Lock size={14}/>}
              Change Password
            </button>
          </div>
        </div>
      </div>

      {/* Account info */}
      <div className="card">
        <h3 className="text-sm font-semibold text-white mb-4">Account Details</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: Building,  label: 'Department',  value: user?.department },
            { icon: Briefcase, label: 'Designation', value: user?.designation },
            { icon: Calendar,  label: 'Joined',      value: user?.joining_date ? format(new Date(user.joining_date), 'dd MMM yyyy') : '—' },
            { icon: Mail,      label: 'Email',       value: user?.email },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="bg-surface-200 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <Icon size={13} className="text-brand-400"/>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">{label}</p>
              </div>
              <p className="text-sm text-white font-medium truncate">{value ?? '—'}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
