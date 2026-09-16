import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { siswaAuth } from '@/lib/siswa-auth'
import { getTugasKelas, getPengumpulanSiswa, namaDariUrl } from '@/lib/siswa-query'

// GET /api/siswa/tugas
// Daftar tugas untuk kelas siswa + status pengumpulan per tugas oleh siswa tsb.
export async function GET() {
  try {
    const auth = await siswaAuth()
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const tugas = await getTugasKelas(auth.kelasId)

    type TugasRow = (typeof tugas)[number] & {
      pengumpulan: {
        id: string
        status: string | null
        nama_file: string | null
        catatan: string | null
        submitted_at: string | null
      } | null
    }

    const rows: TugasRow[] = []
    for (const t of tugas) {
      const peng = await getPengumpulanSiswa(auth.siswaId, t.id)
      rows.push({
        ...t,
        pengumpulan: peng
          ? {
              id: peng.id,
              status: peng.status,
              nama_file: peng.nama_file,
              catatan: peng.catatan,
              submitted_at: peng.submitted_at,
            }
          : null,
      })
    }

    return NextResponse.json({ tugas: rows })
  } catch (err) {
    console.error('Error GET siswa tugas:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// POST /api/siswa/tugas/download
// Body: { id } (id tugas milik kelas siswa)
// Signed URL (10 menit) untuk mengunduh lampiran tugas dari bucket private `tugas`.
export async function POST(request: NextRequest) {
  try {
    const auth = await siswaAuth()
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json().catch(() => null)
    const id = body?.id ? String(body.id) : null
    if (!id) {
      return NextResponse.json({ error: 'id wajib diisi.' }, { status: 400 })
    }

    // Pastikan tugas benar-benar ditujukan untuk kelas siswa.
    const { data: relasi, error: relErr } = await getSupabaseAdmin()
      .from('tugas_kelas')
      .select('tugas_id, kelas_id, tugas(id, lampiran_url, status)')
      .eq('tugas_id', id)
      .eq('kelas_id', auth.kelasId)
      .maybeSingle()

    if (relErr) return NextResponse.json({ error: relErr.message }, { status: 400 })

    type RelasiEmbed = {
      tugas_id: string
      kelas_id: string
      tugas: {
        id: string
        lampiran_url: string | null
        status: string | null
      } | null
    }

    const r = relasi as unknown as RelasiEmbed | null
    const t = r?.tugas ?? null
    if (!r || !t) {
      return NextResponse.json({ error: 'Tugas tidak ditemukan untuk kelas Anda.' }, { status: 404 })
    }
    if (t.status !== 'published' && t.status !== 'closed') {
      return NextResponse.json({ error: 'Tugas belum dipublikasikan.' }, { status: 400 })
    }
    if (!t.lampiran_url) {
      return NextResponse.json({ error: 'Tugas ini tidak memiliki lampiran.' }, { status: 400 })
    }

    const { data: signed, error: urlErr } = await getSupabaseAdmin()
      .storage
      .from('tugas')
      .createSignedUrl(t.lampiran_url, 600, {
        download: namaDariUrl(t.lampiran_url) ?? true,
      })

    if (urlErr || !signed) {
      return NextResponse.json(
        { error: urlErr?.message ?? 'Gagal membuat tautan unduhan.' },
        { status: 400 }
      )
    }

    return NextResponse.json({ url: signed.signedUrl, nama_file: namaDariUrl(t.lampiran_url) })
  } catch (err) {
    console.error('Error POST siswa tugas download:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}