'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// DRY: ganti 7 duplikat checkTeacherSession() di app/teacher/*/page.tsx
export function useTeacherAuth() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [guruId, setGuruId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function init() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          if (!cancelled) router.replace('/login')
          return
        }
        const { data: profile } = await supabase
          .from('profiles')
          .select('role,status')
          .eq('id', session.user.id)
          .maybeSingle()
        if (!profile || profile.role !== 'guru' || profile.status === false) {
          await supabase.auth.signOut()
          if (!cancelled) router.replace('/login')
          return
        }
        if (!cancelled) {
          // resolve guruId via API atau langsung select
          const { data: guru } = await supabase.from('guru').select('id').eq('profile_id', session.user.id).maybeSingle()
          setGuruId((guru as { id: string } | null)?.id ?? null)
        }
      } catch (e) {
        console.error('useTeacherAuth:', e)
        if (!cancelled) router.replace('/login')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void init()
    return () => { cancelled = true }
  }, [router])

  return { loading, guruId }
}
