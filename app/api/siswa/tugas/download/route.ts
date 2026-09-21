import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { siswaAuth } from '@/lib/siswa-auth'
import { namaDariUrl } from '@/lib/siswa-query'

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
    const fotoIndexRaw = body?.foto_index
    const fotoIndex = fotoIndexRaw !== undefined && fotoIndexRaw !== null ? Number(fotoIndexRaw) : null
    if (!id) {
      return NextResponse.json({ error: 'id wajib diisi.' }, { status: 400 })
    }

    // Pastikan tugas benar-benar ditujukan untuk kelas siswa.
    const { data: relasi, error: relErr } = await getSupabaseAdmin()
      .from('tugas_kelas')
      .select('tugas_id, kelas_id, tugas(id, lampiran_url, foto_urls, status)')
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
        foto_urls: string[] | null
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

    // Jika minta foto spesifik
    if (fotoIndex !== null && !Number.isNaN(fotoIndex)) {
      if (!t.foto_urls || !t.foto_urls[fotoIndex]) {
        return NextResponse.json({ error: 'Foto tidak ditemukan.' }, { status: 404 })
      }
      const fp = t.foto_urls[fotoIndex]
      const { data: signedFoto, error: fotoErr } = await getSupabaseAdmin().storage.from('tugas').createSignedUrl(fp, 600)
      if (fotoErr || !signedFoto) return NextResponse.json({ error: fotoErr?.message ?? 'Gagal membuat tautan foto.' }, { status: 400 })
      return NextResponse.json({ url: signedFoto.signedUrl, foto_index: fotoIndex, foto_urls: t.foto_urls })
    }

    // Jika ada foto, sertakan signed foto urls juga
    let fotoSigned: string[] | null = null
    if (t.foto_urls && t.foto_urls.length > 0) {
      fotoSigned = []
      for (const fp of t.foto_urls) {
        const { data: s } = await getSupabaseAdmin().storage.from('tugas').createSignedUrl(fp, 600)
        if (s) fotoSigned.push(s.signedUrl)
      }
    }

    if (!t.lampiran_url) {
      if (fotoSigned && fotoSigned.length > 0) {
        return NextResponse.json({ url: fotoSigned[0], foto_urls: fotoSigned, nama_file: null, is_foto: true })
      }
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

    return NextResponse.json({ url: signed.signedUrl, nama_file: namaDariUrl(t.lampiran_url), foto_urls: fotoSigned })
  } catch (err) {
    console.error('Error POST siswa tugas download:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
