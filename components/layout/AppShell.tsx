'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  Menu,
  X,
  LogOut,
  ShieldCheck,
  GraduationCap as GraduationCapIcon,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type NavItem = {
  href: string
  icon: LucideIcon
  label: string
}

type UserRole = 'admin' | 'teacher' | 'siswa'

interface AppShellProps {
  role: UserRole
  userName: string
  navItems: NavItem[]
  children: React.ReactNode
  onLogout: () => void
  logoIcon?: React.ReactNode
  initialColor?: string
}

export function AppShell({
  role,
  userName,
  navItems,
  children,
  onLogout,
  logoIcon,
}: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()

  const isAdmin = role === 'admin'
  const panelLabel =
    role === 'admin' ? 'Admin Panel' : role === 'teacher' ? 'Panel Guru' : 'Portal Siswa'
  const defaultLogoIcon = isAdmin ? (
    <ShieldCheck className="h-6 w-6 text-blue-400" />
  ) : (
    <GraduationCapIcon className="h-6 w-6 text-emerald-400" />
  )

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static flex flex-col
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex h-16 items-center justify-between px-6 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            {logoIcon || defaultLogoIcon}
            <span className="font-bold text-lg tracking-wide">
              {panelLabel}
            </span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-gray-400 hover:text-white"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {navItems.map((item, index) => {
            const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)

            return (
              <Link
                key={`${item.href}-${index}`}
                href={item.href === '#' ? '#' : item.href}
                className={`
                  flex items-center space-x-3 px-4 py-3 rounded-xl font-medium text-sm transition-colors
                  ${
                    isActive
                      ? isAdmin
                        ? 'bg-blue-600 text-white'
                        : 'bg-emerald-600 text-white'
                      : 'text-gray-400 hover:bg-slate-800 hover:text-white'
                  }
                `}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-xl bg-red-600/10 text-red-400 hover:bg-red-600 hover:text-white font-medium text-sm transition-all"
          >
            <LogOut className="h-4 w-4" />
            <span>Keluar Sistem</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm z-10">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-gray-600 hover:text-gray-900"
          >
            <Menu className="h-6 w-6" />
          </button>

          <div className="flex items-center space-x-3 ml-auto">
            <div className="text-right">
              <p className="text-xs text-gray-500 font-medium">Masuk sebagai</p>
              <p className="text-sm font-bold text-gray-800">{userName}</p>
            </div>
            <div
              className={`
                h-10 w-10 rounded-full flex items-center justify-center font-bold border
                ${isAdmin ? 'bg-blue-100 text-blue-600 border-blue-200' : 'bg-emerald-100 text-emerald-600 border-emerald-200'}
              `}
            >
              {userName.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 lg:p-10 bg-gray-50">
          {children}
        </main>
      </div>
    </div>
  )
}
