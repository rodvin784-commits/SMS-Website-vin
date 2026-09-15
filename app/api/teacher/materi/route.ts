import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getProfileRole, getSessionUser, getSupabaseAdmin } from '@/lib/supabase-server'

type MapelEmbed = { nama: string; kode: string }[] | { nama: string; kode: string } | null
type KelasEmbed =
  | { nama_kelas: string; tingkat: number; tahun_ajaran: string }[]
  | { nama_kelas: string; tingkat: number; tahun_ajaran: string }
  | null

type AssignmentRow = {
  id: string
  mapel_id: string
  kelas_id: string
  mata_pelajaran: MapelEmbed
  kelas: KelasEmbed
}

type MateriRow = {
  id: string
  guru_mengajar_id: string
  judul: string
  deskripsi: string | null
  video_url: string | null
  materi_url: string | null
  status: boolean
  created_at: string
  updated_at: string
}

function pickOne<T>(v: T[] | T | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null)
}

// Semua penugasan milik guru yang sedang login (dipakai untuk validasi kepemilikan)
async function getOwnedAssignmentIds(guruId: string): Promise<Set<string>> {
  const { data, error } = await getSupabaseAdmin()
    .from('guru_mengajar')
    .select('id')
    .eq('guru_id', guruId)

  if (error) {
    console.error('Gagal memuat penugasan guru:', error.message)
    return new Set()
  }
  return new Set(((data ?? []) as { id: string }[]).map((r) => r.id))
}

// Validasi bentuk URL video/materi (http/https, maks 500 karakter). null/'' = tidak diisi.
function validateUrl(value: unknown, label: string): { ok: true; url: string | null } | { ok: false; error: string } {
  if (value === null || value === undefined || value === '') return { ok: true, url: null }
  const url = String(value).trim()
  if (url.length > 500) return { ok: false, error: `${label} maksimal 500 karakter.` }
  if (!/^https?:\/\/.+/i.test(url)) return { ok: false, error: `${label} harus dimulai dengan http:// atau https://` }
  return { ok: true, url }
}

function cleanJudul(value: unknown): string {
  return String(value ?? '').trim().slice(0, 150)
}

