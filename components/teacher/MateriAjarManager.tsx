'use client'

import { useEffect, useState } from 'react'
import {
  BookOpen,
  FileDown,
  FileText,
  GraduationCap,
  Paperclip,
  Pencil,
  Plus,
  Send,
  Trash2,
  X,
} from 'lucide-react'

type GuruAssignment = {
  id: string
  mata_pelajaran_id: string
  mapel_nama: string | null
  mapel_kode: string | null
  kelas_id: string
  kelas_nama: string | null
  tingkat: number | null
  tahun_ajaran: string | null
}

type KelasTarget = {
  kelas_id: string
  nama_kelas: string | null
  tingkat: number | null
}

type MateriItem = {
  id: string
  mata_pelajaran_id: string
  mapel_nama: string | null
  mapel_kode: string | null
  judul: string
  deskripsi: string | null
  nama_file: string | null
  has_file: boolean
  created_at: string
  kelas: KelasTarget[]
}

export function MateriAjarManager() {
  const [assignments, setAssignments] = useState<GuruAssignment[]>([])
  const [materi, setMateri] = useState<MateriItem[]>([])
  const [loading, setLoading] = useState(true)
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<MateriItem | null>(null)
  const [formMapel, setFormMapel] = useState('')
  const [formKelas, setFormKelas] = useState<string[]>([])
  const [formJudul, setFormJudul] = useState('')
  const [formDeskripsi, setFormDeskripsi] = useState('')
  const [formFile, setFormFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  const mapelOptions = (() => {
    const map = new Map<string, string>()
    for (const a of assignments) {
      map.set(a.mata_pelajaran_id, a.mapel_nama ?? 'Mapel')
    }
    return Array.from(map.entries()).map(([id, nama]) => ({ id, nama }))
  })()

  const kelasForMapel = (mapelId: string) =>
    assignments.filter((a) => a.mata_pelajaran_id === mapelId)

  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        const [resAsg, resMateri] = await Promise.all([
          fetch('/api/teacher/mengajar'),
          fetch('/api/teacher/materi'),
        ])
        const asg = await resAsg.json().catch(() => null)
        const mt = await resMateri.json().catch(() => null)
        if (!cancelled) {
          setAssignments((asg?.assignments ?? []) as GuruAssignment[])
          setMateri((mt?.materi ?? []) as MateriItem[])
          if (!resMateri.ok && mt?.error) {
            setStatusMsg({ type: 'error', text: mt.error })
          }
        }
      } catch (err) {
        console.error('Gagal memuat materi:', err)
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
    setFormMapel('')
    setFormKelas([])
    setFormJudul('')
    setFormDeskripsi('')
    setFormFile(null)
  }

  const toggleKelas = (kelasId: string) => {
    setFormKelas((prev) =>
      prev.includes(kelasId) ? prev.filter((k) => k !== kelasId) : [...prev, kelasId]
    )
  }

  const handleSubmit = async () => {
    if (!formMapel || formKelas.length === 0 || !formJudul.trim()) {
      setStatusMsg({ type: 'error', text: 'Mapel, kelas tujuan, dan judul wajib diisi.' })
      return
    }
    if (!editing && !formDeskripsi.trim() && !formFile) {
      setStatusMsg({ type: 'error', text: 'Isi deskripsi atau unggah file materi.' })
      return
    }

    setSaving(true)
    setStatusMsg(null)
    try {
      let res: Response

      if (!editing && formFile) {
        const fd = new FormData()
        fd.append('mata_pelajaran_id', formMapel)
        fd.append('kelas_ids', JSON.stringify(formKelas))
        fd.append('judul', formJudul)
        if (formDeskripsi.trim()) fd.append('deskripsi', formDeskripsi)
        fd.append('file', formFile)
        res = await fetch('/api/teacher/materi', { method: 'POST', body: fd })
      } else if (editing) {
        const payload: Record<string, unknown> = {
          id: editing.id,
          judul: formJudul,
          deskripsi: formDeskripsi.trim() || null,
        }
        if (formMapel !== editing.mata_pelajaran_id || JSON.stringify(formKelas) !== JSON.stringify(editing.kelas.map((k) => k.kelas_id))) {
          payload.mata_pelajaran_id = formMapel
          payload.kelas_ids = formKelas
        }
        if (formFile) {
          const fd = new FormData()
          fd.append('id', editing.id)
          fd.append('judul', formJudul)
          fd.append('deskripsi', formDeskripsi.trim())
          fd.append('mata_pelajaran_id', formMapel)
          fd.append('kelas_ids', JSON.stringify(formKelas))
          fd.append('file', formFile)
          res = await fetch('/api/teacher/materi', { method: 'PUT', body: fd })
        } else {
          res = await fetch('/api/teacher/materi', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        }
      } else {
        res = await fetch('/api/teacher/materi', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mata_pelajaran_id: formMapel,
            kelas_ids: formKelas,
            judul: formJudul,
            deskripsi: formDeskripsi.trim() || null,
          }),
        })
      }

      if (res.ok) {
        setShowForm(false)
        resetForm()
        setStatusMsg({ type: 'success', text: editing ? 'Materi berhasil diperbarui.' : 'Materi berhasil ditambahkan.' })
        const mt = await fetch('/api/teacher/materi').then((r) => r.json()).catch(() => null)
        setMateri((mt?.materi ?? []) as MateriItem[])
      } else {
        const err = await res.json().catch(() => null)
        setStatusMsg({ type: 'error', text: err?.error ?? 'Gagal menyimpan materi.' })
      }
    } catch (err) {
      console.error('Gagal menyimpan materi:', err)
      setStatusMsg({ type: 'error', text: 'Terjadi kesalahan saat menyimpan materi.' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (m: MateriItem) => {
    if (!confirm(`Hapus materi "${m.judul}"?`)) return
    try {
      const res = await fetch(`/api/teacher/materi?id=${m.id}`, { method: 'DELETE' })
      if (res.ok) {
        setMateri((prev) => prev.filter((x) => x.id !== m.id))
        setStatusMsg({ type: 'success', text: 'Materi berhasil dihapus.' })
      } else {
        const err = await res.json().catch(() => null)
        setStatusMsg({ type: 'error', text: err?.error ?? 'Gagal menghapus materi.' })
      }
    } catch (err) {
      console.error('Gagal menghapus materi:', err)
      setStatusMsg({ type: 'error', text: 'Terjadi kesalahan saat menghapus materi.' })
    }
  }

  const unduhFile = async (m: MateriItem) => {
    try {
      const res = await fetch('/api/teacher/materi/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: m.id }),
      })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.url) {
        window.open(data.url, '_blank')
      } else {
        setStatusMsg({ type: 'error', text: data?.error ?? 'Gagal membuat tautan unduhan.' })
      }
    } catch (err) {
      console.error('Gagal mengunduh file:', err)
    }
  }

  const kelasOptionsForForm = kelasForMapel(formMapel)

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-16 flex flex-col items-center justify-center space-y-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
        <p className="text-sm font-medium text-gray-500">Memuat materi...</p>
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
        <p className="text-sm text-gray-500">{materi.length} materi dibuat</p>
        <button
          onClick={() => { resetForm(); setShowForm(true) }}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-sm transition-colors"
        >
          <Plus className="h-4 w-4" />
          Tambah Materi
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-900">{editing ? 'Edit Materi' : 'Tambah Materi Baru'}</h3>
            <button onClick={() => { setShowForm(false); resetForm() }} className="text-gray-400 hover:text-gray-700">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">Mata Pelajaran</label>
            <select
              value={formMapel}
              onChange={(e) => { setFormMapel(e.target.value); setFormKelas([]) }}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              <option value="">Pilih mapel</option>
              {mapelOptions.map((m) => (
                <option key={m.id} value={m.id}>{m.nama}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
              Kelas Tujuan
            </label>
            {!formMapel ? (
              <p className="text-xs text-gray-400 italic">Pilih mata pelajaran terlebih dahulu.</p>
            ) : kelasOptionsForForm.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Anda belum ditugaskan mengajar kelas untuk mapel ini.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {kelasOptionsForForm.map((k) => (
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
                    {k.kelas_nama}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">Judul *</label>
            <input
              value={formJudul}
              onChange={(e) => setFormJudul(e.target.value)}
              placeholder="cth: Pengenalan Algoritma"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">Deskripsi / Ringkasan</label>
            <textarea
              value={formDeskripsi}
              onChange={(e) => setFormDeskripsi(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
              File Materi {editing && editing.has_file && '(file sudah ada — unggah untuk mengganti)'} (maks 25MB)
            </label>
            <input
              type="file"
              onChange={(e) => setFormFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-gray-600 file:mr-4 file:px-4 file:py-2 file:rounded-lg file:border-0 file:bg-emerald-50 file:text-emerald-700 file:text-sm file:font-bold hover:file:bg-emerald-100"
            />
            {editing?.nama_file && !formFile && (
              <p className="text-xs text-gray-500 flex items-center gap-1.5">
                <Paperclip className="h-3.5 w-3.5" />
                {editing.nama_file}
              </p>
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
              {saving ? 'Menyimpan...' : editing ? 'Simpan Perubahan' : 'Tambah Materi'}
            </button>
          </div>
        </div>
      )}

      {assignments.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-16 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-50 mb-4">
            <GraduationCap className="h-10 w-10 text-gray-300" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">Belum ada penugasan</h3>
          <p className="text-sm text-gray-500">Hubungi admin untuk penugasan mengajar.</p>
        </div>
      ) : materi.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-16 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-50 mb-4">
            <BookOpen className="h-10 w-10 text-gray-300" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">Belum ada materi</h3>
          <p className="text-sm text-gray-500">Bagikan materi pertama untuk siswa Anda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {materi.map((m) => (
            <div key={m.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <h3 className="font-bold text-gray-900">{m.judul}</h3>
                  <p className="text-xs text-gray-500">
                    {m.mapel_nama ?? 'Mapel'}
                    {m.mapel_kode ? ` (${m.mapel_kode})` : ''}
                    {' · '}
                    {m.kelas.map((k) => k.nama_kelas).join(', ') || 'Tanpa kelas'}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setEditing(m)
                      setFormMapel(m.mata_pelajaran_id)
                      setFormKelas(m.kelas.map((k) => k.kelas_id))
                      setFormJudul(m.judul)
                      setFormDeskripsi(m.deskripsi ?? '')
                      setFormFile(null)
                      setShowForm(true)
                    }}
                    className="p-2 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50"
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(m)}
                    className="p-2 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50"
                    title="Hapus"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {m.deskripsi && (
                <p className="text-sm text-gray-600 whitespace-pre-line line-clamp-4">{m.deskripsi}</p>
              )}

              <div className="flex items-center justify-between">
                {m.has_file ? (
                  <button
                    onClick={() => unduhFile(m)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-bold hover:bg-blue-100"
                  >
                    <FileDown className="h-3.5 w-3.5" />
                    {m.nama_file ?? 'Unduh materi'}
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
                    <FileText className="h-3.5 w-3.5" />
                    Tanpa file
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
