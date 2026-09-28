'use client'
// PresensiManager — Input kehadiran per kelas & tanggal (hadir/izin/sakit/alpha).
// Light theme: header + tombol aksi, kartu filter, tabel pill-status, badge statistik.
// Logika API tidak diubah — pill hanya menulis ke state draft lokal.

import { useEffect, useMemo, useState } from 'react'
import { BookOpen, Calendar, ChevronDown, Download, Save } from 'lucide-react'

type Assignment = { id: string; mata_pelajaran_id: string; mapel_nama: string | null; kelas_id: string; kelas_nama: string | null; tingkat: number | null; tahun_ajaran: string | null }
type Row = { siswa_id: string; nis: string; nama_lengkap: string; presensi: { id: string; status: string; keterangan: string | null } | null }

type Status = 'hadir' | 'izin' | 'sakit' | 'alpha'

const STATUS_PILLS: { value: Status; label: string; active: string }[] = [
  { value: 'hadir', label: 'Hadir', active: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { value: 'izin', label: 'Izin', active: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  { value: 'sakit', label: 'Sakit', active: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'alpha', label: 'Alpha', active: 'bg-red-100 text-red-700 border-red-200' },
]

const filterInputCls =
  'h-10 rounded-lg border border-gray-300 bg-white px-3.5 text-sm text-gray-800 ' +
  'focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500'

export function PresensiManager() {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [mapel, setMapel] = useState('')
  const [kelas, setKelas] = useState('')
  const [tanggal, setTanggal] = useState(() => new Date().toISOString().slice(0, 10))
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [draft, setDraft] = useState<Record<string, { status: string; ket: string }>>({})

  useEffect(() => {
    fetch('/api/teacher/mengajar').then(r => r.json()).then(d => {
      const list = d.assignments as Assignment[]
      setAssignments(list)
      if (list.length > 0) { setMapel(list[0].mata_pelajaran_id); setKelas(list[0].kelas_id) }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const kelasOptions = useMemo(() => assignments.filter(a => a.mata_pelajaran_id === mapel), [assignments, mapel])

  const muat = async () => {
    if (!mapel || !kelas || !tanggal) return
    setLoading(true)
    try {
      const r = await fetch(`/api/teacher/presensi?mata_pelajaran_id=${mapel}&kelas_id=${kelas}&tanggal=${tanggal}`)
      const d = await r.json()
      if (r.ok) {
        setRows(d.siswa as Row[])
        const m: Record<string, { status: string; ket: string }> = {}
        for (const s of d.siswa as Row[]) { m[s.siswa_id] = { status: s.presensi?.status ?? 'hadir', ket: s.presensi?.keterangan ?? '' } }
        setDraft(m)
      } else setMsg({ type: 'error', text: d.error })
    } finally { setLoading(false) }
  }
  // muat() async — semua setState setelah await di dalamnya; dependensi mapel/kelas/tanggal disengaja
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { if (mapel && kelas && tanggal) void muat() }, [mapel, kelas, tanggal])

  const statusOf = (r: Row): Status =>
    ((draft[r.siswa_id]?.status ?? r.presensi?.status ?? 'hadir') as Status)

  const setStatus = (siswaId: string, status: Status) =>
    setDraft(p => ({ ...p, [siswaId]: { status, ket: p[siswaId]?.ket ?? '' } }))

  const setKet = (siswaId: string, ket: string) =>
    setDraft(p => ({ ...p, [siswaId]: { status: p[siswaId]?.status ?? 'hadir', ket } }))

  const simpan = async () => {
    setSaving(true); setMsg(null)
    try {
      const entries = Object.entries(draft).map(([siswa_id, v]) => ({ siswa_id, status: v.status, keterangan: v.ket }))
      const r = await fetch('/api/teacher/presensi', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mata_pelajaran_id: mapel, kelas_id: kelas, tanggal, entries }) })
      const d = await r.json()
      if (r.ok) setMsg({ type: 'success', text: d.message })
      else setMsg({ type: 'error', text: d.error })
    } finally { setSaving(false) }
  }

  const exportCSV = () => {
    if (rows.length === 0) return
    const header = ['NIS', 'Nama', 'Status', 'Keterangan', 'Tanggal']
    const lines = [header.join(','), ...rows.map(r => {
      const d = draft[r.siswa_id] ?? { status: r.presensi?.status ?? 'hadir', ket: r.presensi?.keterangan ?? '' }
      return [r.nis, `"${r.nama_lengkap.replace(/"/g, '""')}"`, d.status, `"${(d.ket || '').replace(/"/g, '""')}"`, tanggal].join(',')
    })]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `presensi-${kelas}-${tanggal}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const count = (s: Status) => rows.filter(r => statusOf(r) === s).length

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-10">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" aria-hidden />
          <p className="text-sm font-medium text-gray-600">Memuat presensi…</p>
        </div>
      </div>
    )
  }

  if (assignments.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-10 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-50 mb-4">
          <BookOpen className="h-8 w-8 text-gray-300" aria-hidden />
        </div>
        <h3 className="text-base font-bold text-gray-900 mb-1">Belum ada penugasan</h3>
        <p className="text-sm text-gray-600">Hubungi admin untuk penugasan mengajar.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header: judul kiri, aksi kanan */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Presensi Siswa</h1>
          <p className="mt-0.5 text-sm text-gray-500">Input kehadiran per kelas & tanggal (hadir/izin/sakit/alpha)</p>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <button
            onClick={exportCSV}
            disabled={rows.length === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50"
          >
            <Download className="h-4 w-4" aria-hidden />
            Export CSV
          </button>
          <button
            onClick={simpan}
            disabled={saving || rows.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:opacity-50"
          >
            <Save className="h-4 w-4" aria-hidden />
            {saving ? 'Menyimpan…' : 'Simpan Presensi'}
          </button>
        </div>
      </div>

      {msg && (
        <div role="status" className={`rounded-xl border px-4 py-2.5 text-sm font-medium ${msg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
          {msg.text}
        </div>
      )}

      {/* Filter */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-gray-600">Mata Pelajaran</span>
            <span className="relative inline-flex">
              <select
                value={mapel}
                onChange={e => { setMapel(e.target.value); const first = assignments.find(a => a.mata_pelajaran_id === e.target.value); if (first) setKelas(first.kelas_id) }}
                aria-label="Mata pelajaran"
                className={`${filterInputCls} appearance-none pr-10 cursor-pointer`}
              >
                {Array.from(new Map(assignments.map(a => [a.mata_pelajaran_id, a.mapel_nama]))).map(([id, nama]) => (
                  <option key={id} value={id}>{nama as string}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" aria-hidden />
            </span>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-gray-600">Kelas</span>
            <span className="relative inline-flex">
              <select
                value={kelas}
                onChange={e => setKelas(e.target.value)}
                aria-label="Kelas"
                className={`${filterInputCls} appearance-none pr-10 cursor-pointer`}
              >
                {kelasOptions.map(k => (
                  <option key={k.kelas_id} value={k.kelas_id}>{k.kelas_nama} ({k.tahun_ajaran})</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" aria-hidden />
            </span>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-gray-600">Tanggal</span>
            <span className="relative inline-flex">
              <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" aria-hidden />
              <input
                type="date"
                value={tanggal}
                onChange={e => setTanggal(e.target.value)}
                aria-label="Tanggal"
                className={`${filterInputCls} pl-10 cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0`}
              />
            </span>
          </label>
          <div className="flex flex-col gap-1.5 justify-end">
            <span className="text-xs font-semibold text-transparent select-none" aria-hidden>·</span>
            <button
              onClick={muat}
              className="h-10 rounded-lg bg-gray-900 px-6 font-medium text-white transition-colors hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2"
            >
              Muat
            </button>
          </div>
        </div>
      </div>

      {/* Tabel */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Siswa</th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Status</th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Keterangan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-10 text-center text-sm text-gray-500">
                    Belum ada data. Pilih filter lalu tekan Muat.
                  </td>
                </tr>
              )}
              {rows.map(r => {
                const st = statusOf(r)
                return (
                  <tr key={r.siswa_id}>
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">{r.nama_lengkap}</p>
                      <p className="mt-0.5 text-sm text-gray-500">NIS {r.nis}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Status ${r.nama_lengkap}`}>
                        {STATUS_PILLS.map(p => (
                          <button
                            key={p.value}
                            type="button"
                            onClick={() => setStatus(r.siswa_id, p.value)}
                            aria-pressed={st === p.value}
                            className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                              st === p.value ? p.active : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <input
                        value={draft[r.siswa_id]?.ket ?? ''}
                        onChange={e => setKet(r.siswa_id, e.target.value)}
                        placeholder="Catatan (opsional)"
                        aria-label={`Catatan ${r.nama_lengkap}`}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Statistik */}
      {rows.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-live="polite">
          <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
            {count('hadir')} Hadir
          </span>
          <span className="rounded-full border border-yellow-100 bg-yellow-50 px-3 py-1 text-sm font-medium text-yellow-700">
            {count('izin')} Izin
          </span>
          <span className="rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700">
            {count('sakit')} Sakit
          </span>
          <span className="rounded-full border border-red-100 bg-red-50 px-3 py-1 text-sm font-medium text-red-700">
            {count('alpha')} Alpha
          </span>
        </div>
      )}
    </div>
  )
}
