'use client'
// StatCard — Kartu angka ringkas (dipakai admin & guru dashboard).

import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  icon: LucideIcon
  label: string
  value: string | number
  variant?: 'blue' | 'emerald' | 'purple' | 'amber'
  delay?: number
  hint?: string | null // teks konteks kecil di bawah angka, mis: "Perlu dinilai"
}

const variantStyles = {
  blue: { bg: 'bg-blue-50', text: 'text-blue-600' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-600' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-600' },
}

export function StatCard({ icon: Icon, label, value, variant = 'blue', delay = 0, hint }: StatCardProps) {
  const styles = variantStyles[variant]

  return (
    <div
      className="bg-white px-4 py-3.5 rounded-2xl shadow-sm border border-gray-200 flex items-center gap-3.5"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={`h-10 w-10 shrink-0 rounded-xl ${styles.bg} ${styles.text} flex items-center justify-center font-bold`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-gray-600 normal-case tracking-normal leading-tight">{label}</p>
        <p className="text-xl font-extrabold text-gray-900 leading-tight mt-0.5">{value}</p>
        {hint && <p title={hint} className="text-[11px] font-medium text-gray-500 leading-tight mt-0.5 whitespace-nowrap">{hint}</p>}
      </div>
    </div>
  )
}
