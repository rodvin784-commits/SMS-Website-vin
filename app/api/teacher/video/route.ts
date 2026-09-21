import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { guruAuth, isAssigned } from '@/lib/guru-auth'
import { kirimNotifikasiKeKelas } from '@/lib/notifikasi'

// Video pembelajaran (DATABASE_CONTEXT.md #15-16):
// - video_materi: judul, deskripsi, video_url, thumbnail_url per (guru, mata_pelajaran)
// - video_kelas: target kelas. Guru hanya boleh memilih kelas dari guru_kelas miliknya.

const VIDEO_SELECT = `
  id,
  guru_id,
  mata_pelajaran_id,
  judul,
  deskripsi,
  video_url,
  thumbnail_url,
  created_at,
  updated_at,
  mata_pelajaran(nama, kode),
  video_kelas(kelas_id, kelas(nama_kelas, tingkat))
`

type MapelEmbed = { nama: string; kode: string } | { nama: string; kode: string }[] | null
type KelasEmbed = { nama_kelas: string; tingkat: number } | { nama_kelas: string; tingkat: number }[] | null

type VideoEmbedRow = {
  id: string
  guru_id: string
  mata_pelajaran_id: string
  judul: string
  deskripsi: string | null
  video_url: string | null
  thumbnail_url: string | null
  created_at: string
  updated_at: string | null
  mata_pelajaran: MapelEmbed
  video_kelas: { kelas_id: string; kelas: KelasEmbed }[] | null
}

const pickOne = <T,>(v: T[] | T | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null)

function mapVideo(r: VideoEmbedRow) {
  const mapel = pickOne(r.mata_pelajaran)
  return {
    id: r.id,
    mata_pelajaran_id: r.mata_pelajaran_id,
    mapel_nama: mapel?.nama ?? null,
    mapel_kode: mapel?.kode ?? null,
    judul: r.judul,
    deskripsi: r.deskripsi,
    video_url: r.video_url,
    thumbnail_url: r.thumbnail_url,
    created_at: r.created_at,
    kelas: (r.video_kelas ?? []).map((vk) => {
      const k = pickOne(vk.kelas)
      return { kelas_id: vk.kelas_id, nama_kelas: k?.nama_kelas ?? null, tingkat: k?.tingkat ?? null }
    }),
  }
}

function youtubeIdFromUrl(url: string): string | null {
  try {
    const m = url.match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([\w-]{11})/)
    return m ? m[1] : null
  } catch { return null }
}

function youtubeThumbnailFromUrl(url: string): string | null {
  const id = youtubeIdFromUrl(url)
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null
}

function validateUrl(value: unknown, label: string): { ok: true; url: string } | { ok: false; error: string } {
  const url = String(value ?? '').trim()
  if (!url) return { ok: false, error: `${label} wajib diisi.` }
  if (url.length > 500) return { ok: false, error: `${label} maksimal 500 karakter.` }
  if (!/^https?:\/\/.+/i.test(url)) return { ok: false, error: `${label} harus dimulai dengan http:// atau https://` }
  return { ok: true, url }
}

