'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { UserPlus, Users, Search, Filter, RefreshCw } from 'lucide-react'
import { FeedbackMessage, Button } from '@/components/ui'
import { useFeedback } from '@/hooks/useFeedback'
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

  // Filter State
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('semua')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

  // Feedback State (auto-dismiss)
  const { feedback, showFeedback } = useFeedback()

  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)

  // Form State
  const [submitting, setSubmitting] = useState(false)
  const [editingUser, setEditingUser] = useState<Profile | null>(null)

  // Fetch stats helper
  const fetchStats = async (currentRole: string): Promise<UserStats> => {
    try {
      const allUsers = await loadUsersFromApi('semua')
      const nonAdminUsers = allUsers.filter(u => u.role !== 'admin')
      const guruUsers = nonAdminUsers.filter(u => u.role === 'guru')
      const siswaUsers = nonAdminUsers.filter(u => u.role === 'siswa')
      const activeUsers = nonAdminUsers.filter(u => u.status !== false)
      const inactiveUsers = nonAdminUsers.filter(u => u.status === false)

      let guruCount = guruUsers.length
      let siswaCount = siswaUsers.length
      if (currentRole === 'guru') {
        guruCount = guruUsers.length
        siswaCount = 0
      } else if (currentRole === 'siswa') {
        guruCount = 0
        siswaCount = siswaUsers.length
      }

      return {
        total: nonAdminUsers.length,
        guru: guruCount,
        siswa: siswaCount,
        active: activeUsers.length,
        inactive: inactiveUsers.length,
      }
    } catch {
      return { total: 0, guru: 0, siswa: 0, active: 0, inactive: 0 }
    }
  }

  // Load users & stats
  useEffect(() => {
    let cancelled = false

    const loadData = async () => {
      try {
        const [usersData, statsData] = await Promise.all([
          loadUsersFromApi(roleFilter),
          fetchStats(roleFilter),
        ])

        if (!cancelled) {
          setUsers(usersData)
          setStats(statsData)
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
    return () => { cancelled = true }
  }, [roleFilter])

  // Refresh data
  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const [usersData, statsData] = await Promise.all([
        loadUsersFromApi(roleFilter),
        fetchStats(roleFilter),
      ])
      setUsers(usersData)
      setStats(statsData)
      showFeedback('success', 'Data berhasil diperbarui')
    } catch (err) {
      showFeedback('error', getErrorMessage(err))
    } finally {
      setRefreshing(false)
    }
  }, [roleFilter, showFeedback])

  const handleCreateUser = useCallback(async (data: {
    nama_lengkap: string
    email: string
    password: string
    role: 'guru' | 'siswa'
    kelas_id: string
  }) => {
    if (!data.email || !data.password || !data.nama_lengkap) {
      showFeedback('error', 'Semua field wajib diisi!')
      return
    }
    if (data.password.length < 6) {
      showFeedback('error', 'Password minimal 6 karakter!')
      return
    }

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
        }),
      })

      const responseJson = await readJson(res)

      if (!res.ok) {
        const errorMsg = responseJson?.error as string || 'Gagal menambahkan pengguna'
        throw new Error(errorMsg)
      }

      showFeedback('success', 'Pengguna berhasil ditambahkan!')
      setIsCreateModalOpen(false)
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
    if (!data.nama_lengkap || !data.email) {
      showFeedback('error', 'Nama dan email wajib diisi!')
      return
    }

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
    } catch (err) {
      showFeedback('error', getErrorMessage(err))
    }
  }, [showFeedback])

  // Filter users by search and status - EXCLUDE ADMIN ACCOUNTS
  const filteredUsers = useMemo(() => {
    const search = searchQuery.toLowerCase()

    return users
      .filter((user) => user.role !== 'admin') // Exclude admin from management
      .filter((user) => {
        const matchesSearch = user.nama_lengkap?.toLowerCase().includes(search) ||
          user.email?.toLowerCase().includes(search)

        // Status filter
        let matchesStatus = true
        if (statusFilter === 'active') {
          matchesStatus = user.status !== false
        } else if (statusFilter === 'inactive') {
          matchesStatus = user.status === false
        }

        return matchesSearch && matchesStatus
      })
  }, [users, searchQuery, statusFilter])

  // Count users by status for filtered results
  const filteredStats = useMemo(() => {
    const filtered = filteredUsers
    return {
      total: filtered.length,
      active: filtered.filter(u => u.status !== false).length,
      inactive: filtered.filter(u => u.status === false).length,
    }
  }, [filteredUsers])

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

          {/* Filters */}
          <div className="flex items-center gap-3">
            {/* Role Filter */}
            <div className="flex items-center space-x-1 bg-gray-100 rounded-xl p-1">
              {(['guru', 'siswa', 'semua'] as const).map((role) => (
                <button
                  key={role}
                  onClick={() => {
                    setRoleFilter(role)
                    setStatusFilter('all')
                  }}
                  className={`
                    px-4 py-2 text-xs font-bold rounded-lg transition-all capitalize
                    ${roleFilter === role
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                    }
                  `}
                >
                  {role === 'semua' ? 'Semua' : role === 'guru' ? 'Guru' : 'Siswa'}
                </button>
              ))}
            </div>

            {/* Status Filter */}
            <div className="flex items-center space-x-1 bg-gray-100 rounded-xl p-1">
              {(['all', 'active', 'inactive'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => {
                    setStatusFilter(status)
                    setRoleFilter(roleFilter) // Keep role filter
                  }}
                  className={`
                    px-4 py-2 text-xs font-bold rounded-lg transition-all
                    ${statusFilter === status
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                    }
                  `}
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

      {/* User Table */}
      <UserTable
        users={filteredUsers}
        loading={loading}
        onEdit={(user) => {
          setEditingUser(user)
          setIsEditModalOpen(true)
        }}
        onDelete={handleDeleteUser}
        showCount={true}
      />

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
