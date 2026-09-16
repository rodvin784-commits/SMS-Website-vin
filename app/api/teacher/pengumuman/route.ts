import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { guruAuth } from '@/lib/guru-auth'

// Pengumuman (DATABASE_CONTEXT.md #17-18):
// - pengumuman: judul, isi, per guru
// - pengumuman_kelas: target kelas. Guru hanya boleh mengirim ke kelas yang diajar.
// Catatan struktur: pengumuman tidak berelasi ke mata_pelajaran_id, sehingga pengecekan
// guru_kelas dilakukan per kelas saja (guru mengajar kelas tsb di mapel manapun).

const PENGUMUMAN_SELECT = `
  id,
  guru_id,
  judul,
  isi,
  created_at,
  updated_at,
  pengumuman_kelas(kelas_id, kelas(nama_kelas, tingkat))
`

type KelasEmbed = { nama_kelas: string; tingkat: number } | { nama_kelas: string; tingkat: number }[] | null

type PengumumanEmbedRow = {
  id: string
  guru_id: string
  judul: string
  isi: string | null
  created_at: string
  updated_at: string | null
  pengumuman_kelas: { kelas_id: string; kelas: KelasEmbed }[] | null
}

const pickOne = <T,>(v: T[] | T | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null)

function mapPengumuman(r: PengumumanEmbedRow) {
  return {
    id: r.id,
    judul: r.judul,
    isi: r.isi,
    created_at: r.created_at,
    kelas: (r.pengumuman_kelas ?? []).map((pk) => {
      const k = pickOne(pk.kelas)
      return { kelas_id: pk.kelas_id, nama_kelas: k?.nama_kelas ?? null, tingkat: k?.tingkat ?? null }
    }),
  }
}

// Kelas unik yang diajar guru (mapel apapun) — dipakai untuk validasi target pengumuman
async function getKelasDiajar(guruId: string): Promise<Set<string>> {
  const { data, error } = await getSupabaseAdmin()
    .from('guru_kelas')
    .select('kelas_id')
    .eq('guru_id', guruId)

  if (error) {
    console.error('Gagal memuat kelas diajar:', error.message)
    return new Set()
  }
  return new Set(((data ?? []) as { kelas_id: string }[]).map((r) => r.kelas_id))
}

