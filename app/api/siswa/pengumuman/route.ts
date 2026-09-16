import { NextResponse } from 'next/server'
import { siswaAuth } from '@/lib/siswa-auth'
import { getPengumumanKelas } from '@/lib/siswa-query'

// GET /api/siswa/pengumuman
// Pengumuman yang ditujukan ke kelas siswa.
export async function GET() {
  try {
    const auth = await siswaAuth()
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const pengumuman = await getPengumumanKelas(auth.kelasId)
    return NextResponse.json({ pengumuman })
  } catch (err) {
    console.error('Error GET siswa pengumuman:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}