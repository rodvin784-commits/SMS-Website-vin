import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock supabase-server sebelum import guru-auth
const mockGetSessionUser = vi.fn()
const mockGetProfileRole = vi.fn()

// Builder chain mock untuk Supabase query builder
type MockChain = {
  select: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  maybeSingle: ReturnType<typeof vi.fn>
  limit: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
  then: undefined
}

function createChainMock(): MockChain {
  const chain = {} as MockChain
  const methods = ['select', 'eq', 'maybeSingle', 'limit', 'order'] as const
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  chain.then = undefined // supaya tidak dianggap Promise
  return chain
}

const mockSupabaseAdmin = {
  from: vi.fn(),
}

vi.mock('@/lib/supabase-server', () => ({
  getSessionUser: (...args: unknown[]) => mockGetSessionUser(...args),
  getProfileRole: (...args: unknown[]) => mockGetProfileRole(...args),
  getSupabaseAdmin: () => mockSupabaseAdmin,
}))

import { guruAuth, isAssigned } from '@/lib/guru-auth'

describe('guruAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('mengembalikan 401 jika user belum login', async () => {
    mockGetSessionUser.mockResolvedValue(null)

    const result = await guruAuth()
    expect(result).toEqual({ ok: false, status: 401, error: 'Belum login.' })
  })

  it('mengembalikan 403 jika role bukan guru', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'user-1' })
    mockGetProfileRole.mockResolvedValue({ role: 'siswa', status: true })

    const result = await guruAuth()
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(403)
    }
  })

  it('mengembalikan 403 jika status guru tidak aktif', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'user-2' })
    mockGetProfileRole.mockResolvedValue({ role: 'guru', status: false })

    const result = await guruAuth()
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(403)
    }
  })

  it('mengembalikan ok:true dengan userId dan guruId jika valid', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'user-3' })
    mockGetProfileRole.mockResolvedValue({ role: 'guru', status: true })

    const chain = createChainMock()
    chain.maybeSingle = vi.fn().mockResolvedValue({
      data: { id: 'guru-100' },
      error: null,
    })
    chain.select.mockReturnValue(chain)
    chain.eq.mockReturnValue(chain)
    mockSupabaseAdmin.from.mockReturnValue(chain)

    const result = await guruAuth()
    expect(result).toEqual({ ok: true, userId: 'user-3', guruId: 'guru-100' })
  })

  it('mengembalikan 403 jika data guru tidak ditemukan', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'user-4' })
    mockGetProfileRole.mockResolvedValue({ role: 'guru', status: true })

    const chain = createChainMock()
    chain.maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    })
    chain.select.mockReturnValue(chain)
    chain.eq.mockReturnValue(chain)
    mockSupabaseAdmin.from.mockReturnValue(chain)

    const result = await guruAuth()
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(403)
      expect(result.error).toContain('Data guru tidak ditemukan')
    }
  })

  it('mengembalikan 400 jika query guru error', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'user-5' })
    mockGetProfileRole.mockResolvedValue({ role: 'guru', status: true })

    const chain = createChainMock()
    chain.maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'relation "guru" does not exist' },
    })
    chain.select.mockReturnValue(chain)
    chain.eq.mockReturnValue(chain)
    mockSupabaseAdmin.from.mockReturnValue(chain)

    const result = await guruAuth()
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(400)
    }
  })
})

describe('isAssigned', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('mengembalikan true jika ada baris guru_kelas yang cocok', async () => {
    const chain = createChainMock()
    chain.limit = vi.fn().mockResolvedValue({
      data: [{ id: 'gk-1' }],
      error: null,
    })
    chain.select.mockReturnValue(chain)
    chain.eq.mockReturnValue(chain)
    mockSupabaseAdmin.from.mockReturnValue(chain)

    const result = await isAssigned('guru-1', 'mapel-1', 'kelas-1')
    expect(result).toBe(true)
  })

  it('mengembalikan false jika tidak ada baris yang cocok', async () => {
    const chain = createChainMock()
    chain.limit = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    })
    chain.select.mockReturnValue(chain)
    chain.eq.mockReturnValue(chain)
    mockSupabaseAdmin.from.mockReturnValue(chain)

    const result = await isAssigned('guru-1', 'mapel-99', 'kelas-1')
    expect(result).toBe(false)
  })

  it('mengembalikan false jika query error', async () => {
    const chain = createChainMock()
    chain.limit = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'connection refused' },
    })
    chain.select.mockReturnValue(chain)
    chain.eq.mockReturnValue(chain)
    mockSupabaseAdmin.from.mockReturnValue(chain)

    const result = await isAssigned('guru-1', 'mapel-1', 'kelas-1')
    expect(result).toBe(false)
  })
})
