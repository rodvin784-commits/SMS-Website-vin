'use client'

import { useCallback, useEffect, useState } from 'react'
import { BookOpen, FileText, GraduationCap, Pencil, Plus, Trash2, Video } from 'lucide-react'

type GuruAssignment = {
  id: string
  mapel_nama: string | null
  mapel_kode: string | null
  kelas_nama: string | null
  tingkat: number | null
  tahun_ajaran: string | null
}

type MateriItem = {
  id: string
  guru_mengajar_id: string
  judul: string
  deskripsi: string | null
  video_url: string | null
  materi_url: string | null
  status: boolean
  updated_at: string
  mapel_nama: string | null
  mapel_kode: string | null
  kelas_nama: string | null
  tingkat: number | null
  tahun_ajaran: string | null
}

type FormState = {
  guru_mengajar_id: string
  judul: string
  deskripsi: string
  video_url: string
  materi_url: string
  status: boolean
}

const FORM_KOSONG: FormState = {
  guru_mengajar_id: '',
  judul: '',
  deskripsi: '',
  video_url: '',
  materi_url: '',
  status: true,
}

export function MateriAjarManager() {
  const [assignments, setAssignments] = useState<GuruAssignment[]>([])
  const [materi, setMateri] = useState<MateriItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(FORM_KOSONG)
  const [deleteTarget, setDeleteTarget] = useState<MateriItem | null>(null)

  const muatData = useCallback(async (cancelled: boolean) => {
    try {
      const [asgRes, matRes] = await Promise.all([
        fetch('/api/teacher/mengajar'),
        fetch('/api/teacher/materi'),
      ])
      const asgData = await asgRes.json().catch(() => null)
      const matData = await matRes.json().catch(() => null)
      if (!cancelled) {
        if (asgRes.ok) setAssignments((asgData?.assignments ?? []) as GuruAssignment[])
        if (matRes.ok) setMateri((matData?.materi ?? []) as MateriItem[])
        if (!matRes.ok && matData?.error) {
          setFeedback({ type: 'error', text: matData.error })
        }
      }
    } catch (err) {
      console.error('Gagal memuat materi:', err)
      if (!cancelled) setFeedback({ type: 'error', text: 'Terjadi kesalahan saat memuat materi.' })
    } finally {
      if (!cancelled) setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function init() {
      await muatData(cancelled)
    }

    void init()

    return () => {
      cancelled = true
    }
  }, [muatData])

  const bukaModalTambah = () => {
    setEditingId(null)
    setForm({ ...FORM_KOSONG, guru_mengajar_id: assignments[0]?.id ?? '' })
    setFeedback(null)
    setModalOpen(true)
  }

  const bukaModalEdit = (m: MateriItem) => {
    setEditingId(m.id)
    setForm({
      guru_mengajar_id: m.guru_mengajar_id,
      judul: m.judul,
      deskripsi: m.deskripsi ?? '',
      video_url: m.video_url ?? '',
      materi_url: m.materi_url ?? '',
      status: m.status,
    })
    setFeedback(null)
    setModalOpen(true)
  }

  const handleSimpan = async () => {
    if (!form.judul.trim()) {
      setFeedback({ type: 'error', text: 'Judul materi wajib diisi.' })
      return
    }
    if (!editingId && !form.guru_mengajar_id) {
      setFeedback({ type: 'error', text: 'Pilih mapel & kelas terlebih dahulu.' })
      return
    }
    if (!form.deskripsi.trim() && !form.video_url.trim() && !form.materi_url.trim()) {
      setFeedback({ type: 'error', text: 'Isi minimal salah satu: deskripsi, URL video, atau URL materi.' })
      return
    }

    setSaving(true)
    setFeedback(null)
    try {
      const res = await fetch('/api/teacher/materi', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          editingId
            ? {
                id: editingId,
                judul: form.judul,
                deskripsi: form.deskripsi,
                video_url: form.video_url,
                materi_url: form.materi_url,
                status: form.status,
              }
            : {
                guru_mengajar_id: form.guru_mengajar_id,
                judul: form.judul,
                deskripsi: form.deskripsi,
                video_url: form.video_url,
                materi_url: form.materi_url,
              }
        ),
      })
      const data = await res.json().catch(() => null)
      if (res.ok) {
        setModalOpen(false)
        setFeedback({ type: 'success', text: data?.message ?? 'Materi tersimpan.' })
        await muatData(false)
      } else {
        setFeedback({ type: 'error', text: data?.error ?? 'Gagal menyimpan materi.' })
      }
    } catch (err) {
      console.error('Gagal menyimpan materi:', err)
      setFeedback({ type: 'error', text: 'Terjadi kesalahan saat menyimpan materi.' })
    } finally {
      setSaving(false)
    }
  }

  const handleHapus = async () => {
    if (!deleteTarget) return
    setSaving(true)
    try {
      const res = await fetch(`/api/teacher/materi?id=${deleteTarget.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => null)
      if (res.ok) {
        setDeleteTarget(null)
        setFeedback({ type: 'success', text: data?.message ?? 'Materi berhasil dihapus.' })
        await muatData(false)
      } else {
        setFeedback({ type: 'error', text: data?.error ?? 'Gagal menghapus materi.' })
      }
    } catch (err) {
      console.error('Gagal menghapus materi:', err)
      setFeedback({ type: 'error', text: 'Terjadi kesalahan saat menghapus materi.' })
    } finally {
      setSaving(false)
    }
  }

  const labelAssignment = (a: GuruAssignment) =>
    `${a.mapel_nama ?? 'Mapel'} — Kelas ${a.tingkat ?? ''} ${a.kelas_nama ?? ''} (${a.tahun_ajaran ?? ''})`

  const infoAssignment = (m: MateriItem) =>
    `${m.mapel_nama ?? 'Mapel'} · Kelas ${m.tingkat ?? ''} ${m.kelas_nama ?? ''}`

  const formatTanggal = (s: string) => {
    try {
      return new Date(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
    } catch {
      return s
    }
  }

  return (
    <div className="space-y-6">
      {/* Header aksi */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">
          {materi.length} materi tersimpan. Materi bisa berupa deskripsi, video (YouTube/Drive), atau tautan dokumen.
        </p>
        <button
          onClick={bukaModalTambah}
          disabled={assignments.length === 0}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="h-4 w-4" />
          Tambah Materi
        </button>
      </div>

      {feedback && (
        <div
          className={`px-5 py-3 rounded-xl text-sm font-medium ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
              : 'bg-rose-50 text-rose-700 border border-rose-100'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Daftar materi */}
      {loading ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 flex flex-col items-center justify-center space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
          <p className="text-sm font-medium text-gray-500">Memuat materi...</p>
        </div>
      ) : assignments.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-50 mb-3">
            <GraduationCap className="h-8 w-8 text-gray-300" />
          </div>
          <h3 className="text-base font-bold text-gray-900 mb-1">Belum ada penugasan</h3>
          <p className="text-sm text-gray-500">
            Admin belum mengatur mata pelajaran dan kelas untuk Anda. Hubungi admin untuk menambahkan penugasan terlebih dahulu.
          </p>
        </div>
      ) : materi.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-50 mb-3">
            <BookOpen className="h-8 w-8 text-gray-300" />
          </div>
          <h3 className="text-base font-bold text-gray-900 mb-1">Belum ada materi</h3>
          <p className="text-sm text-gray-500">
            Klik &ldquo;Tambah Materi&rdquo; untuk mengunggah ringkasan materi dan video pembelajaran pertama Anda.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {materi.map((m) => (
            <div
              key={m.id}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-3 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-bold text-gray-900 leading-snug">{m.judul}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{infoAssignment(m)}</p>
                </div>
                <span
                  className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold ${
                    m.status ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {m.status ? 'Tampil' : 'Draf'}
                </span>
              </div>

              {m.deskripsi && (
                <p className="text-sm text-gray-600 line-clamp-3 whitespace-pre-line">{m.deskripsi}</p>
              )}

              <div className="flex flex-wrap gap-2 mt-auto">
                {m.video_url && (
                  <a
                    href={m.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 text-xs font-bold hover:bg-rose-100 transition-colors"
                  >
                    <Video className="h-3.5 w-3.5" />
                    Video
                  </a>
                )}
                {m.materi_url && (
                  <a
                    href={m.materi_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-bold hover:bg-blue-100 transition-colors"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Dokumen
                  </a>
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                <span className="text-xs text-gray-400">Diperbarui {formatTanggal(m.updated_at)}</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => bukaModalEdit(m)}
                    className="p-2 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-all"
                    title="Edit materi"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(m)}
                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    title="Hapus materi"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal tambah/edit */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/60" onClick={() => setModalOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900">
                {editingId ? 'Edit Materi' : 'Tambah Materi'}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                aria-label="Tutup"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                void handleSimpan()
              }}
              className="p-6 space-y-4"
            >
              {!editingId && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                    Mapel & Kelas <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.guru_mengajar_id}
                    onChange={(e) => setForm((f) => ({ ...f, guru_mengajar_id: e.target.value }))}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  >
                    <option value="">-- Pilih penugasan --</option>
                    {assignments.map((a) => (
                      <option key={a.id} value={a.id}>
                        {labelAssignment(a)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                  Judul Materi <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.judul}
                  onChange={(e) => setForm((f) => ({ ...f, judul: e.target.value }))}
                  placeholder="Contoh: Matriks & Transformasi — Pertemuan 1"
                  maxLength={150}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                  Deskripsi / Ringkasan Materi
                </label>
                <textarea
                  value={form.deskripsi}
                  onChange={(e) => setForm((f) => ({ ...f, deskripsi: e.target.value }))}
                  rows={4}
                  placeholder="Ringkasan materi, poin penting, atau tugas untuk siswa..."
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-y"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                  URL Video Pembelajaran
                </label>
                <input
                  type="url"
                  value={form.video_url}
                  onChange={(e) => setForm((f) => ({ ...f, video_url: e.target.value }))}
                  placeholder="https://youtube.com/watch?v=..."
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
                <p className="text-xs text-gray-400">Tautan YouTube, Google Drive, atau LMS lain.</p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                  URL Dokumen Materi
                </label>
                <input
                  type="url"
                  value={form.materi_url}
                  onChange={(e) => setForm((f) => ({ ...f, materi_url: e.target.value }))}
                  placeholder="https://docs.google.com/..."
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
                <p className="text-xs text-gray-400">Tautan modul/PDF/slide untuk dibaca siswa.</p>
              </div>

              {editingId && (
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                    Status
                  </label>
                  <div className="flex items-center space-x-6">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        checked={form.status === true}
                        onChange={() => setForm((f) => ({ ...f, status: true }))}
                        className="h-4 w-4 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-sm text-gray-700">Tampil ke siswa</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        checked={form.status === false}
                        onChange={() => setForm((f) => ({ ...f, status: false }))}
                        className="h-4 w-4 text-gray-600 focus:ring-gray-500"
                      />
                      <span className="text-sm text-gray-700">Draf (disembunyikan)</span>
                    </label>
                  </div>
                </div>
              )}

              <div className="pt-4 flex items-center space-x-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 px-5 py-3 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Menyimpan...' : editingId ? 'Simpan Perubahan' : 'Tambah Materi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal konfirmasi hapus */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/60" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-red-50 mb-3">
              <Trash2 className="h-7 w-7 text-red-500" />
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-1">Hapus materi ini?</h3>
            <p className="text-sm text-gray-500 mb-5">
              &ldquo;{deleteTarget.judul}&rdquo; akan dihapus permanen dan tidak bisa dikembalikan.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 px-5 py-3 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={() => void handleHapus()}
                disabled={saving}
                className="flex-1 px-5 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition-colors disabled:opacity-50"
              >
                {saving ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
