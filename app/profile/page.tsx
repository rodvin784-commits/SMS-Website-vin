'use client'
// Profil — Ubah nama + ganti sandi (1x). Light theme: bg-gray-50, kartu putih,
// grid 2 kolom. Rekomendasi tambahan: label htmlFor, eye toggle ber-aria,
// indikator kekuatan sandi dinamis, validasi konfirmasi di klien.

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Eye, EyeOff, Info } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type Msg = { type: 'success' | 'error'; text: string } | null

// Skor 0–4: panjang≥6, panjang≥10, campur huruf besar-kecil, angka/simbol
function passwordStrength(pw: string): { score: number; label: string } {
  if (!pw) return { score: 0, label: '' }
  let s = 0
  if (pw.length >= 6) s++
  if (pw.length >= 10) s++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++
  if (/\d/.test(pw) || /[^A-Za-z0-9]/.test(pw)) s++
  if (s <= 1) return { score: s, label: 'Lemah' }
  if (s <= 3) return { score: s, label: 'Sedang' }
  return { score: s, label: 'Kuat' }
}

const strengthColor = ['', 'bg-red-500', 'bg-yellow-500', 'bg-yellow-500', 'bg-emerald-500']
const strengthText = ['', 'text-red-600', 'text-yellow-600', 'text-yellow-600', 'text-emerald-600']

const inputCls =
  'w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 ' +
  'placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ' +
  'disabled:bg-gray-100 disabled:text-gray-400'

