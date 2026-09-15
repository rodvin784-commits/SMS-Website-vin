'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { AppShell } from '@/components/layout/AppShell'
import { BookOpen, Calendar, ClipboardList, FileText, LayoutDashboard } from 'lucide-react'
import { JadwalMengajar } from '@/components/teacher'

const navItems = [
  { href: '/teacher/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/teacher/mata-pelajaran', icon: BookOpen, label: 'Mata Pelajaran' },
  { href: '/teacher/presensi', icon: ClipboardList, label: 'Presensi Siswa' },
  { href: '/teacher/jadwal', icon: Calendar, label: 'Jadwal Mengajar' },
  { href: '/teacher/nilai', icon: FileText, label: 'Nilai Siswa' },
]

export default function TeacherJadwalPage() {
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
          .select('*')
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
      navItems={navItems}
      onLogout={handleLogout}
      logoIcon={<BookOpen className="h-6 w-6 text-emerald-400" />}
    >
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Jadwal Mengajar</h1>
          <p className="text-sm text-gray-500 mt-1">
            Mata pelajaran yang Anda ampu sepanjang minggu (Senin–Sabtu). Hari ini ditandai hijau.
          </p>
        </div>

        <JadwalMengajar />
      </div>
    </AppShell>
  )
}