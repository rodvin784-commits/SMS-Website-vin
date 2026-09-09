'use client'

import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  icon: LucideIcon
  label: string
  value: string | number
  variant?: 'blue' | 'emerald' | 'purple' | 'amber'
  delay?: number
}

const variantStyles = {
  blue: { bg: 'bg-blue-50', text: 'text-blue-600' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-600' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-600' },
}

export function StatCard({ icon: Icon, label, value, variant = 'blue', delay = 0 }: StatCardProps) {
  const styles = variantStyles[variant]

  return (
    <div
      className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex items-center space-x-4"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={`h-12 w-12 rounded-xl ${styles.bg} ${styles.text} flex items-center justify-center font-bold`}>
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-black text-gray-900 mt-0.5">{value}</p>
      </div>
    </div>
  )
}
