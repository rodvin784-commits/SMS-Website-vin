'use client'

import { CheckCircle2, AlertCircle, Info } from 'lucide-react'

type FeedbackType = 'success' | 'error' | 'info'

interface FeedbackMessageProps {
  type: FeedbackType
  message: string
}

export function FeedbackMessage({ type, message }: FeedbackMessageProps) {
  const styles =
    type === 'success'
      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
      : type === 'info'
        ? 'bg-blue-50 text-blue-800 border border-blue-200'
        : 'bg-red-50 text-red-700 border border-red-200'

  return (
    <div className={`p-4 rounded-xl text-sm font-medium flex items-center space-x-2 ${styles}`}>
      {type === 'success' ? <CheckCircle2 className="h-5 w-5" /> : type === 'info' ? <Info className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
      <span>{message}</span>
    </div>
  )
}
