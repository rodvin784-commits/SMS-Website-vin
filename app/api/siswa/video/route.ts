import { NextResponse } from 'next/server'
import { siswaAuth } from '@/lib/siswa-auth'
import { getVideoKelas } from '@/lib/siswa-query'

// GET /api/siswa/video
// Video pembelajaran yang ditujukan ke kelas siswa.
export async function GET() {
  try {
    const auth = await siswaAuth()
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const video = await getVideoKelas(auth.kelasId)
    return NextResponse.json({ video })
  } catch (err) {
    console.error('Error GET siswa video:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}