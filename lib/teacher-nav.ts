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
  { href: '/teacher/dashboard', icon: LayoutDashboard, label: 'Dashboard', description: 'Ringkasan mengajar & wali kelas', category: 'Utama' },
  { href: '/teacher/mata-pelajaran', icon: BookOpen, label: 'Mata Pelajaran', description: 'Mapel & kelas yang diampu', category: 'Pengajaran' },
  { href: '/teacher/tugas', icon: ClipboardCheck, label: 'Tugas & Pengumpulan', description: 'Buat tugas & nilai pengumpulan', category: 'Pengajaran' },
  { href: '/teacher/materi', icon: Video, label: 'Materi & Video', description: 'Materi & video pembelajaran', category: 'Pengajaran' },
  { href: '/teacher/pengumuman', icon: Megaphone, label: 'Pengumuman', description: 'Info untuk kelas yang diajar', category: 'Pengajaran' },
  { href: '/teacher/jadwal', icon: Calendar, label: 'Jadwal Mengajar', description: 'Jadwal mingguan Senin–Sabtu', category: 'Pengajaran' },
  { href: '/teacher/presensi', icon: UserCheck, label: 'Presensi', description: 'Hadir/izin/sakit/alpha per tanggal', category: 'Pengajaran' },
  { href: '/teacher/nilai', icon: FileText, label: 'Nilai Siswa', description: 'Input nilai & rapor', category: 'Pengajaran' },
]
