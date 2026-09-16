'use client'

import { useEffect, useMemo, useState } from 'react'
import { Award, BookOpen, GraduationCap, Save } from 'lucide-react'

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

type Komponen = 'tugas' | 'uts' | 'uas'
const KOMPONEN: { key: Komponen; label: string }[] = [
  { key: 'tugas', label: 'Tugas' },
  { key: 'uts', label: 'UTS' },
  { key: 'uas', label: 'UAS' },
]

type NilaiSiswa = {
  id: string
  nis: string
  nama_lengkap: string
  nilai: Record<Komponen, number | null>
  nilai_akhir: number | null
}

const SEMESTER_LABEL: Record<string, string> = {
  ganjil: 'Ganjil',
  genap: 'Genap',
}

function predikat(nilai: number) {
  if (nilai >= 90) return { label: 'A — Baik Sekali', cls: 'text-emerald-700 bg-emerald-50' }
  if (nilai >= 80) return { label: 'B — Baik', cls: 'text-blue-700 bg-blue-50' }
  if (nilai >= 70) return { label: 'C — Cukup', cls: 'text-amber-700 bg-amber-50' }
  if (nilai >= 60) return { label: 'D — Kurang', cls: 'text-orange-700 bg-orange-50' }
  return { label: 'E — Sangat Kurang', cls: 'text-rose-700 bg-rose-50' }
}

type Tab = Komponen | 'rapor'

