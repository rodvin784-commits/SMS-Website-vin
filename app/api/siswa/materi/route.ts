import { NextResponse } from 'next/server'
import { siswaAuth } from '@/lib/siswa-auth'
import { getMateriKelas } from '@/lib/siswa-query'

// GET /api/siswa/materi
// Materi yang ditujukan ke kelas siswa.
export async function GET() {
  try {
    const auth = await siswaAuth()
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const materi = await getMateriKelas(auth.kelasId)
    const res = NextResponse.json({ materi })
    res.headers.set('Cache-Control', 'private, max-age=15, stale-while-revalidate=30')
    return res
  } catch (err) {
    console.error('Error GET siswa materi:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}