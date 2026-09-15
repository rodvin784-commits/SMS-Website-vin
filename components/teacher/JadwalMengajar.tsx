'use client'

import { useEffect, useState } from 'react'
import { BookOpen, CalendarX2, Clock, MapPin } from 'lucide-react'

type JadwalEntry = {
  id: string
  hari: number
  jam_mulai: string
  jam_selesai: string
  ruangan: string | null
  semester: string | null
  mapel_nama: string | null
  mapel_kode: string | null
  kelas_nama: string | null
  tingkat: number | null
}

export const HARI_LABEL: Record<number, string> = {
  1: 'Senin',
  2: 'Selasa',
  3: 'Rabu',
  4: 'Kamis',
  5: 'Jumat',
  6: 'Sabtu',
}

export function JadwalMengajar() {
  const [loading, setLoading] = useState(true)
  const [jadwal, setJadwal] = useState<JadwalEntry[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        const res = await fetch('/api/teacher/jadwal')
        const data = await res.json().catch(() => null)
        if (!cancelled) {
          setJadwal((data?.jadwal ?? []) as JadwalEntry[])
          if (!res.ok && data?.error) setError(data.error)
        }
      } catch (err) {
        console.error('Gagal memuat jadwal:', err)
        if (!cancelled) setError('Terjadi kesalahan saat memuat jadwal.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void init()

    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-16 flex flex-col items-center justify-center space-y-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
        <p className="text-sm font-medium text-gray-500">Memuat jadwal mengajar...</p>
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

  const perHari = new Map<number, JadwalEntry[]>()
  for (const entry of jadwal) {
    const list = perHari.get(entry.hari) ?? []
    list.push(entry)
    perHari.set(entry.hari, list)
  }

  return (
    <div className="space-y-6">
      {jadwal.length === 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-16 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-50 mb-4">
            <CalendarX2 className="h-10 w-10 text-gray-300" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">Belum ada jadwal</h3>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            Admin belum mengatur jadwal pelajaran untuk Anda. Silakan hubungi admin sekolah.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {([1, 2, 3, 4, 5, 6] as const).map((hari) => {
          const entries = perHari.get(hari) ?? []
          const isToday = new Date().getDay() === hari
          return (
            <div
              key={hari}
              className={`
                bg-white rounded-2xl shadow-sm border overflow-hidden
                ${isToday ? 'border-emerald-400 ring-2 ring-emerald-100' : 'border-gray-100'}
              `}
            >
              <div
                className={`
                  px-4 py-3 flex items-center justify-between
                  ${isToday ? 'bg-emerald-50' : 'bg-gray-50'}
                `}
              >
                <h3 className="text-sm font-bold text-gray-900">{HARI_LABEL[hari]}</h3>
                <span
                  className={`
                    text-xs font-bold ${entries.length > 0 ? 'text-emerald-600' : 'text-gray-400'}
                  `}
                >
                  {entries.length} sesi
                </span>
              </div>

              <div className="p-3 space-y-2.5 min-h-[120px]">
                {entries.length === 0 ? (
                  <p className="text-xs text-gray-400 italic text-center pt-6">Belum ada jadwal</p>
                ) : (
                  entries.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 space-y-1.5"
                    >
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                        <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                        {entry.jam_mulai.slice(0, 5)} – {entry.jam_selesai.slice(0, 5)}
                      </div>
                      <div className="flex items-start gap-1.5">
                        <BookOpen className="h-3.5 w-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-bold text-gray-900 leading-tight">
                            {entry.mapel_nama ?? 'Mata Pelajaran'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {entry.mapel_kode ? `${entry.mapel_kode} · ` : ''}
                            Kelas {entry.tingkat} {entry.kelas_nama ?? ''}
                          </p>
                        </div>
                      </div>
                      {entry.ruangan && (
                        <p className="flex items-center gap-1.5 text-xs text-gray-400">
                          <MapPin className="h-3 w-3 flex-shrink-0" />
                          {entry.ruangan}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}