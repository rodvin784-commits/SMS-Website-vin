import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { guruAuth, isAssigned } from '@/lib/guru-auth'
import { kirimNotifikasiKeKelas } from '@/lib/notifikasi'

// Tugas (DATABASE_CONTEXT.md #10-11):
// - tugas: judul, deskripsi, tanggal_mulai, deadline, lampiran (bucket `tugas`), status draft/published/closed
// - tugas_kelas: target kelas. Guru hanya boleh memilih kelas dari guru_kelas miliknya.

const STATUS_VALID = ['draft', 'published', 'closed'] as const
type StatusTugas = (typeof STATUS_VALID)[number]

function isStatus(v: unknown): v is StatusTugas {
  return typeof v === 'string' && (STATUS_VALID as readonly string[]).includes(v)
}

const FOTO_MAX_COUNT = 5
const FOTO_MAX_SIZE = 8 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']

function isAllowedImage(file: File): boolean {
  if (ALLOWED_IMAGE_TYPES.includes(file.type.toLowerCase())) return true
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  return ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'].includes(ext)
}

function collectFotoFiles(form: FormData): File[] {
  const keys = ['foto', 'fotos', 'fotos[]', 'foto[]', 'images', 'image']
  const files: File[] = []
  for (const k of keys) {
    const vals = form.getAll(k)
    for (const v of vals) {
      if (v instanceof File && v.size > 0) files.push(v)
    }
  }
  // also handle generic fallback: any file field whose name contains foto/image and not lampiran
  // already covered above. Deduplicate by identity
  return files
}

const TUGAS_SELECT = `
  id,
  guru_id,
  mata_pelajaran_id,
  judul,
  deskripsi,
  tanggal_mulai,
  deadline,
  lampiran_url,
  foto_urls,
  status,
  created_at,
  updated_at,
  mata_pelajaran(nama, kode),
  tugas_kelas(kelas_id, kelas(nama_kelas, tingkat))
`

type MapelEmbed = { nama: string; kode: string } | { nama: string; kode: string }[] | null
type KelasEmbed = { nama_kelas: string; tingkat: number } | { nama_kelas: string; tingkat: number }[] | null

type TugasEmbedRow = {
  id: string
  guru_id: string
  mata_pelajaran_id: string
  judul: string
  deskripsi: string | null
  tanggal_mulai: string | null
  deadline: string | null
  lampiran_url: string | null
  foto_urls: string[] | null
  status: string | null
  created_at: string
  updated_at: string | null
  mata_pelajaran: MapelEmbed
  tugas_kelas: { kelas_id: string; kelas: KelasEmbed }[] | null
}

const pickOne = <T,>(v: T[] | T | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null)

function mapTugas(r: TugasEmbedRow) {
  const mapel = pickOne(r.mata_pelajaran)
  return {
    id: r.id,
    mata_pelajaran_id: r.mata_pelajaran_id,
    mapel_nama: mapel?.nama ?? null,
    mapel_kode: mapel?.kode ?? null,
    judul: r.judul,
    deskripsi: r.deskripsi,
    tanggal_mulai: r.tanggal_mulai,
    deadline: r.deadline,
    lampiran_url: r.lampiran_url,
    foto_urls: r.foto_urls ?? null,
    status: r.status ?? 'draft',
    created_at: r.created_at,
    kelas: (r.tugas_kelas ?? [])
      .map((tk) => {
        const k = pickOne(tk.kelas)
        return { kelas_id: tk.kelas_id, nama_kelas: k?.nama_kelas ?? null, tingkat: k?.tingkat ?? null }
      }),
  }
}

async function parseTanggal(v: unknown, label: string): Promise<{ ok: true; value: string | null } | { ok: false; error: string }> {
  if (v === null || v === undefined || v === '') return { ok: true, value: null }
  const d = new Date(String(v))
  if (Number.isNaN(d.getTime())) return { ok: false, error: `${label} tidak valid.` }
  return { ok: true, value: d.toISOString() }
}