export default function ProfilePage() {
  const router = useRouter()
  const [role, setRole] = useState<'admin' | 'guru' | 'siswa' | null>(null)
  const [userName, setUserName] = useState('Pengguna')
  const [editNama, setEditNama] = useState('')
  const [savingNama, setSavingNama] = useState(false)
  const [msgNama, setMsgNama] = useState<Msg>(null)
  const [loading, setLoading] = useState(true)
  const [used, setUsed] = useState(0)
  const [remaining, setRemaining] = useState(1)
  const [curr, setCurr] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showCurr, setShowCurr] = useState(false)
  const [showNext, setShowNext] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [msg, setMsg] = useState<Msg>(null)
  const [saving, setSaving] = useState(false)

  const strength = useMemo(() => passwordStrength(next), [next])
  const confirmMismatch = confirm.length > 0 && confirm !== next
  const sandiHabis = remaining === 0 || used >= 1

  useEffect(() => {
    let cancelled = false
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/login'); return }
      const { data: p } = await supabase.from('profiles').select('role,nama_lengkap').eq('id', session.user.id).maybeSingle()
      const row = p as { role: string; nama_lengkap: string } | null
      if (!cancelled) {
        setRole((row?.role as typeof role) ?? null)
        setUserName(row?.nama_lengkap ?? 'Pengguna')
        setEditNama(row?.nama_lengkap ?? '')
      }
      const r = await fetch('/api/profile/change-password')
      const j = await r.json().catch(() => null)
      if (!cancelled && j) { setUsed(j.used ?? 0); setRemaining(j.remaining ?? 1) }
      if (!cancelled) setLoading(false)
    }
    void init()
    return () => { cancelled = true }
  }, [router])

  const submitNama = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingNama(true); setMsgNama(null)
    try {
      const r = await fetch('/api/profile/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nama_lengkap: editNama }) })
      const j = await r.json().catch(() => null)
      if (r.ok) { setMsgNama({ type: 'success', text: j.message }); setUserName(editNama) }
      else setMsgNama({ type: 'error', text: j?.error ?? 'Gagal menyimpan nama.' })
    } catch {
      setMsgNama({ type: 'error', text: 'Koneksi terputus. Coba lagi.' })
    } finally {
      setSavingNama(false)
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (confirm !== next) {
      setMsg({ type: 'error', text: 'Konfirmasi sandi tidak cocok. Periksa kembali.' })
      return
    }
    setSaving(true); setMsg(null)
    try {
      const r = await fetch('/api/profile/change-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword: curr, newPassword: next }) })
      const j = await r.json().catch(() => null)
      if (r.ok) {
        setMsg({ type: 'success', text: j.message })
        setUsed(1); setRemaining(0)
        setCurr(''); setNext(''); setConfirm('')
      } else setMsg({ type: 'error', text: j?.error ?? 'Gagal mengganti sandi.' })
    } catch {
      setMsg({ type: 'error', text: 'Koneksi terputus. Coba lagi.' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" aria-hidden />
          <p className="text-sm font-medium text-gray-600">Memuat profil…</p>
        </div>
      </div>
    )
  }

  const backHref = role === 'admin' ? '/admin/dashboard' : role === 'guru' ? '/teacher/dashboard' : '/login'

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        {/* Kembali — kiri atas, outline */}
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-transparent px-3.5 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Kembali
        </Link>

        {/* Judul */}
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900">Profil</h1>
        <p className="mt-1 text-sm text-gray-500">Halo, {userName} ({role})</p>

        {/* Grid 2 kolom */}
        <div className="mt-6 grid grid-cols-1 gap-8 md:grid-cols-2">
          {/* Kolom kiri — nama */}
          <section aria-labelledby="profil-nama-judul" className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 id="profil-nama-judul" className="text-base font-bold text-gray-900">Ubah Nama Profil</h2>
            {msgNama && (
              <div role="status" className={`mt-3 rounded-lg px-4 py-2.5 text-sm font-medium ${msgNama.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                {msgNama.text}
              </div>
            )}
            <form onSubmit={submitNama} className="mt-4 space-y-4">
              <div>
                <label htmlFor="profil-nama" className="mb-1.5 block text-sm font-semibold text-gray-700">
                  Nama Lengkap
                </label>
                <input
                  id="profil-nama"
                  type="text"
                  placeholder="Masukkan nama lengkap Anda"
                  autoComplete="name"
                  value={editNama}
                  onChange={(e) => setEditNama(e.target.value)}
                  className={inputCls}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={savingNama}
                className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:opacity-50"
              >
                {savingNama ? 'Menyimpan…' : 'Simpan Nama'}
              </button>
            </form>
          </section>

          {/* Kolom kanan — sandi */}
          <section aria-labelledby="profil-sandi-judul" className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 id="profil-sandi-judul" className="text-base font-bold text-gray-900">Ganti Sandi</h2>
            <p className="mt-1.5 flex items-start gap-1.5 text-xs leading-relaxed text-gray-500">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              Anda hanya dapat mengubah kata sandi 1 kali. Pastikan sandi baru Anda benar.
            </p>
            {msg && (
              <div role="status" className={`mt-3 rounded-lg px-4 py-2.5 text-sm font-medium ${msg.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                {msg.text}
              </div>
            )}
            <form onSubmit={submit} className="mt-4 space-y-4">
              <PasswordField
                id="profil-sandi-lama"
                label="Password Lama"
                placeholder="Masukkan password lama"
                value={curr}
                show={showCurr}
                onToggle={() => setShowCurr((v) => !v)}
                onChange={setCurr}
                disabled={sandiHabis}
                autoComplete="current-password"
              />
              <div>
                <PasswordField
                  id="profil-sandi-baru"
                  label="Password Baru (min 6)"
                  placeholder="Masukkan password baru"
                  value={next}
                  show={showNext}
                  onToggle={() => setShowNext((v) => !v)}
                  onChange={setNext}
                  disabled={sandiHabis}
                  autoComplete="new-password"
                />
                {/* Indikator kekuatan — muncul saat mengetik */}
                {next.length > 0 && (
                  <div className="mt-2" aria-live="polite">
                    <div className="flex gap-1" aria-hidden>
                      {[1, 2, 3, 4].map((i) => (
                        <span
                          key={i}
                          className={`h-1.5 flex-1 rounded-full ${i <= strength.score ? strengthColor[strength.score] : 'bg-gray-200'}`}
                        />
                      ))}
                    </div>
                    <p className={`mt-1 text-xs font-semibold ${strengthText[strength.score]}`}>
                      Kekuatan: {strength.label}
                    </p>
                  </div>
                )}
              </div>
              <div>
                <PasswordField
                  id="profil-sandi-konfirmasi"
                  label="Konfirmasi Password Baru"
                  placeholder="Ulangi password baru"
                  value={confirm}
                  show={showConfirm}
                  onToggle={() => setShowConfirm((v) => !v)}
                  onChange={setConfirm}
                  disabled={sandiHabis}
                  autoComplete="new-password"
                />
                {confirmMismatch && (
                  <p className="mt-1 text-xs font-medium text-red-600" role="alert">
                    Konfirmasi belum cocok dengan password baru.
                  </p>
                )}
              </div>
              <button
                type="submit"
                disabled={saving || sandiHabis || confirmMismatch}
                className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:opacity-50"
              >
                {saving ? 'Menyimpan…' : sandiHabis ? 'Sudah 1x — Hubungi admin' : 'Ganti Sandi'}
              </button>
              {sandiHabis && (
                <p className="text-center text-xs text-gray-500">Hubungi admin untuk reset kata sandi.</p>
              )}
            </form>
          </section>
        </div>
      </div>
    </div>
  )
}

// Kolom password + tombol mata show/hide (pakai ulang 3x)
function PasswordField({
  id,
  label,
  placeholder,
  value,
  show,
  onToggle,
  onChange,
  disabled,
  autoComplete,
}: {
  id: string
  label: string
  placeholder: string
  value: string
  show: boolean
  onToggle: () => void
  onChange: (v: string) => void
  disabled?: boolean
  autoComplete?: string
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-gray-700">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          autoComplete={autoComplete}
          required
          className={inputCls + ' pr-11'}
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={show ? `Sembunyikan ${label}` : `Tampilkan ${label}`}
          aria-pressed={show}
          className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-gray-500 transition-colors hover:text-gray-700 focus:outline-none focus-visible:text-emerald-600"
        >
          {show ? <EyeOff className="h-5 w-5" aria-hidden /> : <Eye className="h-5 w-5" aria-hidden />}
        </button>
      </div>
    </div>
  )
}
