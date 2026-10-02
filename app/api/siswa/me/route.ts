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

    const [kelas, { data: siswaRow }, { data: profileRow }] = await Promise.all([
      getSiswaKelasInfo(auth.kelasId),
      getSupabaseAdmin()
        .from('siswa')
        .select('id, nis, nama_lengkap, kelas_id, jurusan_id, jurusan(nama,kode)')
        .eq('id', auth.siswaId)
        .maybeSingle(),
      getSupabaseAdmin()
        .from('profiles')
        .select('email, foto_url, status')
        .eq('id', auth.userId)
        .maybeSingle(),
    ])

    const jurusan = (siswaRow as unknown as { jurusan: { nama: string; kode: string } | { nama: string; kode: string }[] | null } | null)?.jurusan
    const jur = Array.isArray(jurusan) ? jurusan[0] : jurusan

    return NextResponse.json({
      siswa: {
        id: auth.siswaId,
        nama_lengkap: siswaRow?.nama_lengkap ?? null,
        nis: siswaRow?.nis ?? null,
        email: (profileRow as { email: string | null } | null)?.email ?? null,
        foto_url: (profileRow as { foto_url: string | null } | null)?.foto_url ?? null,
        status: (profileRow as { status: boolean | null } | null)?.status ?? true,
      },
      kelas: {
        ...kelas,
        jurusan_nama: jur?.nama ?? null,
        jurusan_kode: jur?.kode ?? null,
      },
    })
  } catch (err) {
    console.error('Error GET siswa me:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
