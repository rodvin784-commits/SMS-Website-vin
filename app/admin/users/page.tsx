'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { UserPlus, Users, Search, Filter, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react'
import { FeedbackMessage, Button } from '@/components/ui'
import { useFeedback } from '@/hooks/useFeedback'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { validateUserCreate, validateUserEdit } from '@/lib/user-validation'
import { UserTable, CreateUserModal, EditUserModal } from '@/components/admin'
import type { Profile } from '@/components/admin/UserTable'

type RoleFilter = 'guru' | 'siswa' | 'semua'

interface UserStats {
  total: number
  guru: number
  siswa: number
  active: number
  inactive: number
}

const getErrorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : 'Terjadi kesalahan sistem'

const readJson = async (res: Response): Promise<Record<string, unknown> | null> => {
  const text = await res.text()
  if (!text || text.trim() === '') return null
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    return null
  }
}

const loadUsersFromApi = async (role: string): Promise<Profile[]> => {
  const params = new URLSearchParams()
  if (role !== 'semua') params.set('role', role)

  const query = params.toString()
  const res = await fetch(`/api/admin/users${query ? `?${query}` : ''}`)

  if (!res.ok) {
    const errorData = await readJson(res)
    throw new Error(errorData?.error as string || `HTTP Error: ${res.status}`)
  }

  const data = await readJson(res)
  return Array.isArray(data) ? (data as Profile[]) : []
}

