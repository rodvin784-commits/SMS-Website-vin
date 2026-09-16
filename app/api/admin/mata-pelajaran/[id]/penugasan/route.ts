import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { adminCheck, getSupabaseAdmin } from '@/lib/supabase-server'
import { denyResponse, serverError } from '@/lib/api-admin'

const pickOne = <T,>(v: T[] | T | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null)

// GET /api/admin/mata-pelajaran/[id]/penugasan
// Returns current guru_kelas assignments for this subject + available guru & kelas options.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await adminCheck()
    if (!auth.ok) return denyResponse()

    const { id: mapelId } = await params
    const supabaseAdmin = getSupabaseAdmin()

    // 1. Current assignments for this subject (dari guru_kelas)
    const { data: assignments, error: assignError } = await supabaseAdmin
      .from('guru_kelas')
      .select(`
        id,
        guru_id,
        kelas_id,
        tahun_ajaran,
        guru(nama_lengkap, nip),
        kelas(nama_kelas, tingkat, tahun_ajaran)
      `)
      .eq('mata_pelajaran_id', mapelId)
      .order('created_at', { ascending: true })

    if (assignError) {
      return NextResponse.json({ error: assignError.message }, { status: 400 })
    }

    const formatted = ((assignments ?? []) as Array<{
      id: string
      guru_id: string
      kelas_id: string
      tahun_ajaran: string | null
      guru: { nama_lengkap: string | null; nip: string | null } | { nama_lengkap: string | null; nip: string | null }[] | null
      kelas:
        | { nama_kelas: string; tingkat: number; tahun_ajaran: string }
        | { nama_kelas: string; tingkat: number; tahun_ajaran: string }[]
        | null
    }>).map((r) => {
      const guru = pickOne(r.guru)
      const kelasRow = pickOne(r.kelas)
      return {
        id: r.id,
        guru_id: r.guru_id,
        guru_nama: guru?.nama_lengkap ?? 'Tanpa Nama',
        kelas_id: r.kelas_id,
        kelas_nama: kelasRow?.nama_kelas ?? '-',
        tingkat: kelasRow?.tingkat ?? null,
        tahun_ajaran: r.tahun_ajaran ?? kelasRow?.tahun_ajaran ?? null,
      }
    })

    // 2. Available guru options (dari tabel guru, profile aktif role=guru)
    const { data: guruRows, error: guruError } = await supabaseAdmin
      .from('guru')
      .select('id, profile_id, nip, nama_lengkap')
      .order('nama_lengkap', { ascending: true })

    if (guruError) {
      return NextResponse.json({ error: guruError.message }, { status: 400 })
    }

    const assignedGuruIds = formatted.map((a) => a.guru_id)

    // Filter guru yang profilenya role=guru & aktif
    let guruList: { id: string; nama_lengkap: string }[] = []
    if ((guruRows ?? []).length > 0) {
      const guruProfiles = await supabaseAdmin
        .from('profiles')
        .select('id, nama_lengkap, role, status')
        .in('id', (guruRows ?? []).map((g) => g.profile_id))
      const activeProfiles = new Set(
        (guruProfiles.data ?? [])
          .filter((p) => p.role === 'guru' && p.status !== false)
          .map((p) => p.id)
      )
      guruList = (guruRows ?? [])
        .filter((g) => activeProfiles.has(g.profile_id))
        .map((g) => ({
          id: g.id,
          nama_lengkap: g.nama_lengkap ?? 'Tanpa Nama',
        }))
        .sort((a, b) => a.nama_lengkap.localeCompare(b.nama_lengkap))
    }

    // 3. Available kelas options (status=true)
    const { data: allKelas, error: kelasError } = await supabaseAdmin
      .from('kelas')
      .select('id, nama_kelas, tingkat')
      .eq('status', true)
      .order('tingkat', { ascending: true })
      .order('nama_kelas', { ascending: true })

    if (kelasError) {
      return NextResponse.json({ error: kelasError.message }, { status: 400 })
    }

    // 4. Referensi tahun ajaran (dari data kelas yang ada)
    const { data: tahunRows } = await supabaseAdmin
      .from('kelas')
      .select('tahun_ajaran')
      .not('tahun_ajaran', 'is', null)
      .order('tahun_ajaran', { ascending: false })
    const tahunAjaranOptions = Array.from(
      new Set<string>((tahunRows ?? []).map((t) => t.tahun_ajaran as string).filter(Boolean))
    )

    return NextResponse.json({
      assignments: formatted,
      guru: guruList.map((g) => ({
        ...g,
        alreadyAssigned: assignedGuruIds.includes(g.id),
      })),
      kelas: allKelas ?? [],
      tahunAjaranOptions,
    }, { status: 200 })
  } catch (err) {
    return serverError(err, 'Error fetching penugasan:')
  }
}

