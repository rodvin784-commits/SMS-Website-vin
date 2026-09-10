import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { adminCheck, getSupabaseAdmin } from '@/lib/supabase-server'

function denyResponse() {
  return NextResponse.json(
    { error: 'Tidak diizinkan. Hanya admin yang dapat mengakses data ini.' },
    { status: 403 }
  )
}

const SEMESTER_OPTIONS = ['ganjil', 'genap'] as const
type Semester = (typeof SEMESTER_OPTIONS)[number]

function normalizeSemester(value: unknown): Semester {
  if (typeof value === 'string' && value.trim().length > 0) {
    const v = value.trim().toLowerCase()
    if (v === 'ganjil' || v === 'genap') return v
  }
  return 'ganjil'
}

// GET /api/admin/mata-pelajaran/[id]/penugasan
// Returns current assignments for this subject + available guru & kelas options
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await adminCheck()
    if (!auth.ok) return denyResponse()

    const { id: mapelId } = await params
    const supabaseAdmin = getSupabaseAdmin()

    // 1. Current assignments for this subject
    const { data: assignments, error: assignError } = await supabaseAdmin
      .from('guru_mengajar')
      .select(`
        id,
        guru_id,
        kelas_id,
        materi,
        semester,
        profiles(nama_lengkap),
        kelas(nama_kelas, tingkat, tahun_ajaran)
      `)
      .eq('mapel_id', mapelId)
      .order('created_at', { ascending: true })

    if (assignError) {
      return NextResponse.json({ error: assignError.message }, { status: 400 })
    }

    // PostgREST returns a single object for to-one relations and array for to-many:
    const pickOne = (v: unknown) => (Array.isArray(v) ? v[0] : v)

    const formatted = (assignments ?? []).map((r) => {
      const row = r as {
        id: string
        guru_id: string
        kelas_id: string
        materi: string | null
        semester: string | null
        profiles: { nama_lengkap: string } | { nama_lengkap: string }[] | null
        kelas:
          | { nama_kelas: string; tingkat: number; tahun_ajaran: string }
          | { nama_kelas: string; tingkat: number; tahun_ajaran: string }[]
          | null
      }
      const profile = pickOne(row.profiles)
      const kelasRow = pickOne(row.kelas)
      return {
        id: row.id,
        guru_id: row.guru_id,
        guru_nama: profile?.nama_lengkap ?? 'Tanpa Nama',
        kelas_id: row.kelas_id,
        kelas_nama: kelasRow?.nama_kelas ?? '-',
        tingkat: kelasRow?.tingkat ?? null,
        tahun_ajaran: kelasRow?.tahun_ajaran ?? null,
        semester: row.semester ?? null,
        materi: row.materi ?? null,
      }
    })

    // 2. Available guru options (role=guru, status=true, not already assigned for this mapel)
    const assignedGuruIds = formatted.map((a) => a.guru_id)
    const guruQuery = supabaseAdmin
      .from('profiles')
      .select('id, nama_lengkap')
      .eq('role', 'guru')
      .eq('status', true)
      .order('nama_lengkap', { ascending: true })

    const { data: allGuru, error: guruError } = await guruQuery
    if (guruError) {
      return NextResponse.json({ error: guruError.message }, { status: 400 })
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

    return NextResponse.json({
      assignments: formatted,
      guru: (allGuru ?? []).map((g: { id: string; nama_lengkap: string }) => ({
        id: g.id,
        nama_lengkap: g.nama_lengkap,
        alreadyAssigned: assignedGuruIds.includes(g.id),
      })),
      kelas: allKelas ?? [],
      semesters: SEMESTER_OPTIONS.map((s) => ({
        value: s,
        label: s === 'ganjil' ? 'Semester Ganjil' : 'Semester Genap',
      })),
    }, { status: 200 })
  } catch (err) {
    console.error('Error fetching penugasan:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// POST /api/admin/mata-pelajaran/[id]/penugasan
// Add a new assignment: { guru_id, kelas_id, materi? }
// Smart merge: only adds new rows, doesn't replace existing assignments for other subjects
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
    const { guru_id, kelas_id, materi, semester } = body

    if (!guru_id) {
      return NextResponse.json({ error: 'ID guru wajib diisi' }, { status: 400 })
    }

    if (!kelas_id) {
      return NextResponse.json({ error: 'ID kelas wajib diisi' }, { status: 400 })
    }

    const semesterNorm = normalizeSemester(semester)

    // Validate guru exists and is active guru
    const { data: guru } = await supabaseAdmin
      .from('profiles')
      .select('id, role')
      .eq('id', guru_id)
      .eq('role', 'guru')
      .eq('status', true)
      .maybeSingle()

    if (!guru) {
      return NextResponse.json({ error: 'Guru tidak ditemukan atau tidak aktif' }, { status: 400 })
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

    // Check duplicate: same guru + same mapel + same kelas + same semester
    const { data: existing } = await supabaseAdmin
      .from('guru_mengajar')
      .select('id')
      .eq('guru_id', guru_id)
      .eq('mapel_id', mapelId)
      .eq('kelas_id', kelas_id)
      .eq('semester', semesterNorm)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: `Penugasan sudah ada untuk guru ini di "${mapel.nama}" kelas tersebut untuk semester ${semesterNorm === 'ganjil' ? 'Ganjil' : 'Genap'}` },
        { status: 400 }
      )
    }

    // Insert new assignment
    const { data: result, error: insertError } = await supabaseAdmin
      .from('guru_mengajar')
      .insert({
        guru_id,
        mapel_id: mapelId,
        kelas_id,
        semester: semesterNorm,
        materi: materi?.trim() || null,
      })
      .select('id, guru_id, kelas_id, semester, materi')
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 })
    }

    return NextResponse.json({
      message: `Penugasan berhasil ditambahkan ke "${mapel.nama}"`,
      assignment: result,
    }, { status: 201 })
  } catch (err) {
    console.error('Error creating penugasan:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// PUT /api/admin/mata-pelajaran/[id]/penugasan
// Update materi & semester of a single assignment: { id, materi?, semester? }
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
    const { id: assignmentId, materi, semester } = body

    if (!assignmentId) {
      return NextResponse.json({ error: 'ID penugasan wajib diisi' }, { status: 400 })
    }

    if (materi !== undefined && materi !== null && typeof materi !== 'string') {
      return NextResponse.json({ error: 'Materi harus berupa teks' }, { status: 400 })
    }

    // Verify assignment belongs to this subject
    const { data: assignment } = await supabaseAdmin
      .from('guru_mengajar')
      .select('id, mapel_id')
      .eq('id', assignmentId)
      .eq('mapel_id', mapelId)
      .maybeSingle()

    if (!assignment) {
      return NextResponse.json(
        { error: 'Penugasan tidak ditemukan atau bukan milik mata pelajaran ini' },
        { status: 404 }
      )
    }

    const materiClean = typeof materi === 'string' && materi.trim() !== '' ? materi.trim() : null
    const semesterNorm = semester !== undefined ? normalizeSemester(semester) : undefined

    const updates: { materi: string | null; semester?: Semester } = { materi: materiClean }
    if (semesterNorm) updates.semester = semesterNorm

    const { data: result, error } = await supabaseAdmin
      .from('guru_mengajar')
      .update(updates)
      .eq('id', assignmentId)
      .select('id, guru_id, kelas_id, semester, materi')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({
      message: materiClean
        ? 'Pembaruan berhasil disimpan'
        : 'Pembaruan berhasil disimpan (materi dikosongkan)',
      assignment: result,
    }, { status: 200 })
  } catch (err) {
    console.error('Error updating penugasan:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/mata-pelajaran/[id]/penugasan?id=<assignment_id>
// Remove a single assignment row
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
      .from('guru_mengajar')
      .select('id, mapel_id')
      .eq('id', assignmentId)
      .eq('mapel_id', mapelId)
      .maybeSingle()

    if (!assignment) {
      return NextResponse.json(
        { error: 'Penugasan tidak ditemukan atau bukan milik mata pelajaran ini' },
        { status: 404 }
      )
    }

    const { error } = await supabaseAdmin
      .from('guru_mengajar')
      .delete()
      .eq('id', assignmentId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ message: 'Penugasan berhasil dihapus' }, { status: 200 })
  } catch (err) {
    console.error('Error deleting penugasan:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
