'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { AppShell } from '@/components/layout/AppShell'
import { teacherNavItems } from '@/lib/teacher-nav'
import { BookOpen } from 'lucide-react'
import { NilaiManager } from '@/components/teacher'

export default function TeacherNilaiPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [teacherName, setTeacherName] = useState('Guru')

  useEffect(() => {
    let cancelled = false

    async function checkTeacherSession() {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        if (sessionError || !session) {
          router.replace('/login')
          return
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('nama_lengkap, role, status')
          .eq('id', session.user.id)
          .maybeSingle()

        if (profileError || !profile || profile.status === false || profile.role !== 'guru') {
          await supabase.auth.signOut()
          router.replace('/login')
          return
        }

        if (!cancelled) {
          setTeacherName(profile.nama_lengkap || 'Guru')
          setLoading(false)
        }
      } catch (err) {
        console.error('Auth check failed:', err)
        router.replace('/login')
      }
    }

    checkTeacherSession()

    return () => {
      cancelled = true
    }
  }, [router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.replace('/login')
  }

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
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Nilai Siswa</h1>
          <p className="text-sm text-gray-500 mt-1">
            Input nilai Tugas, UTS, UAS per semester dan lihat nilai akhir (rapor).
          </p>
        </div>

        <NilaiManager />
      </div>
    </AppShell>
  )
}
