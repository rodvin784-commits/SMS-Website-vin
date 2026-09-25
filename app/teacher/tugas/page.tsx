'use client'

import { AppShell } from '@/components/layout/AppShell'
import { teacherNavItems } from '@/lib/teacher-nav'
import { BookOpen } from 'lucide-react'
import { TugasManager } from '@/components/teacher'
import { useTeacherAuth } from '@/hooks/useTeacherAuth'

export default function TeacherTugasPage() {
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
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Tugas & Pengumpulan</h1>
          <p className="text-sm text-gray-500 mt-1">
            Buat tugas per kelas yang Anda ampu, pantau pengumpulan, dan unduh file jawaban siswa.
          </p>
        </div>

        <TugasManager />
      </div>
    </AppShell>
  )
}
