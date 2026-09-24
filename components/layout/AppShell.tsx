'use client'
// AppShell — Layout utama web (admin & guru). Sidebar + header + main.
// Dipakai di: app/admin/* dan app/teacher/*
// Untuk pengembang baru: tambah menu → edit lib/teacher-nav.ts

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

// Satu item menu sidebar
type NavItem = {
  href: string // rute Next.js, mis: "/admin/users"
  icon: LucideIcon // ikon lucide-react
  label: string // teks yang tampil
  description?: string // penjelasan kecil di bawah label, per kategori
  category?: string // grup, mis: "Manajemen", "Akademik"
}

type UserRole = 'admin' | 'teacher' | 'siswa'

interface AppShellProps {
  role: UserRole // tentukan label panel & ikon default
  userName: string
  navItems: NavItem[] // daftar menu (dari lib/teacher-nav.ts)
  children: React.ReactNode // konten halaman
  onLogout: () => void
  logoIcon?: React.ReactNode // opsional: ikon custom
  initialColor?: string // tidak dipakai saat ini, cadangan untuk tema
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

        <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
          {(() => {
            // Kelompokkan by category, tanpa kategori = "Umum"
            const groups = new Map<string, NavItem[]>()
            for (const it of navItems) {
              const cat = it.category ?? 'Umum'
              if (!groups.has(cat)) groups.set(cat, [])
              groups.get(cat)!.push(it)
            }
            return Array.from(groups.entries()).map(([cat, items]) => (
              <div key={cat}>
                {cat !== 'Umum' && <p className="px-3 mb-1.5 text-[10px] font-bold tracking-widest text-gray-400 uppercase">{cat}</p>}
                <div className="space-y-1">
                  {items.map((item, index) => {
                    const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
                    return (
                      <Link
                        key={`${item.href}-${index}`}
                        href={item.href === '#' ? '#' : item.href}
                        className={`
                          flex items-start gap-3 px-3 py-2.5 rounded-xl transition-colors
                          ${isActive ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}
                        `}
                      >
                        <item.icon className="h-[18px] w-[18px] mt-0.5 flex-shrink-0" />
                        <span className="min-w-0">
                          <span className="block font-medium text-[13.5px] leading-none">{item.label}</span>
                          {item.description && <span className={`block text-[11px] leading-tight mt-1 ${isActive ? 'text-white/70' : 'text-gray-400'}`}>{item.description}</span>}
                        </span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))
          })()}
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
