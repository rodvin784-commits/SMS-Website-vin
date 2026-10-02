import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { siswaAuth } from '@/lib/siswa-auth'

// Pengumpulan tugas siswa (DATABASE_CONTEXT.md #12):
// - Siswa hanya boleh mengumpulkan untuk dirinya sendiri (siswa_id = auth).
// - Tugas harus ditujukan ke kelas siswa dan berstatus published.
// - Satu siswa satu pengumpulan per tugas: mengumpulkan lagi = ganti jawaban lama (teks dan/atau file).
// - File jawaban di bucket private `pengumpulan` -> akses via signed URL.

const FOTO_MAX_COUNT_SISWA = 5
const FOTO_MAX_SIZE_SISWA = 8 * 1024 * 1024
const ALLOWED_IMAGE_TYPES_SISWA = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']

function isAllowedImageSiswa(file: File): boolean {
  if (ALLOWED_IMAGE_TYPES_SISWA.includes(file.type.toLowerCase())) return true
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  return ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'].includes(ext)
}

function collectFotoFilesSiswa(form: FormData): File[] {
  const keys = ['foto', 'fotos', 'fotos[]', 'foto[]', 'images', 'image', 'photos', 'files']
  const files: File[] = []
  for (const k of keys) {
    const vals = form.getAll(k)
    for (const v of vals) {
      if (v instanceof File && v.size > 0) files.push(v)
    }
  }
  return files
}

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
      .select('id, tugas_id, siswa_id, file_url, nama_file, foto_urls, jawaban_teks, catatan, status, submitted_at, updated_at, nilai, feedback, dinilai_at')
      .eq('siswa_id', auth.siswaId)
      .eq('tugas_id', tugasId)
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({
      pengumpulan: data
        ? {
            id: (data as { id: string }).id,
            status: (data as { status: string | null }).status,
            nama_file: (data as { nama_file: string | null }).nama_file,
            foto_urls: (data as { foto_urls: string[] | null }).foto_urls ?? null,
            jawaban_teks: (data as { jawaban_teks: string | null }).jawaban_teks,
            catatan: (data as { catatan: string | null }).catatan,
            submitted_at: (data as { submitted_at: string | null }).submitted_at,
            updated_at: (data as { updated_at: string | null }).updated_at,
            nilai: (data as { nilai: number | null }).nilai ?? null,
            feedback: (data as { feedback: string | null }).feedback ?? null,
            dinilai_at: (data as { dinilai_at: string | null }).dinilai_at ?? null,
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
// Multipart: { tugas_id, file? (opsional), jawaban_teks? (maks 10.000 karakter), catatan? }
// Minimal salah satu antara file dan jawaban_teks harus terisi.
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
    // PATCH: deteksi field ada/tidak via has() agar tidak hapus data lama tanpa sengaja
    const hasCatatan = form.has('catatan')
    const hasJawabanTeks = form.has('jawaban_teks')
    const hasHapusFoto = String(form.get('hapus_foto') ?? '').toLowerCase() === 'true'
    const catatan = hasCatatan ? String(form.get('catatan') ?? '').trim().slice(0, 2000) || null : null
    const jawabanTeksRaw = hasJawabanTeks ? String(form.get('jawaban_teks') ?? '').trim().slice(0, 10000) : null
    // null = field tidak dikirim (pertahankan), '' -> null tidak dianggap isi tapi tidak hapus jika PATCH
    const jawabanTeks = jawabanTeksRaw && jawabanTeksRaw.length > 0 ? jawabanTeksRaw : null
    const fileRaw = form.get('file')
    const file = fileRaw instanceof File && fileRaw.size > 0 ? fileRaw : null
    let fotoFiles = collectFotoFilesSiswa(form)
    // deduplicate if file also counted as foto
    if (file && fotoFiles.some((f) => f.name === file.name && f.size === file.size)) {
      fotoFiles = fotoFiles.filter((f) => !(f.name === file.name && f.size === file.size))
    }
    const hasFoto = fotoFiles.length > 0

    if (!tugasId) return NextResponse.json({ error: 'tugas_id wajib diisi.' }, { status: 400 })
    // Validasi minimal satu isi: cek field baru ATAU existing nanti (untuk update PATCH)
    // Untuk create, harus ada isi baru; untuk update PATCH, isi lama bisa mencukupi (dicek setelah load existing)
    const hasNewContent = Boolean(file || jawabanTeks || hasFoto)
    if (file && file.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: 'Ukuran file maksimal 25MB.' }, { status: 400 })
    }
    if (fotoFiles.length > FOTO_MAX_COUNT_SISWA) {
      return NextResponse.json({ error: `Maksimal ${FOTO_MAX_COUNT_SISWA} foto per pengumpulan.` }, { status: 400 })
    }
    for (const foto of fotoFiles) {
      if (foto.size > FOTO_MAX_SIZE_SISWA) return NextResponse.json({ error: `Foto "${foto.name}" melebihi ${FOTO_MAX_SIZE_SISWA / (1024 * 1024)}MB.` }, { status: 400 })
      if (!isAllowedImageSiswa(foto)) return NextResponse.json({ error: `Foto "${foto.name}" harus berupa gambar (jpg, png, webp).` }, { status: 400 })
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
      .select('id, file_url, nama_file, foto_urls, jawaban_teks, catatan')
      .eq('siswa_id', auth.siswaId)
      .eq('tugas_id', tugasId)
      .maybeSingle()

    if (exErr) return NextResponse.json({ error: exErr.message }, { status: 400 })

    // Jika tidak ada konten baru dan tidak ada existing -> 400; jika update PATCH dengan existing ada -> izinkan (pertahankan)
    const existingRowEarly = existing as { id: string; file_url: string | null; nama_file: string | null; foto_urls: string[] | null; jawaban_teks: string | null; catatan: string | null } | null
    if (!hasNewContent && !existingRowEarly) {
      return NextResponse.json({ error: 'Isi jawaban teks, unggah file, atau tambahkan foto jawaban.' }, { status: 400 })
    }
    if (!hasNewContent && existingRowEarly) {
      // PATCH tanpa konten baru tapi existing ada -> tetap butuh setidaknya satu perubahan; cek apakah user kirim hasHapusFoto/hasJawabanTeks/hasCatatan kosong ingin clear?
      // Jika semua field tidak dikirim (has* false) -> tolak
      if (!hasJawabanTeks && !hasCatatan && !hasHapusFoto && !file && !hasFoto) {
        return NextResponse.json({ error: 'Isi jawaban teks, unggah file, atau tambahkan foto jawaban.' }, { status: 400 })
      }
    }

    // Upload file utama (file_url) dan foto-foto (foto_urls)
    let path: string | null = null
    if (file) {
      const ext = file.name.includes('.') ? file.name.split('.').pop() : 'bin'
      path = `${auth.siswaId}/${tugasId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

      const { error: upErr } = await supabase
        .storage
        .from('pengumpulan')
        .upload(path, file, { upsert: false })

      if (upErr) {
        return NextResponse.json({ error: `Gagal upload file: ${upErr.message}` }, { status: 400 })
      }
    }

    let fotoPaths: string[] | null = null
    if (fotoFiles.length > 0) {
      fotoPaths = []
      for (const foto of fotoFiles) {
        const ext = foto.name.includes('.') ? foto.name.split('.').pop() : 'jpg'
        const p = `${auth.siswaId}/${tugasId}/foto-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
        const { error: upErr } = await supabase.storage.from('pengumpulan').upload(p, foto, { upsert: false, contentType: foto.type || 'image/jpeg' })
        if (upErr) {
          if (path) await supabase.storage.from('pengumpulan').remove([path])
          if (fotoPaths.length > 0) await supabase.storage.from('pengumpulan').remove(fotoPaths)
          return NextResponse.json({ error: `Gagal upload foto: ${upErr.message}` }, { status: 400 })
        }
        fotoPaths.push(p)
      }
    }

    const existingRow = existing as { id: string; file_url: string | null; nama_file: string | null; foto_urls: string[] | null; jawaban_teks: string | null; catatan: string | null } | null

    if (existing) {
      // PATCH: hanya ubah field yang dikirim; field tidak dikirim -> pertahankan nilai lama (anti data loss)
      const nextFileUrl = file ? path : existingRow!.file_url
      const nextNamaFile = file ? (file.name ?? null) : existingRow!.nama_file
      // foto: hapus hanya jika flag hapus_foto=true atau ada foto baru (replace). Jika tidak kirim foto & tidak minta hapus -> pertahankan.
      let nextFotoUrls: string[] | null
      if (fotoFiles.length > 0) nextFotoUrls = fotoPaths
      else if (hasHapusFoto) nextFotoUrls = null
      else nextFotoUrls = existingRow!.foto_urls
      const nextJawabanTeks = hasJawabanTeks ? jawabanTeks : existingRow!.jawaban_teks
      const nextCatatan = hasCatatan ? catatan : existingRow!.catatan
      // Validasi setelah PATCH: minimal satu konten (file/foto/jawaban) harus ada
      const hasContentAfterPatch = Boolean(nextFileUrl || (nextFotoUrls && nextFotoUrls.length > 0) || nextJawabanTeks)
      if (!hasContentAfterPatch) {
        if (path) await supabase.storage.from('pengumpulan').remove([path])
        if (fotoPaths && fotoPaths.length > 0) await supabase.storage.from('pengumpulan').remove(fotoPaths)
        return NextResponse.json({ error: 'Minimal satu jawaban (teks/file/foto) harus terisi.' }, { status: 400 })
      }
      const { error: updErr } = await supabase
        .from('pengumpulan_tugas')
        .update({
          file_url: nextFileUrl,
          nama_file: nextNamaFile,
          foto_urls: nextFotoUrls,
          jawaban_teks: nextJawabanTeks,
          catatan: nextCatatan,
          status,
          submitted_at: now,
          updated_at: now,
        })
        .eq('id', existingRow!.id)
        .eq('siswa_id', auth.siswaId)

      if (updErr) {
        if (path) await supabase.storage.from('pengumpulan').remove([path])
        if (fotoPaths && fotoPaths.length > 0) await supabase.storage.from('pengumpulan').remove(fotoPaths)
        return NextResponse.json({ error: updErr.message }, { status: 400 })
      }
      // Hapus file lama hanya jika ada file baru yang menggantikan
      if (file && existingRow?.file_url && existingRow.file_url !== path) {
        await supabase.storage.from('pengumpulan').remove([existingRow.file_url])
      }
      if (existingRow?.foto_urls && existingRow.foto_urls.length > 0) {
        // Hanya hapus foto lama jika ada foto baru atau flag hapus
        if (fotoFiles.length > 0 || hasHapusFoto) {
          const toRemove = existingRow.foto_urls.filter((p) => !(nextFotoUrls ?? []).includes(p))
          if (toRemove.length > 0) await supabase.storage.from('pengumpulan').remove(toRemove)
        }
      }
    } else {
      const { error: insErr } = await supabase
        .from('pengumpulan_tugas')
        .insert({
          tugas_id: tugasId,
          siswa_id: auth.siswaId,
          file_url: path,
          nama_file: file?.name ?? null,
          foto_urls: fotoPaths,
          jawaban_teks: jawabanTeks,
          catatan,
          status,
          submitted_at: now,
        })

      if (insErr) {
        if (path) await supabase.storage.from('pengumpulan').remove([path])
        if (fotoPaths && fotoPaths.length > 0) await supabase.storage.from('pengumpulan').remove(fotoPaths)
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