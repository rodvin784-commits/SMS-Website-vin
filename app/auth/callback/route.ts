import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getSupabaseAdmin } from '@/lib/supabase-server'

// Callback OAuth Google (smk.belajar.id) — exchange code → session + validasi profiles
// Dipakai oleh: Supabase Auth redirect https://<project>.supabase.co/auth/v1/callback → /auth/callback?code=...
export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next') ?? '/login'

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=oauth_no_code', url.origin))
  }

  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        },
      },
    }
  )

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
  if (exchangeError) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(exchangeError.message)}`, url.origin))
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) {
    await supabase.auth.signOut()
    return NextResponse.redirect(new URL('/login?error=oauth_no_email', url.origin))
  }

  // Enforce domain smk.belajar.id untuk siswa (10/10)
  if (!user.email.toLowerCase().endsWith('@smk.belajar.id')) {
    await supabase.auth.signOut()
    return NextResponse.redirect(new URL('/login?error=domain_harus_smk_belajar', url.origin))
  }

  // Cek profiles — harus sudah dibuat Admin (DATABASE_CONTEXT.md:10), blok auto-register liar
  const admin = getSupabaseAdmin()
  const { data: profile } = await admin.from('profiles').select('role, status').eq('id', user.id).maybeSingle()
  // Jika belum ada profiles, coba cari by email (akun dibuat admin sebelum OAuth, id beda) → tolak & minta admin sync
  if (!profile) {
    const { data: byEmail } = await admin.from('profiles').select('id, role, status').eq('email', user.email.toLowerCase()).maybeSingle()
    if (!byEmail) {
      await supabase.auth.signOut()
      return NextResponse.redirect(new URL('/login?error=akun_belum_terdaftar', url.origin))
    }
    if (byEmail.status === false) {
      await supabase.auth.signOut()
      return NextResponse.redirect(new URL('/login?error=akun_dinonaktifkan', url.origin))
    }
    // byEmail ada tapi id mismatch (auth user baru vs profiles lama) — tolak, admin harus hapus profiles lama atau link manual
    await supabase.auth.signOut()
    return NextResponse.redirect(new URL('/login?error=email_sudah_terdaftar_hubungi_admin', url.origin))
  }

  if (profile.status === false) {
    await supabase.auth.signOut()
    return NextResponse.redirect(new URL('/login?error=akun_dinonaktifkan', url.origin))
  }

  // Siswa di web tetap diblok sesuai app/login/page.tsx:69 — arahkan ke APK
  if (profile.role === 'siswa') {
    await supabase.auth.signOut()
    return NextResponse.redirect(new URL('/login?error=siswa_gunakan_apk', url.origin))
  }

  // Guru/admin sukses
  const redirectTo = profile.role === 'admin' ? '/admin/dashboard' : '/teacher/dashboard'
  return NextResponse.redirect(new URL(redirectTo, url.origin))
}
