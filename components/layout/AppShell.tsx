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
    <div className="flex h-screen bg-[#f8fafc] overflow-hidden">
      {/* Sidebar - minimal */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-[248px] bg-white border-r border-gray-100 text-gray-900 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static flex flex-col
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex h-[60px] items-center justify-between px-5 border-b border-gray-100">
          <div className="flex items-center space-x-2.5">
            {logoIcon || defaultLogoIcon}
            <span className="font-semibold text-[15px] tracking-tight">
              {panelLabel}
            </span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-gray-400 hover:text-gray-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
          {navItems.map((item, index) => {
            const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)

            return (
              <Link
                key={`${item.href}-${index}`}
                href={item.href === '#' ? '#' : item.href}
                className={`
                  flex items-center space-x-3 px-3 py-2.5 rounded-xl font-medium text-[13.5px] transition-colors
                  ${
                    isActive
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                  }
                `}
              >
                <item.icon className="h-[18px] w-[18px]" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="p-3 border-t border-gray-100">
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center space-x-2 px-3 py-2.5 rounded-xl text-gray-500 hover:bg-gray-50 hover:text-gray-900 font-medium text-sm transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span>Keluar</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-[56px] bg-white/80 backdrop-blur border-b border-gray-100 flex items-center justify-between px-5 z-10">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-gray-600 hover:text-gray-900"
          >
            <Menu className="h-6 w-6" />
          </button>

          <div className="flex items-center space-x-3 ml-auto">
            <div className="text-right hidden sm:block">
              <p className="text-[11px] text-gray-400 font-medium leading-none">Masuk sebagai</p>
              <p className="text-[13px] font-semibold text-gray-900 leading-none mt-1">{userName}</p>
            </div>
            <div
              className="h-8 w-8 rounded-full flex items-center justify-center font-semibold text-sm border bg-gray-900 text-white border-gray-900"
            >
              {userName.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-5 lg:p-8 bg-[#f8fafc]">
          {children}
        </main>
      </div>
    </div>
  )
}
