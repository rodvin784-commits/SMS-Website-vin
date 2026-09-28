'use client'
import { AppShell } from '@/components/layout/AppShell'
import { teacherNavItems } from '@/lib/teacher-nav'
import { BookOpen } from 'lucide-react'
import { PresensiManager } from '@/components/teacher/PresensiManager'
import { useTeacherAuth } from '@/hooks/useTeacherAuth'

export default function TeacherPresensiPage() {
  const { loading, teacherName, handleLogout } = useTeacherAuth()
  if (loading) return <div className="flex min-h-screen items-center justify-center bg-gray-50"><div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div></div>
  return (
    <AppShell role="teacher" userName={teacherName} navItems={teacherNavItems} onLogout={handleLogout} logoIcon={<BookOpen className="h-6 w-6 text-emerald-400" />}>
      <div className="max-w-5xl mx-auto">
        <PresensiManager />
      </div>
    </AppShell>
  )
}
