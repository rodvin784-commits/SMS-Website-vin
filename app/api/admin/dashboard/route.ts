import { NextResponse } from 'next/server'
import { adminCheck, getSupabaseAdmin } from '@/lib/supabase-server'
import { denyResponse, serverError } from '@/lib/api-admin'

type Embed<T> = T | T[] | null | undefined

const pickOne = <T,>(v: Embed<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null))

// GET /api/admin/dashboard - Data statistik & ringkasan untuk dashboard admin
export async function GET() {
  try {
    const auth = await adminCheck()
    if (!auth.ok) return denyResponse()

    const supabaseAdmin = getSupabaseAdmin()

    const [guru, siswa, mapel, kelas, jurusan] = await Promise.all([
      supabaseAdmin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'guru')
        .eq('status', true),
      supabaseAdmin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'siswa')
        .eq('status', true),
      supabaseAdmin
        .from('mata_pelajaran')
        .select('id', { count: 'exact', head: true })
        .eq('status', true),
      supabaseAdmin
        .from('kelas')
        .select('id, tingkat, tahun_ajaran, jurusan_id, jurusan:jurusan(id, kode, nama)')
        .eq('status', true)
        .gte('tingkat', 10)
        .lte('tingkat', 12)
        .order('tingkat', { ascending: true }),
      supabaseAdmin
        .from('jurusan')
        .select('id, kode, nama')
        .eq('status', true)
        .order('nama', { ascending: true }),
    ])

    const [kelasRows, jurusanRows] = [
      ((kelas.data ?? []) as Array<{
        id: string
        tingkat: number
        tahun_ajaran: string
        jurusan_id: string | null
        jurusan: { id: string; kode: string; nama: string } | { id: string; kode: string; nama: string }[] | null
      }>).map((k) => ({
        id: k.id,
        tingkat: k.tingkat,
        tahun_ajaran: k.tahun_ajaran,
        jurusan_id: k.jurusan_id,
        jurusan: pickOne<{ id: string; kode: string; nama: string }>(k.jurusan),
      })),
      (jurusan.data ?? []) as { id: string; kode: string; nama: string }[],
    ]

    const tahunAjaran = Array.from(
      new Set(kelasRows.map((k) => k.tahun_ajaran).filter((t): t is string => !!t))
    ).sort((a, b) => b.localeCompare(a))

    const today = new Date().toISOString().slice(0, 10)
    const [activityUsers, activityKelas, activityPenugasan, presensiHariIni] = await Promise.all([
      supabaseAdmin
        .from('profiles')
        .select('id, nama_lengkap, role, created_at')
        .in('role', ['guru', 'siswa'])
        .order('created_at', { ascending: false })
        .limit(5),
      supabaseAdmin
        .from('kelas')
        .select('id, nama_kelas, tingkat, tahun_ajaran, created_at')
        .order('created_at', { ascending: false })
        .limit(5),
      supabaseAdmin
        .from('guru_kelas')
        .select(
          'id, created_at, guru:guru!guru_id(nama_lengkap), mapel:mata_pelajaran!mata_pelajaran_id(nama), kelas:kelas!kelas_id(nama_kelas, tingkat)'
        )
        .order('created_at', { ascending: false })
        .limit(5),
      supabaseAdmin.from('presensi').select('status').eq('tanggal', today),
    ])

    const activity: Array<{ id: string; type: 'user' | 'kelas' | 'penugasan'; title: string; subtitle: string; time: string }> = []

    ;(activityUsers.data ?? []).forEach(
      (u: { id: string; nama_lengkap: string; role: string; created_at: string }) => {
        activity.push({
          id: `user-${u.id}`,
          type: 'user',
          title: u.nama_lengkap,
          subtitle: u.role === 'guru' ? 'Guru baru ditambahkan' : 'Siswa baru ditambahkan',
          time: u.created_at,
        })
      }
    )

    ;(activityKelas.data ?? []).forEach(
      (k: { id: string; nama_kelas: string; tingkat: number; tahun_ajaran: string; created_at: string }) => {
        activity.push({
          id: `kelas-${k.id}`,
          type: 'kelas',
          title: `Kelas ${k.tingkat} ${k.nama_kelas}`,
          subtitle: `Kelas baru • ${k.tahun_ajaran}`,
          time: k.created_at,
        })
      }
    )

    ;(activityPenugasan.data ?? []).forEach(
      (p: {
        id: string
        created_at: string
        guru: { nama_lengkap: string } | { nama_lengkap: string }[] | null
        mapel: { nama: string } | { nama: string }[] | null
        kelas: { nama_kelas: string; tingkat: number } | { nama_kelas: string; tingkat: number }[] | null
      }) => {
        const guru = pickOne(p.guru)
        const mapel = pickOne(p.mapel)
        const kelasInfo = pickOne(p.kelas)
        activity.push({
          id: `penugasan-${p.id}`,
          type: 'penugasan',
          title: mapel?.nama ?? 'Mata pelajaran',
          subtitle: `${guru?.nama_lengkap ?? 'Guru'} • Kelas ${kelasInfo?.tingkat ?? '?'} ${kelasInfo?.nama_kelas ?? ''}`,
          time: p.created_at,
        })
      }
    )

    activity.sort((a, b) => +new Date(b.time) - +new Date(a.time))
    activity.splice(8)

    const presensiCounts = { hadir: 0, izin: 0, sakit: 0, alpha: 0, total: 0 }
    for (const p of (presensiHariIni.data ?? []) as { status: string }[]) {
      if (p.status in presensiCounts) (presensiCounts as Record<string, number>)[p.status]++
      presensiCounts.total++
    }

    return NextResponse.json(
      {
        stats: {
          totalGuru: guru.count ?? 0,
          totalSiswa: siswa.count ?? 0,
          totalMapel: mapel.count ?? 0,
          totalKelas: kelasRows.length,
          totalJurusan: jurusanRows.length,
        },
        presensi: { tanggal: today, ...presensiCounts },
        kelas: kelasRows,
        jurusan: jurusanRows,
        tahun_ajaran: tahunAjaran,
        activity,
      },
      { status: 200 }
    )
  } catch (err) {
    return serverError(err, 'Error fetching dashboard stats:')
  }
}