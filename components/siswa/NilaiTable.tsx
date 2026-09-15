'use client'

import { useEffect, useState } from 'react'
import { Award, FileText, GraduationCap } from 'lucide-react'

type MapelNilai = {
  mapel_id: string
  mapel_nama: string | null
  mapel_kode: string | null
  guru_nama: string | null
  semester: string | null
  nilai: { harian: number | null; tugas: number | null; uts: number | null; uas: number | null }
  rata_rata: number | null
  predikat: string | null
}

type KelasInfo = { nama_kelas: string; tingkat: number; tahun_ajaran: string } | null

const PREDIKAT_CLS: Record<string, string> = {
  A: 'bg-emerald-50 text-emerald-700',
  B: 'bg-blue-50 text-blue-700',
  C: 'bg-amber-50 text-amber-700',
  D: 'bg-orange-50 text-orange-700',
  E: 'bg-rose-50 text-rose-700',
}

const KOMPONEN: { key: 'harian' | 'tugas' | 'uts' | 'uas'; label: string }[] = [
  { key: 'harian', label: 'Harian' },
  { key: 'tugas', label: 'Tugas' },
  { key: 'uts', label: 'UTS' },
  { key: 'uas', label: 'UAS' },
]

export function NilaiTable() {
  const [loading, setLoading] = useState(true)
  const [mapel, setMapel] = useState<MapelNilai[]>([])
  const [kelas, setKelas] = useState<KelasInfo>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        const res = await fetch('/api/siswa/nilai')
        const data = await res.json().catch(() => null)
        if (!cancelled) {
          setMapel((data?.mapel ?? []) as MapelNilai[])
          setKelas((data?.kelas ?? null) as KelasInfo)
          if (!res.ok && data?.error) setError(data.error)
        }
      } catch (err) {
        console.error('Gagal memuat nilai:', err)
        if (!cancelled) setError('Terjadi kesalahan saat memuat nilai.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void init()

    return () => {
      cancelled = true
    }
  }, [])

  const dirata = mapel.filter((m) => m.rata_rata !== null)
  const rataKelas = dirata.length > 0
    ? Math.round((dirata.reduce((a, m) => a + (m.rata_rata ?? 0), 0) / dirata.length) * 100) / 100
    : null

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-16 flex flex-col items-center justify-center space-y-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
        <p className="text-sm font-medium text-gray-500">Memuat nilai...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-10 text-center">
        <p className="text-sm font-medium text-red-600">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {kelas && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <p className="font-bold text-gray-900">
                Kelas {kelas.tingkat} {kelas.nama_kelas}
              </p>
              <p className="text-xs text-gray-500">Tahun Ajaran {kelas.tahun_ajaran}</p>
            </div>
          </div>
          {rataKelas !== null && (
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-xs text-gray-500 font-medium">Rata-rata seluruh mapel</p>
                <p className="text-lg font-black text-purple-700">{rataKelas}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {mapel.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-16 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-50 mb-4">
            <FileText className="h-10 w-10 text-gray-300" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">Belum ada nilai</h3>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            Guru belum memasukkan nilai untuk kelas Anda.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="py-3 px-6 text-xs font-bold text-gray-700 uppercase tracking-wider">Mata Pelajaran</th>
                  {KOMPONEN.map((k) => (
                    <th key={k.key} className="py-3 px-4 text-xs font-bold text-gray-700 uppercase tracking-wider text-center">
                      {k.label}
                    </th>
                  ))}
                  <th className="py-3 px-4 text-xs font-bold text-gray-700 uppercase tracking-wider text-center">Rata-rata</th>
                  <th className="py-3 px-4 text-xs font-bold text-gray-700 uppercase tracking-wider text-center">Predikat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {mapel.map((m) => (
                  <tr key={m.mapel_id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="py-4 px-6">
                      <p className="font-semibold text-gray-900 text-sm">{m.mapel_nama}</p>
                      <p className="text-xs text-gray-400">
                        {m.mapel_kode ? `${m.mapel_kode} · ` : ''}{m.guru_nama ?? ''}
                      </p>
                    </td>
                    {KOMPONEN.map((k) => {
                      const v = m.nilai[k.key]
                      return (
                        <td key={k.key} className="py-4 px-4 text-center">
                          <span className={`text-sm font-bold ${v === null ? 'text-gray-300' : 'text-gray-700'}`}>
                            {v ?? '—'}
                          </span>
                        </td>
                      )
                    })}
                    <td className="py-4 px-4 text-center text-base font-black text-gray-900">
                      {m.rata_rata ?? '—'}
                    </td>
                    <td className="py-4 px-4 text-center">
                      {m.predikat ? (
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${PREDIKAT_CLS[m.predikat] ?? 'bg-gray-100 text-gray-600'}`}>
                          {m.predikat}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400 italic">Belum dinilai</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}