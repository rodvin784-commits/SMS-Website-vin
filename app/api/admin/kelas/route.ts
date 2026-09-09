import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { adminCheck, getSupabaseAdmin } from '@/lib/supabase-server'

function denyResponse() {
  return NextResponse.json(
    { error: 'Tidak diizinkan. Hanya admin yang dapat mengakses data ini.' },
    { status: 403 }
  )
}

// GET /api/admin/kelas - List semua kelas
export async function GET(request: NextRequest) {
  try {
    const auth = await adminCheck()
    if (!auth.ok) {
      return denyResponse()
    }

    const supabaseAdmin = getSupabaseAdmin()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const tingkat = searchParams.get('tingkat')
    const jurusanId = searchParams.get('jurusan_id')

    let query = supabaseAdmin
      .from('kelas')
      .select(`
        id,
        nama_kelas,
        tingkat,
        tahun_ajaran,
        jurusan_id,
        jurusan:kurusan(id, kode, nama_jurusan),
        status,
        created_at
      `)
      .order('tingkat', { ascending: true })
      .order('nama_kelas', { ascending: true })

    if (status === 'active') {
      query = query.eq('status', true)
    } else if (status === 'inactive') {
      query = query.eq('status', false)
    }

    if (tingkat) {
      const tingkatNum = parseInt(tingkat, 10)
      if (!isNaN(tingkatNum)) {
        query = query.eq('tingkat', tingkatNum)
      }
    }

    if (jurusanId) {
      query = query.eq('jurusan_id', jurusanId)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Format data dengan jurusan nested
    const formattedData = (data ?? []).map((k: any) => ({
      id: k.id,
      nama_kelas: k.nama_kelas,
      tingkat: k.tingkat,
      tahun_ajaran: k.tahun_ajaran,
      jurusan_id: k.jurusan_id,
      jurusan: k.jurusan ? {
        id: k.jurusan.id,
        kode: k.jurusan.kode,
        nama_jurusan: k.jurusan.nama_jurusan,
      } : null,
      status: k.status,
      created_at: k.created_at,
    }))

    return NextResponse.json(formattedData, { status: 200 })
  } catch (err) {
    console.error('Error listing kelas:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// POST /api/admin/kelas - Buat kelas baru
export async function POST(request: Request) {
  try {
    const auth = await adminCheck()
    if (!auth.ok) {
      return denyResponse()
    }

    const supabaseAdmin = getSupabaseAdmin()
    const body = await request.json()
    const { nama_kelas, tingkat, tahun_ajaran, jurusan_id } = body

    // Validasi input
    if (!nama_kelas || nama_kelas.trim() === '') {
      return NextResponse.json({ error: 'Nama kelas wajib diisi' }, { status: 400 })
    }

    if (!tingkat || isNaN(tingkat) || tingkat < 1 || tingkat > 12) {
      return NextResponse.json({ error: 'Tingkat kelas wajib diisi (1-12)' }, { status: 400 })
    }

    if (!tahun_ajaran || tahun_ajaran.trim() === '') {
      return NextResponse.json({ error: 'Tahun ajaran wajib diisi' }, { status: 400 })
    }

    // Cek jurusan_id ada (jika dikirim)
    if (jurusan_id) {
      const { data: jurusan, error: jurusanError } = await supabaseAdmin
        .from('jurusan')
        .select('id')
        .eq('id', jurusan_id)
        .eq('status', true)
        .maybeSingle()

      if (jurusanError) {
        return NextResponse.json({ error: jurusanError.message }, { status: 400 })
      }

      if (!jurusan) {
        return NextResponse.json({ error: 'Jurusan tidak ditemukan atau tidak aktif' }, { status: 400 })
      }
    }

    // Cek kombinasi duplikat (nama_kelas + tingkat + tahun_ajaran + jurusan_id)
    const { data: existing, error: checkError } = await supabaseAdmin
      .from('kelas')
      .select('id')
      .eq('nama_kelas', nama_kelas.trim())
      .eq('tingkat', parseInt(tingkat, 10))
      .eq('tahun_ajaran', tahun_ajaran.trim())
      .eq('jurusan_id', jurusan_id || null)
      .maybeSingle()

    if (checkError) {
      return NextResponse.json({ error: checkError.message }, { status: 400 })
    }

    if (existing) {
      return NextResponse.json({ error: 'Kombinasi kelas sudah digunakan' }, { status: 400 })
    }

    // Insert data
    const { data: result, error: insertError } = await supabaseAdmin
      .from('kelas')
      .insert({
        nama_kelas: nama_kelas.trim(),
        tingkat: parseInt(tingkat, 10),
        tahun_ajaran: tahun_ajaran.trim(),
        jurusan_id: jurusan_id || null,
        status: true,
      })
      .select('id, nama_kelas, tingkat, tahun_ajaran, jurusan_id, status, created_at')
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 })
    }

    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    console.error('Error creating kelas:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// PUT /api/admin/kelas - Update kelas
export async function PUT(request: Request) {
  try {
    const auth = await adminCheck()
    if (!auth.ok) {
      return denyResponse()
    }

    const supabaseAdmin = getSupabaseAdmin()
    const body = await request.json()
    const { id, nama_kelas, tingkat, tahun_ajaran, jurusan_id, status } = body

    if (!id) {
      return NextResponse.json({ error: 'ID kelas wajib diisi' }, { status: 400 })
    }

    const updates: { nama_kelas?: string; tingkat?: number; tahun_ajaran?: string; jurusan_id?: string | null; status?: boolean } = {}

    if (nama_kelas !== undefined && nama_kelas.trim() !== '') {
      // Cek duplikat (kecuali yang sedang diupdate)
      const { data: existing, error: checkError } = await supabaseAdmin
        .from('kelas')
        .select('id')
        .eq('nama_kelas', nama_kelas.trim())
        .eq('tingkat', tingkat ?? 0)
        .eq('tahun_ajaran', tahun_ajaran ?? '')
        .eq('jurusan_id', jurusan_id ?? null)
        .neq('id', id)
        .maybeSingle()

      if (checkError) {
        return NextResponse.json({ error: checkError.message }, { status: 400 })
      }

      if (existing) {
        return NextResponse.json({ error: 'Kombinasi kelas sudah digunakan' }, { status: 400 })
      }

      updates.nama_kelas = nama_kelas.trim()
    }

    if (tingkat !== undefined && !isNaN(tingkat) && tingkat >= 1 && tingkat <= 12) {
      updates.tingkat = parseInt(tingkat, 10)
    }

    if (tahun_ajaran !== undefined && tahun_ajaran.trim() !== '') {
      updates.tahun_ajaran = tahun_ajaran.trim()
    }

    if (jurusan_id !== undefined) {
      // Cek jurusan_id ada (jika dikirim dan bukan null)
      if (jurusan_id) {
        const { data: jurusan, error: jurusanError } = await supabaseAdmin
          .from('jurusan')
          .select('id')
          .eq('id', jurusan_id)
          .eq('status', true)
          .maybeSingle()

        if (jurusanError) {
          return NextResponse.json({ error: jurusanError.message }, { status: 400 })
        }

        if (!jurusan) {
          return NextResponse.json({ error: 'Jurusan tidak ditemukan atau tidak aktif' }, { status: 400 })
        }
      }

      updates.jurusan_id = jurusan_id || null
    }

    if (status !== undefined) {
      updates.status = status
    }

    const { data, error } = await supabaseAdmin
      .from('kelas')
      .update(updates)
      .eq('id', id)
      .select('id, nama_kelas, tingkat, tahun_ajaran, jurusan_id, status, created_at')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(data, { status: 200 })
  } catch (err) {
    console.error('Error updating kelas:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/kelas - Hapus kelas
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
      return NextResponse.json({ error: 'ID kelas wajib diisi' }, { status: 400 })
    }

    // Cek apakah sedang dipakai di guru_mengajar
    const { data: usedIn, error: checkError } = await supabaseAdmin
      .from('guru_mengajar')
      .select('id')
      .eq('kelas_id', id)
      .maybeSingle()

    if (checkError) {
      return NextResponse.json({ error: checkError.message }, { status: 400 })
    }

    if (usedIn) {
      return NextResponse.json(
        { error: 'Kelas sedang digunakan di penugasan guru. Hapus penugasan terlebih dahulu.' },
        { status: 400 }
      )
    }

    // Hapus data
    const { error } = await supabaseAdmin
      .from('kelas')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ message: 'Kelas berhasil dihapus' }, { status: 200 })
  } catch (err) {
    console.error('Error deleting kelas:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