// GET /api/teacher/pengumuman -> semua pengumuman milik guru yang login
export async function GET() {
  try {
    const auth = await guruAuth()
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { data, error } = await getSupabaseAdmin()
      .from('pengumuman')
      .select(PENGUMUMAN_SELECT)
      .eq('guru_id', auth.guruId)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const pengumuman = ((data ?? []) as unknown as PengumumanEmbedRow[]).map(mapPengumuman)
    return NextResponse.json({ pengumuman })
  } catch (err) {
    console.error('Error GET pengumuman:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// POST /api/teacher/pengumuman
// Body: { judul, isi, kelas_ids: string[] }
export async function POST(request: NextRequest) {
  try {
    const auth = await guruAuth()
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Body JSON tidak valid.' }, { status: 400 })

    const judul = String(body.judul ?? '').trim().slice(0, 200)
    const isi = body.isi ? String(body.isi).trim().slice(0, 5000) : null
    const kelasIds: string[] = Array.isArray(body.kelas_ids) ? body.kelas_ids.map(String) : []

    if (!judul) return NextResponse.json({ error: 'Judul pengumuman wajib diisi.' }, { status: 400 })
    if (!isi) return NextResponse.json({ error: 'Isi pengumuman wajib diisi.' }, { status: 400 })
    if (kelasIds.length === 0) return NextResponse.json({ error: 'Pilih minimal satu kelas tujuan.' }, { status: 400 })

    const kelasDiajar = await getKelasDiajar(auth.guruId)
    for (const kelasId of kelasIds) {
      if (!kelasDiajar.has(kelasId)) {
        return NextResponse.json(
          { error: 'Terdapat kelas yang tidak Anda ampu.' },
          { status: 403 }
        )
      }
    }

    const { data: created, error: insErr } = await getSupabaseAdmin()
      .from('pengumuman')
      .insert({ guru_id: auth.guruId, judul, isi })
      .select('id')
      .single()

    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 })

    const { error: pkErr } = await getSupabaseAdmin()
      .from('pengumuman_kelas')
      .insert(kelasIds.map((kelas_id) => ({ pengumuman_id: created.id, kelas_id })))

    if (pkErr) {
      await getSupabaseAdmin().from('pengumuman').delete().eq('id', created.id)
      return NextResponse.json({ error: pkErr.message }, { status: 400 })
    }

    return NextResponse.json({ message: 'Pengumuman berhasil dibuat.', id: created.id }, { status: 201 })
  } catch (err) {
    console.error('Error POST pengumuman:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// PUT /api/teacher/pengumuman
// Body: { id, judul?, isi?, kelas_ids? }
export async function PUT(request: NextRequest) {
  try {
    const auth = await guruAuth()
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json().catch(() => null)
    if (!body?.id) return NextResponse.json({ error: 'ID pengumuman wajib diisi.' }, { status: 400 })
    const id = String(body.id)

    const supabase = getSupabaseAdmin()

    const { data: existing, error: cekErr } = await supabase
      .from('pengumuman')
      .select('id, guru_id')
      .eq('id', id)
      .maybeSingle()

    if (cekErr) return NextResponse.json({ error: cekErr.message }, { status: 400 })
    if (!existing) return NextResponse.json({ error: 'Pengumuman tidak ditemukan.' }, { status: 404 })
    if (existing.guru_id !== auth.guruId) {
      return NextResponse.json({ error: 'Pengumuman ini bukan milik Anda.' }, { status: 403 })
    }

    const updates: Record<string, unknown> = {}

    if (body.judul !== undefined) {
      const j = String(body.judul).trim().slice(0, 200)
      if (!j) return NextResponse.json({ error: 'Judul tidak boleh kosong.' }, { status: 400 })
      updates.judul = j
    }
    if (body.isi !== undefined) {
      const i = String(body.isi).trim().slice(0, 5000)
      if (!i) return NextResponse.json({ error: 'Isi tidak boleh kosong.' }, { status: 400 })
      updates.isi = i
    }

    if (body.kelas_ids !== undefined) {
      if (!Array.isArray(body.kelas_ids) || body.kelas_ids.length === 0) {
        return NextResponse.json({ error: 'Pilih minimal satu kelas tujuan.' }, { status: 400 })
      }
      const kelasIds: string[] = body.kelas_ids.map((kelas_id: string) => kelas_id)
      const kelasDiajar = await getKelasDiajar(auth.guruId)
      for (const kelasId of kelasIds) {
        if (!kelasDiajar.has(kelasId)) {
          return NextResponse.json({ error: 'Terdapat kelas yang tidak Anda ampu.' }, { status: 403 })
        }
      }
      const { error: delErr } = await supabase.from('pengumuman_kelas').delete().eq('pengumuman_id', id)
      if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 })

      const { error: pkErr } = await supabase
        .from('pengumuman_kelas')
        .insert(kelasIds.map((kelas_id) => ({ pengumuman_id: id, kelas_id })))
      if (pkErr) return NextResponse.json({ error: pkErr.message }, { status: 400 })
    }

    if (Object.keys(updates).length > 0) {
      const { error } = await supabase.from('pengumuman').update(updates).eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ message: 'Pengumuman berhasil diperbarui.' })
  } catch (err) {
    console.error('Error PUT pengumuman:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// DELETE /api/teacher/pengumuman?id=...
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
      .from('pengumuman')
      .select('id, guru_id, judul')
      .eq('id', id)
      .maybeSingle()

    if (cekErr) return NextResponse.json({ error: cekErr.message }, { status: 400 })
    if (!existing) return NextResponse.json({ error: 'Pengumuman tidak ditemukan.' }, { status: 404 })
    if (existing.guru_id !== auth.guruId) {
      return NextResponse.json({ error: 'Pengumuman ini bukan milik Anda.' }, { status: 403 })
    }

    const { error } = await supabase.from('pengumuman').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ message: `Pengumuman "${existing.judul}" berhasil dihapus.` })
  } catch (err) {
    console.error('Error DELETE pengumuman:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
