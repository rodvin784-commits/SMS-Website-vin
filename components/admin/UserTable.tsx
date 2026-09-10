'use client'

import {
  Pencil,
  Trash2,
  RefreshCw,
  Users,
} from 'lucide-react'
import { RoleBadge } from '@/components/ui/Badge'

export type Profile = {
  id: string
  email: string
  nama_lengkap: string | null
  role: string
  status: boolean
  created_at: string
}

interface UserTableProps {
  users: Profile[]
  loading: boolean
  onEdit: (user: Profile) => void
  onDelete: (id: string) => void
  emptyMessage?: string
  showCount?: boolean
}

export function UserTable({
  users,
  loading,
  onEdit,
  onDelete,
  emptyMessage,
  showCount = false,
}: UserTableProps) {
  const defaultEmptyMessage = 'Tidak ada data guru atau siswa ditemukan. Silakan klik tombol "Tambah Pengguna Baru" di atas untuk mendaftarkan akun.'

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-50 mb-4 mx-auto">
            <RefreshCw className="h-8 w-8 text-blue-600 animate-spin" />
          </div>
          <p className="text-gray-500 font-medium">Memuat data pengguna...</p>
        </div>
      </div>
    )
  }

  if (users.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-16 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-50 mb-4">
            <Users className="h-10 w-10 text-gray-300" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">Belum ada data</h3>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            {emptyMessage || defaultEmptyMessage}
          </p>
          {showCount && (
            <div className="mt-4 flex items-center justify-center gap-4 text-xs text-gray-400">
              <span>Total: <strong className="text-gray-600">0</strong> pengguna</span>
              <span>Aktif: <strong className="text-gray-600">0</strong></span>
              <span>Nonaktif: <strong className="text-gray-600">0</strong></span>
            </div>
          )}
        </div>
      </div>
    )
  }

  const formattedUsers = users.map((user) => ({
    ...user,
    nama_lengkap: user.nama_lengkap || 'Tanpa Nama',
    status: user.status !== false,
  }))

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="py-4 px-6 text-xs font-bold text-gray-700 uppercase tracking-wider">
                Pengguna
              </th>
              <th className="py-4 px-6 text-xs font-bold text-gray-700 uppercase tracking-wider">
                Role
              </th>
              <th className="py-4 px-6 text-xs font-bold text-gray-700 uppercase tracking-wider">
                Status
              </th>
              <th className="py-4 px-6 text-xs font-bold text-gray-700 uppercase tracking-wider">
                Tanggal Daftar
              </th>
              <th className="py-4 px-6 text-xs font-bold text-gray-700 uppercase tracking-wider text-right">
                Aksi
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {formattedUsers.map((user, index) => (
              <tr
                key={user.id}
                className="hover:bg-gray-50/80 transition-colors group"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <td className="py-4 px-6">
                  <div className="flex items-center gap-3">
                    <div className={`
                      h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm
                      flex-shrink-0
                      ${user.role === 'guru'
                        ? 'bg-emerald-100 text-emerald-600'
                        : 'bg-purple-100 text-purple-600'
                      }
                    `}>
                      {user.nama_lengkap?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 text-sm">{user.nama_lengkap}</div>
                      <div className="text-xs text-gray-400 truncate max-w-[150px]" title={user.email}>
                        {user.email}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="py-4 px-6">
                  <RoleBadge role={user.role as 'guru' | 'siswa'} />
                </td>
                <td className="py-4 px-6">
                  <span
                    className={`
                      inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold
                      ${user.status
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-gray-100 text-gray-500'
                      }
                    `}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${user.status ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                    {user.status ? 'Aktif' : 'Nonaktif'}
                  </span>
                </td>
                <td className="py-4 px-6 text-gray-500 text-xs font-medium">
                  {formatDate(user.created_at)}
                </td>
                <td className="py-4 px-6">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => onEdit(user)}
                      className="p-2 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                      title="Edit Pengguna"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onDelete(user.id)}
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      title="Hapus Pengguna"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

interface ActionButtonProps {
  onClick: () => void
  icon: React.ReactNode
  label: string
  color: 'blue' | 'purple' | 'red'
}

// Saat ini tidak dipakai; disimpan untuk aksi tambahan per baris di masa depan
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function ActionButton({ onClick, icon, label, color }: ActionButtonProps) {
  const colorStyles = {
    blue: {
      hoverText: 'hover:text-blue-600',
      hoverBg: 'hover:bg-blue-50',
    },
    purple: {
      hoverText: 'hover:text-purple-600',
      hoverBg: 'hover:bg-purple-50',
    },
    red: {
      hoverText: 'hover:text-red-600',
      hoverBg: 'hover:bg-red-50',
    },
  }

  const styles = colorStyles[color]

  return (
    <button
      onClick={onClick}
      className={`
        p-2 text-gray-400 rounded-xl transition-all
        text-xs font-medium px-2 py-1
        ${styles.hoverText} ${styles.hoverBg}
      `}
      title={label}
    >
      {icon}
    </button>
  )
}
