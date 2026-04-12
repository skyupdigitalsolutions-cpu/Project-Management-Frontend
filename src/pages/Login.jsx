import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Eye, EyeOff, Briefcase, Lock, Mail, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'

const DEMO = [
  { label: 'Admin', email: 'admin@company.com', password: 'admin123', color: 'from-brand-600 to-brand-800' },
  { label: 'Manager', email: 'manager@company.com', password: 'manager123', color: 'from-emerald-600 to-emerald-800' },
  { label: 'Employee', email: 'employee@company.com', password: 'employee123', color: 'from-amber-600 to-amber-800' },
]

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({ email: '', password: '' })
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.email || !form.password) { toast.error('Fill in all fields'); return }
    setLoading(true)
    try {
      const user = await login(form.email, form.password)
      toast.success(`Welcome back, ${user.name}!`)
      navigate(`/${user.role}`, { replace: true })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed')
    } finally { setLoading(false) }
  }

  const fillDemo = (d) => setForm({ email: d.email, password: d.password })

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface relative overflow-hidden">
      {/* Background glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-brand-800/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand-900/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md px-4 animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className='flex justify-center my-4'>
            <img className='w-56' src='/images/skyup_logo.webp' />
          </div>
          <p className="text-slate-400 mt-1 text-sm">Sign in to your workspace</p>
        </div>

        {/* Card */}
        <div className="bg-surface-50 border border-white/8 rounded-2xl p-7 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label className="label">Email address</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="you@company.com"
                  className="input pl-10"
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="••••••••"
                  className="input pl-10 pr-10"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(s => !s)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-3 text-base"
            >
              {loading
                ? <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                : <><span>Sign in</span><ArrowRight size={17} /></>
              }
            </button>
          </form>

          {/* Demo logins */}
          <div className="mt-6 pt-5 border-t border-white/5">
            <div className="grid grid-cols-3 gap-2">
              {DEMO.map(d => (
                <button
                  key={d.label}
                  onClick={() => fillDemo(d)}
                  className={`bg-gradient-to-br ${d.color} text-white text-xs font-semibold py-2.5 rounded-xl transition-all duration-200 hover:brightness-110 active:scale-95 border border-white/10`}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-600 text-center mt-2">Click to auto-fill credentials</p>
          </div>
        </div>
      </div>
    </div>
  )
}
