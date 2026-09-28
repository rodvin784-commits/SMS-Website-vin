'use client'
// Login Admin Terpisah — hanya role admin (smk.belajar.id internal, tidak campur guru)
// Alur: Supabase Auth → cek profiles.role === admin → /admin/dashboard

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Logo, IconInput, Button, FeedbackMessage } from '@/components/ui'
import AuthLayout from '@/components/auth/AuthLayout'
import { getRateLimitState, recordFail, clearRateLimit, formatRemaining } from '@/lib/login-rate-limit'

export default function AdminLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showError, setShowError] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const rl = getRateLimitState(email, 'admin')
    if (rl.blocked) {
      setError(`Terlalu banyak percobaan. Coba lagi dalam ${formatRemaining(rl.remainingMs)} (5x/15 menit).`)
      setShowError(true)
      console.warn('[admin-login] rate-limited', { email, fails: rl.fails })
      return
    }
    setLoading(true)
    setError('')
    setShowError(false)
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError || !authData.user) throw new Error(authError?.message || 'Gagal masuk. Periksa email & kata sandi admin.')

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !sessionData.session) throw new Error(sessionError?.message || 'Sesi tidak siap.')

      const { data: profile, error: profileError } = await supabase.from('profiles').select('role, status').eq('id', authData.user.id).maybeSingle()
      if (profileError || !profile) { await supabase.auth.signOut(); throw new Error('Profil admin tidak ditemukan.') }
      if (profile.status === false) { await supabase.auth.signOut(); throw new Error('Akun admin dinonaktifkan.') }
      if (profile.role !== 'admin') { await supabase.auth.signOut(); throw new Error('Akses ditolak. Halaman ini hanya untuk Administrator. Guru silakan via /login') }

      clearRateLimit(email, 'admin')
      window.location.assign('/admin/dashboard')
    } catch (err) {
      recordFail(email, 'admin')
      console.warn('[admin-login] failed', { email, error: err instanceof Error ? err.message : String(err) })
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan.')
      setShowError(true)
    } finally { setLoading(false) }
  }

  return (
    <AuthLayout badge="Akses Terbatas • Portal Administrator">
      <div className="space-y-5">
        <div className="text-center space-y-2">
          <Logo src="/gambar3.png" alt="Logo Sekolah" size={56} />
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">Login Administrator</h1>
          <p className="text-xs sm:text-sm text-slate-600">Silakan masukan email dan password administrator di bawah.</p>
        </div>
        {showError && error && <FeedbackMessage type="error" message={error} />}
        <form onSubmit={handleLogin} className="space-y-4">
          <IconInput type="email" label="Email Admin" placeholder="admin@sekolah.sch.id" value={email} onChange={e => setEmail(e.target.value)} required />
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">Kata Sandi</label>
            <IconInput type="password" placeholder="Masukkan kata sandi admin" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <Button type="submit" loading={loading} fullWidth size="lg">{loading ? 'Memproses...' : 'Masuk sebagai Admin'}</Button>
        </form>
        <p className="text-center text-[11px] text-slate-400">SMK Bagimu Negeriku • Akses terbatas</p>
      </div>
    </AuthLayout>
  )
}
