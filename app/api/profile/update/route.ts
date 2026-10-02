import { NextResponse } from 'next/server'
import { getSessionUser, getSupabaseAdmin } from '@/lib/supabase-server'

// POST /api/profile/update { nama_lengkap }
export async function POST(request: Request) {
  try {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({ error: 'Belum login' }, { status: 401 })

    const body = await request.json().catch(() => null)
    const nama = body?.nama_lengkap ? String(body.nama_lengkap).trim().slice(0, 100) : ''
    if (!nama) return NextResponse.json({ error: 'Nama lengkap wajib diisi' }, { status: 400 })
    if (nama.length < 3) return NextResponse.json({ error: 'Nama minimal 3 karakter' }, { status: 400 })

    const supabase = getSupabaseAdmin()
    const { error: pErr } = await supabase.from('profiles').update({ nama_lengkap: nama }).eq('id', user.id)
    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 400 })

    // Sinkron ke tabel guru/siswa jika ada
    const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    const role = (prof as { role: string } | null)?.role
    if (role === 'guru') {
      await supabase.from('guru').update({ nama_lengkap: nama }).eq('profile_id', user.id)
    } else if (role === 'siswa') {
      await supabase.from('siswa').update({ nama_lengkap: nama }).eq('profile_id', user.id)
    }

    return NextResponse.json({ message: 'Profil berhasil diperbarui', nama_lengkap: nama })
  } catch (err) {
    console.error('profile update', err)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
