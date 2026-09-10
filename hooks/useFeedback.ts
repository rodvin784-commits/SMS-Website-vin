'use client'

import { useCallback, useEffect, useState } from 'react'

export type FeedbackType = 'success' | 'error'
export type Feedback = { type: FeedbackType; message: string } | null

// Feedback state dengan auto-dismiss + cleanup timer.
// Pakai satu instance per konteks (mis. feedback tabel vs feedback modal detail).
export function useFeedback(duration = 4000) {
  const [feedback, setFeedback] = useState<Feedback>(null)

  useEffect(() => {
    if (!feedback) return
    const timer = setTimeout(() => setFeedback(null), duration)
    return () => clearTimeout(timer)
  }, [feedback, duration])

  const showFeedback = useCallback(
    (type: FeedbackType, message: string) => {
      setFeedback({ type, message })
    },
    []
  )

  return { feedback, showFeedback, setFeedback }
}
