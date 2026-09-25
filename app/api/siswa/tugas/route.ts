import { NextResponse } from 'next/server'
import { siswaAuth } from '@/lib/siswa-auth'
import { getPengumpulanBatch, getTugasKelas } from '@/lib/siswa-query'

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

    // Batch 1 query, bukan N sequential
    const pengMap = await getPengumpulanBatch(
      auth.siswaId,
      tugas.map((t) => t.id)
    )
    const rows: TugasRow[] = tugas.map((t) => {
      const peng = pengMap.get(t.id) as unknown as TugasRow['pengumpulan'] | undefined
      return {
        ...t,
        pengumpulan: peng
          ? {
              id: (peng as { id: string }).id,
              status: (peng as { status: string | null }).status,
              nama_file: (peng as { nama_file: string | null }).nama_file,
              foto_urls: (peng as { foto_urls?: string[] | null }).foto_urls ?? null,
              jawaban_teks: (peng as { jawaban_teks: string | null }).jawaban_teks,
              catatan: (peng as { catatan: string | null }).catatan,
              submitted_at: (peng as { submitted_at: string | null }).submitted_at,
              nilai: (peng as { nilai?: number | null }).nilai ?? null,
              feedback: (peng as { feedback?: string | null }).feedback ?? null,
              dinilai_at: (peng as { dinilai_at?: string | null }).dinilai_at ?? null,
            }
          : null,
      }
    })

    const res = NextResponse.json({ tugas: rows })
    res.headers.set('Cache-Control', 'private, max-age=15, stale-while-revalidate=30')
    return res
  } catch (err) {
    console.error('Error GET siswa tugas:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}