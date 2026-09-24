import {
  BookOpen,
  Calendar,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  Megaphone,
  Video,
  UserCheck,
} from 'lucide-react'

/**
 * teacher-nav — Daftar menu panel guru (sumber tunggal).
 * Tambah/hapus menu di sini maka semua halaman /teacher/* ikut berubah.
 * Urutan = urutan tampil di sidebar AppShell.
 */
// Navigasi panel guru (dipakai semua halaman /teacher/*)
export const teacherNavItems = [
  { href: '/teacher/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/teacher/mata-pelajaran', icon: BookOpen, label: 'Mata Pelajaran' },
  { href: '/teacher/tugas', icon: ClipboardCheck, label: 'Tugas & Pengumpulan' },
  { href: '/teacher/materi', icon: Video, label: 'Materi & Video' },
  { href: '/teacher/pengumuman', icon: Megaphone, label: 'Pengumuman' },
  { href: '/teacher/jadwal', icon: Calendar, label: 'Jadwal Mengajar' },
  { href: '/teacher/presensi', icon: UserCheck, label: 'Presensi' },
  { href: '/teacher/nilai', icon: FileText, label: 'Nilai Siswa' },
]
