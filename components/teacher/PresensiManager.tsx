'use client'

import { useEffect, useState } from 'react'
import { CalendarClock, ClipboardCheck, GraduationCap, Save, Users } from 'lucide-react'

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

type StatusPresensi = 'hadir' | 'terlambat' | 'izin' | 'sakit' | 'alfa'

type RosterSiswa = {
  id: string
  nama_lengkap: string
  presensi: { status: StatusPresensi; keterangan: string | null } | null
}

const STATUSES: { value: StatusPresensi; label: string; active: string; dot: string }[] = [
  { value: 'hadir', label: 'Hadir', active: 'bg-emerald-500 text-white border-emerald-500', dot: 'bg-emerald-500' },
  { value: 'terlambat', label: 'Terlambat', active: 'bg-amber-500 text-white border-amber-500', dot: 'bg-amber-500' },
  { value: 'izin', label: 'Izin', active: 'bg-sky-500 text-white border-sky-500', dot: 'bg-sky-500' },
  { value: 'sakit', label: 'Sakit', active: 'bg-purple-500 text-white border-purple-500', dot: 'bg-purple-500' },
  { value: 'alfa', label: 'Alfa', active: 'bg-rose-500 text-white border-rose-500', dot: 'bg-rose-500' },
]

export function PresensiManager() {
  const [assignments, setAssignments] = useState<GuruAssignment[]>([])
  const [selectedGm, setSelectedGm] = useState('')
  const [tanggal, setTanggal] = useState(() => {
    const d = new Date()
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    return local.toISOString().slice(0, 10)
  })
  const [loadingAssignments, setLoadingAssignments] = useState(true)
  const [loadingRoster, setLoadingRoster] = useState(true)
  const [siswa, setSiswa] = useState<RosterSiswa[]>([])
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
    if (!selectedGm || !tanggal) return

    async function init() {
      try {
        const res = await fetch(`/api/teacher/presensi?guru_mengajar_id=${selectedGm}&tanggal=${tanggal}`)
        const data = await res.json().catch(() => null)
        setLoadingRoster(false)
        if (data?.siswa) {
          setSiswa(data.siswa as RosterSiswa[])
          setStatusMsg(null)
        } else {
          setSiswa([])
          setStatusMsg({ type: 'error', text: 'Gagal memuat absensi.' })
        }
      } catch (err) {
        console.error('Gagal memuat roster:', err)
        setSiswa([])
        setLoadingRoster(false)
      }
    }

    void init()
  }, [selectedGm, tanggal])

  const setStatus = (siswaId: string, status: StatusPresensi) => {
    setSiswa((prev) =>
      prev.map((s) => {
        if (s.id !== siswaId) return s
        return {
          id: s.id,
          nama_lengkap: s.nama_lengkap,
          presensi: { status, keterangan: s.presensi?.keterangan ?? null },
        }
      })
    )
  }

  const setKeterangan = (siswaId: string, keterangan: string) => {
    setSiswa((prev) =>
      prev.map((s) => {
        if (s.id !== siswaId) return s
        return {
          id: s.id,
          nama_lengkap: s.nama_lengkap,
          presensi: s.presensi ? { ...s.presensi, keterangan } : s.presensi,
        }
      })
    )
  }

  const markAllHadir = () => {
    setSiswa((prev) =>
      prev.map((s) => ({
        id: s.id,
        nama_lengkap: s.nama_lengkap,
        presensi: { status: 'hadir' as StatusPresensi, keterangan: s.presensi?.keterangan ?? null },
      }))
    )
  }

  const handleSave = async () => {
    if (!selectedGm || !tanggal) return
    const entries = siswa
      .filter((s) => s.presensi)
      .map((s) => ({
        siswa_id: s.id,
        status: s.presensi!.status,
        keterangan: s.presensi?.keterangan?.trim() ? s.presensi.keterangan.trim() : null,
      }))

    if (entries.length === 0) {
      setStatusMsg({ type: 'error', text: 'Belum ada status yang diisi. Pilih status minimal satu siswa.' })
      return
    }

    setSaving(true)
    setStatusMsg(null)
    try {
      const res = await fetch('/api/teacher/presensi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guru_mengajar_id: selectedGm, tanggal, entries }),
      })
      if (res.ok) {
        const data = await res.json().catch(() => null)
        setSiswa((data?.siswa ?? []) as RosterSiswa[])
        setStatusMsg({
          type: 'success',
          text: `Presensi tersimpan untuk ${data?.saved ?? entries.length} siswa.`,
        })
      } else {
        const err = await res.json().catch(() => null)
        setStatusMsg({ type: 'error', text: err?.error ?? 'Gagal menyimpan presensi.' })
      }
    } catch (err) {
      console.error('Gagal menyimpan presensi:', err)
      setStatusMsg({ type: 'error', text: 'Terjadi kesalahan saat menyimpan presensi.' })
    } finally {
      setSaving(false)
    }
  }

  const totalHadir = siswa.filter((s) => s.presensi?.status === 'hadir' || s.presensi?.status === 'terlambat').length
  const totalTerisi = siswa.filter((s) => s.presensi).length
  const selected = assignments.find((a) => a.id === selectedGm)

  return (
    <div className="space-y-6">
      {/* Baris pemilih penugasan + tanggal */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
              Mapel & Kelas
            </label>
            <select
              value={selectedGm}
              onChange={(e) => setSelectedGm(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              disabled={loadingAssignments}
            >
              {assignments.length === 0 && <option value="">Belum ada penugasan</option>}
              {assignments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.mapel_nama ?? 'Mapel'} — Kelas {a.tingkat} {a.kelas_nama ?? ''} ({a.tahun_ajaran ?? ''})
                </option>
              ))}
            </select>
            {assignments.length === 0 && !loadingAssignments && (
              <p className="text-xs text-gray-400">
                Admin belum mengatur mapel & kelas untuk Anda.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
              Tanggal
            </label>
            <div className="relative">
              <input
                type="date"
                value={tanggal}
                max={tanggal}
                onChange={(e) => e.target.value && setTanggal(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
              <CalendarClock className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Roster */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {selected && (
          <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-gray-900">
                {selected.mapel_nama ?? 'Mata Pelajaran'}
              </h2>
              <p className="text-xs text-gray-500">
                Kelas {selected.tingkat} {selected.kelas_nama} · {selected.tahun_ajaran}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold">
                <Users className="h-3.5 w-3.5" />
                {totalTerisi}/{siswa.length} terisi
              </span>
              <button
                onClick={markAllHadir}
                disabled={siswa.length === 0}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Semua Hadir
              </button>
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
            <p className="text-sm text-gray-500">
              Tidak ada siswa aktif di kelas ini, atau belum ada penugasan yang dipilih.
            </p>
          </div>
        ) : loadingRoster ? (
          <div className="p-12 flex flex-col items-center justify-center space-y-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
            <p className="text-sm font-medium text-gray-500">Memuat daftar siswa...</p>
          </div>
        ) : siswa.length === 0 ? (
          <div className="p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-50 mb-3">
              <GraduationCap className="h-8 w-8 text-gray-300" />
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-1">Belum ada data siswa</h3>
            <p className="text-sm text-gray-500">
              Tidak ada siswa aktif di kelas ini, atau belum ada penugasan yang dipilih.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="py-3 px-6 text-xs font-bold text-gray-700 uppercase tracking-wider">No</th>
                    <th className="py-3 px-6 text-xs font-bold text-gray-700 uppercase tracking-wider">Siswa</th>
                    <th className="py-3 px-6 text-xs font-bold text-gray-700 uppercase tracking-wider">Kehadiran</th>
                    <th className="py-3 px-6 text-xs font-bold text-gray-700 uppercase tracking-wider">Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {siswa.map((s, idx) => {
                    const status = s.presensi?.status ?? null
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
                        <td className="py-3 px-6">
                          <div className="flex flex-wrap gap-1.5">
                            {STATUSES.map((opt) => {
                              const isActive = status === opt.value
                              return (
                                <button
                                  key={opt.value}
                                  onClick={() => setStatus(s.id, opt.value)}
                                  className={`
                                    inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all
                                    ${isActive
                                      ? opt.active
                                      : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'
                                    }
                                  `}
                                >
                                  {isActive && <span className={`w-1.5 h-1.5 rounded-full ${opt.dot}`} />}
                                  {opt.label}
                                </button>
                              )
                            })}
                          </div>
                        </td>
                        <td className="py-3 px-6">
                          <input
                            type="text"
                            value={s.presensi?.keterangan ?? ''}
                            onChange={(e) => setKeterangan(s.id, e.target.value)}
                            placeholder={status === 'izin' || status === 'sakit' ? 'Alasan (mis. surat dokter)' : status ? 'Catatan (opsional)' : '—'}
                            disabled={!status}
                            className="w-full max-w-[220px] px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 disabled:opacity-50"
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer simpan */}
            <div className="px-6 py-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-gray-500">
                <ClipboardCheck className="inline h-4 w-4 text-emerald-500 mr-1.5 -mt-0.5" />
                {totalHadir} hadir/terlambat · {siswa.filter((s) => s.presensi?.status === 'alfa').length} alfa ·{' '}
                {siswa.filter((s) => s.presensi?.status === 'izin' || s.presensi?.status === 'sakit').length} izin/sakit
              </p>
              <button
                onClick={handleSave}
                disabled={saving || siswa.length === 0}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Menyimpan...' : 'Simpan Presensi'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}