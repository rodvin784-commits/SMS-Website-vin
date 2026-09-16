'use client'

import { useEffect, useState } from 'react'
import {
  CalendarDays,
  GraduationCap,
  Megaphone,
  Pencil,
  Plus,
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

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{pengumuman.length} pengumuman dibuat</p>
        <button
          onClick={() => { resetForm(); setShowForm(true) }}
          disabled={kelasDiajar.length === 0}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="h-4 w-4" />
          Buat Pengumuman
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-900">{editing ? 'Edit Pengumuman' : 'Pengumuman Baru'}</h3>
            <button onClick={() => { setShowForm(false); resetForm() }} className="text-gray-400 hover:text-gray-700">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">Judul *</label>
            <input
              value={formJudul}
              onChange={(e) => setFormJudul(e.target.value)}
              placeholder="cth: Remidi UTS Matematika"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">Isi *</label>
            <textarea
              value={formIsi}
              onChange={(e) => setFormIsi(e.target.value)}
              rows={5}
              placeholder="Tulis isi pengumuman untuk siswa..."
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
              Kelas Tujuan ({kelasDiajar.length} kelas Anda)
            </label>
            {kelasDiajar.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Anda belum ditugaskan mengajar kelas mana pun.</p>
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
      ) : (
        <div className="space-y-4">
          {pengumuman.map((p) => (
            <div key={p.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <h3 className="font-bold text-gray-900">{p.judul}</h3>
                  <p className="text-xs text-gray-400 flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {formatTanggal(p.created_at)} · {p.kelas.map((k) => k.nama_kelas).join(', ') || 'Tanpa kelas'}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => bukaEdit(p)}
                    className="p-2 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50"
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(p)}
                    className="p-2 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50"
                    title="Hapus"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {p.isi && (
                <p className="text-sm text-gray-600 whitespace-pre-line">{p.isi}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
