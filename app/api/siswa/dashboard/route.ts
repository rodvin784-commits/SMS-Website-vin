import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { siswaAuth, getSiswaKelasInfo } from '@/lib/siswa-auth'
import {
  getTugasKelas,
  getMateriKelas,
  getVideoKelas,
  getPengumumanKelas,
  getJadwalKelas,
  getNilaiSiswa,
  getDayName,
} from '@/lib/siswa-query'

// GET /api/siswa/dashboard
// Ringkasan portal siswa: statistik kelas + jadwal hari ini + aktivitas terbaru.
export async function GET() {
  try {
    const auth = await siswaAuth()
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const [kelas, tugas, materi, video, pengumuman, jadwal, nilai, notifikasi] = await Promise.all([
      getSiswaKelasInfo(auth.kelasId),
      getTugasKelas(auth.kelasId),
      getMateriKelas(auth.kelasId),
      getVideoKelas(auth.kelasId),
      getPengumumanKelas(auth.kelasId),
      getJadwalKelas(auth.kelasId),
      getNilaiSiswa(auth.siswaId),
      getSupabaseAdmin()
        .from('notifikasi')
        .select('*', { count: 'exact', head: true })
        .eq('profile_id', auth.userId)
        .eq('is_read', false),
    ])

    const today = getDayName()
    const jadwalHariIni = jadwal.filter((j) => j.hari === today)

    const res = NextResponse.json({
      kelas: {
        nama_kelas: kelas.nama_kelas,
        tingkat: kelas.tingkat,
        tahun_ajaran: kelas.tahun_ajaran,
      },
      counts: {
        tugas: tugas.length,
        materi: materi.length,
        video: video.length,
        pengumuman: pengumuman.length,
        nilai: nilai.length,
        notifikasi_belum_dibaca: notifikasi.count ?? 0,
      },
      jadwal_hari_ini: jadwalHariIni,
      tugas_terbaru: tugas.slice(0, 3),
      pengumuman_terbaru: pengumuman.slice(0, 3),
    })
    // Percepat render: cache privat 15s agar dashboard tidak hit DB tiap swipe tab (UX tetap fresh)
    res.headers.set('Cache-Control', 'private, max-age=15, stale-while-revalidate=30')
    return res
  } catch (err) {
    console.error('Error GET siswa dashboard:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}