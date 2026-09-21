import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { guruAuth, getGuruKelas } from '@/lib/guru-auth'

// Pengumpulan tugas (DATABASE_CONTEXT.md #12):
// Guru hanya boleh melihat pengumpulan dari tugas miliknya yang target kelasesnya diajar.
// File jawaban siswa disimpan di bucket private `pengumpulan` -> akses via signed URL.

type TugasRow = {
  id: string
  guru_id: string
  judul: string
  deadline: string | null
  mata_pelajaran_id: string
  mata_pelajaran: { nama: string } | { nama: string }[] | null
  tugas_kelas: { kelas_id: string }[] | null
}

type PengumpulanRow = {
  id: string
  tugas_id: string
  siswa_id: string
  file_url: string | null
  nama_file: string | null
  foto_urls: string[] | null
  jawaban_teks: string | null
  catatan: string | null
  status: string | null
  submitted_at: string | null
  nilai: number | null
  feedback: string | null
  dinilai_at: string | null
  siswa: { nama_lengkap: string; nis: string } | { nama_lengkap: string; nis: string }[] | null
}

const pickOne = <T,>(v: T[] | T | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null)

// GET /api/teacher/pengumpulan?tugas_id=...
// Roster siswa semua kelas target tugas + status pengumpulan mereka.
export async function GET(request: NextRequest) {
  try {
    const auth = await guruAuth()
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const tugasId = request.nextUrl.searchParams.get('tugas_id')
    if (!tugasId) {
      return NextResponse.json({ error: 'Parameter tugas_id wajib diisi.' }, { status: 400 })
    }

    const { data: tugas, error: tugasErr } = await getSupabaseAdmin()
      .from('tugas')
      .select(`
        id, guru_id, judul, deadline, mata_pelajaran_id,
        mata_pelajaran(nama),
        tugas_kelas(kelas_id)
      `)
      .eq('id', tugasId)
      .maybeSingle()

    if (tugasErr) return NextResponse.json({ error: tugasErr.message }, { status: 400 })
    if (!tugas) return NextResponse.json({ error: 'Tugas tidak ditemukan.' }, { status: 404 })

    const row = tugas as unknown as TugasRow
    if (row.guru_id !== auth.guruId) {
      return NextResponse.json({ error: 'Tugas ini bukan milik Anda.' }, { status: 403 })
    }

    // Verifikasi guru masih mengajar kelas target (via guru_kelas)
    const penugasan = await getGuruKelas(auth.guruId)
    const assignedPairs = new Set(penugasan.map((p) => `${p.mata_pelajaran_id}|${p.kelas_id}`))
    const kelasTargets = (row.tugas_kelas ?? []).map((tk) => tk.kelas_id)
    if (kelasTargets.length === 0) {
      return NextResponse.json({ error: 'Tugas ini belum memiliki kelas tujuan.' }, { status: 400 })
    }
    const semuaDitugaskan = kelasTargets.every((k) =>
      assignedPairs.has(`${row.mata_pelajaran_id}|${k}`)
    )
    if (!semuaDitugaskan) {
      return NextResponse.json(
        { error: 'Anda tidak lagi mengajar salah satu kelas tujuan tugas ini.' },
        { status: 403 }
      )
    }

    // Roster siswa dari semua kelas target
    const { data: siswaRows, error: siswaErr } = await getSupabaseAdmin()
      .from('siswa')
      .select('id, nis, nama_lengkap, kelas_id, kelas(nama_kelas)')
      .in('kelas_id', kelasTargets)
      .order('nama_lengkap', { ascending: true })

    if (siswaErr) return NextResponse.json({ error: siswaErr.message }, { status: 400 })

    type SiswaRow = {
      id: string
      nis: string
      nama_lengkap: string
      kelas_id: string
      kelas: { nama_kelas: string } | { nama_kelas: string }[] | null
    }

    const { data: pengRows, error: pengErr } = await getSupabaseAdmin()
      .from('pengumpulan_tugas')
      .select(`
        id, tugas_id, siswa_id, file_url, nama_file, foto_urls, jawaban_teks, catatan, status, submitted_at, nilai, feedback, dinilai_at,
        siswa(nama_lengkap, nis)
      `)
      .eq('tugas_id', tugasId)

    if (pengErr) return NextResponse.json({ error: pengErr.message }, { status: 400 })

    const pengMap = new Map<string, PengumpulanRow>()
    for (const p of (pengRows ?? []) as unknown as PengumpulanRow[]) {
      pengMap.set(p.siswa_id, p)
    }

    const siswa = ((siswaRows ?? []) as unknown as SiswaRow[]).map((s) => {
      const k = pickOne(s.kelas)
      const p = pengMap.get(s.id)
      const status = p?.status ?? 'belum_dikumpulkan'
      return {
        siswa_id: s.id,
        nis: s.nis,
        nama_lengkap: s.nama_lengkap,
        kelas_nama: k?.nama_kelas ?? null,
        pengumpulan: p
          ? {
              id: p.id,
              status,
              nama_file: p.nama_file,
              has_file: Boolean(p.file_url),
              foto_urls: p.foto_urls ?? null,
              has_foto: Boolean(p.foto_urls && p.foto_urls.length > 0),
              jawaban_teks: p.jawaban_teks,
              catatan: p.catatan,
              submitted_at: p.submitted_at,
              nilai: p.nilai ?? null,
              feedback: p.feedback ?? null,
              dinilai_at: p.dinilai_at ?? null,
            }
          : null,
      }
    })

    const counts = {
      total: siswa.length,
      dikumpulkan: siswa.filter((s) => s.pengumpulan && s.pengumpulan.status !== 'belum_dikumpulkan').length,
      dinilai: siswa.filter((s) => s.pengumpulan?.status === 'dinilai').length,
    }

    const mapel = pickOne(row.mata_pelajaran)

    return NextResponse.json({
      tugas: {
        id: row.id,
        judul: row.judul,
        deadline: row.deadline,
        mapel_nama: mapel?.nama ?? null,
      },
      counts,
      siswa,
    })
  } catch (err) {
    console.error('Error GET pengumpulan:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// GET signed URL untuk unduh file jawaban siswa:
// /api/teacher/pengumpulan/download?pengumpulan_id=...
export async function POST(request: NextRequest) {
  try {
    const auth = await guruAuth()
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json().catch(() => null)
    const pengumpulanId = body?.pengumpulan_id ? String(body.pengumpulan_id) : null
    if (!pengumpulanId) {
      return NextResponse.json({ error: 'pengumpulan_id wajib diisi.' }, { status: 400 })
    }

    const fotoIndexRaw = body?.foto_index
    const fotoIndex = fotoIndexRaw !== undefined && fotoIndexRaw !== null ? Number(fotoIndexRaw) : null

    const { data: peng, error: pengErr } = await getSupabaseAdmin()
      .from('pengumpulan_tugas')
      .select(`
        id, tugas_id, file_url, nama_file, foto_urls,
        tugas(guru_id, mata_pelajaran_id, tugas_kelas(kelas_id))
      `)
      .eq('id', pengumpulanId)
      .maybeSingle()

    if (pengErr) return NextResponse.json({ error: pengErr.message }, { status: 400 })
    if (!peng) return NextResponse.json({ error: 'Pengumpulan tidak ditemukan.' }, { status: 404 })

    type PengEmbed = {
      id: string
      tugas_id: string
      file_url: string | null
      nama_file: string | null
      foto_urls: string[] | null
      tugas: {
        guru_id: string
        mata_pelajaran_id: string
        tugas_kelas: { kelas_id: string }[] | null
      } | null
    }

    const p = peng as unknown as PengEmbed
    if (!p.tugas || p.tugas.guru_id !== auth.guruId) {
      return NextResponse.json({ error: 'Tidak diizinkan.' }, { status: 403 })
    }

    // Verifikasi guru mengajar kelas target tugas tsb
    const penugasan = await getGuruKelas(auth.guruId)
    const assignedPairs = new Set(penugasan.map((x) => `${x.mata_pelajaran_id}|${x.kelas_id}`))
    const ok = (p.tugas.tugas_kelas ?? []).some((tk) =>
      assignedPairs.has(`${p.tugas!.mata_pelajaran_id}|${tk.kelas_id}`)
    )
    if (!ok) {
      return NextResponse.json({ error: 'Anda tidak mengajar kelas tujuan tugas ini.' }, { status: 403 })
    }

    // Jika minta foto spesifik
    if (fotoIndex !== null && !Number.isNaN(fotoIndex)) {
      if (!p.foto_urls || !p.foto_urls[fotoIndex]) {
        return NextResponse.json({ error: 'Foto tidak ditemukan.' }, { status: 404 })
      }
      const fotoPath = p.foto_urls[fotoIndex]
      const { data: signedFoto, error: fotoErr } = await getSupabaseAdmin().storage.from('pengumpulan').createSignedUrl(fotoPath, 600)
      if (fotoErr || !signedFoto) return NextResponse.json({ error: fotoErr?.message ?? 'Gagal membuat tautan foto.' }, { status: 400 })
      return NextResponse.json({ url: signedFoto.signedUrl, foto_index: fotoIndex, foto_urls: p.foto_urls })
    }

    // Jika ada foto_urls, kembalikan semua signed URLs foto juga (untuk preview)
    let fotoSigned: string[] | null = null
    if (p.foto_urls && p.foto_urls.length > 0) {
      fotoSigned = []
      for (const fp of p.foto_urls) {
        const { data: s } = await getSupabaseAdmin().storage.from('pengumpulan').createSignedUrl(fp, 600)
        if (s) fotoSigned.push(s.signedUrl)
      }
    }

    if (!p.file_url) {
      if (fotoSigned && fotoSigned.length > 0) {
        return NextResponse.json({ url: fotoSigned[0], foto_urls: fotoSigned, nama_file: p.nama_file, is_foto: true })
      }
      return NextResponse.json({ error: 'Siswa belum mengunggah file.' }, { status: 400 })
    }

    // Signed URL private bucket `pengumpulan` (berlaku 10 menit)
    const { data: signed, error: urlErr } = await getSupabaseAdmin()
      .storage
      .from('pengumpulan')
      .createSignedUrl(p.file_url, 600, {
        download: p.nama_file ?? true,
      })

    if (urlErr || !signed) {
      return NextResponse.json(
        { error: urlErr?.message ?? 'Gagal membuat tautan unduhan.' },
        { status: 400 }
      )
    }

    return NextResponse.json({ url: signed.signedUrl, nama_file: p.nama_file, foto_urls: fotoSigned })
  } catch (err) {
    console.error('Error POST pengumpulan download:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
