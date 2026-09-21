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
    const fotoIndexRaw = body?.foto_index
    const fotoIndex = fotoIndexRaw !== undefined && fotoIndexRaw !== null ? Number(fotoIndexRaw) : null
    if (!pengumpulanId) {
      return NextResponse.json({ error: 'pengumpulan_id wajib diisi.' }, { status: 400 })
    }

    const { data: peng, error: pengErr } = await getSupabaseAdmin()
      .from('pengumpulan_tugas')
      .select('id, siswa_id, file_url, nama_file, foto_urls')
      .eq('id', pengumpulanId)
      .maybeSingle()

    if (pengErr) return NextResponse.json({ error: pengErr.message }, { status: 400 })
    if (!peng) return NextResponse.json({ error: 'Pengumpulan tidak ditemukan.' }, { status: 404 })

    // Hanya siswa pemilik pengumpulan yang boleh mengunduh.
    if ((peng as { siswa_id: string }).siswa_id !== auth.siswaId) {
      return NextResponse.json({ error: 'Anda hanya dapat mengunduh jawaban Anda sendiri.' }, { status: 403 })
    }
    const p = peng as { file_url: string | null; nama_file: string | null; foto_urls: string[] | null }

    if (fotoIndex !== null && !Number.isNaN(fotoIndex)) {
      if (!p.foto_urls || !p.foto_urls[fotoIndex]) return NextResponse.json({ error: 'Foto tidak ditemukan.' }, { status: 404 })
      const fp = p.foto_urls[fotoIndex]
      const { data: signedFoto, error: fotoErr } = await getSupabaseAdmin().storage.from('pengumpulan').createSignedUrl(fp, 600)
      if (fotoErr || !signedFoto) return NextResponse.json({ error: fotoErr?.message ?? 'Gagal membuat tautan foto.' }, { status: 400 })
      return NextResponse.json({ url: signedFoto.signedUrl, foto_index: fotoIndex })
    }

    let fotoSigned: string[] | null = null
    if (p.foto_urls && p.foto_urls.length > 0) {
      fotoSigned = []
      for (const fp of p.foto_urls) {
        const { data: s } = await getSupabaseAdmin().storage.from('pengumpulan').createSignedUrl(fp, 600)
        if (s) fotoSigned.push(s.signedUrl)
      }
    }

    if (!p.file_url) {
      if (fotoSigned && fotoSigned.length > 0) return NextResponse.json({ url: fotoSigned[0], foto_urls: fotoSigned, nama_file: p.nama_file, is_foto: true })
      return NextResponse.json({ error: 'File belum tersedia.' }, { status: 400 })
    }

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
    console.error('Error POST siswa pengumpulan download:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}