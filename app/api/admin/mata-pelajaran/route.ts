import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { adminCheck, getSupabaseAdmin } from '@/lib/supabase-server'

function denyResponse() {
  return NextResponse.json(
    { error: 'Tidak diizinkan. Hanya admin yang dapat mengakses data ini.' },
    { status: 403 }
  )
}

// GET /api/admin/mata-pelajaran - List semua mata pelajaran
export async function GET(request: NextRequest) {
  try {
    const auth = await adminCheck()
    if (!auth.ok) {
      return denyResponse()
    }

    const supabaseAdmin = getSupabaseAdmin()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // 'active' | 'inactive' | undefined

    let query = supabaseAdmin
      .from('mata_pelajaran')
      .select('id, kode, nama, status, created_at')
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

    return NextResponse.json(data ?? [], { status: 200 })
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
    const { kode, nama } = body

    // Validasi input
    if (!kode || kode.trim() === '') {
      return NextResponse.json({ error: 'Kode mata pelajaran wajib diisi' }, { status: 400 })
    }

    if (!nama || nama.trim() === '') {
      return NextResponse.json({ error: 'Nama mata pelajaran wajib diisi' }, { status: 400 })
    }

    // Cek duplikat kode
    const { data: existing, error: checkError } = await supabaseAdmin
      .from('mata_pelajaran')
      .select('id')
      .eq('kode', kode.trim().toUpperCase())
      .maybeSingle()

    if (checkError) {
      return NextResponse.json({ error: checkError.message }, { status: 400 })
    }

    if (existing) {
      return NextResponse.json({ error: 'Kode mata pelajaran sudah digunakan' }, { status: 400 })
    }

    // Cek duplikat nama
    const { data: existingName, error: checkNameError } = await supabaseAdmin
      .from('mata_pelajaran')
      .select('id')
      .eq('nama', nama.trim())
      .maybeSingle()

    if (checkNameError) {
      return NextResponse.json({ error: checkNameError.message }, { status: 400 })
    }

    if (existingName) {
      return NextResponse.json({ error: 'Nama mata pelajaran sudah digunakan' }, { status: 400 })
    }

    // Insert data
    const { data: result, error: insertError } = await supabaseAdmin
      .from('mata_pelajaran')
      .insert({
        kode: kode.trim().toUpperCase(),
        nama: nama.trim(),
        status: true,
      })
      .select('id, kode, nama, status, created_at')
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
    const { id, kode, nama, status } = body

    if (!id) {
      return NextResponse.json({ error: 'ID mata pelajaran wajib diisi' }, { status: 400 })
    }

    const updates: { kode?: string; nama?: string; status?: boolean } = {}

    if (kode !== undefined && kode.trim() !== '') {
      // Cek duplikat kode (kecuali yang sedang diupdate)
      const { data: existing, error: checkError } = await supabaseAdmin
        .from('mata_pelajaran')
        .select('id')
        .eq('kode', kode.trim().toUpperCase())
        .neq('id', id)
        .maybeSingle()

      if (checkError) {
        return NextResponse.json({ error: checkError.message }, { status: 400 })
      }

      if (existing) {
        return NextResponse.json({ error: 'Kode mata pelajaran sudah digunakan' }, { status: 400 })
      }

      updates.kode = kode.trim().toUpperCase()
    }

    if (nama !== undefined && nama.trim() !== '') {
      // Cek duplikat nama (kecuali yang sedang diupdate)
      const { data: existingName, error: checkNameError } = await supabaseAdmin
        .from('mata_pelajaran')
        .select('id')
        .eq('nama', nama.trim())
        .neq('id', id)
        .maybeSingle()

      if (checkNameError) {
        return NextResponse.json({ error: checkNameError.message }, { status: 400 })
      }

      if (existingName) {
        return NextResponse.json({ error: 'Nama mata pelajaran sudah digunakan' }, { status: 400 })
      }

      updates.nama = nama.trim()
    }

    if (status !== undefined) {
      updates.status = status
    }

    const { data, error } = await supabaseAdmin
      .from('mata_pelajaran')
      .update(updates)
      .eq('id', id)
      .select('id, kode, nama, status, created_at')
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

// DELETE /api/admin/mata-pelajaran - Hapus mata pelajaran
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

    // Cek apakah sedang dipakai di guru_mengajar
    const { data: usedIn, error: checkError } = await supabaseAdmin
      .from('guru_mengajar')
      .select('id')
      .eq('mapel_id', id)
      .maybeSingle()

    if (checkError) {
      return NextResponse.json({ error: checkError.message }, { status: 400 })
    }

    if (usedIn) {
      return NextResponse.json(
        { error: 'Mata pelajaran sedang digunakan di penugasan guru. Hapus penugasan terlebih dahulu.' },
        { status: 400 }
      )
    }

    // Hapus data
    const { error } = await supabaseAdmin
      .from('mata_pelajaran')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ message: 'Mata pelajaran berhasil dihapus' }, { status: 200 })
  } catch (err) {
    console.error('Error deleting mata pelajaran:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
