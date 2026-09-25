import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { adminCheck, getSupabaseAdmin } from '@/lib/supabase-server'
import { denyResponse, serverError } from '@/lib/api-admin'

const ROLES = ['guru', 'siswa'] as const
type Role = (typeof ROLES)[number]

function isRole(v: unknown): v is Role {
  return typeof v === 'string' && (ROLES as readonly string[]).includes(v)
}

// Validasi kelas_id (wajib ada, status aktif, tingkat 10-12).
async function validKelasId(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  kelasId: string | null | undefined
): Promise<string | null> {
  if (!kelasId) return null

  const { data } = await supabaseAdmin
    .from('kelas')
    .select('id')
    .eq('id', kelasId)
    .eq('status', true)
    .gte('tingkat', 10)
    .lte('tingkat', 12)
    .maybeSingle()

  return data?.id ?? null
}

export async function GET(request: NextRequest) {
  try {
    const auth = await adminCheck()
    if (!auth.ok) {
      return denyResponse()
    }

    const supabaseAdmin = getSupabaseAdmin()

    const { searchParams } = new URL(request.url)
    const role = searchParams.get('role')
    // Pagination guard: default 100, max 200 untuk cegah payload 10k
    const limitParam = searchParams.get('limit')
    const offsetParam = searchParams.get('offset')
    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 100, 1), 200) : null
    const offset = offsetParam ? Math.max(parseInt(offsetParam, 10) || 0, 0) : null

    let query = supabaseAdmin
      .from('profiles')
      .select('id, email, nama_lengkap, role, status, created_at')
      .neq('role', 'admin') // Exclude admin accounts from listing
      .order('created_at', { ascending: false })

    if (role && role !== 'semua') {
      if (!isRole(role)) {
        return NextResponse.json({ error: 'Role harus guru atau siswa' }, { status: 400 })
      }
      query = query.eq('role', role)
    }
    if (limit !== null) query = query.range(offset ?? 0, (offset ?? 0) + limit - 1)

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const profiles = (data ?? []) as Array<{
      id: string
      email: string | null
      nama_lengkap: string | null
      role: string
      status: boolean
      created_at: string
    }>

    // Ambil data spesifik guru/siswa (NIS/NIP/kelas) sekaligus untuk semua profil.
    const profileIds = profiles.map((p) => p.id)

    type GuruRow = { profile_id: string; nip: string | null; nama_lengkap: string | null }
    type SiswaRow = {
      profile_id: string
      nis: string
      nama_lengkap: string
      kelas_id: string
      kelas: { nama_kelas: string; tingkat: number } | { nama_kelas: string; tingkat: number }[] | null
    }

    const guruMap = new Map<string, GuruRow>()
    const siswaMap = new Map<string, SiswaRow>()

    if (profileIds.length > 0) {
      const guruProfiles = profiles.filter((p) => p.role === 'guru')
      if (guruProfiles.length > 0) {
        const { data: guruRows } = await supabaseAdmin
          .from('guru')
          .select('profile_id, nip, nama_lengkap')
          .in('profile_id', guruProfiles.map((p) => p.id))
        for (const g of (guruRows ?? []) as GuruRow[]) guruMap.set(g.profile_id, g)
      }

      const siswaProfiles = profiles.filter((p) => p.role === 'siswa')
      if (siswaProfiles.length > 0) {
        const { data: siswaRows } = await supabaseAdmin
          .from('siswa')
          .select('profile_id, nis, nama_lengkap, kelas_id, kelas(nama_kelas, tingkat)')
          .in('profile_id', siswaProfiles.map((p) => p.id))
        for (const s of (siswaRows ?? []) as SiswaRow[]) siswaMap.set(s.profile_id, s)
      }
    }

    const result = profiles.map((r) => {
      const guru = guruMap.get(r.id)
      const siswa = siswaMap.get(r.id)
      const kelasRow = siswa ? (Array.isArray(siswa.kelas) ? siswa.kelas[0] : siswa.kelas) : null
      return {
        id: r.id,
        email: r.email,
        nama_lengkap: r.nama_lengkap,
        role: r.role,
        status: r.status,
        created_at: r.created_at,
        nip: guru?.nip ?? null,
        nis: siswa?.nis ?? null,
        kelas_id: siswa?.kelas_id ?? null,
        kelas_nama: kelasRow ? `Kelas ${kelasRow.tingkat} ${kelasRow.nama_kelas}` : null,
      }
    })

    return NextResponse.json(result, { status: 200 })
  } catch (err) {
    return serverError(err, 'Error listing users:')
  }
}

