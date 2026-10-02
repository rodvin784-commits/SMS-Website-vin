import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock NextResponse (throttleResponse menggunakannya)
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body: unknown, init?: { status?: number; headers?: Record<string, string> }) => ({
      status: init?.status ?? 200,
      headers: init?.headers ?? {},
      body,
      json: async () => body,
    })),
  },
}))

import { throttle, throttleResponse, clientIp, __resetThrottleForTest } from '@/lib/api-throttle'

describe('throttle', () => {
  beforeEach(() => __resetThrottleForTest())

  it('mengizinkan hingga batas dalam window', () => {
    for (let i = 0; i < 5; i++) {
      expect(throttle('k1', 5, 60_000, 1000 + i).ok).toBe(true)
    }
  })

  it('memblokir setelah batas dan memberi retryAfter', () => {
    for (let i = 0; i < 5; i++) throttle('k2', 5, 60_000, 1000 + i)
    const r = throttle('k2', 5, 60_000, 2000)
    expect(r.ok).toBe(false)
    expect(r.retryAfterSec).toBeGreaterThan(0)
  })

  it('membuka lagi setelah window berlalu', () => {
    for (let i = 0; i < 5; i++) throttle('k3', 5, 60_000, 1000 + i)
    expect(throttle('k3', 5, 60_000, 2000).ok).toBe(false)
    expect(throttle('k3', 5, 60_000, 1000 + 60_001).ok).toBe(true)
  })

  it('key berbeda dihitung terpisah', () => {
    for (let i = 0; i < 5; i++) throttle('a', 5, 60_000, 1000 + i)
    expect(throttle('b', 5, 60_000, 2000).ok).toBe(true)
  })

  it('throttleResponse mengembalikan 429 + Retry-After', async () => {
    const res = throttleResponse(42)
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error).toMatch(/banyak permintaan/)
  })

  it('clientIp membaca x-forwarded-for pertama', () => {
    const req = new Request('http://x/', { headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' } })
    expect(clientIp(req)).toBe('1.2.3.4')
  })
})
