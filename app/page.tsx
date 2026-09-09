import Link from "next/link";
import Image from "next/image";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-950 via-gray-900 to-indigo-950 px-4">
      <div className="text-center space-y-8 max-w-lg">
        <div className="space-y-3">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 overflow-hidden p-2">
            <Image
              src="/gambar3.png"
              alt="Logo"
              width={80}
              height={80}
              className="h-full w-full object-contain"
            />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Sistem Manajemen Sekolah
          </h1>
          <p className="text-sm sm:text-base text-gray-400 leading-relaxed">
            Platform terpadu untuk pengelolaan data guru, siswa, kelas, dan
            jadwal pelajaran.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-2xl bg-blue-600 px-8 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-700 transition-all"
          >
            Masuk ke Sistem
          </Link>
        </div>

        <p className="text-xs text-gray-500">
          © {new Date().getFullYear()} Sistem Manajemen Sekolah
        </p>
      </div>
    </div>
  );
}
