import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { guruAuth, isAssigned } from '@/lib/guru-auth'

// Materi (DATABASE_CONTEXT.md #13-14):
// - materi: judul, deskripsi, file (bucket private `materi`), per (guru, mata_pelajaran)
// - materi_kelas: target kelas. Guru hanya boleh memilih kelas dari guru_kelas miliknya.
// Catatan: target kelas berlaku per kombinasi (materi, kelas). Guru wajib ditugaskan
// (mapel, kelas) pada guru_kelas untuk setiap kelas tujuan.

const MATERI_SELECT = `
  id,
  guru_id,
  mata_pelajaran_id,
  judul,
  deskripsi,
  file_url,
  nama_file,
  created_at,
  updated_at,
  mata_pelajaran(nama, kode),
  materi_kelas(kelas_id, kelas(nama_kelas, tingkat))
`

type MapelEmbed = { nama: string; kode: string } | { nama: string; kode: string }[] | null
type KelasEmbed = { nama_kelas: string; tingkat: number } | { nama_kelas: string; tingkat: number }[] | null

type MateriEmbedRow = {
  id: string
  guru_id: string
  mata_pelajaran_id: string
  judul: string
  deskripsi: string | null
  file_url: string | null
  nama_file: string | null
  created_at: string
  updated_at: string | null
  mata_pelajaran: MapelEmbed
  materi_kelas: { kelas_id: string; kelas: KelasEmbed }[] | null
}

const pickOne = <T,>(v: T[] | T | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null)

function mapMateri(r: MateriEmbedRow) {
  const mapel = pickOne(r.mata_pelajaran)
  return {
    id: r.id,
    mata_pelajaran_id: r.mata_pelajaran_id,
    mapel_nama: mapel?.nama ?? null,
    mapel_kode: mapel?.kode ?? null,
    judul: r.judul,
    deskripsi: r.deskripsi,
    file_url: r.file_url,
    nama_file: r.nama_file,
    has_file: Boolean(r.file_url),
    created_at: r.created_at,
    updated_at: r.updated_at,
    kelas: (r.materi_kelas ?? []).map((mk) => {
      const k = pickOne(mk.kelas)
      return { kelas_id: mk.kelas_id, nama_kelas: k?.nama_kelas ?? null, tingkat: k?.tingkat ?? null }
    }),
  }
}

