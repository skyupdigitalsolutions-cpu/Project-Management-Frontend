// Shared "Request Work From Home" modal.
// Used by the employee and manager attendance pages. On approval (by an admin)
// the user becomes eligible to clock in/out from the app for the requested dates.

import { useState } from 'react'
import { Home } from 'lucide-react'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { Modal, FormField, Button, Spinner } from './UI'

export default function WfhRequestModal({ open, onClose, onSuccess }) {
  const [form,   setForm]   = useState({ from_date: '', to_date: '', reason: '' })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const days = form.from_date && form.to_date
    ? Math.max(0, Math.ceil((new Date(form.to_date) - new Date(form.from_date)) / 86400000) + 1)
    : 0

  const validate = () => {
    const e = {}
    if (!form.from_date) e.from_date = 'Start date is required'
    if (!form.to_date)   e.to_date   = 'End date is required'
    if (form.from_date && form.to_date && form.to_date < form.from_date)
      e.to_date = 'End date must be on or after start date'
    if (!form.reason || form.reason.trim().length < 5)
      e.reason = 'Reason must be at least 5 characters'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const submit = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      await api.post('/wfh/request', {
        from_date: form.from_date,
        to_date:   form.to_date,
        reason:    form.reason.trim(),
      })
      toast.success('WFH request submitted — awaiting admin approval')
      setForm({ from_date: '', to_date: '', reason: '' })
      setErrors({})
      onSuccess?.()
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to submit WFH request')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Request Work From Home"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? <Spinner size="sm" /> : <Home size={15} />} Submit Request
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
          While you work from the office, attendance is logged by the biometric machine.
          For work-from-home days, request approval here — once an admin approves, you can
          clock in/out from the app for the approved dates only.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="From Date" error={errors.from_date}>
            <input type="date" className="input" value={form.from_date}
              onChange={e => f('from_date', e.target.value)} />
          </FormField>
          <FormField label="To Date" error={errors.to_date}>
            <input type="date" className="input" value={form.to_date}
              onChange={e => f('to_date', e.target.value)} />
          </FormField>
        </div>

        {days > 0 && (
          <p className="text-xs text-gray-500">Duration: <strong>{days}</strong> day{days !== 1 ? 's' : ''}</p>
        )}

        <FormField label="Reason" error={errors.reason}>
          <textarea
            className="input min-h-[90px] resize-y"
            placeholder="Why do you need to work from home?"
            value={form.reason}
            onChange={e => f('reason', e.target.value)}
          />
        </FormField>
      </div>
    </Modal>
  )
}