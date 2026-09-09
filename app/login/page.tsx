'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Logo, IconInput, Button, FeedbackMessage } from '@/components/ui'

export default function LoginPage() {
  const router = useRouter()
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

      if (role === 'admin') {
        router.push('/admin/dashboard')
        return
      } else if (role === 'guru') {
        router.push('/teacher/dashboard')
        return
      } else {
        await supabase.auth.signOut()
        throw new Error('Akses ditolak. Akun Anda tidak memiliki hak akses sebagai admin atau guru.')
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
          <Logo src="/gambar2.png" alt="Ilustrasi Belajar" size={1200} />
        </div>

        {/* Sisi Kanan: Form Login */}
        <div className="w-full lg:w-1/2 px-8 py-8 sm:px-16 flex flex-col justify-center bg-gradient-to-b from-white via-sky-50/70 to-sky-100/80">
          <div className="mx-auto w-full max-w-md space-y-5">
            {/* Header */}
            <div className="text-center space-y-2">
              <Logo src="/gambar3.png" alt="Logo Sekolah" size={64} />
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900">
                Selamat Datang
              </h1>
              <p className="text-xs sm:text-sm text-gray-800">
                Silakan masukan email dan password anda di bawah.
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
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                    Kata Sandi
                  </label>
                  <a href="#" className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline">
                    Lupa Kata Sandi?
                  </a>
                </div>
                <IconInput
                  type="password"
                  placeholder="Masukkan kata sandi"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
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