// GET /api/teacher/materi -> semua materi milik guru yang login
export async function GET() {
  try {
    const auth = await guruAuth()
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { data, error } = await getSupabaseAdmin()
      .from('materi')
      .select(MATERI_SELECT)
      .eq('guru_id', auth.guruId)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const materi = ((data ?? []) as unknown as MateriEmbedRow[]).map(mapMateri)
    return NextResponse.json({ materi })
  } catch (err) {
    console.error('Error GET materi:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// POST /api/teacher/materi
// JSON: { mata_pelajaran_id, kelas_ids: string[], judul, deskripsi? }
// Multipart: field "file" (lampiran) + field teks seperti di atas (kelas_ids = JSON array)
// Minimal salah satu: deskripsi ATAU file.
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
    let file: File | null = null

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
      const f = form.get('file')
      if (f instanceof File && f.size > 0) file = f
    } else {
      const body = await request.json().catch(() => null)
      if (!body) return NextResponse.json({ error: 'Body JSON tidak valid.' }, { status: 400 })
      mapelId = String(body.mata_pelajaran_id ?? '')
      kelasIds = Array.isArray(body.kelas_ids) ? body.kelas_ids.map(String) : []
      judul = String(body.judul ?? '').trim().slice(0, 200)
      deskripsi = body.deskripsi ? String(body.deskripsi).trim().slice(0, 5000) : null
    }

    if (!mapelId) return NextResponse.json({ error: 'Mata pelajaran wajib dipilih.' }, { status: 400 })
    if (kelasIds.length === 0) return NextResponse.json({ error: 'Pilih minimal satu kelas tujuan.' }, { status: 400 })
    if (!judul) return NextResponse.json({ error: 'Judul materi wajib diisi.' }, { status: 400 })
    if (!deskripsi && !file) {
      return NextResponse.json(
        { error: 'Isi minimal salah satu: deskripsi atau unggah file materi.' },
        { status: 400 }
      )
    }

    // Guru hanya boleh mengirim materi ke kelas yang diajar untuk mapel ini
    for (const kelasId of kelasIds) {
      if (!(await isAssigned(auth.guruId, mapelId, kelasId))) {
        return NextResponse.json(
          { error: 'Terdapat kelas yang tidak Anda ampu untuk mapel ini.' },
          { status: 403 }
        )
      }
    }

    // Upload file ke bucket `materi` (private) — simpan path di kolom file_url
    let filePath: string | null = null
    let namaFile: string | null = null
    if (file) {
      if (file.size > 25 * 1024 * 1024) {
        return NextResponse.json({ error: 'Ukuran file maksimal 25MB.' }, { status: 400 })
      }
      const ext = file.name.includes('.') ? file.name.split('.').pop() : 'bin'
      const path = `${auth.guruId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { error: upErr } = await getSupabaseAdmin()
        .storage
        .from('materi')
        .upload(path, file, { upsert: false })
      if (upErr) {
        return NextResponse.json({ error: `Gagal upload file: ${upErr.message}` }, { status: 400 })
      }
      filePath = path
      namaFile = file.name
    }

    const { data: created, error: insErr } = await getSupabaseAdmin()
      .from('materi')
      .insert({
        guru_id: auth.guruId,
        mata_pelajaran_id: mapelId,
        judul,
        deskripsi,
        file_url: filePath,
        nama_file: namaFile,
      })
      .select('id')
      .single()

    if (insErr) {
      if (filePath) await getSupabaseAdmin().storage.from('materi').remove([filePath])
      return NextResponse.json({ error: insErr.message }, { status: 400 })
    }

    const { error: mkErr } = await getSupabaseAdmin()
      .from('materi_kelas')
      .insert(kelasIds.map((kelas_id) => ({ materi_id: created.id, kelas_id })))

    if (mkErr) {
      // Rollback
      await getSupabaseAdmin().from('materi').delete().eq('id', created.id)
      if (filePath) await getSupabaseAdmin().storage.from('materi').remove([filePath])
      return NextResponse.json({ error: mkErr.message }, { status: 400 })
    }

    return NextResponse.json({ message: 'Materi berhasil ditambahkan.', id: created.id }, { status: 201 })
  } catch (err) {
    console.error('Error POST materi:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// PUT /api/teacher/materi
// JSON: { id, judul?, deskripsi?, kelas_ids?, mata_pelajaran_id? (wajib jika ubah kelas_ids) }
// Multipart: { id, file? } untuk menambah/ganti file.
export async function PUT(request: NextRequest) {
  try {
    const auth = await guruAuth()
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const contentType = request.headers.get('content-type') ?? ''
    let id = ''
    let judul: string | undefined
    let deskripsi: string | null | undefined
    let kelasIds: string[] | undefined
    let mapelId: string | undefined
    let file: File | null = null

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData()
      id = String(form.get('id') ?? '')
      if (form.get('judul') !== null) judul = String(form.get('judul'))
      if (form.get('deskripsi') !== null) deskripsi = String(form.get('deskripsi'))
      if (form.get('kelas_ids') !== null) {
        try {
          kelasIds = JSON.parse(String(form.get('kelas_ids')))
        } catch {
          kelasIds = undefined
        }
      }
      if (form.get('mata_pelajaran_id') !== null) mapelId = String(form.get('mata_pelajaran_id'))
      const f = form.get('file')
      if (f instanceof File && f.size > 0) file = f
    } else {
      const body = await request.json().catch(() => null)
      if (!body) return NextResponse.json({ error: 'Body JSON tidak valid.' }, { status: 400 })
      id = String(body.id ?? '')
      judul = body.judul
      deskripsi = body.deskripsi
      kelasIds = body.kelas_ids
      mapelId = body.mata_pelajaran_id
    }

    if (!id) return NextResponse.json({ error: 'ID materi wajib diisi.' }, { status: 400 })

    const supabase = getSupabaseAdmin()

    const { data: existing, error: cekErr } = await supabase
      .from('materi')
      .select('id, guru_id, mata_pelajaran_id, file_url')
      .eq('id', id)
      .maybeSingle()

    if (cekErr) return NextResponse.json({ error: cekErr.message }, { status: 400 })
    if (!existing) return NextResponse.json({ error: 'Materi tidak ditemukan.' }, { status: 404 })
    if (existing.guru_id !== auth.guruId) {
      return NextResponse.json({ error: 'Materi ini bukan milik Anda.' }, { status: 403 })
    }

    // Validasi kelas tujuan baru
    const targetMapel = mapelId ?? existing.mata_pelajaran_id
    if (kelasIds !== undefined) {
      if (!Array.isArray(kelasIds) || kelasIds.length === 0) {
        return NextResponse.json({ error: 'Pilih minimal satu kelas tujuan.' }, { status: 400 })
      }
      for (const kelasId of kelasIds) {
        if (!(await isAssigned(auth.guruId, targetMapel, kelasId))) {
          return NextResponse.json(
            { error: 'Terdapat kelas yang tidak Anda ampu untuk mapel ini.' },
            { status: 403 }
          )
        }
      }
    }

    // Upload file baru (ganti file lama)
    let newFilePath: string | null = null
    let newNamaFile: string | null = null
    if (file) {
      if (file.size > 25 * 1024 * 1024) {
        return NextResponse.json({ error: 'Ukuran file maksimal 25MB.' }, { status: 400 })
      }
      const ext = file.name.includes('.') ? file.name.split('.').pop() : 'bin'
      const path = `${auth.guruId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { error: upErr } = await supabase
        .storage
        .from('materi')
        .upload(path, file, { upsert: false })
      if (upErr) {
        return NextResponse.json({ error: `Gagal upload file: ${upErr.message}` }, { status: 400 })
      }
      newFilePath = path
      newNamaFile = file.name
    }

    const updates: Record<string, unknown> = {}
    if (judul !== undefined) {
      const j = String(judul).trim().slice(0, 200)
      if (!j) return NextResponse.json({ error: 'Judul tidak boleh kosong.' }, { status: 400 })
      updates.judul = j
    }
    if (deskripsi !== undefined) {
      updates.deskripsi = deskripsi ? String(deskripsi).trim().slice(0, 5000) || null : null
    }
    if (newFilePath) {
      updates.file_url = newFilePath
      updates.nama_file = newNamaFile
    }

    if (Object.keys(updates).length > 0) {
      const { error } = await supabase.from('materi').update(updates).eq('id', id)
      if (error) {
        if (newFilePath) await supabase.storage.from('materi').remove([newFilePath])
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
      // Hapus file lama jika diganti
      if (newFilePath && existing.file_url) {
        await supabase.storage.from('materi').remove([existing.file_url])
      }
    }

    // Perbarui kelas tujuan
    if (kelasIds !== undefined) {
      const { error: delErr } = await supabase.from('materi_kelas').delete().eq('materi_id', id)
      if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 })

      const { error: mkErr } = await supabase
        .from('materi_kelas')
        .insert(kelasIds.map((kelas_id) => ({ materi_id: id, kelas_id })))
      if (mkErr) return NextResponse.json({ error: mkErr.message }, { status: 400 })
    }

    return NextResponse.json({ message: 'Materi berhasil diperbarui.' })
  } catch (err) {
    console.error('Error PUT materi:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// DELETE /api/teacher/materi?id=...
export async function DELETE(request: NextRequest) {
  try {
    const auth = await guruAuth()
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const id = request.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Parameter id wajib diisi.' }, { status: 400 })

    const supabase = getSupabaseAdmin()

    const { data: existing, error: cekErr } = await supabase
      .from('materi')
      .select('id, guru_id, judul, file_url')
      .eq('id', id)
      .maybeSingle()

    if (cekErr) return NextResponse.json({ error: cekErr.message }, { status: 400 })
    if (!existing) return NextResponse.json({ error: 'Materi tidak ditemukan.' }, { status: 404 })
    if (existing.guru_id !== auth.guruId) {
      return NextResponse.json({ error: 'Materi ini bukan milik Anda.' }, { status: 403 })
    }

    const { error } = await supabase.from('materi').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    if (existing.file_url) {
      await supabase.storage.from('materi').remove([existing.file_url])
    }

    return NextResponse.json({ message: `Materi "${existing.judul}" berhasil dihapus.` })
  } catch (err) {
    console.error('Error DELETE materi:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
