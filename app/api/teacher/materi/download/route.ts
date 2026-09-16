import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { guruAuth } from '@/lib/guru-auth'

// POST /api/teacher/materi/download
// Body: { id } (id materi milik guru)
// Menghasilkan signed URL (10 menit) untuk mengunduh file dari bucket private `materi`.
export async function POST(request: NextRequest) {
  try {
    const auth = await guruAuth()
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json().catch(() => null)
    const id = body?.id ? String(body.id) : null
    if (!id) {
      return NextResponse.json({ error: 'id wajib diisi.' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    const { data: existing, error: cekErr } = await supabase
      .from('materi')
      .select('id, guru_id, file_url, nama_file')
      .eq('id', id)
      .maybeSingle()

    if (cekErr) return NextResponse.json({ error: cekErr.message }, { status: 400 })
    if (!existing) return NextResponse.json({ error: 'Materi tidak ditemukan.' }, { status: 404 })
    if (existing.guru_id !== auth.guruId) {
      return NextResponse.json({ error: 'Materi ini bukan milik Anda.' }, { status: 403 })
    }
    if (!existing.file_url) {
      return NextResponse.json({ error: 'Materi ini tidak memiliki file.' }, { status: 400 })
    }

    const { data: signed, error: urlErr } = await supabase
      .storage
      .from('materi')
      .createSignedUrl(existing.file_url, 600, {
        download: existing.nama_file ?? true,
      })

    if (urlErr || !signed) {
      return NextResponse.json(
        { error: urlErr?.message ?? 'Gagal membuat tautan unduhan.' },
        { status: 400 }
      )
    }

    return NextResponse.json({ url: signed.signedUrl, nama_file: existing.nama_file })
  } catch (err) {
    console.error('Error POST materi download:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
