import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Origin aplikasi mobile (APK siswa). Isi NEXT_PUBLIC_MOBILE_ORIGIN di .env.local,
// mis. "capacitor://localhost,http://localhost" (dipisah koma untuk beberapa origin).
const MOBILE_ORIGINS = (process.env.NEXT_PUBLIC_MOBILE_ORIGIN ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

function buildCorsHeaders(origin: string | null): Record<string, string> | null {
  // Tanpa origin (same-origin / curl / native non-WebView tanpa Origin header) -> lolos
  if (!origin) return {}
  // Fail-closed: jika whitelist kosong tapi ada Origin cross-site -> blokir (misconfig produksi)
  if (MOBILE_ORIGINS.length === 0) {
    console.warn('CORS: NEXT_PUBLIC_MOBILE_ORIGIN kosong, blokir Origin', origin)
    return null
  }
  if (MOBILE_ORIGINS.includes(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    }
  }
  // Origin tidak ada di whitelist -> blokir
  return null
}

export default async function middleware(request: NextRequest) {
  const origin = request.headers.get('origin')
  const cors = buildCorsHeaders(origin)

  // Fail-closed CORS: blokir preflight / API siswa dari origin tidak whitelisted
  if (request.nextUrl.pathname.startsWith('/api/siswa') && cors === null) {
    return new NextResponse(JSON.stringify({ error: 'Origin tidak diizinkan (CORS)' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Preflight dari WebView mobile.
  if (request.method === 'OPTIONS') {
    if (cors === null) {
      return new NextResponse(JSON.stringify({ error: 'Origin tidak diizinkan (CORS)' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return new NextResponse(null, { status: 204, headers: cors ?? {} })
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getUser() memverifikasi token ke server Auth (lebih aman daripada getSession).
  const { data: { user }, error: sessionError } = await supabase.auth.getUser()
  const url = request.nextUrl.clone()

  if (sessionError) {
    console.error('Proxy session error:', sessionError.message)
  }

  // Jika belum login: admin → /admin/login, teacher → /login (pisah sesuai permintaan)
  if (!user) {
    if (url.pathname.startsWith('/admin') && url.pathname !== '/admin/login') {
      url.pathname = '/admin/login'
      return NextResponse.redirect(url)
    }
    if (url.pathname.startsWith('/teacher')) {
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }
  }

  // Role guard: pisah login admin vs guru
  // Biarkan /admin/login dan /login bisa diakses semua (untuk ganti akun)
  if (user && (url.pathname.startsWith('/admin') || url.pathname.startsWith('/teacher'))) {
    if (url.pathname === '/admin/login' || url.pathname === '/login') return response
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    const role = (profile as { role: string } | null)?.role
    if (url.pathname.startsWith('/admin') && role !== 'admin') {
      url.pathname = role === 'guru' ? '/teacher' : '/login'
      return NextResponse.redirect(url)
    }
    if (url.pathname.startsWith('/teacher') && role !== 'guru') {
      // admin tidak boleh masuk teacher (pisah total), guru only
      url.pathname = role === 'admin' ? '/admin/dashboard' : '/login'
      return NextResponse.redirect(url)
    }
  }

  // Tempel header CORS ke response API siswa.
  if (url.pathname.startsWith('/api/siswa') && cors && Object.keys(cors).length > 0) {
    for (const [key, value] of Object.entries(cors)) {
      response.headers.set(key, value)
    }
  }

  return response
}

export const config = {
  // /api/* masuk matcher agar preflight OPTIONS & admin guard konsisten
  matcher: ['/admin/:path*', '/teacher/:path*', '/api/siswa/:path*', '/api/admin/:path*'],
}
