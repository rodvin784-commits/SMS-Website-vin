import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { adminCheck, getSupabaseAdmin } from '@/lib/supabase-server'

function denyResponse() {
  return NextResponse.json(
    { error: 'Tidak diizinkan. Hanya admin yang dapat mengakses data ini.' },
    { status: 403 }
  )
}

const SELECT_FIELDS = 'id, kode, nama, deskripsi, status, created_at, updated_at'

// GET /api/admin/mata-pelajaran - List semua mata pelajaran dengan guru pengampu
export async function GET(request: NextRequest) {
  try {
    const auth = await adminCheck()
    if (!auth.ok) {
      return denyResponse()
    }

    const supabaseAdmin = getSupabaseAdmin()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    // Single query dengan join guru_mengajar → profiles
    let query = supabaseAdmin
      .from('mata_pelajaran')
      .select(`
        ${SELECT_FIELDS},
        guru_mengajar:guru_mengajar(
          guru_id,
          kelas_id,
          materi,
          profiles(nama_lengkap),
          kelas(nama_kelas, tingkat)
        )
      `)
      .order('nama', { ascending: true })

    if (status === 'active') {
      query = query.eq('status', true)
    } else if (status === 'inactive') {
      query = query.eq('status', false)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Format: dedupe guru per mapel, sertakan info kelas
    const pickOne = (v: unknown) => (Array.isArray(v) ? v[0] : v)

    const result = (data ?? []).map((m) => {
      const rawAssignments = Array.isArray(m.guru_mengajar) ? m.guru_mengajar : []

      // Dedupe guru: kumpulkan nama unik + daftar kelas per guru
      const guruMap = new Map<string, { nama: string; kelas: string[] }>()
      for (const a of rawAssignments) {
        // PostgREST returns a single object for to-one relations, array for to-many
        const profile = pickOne(a.profiles)
        const kelasRow = pickOne(a.kelas)
        const guruId = a.guru_id as string
        const kelasNama = kelasRow?.nama_kelas ?? null
        const existing = guruMap.get(guruId)
        if (existing) {
          if (kelasNama && !existing.kelas.includes(kelasNama)) {
            existing.kelas.push(kelasNama)
          }
        } else {
          guruMap.set(guruId, {
            nama: profile?.nama_lengkap ?? 'Tanpa Nama',
            kelas: kelasNama ? [kelasNama] : [],
          })
        }
      }

      // Daftar semua kelas unik
      const kelasSet = new Set<string>()
      for (const a of rawAssignments) {
        const kelasRow = pickOne(a.kelas)
        if (kelasRow?.nama_kelas) kelasSet.add(kelasRow.nama_kelas)
      }

      return {
        id: m.id,
        kode: m.kode,
        nama: m.nama,
        deskripsi: m.deskripsi,
        status: m.status,
        created_at: m.created_at,
        updated_at: m.updated_at,
        guru_pengampu: Array.from(guruMap.entries()).map(([guru_id, info]) => ({
          guru_id,
          nama_lengkap: info.nama,
          kelas: info.kelas,
        })),
        kelas_list: Array.from(kelasSet),
      }
    })

    return NextResponse.json(result, { status: 200 })
  } catch (err) {
    console.error('Error listing mata pelajaran:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// POST /api/admin/mata-pelajaran - Buat mata pelajaran baru
export async function POST(request: Request) {
  try {
    const auth = await adminCheck()
    if (!auth.ok) {
      return denyResponse()
    }

    const supabaseAdmin = getSupabaseAdmin()
    const body = await request.json()
    const { kode, nama, deskripsi } = body

    if (!kode || typeof kode !== 'string' || kode.trim() === '') {
      return NextResponse.json({ error: 'Kode mata pelajaran wajib diisi' }, { status: 400 })
    }

    if (!nama || typeof nama !== 'string' || nama.trim() === '') {
      return NextResponse.json({ error: 'Nama mata pelajaran wajib diisi' }, { status: 400 })
    }

    const kodeClean = kode.trim().toUpperCase()
    const namaClean = nama.trim()

    if (kodeClean.length > 20) {
      return NextResponse.json({ error: 'Kode maksimal 20 karakter' }, { status: 400 })
    }

    if (namaClean.length > 100) {
      return NextResponse.json({ error: 'Nama maksimal 100 karakter' }, { status: 400 })
    }

    // Cek duplikat kode
    const { data: existingKode } = await supabaseAdmin
      .from('mata_pelajaran')
      .select('id')
      .eq('kode', kodeClean)
      .maybeSingle()

    if (existingKode) {
      return NextResponse.json({ error: 'Kode mata pelajaran sudah digunakan' }, { status: 400 })
    }

    // Cek duplikat nama (case-insensitive agar tidak dobel)
    const { data: existingNama } = await supabaseAdmin
      .from('mata_pelajaran')
      .select('id')
      .ilike('nama', namaClean)
      .maybeSingle()

    if (existingNama) {
      return NextResponse.json({ error: 'Nama mata pelajaran sudah digunakan' }, { status: 400 })
    }

    const { data: result, error: insertError } = await supabaseAdmin
      .from('mata_pelajaran')
      .insert({
        kode: kodeClean,
        nama: namaClean,
        deskripsi: deskripsi?.trim() || null,
        status: true,
      })
      .select(SELECT_FIELDS)
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 })
    }

    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    console.error('Error creating mata pelajaran:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// PUT /api/admin/mata-pelajaran - Update mata pelajaran
export async function PUT(request: Request) {
  try {
    const auth = await adminCheck()
    if (!auth.ok) {
      return denyResponse()
    }

    const supabaseAdmin = getSupabaseAdmin()
    const body = await request.json()
    const { id, kode, nama, deskripsi, status } = body

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'ID mata pelajaran wajib diisi' }, { status: 400 })
    }

    const updates: { kode?: string; nama?: string; deskripsi?: string | null; status?: boolean } = {}

    if (kode !== undefined && typeof kode === 'string' && kode.trim() !== '') {
      const kodeClean = kode.trim().toUpperCase()
      if (kodeClean.length > 20) {
        return NextResponse.json({ error: 'Kode maksimal 20 karakter' }, { status: 400 })
      }

      const { data: existing } = await supabaseAdmin
        .from('mata_pelajaran')
        .select('id')
        .eq('kode', kodeClean)
        .neq('id', id)
        .maybeSingle()

      if (existing) {
        return NextResponse.json({ error: 'Kode mata pelajaran sudah digunakan' }, { status: 400 })
      }

      updates.kode = kodeClean
    }

    if (nama !== undefined && typeof nama === 'string' && nama.trim() !== '') {
      const namaClean = nama.trim()
      if (namaClean.length > 100) {
        return NextResponse.json({ error: 'Nama maksimal 100 karakter' }, { status: 400 })
      }

      const { data: existing } = await supabaseAdmin
        .from('mata_pelajaran')
        .select('id')
        .ilike('nama', namaClean)
        .neq('id', id)
        .maybeSingle()

      if (existing) {
        return NextResponse.json({ error: 'Nama mata pelajaran sudah digunakan' }, { status: 400 })
      }

      updates.nama = namaClean
    }

    if (status !== undefined) {
      updates.status = Boolean(status)
    }

    if (deskripsi !== undefined) {
      updates.deskripsi = typeof deskripsi === 'string' && deskripsi.trim() !== '' ? deskripsi.trim() : null
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Tidak ada data yang diperbarui' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('mata_pelajaran')
      .update(updates)
      .eq('id', id)
      .select(SELECT_FIELDS)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(data, { status: 200 })
  } catch (err) {
    console.error('Error updating mata pelajaran:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/mata-pelajaran - Nonaktifkan mata pelajaran (soft delete)
export async function DELETE(request: Request) {
  try {
    const auth = await adminCheck()
    if (!auth.ok) {
      return denyResponse()
    }

    const supabaseAdmin = getSupabaseAdmin()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID mata pelajaran wajib diisi' }, { status: 400 })
    }

    // Cek apakah mata pelajaran ada
    const { data: mapel } = await supabaseAdmin
      .from('mata_pelajaran')
      .select('id, nama, status')
      .eq('id', id)
      .maybeSingle()

    if (!mapel) {
      return NextResponse.json({ error: 'Mata pelajaran tidak ditemukan' }, { status: 404 })
    }

    // Soft delete: nonaktifkan saja
    if (mapel.status === true) {
      const { error } = await supabaseAdmin
        .from('mata_pelajaran')
        .update({ status: false })
        .eq('id', id)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }

      return NextResponse.json({
        message: `Mata pelajaran "${mapel.nama}" berhasil dinonaktifkan`,
        action: 'deactivated',
      }, { status: 200 })
    }

    // Sudah nonaktif, hard delete hanya jika TIDAK ada di guru_mengajar
    const { data: usedIn } = await supabaseAdmin
      .from('guru_mengajar')
      .select('id')
      .eq('mapel_id', id)
      .maybeSingle()

    if (usedIn) {
      return NextResponse.json(
        { error: 'Mata pelajaran sudah nonaktif dan masih memiliki penugasan guru. Hapus penugasan terlebih dahulu jika ingin menghapus permanen.' },
        { status: 400 }
      )
    }

    const { error } = await supabaseAdmin
      .from('mata_pelajaran')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({
      message: `Mata pelajaran "${mapel.nama}" berhasil dihapus permanen`,
      action: 'deleted',
    }, { status: 200 })
  } catch (err) {
    console.error('Error deleting mata pelajaran:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
