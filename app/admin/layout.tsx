'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { AppShell } from '@/components/layout/AppShell'
import { ShieldCheck, LayoutDashboard, Users, GraduationCap, BookOpen, Calendar, Building2 } from 'lucide-react'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [adminName, setAdminName] = useState('Administrator')

  useEffect(() => {
    let cancelled = false

    async function checkAdminSession() {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        if (sessionError) {
          console.error('Session error:', sessionError)
          router.replace('/login')
          return
        }

        if (!session) {
          router.replace('/login')
          return
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle()

        if (profileError || !profile) {
          console.error('Profile query error:', profileError)
          await supabase.auth.signOut()
          router.replace('/login')
          return
        }

        if (profile.status === false) {
          await supabase.auth.signOut()
          router.replace('/login')
          return
        }

        if (profile.role !== 'admin') {
          await supabase.auth.signOut()
          router.replace('/login')
          return
        }

        if (!cancelled) {
          const name = profile.nama_lengkap || 'Administrator'
          setAdminName(name)
          setLoading(false)
        }
      } catch (err) {
        console.error('Auth check failed:', err)
        router.replace('/login')
      }
    }

    checkAdminSession()

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
          <p className="text-sm font-medium text-gray-400">Memuat Panel Admin...</p>
        </div>
      </div>
    )
  }

  const navItems = [
    { href: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { href: '/admin/users', icon: Users, label: 'Manajemen Pengguna' },
    { href: '/admin/mata-pelajaran', icon: BookOpen, label: 'Mata Pelajaran' },
    { href: '/admin/jurusan', icon: Building2, label: 'Data Jurusan' },
    { href: '/admin/kelas', icon: GraduationCap, label: 'Data Kelas' },
    { href: '#', icon: Calendar, label: 'Jadwal Pelajaran' },
  ]

  return (
    <AppShell
      role="admin"
      userName={adminName}
      navItems={navItems}
      onLogout={handleLogout}
      logoIcon={<ShieldCheck className="h-6 w-6 text-blue-400" />}
    >
      {children}
    </AppShell>
  )
}
