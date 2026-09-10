import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { adminCheck, getSupabaseAdmin } from '@/lib/supabase-server'
import { denyResponse, serverError } from '@/lib/api-admin'

// GET /api/admin/jurusan - List semua jurusan
export async function GET(request: NextRequest) {
  try {
    const auth = await adminCheck()
    if (!auth.ok) {
      return denyResponse()
    }

    const supabaseAdmin = getSupabaseAdmin()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    let query = supabaseAdmin
      .from('jurusan')
      .select('id, nama_jurusan, kode, status, created_at, kelas(id)')
      .order('nama_jurusan', { ascending: true })

    if (status === 'active') {
      query = query.eq('status', true)
    } else if (status === 'inactive') {
      query = query.eq('status', false)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Sertakan jumlah kelas yang terhubung ke jurusan (semua status)
    const result = ((data ?? []) as Array<{ id: string; nama_jurusan: string; kode: string; status: boolean; created_at: string; kelas: Array<{ id: string }> | null }>).map(
      (j) => ({
        id: j.id,
        nama_jurusan: j.nama_jurusan,
        kode: j.kode,
        status: j.status,
        created_at: j.created_at,
        jumlah_kelas: Array.isArray(j.kelas) ? j.kelas.length : 0,
      })
    )

    return NextResponse.json(result, { status: 200 })
  } catch (err) {
    return serverError(err, 'Error listing jurusan:')
  }
}

// POST /api/admin/jurusan - Buat jurusan baru
export async function POST(request: Request) {
  try {
    const auth = await adminCheck()
    if (!auth.ok) {
      return denyResponse()
    }

    const supabaseAdmin = getSupabaseAdmin()
    const body = await request.json()
    const { nama_jurusan, kode } = body

    // Validasi input
    if (!nama_jurusan || nama_jurusan.trim() === '') {
      return NextResponse.json({ error: 'Nama jurusan wajib diisi' }, { status: 400 })
    }

    if (!kode || kode.trim() === '') {
      return NextResponse.json({ error: 'Kode jurusan wajib diisi' }, { status: 400 })
    }

    // Cek duplikat kode
    const { data: existing, error: checkError } = await supabaseAdmin
      .from('jurusan')
      .select('id')
      .eq('kode', kode.trim().toUpperCase())
      .maybeSingle()

    if (checkError) {
      return NextResponse.json({ error: checkError.message }, { status: 400 })
    }

    if (existing) {
      return NextResponse.json({ error: 'Kode jurusan sudah digunakan' }, { status: 400 })
    }

    // Cek duplikat nama
    const { data: existingName, error: checkNameError } = await supabaseAdmin
      .from('jurusan')
      .select('id')
      .eq('nama_jurusan', nama_jurusan.trim())
      .maybeSingle()

    if (checkNameError) {
      return NextResponse.json({ error: checkNameError.message }, { status: 400 })
    }

    if (existingName) {
      return NextResponse.json({ error: 'Nama jurusan sudah digunakan' }, { status: 400 })
    }

    // Insert data
    const { data: result, error: insertError } = await supabaseAdmin
      .from('jurusan')
      .insert({
        kode: kode.trim().toUpperCase(),
        nama_jurusan: nama_jurusan.trim(),
        status: true,
      })
      .select('id, kode, nama_jurusan, status, created_at')
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 })
    }

    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    return serverError(err, 'Error creating jurusan:')
  }
}

// PUT /api/admin/jurusan - Update jurusan
export async function PUT(request: Request) {
  try {
    const auth = await adminCheck()
    if (!auth.ok) {
      return denyResponse()
    }

    const supabaseAdmin = getSupabaseAdmin()
    const body = await request.json()
    const { id, nama_jurusan, kode, status } = body

    if (!id) {
      return NextResponse.json({ error: 'ID jurusan wajib diisi' }, { status: 400 })
    }

    const updates: { kode?: string; nama_jurusan?: string; status?: boolean } = {}

    if (kode !== undefined && kode.trim() !== '') {
      const { data: existing, error: checkError } = await supabaseAdmin
        .from('jurusan')
        .select('id')
        .eq('kode', kode.trim().toUpperCase())
        .neq('id', id)
        .maybeSingle()

      if (checkError) {
        return NextResponse.json({ error: checkError.message }, { status: 400 })
      }

      if (existing) {
        return NextResponse.json({ error: 'Kode jurusan sudah digunakan' }, { status: 400 })
      }

      updates.kode = kode.trim().toUpperCase()
    }

    if (nama_jurusan !== undefined && nama_jurusan.trim() !== '') {
      const { data: existingName, error: checkNameError } = await supabaseAdmin
        .from('jurusan')
        .select('id')
        .eq('nama_jurusan', nama_jurusan.trim())
        .neq('id', id)
        .maybeSingle()

      if (checkNameError) {
        return NextResponse.json({ error: checkNameError.message }, { status: 400 })
      }

      if (existingName) {
        return NextResponse.json({ error: 'Nama jurusan sudah digunakan' }, { status: 400 })
      }

      updates.nama_jurusan = nama_jurusan.trim()
    }

    if (status !== undefined) {
      updates.status = status
    }

    const { data, error } = await supabaseAdmin
      .from('jurusan')
      .update(updates)
      .eq('id', id)
      .select('id, kode, nama_jurusan, status, created_at')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(data, { status: 200 })
  } catch (err) {
    return serverError(err, 'Error updating jurusan:')
  }
}

// DELETE /api/admin/jurusan - Hapus jurusan
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
      return NextResponse.json({ error: 'ID jurusan wajib diisi' }, { status: 400 })
    }

    // Cek apakah sedang dipakai di kelas
    const { data: usedIn, error: checkError } = await supabaseAdmin
      .from('kelas')
      .select('id')
      .eq('jurusan_id', id)
      .maybeSingle()

    if (checkError) {
      return NextResponse.json({ error: checkError.message }, { status: 400 })
    }

    if (usedIn) {
      return NextResponse.json(
        { error: 'Jurusan sedang digunakan di kelas. Hapus kelas terlebih dahulu.' },
        { status: 400 }
      )
    }

    // Hapus data
    const { error } = await supabaseAdmin
      .from('jurusan')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ message: 'Jurusan berhasil dihapus' }, { status: 200 })
  } catch (err) {
    return serverError(err, 'Error deleting jurusan:')
  }
}
