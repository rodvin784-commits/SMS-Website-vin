'use client'

import { AppShell } from '@/components/layout/AppShell'
import { teacherNavItems } from '@/lib/teacher-nav'
import { BookOpen } from 'lucide-react'
import { PengumumanManager } from '@/components/teacher'
import { useTeacherAuth } from '@/hooks/useTeacherAuth'

export default function TeacherPengumumanPage() {
  const { loading, teacherName, handleLogout } = useTeacherAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900 text-white">
        <div className="flex flex-col items-center space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
          <p className="text-sm font-medium text-gray-400">Memuat Panel Guru...</p>
        </div>
      </div>
    )
  }

  return (
    <AppShell
      role="teacher"
      userName={teacherName}
      navItems={teacherNavItems}
      onLogout={handleLogout}
      logoIcon={<BookOpen className="h-6 w-6 text-emerald-400" />}
    >
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Pengumuman</h1>
          <p className="text-sm text-gray-500 mt-1">
            Kirim pengumuman ke kelas-kelas yang Anda ampu.
          </p>
        </div>

        <PengumumanManager />
      </div>
    </AppShell>
  )
}