// GET /api/teacher/video -> semua video milik guru yang login
export async function GET() {
  try {
    const auth = await guruAuth()
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { data, error } = await getSupabaseAdmin()
      .from('video_materi')
      .select(VIDEO_SELECT)
      .eq('guru_id', auth.guruId)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const video = ((data ?? []) as unknown as VideoEmbedRow[]).map(mapVideo)
    return NextResponse.json({ video })
  } catch (err) {
    console.error('Error GET video:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// POST /api/teacher/video
// Body: { mata_pelajaran_id, kelas_ids: string[], judul, video_url, deskripsi?, thumbnail_url? }
export async function POST(request: NextRequest) {
  try {
    const auth = await guruAuth()
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Body JSON tidak valid.' }, { status: 400 })

    const mapelId = String(body.mata_pelajaran_id ?? '')
    const kelasIds: string[] = Array.isArray(body.kelas_ids) ? body.kelas_ids.map(String) : []
    const judul = String(body.judul ?? '').trim().slice(0, 200)

    if (!mapelId) return NextResponse.json({ error: 'Mata pelajaran wajib dipilih.' }, { status: 400 })
    if (kelasIds.length === 0) return NextResponse.json({ error: 'Pilih minimal satu kelas tujuan.' }, { status: 400 })
    if (!judul) return NextResponse.json({ error: 'Judul video wajib diisi.' }, { status: 400 })

    const videoUrl = validateUrl(body.video_url, 'URL video')
    if (!videoUrl.ok) return NextResponse.json({ error: videoUrl.error }, { status: 400 })

    let thumbnailUrl: string | null = null
    if (body.thumbnail_url) {
      const thumb = validateUrl(body.thumbnail_url, 'URL thumbnail')
      if (!thumb.ok) return NextResponse.json({ error: thumb.error }, { status: 400 })
      thumbnailUrl = thumb.url
    }
    // Auto-generate thumbnail dari YouTube jika tidak diisi
    if (!thumbnailUrl) {
      const autoThumb = youtubeThumbnailFromUrl(videoUrl.url)
      if (autoThumb) thumbnailUrl = autoThumb
    }

    for (const kelasId of kelasIds) {
      if (!(await isAssigned(auth.guruId, mapelId, kelasId))) {
        return NextResponse.json(
          { error: 'Terdapat kelas yang tidak Anda ampu untuk mapel ini.' },
          { status: 403 }
        )
      }
    }

    const { data: created, error: insErr } = await getSupabaseAdmin()
      .from('video_materi')
      .insert({
        guru_id: auth.guruId,
        mata_pelajaran_id: mapelId,
        judul,
        deskripsi: body.deskripsi ? String(body.deskripsi).trim().slice(0, 5000) : null,
        video_url: videoUrl.url,
        thumbnail_url: thumbnailUrl,
      })
      .select('id')
      .single()

    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 })

    const { error: vkErr } = await getSupabaseAdmin()
      .from('video_kelas')
      .insert(kelasIds.map((kelas_id) => ({ video_id: created.id, kelas_id })))

    if (vkErr) {
      await getSupabaseAdmin().from('video_materi').delete().eq('id', created.id)
      return NextResponse.json({ error: vkErr.message }, { status: 400 })
    }

    await kirimNotifikasiKeKelas(kelasIds, {
      judul: 'Video baru',
      pesan: `Video pembelajaran baru "${judul}" tersedia.`,
      tipe: 'video',
      referensiId: created.id,
    })

    return NextResponse.json({ message: 'Video berhasil ditambahkan.', id: created.id }, { status: 201 })
  } catch (err) {
    console.error('Error POST video:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// PUT /api/teacher/video
// Body: { id, judul?, deskripsi?, video_url?, thumbnail_url?, kelas_ids?, mata_pelajaran_id? }
export async function PUT(request: NextRequest) {
  try {
    const auth = await guruAuth()
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json().catch(() => null)
    if (!body?.id) return NextResponse.json({ error: 'ID video wajib diisi.' }, { status: 400 })
    const id = String(body.id)

    const supabase = getSupabaseAdmin()

    const { data: existing, error: cekErr } = await supabase
      .from('video_materi')
      .select('id, guru_id, mata_pelajaran_id')
      .eq('id', id)
      .maybeSingle()

    if (cekErr) return NextResponse.json({ error: cekErr.message }, { status: 400 })
    if (!existing) return NextResponse.json({ error: 'Video tidak ditemukan.' }, { status: 404 })
    if (existing.guru_id !== auth.guruId) {
      return NextResponse.json({ error: 'Video ini bukan milik Anda.' }, { status: 403 })
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
    if (body.video_url !== undefined) {
      const v = validateUrl(body.video_url, 'URL video')
      if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })
      updates.video_url = v.url
    }
    if (body.thumbnail_url !== undefined) {
      if (body.thumbnail_url === null || body.thumbnail_url === '') {
        // Jika dikosongkan, coba auto dari video_url (baru atau existing)
        const candidateUrl = body.video_url ? String(body.video_url) : null
        if (candidateUrl) {
          const v = validateUrl(candidateUrl, 'URL video')
          if (v.ok) {
            const autoThumb = youtubeThumbnailFromUrl(v.url)
            if (autoThumb) {
              updates.thumbnail_url = autoThumb
            } else {
              updates.thumbnail_url = null
            }
          } else {
            updates.thumbnail_url = null
          }
        } else {
          updates.thumbnail_url = null
        }
      } else {
        const t = validateUrl(body.thumbnail_url, 'URL thumbnail')
        if (!t.ok) return NextResponse.json({ error: t.error }, { status: 400 })
        updates.thumbnail_url = t.url
      }
    } else if (body.video_url !== undefined) {
      // Video URL diubah tapi thumbnail tidak disentuh: auto jika existing thumbnail null
      const v = validateUrl(body.video_url, 'URL video')
      if (v.ok) {
        const { data: cur } = await supabase.from('video_materi').select('thumbnail_url').eq('id', id).maybeSingle()
        const curThumb = (cur as { thumbnail_url: string | null } | null)?.thumbnail_url ?? null
        if (!curThumb) {
          const autoThumb = youtubeThumbnailFromUrl(v.url)
          if (autoThumb) updates.thumbnail_url = autoThumb
        }
      }
    }

    // Kelas tujuan
    if (body.kelas_ids !== undefined) {
      if (!Array.isArray(body.kelas_ids) || body.kelas_ids.length === 0) {
        return NextResponse.json({ error: 'Pilih minimal satu kelas tujuan.' }, { status: 400 })
      }
      const targetMapel = String(body.mata_pelajaran_id ?? existing.mata_pelajaran_id)
      const kelasIds: string[] = body.kelas_ids.map((kelas_id: string) => kelas_id)
      for (const kelasId of kelasIds) {
        if (!(await isAssigned(auth.guruId, targetMapel, kelasId))) {
          return NextResponse.json(
            { error: 'Terdapat kelas yang tidak Anda ampu untuk mapel ini.' },
            { status: 403 }
          )
        }
      }
      const { error: delErr } = await supabase.from('video_kelas').delete().eq('video_id', id)
      if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 })

      const { error: vkErr } = await supabase
        .from('video_kelas')
        .insert(kelasIds.map((kelas_id) => ({ video_id: id, kelas_id })))
      if (vkErr) return NextResponse.json({ error: vkErr.message }, { status: 400 })
    }

    if (Object.keys(updates).length > 0) {
      const { error } = await supabase.from('video_materi').update(updates).eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ message: 'Video berhasil diperbarui.' })
  } catch (err) {
    console.error('Error PUT video:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// DELETE /api/teacher/video?id=...
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
      .from('video_materi')
      .select('id, guru_id, judul')
      .eq('id', id)
      .maybeSingle()

    if (cekErr) return NextResponse.json({ error: cekErr.message }, { status: 400 })
    if (!existing) return NextResponse.json({ error: 'Video tidak ditemukan.' }, { status: 404 })
    if (existing.guru_id !== auth.guruId) {
      return NextResponse.json({ error: 'Video ini bukan milik Anda.' }, { status: 403 })
    }

    const { error } = await supabase.from('video_materi').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ message: `Video "${existing.judul}" berhasil dihapus.` })
  } catch (err) {
    console.error('Error DELETE video:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
