import { NextResponse } from 'next/server'
import { siswaAuth } from '@/lib/siswa-auth'
import { getTugasKelas, getPengumpulanSiswa } from '@/lib/siswa-query'

// GET /api/siswa/tugas
// Daftar tugas untuk kelas siswa + status pengumpulan per tugas oleh siswa tsb.
export async function GET() {
  try {
    const auth = await siswaAuth()
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const tugas = await getTugasKelas(auth.kelasId)

    type TugasRow = (typeof tugas)[number] & {
      pengumpulan: {
        id: string
        status: string | null
        nama_file: string | null
        foto_urls: string[] | null
        jawaban_teks: string | null
        catatan: string | null
        submitted_at: string | null
        nilai: number | null
        feedback: string | null
        dinilai_at: string | null
      } | null
    }

    const rows: TugasRow[] = []
    for (const t of tugas) {
      const peng = await getPengumpulanSiswa(auth.siswaId, t.id)
      rows.push({
        ...t,
        pengumpulan: peng
          ? {
              id: peng.id,
              status: peng.status,
              nama_file: peng.nama_file,
              foto_urls: (peng as { foto_urls?: string[] | null }).foto_urls ?? null,
              jawaban_teks: peng.jawaban_teks,
              catatan: peng.catatan,
              submitted_at: peng.submitted_at,
              nilai: (peng as { nilai?: number | null }).nilai ?? null,
              feedback: (peng as { feedback?: string | null }).feedback ?? null,
              dinilai_at: (peng as { dinilai_at?: string | null }).dinilai_at ?? null,
            }
          : null,
      })
    }

    return NextResponse.json({ tugas: rows })
  } catch (err) {
    console.error('Error GET siswa tugas:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}