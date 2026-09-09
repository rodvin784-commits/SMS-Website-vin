'use client'

import { CheckCircle2, AlertCircle } from 'lucide-react'

type FeedbackType = 'success' | 'error'

interface FeedbackMessageProps {
  type: FeedbackType
  message: string
}

export function FeedbackMessage({ type, message }: FeedbackMessageProps) {
  const isSuccess = type === 'success'
  const styles = isSuccess
    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
    : 'bg-red-50 text-red-700 border border-red-200'

  return (
    <div className={`p-4 rounded-xl text-sm font-medium flex items-center space-x-2 ${styles}`}>
      {isSuccess ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
      <span>{message}</span>
    </div>
  )
}
