import { NextResponse } from 'next/server'
import { siswaAuth } from '@/lib/siswa-auth'
import { getNilaiSiswa } from '@/lib/siswa-query'

// GET /api/siswa/nilai
// Nilai milik siswa (hanya miliknya sendiri, siswa_id dicocokkan server-side).
export async function GET() {
  try {
    const auth = await siswaAuth()
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const nilai = await getNilaiSiswa(auth.siswaId)
    const res = NextResponse.json({ nilai })
    res.headers.set('Cache-Control', 'private, max-age=15, stale-while-revalidate=30')
    return res
  } catch (err) {
    console.error('Error GET siswa nilai:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}