'use client'

import { Search } from 'lucide-react'
import type { MouseEvent } from 'react'

type RoleFilter = 'guru' | 'siswa' | 'semua'

interface UserFiltersProps {
  searchQuery: string
  onSearchChange: (value: string) => void
  roleFilter: RoleFilter
  onRoleFilterChange: (role: RoleFilter) => void
}

export function UserFilters({
  searchQuery,
  onSearchChange,
  roleFilter,
  onRoleFilterChange,
}: UserFiltersProps) {
  const roles: { value: RoleFilter; label: string }[] = [
    { value: 'guru', label: 'GURU' },
    { value: 'siswa', label: 'SISWA' },
    { value: 'semua', label: 'SEMUA' },
  ]

  return (
    <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
      {/* Search */}
      <div className="relative w-full sm:w-96">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Cari nama atau email..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
        />
      </div>

      {/* Role Filter */}
      <div className="flex items-center space-x-2 w-full sm:w-auto">
        {roles.map((role) => (
          <button
            key={role.value}
            onClick={() => onRoleFilterChange(role.value)}
            className={`
              flex-1 sm:flex-none px-4 py-2 text-xs font-bold rounded-xl transition-all
              ${
                roleFilter === role.value
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }
            `}
          >
            {role.label}
          </button>
        ))}
      </div>
    </div>
  )
}
