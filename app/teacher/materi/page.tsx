'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { AppShell } from '@/components/layout/AppShell'
import { teacherNavItems } from '@/lib/teacher-nav'
import { BookOpen, FileText, Video } from 'lucide-react'
import { MateriAjarManager, VideoMateriManager } from '@/components/teacher'

type Tab = 'materi' | 'video'

export default function TeacherMateriPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [teacherName, setTeacherName] = useState('Guru')
  const [tab, setTab] = useState<Tab>('materi')

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
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Materi & Video</h1>
          <p className="text-sm text-gray-500 mt-1">
            Bagikan materi (file/dokumen) dan video pembelajaran ke kelas yang Anda ampu.
          </p>
        </div>

        {/* Tab Materi / Video */}
        <div className="flex gap-2">
          <button
            onClick={() => setTab('materi')}
            className={`
              inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold border transition-all
              ${tab === 'materi' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}
            `}
          >
            <FileText className="h-4 w-4" />
            Materi (File)
          </button>
          <button
            onClick={() => setTab('video')}
            className={`
              inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold border transition-all
              ${tab === 'video' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}
            `}
          >
            <Video className="h-4 w-4" />
            Video Pembelajaran
          </button>
        </div>

        {tab === 'materi' ? <MateriAjarManager /> : <VideoMateriManager />}
      </div>
    </AppShell>
  )
}