// GET /api/teacher/materi -> semua materi milik guru yang login (+ info penugasan)
export async function GET() {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Belum login' }, { status: 401 })
    }

    const profile = await getProfileRole(user.id)
    if (profile.role !== 'guru' || profile.status === false) {
      return NextResponse.json({ error: 'Tidak diizinkan. Hanya guru aktif.' }, { status: 403 })
    }

    const supabase = getSupabaseAdmin()

    const [materiRes, asgRes] = await Promise.all([
      supabase
        .from('materi_kelas')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase
        .from('guru_mengajar')
        .select('id, mapel_id, kelas_id, mata_pelajaran(nama, kode), kelas(nama_kelas, tingkat, tahun_ajaran)')
        .eq('guru_id', user.id),
    ])

    if (materiRes.error) {
      return NextResponse.json({ error: materiRes.error.message }, { status: 400 })
    }
    if (asgRes.error) {
      return NextResponse.json({ error: asgRes.error.message }, { status: 400 })
    }

    const ownedIds = new Set(((asgRes.data ?? []) as { id: string }[]).map((r) => r.id))

    const assignmentInfo = new Map<string, { mapel_nama: string | null; mapel_kode: string | null; kelas_nama: string | null; tingkat: number | null; tahun_ajaran: string | null }>()
    for (const raw of (asgRes.data ?? []) as unknown as AssignmentRow[]) {
      const mapel = pickOne(raw.mata_pelajaran)
      const kelas = pickOne(raw.kelas)
      assignmentInfo.set(raw.id, {
        mapel_nama: mapel?.nama ?? null,
        mapel_kode: mapel?.kode ?? null,
        kelas_nama: kelas?.nama_kelas ?? null,
        tingkat: kelas?.tingkat ?? null,
        tahun_ajaran: kelas?.tahun_ajaran ?? null,
      })
    }

    const materi = ((materiRes.data ?? []) as unknown as MateriRow[])
      .filter((m) => ownedIds.has(m.guru_mengajar_id))
      .map((m) => {
        const info = assignmentInfo.get(m.guru_mengajar_id)
        return {
          id: m.id,
          guru_mengajar_id: m.guru_mengajar_id,
          judul: m.judul,
          deskripsi: m.deskripsi,
          video_url: m.video_url,
          materi_url: m.materi_url,
          status: m.status,
          created_at: m.created_at,
          updated_at: m.updated_at,
          mapel_nama: info?.mapel_nama ?? null,
          mapel_kode: info?.mapel_kode ?? null,
          kelas_nama: info?.kelas_nama ?? null,
          tingkat: info?.tingkat ?? null,
          tahun_ajaran: info?.tahun_ajaran ?? null,
        }
      })

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
// Body: { guru_mengajar_id, judul, deskripsi?, video_url?, materi_url? }
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Belum login' }, { status: 401 })
    }

    const profile = await getProfileRole(user.id)
    if (profile.role !== 'guru' || profile.status === false) {
      return NextResponse.json({ error: 'Tidak diizinkan. Hanya guru aktif.' }, { status: 403 })
    }

    const body = await request.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: 'Body JSON tidak valid.' }, { status: 400 })
    }

    const { guru_mengajar_id: gmId, judul, deskripsi, video_url, materi_url } = body
    if (!gmId) {
      return NextResponse.json({ error: 'Penugasan (guru_mengajar_id) wajib dipilih.' }, { status: 400 })
    }

    const judulBersih = cleanJudul(judul)
    if (!judulBersih) {
      return NextResponse.json({ error: 'Judul materi wajib diisi.' }, { status: 400 })
    }

    const video = validateUrl(video_url, 'URL video')
    if (!video.ok) return NextResponse.json({ error: video.error }, { status: 400 })
    const dok = validateUrl(materi_url, 'URL materi')
    if (!dok.ok) return NextResponse.json({ error: dok.error }, { status: 400 })

    // Materi minimal harus punya salah satu: deskripsi, video, atau dokumen
    const deskripsiBersih = deskripsi ? String(deskripsi).trim().slice(0, 2000) : null
    if (!deskripsiBersih && !video.url && !dok.url) {
      return NextResponse.json(
        { error: 'Isi minimal salah satu: deskripsi, URL video, atau URL materi.' },
        { status: 400 }
      )
    }

    // Pastikan penugasan benar-benar milik guru ini
    const owned = await getOwnedAssignmentIds(user.id)
    if (!owned.has(String(gmId))) {
      return NextResponse.json({ error: 'Penugasan tidak ditemukan atau bukan milik Anda.' }, { status: 404 })
    }

    const { data, error } = await getSupabaseAdmin()
      .from('materi_kelas')
      .insert({
        guru_mengajar_id: gmId,
        judul: judulBersih,
        deskripsi: deskripsiBersih,
        video_url: video.url,
        materi_url: dok.url,
        status: true,
      })
      .select('id, judul')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ message: 'Materi berhasil ditambahkan.', materi: data }, { status: 201 })
  } catch (err) {
    console.error('Error POST materi:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// PUT /api/teacher/materi
// Body: { id, judul?, deskripsi?, video_url?, materi_url?, status? }
export async function PUT(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Belum login' }, { status: 401 })
    }

    const profile = await getProfileRole(user.id)
    if (profile.role !== 'guru' || profile.status === false) {
      return NextResponse.json({ error: 'Tidak diizinkan. Hanya guru aktif.' }, { status: 403 })
    }

    const body = await request.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: 'Body JSON tidak valid.' }, { status: 400 })
    }

    const { id, judul, deskripsi, video_url, materi_url, status } = body
    if (!id) {
      return NextResponse.json({ error: 'ID materi wajib diisi.' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    // Pastikan materi ini milik guru yang login (join lewat penugasan)
    const { data: existing, error: cekError } = await supabase
      .from('materi_kelas')
      .select('id, guru_mengajar_id')
      .eq('id', id)
      .maybeSingle()

    if (cekError) {
      return NextResponse.json({ error: cekError.message }, { status: 400 })
    }
    if (!existing) {
      return NextResponse.json({ error: 'Materi tidak ditemukan.' }, { status: 404 })
    }

    const owned = await getOwnedAssignmentIds(user.id)
    if (!owned.has(existing.guru_mengajar_id)) {
      return NextResponse.json({ error: 'Materi ini bukan milik Anda.' }, { status: 403 })
    }

    const updates: {
      judul?: string
      deskripsi?: string | null
      video_url?: string | null
      materi_url?: string | null
      status?: boolean
    } = {}

    if (judul !== undefined) {
      const judulBersih = cleanJudul(judul)
      if (!judulBersih) {
        return NextResponse.json({ error: 'Judul materi tidak boleh kosong.' }, { status: 400 })
      }
      updates.judul = judulBersih
    }

    if (deskripsi !== undefined) {
      updates.deskripsi = deskripsi ? String(deskripsi).trim().slice(0, 2000) || null : null
    }

    if (video_url !== undefined) {
      const video = validateUrl(video_url, 'URL video')
      if (!video.ok) return NextResponse.json({ error: video.error }, { status: 400 })
      updates.video_url = video.url
    }

    if (materi_url !== undefined) {
      const dok = validateUrl(materi_url, 'URL materi')
      if (!dok.ok) return NextResponse.json({ error: dok.error }, { status: 400 })
      updates.materi_url = dok.url
    }

    if (status !== undefined) {
      updates.status = Boolean(status)
    }

    const { data, error } = await supabase
      .from('materi_kelas')
      .update(updates)
      .eq('id', id)
      .select('id, judul')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ message: 'Materi berhasil diperbarui.', materi: data })
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
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Belum login' }, { status: 401 })
    }

    const profile = await getProfileRole(user.id)
    if (profile.role !== 'guru' || profile.status === false) {
      return NextResponse.json({ error: 'Tidak diizinkan. Hanya guru aktif.' }, { status: 403 })
    }

    const id = request.nextUrl.searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'Parameter id wajib diisi.' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    const { data: existing, error: cekError } = await supabase
      .from('materi_kelas')
      .select('id, guru_mengajar_id, judul')
      .eq('id', id)
      .maybeSingle()

    if (cekError) {
      return NextResponse.json({ error: cekError.message }, { status: 400 })
    }
    if (!existing) {
      return NextResponse.json({ error: 'Materi tidak ditemukan.' }, { status: 404 })
    }

    const owned = await getOwnedAssignmentIds(user.id)
    if (!owned.has(existing.guru_mengajar_id)) {
      return NextResponse.json({ error: 'Materi ini bukan milik Anda.' }, { status: 403 })
    }

    const { error } = await supabase
      .from('materi_kelas')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
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
