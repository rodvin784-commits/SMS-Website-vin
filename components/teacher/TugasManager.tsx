'use client'

import { useEffect, useRef, useState } from 'react'
import {
  CalendarDays,
  Camera,
  CheckCircle2,
  ClipboardList,
  Clock,
  Download,
  FileText,
  GraduationCap,
  Image as ImageIcon,
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

type TugasItem = {
  id: string
  mata_pelajaran_id: string
  mapel_nama: string | null
  mapel_kode: string | null
  judul: string
  deskripsi: string | null
  tanggal_mulai: string | null
  deadline: string | null
  lampiran_url: string | null
  foto_urls: string[] | null
  status: string
  created_at: string
  kelas: KelasTarget[]
}

type SiswaPengumpulan = {
  siswa_id: string
  nis: string
  nama_lengkap: string
  kelas_nama: string | null
  pengumpulan: {
    id: string
    status: string
    nama_file: string | null
    has_file: boolean
    foto_urls: string[] | null
    has_foto: boolean
    jawaban_teks: string | null
    catatan: string | null
    submitted_at: string | null
    nilai: number | null
    feedback: string | null
    dinilai_at: string | null
  } | null
}

type DetailData = {
  tugas: { id: string; judul: string; deadline: string | null; mapel_nama: string | null }
  counts: { total: number; dikumpulkan: number; dinilai: number }
  siswa: SiswaPengumpulan[]
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  published: 'bg-emerald-50 text-emerald-700',
  closed: 'bg-rose-50 text-rose-700',
}

const PENGUMPULAN_STYLES: Record<string, string> = {
  belum_dikumpulkan: 'bg-gray-100 text-gray-500',
  dikumpulkan: 'bg-blue-50 text-blue-700',
  terlambat: 'bg-amber-50 text-amber-700',
  dinilai: 'bg-emerald-50 text-emerald-700',
}

function formatTanggal(v: string | null): string {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function TugasManager() {
  const [assignments, setAssignments] = useState<GuruAssignment[]>([])
  const [tugas, setTugas] = useState<TugasItem[]>([])
  const [loading, setLoading] = useState(true)
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Form
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<TugasItem | null>(null)
  const [formMapel, setFormMapel] = useState('')
  const [formKelas, setFormKelas] = useState<string[]>([])
  const [formJudul, setFormJudul] = useState('')
  const [formDeskripsi, setFormDeskripsi] = useState('')
  const [formTanggal, setFormTanggal] = useState('')
  const [formDeadline, setFormDeadline] = useState('')
  const [formStatus, setFormStatus] = useState('published')
  const [formFile, setFormFile] = useState<File | null>(null)
  const [formFotos, setFormFotos] = useState<File[]>([])
  const [fotoPreviews, setFotoPreviews] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  // Detail pengumpulan
  const [detail, setDetail] = useState<DetailData | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [tugasFotoPreview, setTugasFotoPreview] = useState<Record<string, string[]>>({})
  const [pengumpulanFotoPreview, setPengumpulanFotoPreview] = useState<Record<string, string[]>>({})
  const [nilaiForm, setNilaiForm] = useState<Record<string, { nilai: string; feedback: string }>>({})
  const [gradingId, setGradingId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const fotoPreviewsRef = useRef<string[]>([])
  useEffect(() => { fotoPreviewsRef.current = fotoPreviews }, [fotoPreviews])
  useEffect(() => {
    return () => {
      fotoPreviewsRef.current.forEach((u) => URL.revokeObjectURL(u))
    }
  }, [])

  // Mapel unik dari penugasan
  const mapelOptions = (() => {
    const map = new Map<string, string>()
    for (const a of assignments) {
      map.set(a.mata_pelajaran_id, a.mapel_nama ?? 'Mapel')
    }
    return Array.from(map.entries()).map(([id, nama]) => ({ id, nama }))
  })()

  // Kelas yang diajar untuk mapel terpilih
  const kelasForMapel = (mapelId: string) =>
    assignments.filter((a) => a.mata_pelajaran_id === mapelId)

  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        const [resAsg, resTugas] = await Promise.all([
          fetch('/api/teacher/mengajar'),
          fetch('/api/teacher/tugas'),
        ])
        const asg = await resAsg.json().catch(() => null)
        const tg = await resTugas.json().catch(() => null)
        if (!cancelled) {
          setAssignments((asg?.assignments ?? []) as GuruAssignment[])
          setTugas((tg?.tugas ?? []) as TugasItem[])
          if (!resTugas.ok && tg?.error) {
            setStatusMsg({ type: 'error', text: tg.error })
          }
        }
      } catch (err) {
        console.error('Gagal memuat tugas:', err)
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
    setFormTanggal('')
    setFormDeadline('')
    setFormStatus('published')
    setFormFile(null)
    setFormFotos([])
    fotoPreviews.forEach((u) => URL.revokeObjectURL(u))
    setFotoPreviews([])
  }

  const handleFotoChange = (files: FileList | null) => {
    if (!files) return
    const arr = Array.from(files).slice(0, 5 - formFotos.length)
    const valid: File[] = []
    const newPreviews: string[] = []
    for (const f of arr) {
      if (!f.type.startsWith('image/')) continue
      if (f.size > 8 * 1024 * 1024) {
        setStatusMsg({ type: 'error', text: `Foto "${f.name}" melebihi 8MB.` })
        continue
      }
      valid.push(f)
      newPreviews.push(URL.createObjectURL(f))
    }
    if (valid.length === 0) return
    setFormFotos((prev) => [...prev, ...valid].slice(0, 5))
    setFotoPreviews((prev) => [...prev, ...newPreviews].slice(0, 5))
  }

  const hapusFotoPreview = (idx: number) => {
    URL.revokeObjectURL(fotoPreviews[idx])
    setFormFotos((prev) => prev.filter((_, i) => i !== idx))
    setFotoPreviews((prev) => prev.filter((_, i) => i !== idx))
  }

  const muatFotoTugas = async (tugasId: string) => {
    if (tugasFotoPreview[tugasId]) return
    try {
      const res = await fetch('/api/teacher/tugas/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: tugasId }) })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.fotos) {
        setTugasFotoPreview((prev) => ({ ...prev, [tugasId]: (data.fotos as { url: string }[]).map((f) => f.url) }))
      }
    } catch { /* ignore */ }
  }

  const muatFotoPengumpulan = async (pengumpulanId: string) => {
    if (pengumpulanFotoPreview[pengumpulanId]) return
    try {
      const res = await fetch('/api/teacher/pengumpulan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pengumpulan_id: pengumpulanId }) })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.foto_urls) {
        setPengumpulanFotoPreview((prev) => ({ ...prev, [pengumpulanId]: data.foto_urls as string[] }))
      }
    } catch { /* ignore */ }
  }

  const bukaTambah = () => {
    resetForm()
    setShowForm(true)
  }

  const bukaEdit = (t: TugasItem) => {
    setEditing(t)
    setFormMapel(t.mata_pelajaran_id)
    setFormKelas(t.kelas.map((k) => k.kelas_id))
    setFormJudul(t.judul)
    setFormDeskripsi(t.deskripsi ?? '')
    setFormTanggal(t.tanggal_mulai ? t.tanggal_mulai.slice(0, 10) : '')
    setFormDeadline(t.deadline ? t.deadline.slice(0, 10) : '')
    setFormStatus(t.status)
    setFormFile(null)
    setFormFotos([])
    fotoPreviews.forEach((u) => URL.revokeObjectURL(u))
    setFotoPreviews([])
    setShowForm(true)
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

    setSaving(true)
    setStatusMsg(null)
    try {
      const hasFile = formFile !== null
      const hasFotos = formFotos.length > 0
      let res: Response

      if (!editing && (hasFile || hasFotos)) {
        const fd = new FormData()
        fd.append('mata_pelajaran_id', formMapel)
        fd.append('kelas_ids', JSON.stringify(formKelas))
        fd.append('judul', formJudul)
        if (formDeskripsi.trim()) fd.append('deskripsi', formDeskripsi)
        if (formTanggal) fd.append('tanggal_mulai', new Date(formTanggal).toISOString())
        if (formDeadline) fd.append('deadline', new Date(formDeadline).toISOString())
        fd.append('status', formStatus)
        if (hasFile) fd.append('lampiran', formFile!)
        for (const f of formFotos) fd.append('fotos', f)
        res = await fetch('/api/teacher/tugas', { method: 'POST', body: fd })
      } else if (editing && (hasFile || hasFotos)) {
        const fd = new FormData()
        fd.append('id', editing.id)
        fd.append('judul', formJudul)
        fd.append('deskripsi', formDeskripsi.trim() || '')
        if (formTanggal) fd.append('tanggal_mulai', new Date(formTanggal).toISOString())
        else fd.append('tanggal_mulai', '')
        if (formDeadline) fd.append('deadline', new Date(formDeadline).toISOString())
        else fd.append('deadline', '')
        fd.append('status', formStatus)
        // kelas jika berubah
        if (formMapel !== editing.mata_pelajaran_id || JSON.stringify(formKelas) !== JSON.stringify(editing.kelas.map((k) => k.kelas_id))) {
          fd.append('mata_pelajaran_id', formMapel)
          fd.append('kelas_ids', JSON.stringify(formKelas))
        }
        if (hasFile) fd.append('lampiran', formFile!)
        for (const f of formFotos) fd.append('fotos', f)
        res = await fetch('/api/teacher/tugas', { method: 'PUT', body: fd })
      } else if (editing) {
        const payload: Record<string, unknown> = {
          id: editing.id,
          judul: formJudul,
          deskripsi: formDeskripsi.trim() || null,
          tanggal_mulai: formTanggal ? new Date(formTanggal).toISOString() : null,
          deadline: formDeadline ? new Date(formDeadline).toISOString() : null,
          status: formStatus,
        }
        if (formMapel !== editing.mata_pelajaran_id || JSON.stringify(formKelas) !== JSON.stringify(editing.kelas.map((k) => k.kelas_id))) {
          payload.mata_pelajaran_id = formMapel
          payload.kelas_ids = formKelas
        }
        res = await fetch('/api/teacher/tugas', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        const payload: Record<string, unknown> = {
          mata_pelajaran_id: formMapel,
          kelas_ids: formKelas,
          judul: formJudul,
          deskripsi: formDeskripsi.trim() || null,
          tanggal_mulai: formTanggal ? new Date(formTanggal).toISOString() : null,
          deadline: formDeadline ? new Date(formDeadline).toISOString() : null,
          status: formStatus,
        }
        res = await fetch('/api/teacher/tugas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      if (res.ok) {
        setShowForm(false)
        resetForm()
        setStatusMsg({ type: 'success', text: editing ? 'Tugas berhasil diperbarui.' : 'Tugas berhasil dibuat.' })
        const tg = await fetch('/api/teacher/tugas').then((r) => r.json()).catch(() => null)
        setTugas((tg?.tugas ?? []) as TugasItem[])
      } else {
        const err = await res.json().catch(() => null)
        setStatusMsg({ type: 'error', text: err?.error ?? 'Gagal menyimpan tugas.' })
      }
    } catch (err) {
      console.error('Gagal menyimpan tugas:', err)
      setStatusMsg({ type: 'error', text: 'Terjadi kesalahan saat menyimpan tugas.' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (t: TugasItem) => {
    if (!confirm(`Hapus tugas "${t.judul}"? Semua data pengumpulan terkait akan hilang.`)) return
    try {
      const res = await fetch(`/api/teacher/tugas?id=${t.id}`, { method: 'DELETE' })
      if (res.ok) {
        setTugas((prev) => prev.filter((x) => x.id !== t.id))
        setStatusMsg({ type: 'success', text: 'Tugas berhasil dihapus.' })
      } else {
        const err = await res.json().catch(() => null)
        setStatusMsg({ type: 'error', text: err?.error ?? 'Gagal menghapus tugas.' })
      }
    } catch (err) {
      console.error('Gagal menghapus tugas:', err)
      setStatusMsg({ type: 'error', text: 'Terjadi kesalahan saat menghapus tugas.' })
    }
  }

  const bukaDetail = async (t: TugasItem) => {
    setLoadingDetail(true)
    setDetail(null)
    try {
      const res = await fetch(`/api/teacher/pengumpulan?tugas_id=${t.id}`)
      const data = await res.json().catch(() => null)
      if (res.ok) {
        setDetail(data as DetailData)
      } else {
        setStatusMsg({ type: 'error', text: data?.error ?? 'Gagal memuat pengumpulan.' })
      }
    } catch (err) {
      console.error('Gagal memuat pengumpulan:', err)
      setStatusMsg({ type: 'error', text: 'Terjadi kesalahan saat memuat pengumpulan.' })
    } finally {
      setLoadingDetail(false)
    }
  }

  const unduhFile = async (pengumpulanId: string) => {
    try {
      const res = await fetch('/api/teacher/pengumpulan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pengumpulan_id: pengumpulanId }),
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

  const simpanNilai = async (pengumpulanId: string) => {
    const form = nilaiForm[pengumpulanId]
    if (!form || form.nilai.trim() === '') {
      setStatusMsg({ type: 'error', text: 'Nilai wajib diisi (0-100).' })
      return
    }
    const nilaiNum = Number(form.nilai)
    if (Number.isNaN(nilaiNum) || nilaiNum < 0 || nilaiNum > 100) {
      setStatusMsg({ type: 'error', text: 'Nilai harus 0-100.' })
      return
    }
    setGradingId(pengumpulanId)
    try {
      const res = await fetch('/api/teacher/pengumpulan/nilai', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pengumpulan_id: pengumpulanId, nilai: nilaiNum, feedback: form.feedback }),
      })
      const data = await res.json().catch(() => null)
      if (res.ok) {
        setStatusMsg({ type: 'success', text: 'Nilai berhasil disimpan.' })
        if (detail) {
          setDetail({
            ...detail,
            siswa: detail.siswa.map((s) => s.pengumpulan?.id === pengumpulanId ? { ...s, pengumpulan: s.pengumpulan ? { ...s.pengumpulan, nilai: nilaiNum, feedback: form.feedback || null, status: 'dinilai', dinilai_at: new Date().toISOString() } : null } : s),
          })
        }
      } else {
        setStatusMsg({ type: 'error', text: data?.error ?? 'Gagal menyimpan nilai.' })
      }
    } catch (err) {
      console.error(err)
      setStatusMsg({ type: 'error', text: 'Terjadi kesalahan.' })
    } finally {
      setGradingId(null)
    }
  }

  const kelasOptionsForForm = kelasForMapel(formMapel)

  const filteredTugas = tugas.filter((t) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      t.judul.toLowerCase().includes(q) ||
      (t.deskripsi ?? '').toLowerCase().includes(q) ||
      (t.mapel_nama ?? '').toLowerCase().includes(q) ||
      (t.mapel_kode ?? '').toLowerCase().includes(q) ||
      t.kelas.some((k) => (k.nama_kelas ?? '').toLowerCase().includes(q))
    )
  })

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-16 flex flex-col items-center justify-center space-y-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
        <p className="text-sm font-medium text-gray-500">Memuat tugas...</p>
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

      {/* Header + search + tombol tambah */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          <p className="text-sm text-gray-500 whitespace-nowrap">{tugas.length} tugas</p>
          <div className="relative flex-1 max-w-sm">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari judul, mapel, deskripsi…"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-1 focus:ring-gray-900 placeholder:text-gray-400"
            />
            <span className="absolute left-3 top-2.5 text-gray-400 text-sm">⌕</span>
          </div>
        </div>
        <button
          onClick={bukaTambah}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-900 hover:bg-black text-white text-sm font-semibold transition-colors"
        >
          <Plus className="h-4 w-4" />
          Buat Tugas
        </button>
      </div>

      {/* Form tambah/edit */}
      {showForm && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-900">
              {editing ? 'Edit Tugas' : 'Buat Tugas Baru'}
            </h3>
            <button onClick={() => { setShowForm(false); resetForm() }} className="text-gray-400 hover:text-gray-700">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">Status</label>
              <select
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                <option value="draft">Draf (belum terlihat siswa)</option>
                <option value="published">Publish</option>
                <option value="closed">Ditutup</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
              Kelas Tujuan {formMapel && kelasOptionsForForm.length > 0 && `(${kelasOptionsForForm.length} kelas Anda untuk mapel ini)`}
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
              placeholder="cth: Tugas 1 — Algoritma Pemrograman"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">Deskripsi / Instruksi</label>
            <textarea
              value={formDeskripsi}
              onChange={(e) => setFormDeskripsi(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">Tanggal Mulai</label>
              <input
                type="date"
                value={formTanggal}
                onChange={(e) => setFormTanggal(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">Deadline</label>
              <input
                type="date"
                value={formDeadline}
                onChange={(e) => setFormDeadline(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
              Lampiran File (opsional, maks 15MB)
            </label>
            <input
              type="file"
              onChange={(e) => setFormFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-gray-600 file:mr-4 file:px-4 file:py-2 file:rounded-lg file:border-0 file:bg-emerald-50 file:text-emerald-700 file:text-sm file:font-bold hover:file:bg-emerald-100"
            />
            {editing && editing.lampiran_url && <p className="text-xs text-gray-500">Lampiran lama akan diganti jika memilih file baru.</p>}
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
              Foto Tugas (opsional, maks 5 foto, 8MB/foto) <span className="normal-case font-normal text-gray-500">— jepret atau pilih dari galeri</span>
            </label>
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-sm font-bold cursor-pointer hover:bg-emerald-100 border border-emerald-200">
                <ImageIcon className="h-4 w-4" />
                Pilih Foto
                <input type="file" accept="image/*" multiple onChange={(e) => handleFotoChange(e.target.files)} className="hidden" />
              </label>
              <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50 text-blue-700 text-sm font-bold cursor-pointer hover:bg-blue-100 border border-blue-200">
                <Camera className="h-4 w-4" />
                Ambil Foto
                <input type="file" accept="image/*" capture="environment" onChange={(e) => handleFotoChange(e.target.files)} className="hidden" />
              </label>
              {formFotos.length > 0 && <span className="text-xs text-gray-500 self-center">{formFotos.length}/5 foto dipilih</span>}
            </div>
            {fotoPreviews.length > 0 && (
              <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                {fotoPreviews.map((src, idx) => (
                  <div key={idx} className="relative group">
                    <img src={src} alt={`Preview ${idx + 1}`} className="w-full h-24 object-cover rounded-xl border border-gray-200" />
                    <button type="button" onClick={() => hapusFotoPreview(idx)} className="absolute -top-2 -right-2 bg-rose-600 text-white rounded-full p-1 shadow-md hover:bg-rose-700">
                      <X className="h-3 w-3" />
                    </button>
                    <p className="text-[10px] text-gray-500 truncate mt-1">{formFotos[idx]?.name}</p>
                  </div>
                ))}
              </div>
            )}
            {editing && editing.foto_urls && editing.foto_urls.length > 0 && formFotos.length === 0 && (
              <p className="text-xs text-gray-500">Tugas ini memiliki {editing.foto_urls.length} foto. Tambah foto baru akan ditambahkan (maks 5).</p>
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
              {saving ? 'Menyimpan...' : editing ? 'Simpan Perubahan' : 'Buat Tugas'}
            </button>
          </div>
        </div>
      )}

      {/* Daftar tugas */}
      {assignments.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-16 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-50 mb-4">
            <GraduationCap className="h-10 w-10 text-gray-300" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">Belum ada penugasan</h3>
          <p className="text-sm text-gray-500">Hubungi admin untuk penugasan mengajar.</p>
        </div>
      ) : filteredTugas.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center">
          <p className="text-sm text-gray-500">{tugas.length === 0 ? 'Buat tugas pertama untuk siswa Anda.' : `Tidak ada hasil untuk "${searchQuery}"`}</p>
          {searchQuery && <button onClick={() => setSearchQuery('')} className="mt-3 text-sm text-gray-900 underline">Hapus filter</button>}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTugas.map((t) => (
            <div key={t.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-gray-900">{t.judul}</h3>
                    <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold ${STATUS_STYLES[t.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {t.status === 'published' ? 'Publish' : t.status === 'closed' ? 'Ditutup' : 'Draf'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {t.mapel_nama ?? 'Mapel'}
                    {t.mapel_kode ? ` (${t.mapel_kode})` : ''}
                    {' · '}
                    {t.kelas.map((k) => k.nama_kelas).join(', ') || 'Tanpa kelas'}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => bukaDetail(t)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-bold hover:bg-blue-100"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Pengumpulan
                  </button>
                  <button
                    onClick={() => bukaEdit(t)}
                    className="p-2 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50"
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(t)}
                    className="p-2 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50"
                    title="Hapus"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {t.deskripsi && (
                <p className="text-sm text-gray-600 whitespace-pre-line">{t.deskripsi}</p>
              )}

              {t.foto_urls && t.foto_urls.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-600">
                    <ImageIcon className="h-3.5 w-3.5" />
                    Foto Tugas ({t.foto_urls.length})
                    {!tugasFotoPreview[t.id] && (
                      <button onClick={() => muatFotoTugas(t.id)} className="ml-2 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-[11px]">Lihat Foto</button>
                    )}
                  </div>
                  {tugasFotoPreview[t.id] && (
                    <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                      {tugasFotoPreview[t.id].map((url, idx) => (
                        <a key={idx} href={url} target="_blank" rel="noopener noreferrer">
                          <img src={url} alt={`Foto ${idx + 1}`} className="w-full h-24 object-cover rounded-xl border border-gray-200 hover:opacity-90" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Mulai: {formatTanggal(t.tanggal_mulai)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Deadline: {formatTanggal(t.deadline)}
                </span>
                {t.lampiran_url && (
                  <span className="inline-flex items-center gap-1.5">
                    <Paperclip className="h-3.5 w-3.5" />
                    Lampiran tersedia
                  </span>
                )}
                {t.foto_urls && t.foto_urls.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-emerald-600">
                    <ImageIcon className="h-3.5 w-3.5" />
                    {t.foto_urls.length} foto
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal detail pengumpulan */}
      {(loadingDetail || detail) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
            {loadingDetail || !detail ? (
              <div className="p-16 flex flex-col items-center justify-center space-y-3">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
                <p className="text-sm font-medium text-gray-500">Memuat pengumpulan...</p>
              </div>
            ) : (
              <>
                <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-gray-900">{detail.tugas.judul}</h3>
                    <p className="text-xs text-gray-500">
                      {detail.tugas.mapel_nama} · Deadline: {formatTanggal(detail.tugas.deadline)}
                    </p>
                  </div>
                  <button onClick={() => setDetail(null)} className="text-gray-400 hover:text-gray-700">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="px-6 py-3 border-b border-gray-100 flex flex-wrap gap-3 text-xs font-bold">
                  <span className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600">
                    Total: {detail.counts.total}
                  </span>
                  <span className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700">
                    Terkumpul: {detail.counts.dikumpulkan}
                  </span>
                  <span className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700">
                    Dinilai: {detail.counts.dinilai}
                  </span>
                </div>

                <div className="overflow-y-auto flex-1">
                  {detail.siswa.length === 0 ? (
                    <p className="p-10 text-center text-sm text-gray-500">
                      Tidak ada siswa di kelas target tugas ini.
                    </p>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0">
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="py-3 px-4 text-xs font-bold text-gray-700 uppercase tracking-wider">Siswa</th>
                          <th className="py-3 px-4 text-xs font-bold text-gray-700 uppercase tracking-wider">Status</th>
                          <th className="py-3 px-4 text-xs font-bold text-gray-700 uppercase tracking-wider">Jawaban</th>
                          <th className="py-3 px-4 text-xs font-bold text-gray-700 uppercase tracking-wider">Nilai</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {detail.siswa.map((s) => {
                          const p = s.pengumpulan
                          const formVal = nilaiForm[p?.id ?? s.siswa_id] ?? { nilai: p?.nilai !== null && p?.nilai !== undefined ? String(p.nilai) : '', feedback: p?.feedback ?? '' }
                          return (
                          <tr key={s.siswa_id} className="hover:bg-gray-50/80">
                            <td className="py-3 px-4 align-top">
                              <p className="text-sm font-medium text-gray-900">{s.nama_lengkap}</p>
                              <p className="text-xs text-gray-400">{s.kelas_nama} · NIS {s.nis}</p>
                            </td>
                            <td className="py-3 px-4 align-top">
                              <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${PENGUMPULAN_STYLES[p?.status ?? 'belum_dikumpulkan']}`}>
                                {(p?.status ?? 'belum_dikumpulkan').replace(/_/g, ' ')}
                              </span>
                              {p?.nilai !== null && p?.nilai !== undefined && (
                                <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 text-amber-700 text-xs font-bold border border-amber-100">
                                  Nilai: {p.nilai}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4 align-top">
                              <div className="space-y-1.5 max-w-[220px]">
                                {p?.jawaban_teks && (
                                  <p className="text-xs text-gray-700 whitespace-pre-line line-clamp-4" title={p.jawaban_teks}>
                                    {p.jawaban_teks}
                                  </p>
                                )}
                                {p?.has_file && (
                                  <button
                                    onClick={() => unduhFile(p!.id)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold hover:bg-emerald-100"
                                  >
                                    <Download className="h-3.5 w-3.5" />
                                    {p.nama_file ?? 'Unduh file'}
                                  </button>
                                )}
                                {p?.has_foto && (
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                                      <ImageIcon className="h-3 w-3" /> {p.foto_urls?.length ?? 0} foto
                                      {!pengumpulanFotoPreview[p.id] && (
                                        <button onClick={() => muatFotoPengumpulan(p!.id)} className="ml-1 px-2 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-[10px]">Lihat</button>
                                      )}
                                    </div>
                                    {pengumpulanFotoPreview[p.id] && (
                                      <div className="grid grid-cols-3 gap-1">
                                        {pengumpulanFotoPreview[p.id].map((url, idx) => (
                                          <a key={idx} href={url} target="_blank" rel="noopener noreferrer">
                                            <img src={url} alt={`Foto ${idx + 1}`} className="w-full h-16 object-cover rounded-lg border border-gray-200" />
                                          </a>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                                {p?.feedback && (
                                  <div className="p-2 rounded-lg bg-amber-50 border border-amber-100 text-xs text-amber-800">
                                    <b>Feedback:</b> {p.feedback}
                                  </div>
                                )}
                                {!p?.has_file && !p?.has_foto && !p?.jawaban_teks && (
                                  <span className="text-xs text-gray-400 italic">—</span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4 align-top">
                              {!p ? (
                                <span className="text-xs text-gray-400 italic">Belum kumpul</span>
                              ) : (
                                <div className="space-y-2 min-w-[160px]">
                                  <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    placeholder="0-100"
                                    value={formVal.nilai}
                                    onChange={(e) => setNilaiForm((prev) => ({ ...prev, [p.id]: { nilai: e.target.value, feedback: (prev[p.id]?.feedback ?? p.feedback ?? '') } }))}
                                    className="w-20 px-2 py-1.5 rounded-lg border border-gray-200 text-xs text-center focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                  />
                                  <textarea
                                    placeholder="Feedback (opsional)"
                                    value={formVal.feedback}
                                    onChange={(e) => setNilaiForm((prev) => ({ ...prev, [p.id]: { nilai: prev[p.id]?.nilai ?? formVal.nilai, feedback: e.target.value } }))}
                                    rows={2}
                                    className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
                                  />
                                  <button
                                    onClick={() => simpanNilai(p.id)}
                                    disabled={gradingId === p.id}
                                    className="w-full px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-50"
                                  >
                                    {gradingId === p.id ? 'Menyimpan...' : p.status === 'dinilai' ? 'Update Nilai' : 'Simpan Nilai'}
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                          )})}
                      </tbody>
                    </table>
                  )}
                </div>

                <div className="px-6 py-3 border-t border-gray-100 flex items-center gap-2 text-xs text-gray-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Penilaian status pengumpulan (dinilai/terlambat) mengikuti alur aplikasi siswa.
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
