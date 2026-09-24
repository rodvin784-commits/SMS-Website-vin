import { NextResponse } from 'next/server'

// Helper bersama untuk semua route admin.
// Konvensi:
// - 401/403 ditangani adminCheck() + denyResponse()
// - 400 untuk error database / validasi (ikutkan pesan Supabase)
// - 500 untuk error tak terduga, detail ditulis ke console

export function denyResponse(status = 403) {
  return NextResponse.json(
    { error: 'Tidak diizinkan. Hanya admin yang dapat mengakses data ini.' },
    { status }
  )
}

// Bungkus error tak terduga: log dengan konteks, balikan pesan aman (jangan bocorkan err.message ke client).
export function serverError(err: unknown, context: string) {
  console.error(context, err)
  return NextResponse.json(
    { error: 'Terjadi kesalahan server. Silakan coba lagi.' },
    { status: 500 }
  )
}
