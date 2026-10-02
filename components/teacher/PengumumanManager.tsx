'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
  GraduationCap,
  Megaphone,
  Pencil,
  Plus,
  Search,
  Send,
  Trash2,
  X,
} from 'lucide-react'

type KelasDiajar = {
  kelas_id: string
  nama_kelas: string | null
}

type PengumumanItem = {
  id: string
  judul: string
  isi: string | null
  created_at: string
  kelas: KelasDiajar[]
}

export function PengumumanManager() {
  const [kelasDiajar, setKelasDiajar] = useState<KelasDiajar[]>([])
  const [pengumuman, setPengumuman] = useState<PengumumanItem[]>([])
  const [loading, setLoading] = useState(true)
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<PengumumanItem | null>(null)
  const [formJudul, setFormJudul] = useState('')
  const [formIsi, setFormIsi] = useState('')
  const [formKelas, setFormKelas] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [cari, setCari] = useState('')
  const [filterKelas, setFilterKelas] = useState('semua')

  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        const [resAsg, resPeng] = await Promise.all([
          fetch('/api/teacher/mengajar'),
          fetch('/api/teacher/pengumuman'),
        ])
        const asg = await resAsg.json().catch(() => null)
        const pg = await resPeng.json().catch(() => null)
        if (!cancelled) {
          // Kelas unik yang diajar (dari guru_kelas)
          const map = new Map<string, string>()
          for (const a of (asg?.assignments ?? []) as { kelas_id: string; kelas_nama: string | null }[]) {
            map.set(a.kelas_id, a.kelas_nama ?? a.kelas_id)
          }
          setKelasDiajar(Array.from(map.entries()).map(([kelas_id, nama]) => ({ kelas_id, nama_kelas: nama })))
          setPengumuman((pg?.pengumuman ?? []) as PengumumanItem[])
          if (!resPeng.ok && pg?.error) {
            setStatusMsg({ type: 'error', text: pg.error })
          }
        }
      } catch (err) {
        console.error('Gagal memuat pengumuman:', err)
        if (!cancelled) setStatusMsg({ type: 'error', text: 'Terjadi kesalahan saat memuat data.' })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void init()

    return () => {
      cancelled = true
    }
  }, [])

  const resetForm = () => {
    setEditing(null)
    setFormJudul('')
    setFormIsi('')
    setFormKelas([])
  }

  const toggleKelas = (kelasId: string) => {
    setFormKelas((prev) =>
      prev.includes(kelasId) ? prev.filter((k) => k !== kelasId) : [...prev, kelasId]
    )
  }

  const handleSubmit = async () => {
    if (!formJudul.trim() || !formIsi.trim() || formKelas.length === 0) {
      setStatusMsg({ type: 'error', text: 'Judul, isi, dan kelas tujuan wajib diisi.' })
      return
    }

    setSaving(true)
    setStatusMsg(null)
    try {
      const payload = {
        judul: formJudul,
        isi: formIsi,
        kelas_ids: formKelas,
      }

      const res = editing
        ? await fetch('/api/teacher/pengumuman', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...payload, id: editing.id }),
          })
        : await fetch('/api/teacher/pengumuman', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })

      if (res.ok) {
        setShowForm(false)
        resetForm()
        setStatusMsg({ type: 'success', text: editing ? 'Pengumuman berhasil diperbarui.' : 'Pengumuman berhasil dibuat.' })
        const pg = await fetch('/api/teacher/pengumuman').then((r) => r.json()).catch(() => null)
        setPengumuman((pg?.pengumuman ?? []) as PengumumanItem[])
      } else {
        const err = await res.json().catch(() => null)
        setStatusMsg({ type: 'error', text: err?.error ?? 'Gagal menyimpan pengumuman.' })
      }
    } catch (err) {
      console.error('Gagal menyimpan pengumuman:', err)
      setStatusMsg({ type: 'error', text: 'Terjadi kesalahan saat menyimpan pengumuman.' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (p: PengumumanItem) => {
    if (!confirm(`Hapus pengumuman "${p.judul}"?`)) return
    try {
      const res = await fetch(`/api/teacher/pengumuman?id=${p.id}`, { method: 'DELETE' })
      if (res.ok) {
        setPengumuman((prev) => prev.filter((x) => x.id !== p.id))
        setStatusMsg({ type: 'success', text: 'Pengumuman berhasil dihapus.' })
      } else {
        const err = await res.json().catch(() => null)
        setStatusMsg({ type: 'error', text: err?.error ?? 'Gagal menghapus pengumuman.' })
      }
    } catch (err) {
      console.error('Gagal menghapus pengumuman:', err)
      setStatusMsg({ type: 'error', text: 'Terjadi kesalahan saat menghapus pengumuman.' })
    }
  }

  const bukaEdit = (p: PengumumanItem) => {
    setEditing(p)
    setFormJudul(p.judul)
    setFormIsi(p.isi ?? '')
    setFormKelas(p.kelas.map((k) => k.kelas_id))
    setShowForm(true)
  }

  function formatTanggal(v: string) {
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  // Hasil saring: teks + kelas (kosong = semua)
  const tampil = useMemo(() => {
    const q = cari.trim().toLowerCase()
    return pengumuman.filter((p) => {
      if (filterKelas !== 'semua' && !p.kelas.some((k) => k.kelas_id === filterKelas)) return false
      if (!q) return true
      return p.judul.toLowerCase().includes(q) || (p.isi ?? '').toLowerCase().includes(q)
    })
  }, [pengumuman, cari, filterKelas])

  const filterAktif = cari.trim() !== '' || filterKelas !== 'semua'

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-16 flex flex-col items-center justify-center space-y-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
        <p className="text-sm font-medium text-gray-500">Memuat pengumuman...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {statusMsg && (
        <div
          className={`
            px-5 py-3 rounded-xl text-sm font-medium
            ${statusMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'}
          `}
        >
          {statusMsg.text}
        </div>
      )}

      {/* Toolbar: cari + filter kiri, aksi kanan */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" aria-hidden />
            <input
              type="search"
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              placeholder="Cari pengumuman…"
              aria-label="Cari pengumuman"
              className="w-full sm:w-56 rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-800 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
          </div>
          <select
            value={filterKelas}
            onChange={(e) => setFilterKelas(e.target.value)}
            aria-label="Filter kelas"
            className="rounded-xl border border-gray-200 bg-white py-2.5 px-3 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
          >
            <option value="semua">Semua Kelas</option>
            {kelasDiajar.map((k) => (
              <option key={k.kelas_id} value={k.kelas_id}>{k.nama_kelas}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true) }}
          disabled={kelasDiajar.length === 0}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Buat Pengumuman
        </button>
      </div>
      <p className="text-sm text-gray-600 -mt-3">
        {filterAktif
          ? `Menampilkan ${tampil.length} dari ${pengumuman.length} pengumuman`
          : `${pengumuman.length} pengumuman dibuat`}
      </p>

      {showForm && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-900">{editing ? 'Edit Pengumuman' : 'Pengumuman Baru'}</h3>
            <button onClick={() => { setShowForm(false); resetForm() }} className="text-gray-500 hover:text-gray-700">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="pengumuman-judul" className="block text-sm font-semibold text-gray-700">Judul *</label>
            <input
              id="pengumuman-judul"
              value={formJudul}
              onChange={(e) => setFormJudul(e.target.value)}
              placeholder="cth: Remidi UTS Matematika"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="pengumuman-isi" className="block text-sm font-semibold text-gray-700">Isi *</label>
            <textarea
              id="pengumuman-isi"
              value={formIsi}
              onChange={(e) => setFormIsi(e.target.value)}
              rows={5}
              placeholder="Tulis isi pengumuman untuk siswa..."
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-gray-700">
              Kelas Tujuan ({kelasDiajar.length} kelas Anda)
            </label>
            {kelasDiajar.length === 0 ? (
              <p className="text-xs text-gray-500 italic">Anda belum ditugaskan mengajar kelas mana pun.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {kelasDiajar.map((k) => (
                  <button
                    key={k.kelas_id}
                    type="button"
                    onClick={() => toggleKelas(k.kelas_id)}
                    className={`
                      px-4 py-2 rounded-xl text-sm font-bold border transition-all
                      ${formKelas.includes(k.kelas_id)
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'border-gray-200 text-gray-600 hover:border-emerald-300'}
                    `}
                  >
                    {k.nama_kelas}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => { setShowForm(false); resetForm() }}
              className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-bold hover:bg-gray-50"
            >
              Batal
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {saving ? 'Menyimpan...' : editing ? 'Simpan Perubahan' : 'Kirim Pengumuman'}
            </button>
          </div>
        </div>
      )}

      {kelasDiajar.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-16 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-50 mb-4">
            <GraduationCap className="h-10 w-10 text-gray-300" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">Belum ada penugasan</h3>
          <p className="text-sm text-gray-500">Hubungi admin untuk penugasan mengajar.</p>
        </div>
      ) : pengumuman.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-16 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-50 mb-4">
            <Megaphone className="h-10 w-10 text-gray-300" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">Belum ada pengumuman</h3>
          <p className="text-sm text-gray-500">Buat pengumuman pertama untuk kelas Anda.</p>
        </div>
      ) : tampil.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-50 mb-4">
            <Search className="h-8 w-8 text-gray-300" aria-hidden />
          </div>
          <h3 className="text-base font-bold text-gray-900 mb-1">Tidak ada hasil</h3>
          <p className="text-sm text-gray-600">Coba kata kunci atau filter kelas lain.</p>
          <button
            onClick={() => { setCari(''); setFilterKelas('semua') }}
            className="mt-4 px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold text-gray-700 hover:bg-gray-50"
          >
            Atur Ulang
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {tampil.map((p) => (
            <article key={p.id} className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 transition-shadow hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1.5 min-w-0">
                  <h3 className="font-bold text-gray-900">{p.judul}</h3>
                  <p className="text-xs text-gray-600 flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    {formatTanggal(p.created_at)}
                    <span aria-hidden>•</span>
                    <span className="truncate">{p.kelas.map((k) => k.nama_kelas).join(', ') || 'Tanpa kelas'}</span>
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => bukaEdit(p)}
                    title="Edit"
                    aria-label={`Edit pengumuman ${p.judul}`}
                    className="p-2 rounded-lg text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                  >
                    <Pencil className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    onClick={() => handleDelete(p)}
                    title="Hapus"
                    aria-label={`Hapus pengumuman ${p.judul}`}
                    className="p-2 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </div>

              {p.isi && (
                <p className="mt-3 text-sm leading-relaxed text-gray-700 whitespace-pre-line line-clamp-3">{p.isi}</p>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
