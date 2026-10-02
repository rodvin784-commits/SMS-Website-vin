import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSessionUser, getSupabaseAdmin } from '@/lib/supabase-server'

// POST /api/profile/change-password { currentPassword?, newPassword }
// Hanya 1x per akun (self-service). Setelah itu hubungi admin.
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({ error: 'Belum login' }, { status: 401 })

    const body = await request.json().catch(() => null)
    const newPassword = body?.newPassword ? String(body.newPassword) : ''
    const currentPassword = body?.currentPassword ? String(body.currentPassword) : ''

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json({ error: 'Password baru minimal 6 karakter' }, { status: 400 })
    }
    if (newPassword === currentPassword && currentPassword) {
      return NextResponse.json({ error: 'Password baru tidak boleh sama dengan yang lama' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const { data: profile } = await supabase.from('profiles').select('password_changed_count').eq('id', user.id).maybeSingle()
    const count = (profile as { password_changed_count: number | null } | null)?.password_changed_count ?? 0
    if (count >= 1) {
      return NextResponse.json({ error: 'Ganti sandi hanya 1 kali. Hubungi admin untuk reset.' }, { status: 403 })
    }

    if (!currentPassword) {
      return NextResponse.json({ error: 'Password lama wajib diisi' }, { status: 400 })
    }
    // Verifikasi password lama via anon client
    {
      const { data: prof } = await supabase.from('profiles').select('email').eq('id', user.id).maybeSingle()
      const email = (prof as { email: string | null } | null)?.email
      if (!email) return NextResponse.json({ error: 'Email tidak ditemukan' }, { status: 400 })
      const { createClient } = await import('@supabase/supabase-js')
      const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })
      const { error: e2 } = await anon.auth.signInWithPassword({ email, password: currentPassword })
      if (e2) return NextResponse.json({ error: 'Password lama salah' }, { status: 400 })
    }

    const { error: updErr } = await supabase.auth.admin.updateUserById(user.id, { password: newPassword })
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 })

    await supabase.from('profiles').update({ password_changed_count: count + 1, password_last_changed: new Date().toISOString() }).eq('id', user.id)

    return NextResponse.json({ message: 'Password berhasil diganti (1x). Hubungi admin untuk ganti lagi.' })
  } catch (err) {
    console.error('change-password', err)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

// GET /api/profile/change-password — cek sisa kesempatan
export async function GET() {
  try {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({ error: 'Belum login' }, { status: 401 })
    const { data } = await getSupabaseAdmin().from('profiles').select('password_changed_count, password_last_changed').eq('id', user.id).maybeSingle()
    const count = (data as { password_changed_count: number | null } | null)?.password_changed_count ?? 0
    return NextResponse.json({ used: count, remaining: Math.max(0, 1 - count), last: (data as { password_last_changed: string | null } | null)?.password_last_changed ?? null })
  } catch (err) {
    console.error('GET change-password', err)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}
