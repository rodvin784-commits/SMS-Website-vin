'use client'
// LoginPage — Web KHUSUS GURU (admin dipisah ke /admin/login). Kiri ilustrasi, kanan form.
// Alur: Supabase Auth → cek profiles.role === guru → /teacher/dashboard

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Logo, IconInput, Button, FeedbackMessage } from '@/components/ui'
import AuthLayout from '@/components/auth/AuthLayout'
import { getRateLimitState, recordFail, clearRateLimit, formatRemaining } from '@/lib/login-rate-limit'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showError, setShowError] = useState(false)

  // Tampilkan pesan penolakan dari /auth/callback (?error=...) agar user paham
  // kenapa login Google ditolak (mis. siswa wajib via APK, akun belum terdaftar).
  useEffect(() => {
    const kode = new URLSearchParams(window.location.search).get('error')
    if (!kode) return
    const pesan: Record<string, string> = {
      siswa_gunakan_apk: 'Akun siswa wajib login via aplikasi mobile (APK), bukan web ini.',
      akun_belum_terdaftar: 'Akun Google ini belum terdaftar. Hubungi admin untuk didaftarkan.',
      email_sudah_terdaftar_hubungi_admin: 'Email ini sudah terdaftar dengan akun berbeda. Hubungi admin sekolah.',
      akun_dinonaktifkan: 'Akun Anda dinonaktifkan. Hubungi admin sekolah.',
      domain_harus_smk_belajar: 'Login Google wajib memakai akun @smk.belajar.id.',
      oauth_no_code: 'Login Google gagal (kode hilang). Silakan coba lagi.',
      oauth_no_email: 'Login Google gagal (email tidak terbaca). Silakan coba lagi.',
    }
    setError(pesan[kode] ?? `Login Google ditolak (${kode}). Hubungi admin.`)
    setShowError(true)
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const rl = getRateLimitState(email, 'guru')
    if (rl.blocked) {
      setError(`Terlalu banyak percobaan. Coba lagi dalam ${formatRemaining(rl.remainingMs)} (5x/15 menit).`)
      setShowError(true)
      console.warn('[guru-login] rate-limited', { email, fails: rl.fails })
      return
    }
    setLoading(true)
    setError('')
    setShowError(false)

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError || !authData.user) {
        throw new Error(authError?.message || 'Gagal masuk. Periksa kembali email dan kata sandi.')
      }

      // Pastikan sesi sudah tersimpan di cookie sebelum navigasi.
      // Tanpa ini, middleware (proxy.ts) bisa gagal melihat cookie fresh
      // saat navigasi SPA pertama dan melempar user balik ke /login.
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !sessionData.session) {
        throw new Error(sessionError?.message || 'Sesi tidak dapat dipersiapkan. Silakan coba lagi.')
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, status')
        .eq('id', authData.user.id)
        .maybeSingle()

      if (profileError || !profile) {
        await supabase.auth.signOut()
        throw new Error('Akses ditolak. Profil pengguna tidak ditemukan di database.')
      }

      if (profile.status === false) {
        await supabase.auth.signOut()
        throw new Error('Akses ditolak. Akun Anda sedang dinonaktifkan. Hubungi administrator.')
      }

      const role = profile.role

      // Halaman ini khusus guru — admin harus via /admin/login
      if (role === 'admin') {
        await supabase.auth.signOut()
        throw new Error('Akun admin silakan login via /admin/login')
      }
      if (role === 'guru') {
        clearRateLimit(email, 'guru')
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign('/teacher/dashboard')
        return
      } else if (role === 'siswa') {
        // Portal siswa kini berupa aplikasi React Native terpisah,
        // tidak lagi dilayani dari web ini.
        await supabase.auth.signOut()
        throw new Error(
          'Portal siswa sudah dipindah ke aplikasi mobile. Silakan masuk melalui aplikasi.'
        )
      } else {
        await supabase.auth.signOut()
        throw new Error('Akses ditolak. Akun Anda tidak memiliki hak akses.')
      }

    } catch (err) {
      recordFail(email, 'guru')
      console.warn('[guru-login] failed', { email, error: err instanceof Error ? err.message : String(err) })
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan sistem.'
      setError(message)
      setShowError(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout badge="Portal Guru">
      <div className="space-y-5">
        {/* Header */}
        <div className="text-center space-y-2">
          <Logo src="/gambar3.png" alt="Logo Sekolah" size={64} />
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
            Login Guru
          </h1>
          <p className="text-xs sm:text-sm leading-relaxed text-slate-200/90">
            Silakan masukan email dan password guru anda di bawah.
          </p>
        </div>

        {/* Error Message */}
        {showError && error && (
          <FeedbackMessage type="error" message={error} />
        )}

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <IconInput
              type="email"
              label="Alamat Email"
              labelClassName="text-slate-200"
              placeholder="nama@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-200 mb-1.5">
              Kata Sandi
            </label>
            <IconInput
              type="password"
              placeholder="Masukkan kata sandi"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <p className="text-xs font-semibold text-slate-300 mt-2 text-right transition-colors hover:text-white" title="Hubungi admin sekolah untuk reset kata sandi">
              Lupa? Hubungi admin
            </p>
          </div>

          <Button type="submit" loading={loading} fullWidth size="lg">
            {loading ? 'Memproses...' : 'Masuk'}
          </Button>
        </form>
      </div>
    </AuthLayout>
  )
}