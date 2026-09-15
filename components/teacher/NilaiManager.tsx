'use client'

import { useEffect, useState } from 'react'
import { Award, BookOpen, GraduationCap, Save } from 'lucide-react'

type GuruAssignment = {
  id: string
  mapel_id: string
  mapel_nama: string | null
  mapel_kode: string | null
  kelas_id: string
  kelas_nama: string | null
  tingkat: number | null
  tahun_ajaran: string | null
}

type NilaiKomponen = 'harian' | 'tugas' | 'uts' | 'uas'

type NilaiSiswa = {
  id: string
  nama_lengkap: string
  nilai: Record<NilaiKomponen, number | null>
}

const KOMPONEN: { key: NilaiKomponen; label: string }[] = [
  { key: 'harian', label: 'Ulangan Harian' },
  { key: 'tugas', label: 'Tugas' },
  { key: 'uts', label: 'UTS' },
  { key: 'uas', label: 'UAS' },
]

type Tab = NilaiKomponen | 'rapor'

function buatDraft(siswa: NilaiSiswa[], komponen: NilaiKomponen): Record<string, string> {
  const draft: Record<string, string> = {}
  for (const s of siswa) {
    const v = s.nilai[komponen]
    draft[s.id] = v !== null && v !== undefined ? String(v) : ''
  }
  return draft
}

function rataRata(nilai: Record<NilaiKomponen, number | null>): number | null {
  const vals = KOMPONEN.map((k) => nilai[k.key]).filter((v): v is number => v !== null && v !== undefined)
  if (vals.length === 0) return null
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100
}

function predikat(nilai: number) {
  if (nilai >= 90) return { label: 'A — Baik Sekali', cls: 'text-emerald-700 bg-emerald-50' }
  if (nilai >= 80) return { label: 'B — Baik', cls: 'text-blue-700 bg-blue-50' }
  if (nilai >= 70) return { label: 'C — Cukup', cls: 'text-amber-700 bg-amber-50' }
  if (nilai >= 60) return { label: 'D — Kurang', cls: 'text-orange-700 bg-orange-50' }
  return { label: 'E — Sangat Kurang', cls: 'text-rose-700 bg-rose-50' }
}

