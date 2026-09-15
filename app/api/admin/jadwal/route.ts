import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { adminCheck, getSupabaseAdmin } from '@/lib/supabase-server'
import { denyResponse, serverError } from '@/lib/api-admin'

const HARI_VALID: readonly number[] = [1, 2, 3, 4, 5, 6] // 1=Senin ... 6=Sabtu
const HARI_LABEL: Record<number, string> = {
  1: 'Senin',
  2: 'Selasa',
  3: 'Rabu',
  4: 'Kamis',
  5: 'Jumat',
  6: 'Sabtu',
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

function parseJam(value: unknown): string | null {
  if (typeof value !== 'string' || !TIME_RE.test(value.trim())) return null
  return value.trim()
}

type JadwalRow = {
  id: string
  hari: number
  jam_mulai: string
  jam_selesai: string
  ruangan: string | null
  guru_mengajar_id: string
  guru_mengajar: {
    semester: string | null
    materi: string | null
    profiles: { nama_lengkap: string } | { nama_lengkap: string }[] | null
    mata_pelajaran: { nama: string; kode: string } | { nama: string; kode: string }[] | null
    kelas: { id: string; nama_kelas: string; tingkat: number } | { id: string; nama_kelas: string; tingkat: number }[] | null
  } | null
}

const pickOne = <T,>(v: T[] | T | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null)

// GET /api/admin/jadwal?kelas_id=...  -> jadwal satu kelas (terurut hari + jam)
// GET /api/admin/jadwal               -> opsi penugasan aktif (untuk form)
export async function GET(request: NextRequest) {
  try {
    const auth = await adminCheck()
    if (!auth.ok) return denyResponse()

    const supabaseAdmin = getSupabaseAdmin()
    const { searchParams } = new URL(request.url)
    const kelasId = searchParams.get('kelas_id')

    if (!kelasId) {
      // Mode opsi: penugasan guru_mengajar aktif + daftar kelas
      const [{ data: penugasan, error: pError }, { data: kelas, error: kError }] = await Promise.all([
        supabaseAdmin
          .from('guru_mengajar')
          .select('id, semester, mata_pelajaran(nama, kode), profiles(nama_lengkap), kelas(id, nama_kelas, tingkat)')
          .order('created_at', { ascending: true }),
        supabaseAdmin
          .from('kelas')
          .select('id, nama_kelas, tingkat')
          .eq('status', true)
          .order('tingkat', { ascending: true })
          .order('nama_kelas', { ascending: true }),
      ])

      if (pError || kError) {
        return NextResponse.json({ error: pError?.message || kError?.message }, { status: 400 })
      }

      type PenugasanOpts = {
        id: string
        semester: string | null
        mata_pelajaran: { nama: string; kode: string } | { nama: string; kode: string }[] | null
        profiles: { nama_lengkap: string } | { nama_lengkap: string }[] | null
        kelas: { id: string; nama_kelas: string; tingkat: number } | { id: string; nama_kelas: string; tingkat: number }[] | null
      }

      const penugasanOptions = ((penugasan ?? []) as PenugasanOpts[]).map((p) => {
        const mapel = pickOne(p.mata_pelajaran)
        const guru = pickOne(p.profiles)
        const kelasRow = pickOne(p.kelas)
        return {
          guru_mengajar_id: p.id,
          label: `${mapel?.nama ?? '-'} — ${guru?.nama_lengkap ?? 'Tanpa Nama'}${kelasRow ? ` (Kelas ${kelasRow.tingkat} ${kelasRow.nama_kelas})` : ''}`,
          semester: p.semester ?? 'ganjil',
          kelas_id: kelasRow?.id ?? null,
          mapel_nama: mapel?.nama ?? null,
          guru_nama: guru?.nama_lengkap ?? null,
        }
      })

      return NextResponse.json({
        kelas: kelas ?? [],
        penugasan: penugasanOptions,
        hari: HARI_VALID.map((h) => ({ value: h, label: HARI_LABEL[h] })),
      })
    }

    // Mode jadwal per kelas
    const { data, error } = await supabaseAdmin
      .from('jadwal_pelajaran')
      .select(`
        id, hari, jam_mulai, jam_selesai, ruangan, guru_mengajar_id,
        guru_mengajar(
          semester, materi,
          profiles(nama_lengkap),
          mata_pelajaran(nama, kode),
          kelas(id, nama_kelas, tingkat)
        )
      `)
      .order('hari', { ascending: true })
      .order('jam_mulai', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const rows = (data ?? []) as unknown as JadwalRow[]
    const jadwal = rows
      .map((r) => {
        const g = r.guru_mengajar
        const mapel = pickOne(g?.mata_pelajaran)
        const guru = pickOne(g?.profiles)
        const kelasRow = pickOne(g?.kelas)
        return {
          id: r.id,
          guru_mengajar_id: r.guru_mengajar_id,
          hari: r.hari,
          hari_label: HARI_LABEL[r.hari] ?? '-',
          jam_mulai: r.jam_mulai.slice(0, 5),
          jam_selesai: r.jam_selesai.slice(0, 5),
          ruangan: r.ruangan,
          semester: g?.semester ?? 'ganjil',
          mapel_nama: mapel?.nama ?? null,
          mapel_kode: mapel?.kode ?? null,
          guru_nama: guru?.nama_lengkap ?? null,
          kelas_id: kelasRow?.id ?? null,
          kelas_nama: kelasRow?.nama_kelas ?? null,
          tingkat: kelasRow?.tingkat ?? null,
        }
      })
      .filter((j) => j.kelas_id === kelasId)

    return NextResponse.json({ jadwal, hari: HARI_LABEL })
  } catch (err) {
    return serverError(err, 'Error listing jadwal:')
  }
}

// POST /api/admin/jadwal
// Body: { guru_mengajar_id, hari, jam_mulai, jam_selesai, ruangan? }
export async function POST(request: Request) {
  try {
    const auth = await adminCheck()
    if (!auth.ok) return denyResponse()

    const supabaseAdmin = getSupabaseAdmin()
    const body = await request.json()
    const { guru_mengajar_id, hari, jam_mulai, jam_selesai, ruangan } = body

    const hariNum = Number(hari)
    if (!HARI_VALID.includes(hariNum)) {
      return NextResponse.json({ error: 'Hari tidak valid' }, { status: 400 })
    }

    const mulai = parseJam(jam_mulai)
    const selesai = parseJam(jam_selesai)
    if (!mulai || !selesai) {
      return NextResponse.json({ error: 'Format jam harus HH:MM (contoh: 07:30)' }, { status: 400 })
    }
    if (selesai <= mulai) {
      return NextResponse.json({ error: 'Jam selesai harus lebih besar dari jam mulai' }, { status: 400 })
    }

    // Pastikan penugasan ada dan ambil kelas_id-nya
    const { data: penugasan } = await supabaseAdmin
      .from('guru_mengajar')
      .select('id, kelas_id')
      .eq('id', guru_mengajar_id)
      .maybeSingle()

    if (!penugasan) {
      return NextResponse.json({ error: 'Penugasan guru tidak ditemukan' }, { status: 400 })
    }

    // Cek bentrok di kelas yang sama (waktu tumpang tindih pada hari yang sama)
    const { data: bentrokKelas } = await supabaseAdmin
      .from('jadwal_pelajaran')
      .select('id')
      .eq('hari', hariNum)
      .lt('jam_mulai', selesai)
      .gt('jam_selesai', mulai)
      .in(
        'guru_mengajar_id',
        (await supabaseAdmin.from('guru_mengajar').select('id').eq('kelas_id', penugasan.kelas_id)).data?.map((r: { id: string }) => r.id) ?? ['']
      )

    if ((bentrokKelas ?? []).length > 0) {
      return NextResponse.json(
        { error: `Bentrok: kelas ini sudah ada jadwal pada ${HARI_LABEL[hariNum]} jam ${mulai}-${selesai}` },
        { status: 400 }
      )
    }

    // Cek bentrok untuk guru yang sama
    const { data: bentrokGuru } = await supabaseAdmin
      .from('jadwal_pelajaran')
      .select('id')
      .eq('hari', hariNum)
      .lt('jam_mulai', selesai)
      .gt('jam_selesai', mulai)
      .in(
        'guru_mengajar_id',
        (await supabaseAdmin
          .from('guru_mengajar')
          .select('id')
          .eq('guru_id', (await supabaseAdmin.from('guru_mengajar').select('guru_id').eq('id', guru_mengajar_id).maybeSingle()).data?.guru_id ?? '')
        ).data?.map((r: { id: string }) => r.id) ?? ['']
      )

    if ((bentrokGuru ?? []).length > 0) {
      return NextResponse.json(
        { error: `Bentrok: guru ini sudah mengajar di waktu tersebut (${HARI_LABEL[hariNum]} ${mulai}-${selesai})` },
        { status: 400 }
      )
    }

    const { data: result, error: insertError } = await supabaseAdmin
      .from('jadwal_pelajaran')
      .insert({
        guru_mengajar_id,
        hari: hariNum,
        jam_mulai: mulai,
        jam_selesai: selesai,
        ruangan: typeof ruangan === 'string' && ruangan.trim() !== '' ? ruangan.trim() : null,
      })
      .select('id')
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 })
    }

    return NextResponse.json(
      { message: `Jadwal berhasil ditambahkan (${HARI_LABEL[hariNum]} ${mulai}-${selesai})`, jadwal: result },
      { status: 201 }
    )
  } catch (err) {
    return serverError(err, 'Error creating jadwal:')
  }
}

// DELETE /api/admin/jadwal?id=<jadwal_id>
export async function DELETE(request: NextRequest) {
  try {
    const auth = await adminCheck()
    if (!auth.ok) return denyResponse()

    const supabaseAdmin = getSupabaseAdmin()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID jadwal wajib diisi' }, { status: 400 })
    }

    const { error } = await supabaseAdmin.from('jadwal_pelajaran').delete().eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ message: 'Jadwal berhasil dihapus' }, { status: 200 })
  } catch (err) {
    return serverError(err, 'Error deleting jadwal:')
  }
}
