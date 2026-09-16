import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { siswaAuth } from '@/lib/siswa-auth'

// POST /api/siswa/pengumpulan/download
// Body: { pengumpulan_id }
// Signed URL (10 menit) untuk mengunduh file jawaban — hanya file milik siswa sendiri.
export async function POST(request: NextRequest) {
  try {
    const auth = await siswaAuth()
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json().catch(() => null)
    const pengumpulanId = body?.pengumpulan_id ? String(body.pengumpulan_id) : null
    if (!pengumpulanId) {
      return NextResponse.json({ error: 'pengumpulan_id wajib diisi.' }, { status: 400 })
    }

    const { data: peng, error: pengErr } = await getSupabaseAdmin()
      .from('pengumpulan_tugas')
      .select('id, siswa_id, file_url, nama_file')
      .eq('id', pengumpulanId)
      .maybeSingle()

    if (pengErr) return NextResponse.json({ error: pengErr.message }, { status: 400 })
    if (!peng) return NextResponse.json({ error: 'Pengumpulan tidak ditemukan.' }, { status: 404 })

    // Hanya siswa pemilik pengumpulan yang boleh mengunduh.
    if (peng.siswa_id !== auth.siswaId) {
      return NextResponse.json({ error: 'Anda hanya dapat mengunduh jawaban Anda sendiri.' }, { status: 403 })
    }
    if (!peng.file_url) {
      return NextResponse.json({ error: 'File belum tersedia.' }, { status: 400 })
    }

    const { data: signed, error: urlErr } = await getSupabaseAdmin()
      .storage
      .from('pengumpulan')
      .createSignedUrl(peng.file_url, 600, {
        download: peng.nama_file ?? true,
      })

    if (urlErr || !signed) {
      return NextResponse.json(
        { error: urlErr?.message ?? 'Gagal membuat tautan unduhan.' },
        { status: 400 }
      )
    }

    return NextResponse.json({ url: signed.signedUrl, nama_file: peng.nama_file })
  } catch (err) {
    console.error('Error POST siswa pengumpulan download:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}