import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { siswaAuth } from '@/lib/siswa-auth'

// POST /api/siswa/materi/download
// Body: { id } (id materi milik kelas siswa)
// Signed URL (10 menit) untuk mengunduh file dari bucket private `materi`.
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

    // Pastikan materi ditujukan untuk kelas siswa.
    const { data: relasi, error: relErr } = await getSupabaseAdmin()
      .from('materi_kelas')
      .select('materi_id, kelas_id, materi(id, file_url, nama_file)')
      .eq('materi_id', id)
      .eq('kelas_id', auth.kelasId)
      .maybeSingle()

    if (relErr) return NextResponse.json({ error: relErr.message }, { status: 400 })

    type RelasiEmbed = {
      materi_id: string
      kelas_id: string
      materi: { id: string; file_url: string | null; nama_file: string | null } | null
    }

    const r = relasi as unknown as RelasiEmbed | null
    const m = r?.materi ?? null
    if (!r || !m) {
      return NextResponse.json({ error: 'Materi tidak ditemukan untuk kelas Anda.' }, { status: 404 })
    }
    if (!m.file_url) {
      return NextResponse.json({ error: 'Materi ini tidak memiliki file.' }, { status: 400 })
    }

    const { data: signed, error: urlErr } = await getSupabaseAdmin()
      .storage
      .from('materi')
      .createSignedUrl(m.file_url, 600, {
        download: m.nama_file ?? true,
      })

    if (urlErr || !signed) {
      return NextResponse.json(
        { error: urlErr?.message ?? 'Gagal membuat tautan unduhan.' },
        { status: 400 }
      )
    }

    return NextResponse.json({ url: signed.signedUrl, nama_file: m.nama_file })
  } catch (err) {
    console.error('Error POST siswa materi download:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}