export async function POST(request: Request) {
  try {
    const auth = await adminCheck()
    if (!auth.ok) {
      return denyResponse()
    }

    const supabaseAdmin = getSupabaseAdmin()
    let { email, password, nama_lengkap, role, kelas_id, nis, nip } = await request.json()

    // Validasi input — siswa Google OAuth: password opsional (auto-random)
    if (!email) {
      return NextResponse.json({ error: 'Email wajib diisi' }, { status: 400 })
    }
    if (role === 'siswa' && (!password || String(password).trim() === '')) {
      // auto 12 char untuk siswa (dipakai hanya fallback, login utama via Google @smk.belajar.id)
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%'
      let rnd = ''
      for (let i = 0; i < 12; i++) rnd += chars[Math.floor(Math.random() * chars.length)]
      password = rnd
    }
    if (!password || String(password).length < 6) {
      return NextResponse.json({ error: 'Password minimal 6 karakter (kosongkan untuk auto siswa Google)' }, { status: 400 })
    }

    if (!nama_lengkap || String(nama_lengkap).trim() === '') {
      return NextResponse.json({ error: 'Nama lengkap wajib diisi' }, { status: 400 })
    }

    if (!isRole(role)) {
      return NextResponse.json({ error: 'Role harus guru atau siswa' }, { status: 400 })
    }

    const nama = String(nama_lengkap).trim()

    if (role === 'siswa') {
      if (!nis || String(nis).trim() === '') {
        return NextResponse.json({ error: 'NIS wajib diisi untuk akun siswa' }, { status: 400 })
      }
      if (!(await validKelasId(supabaseAdmin, kelas_id))) {
        return NextResponse.json({ error: 'Kelas wajib diisi dan harus berstatus aktif' }, { status: 400 })
      }
    }

    // Cek email sudah terdaftar belum
    const { data: existingUser, error: checkError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (checkError) {
      return NextResponse.json({ error: checkError.message }, { status: 400 })
    }

    if (existingUser) {
      return NextResponse.json({ error: 'Email sudah terdaftar' }, { status: 400 })
    }

    // 1. Buat user baru menggunakan Supabase Auth Admin
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    })

    if (authError) {
      if (authError.message.includes('User already exists') || authError.message.includes('already exists')) {
        return NextResponse.json({ error: 'Email sudah terdaftar di sistem' }, { status: 400 })
      }
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    const userId = authData.user.id

    // 2. Masukkan data profil ke tabel profiles (nama_lengkap, tanpa kelas_id)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: userId,
        email,
        nama_lengkap: nama,
        role,
        status: true,
      })

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: profileError.message }, { status: 400 })
    }

    // 3. Masukkan data spesifik per role (guru / siswa)
    if (role === 'guru') {
      const { error: guruError } = await supabaseAdmin.from('guru').insert({
        profile_id: userId,
        nip: nip ? String(nip).trim() : null,
        nama_lengkap: nama,
      })
      if (guruError) {
        await supabaseAdmin.auth.admin.deleteUser(userId)
        await supabaseAdmin.from('profiles').delete().eq('id', userId)
        return NextResponse.json({ error: guruError.message }, { status: 400 })
      }
    } else {
      const resolvedKelasId = (await validKelasId(supabaseAdmin, kelas_id)) as string
      // Ambil jurusan_id dari kelas yang dipilih
      const { data: kelasData } = await supabaseAdmin
        .from('kelas')
        .select('jurusan_id')
        .eq('id', resolvedKelasId)
        .maybeSingle()
      const jurusan_id = kelasData?.jurusan_id
      const { error: siswaError } = await supabaseAdmin.from('siswa').insert({
        profile_id: userId,
        nis: String(nis).trim(),
        nama_lengkap: nama,
        kelas_id: resolvedKelasId,
        jurusan_id: jurusan_id,
      })
      if (siswaError) {
        await supabaseAdmin.auth.admin.deleteUser(userId)
        await supabaseAdmin.from('profiles').delete().eq('id', userId)
        return NextResponse.json({ error: siswaError.message }, { status: 400 })
      }
    }

    return NextResponse.json({ message: 'Pengguna berhasil dibuat', userId }, { status: 201 })
  } catch (err) {
    return serverError(err, 'Error creating user:')
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await adminCheck()
    if (!auth.ok) {
      return denyResponse()
    }

    const supabaseAdmin = getSupabaseAdmin()
    const { id, email, password, nama_lengkap, role, status, kelas_id, nis, nip } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'ID pengguna wajib diisi' }, { status: 400 })
    }

    if (nama_lengkap !== undefined && String(nama_lengkap).trim() === '') {
      return NextResponse.json({ error: 'Nama lengkap tidak boleh kosong' }, { status: 400 })
    }

    if (role !== undefined && !isRole(role)) {
      return NextResponse.json({ error: 'Role harus guru atau siswa' }, { status: 400 })
    }

    if (password && password.length < 6) {
      return NextResponse.json({ error: 'Password minimal 6 karakter' }, { status: 400 })
    }

    // Cek profil yang ada beserta role saat ini
    const { data: existingProfile, error: existingErr } = await supabaseAdmin
      .from('profiles')
      .select('id, role, nama_lengkap')
      .eq('id', id)
      .maybeSingle()

    if (existingErr) return NextResponse.json({ error: existingErr.message }, { status: 400 })
    if (!existingProfile) return NextResponse.json({ error: 'Pengguna tidak ditemukan' }, { status: 404 })

    const finalRole = role ?? existingProfile.role
    const nama = nama_lengkap !== undefined ? String(nama_lengkap).trim() : undefined

    if (finalRole === 'siswa') {
      const awal = existingProfile.role
      const nisFinal = nis !== undefined ? String(nis).trim() : undefined
      const kelasFinal = kelas_id !== undefined ? await validKelasId(supabaseAdmin, kelas_id) : undefined

      if (awal !== 'siswa' || nis !== undefined) {
        if (!nisFinal) {
          return NextResponse.json({ error: 'NIS wajib diisi untuk akun siswa' }, { status: 400 })
        }
      }
      if (awal !== 'siswa' || kelas_id !== undefined) {
        if (!kelasFinal) {
          return NextResponse.json({ error: 'Kelas wajib diisi dan harus berstatus aktif' }, { status: 400 })
        }
      }
    }

    // 1. Update data auth (email / password) jika diubah
    if (email || password) {
      const authPayload: { email_confirm: boolean; email?: string; password?: string } = { email_confirm: true }
      if (email) authPayload.email = email
      if (password) authPayload.password = password

      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, authPayload)
      if (authError) {
        if (authError.message.includes('already exists') || authError.message.includes('User already exists')) {
          return NextResponse.json({ error: 'Email sudah digunakan user lain' }, { status: 400 })
        }
        return NextResponse.json({ error: authError.message }, { status: 400 })
      }
    }

    // 2. Update data profil
    const profileUpdates: { nama_lengkap?: string; role?: string; status?: boolean; email?: string } = {}

    if (nama !== undefined) profileUpdates.nama_lengkap = nama
    if (role !== undefined) profileUpdates.role = role
    if (status !== undefined) profileUpdates.status = status
    if (email !== undefined) profileUpdates.email = email

    if (Object.keys(profileUpdates).length > 0) {
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update(profileUpdates)
        .eq('id', id)

      if (profileError) {
        return NextResponse.json({ error: profileError.message }, { status: 400 })
      }
    }

    // 3. Sinkronkan tabel guru / siswa mengikuti role final.
    //    Role berpindah: bersihkan baris relasi pada role lama.
    if (existingProfile.role === 'siswa' && finalRole !== 'siswa') {
      const { data: siswaRow } = await supabaseAdmin
        .from('siswa')
        .select('id')
        .eq('profile_id', id)
        .maybeSingle()
      if (siswaRow) {
        await supabaseAdmin.from('pengumpulan_tugas').delete().eq('siswa_id', siswaRow.id)
        await supabaseAdmin.from('nilai').delete().eq('siswa_id', siswaRow.id)
        await supabaseAdmin.from('siswa').delete().eq('id', siswaRow.id)
      }
    }

    if (existingProfile.role === 'guru' && finalRole !== 'guru') {
      const { data: guruRow } = await supabaseAdmin
        .from('guru')
        .select('id')
        .eq('profile_id', id)
        .maybeSingle()
      if (guruRow) {
        await supabaseAdmin.from('guru_kelas').delete().eq('guru_id', guruRow.id)
        await supabaseAdmin.from('guru_mata_pelajaran').delete().eq('guru_id', guruRow.id)
        await supabaseAdmin.from('guru').delete().eq('id', guruRow.id)
      }
    }

    if (finalRole === 'guru') {
      const guruPayload: { nip?: string | null; nama_lengkap?: string } = {}
      if (nip !== undefined) guruPayload.nip = nip ? String(nip).trim() : null
      if (nama !== undefined) guruPayload.nama_lengkap = nama

      const { data: guruRow } = await supabaseAdmin
        .from('guru')
        .select('id')
        .eq('profile_id', id)
        .maybeSingle()

      if (guruRow) {
        if (Object.keys(guruPayload).length > 0) {
          await supabaseAdmin.from('guru').update(guruPayload).eq('id', guruRow.id)
        }
      } else {
        const { error: insertErr } = await supabaseAdmin.from('guru').insert({
          profile_id: id,
          nip: nip ? String(nip).trim() : null,
          nama_lengkap: nama ?? existingProfile.nama_lengkap ?? '',
        })
        if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 400 })
      }
    }

    if (finalRole === 'siswa') {
      const siswaPayload: { nis?: string; nama_lengkap?: string; kelas_id?: string; jurusan_id?: string | null } = {}
      if (nis !== undefined) siswaPayload.nis = String(nis).trim()
      if (nama !== undefined) siswaPayload.nama_lengkap = nama
      if (kelas_id !== undefined) {
        const inlineKelas = await validKelasId(supabaseAdmin, kelas_id)
        if (inlineKelas) {
          siswaPayload.kelas_id = inlineKelas
          // Ambil jurusan_id dari kelas yang dipilih
          const { data: kelasData } = await supabaseAdmin
            .from('kelas')
            .select('jurusan_id')
            .eq('id', inlineKelas)
            .maybeSingle()
          siswaPayload.jurusan_id = kelasData?.jurusan_id
        }
      }

      const { data: siswaRow } = await supabaseAdmin
        .from('siswa')
        .select('id')
        .eq('profile_id', id)
        .maybeSingle()

      if (siswaRow) {
        if (Object.keys(siswaPayload).length > 0) {
          await supabaseAdmin.from('siswa').update(siswaPayload).eq('id', siswaRow.id)
        }
      } else {
        const kelasFinal = (await validKelasId(supabaseAdmin, kelas_id ?? null)) ?? undefined
        let jurusanFinal: string | null | undefined = undefined
        if (kelasFinal) {
          const { data: kelasData } = await supabaseAdmin
            .from('kelas')
            .select('jurusan_id')
            .eq('id', kelasFinal)
            .maybeSingle()
          jurusanFinal = kelasData?.jurusan_id
        }
        const { error: insertErr } = await supabaseAdmin.from('siswa').insert({
          profile_id: id,
          nis: nis ? String(nis).trim() : '',
          nama_lengkap: nama ?? existingProfile.nama_lengkap ?? '',
          kelas_id: kelasFinal,
          jurusan_id: jurusanFinal,
        })
        if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 400 })
      }
    }

    return NextResponse.json({ message: 'Pengguna berhasil diperbarui' }, { status: 200 })
  } catch (err) {
    return serverError(err, 'Error updating user:')
  }
}

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
      return NextResponse.json({ error: 'ID pengguna wajib diisi' }, { status: 400 })
    }

    // 1. Cek apakah user ada
    const { data: user, error: checkError } = await supabaseAdmin
      .from('profiles')
      .select('id, role')
      .eq('id', id)
      .maybeSingle()

    if (checkError) {
      return NextResponse.json({ error: checkError.message }, { status: 400 })
    }

    if (!user) {
      return NextResponse.json({ error: 'Pengguna tidak ditemukan' }, { status: 404 })
    }

    // 2. Bersihkan data relasi sebelum menghapus akun
    if (user.role === 'guru') {
      const { data: guruRow } = await supabaseAdmin
        .from('guru')
        .select('id')
        .eq('profile_id', id)
        .maybeSingle()
      if (guruRow) {
        await supabaseAdmin.from('guru_kelas').delete().eq('guru_id', guruRow.id)
        await supabaseAdmin.from('guru_mata_pelajaran').delete().eq('guru_id', guruRow.id)
        await supabaseAdmin.from('guru').delete().eq('id', guruRow.id)
      }
    } else if (user.role === 'siswa') {
      const { data: siswaRow } = await supabaseAdmin
        .from('siswa')
        .select('id')
        .eq('profile_id', id)
        .maybeSingle()
      if (siswaRow) {
        await supabaseAdmin.from('pengumpulan_tugas').delete().eq('siswa_id', siswaRow.id)
        await supabaseAdmin.from('nilai').delete().eq('siswa_id', siswaRow.id)
        await supabaseAdmin.from('siswa').delete().eq('id', siswaRow.id)
      }
    }

    // 3. Hapus akun auth (agar email tidak terkunci)
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id)
    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    // 4. Hapus profil dari tabel profiles
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', id)

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 })
    }

    return NextResponse.json({ message: 'Pengguna berhasil dihapus' }, { status: 200 })
  } catch (err) {
    return serverError(err, 'Error deleting user:')
  }
}