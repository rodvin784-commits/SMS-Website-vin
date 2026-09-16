import { NextResponse } from 'next/server'
import { siswaAuth } from '@/lib/siswa-auth'
import { getJadwalKelas } from '@/lib/siswa-query'

// GET /api/siswa/jadwal
// Jadwal pelajaran kelas siswa (schema baru: hari TEXT 'Senin'..'Sabtu', jam TIME).
export async function GET() {
  try {
    const auth = await siswaAuth()
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const jadwal = await getJadwalKelas(auth.kelasId)
    return NextResponse.json({ jadwal })
  } catch (err) {
    console.error('Error GET siswa jadwal:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}