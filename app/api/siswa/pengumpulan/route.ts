import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { siswaAuth } from '@/lib/siswa-auth'

// Pengumpulan tugas siswa (DATABASE_CONTEXT.md #12):
// - Siswa hanya boleh mengumpulkan untuk dirinya sendiri (siswa_id = auth).
// - Tugas harus ditujukan ke kelas siswa dan berstatus published.
// - Satu siswa satu pengumpulan per tugas: mengumpulkan lagi = ganti file lama.
// - File jawaban di bucket private `pengumpulan` -> akses via signed URL.

// GET /api/siswa/pengumpulan?tugas_id=...
// Pengumpulan milik siswa untuk satu tugas (status submit / unduh).
export async function GET(request: NextRequest) {
  try {
    const auth = await siswaAuth()
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const tugasId = request.nextUrl.searchParams.get('tugas_id')
    if (!tugasId) {
      return NextResponse.json({ error: 'Parameter tugas_id wajib diisi.' }, { status: 400 })
    }

    const { data, error } = await getSupabaseAdmin()
      .from('pengumpulan_tugas')
      .select('id, tugas_id, siswa_id, file_url, nama_file, catatan, status, submitted_at, updated_at')
      .eq('siswa_id', auth.siswaId)
      .eq('tugas_id', tugasId)
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({
      pengumpulan: data
        ? {
            id: data.id,
            status: data.status,
            nama_file: data.nama_file,
            catatan: data.catatan,
            submitted_at: data.submitted_at,
            updated_at: data.updated_at,
          }
        : null,
    })
  } catch (err) {
    console.error('Error GET siswa pengumpulan:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// POST /api/siswa/pengumpulan
// Multipart: { tugas_id, file (wajib), catatan? }
export async function POST(request: NextRequest) {
  try {
    const auth = await siswaAuth()
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const contentType = request.headers.get('content-type') ?? ''
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ error: 'Kirim dalam bentuk multipart/form-data.' }, { status: 400 })
    }

    const form = await request.formData()
    const tugasId = String(form.get('tugas_id') ?? '')
    const catatan = form.get('catatan') ? String(form.get('catatan')).trim().slice(0, 2000) : null
    const file = form.get('file')

    if (!tugasId) return NextResponse.json({ error: 'tugas_id wajib diisi.' }, { status: 400 })
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: 'File jawaban wajib diunggah.' }, { status: 400 })
    }
    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: 'Ukuran file maksimal 25MB.' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    // Verifikasi tugas ditujukan ke kelas siswa & masih dapat dikumpulkan.
    const { data: relasi, error: relErr } = await supabase
      .from('tugas_kelas')
      .select('tugas_id, kelas_id, tugas(id, status, deadline, judul)')
      .eq('tugas_id', tugasId)
      .eq('kelas_id', auth.kelasId)
      .maybeSingle()

    if (relErr) return NextResponse.json({ error: relErr.message }, { status: 400 })

    type RelasiEmbed = {
      tugas_id: string
      kelas_id: string
      tugas: { id: string; status: string | null; deadline: string | null; judul: string } | null
    }

    const r = relasi as unknown as RelasiEmbed | null
    const t = r?.tugas ?? null
    if (!r || !t) {
      return NextResponse.json({ error: 'Tugas tidak ditemukan untuk kelas Anda.' }, { status: 404 })
    }
    if (t.status !== 'published') {
      return NextResponse.json({ error: 'Tugas sudah tidak dapat dikumpulkan.' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const terlambat = t.deadline ? now > t.deadline : false
    const status = terlambat ? 'terlambat' : 'dikumpulkan'

    // Cek pengumpulan yang sudah ada untuk siswa ini (satu per tugas).
    const { data: existing, error: exErr } = await supabase
      .from('pengumpulan_tugas')
      .select('id, file_url')
      .eq('siswa_id', auth.siswaId)
      .eq('tugas_id', tugasId)
      .maybeSingle()

    if (exErr) return NextResponse.json({ error: exErr.message }, { status: 400 })

    const ext = file.name.includes('.') ? file.name.split('.').pop() : 'bin'
    const path = `${auth.siswaId}/${tugasId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

    const { error: upErr } = await supabase
      .storage
      .from('pengumpulan')
      .upload(path, file, { upsert: false })

    if (upErr) {
      return NextResponse.json({ error: `Gagal upload file: ${upErr.message}` }, { status: 400 })
    }

    if (existing) {
      // Ganti pengumpulan lama (bukti revisi = file baru, path baru).
      const { error: updErr } = await supabase
        .from('pengumpulan_tugas')
        .update({
          file_url: path,
          nama_file: file.name,
          catatan,
          status,
          submitted_at: now,
          updated_at: now,
        })
        .eq('id', existing.id)
        .eq('siswa_id', auth.siswaId)

      if (updErr) {
        await supabase.storage.from('pengumpulan').remove([path])
        return NextResponse.json({ error: updErr.message }, { status: 400 })
      }
      if (existing.file_url) {
        await supabase.storage.from('pengumpulan').remove([existing.file_url])
      }
    } else {
      const { error: insErr } = await supabase
        .from('pengumpulan_tugas')
        .insert({
          tugas_id: tugasId,
          siswa_id: auth.siswaId,
          file_url: path,
          nama_file: file.name,
          catatan,
          status,
          submitted_at: now,
        })

      if (insErr) {
        await supabase.storage.from('pengumpulan').remove([path])
        return NextResponse.json({ error: insErr.message }, { status: 400 })
      }
    }

    // Notifikasi untuk siswa: pengumpulan tugas berhasil.
    await supabase.from('notifikasi').insert({
      profile_id: auth.userId,
      judul: 'Pengumpulan tugas berhasil',
      pesan: `Tugas "${t.judul}" berhasil dikumpulkan${terlambat ? ' (terlambat)' : ''}.`,
      tipe: 'tugas',
      referensi_id: tugasId,
      is_read: false,
    })

    return NextResponse.json({ message: 'Pengumpulan tugas berhasil.', status }, { status: 201 })
  } catch (err) {
    console.error('Error POST siswa pengumpulan:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}