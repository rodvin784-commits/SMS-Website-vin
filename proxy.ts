import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export default async function proxy(request: NextRequest) {
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
  if (!user && (url.pathname.startsWith('/admin') || url.pathname.startsWith('/teacher'))) {
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: ['/admin/:path*', '/teacher/:path*'],
}
