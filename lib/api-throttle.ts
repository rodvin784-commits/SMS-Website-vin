import { NextResponse } from 'next/server'

// Throttle server-side sederhana (sliding window, in-memory per proses).
// Melindungi endpoint sensitif milik kita dari spam/abuse (mis. pembuatan akun massal).
// Catatan jujur:
// - Login password (signInWithPassword) jalan langsung browser → Supabase Auth,
//   yang SUDAH menerapkan rate limit server-side sendiri — tidak perlu diduplikasi.
// - Guard localStorage di lib/login-rate-limit.ts tetap dipakai sebagai UX (pesan cepat),
//   bukan sebagai pertahanan.
// - In-memory ini cukup untuk 1 instance. Untuk multi-instance (Vercel scale-out),
//   ganti dengan store terdistribusi (Redis/Upstash) — interface throttle() tetap sama.

type Bucket = number[] // timestamps (ms)

const buckets = new Map<string, Bucket>()
const MAX_KEYS = 5000 // batas memori: evict key terlama

function prune(now: number, windowMs: number, hits: Bucket): Bucket {
  return hits.filter((t) => now - t < windowMs)
}

export function throttle(
  key: string,
  max: number,
  windowMs: number,
  now = Date.now()
): { ok: boolean; retryAfterSec: number } {
  const hits = prune(now, windowMs, buckets.get(key) ?? [])
  if (hits.length >= max) {
    const oldest = Math.min(...hits)
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000)) }
  }
  hits.push(now)
  buckets.set(key, hits)
  if (buckets.size > MAX_KEYS) {
    const oldestKey = buckets.keys().next().value
    if (oldestKey !== undefined) buckets.delete(oldestKey)
  }
  return { ok: true, retryAfterSec: 0 }
}

// Untuk test: reset state (jangan dipakai di production code).
export function __resetThrottleForTest(): void {
  buckets.clear()
}

export function clientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for')
  if (fwd) {
    const first = fwd.split(',')[0]?.trim()
    if (first) return first
  }
  return request.headers.get('x-real-ip')?.trim() || 'unknown'
}

export function throttleResponse(retryAfterSec: number): NextResponse {
  return NextResponse.json(
    { error: 'Terlalu banyak permintaan. Coba lagi beberapa saat.' },
    { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
  )
}
