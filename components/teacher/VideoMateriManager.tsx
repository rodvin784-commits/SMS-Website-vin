'use client'

import { useEffect, useState } from 'react'
import {
  ExternalLink,
  GraduationCap,
  Pencil,
  Plus,
  Send,
  Trash2,
  Video,
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

function youtubeIdFromUrl(url: string | null): string | null {
  if (!url) return null
  const m = String(url).match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([\w-]{11})/)
  return m ? m[1] : null
}
function youtubeThumbnail(url: string | null): string | null {
  const id = youtubeIdFromUrl(url)
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null
}
function thumbFor(v: VideoItem): string | null {
  return v.thumbnail_url || youtubeThumbnail(v.video_url)
}

type VideoItem = {
  id: string
  mata_pelajaran_id: string
  mapel_nama: string | null
  mapel_kode: string | null
  judul: string
  deskripsi: string | null
  video_url: string | null
  thumbnail_url: string | null
  created_at: string
  kelas: KelasTarget[]
}

export function VideoMateriManager() {
  const [assignments, setAssignments] = useState<GuruAssignment[]>([])
  const [video, setVideo] = useState<VideoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<VideoItem | null>(null)
  const [formMapel, setFormMapel] = useState('')
  const [formKelas, setFormKelas] = useState<string[]>([])
  const [formJudul, setFormJudul] = useState('')
  const [formDeskripsi, setFormDeskripsi] = useState('')
  const [formUrl, setFormUrl] = useState('')
  const [formThumb, setFormThumb] = useState('')
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
        const [resAsg, resVideo] = await Promise.all([
          fetch('/api/teacher/mengajar'),
          fetch('/api/teacher/video'),
        ])
        const asg = await resAsg.json().catch(() => null)
        const vd = await resVideo.json().catch(() => null)
        if (!cancelled) {
          setAssignments((asg?.assignments ?? []) as GuruAssignment[])
          setVideo((vd?.video ?? []) as VideoItem[])
          if (!resVideo.ok && vd?.error) {
            setStatusMsg({ type: 'error', text: vd.error })
          }
        }
      } catch (err) {
        console.error('Gagal memuat video:', err)
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
    setFormUrl('')
    setFormThumb('')
  }

  const toggleKelas = (kelasId: string) => {
    setFormKelas((prev) =>
      prev.includes(kelasId) ? prev.filter((k) => k !== kelasId) : [...prev, kelasId]
    )
  }

  const handleSubmit = async () => {
    if (!formMapel || formKelas.length === 0 || !formJudul.trim() || !formUrl.trim()) {
      setStatusMsg({ type: 'error', text: 'Mapel, kelas tujuan, judul, dan URL video wajib diisi.' })
      return
    }

    setSaving(true)
    setStatusMsg(null)
    try {
      const payload = {
        mata_pelajaran_id: formMapel,
        kelas_ids: formKelas,
        judul: formJudul,
        deskripsi: formDeskripsi.trim() || null,
        video_url: formUrl.trim(),
        thumbnail_url: formThumb.trim() || null,
      }

      const res = editing
        ? await fetch('/api/teacher/video', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...payload, id: editing.id }),
          })
        : await fetch('/api/teacher/video', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })

      if (res.ok) {
        setShowForm(false)
        resetForm()
        setStatusMsg({ type: 'success', text: editing ? 'Video berhasil diperbarui.' : 'Video berhasil ditambahkan.' })
        const vd = await fetch('/api/teacher/video').then((r) => r.json()).catch(() => null)
        setVideo((vd?.video ?? []) as VideoItem[])
      } else {
        const err = await res.json().catch(() => null)
        setStatusMsg({ type: 'error', text: err?.error ?? 'Gagal menyimpan video.' })
      }
    } catch (err) {
      console.error('Gagal menyimpan video:', err)
      setStatusMsg({ type: 'error', text: 'Terjadi kesalahan saat menyimpan video.' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (v: VideoItem) => {
    if (!confirm(`Hapus video "${v.judul}"?`)) return
    try {
      const res = await fetch(`/api/teacher/video?id=${v.id}`, { method: 'DELETE' })
      if (res.ok) {
        setVideo((prev) => prev.filter((x) => x.id !== v.id))
        setStatusMsg({ type: 'success', text: 'Video berhasil dihapus.' })
      } else {
        const err = await res.json().catch(() => null)
        setStatusMsg({ type: 'error', text: err?.error ?? 'Gagal menghapus video.' })
      }
    } catch (err) {
      console.error('Gagal menghapus video:', err)
      setStatusMsg({ type: 'error', text: 'Terjadi kesalahan saat menghapus video.' })
    }
  }

  const bukaEdit = (v: VideoItem) => {
    setEditing(v)
    setFormMapel(v.mata_pelajaran_id)
    setFormKelas(v.kelas.map((k) => k.kelas_id))
    setFormJudul(v.judul)
    setFormDeskripsi(v.deskripsi ?? '')
    setFormUrl(v.video_url ?? '')
    setFormThumb(v.thumbnail_url ?? '')
    setShowForm(true)
  }

  const kelasOptionsForForm = kelasForMapel(formMapel)

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-16 flex flex-col items-center justify-center space-y-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
        <p className="text-sm font-medium text-gray-500">Memuat video...</p>
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
        <p className="text-sm text-gray-500">{video.length} video dibagikan</p>
        <button
          onClick={() => { resetForm(); setShowForm(true) }}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-sm transition-colors"
        >
          <Plus className="h-4 w-4" />
          Tambah Video
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-900">{editing ? 'Edit Video' : 'Tambah Video Baru'}</h3>
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
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">Kelas Tujuan</label>
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
              placeholder="cth: Pengenalan HTML"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">URL Video * (YouTube, Drive, dll)</label>
            <input
              value={formUrl}
              onChange={(e) => setFormUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=..."
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">URL Thumbnail (opsional — otomatis dari YouTube jika kosong)</label>
            <input
              value={formThumb}
              onChange={(e) => setFormThumb(e.target.value)}
              placeholder="https://... (kosongkan untuk auto)"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
            {(youtubeThumbnail(formUrl) || formThumb) && (
              <div className="pt-2">
                <p className="text-xs text-gray-500 mb-1">Preview thumbnail:</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={formThumb.trim() || youtubeThumbnail(formUrl) || ''} alt="Preview" className="w-full h-32 object-cover rounded-xl border border-gray-200" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">Deskripsi</label>
            <textarea
              value={formDeskripsi}
              onChange={(e) => setFormDeskripsi(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
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
              {saving ? 'Menyimpan...' : editing ? 'Simpan Perubahan' : 'Tambah Video'}
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
      ) : video.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-16 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-50 mb-4">
            <Video className="h-10 w-10 text-gray-300" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">Belum ada video</h3>
          <p className="text-sm text-gray-500">Bagikan video pembelajaran pertama untuk siswa Anda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {video.map((v) => (
            <div key={v.id} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
              {thumbFor(v) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumbFor(v)!} alt={v.judul} className="w-full h-40 object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
              ) : (
                <div className="w-full h-40 bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                  <Video className="h-12 w-12 text-white/80" />
                </div>
              )}
              <div className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <h3 className="font-bold text-gray-900">{v.judul}</h3>
                    <p className="text-xs text-gray-500">
                      {v.mapel_nama ?? 'Mapel'}
                      {' · '}
                      {v.kelas.map((k) => k.nama_kelas).join(', ') || 'Tanpa kelas'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => bukaEdit(v)}
                      className="p-2 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50"
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(v)}
                      className="p-2 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50"
                      title="Hapus"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {v.deskripsi && (
                  <p className="text-sm text-gray-600 whitespace-pre-line line-clamp-3">{v.deskripsi}</p>
                )}

                {v.video_url && (
                  <a
                    href={v.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-xs font-bold hover:bg-red-100"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Tonton Video
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
