import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { adminCheck, getSupabaseAdmin } from '@/lib/supabase-server'
import { denyResponse, serverError } from '@/lib/api-admin'

// GET /api/admin/presensi?kelas_id=&bulan=YYYY-MM (misal 2026-09) — rekap per siswa per bulan
export async function GET(request: NextRequest) {
  try {
    const auth = await adminCheck()
    if (!auth.ok) return denyResponse()

    const { searchParams } = new URL(request.url)
    const kelasId = searchParams.get('kelas_id')
    const bulan = searchParams.get('bulan') // YYYY-MM

    if (!kelasId) return NextResponse.json({ error: 'kelas_id wajib' }, { status: 400 })
    if (!bulan || !/^\d{4}-\d{2}$/.test(bulan)) return NextResponse.json({ error: 'bulan wajib YYYY-MM' }, { status: 400 })

    const supabase = getSupabaseAdmin()
    // Ambil siswa kelas ini
    const { data: siswaList } = await supabase.from('siswa').select('id, nis, nama_lengkap').eq('kelas_id', kelasId).order('nama_lengkap')
    const siswa = siswaList ?? []

    // Ambil presensi bulan ini: tanggal >= 2026-09-01 and < 2026-10-01
    const [y, m] = bulan.split('-').map(Number)
    const start = `${bulan}-01`
    const end = new Date(y, m, 1).toISOString().slice(0,10)

    const { data: presensi, error } = await supabase
      .from('presensi')
      .select('siswa_id, tanggal, status, keterangan, mata_pelajaran(nama,kode)')
      .eq('kelas_id', kelasId)
      .gte('tanggal', start)
      .lt('tanggal', end)
      .order('tanggal', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Hitung rekap per siswa
    const presensiBySiswa = new Map<string, { hadir: number; izin: number; sakit: number; alpha: number; total: number; detail: typeof presensi }>()
    for (const s of siswa) presensiBySiswa.set(s.id, { hadir: 0, izin: 0, sakit: 0, alpha: 0, total: 0, detail: [] as typeof presensi })
    for (const p of (presensi ?? []) as unknown as { siswa_id: string; status: string }[]) {
      const r = presensiBySiswa.get(p.siswa_id)
      if (r) {
        if (p.status in r) (r as unknown as Record<string, number>)[p.status]++
        r.total++
        ;(r.detail as unknown as unknown[]).push(p)
      }
    }

    const rekap = siswa.map(s => ({
      siswa_id: s.id,
      nis: s.nis,
      nama_lengkap: s.nama_lengkap,
      ...presensiBySiswa.get(s.id)!,
    }))

    return NextResponse.json({ bulan, kelas_id: kelasId, rekap, presensi: presensi ?? [] })
  } catch (err) {
    return serverError(err, 'GET admin presensi')
  }
}
