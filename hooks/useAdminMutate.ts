'use client'
import { useCallback, useState } from 'react'
import { useFeedback } from '@/hooks/useFeedback'

// DRY: ganti 3x duplikat handleCreate/Update/Delete di tiap Manager (Kelas, Jurusan, Mapel)
// fetch + feedback + refreshKey
type Method = 'POST' | 'PUT' | 'DELETE'
export function useAdminMutate(apiPath: string, onSuccess?: () => void) {
  const [submitting, setSubmitting] = useState(false)
  const { feedback, showFeedback, setFeedback } = useFeedback()

  const mutate = useCallback(async (method: Method, body?: unknown, query?: string) => {
    setSubmitting(true)
    setFeedback(null)
    try {
      const res = await fetch(query ? `${apiPath}${query}` : apiPath, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      })
      const result = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(result.error || 'Gagal memproses permintaan')
      showFeedback('success', result.message || 'Berhasil')
      onSuccess?.()
      return result
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Terjadi kesalahan')
      throw err
    } finally {
      setSubmitting(false)
    }
  }, [apiPath, onSuccess, showFeedback, setFeedback])

  return { submitting, feedback, showFeedback, setFeedback, mutate }
}
