import { createServerClient } from '@supabase/ssr'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { cookies, headers } from 'next/headers'

// Klien service-role (bypass RLS). Kunci diambil dari SUPABASE_SERVICE_ROLE_KEY
// (legacy) atau SUPABASE_SECRET_KEY (format baru sb_secret_...).
export function getSupabaseAdmin(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Environment variables NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (atau SUPABASE_SECRET_KEY) are required')
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

// User dari sesi browser (cookie) ATAU aplikasi mobile (header Authorization: Bearer <access_token>),
// diverifikasi ke server Auth (getUser, bukan getSession).
export async function getSessionUser(): Promise<{ id: string } | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return null
  }

  // 1) Aplikasi mobile (APK siswa): kirim access token via header Authorization.
  //    Token diverifikasi langsung ke Supabase Auth — tidak ada cookie di native/WebView.
  try {
    const authHeader = (await headers()).get('authorization')
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
      const token = authHeader.slice(7).trim()
      if (token) {
        const bearerClient = createClient(supabaseUrl, supabaseAnonKey, {
          auth: { autoRefreshToken: false, persistSession: false }
        })
        const { data: { user: bearerUser }, error: bearerError } = await bearerClient.auth.getUser(token)
        if (bearerError || !bearerUser) return null
        return { id: bearerUser.id }
      }
      return null
    }
  } catch {
    // headers() tidak tersedia di luar scope request — lanjut ke alur cookie.
  }

  // 2) Web: cookie sesi browser.
  const cookieStore = await cookies()
  const allCookies = cookieStore.getAll()

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return allCookies
      },
      setAll() {
        // Refresh token ditangani proxy saat navigasi.
      }
    }
  })

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return { id: user.id }
}

export type AdminCheckResult = { ok: true } | { ok: false; detail: string }

// Cek sesi admin aktif (role admin dan tidak dinonaktifkan).
export async function adminCheck(): Promise<AdminCheckResult> {
  try {
    const user = await getSessionUser()
    if (!user) {
      return { ok: false, detail: 'no-session' }
    }

    const { data, error } = await getSupabaseAdmin()
      .from('profiles')
      .select('role, status')
      .eq('id', user.id)
      .maybeSingle()

    if (error || !data) {
      return { ok: false, detail: `profile-lookup-failed (userId=${user.id}, dbError=${error?.message ?? 'no-row'})` }
    }

    if (data.role !== 'admin') {
      return { ok: false, detail: `role-is-${data.role}` }
    }

    if (data.status === false) {
      return { ok: false, detail: 'account-disabled' }
    }

    return { ok: true }
  } catch (err) {
    return { ok: false, detail: `exception: ${err instanceof Error ? err.message : String(err)}` }
  }
}

// Ambil role + status user dari tabel profiles (via service role).
export async function getProfileRole(userId: string): Promise<{ role: string | null; status: boolean | null }> {
  const { data, error } = await getSupabaseAdmin()
    .from('profiles')
    .select('role, status')
    .eq('id', userId)
    .maybeSingle()

  if (error || !data) return { role: null, status: null }
  return { role: data.role ?? null, status: data.status ?? null }
}
