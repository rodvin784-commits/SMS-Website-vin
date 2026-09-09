'use client'

import { Shield, GraduationCap, CheckCircle2, AlertCircle, BookOpen } from 'lucide-react'

type BadgeVariant = 'success' | 'error' | 'warning' | 'info' | 'gray'
type RoleType = 'guru' | 'siswa'

interface BadgeProps {
  variant?: BadgeVariant
  children: React.ReactNode
  icon?: 'shield' | 'graduation' | 'check' | 'alert' | 'book' | React.ReactNode
  size?: 'sm' | 'md'
}

const variantStyles = {
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  error: 'bg-red-50 text-red-700 border-red-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  info: 'bg-blue-50 text-blue-700 border-blue-200',
  gray: 'bg-gray-100 text-gray-500',
}

const iconMap = {
  shield: <Shield className="h-3 w-3" />,
  graduation: <GraduationCap className="h-3 w-3" />,
  check: <CheckCircle2 className="h-5 w-5" />,
  alert: <AlertCircle className="h-5 w-5" />,
  book: <BookOpen className="h-4 w-4" />,
}

export function Badge({ variant = 'gray', children, icon, size = 'md' }: BadgeProps) {
  const iconElement = typeof icon === 'string' ? iconMap[icon as keyof typeof iconMap] : icon

  const sizeClass = size === 'sm' ? 'px-3 py-1 text-xs' : 'px-2.5 py-1 text-xs'

  return (
    <span
      className={`
        inline-flex items-center space-x-1.5 rounded-full font-bold
        ${sizeClass}
        ${variantStyles[variant]}
      `}
    >
      {iconElement && <span>{iconElement}</span>}
      <span>{children}</span>
    </span>
  )
}

interface RoleBadgeProps {
  role: RoleType
  size?: 'sm' | 'md'
}

export function RoleBadge({ role, size = 'sm' }: RoleBadgeProps) {
  const isGuru = role === 'guru'
  return (
    <Badge
      variant={isGuru ? 'success' : 'info'}
      icon={isGuru ? 'shield' : 'graduation'}
      size={size}
    >
      {role.toUpperCase()}
    </Badge>
  )
}