export function NilaiManager() {
  const [assignments, setAssignments] = useState<GuruAssignment[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [loadingAssignments, setLoadingAssignments] = useState(true)
  const [loadingRoster, setLoadingRoster] = useState(false)

  const [semester, setSemester] = useState<'ganjil' | 'genap'>('ganjil')
  const [tahunAjaran, setTahunAjaran] = useState('')

  const [siswa, setSiswa] = useState<NilaiSiswa[]>([])
  const [tab, setTab] = useState<Tab>('tugas')
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Muat penugasan guru (guru_kelas)
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
            if (list.length > 0) {
              setSelectedId((prev) => prev || list[0].id)
              setTahunAjaran((prev) => prev || list[0].tahun_ajaran || '')
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
  }, [])

  const selected = assignments.find((a) => a.id === selectedId)

  // Muat roster + nilai saat penugasan/semester berubah
  useEffect(() => {
    const asg = assignments.find((a) => a.id === selectedId)
    if (!asg) return

    const mapelId = asg.mata_pelajaran_id
    const kelasId = asg.kelas_id
    const taDefault = asg.tahun_ajaran || ''

    async function init() {
      setLoadingRoster(true)
      try {
        const params = new URLSearchParams({
          mata_pelajaran_id: mapelId,
          kelas_id: kelasId,
          semester,
          tahun_ajaran: tahunAjaran || taDefault,
        })
        const res = await fetch(`/api/teacher/nilai?${params.toString()}`)
        const data = await res.json().catch(() => null)
        if (data?.siswa) {
          const list = data.siswa as NilaiSiswa[]
          setSiswa(list)
          setStatusMsg(null)
        } else {
          setSiswa([])
          setStatusMsg({ type: 'error', text: data?.error ?? 'Gagal memuat nilai.' })
        }
      } catch (err) {
        console.error('Gagal memuat nilai:', err)
        setSiswa([])
        setStatusMsg({ type: 'error', text: 'Terjadi kesalahan saat memuat nilai.' })
      } finally {
        setLoadingRoster(false)
      }
    }

    void init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, semester, tahunAjaran])

  const refreshDraft = (list: NilaiSiswa[], t: Tab) => {
    if (t === 'rapor') return
    const d: Record<string, string> = {}
    for (const s of list) {
      const v = s.nilai[t]
      d[s.id] = v !== null && v !== undefined ? String(v) : ''
    }
    setDraft(d)
  }

  const gantiTab = (t: Tab) => {
    setTab(t)
    refreshDraft(siswa, t)
  }

  const handleSave = async () => {
    if (!selected || tab === 'rapor') return

    const entries = siswa.map((s) => ({
      siswa_id: s.id,
      [tab]: draft[s.id]?.trim() ?? '',
    }))

    if (entries.every((e) => String(e[tab]) === '')) {
      setStatusMsg({ type: 'error', text: 'Belum ada nilai yang diisi.' })
      return
    }

    setSaving(true)
    setStatusMsg(null)
    try {
      const res = await fetch('/api/teacher/nilai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mata_pelajaran_id: selected.mata_pelajaran_id,
          kelas_id: selected.kelas_id,
          semester,
          tahun_ajaran: tahunAjaran || selected.tahun_ajaran || '',
          entries,
        }),
      })
      if (res.ok) {
        const data = await res.json().catch(() => null)
        const list = (data?.siswa ?? []) as NilaiSiswa[]
        setSiswa(list)
        refreshDraft(list, tab)
        setStatusMsg({
          type: 'success',
          text: `Nilai tersimpan (${data?.saved ?? 0} disimpan, ${data?.cleared ?? 0} dikosongkan).`,
        })
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

  const rataKelas = useMemo(() => {
    const vals = siswa
      .map((s) => s.nilai_akhir)
      .filter((v): v is number => v !== null && v !== undefined)
    if (vals.length === 0) return null
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100
  }, [siswa])

  const terisi = tab === 'rapor'
    ? siswa.filter((s) => s.nilai_akhir !== null).length
    : siswa.filter((s) => (draft[s.id]?.trim() ?? '') !== '').length

  const tahunAjaranOptions = useMemo(() => {
    const set = new Set<string>()
    for (const a of assignments) if (a.tahun_ajaran) set.add(a.tahun_ajaran)
    if (tahunAjaran) set.add(tahunAjaran)
    return Array.from(set).sort()
  }, [assignments, tahunAjaran])

  if (loadingAssignments) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-16 flex flex-col items-center justify-center space-y-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
        <p className="text-sm font-medium text-gray-500">Memuat penugasan...</p>
      </div>
    )
  }

  if (assignments.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-16 text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-50 mb-4">
          <GraduationCap className="h-10 w-10 text-gray-300" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-1">Belum ada penugasan</h3>
        <p className="text-sm text-gray-500 max-w-md mx-auto">
          Admin belum mengatur mata pelajaran dan kelas untuk Anda. Silakan hubungi admin sekolah.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Pemilih penugasan + semester */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5 md:col-span-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
              Mapel & Kelas
            </label>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              {assignments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.mapel_nama ?? 'Mapel'} — {a.kelas_nama ?? ''} ({a.tahun_ajaran ?? ''})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
              Semester
            </label>
            <select
              value={semester}
              onChange={(e) => setSemester(e.target.value as 'ganjil' | 'genap')}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              <option value="ganjil">Ganjil</option>
              <option value="genap">Genap</option>
            </select>
          </div>
        </div>
        {tahunAjaranOptions.length > 0 && (
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
              Tahun Ajaran
            </label>
            <select
              value={tahunAjaran}
              onChange={(e) => setTahunAjaran(e.target.value)}
              className="w-full md:max-w-xs px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              {tahunAjaranOptions.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        )}

        {/* Tab komponen */}
        <div className="flex flex-wrap gap-2">
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
                {tab !== 'rapor' && (
                  <span className="text-gray-400 font-semibold"> · {KOMPONEN.find((k) => k.key === tab)?.label}</span>
                )}
              </h2>
              <p className="text-xs text-gray-500">
                {selected.kelas_nama} · Semester {SEMESTER_LABEL[semester]} · T.A. {tahunAjaran || selected.tahun_ajaran || '—'}
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

        {loadingRoster ? (
          <div className="p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-50 mb-3">
              <BookOpen className="h-8 w-8 text-gray-300" />
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-1">Memuat data siswa...</h3>
          </div>
        ) : siswa.length === 0 ? (
          <div className="p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-50 mb-3">
              <GraduationCap className="h-8 w-8 text-gray-300" />
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
                        <th className="py-3 px-6 text-xs font-bold text-gray-700 uppercase tracking-wider">Tugas</th>
                        <th className="py-3 px-6 text-xs font-bold text-gray-700 uppercase tracking-wider">UTS</th>
                        <th className="py-3 px-6 text-xs font-bold text-gray-700 uppercase tracking-wider">UAS</th>
                        <th className="py-3 px-6 text-xs font-bold text-gray-700 uppercase tracking-wider">Nilai Akhir</th>
                        <th className="py-3 px-6 text-xs font-bold text-gray-700 uppercase tracking-wider">Predikat</th>
                      </>
                    ) : (
                      <th className="py-3 px-6 text-xs font-bold text-gray-700 uppercase tracking-wider">Nilai (0–100)</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {siswa.map((s, idx) => {
                    const p = s.nilai_akhir !== null ? predikat(s.nilai_akhir) : null
                    return (
                      <tr key={s.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="py-3 px-6 text-sm text-gray-400 font-medium">{idx + 1}</td>
                        <td className="py-3 px-6">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm uppercase">
                              {s.nama_lengkap.charAt(0)}
                            </div>
                            <div>
                              <span className="font-medium text-gray-900 text-sm">{s.nama_lengkap}</span>
                              <p className="text-xs text-gray-400">NIS {s.nis}</p>
                            </div>
                          </div>
                        </td>
                        {tab === 'rapor' ? (
                          <>
                            {KOMPONEN.map((k) => (
                              <td key={k.key} className="py-3 px-6">
                                <span
                                  className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                                    s.nilai[k.key] === null || s.nilai[k.key] === undefined
                                      ? 'bg-gray-100 text-gray-400'
                                      : 'bg-emerald-50 text-emerald-700'
                                  }`}
                                >
                                  {s.nilai[k.key] ?? '—'}
                                </span>
                              </td>
                            ))}
                            <td className="py-3 px-6">
                              <span className="text-base font-black text-gray-900">
                                {s.nilai_akhir ?? '—'}
                              </span>
                            </td>
                            <td className="py-3 px-6">
                              {p ? (
                                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${p.cls}`}>
                                  {p.label}
                                </span>
                              ) : (
                                <span className="text-sm text-gray-400 italic">Belum dinilai</span>
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
                  Nilai akhir = 30% Tugas + 30% UTS + 40% UAS (komponen kosong tidak dihitung).
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
