import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { adminCheck, getSupabaseAdmin } from '@/lib/supabase-server'

function denyResponse() {
  return NextResponse.json(
    { error: 'Tidak diizinkan. Hanya admin yang dapat mengakses data ini.' },
    { status: 403 }
  )
}

type MapelEmbed = { nama: string; kode: string }[] | { nama: string; kode: string } | null
type KelasEmbed =
  | { nama_kelas: string; tingkat: number; tahun_ajaran: string }[]
  | { nama_kelas: string; tingkat: number; tahun_ajaran: string }
  | null

type MengajarRow = {
  id: string
  mapel_id: string
  kelas_id: string
  materi: string | null
  mata_pelajaran: MapelEmbed
  kelas: KelasEmbed
}

// GET /api/admin/mengajar?guru_id=...  -> penugasan milik guru tsb
// GET /api/admin/mengajar              -> opsi mata pelajaran & kelas (untuk dropdown)
export async function GET(request: NextRequest) {
  try {
    const auth = await adminCheck()
    if (!auth.ok) {
      return denyResponse()
    }

    const supabaseAdmin = getSupabaseAdmin()
    const { searchParams } = new URL(request.url)
    const guruId = searchParams.get('guru_id')

    // Mode "options": untuk mengisi dropdown mapel & kelas di UI
    if (!guruId) {
      const [{ data: mapel, error: mapelError }, { data: kelas, error: kelasError }] = await Promise.all([
        supabaseAdmin
          .from('mata_pelajaran')
          .select('id, kode, nama')
          .eq('status', true)
          .order('nama', { ascending: true }),
        supabaseAdmin
          .from('kelas')
          .select('id, nama_kelas, tingkat, tahun_ajaran')
          .eq('status', true)
          .order('tingkat', { ascending: true })
          .order('nama_kelas', { ascending: true })
      ])

      if (mapelError || kelasError) {
        return NextResponse.json(
          { error: mapelError?.message || kelasError?.message },
          { status: 400 }
        )
      }

      return NextResponse.json({ mapel: mapel ?? [], kelas: kelas ?? [] })
    }

    // Mode "assignments": penugasan satu guru
    const { data, error } = await supabaseAdmin
      .from('guru_mengajar')
      .select('id, materi, mapel_id, kelas_id, mata_pelajaran(nama, kode), kelas(nama_kelas, tingkat, tahun_ajaran)')
      .eq('guru_id', guruId)
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const assignments = (data ?? []).map((r) => {
      const row = r as unknown as MengajarRow
      const mapel = Array.isArray(row.mata_pelajaran) ? row.mata_pelajaran[0] : row.mata_pelajaran
      const kelas = Array.isArray(row.kelas) ? row.kelas[0] : row.kelas
      return {
        id: row.id,
        mapel_id: row.mapel_id,
        mapel_nama: mapel?.nama ?? null,
        mapel_kode: mapel?.kode ?? null,
        kelas_id: row.kelas_id,
        kelas_nama: kelas?.nama_kelas ?? null,
        tingkat: kelas?.tingkat ?? null,
        tahun_ajaran: kelas?.tahun_ajaran ?? null,
        materi: row.materi ?? null
      }
    })

    return NextResponse.json({ assignments })
  } catch (err) {
    console.error('Error listing mengajar:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// POST /api/admin/mengajar
// Body: { guru_id, assignments: [{ mapel_id, kelas_id, materi }] }
// Menyimpan ulang (replace) seluruh penugasan guru tsb.
export async function POST(request: Request) {
  try {
    const auth = await adminCheck()
    if (!auth.ok) {
      return denyResponse()
    }

    const supabaseAdmin = getSupabaseAdmin()
    const body = await request.json()
    const { guru_id: guruId, assignments } = body

    if (!guruId) {
      return NextResponse.json({ error: 'ID guru wajib diisi' }, { status: 400 })
    }

    // Cek target adalah guru yang benar-benar ada
    const { data: guru, error: guruError } = await supabaseAdmin
      .from('profiles')
      .select('id, role')
      .eq('id', guruId)
      .maybeSingle()

    if (guruError) {
      return NextResponse.json({ error: guruError.message }, { status: 400 })
    }
    if (!guru) {
      return NextResponse.json({ error: 'Guru tidak ditemukan' }, { status: 404 })
    }
    if (guru.role !== 'guru') {
      return NextResponse.json({ error: 'Target bukan akun dengan role guru' }, { status: 400 })
    }

    if (!Array.isArray(assignments)) {
      return NextResponse.json({ error: 'Format assignments tidak valid' }, { status: 400 })
    }

    // Validasi tidak ada kelas dobel
    const kelasIds = assignments.map((a) => a?.kelas_id)
    const mapelIds = assignments.map((a) => a?.mapel_id)
    if (new Set(kelasIds).size !== kelasIds.length) {
      return NextResponse.json({ error: 'Ada kelas yang dipilih lebih dari satu kali' }, { status: 400 })
    }

    // Pastikan mapel & kelas yang dikirim benar-benar ada & aktif
    const validations = await Promise.all([
      mapelIds.length
        ? supabaseAdmin.from('mata_pelajaran').select('id').eq('status', true).in('id', mapelIds)
        : Promise.resolve({ data: [] as Array<{ id: string }> }),
      kelasIds.length
        ? supabaseAdmin.from('kelas').select('id').eq('status', true).in('id', kelasIds)
        : Promise.resolve({ data: [] as Array<{ id: string }> })
    ])

    if ((validations[0].data?.length ?? 0) !== new Set(mapelIds).size) {
      return NextResponse.json({ error: 'Ada mata pelajaran yang tidak valid' }, { status: 400 })
    }
    if ((validations[1].data?.length ?? 0) !== new Set(kelasIds).size) {
      return NextResponse.json({ error: 'Ada kelas yang tidak valid' }, { status: 400 })
    }

    // Simpan ulang: hapus penugasan lama lalu insert yang baru
    const { error: deleteError } = await supabaseAdmin
      .from('guru_mengajar')
      .delete()
      .eq('guru_id', guruId)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 400 })
    }

    if (assignments.length > 0) {
      const rows = assignments.map((a) => ({
        guru_id: guruId,
        mapel_id: a.mapel_id,
        kelas_id: a.kelas_id,
        materi: (a.materi || '').trim() === '' ? null : (a.materi || '').trim()
      }))

      const { error: insertError } = await supabaseAdmin.from('guru_mengajar').insert(rows)
      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 400 })
      }
    }

    return NextResponse.json({ message: 'Penugasan berhasil disimpan' }, { status: 200 })
  } catch (err) {
    console.error('Error saving mengajar:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
