'use client'

import { useState, useEffect } from 'react'

export interface KelasOption {
  id: string
  nama_kelas: string
  tingkat: number
  tahun_ajaran: string
}

// Muat daftar kelas aktif (tingkat 10-12) untuk dropdown pilihan kelas siswa.
export function useKelasOptions(enabled = true) {
  const [kelasOptions, setKelasOptions] = useState<KelasOption[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (!enabled) return

    fetch('/api/admin/kelas?status=active')
      .then((res) => {
        if (!res.ok) throw new Error('Gagal memuat daftar kelas')
        return res.json()
      })
      .then((rows: KelasOption[]) => {
        if (!cancelled) {
          const filtered = rows
            .filter((k) => k.tingkat >= 10 && k.tingkat <= 12)
            .sort((a, b) => a.tingkat - b.tingkat || a.nama_kelas.localeCompare(b.nama_kelas))
          setKelasOptions(filtered)
        }
      })
      .catch((err) => {
        console.error('Error fetching kelas options:', err)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [enabled])

  return { kelasOptions, loading }
}