<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# WAJIB: Baca DATABASE_CONTEXT.md lebih dulu

Sebelum melakukan coding apa pun, baca file `DATABASE_CONTEXT.md` di root project.
File tersebut adalah SOURCE OF TRUTH struktur database Supabase.

- Jangan membuat tabel baru jika tabel yang dibutuhkan sudah tersedia.
- Jangan membuat ulang tabel `profiles`.
- Jangan melakukan `DROP TABLE`.
- Jangan menghapus data database.
- Jangan mengubah struktur tabel/database tanpa persetujuan user — jika perlu perubahan, jelaskan dulu dan tunggu persetujuan.
- Jika ada konflik antara kode dan struktur database di `DATABASE_CONTEXT.md`, laporkan konflik tersebut sebelum melanjutkan.
- Guru hanya boleh mengakses mapel & kelas sesuai penugasan di tabel `guru_kelas` (verifikasi server-side, bukan hanya filter frontend).
- Siswa hanya boleh mengakses data miliknya via `siswa.kelas_id`.
- Jangan mengekspos Supabase Service Role Key di frontend; operasi tulis lewat API route server-side.
- Jangan membuat fitur register guru/siswa; akun dibuat oleh Admin.
