import { describe, it, expect, vi } from 'vitest'

// Mock NextResponse
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      body,
      json: async () => body,
    })),
  },
}))

import { serverError, denyResponse } from '@/lib/api-admin'

describe('serverError', () => {
  it('mengembalikan status 500 dengan pesan aman (tidak bocorkan detail)', async () => {
    const err = new Error('Koneksi database gagal')
    const response = serverError(err, 'test-context')

    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toBe('Terjadi kesalahan server. Silakan coba lagi.')
  })

  it('mengembalikan pesan aman untuk error non-Error', async () => {
    const response = serverError('string-error', 'test-context')

    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toBe('Terjadi kesalahan server. Silakan coba lagi.')
  })

  it('mengembalikan pesan aman untuk null', async () => {
    const response = serverError(null, 'test-context')

    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toBe('Terjadi kesalahan server. Silakan coba lagi.')
  })
})

describe('denyResponse', () => {
  it('mengembalikan 403 secara default', () => {
    const response = denyResponse()
    expect(response.status).toBe(403)
  })

  it('mengembalikan status custom jika diberikan', () => {
    const response = denyResponse(401)
    expect(response.status).toBe(401)
  })
})
