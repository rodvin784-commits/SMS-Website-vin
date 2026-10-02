'use client'
// AppShell — Layout utama web (admin & guru). Sidebar + header + main.
// Dipakai di: app/admin/* dan app/teacher/*
// Untuk pengembang baru: tambah menu → edit lib/teacher-nav.ts

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Bell,
  Menu,
  Plus,
  Search,
  X,
  LogOut,
  ShieldCheck,
  GraduationCap as GraduationCapIcon,
  User,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// Satu item menu sidebar
type NavItem = {
  href: string // rute Next.js, mis: "/admin/users"
  icon: LucideIcon // ikon lucide-react
  label: string // teks yang tampil
  description?: string // cadangan data (tidak dirender — sidebar hanya Ikon + Judul)
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
  const [searchQ, setSearchQ] = useState('')
  const [searchFocus, setSearchFocus] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  const router = useRouter()

  const isAdmin = role === 'admin'
  // Menu aktif lembut menyatu tema terang (bukan hitam pekat)
  const activeCls = isAdmin ? 'bg-blue-50 text-blue-800' : 'bg-emerald-50 text-emerald-800'
  // Notifikasi per peran (guru saja — admin tidak punya pusat notifikasi)
  const notifHref = '/teacher/pengumuman'
  const notifLabel = 'Pengumuman'

  // Indeks pencarian: menu + aksi cepat (navigasi instan, tanpa backend)
  type SearchEntry = { label: string; href: string; icon: LucideIcon; kind: 'Menu' | 'Aksi' }
  const searchIndex = useMemo<SearchEntry[]>(() => {
    const menus: SearchEntry[] = navItems
      .filter((it) => it.href !== '#')
      .map((it) => ({ label: it.label, href: it.href, icon: it.icon, kind: 'Menu' }))
    const actions: SearchEntry[] = isAdmin
      ? [{ label: 'Tambah Pengguna', href: '/admin/users', icon: Plus, kind: 'Aksi' }]
      : [
          { label: 'Buat Tugas', href: '/teacher/tugas', icon: Plus, kind: 'Aksi' },
          { label: 'Tambah Materi', href: '/teacher/materi', icon: Plus, kind: 'Aksi' },
          { label: 'Input Nilai', href: '/teacher/nilai', icon: Plus, kind: 'Aksi' },
          { label: 'Buat Pengumuman', href: '/teacher/pengumuman', icon: Plus, kind: 'Aksi' },
        ]
    return [...actions, ...menus]
  }, [navItems, isAdmin])

  const query = searchQ.trim().toLowerCase()
  const results = query
    ? searchIndex.filter((e) => e.label.toLowerCase().includes(query)).slice(0, 6)
    : []

  const goResult = (href: string) => {
    setSearchQ('')
    setSearchFocus(false)
    router.push(href)
  }

  // Tutup panel hasil saat klik di luar
  useEffect(() => {
    if (!searchFocus) return
    const onPointer = (e: PointerEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchFocus(false)
    }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [searchFocus])
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

        <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto" aria-label="Navigasi utama">
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
                {cat !== 'Umum' && <p className="px-3 mb-1.5 text-[11px] font-extrabold tracking-wider text-gray-500 uppercase">{cat}</p>}
                <div className="space-y-1">
                  {items.map((item, index) => {
                    const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
                    return (
                      <Link
                        key={`${item.href}-${index}`}
                        href={item.href === '#' ? '#' : item.href}
                        aria-current={isActive ? 'page' : undefined}
                        className={`
                          flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors
                          ${isActive ? `${activeCls} font-semibold` : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 font-medium'}
                        `}
                      >
                        <item.icon className="h-[18px] w-[18px] flex-shrink-0" aria-hidden />
                        <span className="block text-[13.5px] leading-tight">{item.label}</span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))
          })()}
        </nav>

        {/* Footer sidebar */}
        <div className="p-3 border-t border-gray-100 space-y-2">
          <Link
            href="/profile"
            className="w-full flex items-center justify-center space-x-2 px-3 py-2.5 rounded-xl text-gray-600 hover:bg-gray-50 hover:text-gray-900 font-medium text-sm transition-colors border border-gray-100"
          >
            <User className="h-4 w-4" />
            <span>Profil</span>
          </Link>
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
        <header className="min-h-[56px] bg-white/80 backdrop-blur border-b border-gray-100 flex items-center gap-3 px-5 py-2 z-10">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-gray-600 hover:text-gray-900"
            aria-label="Buka menu navigasi"
          >
            <Menu className="h-6 w-6" />
          </button>

          {/* Pencarian global */}
          <div className="relative hidden md:block w-full max-w-md mx-auto" ref={searchRef}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" aria-hidden />
            <input
              type="search"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              onFocus={() => setSearchFocus(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && results.length > 0) goResult(results[0].href)
                if (e.key === 'Escape') setSearchFocus(false)
              }}
              placeholder="Cari materi, tugas, atau siswa…"
              aria-label="Cari materi, tugas, atau siswa"
              role="combobox"
              aria-expanded={searchFocus && query !== ''}
              aria-controls="hasil-cari"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-[13px] text-gray-800 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
            />
            {searchFocus && query !== '' && (
              <div
                id="hasil-cari"
                role="listbox"
                aria-label="Hasil pencarian"
                className="absolute left-0 right-0 mt-2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg shadow-gray-900/5"
              >
                {results.length === 0 ? (
                  <p className="px-4 py-3 text-[13px] text-gray-500">Tidak ditemukan. Coba kata lain.</p>
                ) : (
                  <ul className="py-1">
                    {results.map((r) => (
                      <li key={`${r.kind}-${r.href}-${r.label}`}>
                        <button
                          type="button"
                          role="option"
                          aria-selected="false"
                          onClick={() => goResult(r.href)}
                          className="flex w-full items-center gap-2.5 px-4 py-2 text-left hover:bg-gray-50"
                        >
                          <r.icon className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
                          <span className="flex-1 truncate text-[13px] font-medium text-gray-800">{r.label}</span>
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500">{r.kind}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {/* Notifikasi */}
            {!isAdmin && (
              <Link
                href={notifHref}
                aria-label={notifLabel}
                title={notifLabel}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
              >
                <Bell className="h-[18px] w-[18px]" aria-hidden />
              </Link>
            )}
            {/* Profil — satu komponen menyatu (tanpa dropdown) */}
            <div
              title={`Masuk sebagai ${userName}`}
              className="flex items-center gap-2.5 rounded-xl border border-gray-200 bg-white py-1.5 pl-1.5 pr-3.5 shadow-sm"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white" aria-hidden>
                {userName.charAt(0).toUpperCase()}
              </div>
              <div className="hidden min-w-0 text-left sm:block">
                <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500">Masuk sebagai</p>
                <p className="max-w-[150px] truncate text-sm font-bold leading-tight text-gray-900">{userName}</p>
              </div>
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