export function NilaiManager() {
  const [assignments, setAssignments] = useState<GuruAssignment[]>([])
  const [selectedGm, setSelectedGm] = useState('')
  const [loadingAssignments, setLoadingAssignments] = useState(true)
  const [loadingRoster, setLoadingRoster] = useState(true)
  const [siswa, setSiswa] = useState<NilaiSiswa[]>([])
  const [tab, setTab] = useState<Tab>('harian')
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        const res = await fetch('/api/teacher/mengajar')
        if (!cancelled) {
          if (res.ok) {
            const data = await res.json().catch(() => null)
            const list = (data?.assignments ?? []) as GuruAssignment[]
            setAssignments(list)
            if (list.length > 0 && !selectedGm) {
              setSelectedGm(list[0].id)
            }
          } else {
            setStatusMsg({ type: 'error', text: 'Gagal memuat penugasan mengajar.' })
          }
        }
      } catch (err) {
        console.error('Gagal memuat penugasan mengajar:', err)
        if (!cancelled) setStatusMsg({ type: 'error', text: 'Terjadi kesalahan saat memuat data.' })
      } finally {
        if (!cancelled) setLoadingAssignments(false)
      }
    }

    void init()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!selectedGm) return

    async function init() {
      try {
        const res = await fetch(`/api/teacher/nilai?guru_mengajar_id=${selectedGm}`)
        const data = await res.json().catch(() => null)
        setLoadingRoster(false)
        if (data?.siswa) {
          const list = data.siswa as NilaiSiswa[]
          setSiswa(list)
          setDraft(buatDraft(list, tab === 'rapor' ? 'harian' : tab))
          setStatusMsg(null)
        } else {
          setSiswa([])
          setDraft({})
          setStatusMsg({ type: 'error', text: data?.error ?? 'Gagal memuat nilai.' })
        }
      } catch (err) {
        console.error('Gagal memuat nilai:', err)
        setSiswa([])
        setLoadingRoster(false)
      }
    }

    void init()
  }, [selectedGm, tab])

  const gantiTab = (t: Tab) => {
    setTab(t)
    if (t !== 'rapor') {
      setDraft(buatDraft(siswa, t))
    }
  }

  const handleSave = async () => {
    if (!selectedGm || tab === 'rapor') return

    const entries = siswa.map((s) => ({
      siswa_id: s.id,
      jenis_nilai: tab,
      nilai: draft[s.id]?.trim() ?? '',
    }))

    if (entries.every((e) => e.nilai === '')) {
      setStatusMsg({ type: 'error', text: 'Belum ada nilai yang diisi.' })
      return
    }

    setSaving(true)
    setStatusMsg(null)
    try {
      const res = await fetch('/api/teacher/nilai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guru_mengajar_id: selectedGm, entries }),
      })
      if (res.ok) {
        const data = await res.json().catch(() => null)
        const list = (data?.siswa ?? []) as NilaiSiswa[]
        setSiswa(list)
        setDraft(buatDraft(list, tab))
        setStatusMsg({ type: 'success', text: `Nilai tersimpan (${data?.saved ?? 0} disimpan, ${data?.removed ?? 0} dihapus).` })
      } else {
        const err = await res.json().catch(() => null)
        setStatusMsg({ type: 'error', text: err?.error ?? 'Gagal menyimpan nilai.' })
      }
    } catch (err) {
      console.error('Gagal menyimpan nilai:', err)
      setStatusMsg({ type: 'error', text: 'Terjadi kesalahan saat menyimpan nilai.' })
    } finally {
      setSaving(false)
    }
  }

  const selected = assignments.find((a) => a.id === selectedGm)
  const terisi =
    tab === 'rapor'
      ? siswa.filter((s) => s.nilai.harian !== null || s.nilai.tugas !== null || s.nilai.uts !== null || s.nilai.uas !== null).length
      : siswa.filter((s) => (draft[s.id]?.trim() ?? '') !== '').length

  const rataKelas =
    tab === 'rapor'
      ? (() => {
          const vals = siswa.map((s) => rataRata(s.nilai)).filter((v): v is number => v !== null)
          if (vals.length === 0) return null
          return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100
        })()
      : null

  return (
    <div className="space-y-6">
      {/* Pemilih penugasan */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="space-y-1.5">
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
            Mapel & Kelas
          </label>
          <select
            value={selectedGm}
            onChange={(e) => setSelectedGm(e.target.value)}
            className="w-full md:max-w-lg px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            disabled={loadingAssignments}
          >
            {assignments.length === 0 && <option value="">Belum ada penugasan</option>}
            {assignments.map((a) => (
              <option key={a.id} value={a.id}>
                {a.mapel_nama ?? 'Mapel'} — Kelas {a.tingkat} {a.kelas_nama ?? ''} ({a.tahun_ajaran ?? ''})
              </option>
            ))}
          </select>
        </div>

        {/* Tab komponen */}
        <div className="flex flex-wrap gap-2 mt-4">
          {KOMPONEN.map((k) => (
            <button
              key={k.key}
              onClick={() => gantiTab(k.key)}
              className={`
                px-4 py-2 rounded-xl text-sm font-bold border transition-all
                ${tab === k.key ? 'bg-emerald-600 text-white border-emerald-600' : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'}
              `}
            >
              {k.label}
            </button>
          ))}
          <button
            onClick={() => gantiTab('rapor')}
            className={`
              inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold border transition-all
              ${tab === 'rapor' ? 'bg-purple-600 text-white border-purple-600' : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'}
            `}
          >
            <Award className="h-4 w-4" />
            Rapor
          </button>
        </div>
      </div>

      {/* Daftar nilai */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {selected && (
          <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-gray-900">
                {selected.mapel_nama ?? 'Mata Pelajaran'}
                {tab !== 'rapor' && <span className="text-gray-400 font-semibold"> · {KOMPONEN.find((k) => k.key === tab)?.label}</span>}
              </h2>
              <p className="text-xs text-gray-500">
                Kelas {selected.tingkat} {selected.kelas_nama} · {selected.tahun_ajaran}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {tab === 'rapor' ? (
                rataKelas !== null && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 text-purple-700 text-xs font-bold">
                    <Award className="h-3.5 w-3.5" />
                    Rata-rata kelas: {rataKelas}
                  </span>
                )
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold">
                  {terisi}/{siswa.length} terisi
                </span>
              )}
            </div>
          </div>
        )}

        {statusMsg && (
          <div
            className={`
              px-6 py-3 border-b text-sm font-medium
              ${statusMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}
            `}
          >
            {statusMsg.text}
          </div>
        )}

        {assignments.length === 0 ? (
          <div className="p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-50 mb-3">
              <GraduationCap className="h-8 w-8 text-gray-300" />
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-1">Belum ada data siswa</h3>
            <p className="text-sm text-gray-500">Tidak ada siswa aktif di kelas ini, atau belum ada penugasan.</p>
          </div>
        ) : loadingRoster ? (
          <div className="p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-50 mb-3">
              <BookOpen className="h-8 w-8 text-gray-300" />
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-1">Belum ada data siswa</h3>
            <p className="text-sm text-gray-500">Tidak ada siswa aktif di kelas ini.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="py-3 px-6 text-xs font-bold text-gray-700 uppercase tracking-wider">No</th>
                    <th className="py-3 px-6 text-xs font-bold text-gray-700 uppercase tracking-wider">Siswa</th>
                    {tab === 'rapor' ? (
                      <>
                        <th className="py-3 px-6 text-xs font-bold text-gray-700 uppercase tracking-wider">Nilai Komponen</th>
                        <th className="py-3 px-6 text-xs font-bold text-gray-700 uppercase tracking-wider">Rata-rata</th>
                        <th className="py-3 px-6 text-xs font-bold text-gray-700 uppercase tracking-wider">Predikat</th>
                      </>
                    ) : (
                      <th className="py-3 px-6 text-xs font-bold text-gray-700 uppercase tracking-wider">Nilai (0–100)</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {siswa.map((s, idx) => {
                    const avg = rataRata(s.nilai)
                    const p = avg !== null ? predikat(avg) : null
                    return (
                      <tr key={s.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="py-3 px-6 text-sm text-gray-400 font-medium">{idx + 1}</td>
                        <td className="py-3 px-6">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm uppercase">
                              {s.nama_lengkap.charAt(0)}
                            </div>
                            <span className="font-medium text-gray-900 text-sm">{s.nama_lengkap}</span>
                          </div>
                        </td>
                        {tab === 'rapor' ? (
                          <>
                            <td className="py-3 px-6">
                              <div className="flex flex-wrap gap-1.5">
                                {KOMPONEN.map((k) => {
                                  const v = s.nilai[k.key]
                                  return (
                                    <span
                                      key={k.key}
                                      className={`
                                        px-2 py-1 rounded-lg text-xs font-bold
                                        ${v === null || v === undefined ? 'bg-gray-100 text-gray-400' : 'bg-emerald-50 text-emerald-700'}
                                      `}
                                    >
                                      {k.label.split(' ')[0][0]}: {v ?? '—'}
                                    </span>
                                  )
                                })}
                              </div>
                            </td>
                            <td className="py-3 px-6">
                              <span className="text-base font-black text-gray-900">
                                {avg ?? '—'}
                              </span>
                            </td>
                            <td className="py-3 px-6">
                              {p ? (
                                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${p.cls}`}>
                                  {p.label}
                                </span>
                              ) : (
                                <span className="text-sm text-gray-400 italic">Belum lengkap</span>
                              )}
                            </td>
                          </>
                        ) : (
                          <td className="py-3 px-6">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step={0.01}
                              value={draft[s.id] ?? ''}
                              onChange={(e) =>
                                setDraft((prev) => ({ ...prev, [s.id]: e.target.value }))
                              }
                              placeholder="0–100"
                              className="w-full max-w-[140px] px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                            />
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {tab !== 'rapor' && (
              <div className="px-6 py-4 border-t border-gray-100 flex flex-wrap items-center justify-end gap-3">
                <p className="text-xs text-gray-400 mr-auto">
                  Kosongkan nilai untuk menghapus baris nilai.
                </p>
                <button
                  onClick={handleSave}
                  disabled={saving || siswa.length === 0}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="h-4 w-4" />
                  {saving ? 'Menyimpan...' : 'Simpan Nilai'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}