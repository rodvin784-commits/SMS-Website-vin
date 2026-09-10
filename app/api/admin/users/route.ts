import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { adminCheck, getSupabaseAdmin } from '@/lib/supabase-server'

function denyResponse() {
  return NextResponse.json(
    { error: 'Tidak diizinkan. Hanya admin yang dapat mengakses data ini.' },
    { status: 403 }
  )
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

    let query = supabaseAdmin
      .from('profiles')
      .select('*')
      .neq('role', 'admin') // Exclude admin accounts from listing
      .order('created_at', { ascending: false })

    if (role && role !== 'semua') {
      if (!['guru', 'siswa'].includes(role)) {
        return NextResponse.json({ error: 'Role harus guru atau siswa' }, { status: 400 })
      }
      query = query.eq('role', role)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(data ?? [], { status: 200 })
  } catch (err) {
    console.error('Error listing users:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Terjadi kesalahan server' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const auth = await adminCheck()
    if (!auth.ok) {
      return denyResponse()
    }

    const supabaseAdmin = getSupabaseAdmin()
    const { email, password, nama_lengkap, role } = await request.json()

    // Validasi input
    if (!email || !password) {
      return NextResponse.json({ error: 'Email dan password wajib diisi' }, { status: 400 })
    }

    if (!nama_lengkap || nama_lengkap.trim() === '') {
      return NextResponse.json({ error: 'Nama lengkap wajib diisi' }, { status: 400 })
    }

    if (!role || !['guru', 'siswa'].includes(role)) {
      return NextResponse.json({ error: 'Role harus guru atau siswa' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password minimal 6 karakter' }, { status: 400 })
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
      // Jika email sudah ada di auth, beri pesan lebih jelas
      if (authError.message.includes('User already exists') || authError.message.includes('already exists')) {
        return NextResponse.json({ error: 'Email sudah terdaftar di sistem' }, { status: 400 })
      }
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    const userId = authData.user.id

    // 2. Masukkan data profil ke tabel profiles
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: userId,
        email,
        nama_lengkap: nama_lengkap.trim(),
        role,
        status: true
      })

    if (profileError) {
      // Jika gagal, kita coba hapus user auth yang baru dibuat
      await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {})
      return NextResponse.json({ error: profileError.message }, { status: 400 })
    }

    return NextResponse.json({ message: 'Pengguna berhasil dibuat', userId }, { status: 201 })
  } catch (err) {
    console.error('Error creating user:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Terjadi kesalahan server' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await adminCheck()
    if (!auth.ok) {
      return denyResponse()
    }

    const supabaseAdmin = getSupabaseAdmin()
    const { id, email, password, nama_lengkap, role, status } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'ID pengguna wajib diisi' }, { status: 400 })
    }

    // Validasi input
    if (nama_lengkap && nama_lengkap.trim() === '') {
      return NextResponse.json({ error: 'Nama lengkap tidak boleh kosong' }, { status: 400 })
    }

    if (role && !['guru', 'siswa'].includes(role)) {
      return NextResponse.json({ error: 'Role harus guru atau siswa' }, { status: 400 })
    }

    if (password && password.length < 6) {
      return NextResponse.json({ error: 'Password minimal 6 karakter' }, { status: 400 })
    }

    // 1. Update data auth (email / password) jika diubah
    if (email || password) {
      const authPayload: { email_confirm: boolean; email?: string; password?: string } = { email_confirm: true }
      if (email) authPayload.email = email
      if (password) authPayload.password = password

      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, authPayload)
      if (authError) {
        // Jika email sudah digunakan user lain
        if (authError.message.includes('already exists') || authError.message.includes('User already exists')) {
          return NextResponse.json({ error: 'Email sudah digunakan user lain' }, { status: 400 })
        }
        return NextResponse.json({ error: authError.message }, { status: 400 })
      }
    }

    // 2. Update data profil
    const profileUpdates: { nama_lengkap?: string; role?: string; status?: boolean; email?: string } = {}

    if (nama_lengkap !== undefined) profileUpdates.nama_lengkap = nama_lengkap.trim()
    if (role !== undefined) profileUpdates.role = role
    if (status !== undefined) profileUpdates.status = status
    if (email !== undefined) profileUpdates.email = email

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update(profileUpdates)
      .eq('id', id)

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 })
    }

    return NextResponse.json({ message: 'Pengguna berhasil diperbarui' }, { status: 200 })
  } catch (err) {
    console.error('Error updating user:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Terjadi kesalahan server' }, { status: 500 })
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
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (checkError) {
      return NextResponse.json({ error: checkError.message }, { status: 400 })
    }

    if (!user) {
      return NextResponse.json({ error: 'Pengguna tidak ditemukan' }, { status: 404 })
    }

    // 2. Hapus akun auth (agar email tidak terkunci) - dilakukan pertama
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id)
    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    // 3. Hapus profil dari tabel profiles
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', id)

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 })
    }

    return NextResponse.json({ message: 'Pengguna berhasil dihapus' }, { status: 200 })
  } catch (err) {
    console.error('Error deleting user:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Terjadi kesalahan server' }, { status: 500 })
  }
}