// POST /api/admin/mata-pelajaran/[id]/penugasan
// Body: { guru_id (dari tabel guru), kelas_id, tahun_ajaran? }
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await adminCheck()
    if (!auth.ok) return denyResponse()

    const { id: mapelId } = await params
    const supabaseAdmin = getSupabaseAdmin()
    const body = await request.json()
    const { guru_id, kelas_id, tahun_ajaran } = body

    if (!guru_id) {
      return NextResponse.json({ error: 'ID guru wajib diisi' }, { status: 400 })
    }

    if (!kelas_id) {
      return NextResponse.json({ error: 'ID kelas wajib diisi' }, { status: 400 })
    }

    // Validate guru exists in tabel guru + profile aktif
    const { data: guru } = await supabaseAdmin
      .from('guru')
      .select('id, profile_id')
      .eq('id', guru_id)
      .maybeSingle()

    if (!guru) {
      return NextResponse.json({ error: 'Guru tidak ditemukan' }, { status: 400 })
    }

    const { data: guruProfile } = await supabaseAdmin
      .from('profiles')
      .select('role, status')
      .eq('id', guru.profile_id)
      .maybeSingle()

    if (!guruProfile || guruProfile.role !== 'guru' || guruProfile.status === false) {
      return NextResponse.json({ error: 'Guru tidak aktif atau bukan guru' }, { status: 400 })
    }

    // Validate kelas exists and is active
    const { data: kelas } = await supabaseAdmin
      .from('kelas')
      .select('id')
      .eq('id', kelas_id)
      .eq('status', true)
      .maybeSingle()

    if (!kelas) {
      return NextResponse.json({ error: 'Kelas tidak ditemukan atau tidak aktif' }, { status: 400 })
    }

    // Validate mata pelajaran exists and is active
    const { data: mapel } = await supabaseAdmin
      .from('mata_pelajaran')
      .select('id, nama')
      .eq('id', mapelId)
      .eq('status', true)
      .maybeSingle()

    if (!mapel) {
      return NextResponse.json({ error: 'Mata pelajaran tidak ditemukan atau tidak aktif' }, { status: 400 })
    }

    // Check duplicate: same guru + same mapel + same kelas
    const { data: existing } = await supabaseAdmin
      .from('guru_kelas')
      .select('id')
      .eq('guru_id', guru_id)
      .eq('mata_pelajaran_id', mapelId)
      .eq('kelas_id', kelas_id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: `Penugasan sudah ada untuk guru ini di "${mapel.nama}" kelas tersebut` },
        { status: 400 }
      )
    }

    // Insert ke guru_kelas
    const { data: result, error: insertError } = await supabaseAdmin
      .from('guru_kelas')
      .insert({
        guru_id,
        mata_pelajaran_id: mapelId,
        kelas_id,
        tahun_ajaran: tahun_ajaran ? String(tahun_ajaran).trim() : null,
      })
      .select('id, guru_id, kelas_id, tahun_ajaran')
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 })
    }

    // Sinkronkan guru_mata_pelajaran (relasi guru-mapel) tanpa batas kelas
    const { data: existingGmp } = await supabaseAdmin
      .from('guru_mata_pelajaran')
      .select('id')
      .eq('guru_id', guru_id)
      .eq('mata_pelajaran_id', mapelId)
      .maybeSingle()

    if (!existingGmp) {
      await supabaseAdmin.from('guru_mata_pelajaran').insert({
        guru_id,
        mata_pelajaran_id: mapelId,
      })
    }

    return NextResponse.json({
      message: `Penugasan berhasil ditambahkan ke "${mapel.nama}"`,
      assignment: result,
    }, { status: 201 })
  } catch (err) {
    return serverError(err, 'Error creating penugasan:')
  }
}

