import { NextResponse } from 'next/server'
import { siswaAuth } from '@/lib/siswa-auth'
import { getSupabaseAdmin } from '@/lib/supabase-server'

// GET /api/siswa/presensi — presensi milik siswa login
export async function GET() {
  try {
    const auth = await siswaAuth()
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const { data, error } = await getSupabaseAdmin()
      .from('presensi')
      .select('id, tanggal, status, keterangan, mata_pelajaran(nama,kode), guru(nama_lengkap)')
      .eq('siswa_id', auth.siswaId)
      .order('tanggal', { ascending: false })
      .limit(100)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    const presensi = (data ?? []).map((r: { mata_pelajaran: { nama: string; kode: string } | { nama: string; kode: string }[] | null; guru: { nama_lengkap: string } | { nama_lengkap: string }[] | null } & Record<string, unknown>) => {
      const pickOne = <T,>(v: T[] | T | null | undefined): T | null => Array.isArray(v) ? (v[0] ?? null) : (v ?? null)
      return {
        ...r,
        mapel_nama: pickOne(r.mata_pelajaran as { nama: string; kode: string } | { nama: string; kode: string }[] | null)?.nama ?? null,
        guru_nama: pickOne(r.guru as { nama_lengkap: string } | { nama_lengkap: string }[] | null)?.nama_lengkap ?? null,
      }
    })

    const res = NextResponse.json({ presensi })
    res.headers.set('Cache-Control', 'private, max-age=15, stale-while-revalidate=30')
    return res
  } catch (err) {
    console.error('GET siswa presensi', err)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
