import { getSupabaseAdmin } from '@/lib/supabase-server'

// Query bersama untuk portal siswa.
// Semua query diskop ke kelas milik siswa (siswa.kelas_id) secara server-side,
// sehingga siswa tidak bisa melihat data kelas lain (DATABASE_CONTEXT.md pasal 18).

type EmbedMapel = { nama: string; kode: string } | { nama: string; kode: string }[] | null
type EmbedGuru = { nama_lengkap: string } | { nama_lengkap: string }[] | null

const pickOne = <T,>(v: T[] | T | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null)

const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

export function getDayName(): string {
  return DAYS[new Date().getDay()]
}

// Ambil nama file asli dari path storage (segmen terakhir URL path).
export function namaDariUrl(url: string | null): string | null {
  if (!url) return null
  const seg = url.split('/').pop()
  if (!seg) return null
  try {
    return decodeURIComponent(seg)
  } catch {
    return seg
  }
}

// Tugas yang ditujukan ke kelas siswa (hanya status published/closed).
export async function getTugasKelas(kelasId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from('tugas_kelas')
    .select(`
      id,
      kelas_id,
      tugas(
        id,
        guru_id,
        mata_pelajaran_id,
        judul,
        deskripsi,
        tanggal_mulai,
        deadline,
        lampiran_url,
        foto_urls,
        status,
        created_at,
        updated_at,
        guru(nama_lengkap),
        mata_pelajaran(nama, kode)
      )
    `)
    .eq('kelas_id', kelasId)

  if (error) {
    console.error('Gagal memuat tugas siswa:', error.message)
    return []
  }

  type Embed = {
    tugas: {
      id: string
      guru_id: string
      mata_pelajaran_id: string
      judul: string
      deskripsi: string | null
      tanggal_mulai: string
      deadline: string
      lampiran_url: string | null
      foto_urls: string[] | null
      status: string
      created_at: string
      updated_at: string
      guru: EmbedGuru
      mata_pelajaran: EmbedMapel
    } | null
  }

  type Row = {
    id: string
    judul: string
    deskripsi: string | null
    tanggal_mulai: string
    deadline: string
    lampiran_url: string | null
    foto_urls: string[] | null
    status: string
    created_at: string
    guru_nama: string
    mapel_nama: string
    mapel_kode: string
  }

  // Unik per tugas (tugas_kelas bisa dobel jika banyak relasi) + urut deadline terdekat.
  const unique = new Map<string, Row>()
  for (const r of (data ?? []) as unknown as Embed[]) {
    const t = r.tugas
    if (!t) continue
    if (t.status !== 'published' && t.status !== 'closed') continue
    unique.set(t.id, {
      id: t.id,
      judul: t.judul,
      deskripsi: t.deskripsi,
      tanggal_mulai: t.tanggal_mulai,
      deadline: t.deadline,
      lampiran_url: t.lampiran_url,
      foto_urls: (t as unknown as { foto_urls: string[] | null }).foto_urls ?? null,
      status: t.status,
      created_at: t.created_at,
      guru_nama: pickOne(t.guru)?.nama_lengkap ?? 'Guru',
      mapel_nama: pickOne(t.mata_pelajaran)?.nama ?? 'Mata Pelajaran',
      mapel_kode: pickOne(t.mata_pelajaran)?.kode ?? '',
    })
  }
  return [...unique.values()].sort(
    (a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
  )
}

// Materi yang ditujukan ke kelas siswa.
export async function getMateriKelas(kelasId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from('materi_kelas')
    .select(`
      id,
      kelas_id,
      materi(
        id,
        guru_id,
        mata_pelajaran_id,
        judul,
        deskripsi,
        file_url,
        nama_file,
        created_at,
        updated_at,
        guru(nama_lengkap),
        mata_pelajaran(nama, kode)
      )
    `)
    .eq('kelas_id', kelasId)

  if (error) {
    console.error('Gagal memuat materi siswa:', error.message)
    return []
  }

  type Embed = {
    materi: {
      id: string
      guru_id: string
      mata_pelajaran_id: string
      judul: string
      deskripsi: string | null
      file_url: string | null
      nama_file: string | null
      created_at: string
      updated_at: string
      guru: EmbedGuru
      mata_pelajaran: EmbedMapel
    } | null
  }

  type Row = {
    id: string
    judul: string
    deskripsi: string | null
    file_url: string | null
    nama_file: string | null
    created_at: string
    guru_nama: string
    mapel_nama: string
    mapel_kode: string
  }

  const unique = new Map<string, Row>()
  for (const r of (data ?? []) as unknown as Embed[]) {
    const m = r.materi
    if (!m) continue
    unique.set(m.id, {
      id: m.id,
      judul: m.judul,
      deskripsi: m.deskripsi,
      file_url: m.file_url,
      nama_file: m.nama_file,
      created_at: m.created_at,
      guru_nama: pickOne(m.guru)?.nama_lengkap ?? 'Guru',
      mapel_nama: pickOne(m.mata_pelajaran)?.nama ?? 'Mata Pelajaran',
      mapel_kode: pickOne(m.mata_pelajaran)?.kode ?? '',
    })
  }
  return [...unique.values()].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
}

// Video pembelajaran yang ditujukan ke kelas siswa.
export async function getVideoKelas(kelasId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from('video_kelas')
    .select(`
      id,
      kelas_id,
      video_materi(
        id,
        guru_id,
        mata_pelajaran_id,
        judul,
        deskripsi,
        video_url,
        thumbnail_url,
        created_at,
        updated_at,
        guru(nama_lengkap),
        mata_pelajaran(nama, kode)
      )
    `)
    .eq('kelas_id', kelasId)

  if (error) {
    console.error('Gagal memuat video siswa:', error.message)
    return []
  }

  type Embed = {
    video_materi: {
      id: string
      guru_id: string
      mata_pelajaran_id: string
      judul: string
      deskripsi: string | null
      video_url: string | null
      thumbnail_url: string | null
      created_at: string
      updated_at: string
      guru: EmbedGuru
      mata_pelajaran: EmbedMapel
    } | null
  }

  type Row = {
    id: string
    judul: string
    deskripsi: string | null
    video_url: string | null
    thumbnail_url: string | null
    created_at: string
    guru_nama: string
    mapel_nama: string
    mapel_kode: string
  }

  const unique = new Map<string, Row>()
  for (const r of (data ?? []) as unknown as Embed[]) {
    const v = r.video_materi
    if (!v) continue
    unique.set(v.id, {
      id: v.id,
      judul: v.judul,
      deskripsi: v.deskripsi,
      video_url: v.video_url,
      thumbnail_url: v.thumbnail_url,
      created_at: v.created_at,
      guru_nama: pickOne(v.guru)?.nama_lengkap ?? 'Guru',
      mapel_nama: pickOne(v.mata_pelajaran)?.nama ?? 'Mata Pelajaran',
      mapel_kode: pickOne(v.mata_pelajaran)?.kode ?? '',
    })
  }
  return [...unique.values()].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
}

// Pengumuman yang ditujukan ke kelas siswa.
export async function getPengumumanKelas(kelasId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from('pengumuman_kelas')
    .select(`
      id,
      kelas_id,
      pengumuman(
        id,
        guru_id,
        judul,
        isi,
        created_at,
        updated_at,
        guru(nama_lengkap)
      )
    `)
    .eq('kelas_id', kelasId)

  if (error) {
    console.error('Gagal memuat pengumuman siswa:', error.message)
    return []
  }

  type Embed = {
    pengumuman: {
      id: string
      guru_id: string
      judul: string
      isi: string | null
      created_at: string
      updated_at: string
      guru: EmbedGuru
    } | null
  }

  type Row = {
    id: string
    judul: string
    isi: string
    created_at: string
    guru_nama: string
  }

  const unique = new Map<string, Row>()
  for (const r of (data ?? []) as unknown as Embed[]) {
    const p = r.pengumuman
    if (!p) continue
    unique.set(p.id, {
      id: p.id,
      judul: p.judul,
      isi: p.isi ?? '',
      created_at: p.created_at,
      guru_nama: pickOne(p.guru)?.nama_lengkap ?? 'Guru',
    })
  }
  return [...unique.values()].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
}

const HARI_ORDER: Record<string, number> = {
  Senin: 0,
  Selasa: 1,
  Rabu: 2,
  Kamis: 3,
  Jumat: 4,
  Sabtu: 5,
  Minggu: 6,
}

// Jadwal pelajaran kelas siswa (schema baru: hari TEXT, jam TIME).
export async function getJadwalKelas(kelasId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from('jadwal')
    .select(`
      id,
      guru_id,
      mata_pelajaran_id,
      kelas_id,
      hari,
      jam_mulai,
      jam_selesai,
      ruangan,
      tahun_ajaran,
      guru(nama_lengkap),
      mata_pelajaran(nama, kode)
    `)
    .eq('kelas_id', kelasId)

  if (error) {
    console.error('Gagal memuat jadwal:', error.message)
    return []
  }

  type Embed = {
    id: string
    guru_id: string
    mata_pelajaran_id: string
    kelas_id: string
    hari: string
    jam_mulai: string
    jam_selesai: string
    ruangan: string | null
    tahun_ajaran: string | null
    guru: EmbedGuru
    mata_pelajaran: EmbedMapel
  }

  return ((data ?? []) as unknown as Embed[])
    .map((r) => ({
      id: r.id,
      hari: r.hari,
      jam_mulai: r.jam_mulai,
      jam_selesai: r.jam_selesai,
      ruangan: r.ruangan ?? '',
      tahun_ajaran: r.tahun_ajaran ?? '',
      guru_nama: pickOne(r.guru)?.nama_lengkap ?? 'Guru',
      mapel_nama: pickOne(r.mata_pelajaran)?.nama ?? 'Mata Pelajaran',
      mapel_kode: pickOne(r.mata_pelajaran)?.kode ?? '',
    }))
    .sort((a, b) => {
      const dayDiff = (HARI_ORDER[a.hari] ?? 99) - (HARI_ORDER[b.hari] ?? 99)
      if (dayDiff !== 0) return dayDiff
      return a.jam_mulai.localeCompare(b.jam_mulai)
    })
}

// Nilai milik siswa (hanya miliknya sendiri, dicek server-side via siswa_id).
export async function getNilaiSiswa(siswaId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from('nilai')
    .select(`
      id,
      siswa_id,
      guru_id,
      mata_pelajaran_id,
      tugas,
      uts,
      uas,
      nilai_akhir,
      semester,
      tahun_ajaran,
      guru(nama_lengkap),
      mata_pelajaran(nama, kode)
    `)
    .eq('siswa_id', siswaId)

  if (error) {
    console.error('Gagal memuat nilai siswa:', error.message)
    return []
  }

  type Embed = {
    id: string
    siswa_id: string
    guru_id: string
    mata_pelajaran_id: string
    tugas: number | null
    uts: number | null
    uas: number | null
    nilai_akhir: number | null
    semester: string | null
    tahun_ajaran: string | null
    guru: EmbedGuru
    mata_pelajaran: EmbedMapel
  }

  return ((data ?? []) as unknown as Embed[]).map((r) => ({
    id: r.id,
    guru_nama: pickOne(r.guru)?.nama_lengkap ?? 'Guru',
    mapel_nama: pickOne(r.mata_pelajaran)?.nama ?? 'Mata Pelajaran',
    mapel_kode: pickOne(r.mata_pelajaran)?.kode ?? '',
    tugas: r.tugas,
    uts: r.uts,
    uas: r.uas,
    nilai_akhir: r.nilai_akhir,
    semester: r.semester ?? '',
    tahun_ajaran: r.tahun_ajaran ?? '',
  }))
}

// Pengumpulan tugas milik siswa untuk satu tugas (untuk status submit / unduh).
export async function getPengumpulanSiswa(siswaId: string, tugasId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from('pengumpulan_tugas')
    .select('id, tugas_id, siswa_id, file_url, nama_file, foto_urls, jawaban_teks, catatan, status, submitted_at, updated_at, nilai, feedback, dinilai_at')
    .eq('siswa_id', siswaId)
    .eq('tugas_id', tugasId)
    .maybeSingle()

  if (error) {
    console.error('Gagal memuat pengumpulan:', error.message)
    return null
  }
  return data
}

// Batch: semua pengumpulan siswa untuk daftar tugas (1 query, bukan N)
export async function getPengumpulanBatch(siswaId: string, tugasIds: string[]) {
  if (tugasIds.length === 0) return new Map<string, NonNullable<Awaited<ReturnType<typeof getPengumpulanSiswa>>>>()
  const { data, error } = await getSupabaseAdmin()
    .from('pengumpulan_tugas')
    .select('id, tugas_id, siswa_id, file_url, nama_file, foto_urls, jawaban_teks, catatan, status, submitted_at, updated_at, nilai, feedback, dinilai_at')
    .eq('siswa_id', siswaId)
    .in('tugas_id', tugasIds)
  if (error) {
    console.error('Gagal memuat pengumpulan batch:', error.message)
    return new Map()
  }
  const map = new Map<string, NonNullable<Awaited<ReturnType<typeof getPengumpulanSiswa>>>>()
  for (const row of (data ?? []) as unknown as NonNullable<Awaited<ReturnType<typeof getPengumpulanSiswa>>>[]) {
    map.set((row as { tugas_id: string }).tugas_id, row)
  }
  return map
}