// PUT /api/admin/mata-pelajaran/[id]/penugasan
// Body: { id, tahun_ajaran? }
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await adminCheck()
    if (!auth.ok) return denyResponse()

    const { id: mapelId } = await params
    const supabaseAdmin = getSupabaseAdmin()
    const body = await request.json()
    const { id: assignmentId, tahun_ajaran } = body

    if (!assignmentId) {
      return NextResponse.json({ error: 'ID penugasan wajib diisi' }, { status: 400 })
    }

    // Verify assignment belongs to this subject
    const { data: assignment } = await supabaseAdmin
      .from('guru_kelas')
      .select('id, mata_pelajaran_id')
      .eq('id', assignmentId)
      .eq('mata_pelajaran_id', mapelId)
      .maybeSingle()

    if (!assignment) {
      return NextResponse.json(
        { error: 'Penugasan tidak ditemukan atau bukan milik mata pelajaran ini' },
        { status: 404 }
      )
    }

    const updates: { tahun_ajaran?: string | null } = {}
    if (tahun_ajaran !== undefined) {
      updates.tahun_ajaran = typeof tahun_ajaran === 'string' && tahun_ajaran.trim() !== ''
        ? tahun_ajaran.trim()
        : null
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Tidak ada data yang diperbarui' }, { status: 400 })
    }

    const { data: result, error } = await supabaseAdmin
      .from('guru_kelas')
      .update(updates)
      .eq('id', assignmentId)
      .select('id, guru_id, kelas_id, tahun_ajaran')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({
      message: 'Pembaruan berhasil disimpan',
      assignment: result,
    }, { status: 200 })
  } catch (err) {
    return serverError(err, 'Error updating penugasan:')
  }
}

// DELETE /api/admin/mata-pelajaran/[id]/penugasan?id=<assignment_id>
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await adminCheck()
    if (!auth.ok) return denyResponse()

    const { id: mapelId } = await params
    const supabaseAdmin = getSupabaseAdmin()
    const { searchParams } = new URL(request.url)
    const assignmentId = searchParams.get('id')

    if (!assignmentId) {
      return NextResponse.json({ error: 'ID penugasan wajib diisi' }, { status: 400 })
    }

    // Verify assignment belongs to this subject
    const { data: assignment } = await supabaseAdmin
      .from('guru_kelas')
      .select('id, guru_id, mata_pelajaran_id')
      .eq('id', assignmentId)
      .eq('mata_pelajaran_id', mapelId)
      .maybeSingle()

    if (!assignment) {
      return NextResponse.json(
        { error: 'Penugasan tidak ditemukan atau bukan milik mata pelajaran ini' },
        { status: 404 }
      )
    }

    const { error } = await supabaseAdmin
      .from('guru_kelas')
      .delete()
      .eq('id', assignmentId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Bersihkan guru_mata_pelajaran jika guru tidak lagi mengajar mapel ini di kelas manapun
    const { data: sisa } = await supabaseAdmin
      .from('guru_kelas')
      .select('id')
      .eq('guru_id', assignment.guru_id)
      .eq('mata_pelajaran_id', mapelId)
      .limit(1)

    if (!sisa || sisa.length === 0) {
      await supabaseAdmin
        .from('guru_mata_pelajaran')
        .delete()
        .eq('guru_id', assignment.guru_id)
        .eq('mata_pelajaran_id', mapelId)
    }

    return NextResponse.json({ message: 'Penugasan berhasil dihapus' }, { status: 200 })
  } catch (err) {
    return serverError(err, 'Error deleting penugasan:')
  }
}