import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { siswaAuth, getSiswaKelasInfo } from '@/lib/siswa-auth'

// GET /api/siswa/me
// Profil ringkas siswa yang sedang login (untuk tampilan header/profile aplikasi mobile).
export async function GET() {
  try {
    const auth = await siswaAuth()
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const [kelas, { data: siswaRow }] = await Promise.all([
      getSiswaKelasInfo(auth.kelasId),
      getSupabaseAdmin()
        .from('siswa')
        .select('id, nis, nama_lengkap, kelas_id')
        .eq('id', auth.siswaId)
        .maybeSingle(),
    ])

    return NextResponse.json({
      siswa: {
        id: auth.siswaId,
        nama_lengkap: siswaRow?.nama_lengkap ?? null,
        nis: siswaRow?.nis ?? null,
      },
      kelas,
    })
  } catch (err) {
    console.error('Error GET siswa me:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
