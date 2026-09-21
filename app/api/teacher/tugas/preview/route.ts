import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { guruAuth } from '@/lib/guru-auth'
import { namaDariUrl } from '@/lib/siswa-query'

// POST /api/teacher/tugas/preview
// Body: { id: tugasId }
// Mengembalikan signed URLs untuk lampiran & foto tugas milik guru
export async function POST(request: NextRequest) {
  try {
    const auth = await guruAuth()
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const body = await request.json().catch(() => null)
    const id = body?.id ? String(body.id) : null
    if (!id) return NextResponse.json({ error: 'id wajib diisi.' }, { status: 400 })

    const { data: tugas, error } = await getSupabaseAdmin()
      .from('tugas')
      .select('id, guru_id, lampiran_url, foto_urls')
      .eq('id', id)
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    if (!tugas) return NextResponse.json({ error: 'Tugas tidak ditemukan.' }, { status: 404 })
    const t = tugas as { id: string; guru_id: string; lampiran_url: string | null; foto_urls: string[] | null }
    if (t.guru_id !== auth.guruId) return NextResponse.json({ error: 'Tugas ini bukan milik Anda.' }, { status: 403 })

    const result: { lampiran: { url: string; nama_file: string | null } | null; fotos: { url: string; path: string }[] } = {
      lampiran: null,
      fotos: [],
    }

    if (t.lampiran_url) {
      const { data: signed, error: urlErr } = await getSupabaseAdmin().storage.from('tugas').createSignedUrl(t.lampiran_url, 600)
      if (!urlErr && signed) result.lampiran = { url: signed.signedUrl, nama_file: namaDariUrl(t.lampiran_url) }
    }
    if (t.foto_urls && t.foto_urls.length > 0) {
      for (const p of t.foto_urls) {
        const { data: signed } = await getSupabaseAdmin().storage.from('tugas').createSignedUrl(p, 600)
        if (signed) result.fotos.push({ url: signed.signedUrl, path: p })
      }
    }

    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Terjadi kesalahan server' }, { status: 500 })
  }
}