export default function AdminUsersPage() {
  // Data State
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [stats, setStats] = useState<UserStats>({ total: 0, guru: 0, siswa: 0, active: 0, inactive: 0 })
  const [refreshKey, setRefreshKey] = useState(0)

  // Filter State
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearch = useDebouncedValue(searchQuery, 300)
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('semua')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  // Pagination client-side (cukup untuk 200-500 user, server guard limit 200)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 20

  // Feedback State (auto-dismiss)
  const { feedback, showFeedback } = useFeedback()

  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)

  // Form State
  const [submitting, setSubmitting] = useState(false)
  const [editingUser, setEditingUser] = useState<Profile | null>(null)

  // Stats global (selalu dari semua user, bukan yang ter-filter) agar card TOTAL/GURU/SISWA tidak jadi 0 saat filter aktif
  const computeStats = (list: Profile[]): UserStats => {
    const nonAdmin = list.filter((u) => u.role !== 'admin')
    return {
      total: nonAdmin.length,
      guru: nonAdmin.filter((u) => u.role === 'guru').length,
      siswa: nonAdmin.filter((u) => u.role === 'siswa').length,
      active: nonAdmin.filter((u) => u.status !== false).length,
      inactive: nonAdmin.filter((u) => u.status === false).length,
    }
  }

  // Load users — single fetch 'semua' lalu filter role di client agar instant & stats global benar
  useEffect(() => {
    let cancelled = false
    const loadData = async () => {
      try {
        const allData = await loadUsersFromApi('semua')
        if (!cancelled) {
          setUsers(allData)
          setStats(computeStats(allData))
        }
      } catch (err) {
        console.error('Error loading data:', err)
        if (!cancelled) {
          setUsers([])
          setStats({ total: 0, guru: 0, siswa: 0, active: 0, inactive: 0 })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadData()
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  // Refresh — fetch semua lagi
  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const allData = await loadUsersFromApi('semua')
      setUsers(allData)
      setStats(computeStats(allData))
      showFeedback('success', 'Data berhasil diperbarui')
    } catch (err) {
      showFeedback('error', getErrorMessage(err))
    } finally {
      setRefreshing(false)
    }
  }, [showFeedback])

  const handleCreateUser = useCallback(async (data: {
    nama_lengkap: string
    email: string
    password: string
    role: 'guru' | 'siswa'
    kelas_id: string
    nip?: string
    nis?: string
  }) => {
    const v = validateUserCreate({ nama_lengkap: data.nama_lengkap, email: data.email, password: data.password, role: data.role, nis: data.nis, kelas_id: data.kelas_id })
    if (v) { showFeedback('error', v); return }

    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nama_lengkap: data.nama_lengkap,
          email: data.email,
          password: data.password,
          role: data.role,
          kelas_id: data.role === 'siswa' ? (data.kelas_id || null) : null,
          nip: data.role === 'guru' ? (data.nip || null) : null,
          nis: data.role === 'siswa' ? (data.nis || null) : null,
        }),
      })

      const responseJson = await readJson(res)

      if (!res.ok) {
        const errorMsg = responseJson?.error as string || 'Gagal menambahkan pengguna'
        throw new Error(errorMsg)
      }

      showFeedback('success', 'Pengguna berhasil ditambahkan!')
      setIsCreateModalOpen(false)
      setRefreshKey(k => k + 1)
    } catch (err) {
      showFeedback('error', getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }, [showFeedback])

  const handleUpdateUser = useCallback(async (data: {
    id: string
    nama_lengkap: string
    email: string
    role: 'guru' | 'siswa'
    status: boolean
    password?: string
    kelas_id: string
  }) => {
    if (!data.id) {
      showFeedback('error', 'Data pengguna tidak valid!')
      return
    }
    const v = validateUserEdit({ nama_lengkap: data.nama_lengkap, email: data.email, password: data.password })
    if (v) { showFeedback('error', v); return }

    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      const responseJson = await readJson(res)

      if (!res.ok) {
        const errorMsg = responseJson?.error as string || 'Gagal memperbarui pengguna'
        throw new Error(errorMsg)
      }

      showFeedback('success', data.password ? 'Data & password pengguna berhasil diperbarui!' : 'Data pengguna berhasil diperbarui!')
      setIsEditModalOpen(false)
      setRefreshKey(k => k + 1)
    } catch (err) {
      showFeedback('error', getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }, [showFeedback])

  const handleDeleteUser = useCallback(async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus pengguna ini? Tindakan ini tidak dapat dibatalkan.')) return

    try {
      const res = await fetch(`/api/admin/users?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })

      const responseJson = await readJson(res)

      if (!res.ok) {
        const errorMsg = responseJson?.error as string || 'Gagal menghapus pengguna'
        throw new Error(errorMsg)
      }

      showFeedback('success', 'Pengguna berhasil dihapus!')
      setRefreshKey(k => k + 1)
    } catch (err) {
      showFeedback('error', getErrorMessage(err))
    }
  }, [showFeedback])

  // Filter client-side instant (role + search + status) — pakai debouncedSearch agar tidak re-filter tiap keystroke
  const filteredUsers = useMemo(() => {
    const search = debouncedSearch.toLowerCase().trim()
    return users
      .filter((user) => user.role !== 'admin')
      .filter((user) => {
        if (roleFilter !== 'semua' && user.role !== roleFilter) return false
        const matchesSearch =
          !search ||
          user.nama_lengkap?.toLowerCase().includes(search) ||
          user.email?.toLowerCase().includes(search) ||
          user.nip?.toLowerCase().includes(search) ||
          user.nis?.toLowerCase().includes(search) ||
          (user as unknown as { kelas_nama?: string | null }).kelas_nama?.toLowerCase().includes(search)
        if (!matchesSearch) return false
        if (statusFilter === 'active') return user.status !== false
        if (statusFilter === 'inactive') return user.status === false
        return true
      })
  }, [users, debouncedSearch, statusFilter, roleFilter])

  // Count users by status for filtered results
  const filteredStats = useMemo(() => {
    const filtered = filteredUsers
    return {
      total: filtered.length,
      active: filtered.filter(u => u.status !== false).length,
      inactive: filtered.filter(u => u.status === false).length,
    }
  }, [filteredUsers])

  // Reset page saat filter/search berubah
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setCurrentPage(1) }, [debouncedSearch, roleFilter, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize))
  const pagedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredUsers.slice(start, start + pageSize)
  }, [filteredUsers, currentPage])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg">
              <Users className="h-5 w-5 text-white" />
            </div>
            Manajemen Pengguna
          </h1>
          <p className="text-sm text-gray-600 mt-1.5 ml-14">
            Kelola akun Guru dan Siswa yang terdaftar dalam sistem sekolah.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            onClick={handleRefresh}
            loading={refreshing}
            disabled={loading}
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => setIsCreateModalOpen(true)} size="lg">
            <UserPlus className="h-4 w-4" />
            <span>Tambah Pengguna Baru</span>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total</span>
            <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-gray-900">{stats.total}</p>
          <p className="text-xs text-gray-400 mt-1">Pengguna terdaftar</p>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Guru</span>
            <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600">
              <span className="text-lg">👨‍🏫</span>
            </div>
          </div>
          <p className="text-2xl font-black text-gray-900">{stats.guru}</p>
          <p className="text-xs text-gray-400 mt-1">Akun guru</p>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Siswa</span>
            <div className="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center text-purple-600">
              <span className="text-lg">🎓</span>
            </div>
          </div>
          <p className="text-2xl font-black text-gray-900">{stats.siswa}</p>
          <p className="text-xs text-gray-400 mt-1">Akun siswa</p>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Aktif</span>
            <div className="h-8 w-8 rounded-lg bg-green-100 flex items-center justify-center text-green-600">
              <Filter className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-gray-900">{filteredStats.active}</p>
          <p className="text-xs text-gray-400 mt-1">Status aktif</p>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Nonaktif</span>
            <div className="h-8 w-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400">
              <Filter className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-gray-900">{filteredStats.inactive}</p>
          <p className="text-xs text-gray-400 mt-1">Status nonaktif</p>
        </div>
      </div>

      {/* Feedback Message */}
      {feedback && (
        <FeedbackMessage type={feedback.type} message={feedback.message} />
      )}

      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Search */}
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cari nama atau email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          {/* Filters — minimalis profesional: role & status tidak saling reset, aktif lebih kontras */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Role Filter */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
              {(['semua', 'guru', 'siswa'] as const).map((role) => (
                <button
                  key={role}
                  aria-pressed={roleFilter === role}
                  onClick={() => setRoleFilter(role)}
                  className={`px-4 py-2 text-xs font-bold rounded-lg transition-all capitalize ${roleFilter === role ? 'bg-white text-blue-600 shadow-sm ring-1 ring-blue-100' : 'text-gray-500 hover:text-gray-700 hover:bg-white/60'}`}
                >
                  {role === 'semua' ? 'Semua' : role === 'guru' ? 'Guru' : 'Siswa'}
                </button>
              ))}
            </div>
            <span className="hidden sm:block h-6 w-px bg-gray-200" />
            {/* Status Filter */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
              {(['all', 'active', 'inactive'] as const).map((status) => (
                <button
                  key={status}
                  aria-pressed={statusFilter === status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${statusFilter === status ? 'bg-white text-emerald-600 shadow-sm ring-1 ring-emerald-100' : 'text-gray-500 hover:text-gray-700 hover:bg-white/60'}`}
                >
                  {status === 'all' ? 'Semua Status' : status === 'active' ? 'Aktif' : 'Nonaktif'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Filter Info */}
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-400">
          <span>Menampilkan <strong className="text-gray-600">{filteredStats.total}</strong> dari <strong className="text-gray-600">{stats.total}</strong> pengguna</span>
          {searchQuery && <span>Pencarian: &ldquo;{searchQuery}&rdquo;</span>}
        </div>
      </div>

      {/* User Table (paginated 20) */}
      <UserTable
        users={pagedUsers}
        loading={loading}
        onEdit={(user) => {
          setEditingUser(user)
          setIsEditModalOpen(true)
        }}
        onDelete={handleDeleteUser}
        showCount={true}
      />
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white rounded-xl p-3 border border-gray-100">
          <span className="text-xs text-gray-500">Halaman {currentPage} / {totalPages} · {filteredStats.total} hasil</span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>
              <ChevronLeft className="h-4 w-4" /> Prev
            </Button>
            <Button variant="secondary" size="sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      <CreateUserModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateUser}
        submitting={submitting}
      />

      {/* Edit User Modal */}
      <EditUserModal
        isOpen={isEditModalOpen}
        user={editingUser}
        onClose={() => {
          setIsEditModalOpen(false)
          setEditingUser(null)
        }}
        onSubmit={handleUpdateUser}
        submitting={submitting}
      />
    </div>
  )
}