// GET /api/teacher/tugas -> semua tugas milik guru yang login
export async function GET() {
  try {
    const auth = await guruAuth()
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { data, error } = await getSupabaseAdmin()
      .from('tugas')
      .select(TUGAS_SELECT)
      .eq('guru_id', auth.guruId)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const tugas = ((data ?? []) as unknown as TugasEmbedRow[]).map(mapTugas)
    return NextResponse.json({ tugas })
  } catch (err) {
    console.error('Error GET tugas:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// POST /api/teacher/tugas
// Body JSON: { mata_pelajaran_id, kelas_ids: string[], judul, deskripsi?, tanggal_mulai?, deadline?, status? }
// Body multipart (dengan lampiran): field-file "lampiran", field teks seperti di atas (kelas_ids = JSON array)
export async function POST(request: NextRequest) {
  try {
    const auth = await guruAuth()
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const contentType = request.headers.get('content-type') ?? ''
    let mapelId = ''
    let kelasIds: string[] = []
    let judul = ''
    let deskripsi: string | null = null
    let tanggalMulai: string | null = null
    let deadline: string | null = null
    let status: StatusTugas = 'draft'
    let file: File | null = null
    let fotoFiles: File[] = []

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData()
      mapelId = String(form.get('mata_pelajaran_id') ?? '')
      try {
        kelasIds = JSON.parse(String(form.get('kelas_ids') ?? '[]'))
      } catch {
        kelasIds = []
      }
      judul = String(form.get('judul') ?? '').trim().slice(0, 200)
      deskripsi = form.get('deskripsi') ? String(form.get('deskripsi')).trim().slice(0, 5000) : null
      const tm = await parseTanggal(form.get('tanggal_mulai'), 'Tanggal mulai')
      if (!tm.ok) return NextResponse.json({ error: tm.error }, { status: 400 })
      tanggalMulai = tm.value
      const dl = await parseTanggal(form.get('deadline'), 'Deadline')
      if (!dl.ok) return NextResponse.json({ error: dl.error }, { status: 400 })
      deadline = dl.value
      const st = form.get('status')
      if (st && isStatus(String(st))) status = String(st) as StatusTugas
      const f = form.get('lampiran')
      if (f instanceof File && f.size > 0) file = f
      fotoFiles = collectFotoFiles(form)
      if (fotoFiles.length > FOTO_MAX_COUNT) {
        return NextResponse.json({ error: `Maksimal ${FOTO_MAX_COUNT} foto per tugas.` }, { status: 400 })
      }
      for (const foto of fotoFiles) {
        if (foto.size > FOTO_MAX_SIZE) {
          return NextResponse.json({ error: `Foto "${foto.name}" melebihi ${FOTO_MAX_SIZE / (1024 * 1024)}MB.` }, { status: 400 })
        }
        if (!isAllowedImage(foto)) {
          return NextResponse.json({ error: `Foto "${foto.name}" harus berupa gambar (jpg, png, webp).` }, { status: 400 })
        }
      }
    } else {
      const body = await request.json().catch(() => null)
      if (!body) return NextResponse.json({ error: 'Body JSON tidak valid.' }, { status: 400 })
      mapelId = String(body.mata_pelajaran_id ?? '')
      kelasIds = Array.isArray(body.kelas_ids) ? body.kelas_ids.map(String) : []
      judul = String(body.judul ?? '').trim().slice(0, 200)
      deskripsi = body.deskripsi ? String(body.deskripsi).trim().slice(0, 5000) : null
      const tm = await parseTanggal(body.tanggal_mulai, 'Tanggal mulai')
      if (!tm.ok) return NextResponse.json({ error: tm.error }, { status: 400 })
      tanggalMulai = tm.value
      const dl = await parseTanggal(body.deadline, 'Deadline')
      if (!dl.ok) return NextResponse.json({ error: dl.error }, { status: 400 })
      deadline = dl.value
      if (body.status !== undefined) {
        if (!isStatus(body.status)) {
          return NextResponse.json({ error: 'Status tidak valid (draft/published/closed).' }, { status: 400 })
        }
        status = body.status
      }
    }

    if (!mapelId) return NextResponse.json({ error: 'Mata pelajaran wajib dipilih.' }, { status: 400 })
    if (kelasIds.length === 0) return NextResponse.json({ error: 'Pilih minimal satu kelas tujuan.' }, { status: 400 })
    if (!judul) return NextResponse.json({ error: 'Judul tugas wajib diisi.' }, { status: 400 })

    // Guru hanya boleh mengirim tugas ke kelas yang diajar untuk mapel ini
    for (const kelasId of kelasIds) {
      if (!(await isAssigned(auth.guruId, mapelId, kelasId))) {
        return NextResponse.json(
          { error: 'Terdapat kelas yang tidak Anda ampu untuk mapel ini.' },
          { status: 403 }
        )
      }
    }

    // Upload lampiran ke bucket `tugas` (private) — simpan path di kolom lampiran_url
    let lampiranPath: string | null = null
    if (file) {
      if (file.size > 15 * 1024 * 1024) {
        return NextResponse.json({ error: 'Lampiran maksimal 15MB.' }, { status: 400 })
      }
      const ext = file.name.includes('.') ? file.name.split('.').pop() : 'bin'
      const path = `${auth.guruId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { error: upErr } = await getSupabaseAdmin()
        .storage
        .from('tugas')
        .upload(path, file, { upsert: false })
      if (upErr) {
        return NextResponse.json({ error: `Gagal upload lampiran: ${upErr.message}` }, { status: 400 })
      }
      lampiranPath = path
    }

    // Upload foto ke bucket `tugas` (private) — simpan array path di foto_urls
    let fotoPaths: string[] | null = null
    if (fotoFiles.length > 0) {
      fotoPaths = []
      for (const foto of fotoFiles) {
        const ext = foto.name.includes('.') ? foto.name.split('.').pop() : 'jpg'
        const path = `${auth.guruId}/foto-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
        const { error: upErr } = await getSupabaseAdmin()
          .storage
          .from('tugas')
          .upload(path, foto, { upsert: false, contentType: foto.type || 'image/jpeg' })
        if (upErr) {
          // rollback already uploaded fotos + lampiran
          if (fotoPaths.length > 0) await getSupabaseAdmin().storage.from('tugas').remove(fotoPaths)
          if (lampiranPath) await getSupabaseAdmin().storage.from('tugas').remove([lampiranPath])
          return NextResponse.json({ error: `Gagal upload foto: ${upErr.message}` }, { status: 400 })
        }
        fotoPaths.push(path)
      }
    }

    const { data: created, error: insErr } = await getSupabaseAdmin()
      .from('tugas')
      .insert({
        guru_id: auth.guruId,
        mata_pelajaran_id: mapelId,
        judul,
        deskripsi,
        tanggal_mulai: tanggalMulai,
        deadline: deadline ?? new Date().toISOString(),
        lampiran_url: lampiranPath,
        foto_urls: fotoPaths,
        status,
      })
      .select('id')
      .single()

    if (insErr) {
      // Bersihkan lampiran/foto jika insert gagal
      if (lampiranPath) {
        await getSupabaseAdmin().storage.from('tugas').remove([lampiranPath])
      }
      if (fotoPaths && fotoPaths.length > 0) {
        await getSupabaseAdmin().storage.from('tugas').remove(fotoPaths)
      }
      return NextResponse.json({ error: insErr.message }, { status: 400 })
    }

    const { error: tkErr } = await getSupabaseAdmin()
      .from('tugas_kelas')
      .insert(kelasIds.map((kelas_id) => ({ tugas_id: created.id, kelas_id })))

    if (tkErr) {
      // Rollback: hapus tugas + lampiran/foto bila relasi kelas gagal
      await getSupabaseAdmin().from('tugas').delete().eq('id', created.id)
      if (lampiranPath) {
        await getSupabaseAdmin().storage.from('tugas').remove([lampiranPath])
      }
      if (fotoPaths && fotoPaths.length > 0) {
        await getSupabaseAdmin().storage.from('tugas').remove(fotoPaths)
      }
      return NextResponse.json({ error: tkErr.message }, { status: 400 })
    }

    if (status === 'published') {
      await kirimNotifikasiKeKelas(kelasIds, {
        judul: 'Tugas baru',
        pesan: `Tugas baru "${judul}" telah dipublikasikan.`,
        tipe: 'tugas',
        referensiId: created.id,
      })
    }

    return NextResponse.json({ message: 'Tugas berhasil dibuat.', id: created.id }, { status: 201 })
  } catch (err) {
    console.error('Error POST tugas:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// PUT /api/teacher/tugas
// Mendukung JSON (edit teks) dan multipart (edit + ganti/tambah foto, ganti lampiran)
// Body JSON: { id, judul?, deskripsi?, tanggal_mulai?, deadline?, status?, kelas_ids?, hapus_foto? }
// Body multipart: id + field teks + file `lampiran` + foto `foto`/`fotos`
export async function PUT(request: NextRequest) {
  try {
    const auth = await guruAuth()
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const contentType = request.headers.get('content-type') ?? ''
    let body: Record<string, unknown> = {}
    let fotoFiles: File[] = []
    let lampiranFile: File | null = null

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData()
      for (const [k, v] of form.entries()) {
        if (v instanceof File) continue
        body[k] = String(v)
      }
      // id wajib
      if (form.get('id')) body.id = String(form.get('id'))
      // kelas_ids bisa JSON string
      const klsRaw = form.get('kelas_ids')
      if (klsRaw) {
        try { body.kelas_ids = JSON.parse(String(klsRaw)) } catch { body.kelas_ids = [] }
      }
      const lf = form.get('lampiran')
      if (lf instanceof File && lf.size > 0) lampiranFile = lf
      fotoFiles = collectFotoFiles(form)
      if (fotoFiles.length > FOTO_MAX_COUNT) {
        return NextResponse.json({ error: `Maksimal ${FOTO_MAX_COUNT} foto per tugas.` }, { status: 400 })
      }
      for (const foto of fotoFiles) {
        if (foto.size > FOTO_MAX_SIZE) return NextResponse.json({ error: `Foto "${foto.name}" melebihi ${FOTO_MAX_SIZE / (1024 * 1024)}MB.` }, { status: 400 })
        if (!isAllowedImage(foto)) return NextResponse.json({ error: `Foto "${foto.name}" harus berupa gambar.` }, { status: 400 })
      }
      // hapus_foto flag
      const hapus = form.get('hapus_foto')
      if (hapus) body.hapus_foto = String(hapus)
      const hapusLamp = form.get('hapus_lampiran')
      if (hapusLamp) body.hapus_lampiran = String(hapusLamp)
    } else {
      const j = await request.json().catch(() => null)
      if (!j?.id) return NextResponse.json({ error: 'ID tugas wajib diisi.' }, { status: 400 })
      body = j
    }

    if (!body?.id) {
      return NextResponse.json({ error: 'ID tugas wajib diisi.' }, { status: 400 })
    }

    const { data: existing, error: cekErr } = await getSupabaseAdmin()
      .from('tugas')
      .select('id, guru_id, lampiran_url, foto_urls')
      .eq('id', String(body.id))
      .maybeSingle()

    if (cekErr) return NextResponse.json({ error: cekErr.message }, { status: 400 })
    if (!existing) return NextResponse.json({ error: 'Tugas tidak ditemukan.' }, { status: 404 })
    if ((existing as { guru_id: string }).guru_id !== auth.guruId) {
      return NextResponse.json({ error: 'Tugas ini bukan milik Anda.' }, { status: 403 })
    }

    const updates: Record<string, unknown> = {}

    if (body.judul !== undefined) {
      const j = String(body.judul).trim().slice(0, 200)
      if (!j) return NextResponse.json({ error: 'Judul tidak boleh kosong.' }, { status: 400 })
      updates.judul = j
    }
    if (body.deskripsi !== undefined) {
      updates.deskripsi = body.deskripsi ? String(body.deskripsi).trim().slice(0, 5000) || null : null
    }
    if (body.tanggal_mulai !== undefined) {
      const tm = await parseTanggal(body.tanggal_mulai, 'Tanggal mulai')
      if (!tm.ok) return NextResponse.json({ error: tm.error }, { status: 400 })
      updates.tanggal_mulai = tm.value
    }
    if (body.deadline !== undefined) {
      const dl = await parseTanggal(body.deadline, 'Deadline')
      if (!dl.ok) return NextResponse.json({ error: dl.error }, { status: 400 })
      updates.deadline = dl.value
    }
    if (body.status !== undefined) {
      if (!isStatus(body.status as string)) {
        return NextResponse.json({ error: 'Status tidak valid (draft/published/closed).' }, { status: 400 })
      }
      updates.status = body.status
    }

    // Handle hapus lampiran / foto via flag
    const existingRow = existing as { foto_urls: string[] | null; lampiran_url: string | null }
    if (body.hapus_lampiran === 'true' || body.hapus_lampiran === true) {
      if (existingRow.lampiran_url) {
        await getSupabaseAdmin().storage.from('tugas').remove([existingRow.lampiran_url])
      }
      updates.lampiran_url = null
    }
    if (body.hapus_foto === 'true' || body.hapus_foto === true) {
      if (existingRow.foto_urls && existingRow.foto_urls.length > 0) {
        await getSupabaseAdmin().storage.from('tugas').remove(existingRow.foto_urls)
      }
      updates.foto_urls = null
    }

    // Upload lampiran baru jika ada
    if (lampiranFile) {
      if (lampiranFile.size > 15 * 1024 * 1024) return NextResponse.json({ error: 'Lampiran maksimal 15MB.' }, { status: 400 })
      const ext = lampiranFile.name.includes('.') ? lampiranFile.name.split('.').pop() : 'bin'
      const path = `${auth.guruId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { error: upErr } = await getSupabaseAdmin().storage.from('tugas').upload(path, lampiranFile, { upsert: false })
      if (upErr) return NextResponse.json({ error: `Gagal upload lampiran: ${upErr.message}` }, { status: 400 })
      if (existingRow.lampiran_url) await getSupabaseAdmin().storage.from('tugas').remove([existingRow.lampiran_url])
      updates.lampiran_url = path
    }

    // Upload foto baru jika ada
    if (fotoFiles.length > 0) {
      const newFotoPaths: string[] = []
      for (const foto of fotoFiles) {
        const ext = foto.name.includes('.') ? foto.name.split('.').pop() : 'jpg'
        const path = `${auth.guruId}/foto-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
        const { error: upErr } = await getSupabaseAdmin().storage.from('tugas').upload(path, foto, { upsert: false, contentType: foto.type || 'image/jpeg' })
        if (upErr) {
          if (newFotoPaths.length > 0) await getSupabaseAdmin().storage.from('tugas').remove(newFotoPaths)
          return NextResponse.json({ error: `Gagal upload foto: ${upErr.message}` }, { status: 400 })
        }
        newFotoPaths.push(path)
      }
      // Jika hapus_foto true, ganti; jika tidak, append ke existing (max 5)
      // updates.foto_urls sudah null jika hapus_foto, otherwise use existing
      const base = (updates.foto_urls === null) ? [] : (existingRow.foto_urls ?? [])
      const combined = [...base, ...newFotoPaths].slice(0, FOTO_MAX_COUNT)
      // jika melebihi, hapus kelebihan yang tidak disimpan
      const overflow = [...base, ...newFotoPaths].slice(FOTO_MAX_COUNT)
      if (overflow.length > 0) await getSupabaseAdmin().storage.from('tugas').remove(overflow)
      updates.foto_urls = combined.length > 0 ? combined : null
    }

    // Ganti target kelas
    if (body.kelas_ids !== undefined) {
      if (!Array.isArray(body.kelas_ids) || body.kelas_ids.length === 0) {
        return NextResponse.json({ error: 'Pilih minimal satu kelas tujuan.' }, { status: 400 })
      }
      const mapelId = String(body.mata_pelajaran_id ?? '')
      if (!mapelId) {
        return NextResponse.json({ error: 'mata_pelajaran_id wajib disertakan saat mengubah kelas tujuan.' }, { status: 400 })
      }
      const kelasIds: string[] = (body.kelas_ids as unknown[]).map((k) => String(k))
      for (const kelasId of kelasIds) {
        if (!(await isAssigned(auth.guruId, mapelId, kelasId))) {
          return NextResponse.json(
            { error: 'Terdapat kelas yang tidak Anda ampu untuk mapel ini.' },
            { status: 403 }
          )
        }
      }
      const { error: delErr } = await getSupabaseAdmin()
        .from('tugas_kelas')
        .delete()
        .eq('tugas_id', String(body.id))
      if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 })

      const { error: tkErr } = await getSupabaseAdmin()
        .from('tugas_kelas')
        .insert(kelasIds.map((kelas_id) => ({ tugas_id: String(body.id), kelas_id })))
      if (tkErr) return NextResponse.json({ error: tkErr.message }, { status: 400 })
    }

    if (Object.keys(updates).length > 0) {
      const { error } = await getSupabaseAdmin()
        .from('tugas')
        .update(updates)
        .eq('id', String(body.id))
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Publikasi via edit (draft -> published) juga memberi notifikasi ke kelas target.
    if (updates.status === 'published') {
      let kelasIds: string[] = []
      if (body.kelas_ids !== undefined) {
        kelasIds = (body.kelas_ids as string[]).map(String)
      } else {
        const { data: tk } = await getSupabaseAdmin()
          .from('tugas_kelas')
          .select('kelas_id')
          .eq('tugas_id', String(body.id))
        kelasIds = ((tk ?? []) as { kelas_id: string }[]).map((r) => r.kelas_id)
      }
      await kirimNotifikasiKeKelas(kelasIds, {
        judul: 'Tugas baru',
        pesan: 'Sebuah tugas telah dipublikasikan untuk kelasmu.',
        tipe: 'tugas',
        referensiId: String(body.id),
      })
    }

    return NextResponse.json({ message: 'Tugas berhasil diperbarui.' })
  } catch (err) {
    console.error('Error PUT tugas:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// DELETE /api/teacher/tugas?id=...
export async function DELETE(request: NextRequest) {
  try {
    const auth = await guruAuth()
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const id = request.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Parameter id wajib diisi.' }, { status: 400 })

    const { data: existing, error: cekErr } = await getSupabaseAdmin()
      .from('tugas')
      .select('id, guru_id, judul, lampiran_url, foto_urls')
      .eq('id', id)
      .maybeSingle()

    if (cekErr) return NextResponse.json({ error: cekErr.message }, { status: 400 })
    if (!existing) return NextResponse.json({ error: 'Tugas tidak ditemukan.' }, { status: 404 })
    if ((existing as { guru_id: string }).guru_id !== auth.guruId) {
      return NextResponse.json({ error: 'Tugas ini bukan milik Anda.' }, { status: 403 })
    }

    const { error } = await getSupabaseAdmin().from('tugas').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Hapus lampiran & foto dari Storage (cascade tugas_kelas & pengumpulan_tugas menyesuaikan policy DB)
    const ex = existing as { lampiran_url: string | null; foto_urls: string[] | null; judul: string }
    if (ex.lampiran_url) {
      await getSupabaseAdmin().storage.from('tugas').remove([ex.lampiran_url])
    }
    if (ex.foto_urls && ex.foto_urls.length > 0) {
      await getSupabaseAdmin().storage.from('tugas').remove(ex.foto_urls)
    }

    return NextResponse.json({ message: `Tugas "${(existing as { judul: string }).judul}" berhasil dihapus.` })
  } catch (err) {
    console.error('Error DELETE tugas:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
