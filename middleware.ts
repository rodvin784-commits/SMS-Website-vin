import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Origin aplikasi mobile (APK siswa). Isi NEXT_PUBLIC_MOBILE_ORIGIN di .env.local,
// mis. "capacitor://localhost,http://localhost" (dipisah koma untuk beberapa origin).
const MOBILE_ORIGINS = (process.env.NEXT_PUBLIC_MOBILE_ORIGIN ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

function buildCorsHeaders(origin: string | null): Record<string, string> {
  // Tanpa origin (native non-WebView) -> lolos: bukan konteks browser, tidak ada
  // credentials web yang bisa dicuri. Dengan origin -> hanya whitelist yang boleh.
  if (!origin || MOBILE_ORIGINS.length === 0) return {}
  if (MOBILE_ORIGINS.includes(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    }
  }
  return {}
}

export default async function middleware(request: NextRequest) {
  const cors = buildCorsHeaders(request.headers.get('origin'))

  // Preflight dari WebView mobile.
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: cors })
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

  // Jika belum login dan mencoba masuk ke halaman admin atau teacher, lempar ke login
  if (
    !user &&
    (url.pathname.startsWith('/admin') ||
      url.pathname.startsWith('/teacher'))
  ) {
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Tempel header CORS ke response API siswa.
  if (url.pathname.startsWith('/api/siswa') && Object.keys(cors).length > 0) {
    for (const [key, value] of Object.entries(cors)) {
      response.headers.set(key, value)
    }
  }

  return response
}

export const config = {
  // /api/siswa masuk matcher agar preflight OPTIONS bisa ditangani middleware.
  matcher: ['/admin/:path*', '/teacher/:path*', '/api/siswa/:path*'],
}
