import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { siswaAuth } from '@/lib/siswa-auth'

// GET /api/siswa/notifikasi
// Notifikasi milik siswa (notifikasi.profile_id = auth.uid()).
export async function GET() {
  try {
    const auth = await siswaAuth()
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { data, error } = await getSupabaseAdmin()
      .from('notifikasi')
      .select('id, profile_id, judul, pesan, tipe, referensi_id, is_read, created_at')
      .eq('profile_id', auth.userId)
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({
      notifikasi: data ?? [],
      belum_dibaca: (data ?? []).filter((n) => !n.is_read).length,
    })
  } catch (err) {
    console.error('Error GET siswa notifikasi:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// POST /api/siswa/notifikasi
// Body: { ids: string[] } -> tandai notifikasi milik siswa sebagai sudah dibaca.
export async function POST(request: NextRequest) {
  try {
    const auth = await siswaAuth()
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json().catch(() => null)
    const ids = Array.isArray(body?.ids) ? body.ids.map(String) : []

    if (ids.length === 0) {
      return NextResponse.json({ error: 'ids wajib diisi.' }, { status: 400 })
    }

    // Pastikan hanya notifikasi milik siswa ini yang ditandai.
    const { data: own, error: ownErr } = await getSupabaseAdmin()
      .from('notifikasi')
      .select('id')
      .eq('profile_id', auth.userId)
      .in('id', ids)

    if (ownErr) return NextResponse.json({ error: ownErr.message }, { status: 400 })

    const ownIds = (own ?? []).map((n) => n.id)
    if (ownIds.length === 0) {
      return NextResponse.json({ error: 'Notifikasi tidak ditemukan.' }, { status: 404 })
    }

    const { error: updErr } = await getSupabaseAdmin()
      .from('notifikasi')
      .update({ is_read: true })
      .eq('profile_id', auth.userId)
      .in('id', ownIds)

    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 })

    return NextResponse.json({ ok: true, updated: ownIds.length })
  } catch (err) {
    console.error('Error POST siswa notifikasi:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}