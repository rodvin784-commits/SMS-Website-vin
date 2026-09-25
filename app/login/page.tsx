'use client'
// LoginPage — Web KHUSUS GURU (admin dipisah ke /admin/login). Kiri ilustrasi, kanan form.
// Alur: Supabase Auth → cek profiles.role === guru → /teacher/dashboard

import { useState } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { Logo, IconInput, Button, FeedbackMessage } from '@/components/ui'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showError, setShowError] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
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
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan sistem.'
      setError(message)
      setShowError(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-blue-950 via-gray-900 to-indigo-950 p-4 lg:p-10">
      <div className="flex w-full max-w-7xl min-h-[680px] overflow-hidden rounded-3xl bg-white shadow-2xl">
        {/* Sisi Kiri: Ilustrasi */}
        <div className="hidden lg:flex lg:w-1/2 relative bg-gray-900 overflow-hidden">
          <Image
            src="/gambar2.png"
            alt="Ilustrasi Belajar"
            fill
            priority
            sizes="50vw"
            className="object-cover"
          />
        </div>

        {/* Sisi Kanan: Form Login */}
        <div className="w-full lg:w-1/2 px-8 py-8 sm:px-16 flex flex-col justify-center bg-gradient-to-b from-white via-sky-50/70 to-sky-100/80">
          <div className="mx-auto w-full max-w-md space-y-5">
            {/* Header */}
            <div className="text-center space-y-2">
              <Logo src="/gambar3.png" alt="Logo Sekolah" size={64} />
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900">
                Login Guru
              </h1>
              <p className="text-xs sm:text-sm text-gray-800">
                Masuk khusus guru. Admin via <a href="/admin/login" className="text-blue-600 font-bold hover:underline">/admin/login</a>
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
                  placeholder="nama@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                  Kata Sandi
                </label>
                <IconInput
                  type="password"
                  placeholder="Masukkan kata sandi"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <p className="text-xs font-semibold text-gray-500 mt-1.5 text-right" title="Hubungi admin sekolah untuk reset kata sandi">
                  Admin? <a href="/admin/login" className="text-blue-600 font-bold hover:underline">Login Admin</a> • Lupa? Hubungi admin
                </p>
              </div>

              <Button type="submit" loading={loading} fullWidth size="lg">
                {loading ? 'Memproses...' : 'Masuk'}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}