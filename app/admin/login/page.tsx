'use client'
// Login Admin Terpisah — hanya role admin (smk.belajar.id internal, tidak campur guru)
// Alur: Supabase Auth → cek profiles.role === admin → /admin/dashboard

import { useState } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { IconInput, Button, FeedbackMessage } from '@/components/ui'
import AuthLayout from '@/components/auth/AuthLayout'
import { getRateLimitState, recordFail, clearRateLimit, formatRemaining } from '@/lib/login-rate-limit'

const REMEMBER_KEY = 'admin-remember-email'

function getRememberedEmail(): string {
  try {
    if (typeof window === 'undefined') return ''
    return localStorage.getItem(REMEMBER_KEY) ?? ''
  } catch {
    return ''
  }
}

export default function AdminLoginPage() {
  const [email, setEmail] = useState<string>(() => getRememberedEmail())
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState<boolean>(() => getRememberedEmail() !== '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showError, setShowError] = useState(false)
  const [info, setInfo] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const rl = getRateLimitState(email, 'admin')
    if (rl.blocked) {
      setError(`Terlalu banyak percobaan. Coba lagi dalam ${formatRemaining(rl.remainingMs)} (5x/15 menit).`)
      setShowError(true)
      setInfo(null)
      console.warn('[admin-login] rate-limited', { email, fails: rl.fails })
      return
    }
    setLoading(true)
    setError('')
    setShowError(false)
    setInfo(null)
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
      try {
        if (remember) localStorage.setItem(REMEMBER_KEY, email)
        else localStorage.removeItem(REMEMBER_KEY)
      } catch {
        // abaikan
      }
      // Full reload disengaja: pastikan cookie sesi fresh terbaca middleware
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
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
      <div className="space-y-6">
        {/* Kepala kartu: logo transparan + judul */}
        <div className="space-y-3 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center overflow-hidden">
            <Image
              src="/logo bn.png"
              alt="Logo SMK Bagimu Negeriku"
              width={80}
              height={80}
              priority
              className="h-full w-full object-contain drop-shadow-[0_4px_16px_rgba(0,0,0,0.5)]"
            />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Login Administrator
          </h1>
          <p className="mx-auto max-w-xs text-sm leading-relaxed text-slate-300">
            Silakan masukkan email dan password administrator di bawah ini
          </p>
        </div>

        {showError && error && <FeedbackMessage type="error" message={error} />}
        {info && <FeedbackMessage type="info" message={info} />}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label htmlFor="admin-email" className="mb-1.5 block text-sm font-semibold normal-case tracking-normal text-slate-200">
              Email Admin
            </label>
            <IconInput
              id="admin-email"
              type="email"
              placeholder="Masukkan email Anda"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor="admin-password" className="mb-1.5 block text-sm font-semibold normal-case tracking-normal text-slate-200">
              Kata Sandi
            </label>
            <IconInput
              id="admin-password"
              type="password"
              placeholder="Masukkan kata sandi Anda"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          {/* Baris ingat + lupa, tepat di atas tombol */}
          <div className="flex items-center justify-between pt-1">
            <label htmlFor="admin-remember" className="flex cursor-pointer items-center gap-2 text-sm text-slate-300 select-none">
              <input
                id="admin-remember"
                type="checkbox"
                checked={remember}
                onChange={e => setRemember(e.target.checked)}
                className="h-4 w-4 rounded border-slate-500 bg-white accent-blue-500 focus:ring-2 focus:ring-blue-400 focus:ring-offset-0"
              />
              Ingat Saya
            </label>
            <button
              type="button"
              onClick={() => { setInfo('Lupa kata sandi? Hubungi super admin sekolah untuk reset akun Anda.'); setShowError(false) }}
              className="text-sm font-medium text-blue-400 transition-colors hover:text-blue-300 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 rounded"
            >
              Lupa Kata Sandi?
            </button>
          </div>

          <Button
            type="submit"
            loading={loading}
            fullWidth
            size="lg"
            className="bg-blue-500 py-3.5 text-sm font-bold text-white shadow-[0_8px_30px_rgba(59,130,246,0.55),0_4px_14px_rgba(59,130,246,0.4)] hover:bg-blue-600 focus:ring-blue-400/40"
          >
            {loading ? 'Memproses...' : 'Masuk sebagai Admin'}
          </Button>
        </form>
      </div>
    </AuthLayout>
  )
}
