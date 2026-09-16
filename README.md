# Sistem Manajemen Sekolah (SMS)

Aplikasi manajemen sekolah untuk admin (panel admin) dan guru (panel guru): pengelolaan guru, siswa, mata pelajaran, kelas, jurusan, jadwal pelajaran, tugas, materi, video, pengumuman, dan nilai.

> **PENTING:** Baca `DATABASE_CONTEXT.md` sebelum mengembangkan fitur apa pun.
> File itu adalah SOURCE OF TRUTH struktur database Supabase yang dipakai panel guru
> (profiles → guru → guru_kelas; tugas, materi, video, pengumuman, nilai, jadwal, notifikasi).
> Panel guru TIDAK lagi memakai tabel lama `guru_mengajar`, `jadwal_pelajaran`, dan `presensi`.

## Tech Stack

- **Framework:** Next.js 16.3 + React 19
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth + custom middleware (`proxy.ts`)
- **UI:** Tailwind CSS v4, lucide-react icons
- **Language:** TypeScript

## Struktur Project

```
app/
├── api/
│   ├── admin/                  # API khusus admin (dilindungi adminCheck)
│   │   ├── dashboard/route.ts
│   │   ├── users/route.ts
│   │   ├── mata-pelajaran/route.ts
│   │   ├── mata-pelajaran/[id]/penugasan/route.ts
│   │   ├── kelas/route.ts
│   │   ├── jurusan/route.ts
│   │   └── jadwal/route.ts
│   └── teacher/                # API khusus guru
│       ├── mengajar/route.ts
│       ├── jadwal/route.ts
│       ├── presensi/route.ts
│       ├── nilai/route.ts
│       └── materi/route.ts
├── admin/                      # Halaman panel admin
│   ├── dashboard/              # Dashboard dinamis (statistik + chart + aktivitas)
│   ├── users/                  # Manajemen pengguna (guru & siswa)
│   ├── mata-pelajaran/         # Manajemen mata pelajaran + guru pengampu
│   ├── kelas/                  # Manajemen kelas (tingkat 10–12)
│   ├── jurusan/                # Manajemen jurusan
│   └── jadwal/                 # Manajemen jadwal pelajaran mingguan
└── teacher/
    ├── dashboard/              # Dashboard guru (mapel & kelas diampu + statistik)
    ├── mata-pelajaran/         # Mata pelajaran & kelas yang diampu
    ├── materi/                 # Materi & video pembelajaran (tambah/edit/hapus)
    ├── presensi/               # Pengisian presensi siswa per pertemuan
    ├── jadwal/                 # Jadwal mengajar mingguan (Senin–Sabtu)
    └── nilai/                  # Input nilai & perhitungan rapor

components/
├── admin/                      # UI modul admin (manager + modal)
├── teacher/                    # UI modul guru (PresensiManager, MateriAjarManager, SubjectGroup, dst)
├── layout/AppShell.tsx         # Kerangka sidebar + header (auto highlight nav)
└── ui/                         # Komponen kecil (StatCard, dst)

hooks/useKelasOptions.ts        # Load daftar kelas aktif (tingkat 10–12)
lib/
├── supabase.ts                 # Browser client (anon key)
├── supabase-server.ts          # getSupabaseAdmin (service role), getSessionUser, adminCheck, getProfileRole
└── api-admin.ts                # Helper respons error admin
supabase/migrations/            # Skrip SQL (jalankan di Supabase SQL Editor)
proxy.ts                        # Middleware auth: lindungi /admin/* dan /teacher/*
```

## Struktur Database

### Tabel Utama

| Tabel | Fungsi |
|---|---|
| `profiles` | Data pengguna (id = auth.users.id, `role`, `status`, `kelas_id` untuk siswa) |
| `mata_pelajaran` | Mata pelajaran (kode, nama, deskripsi, status) |
| `kelas` | Kelas (nama_kelas, `tingkat` 10–12, tahun_ajaran, jurusan_id, `wali_kelas_id`) |
| `jurusan` | Daftar jurusan |
| `guru_mengajar` | Junction guru ↔ mata_pelajaran + kelas (+ semester, materi) |
| `jadwal_pelajaran` | Pertemuan mingguan: guru_mengajar_id + hari (1–6) + jam mulai/selesai + ruangan |
| `presensi` | Kehadiran siswa per (guru_mengajar_id, tanggal, siswa_id) |
| `nilai` | Nilai siswa per komponen (harian/tugas/uts/uas) di (guru_mengajar_id, siswa_id) |
| `materi_kelas` | Materi & video pembelajaran per penugasan (judul, deskripsi, video_url, materi_url) |

### Relasi

```
profiles (guru) ──1:N──► guru_mengajar ◄──N:1── mata_pelajaran
                              │
                              ├──N:1── kelas
                              │
                              ├──1:N── jadwal_pelajaran
                              ├──1:N── presensi ──N:1──► profiles (siswa)
                              └──1:N── nilai ──N:1──► profiles (siswa)

kelas ──N:1── jurusan
kelas ──1:N── profiles (siswa via profiles.kelas_id)
```

### Kolom & Constraint Penting

- `profiles.status` / `mata_pelajaran.status` / `kelas.status` — `true` = aktif, `false` = nonaktif
- `kelas.tingkat` — hanya 10, 11, 12 (validasi di API & pilihan UI)
- `kelas.wali_kelas_id` — FK ke `profiles(id) ON DELETE SET NULL`; wali kelas (homeroom) ≠ guru pengampu; satu guru hanya wali satu kelas (unique index parsial)
- `profiles.kelas_id` — FK ke `kelas(id) ON DELETE SET NULL`, hanya terisi untuk role siswa
- `jadwal_pelajaran.hari` — 1 = Senin … 6 = Sabtu; `jam_selesai > jam_mulai`
- `presensi.status` — `hadir` / `terlambat` / `izin` / `sakit` / `alfa`
- `presensi` UNIQUE `(guru_mengajar_id, siswa_id, tanggal)` — isi ulang = update, tidak ganda
- `nilai` UNIQUE `(guru_mengajar_id, siswa_id, jenis_nilai)`; `jenis_nilai` = `harian`/`tugas`/`uts`/`uas`; skala 0–100
- Semua API tulis menggunakan service role (bypass RLS); browser hanya boleh SELECT

### Migrations (urut sesuai tanggal, jalankan di SQL Editor)

| File | Isi |
|---|---|
| `20260909_add_deskripsi_to_mata_pelajaran.sql` | Kolom `deskripsi` di mata_pelajaran |
| `20260909_add_updated_at_and_fix_kurusan.sql` | `updated_at` + trigger; perbaikan typo `kurusan` |
| `20260910_add_semester_to_guru_mengajar.sql` | Kolom `semester` |
| `20260910_create_jadwal_pelajaran.sql` | Tabel `jadwal_pelajaran` |
| `20260910_enable_rls_and_policies.sql` | RLS + policy SELECT untuk authenticated |
| `20260915_add_kelas_id_to_profiles.sql` | Kolom `kelas_id` di profiles (relasi siswa→kelas) |
| `20260915_add_wali_kelas.sql` | Kolom `wali_kelas_id` di kelas + unique index (satu guru satu wali) |
| `20260915_create_presensi.sql` | Tabel `presensi` + trigger updated_at |
| `20260915_create_nilai.sql` | Tabel `nilai` (komponen harian/tugas/uts/uas) |
| `20260915_create_materi_kelas.sql` | Tabel `materi_kelas` (materi & video pembelajaran guru) |

## Routes

### Admin (`/admin/*`)

| Route | Fungsi |
|---|---|
| `/admin/dashboard` | Dashboard dinamis: filter tahun ajaran & jurusan, chart kelas per tingkat/jurusan, aktivitas terbaru, kartu manajemen cepat |
| `/admin/users` | Manajemen pengguna (guru & siswa), bisa atur kelas untuk siswa, reset password |
| `/admin/mata-pelajaran` | Manajemen mapel + detail guru pengampu |
| `/admin/kelas` | Manajemen kelas (tingkat 10–12) + jumlah siswa per kelas |
| `/admin/jurusan` | Manajemen jurusan |
| `/admin/jadwal` | Papan jadwal mingguan (Senin–Sabtu) per kelas |

### Guru (`/teacher/*`)

| Route | Fungsi |
|---|---|
| `/teacher/dashboard` | Ringkasan mapel & kelas diampu + statistik (jadwal hari ini, tugas aktif) + badge wali kelas (opsional) |
| `/teacher/mata-pelajaran` | Daftar mata pelajaran & kelas yang diampu (dari `guru_kelas`, per tahun ajaran) |
| `/teacher/tugas` | CRUD tugas (draft/publish/closed) multi-kelas + lampiran + modal pengumpulan siswa (unduh file via signed URL) |
| `/teacher/materi` | Tab Materi (file via Storage bucket `materi`) & tab Video (tautan YouTube/Drive) per mapel + multi-kelas |
| `/teacher/pengumuman` | Buat/edit/hapus pengumuman ke kelas yang diajar |
| `/teacher/jadwal` | Papan jadwal mengajar mingguan (Senin–Sabtu, hari TEXT dari tabel `jadwal`) |
| `/teacher/nilai` | Input nilai Tugas/UTS/UAS per semester + nilai akhir otomatis (30/30/40) + tab Rapor & predikat |

### Auth

- `/login` — halaman login (Supabase Auth)
- `proxy.ts` — middleware melindungi `/admin/*` dan `/teacher/*`

## API

### Admin (`/api/admin/*`)

| Endpoint | Method | Fungsi |
|---|---|---|
| `/api/admin/dashboard` | GET | Statistik + kelas + jurusan + aktivitas terbaru (service role) |
| `/api/admin/users` | GET/POST/PUT/DELETE | CRUD pengguna; POST/PUT terima `kelas_id` untuk siswa (validasi kelas aktif tingkat 10–12); PUT mendukung reset password |
| `/api/admin/mata-pelajaran` | GET/POST/PUT/DELETE | CRUD mapel + guru pengampu |
| `/api/admin/mata-pelajaran/[id]/penugasan` | GET/POST/PUT/DELETE | Kelola penugasan guru per mapel (kelas + semester + materi) |
| `/api/admin/kelas` | GET/POST/PUT/DELETE | CRUD kelas; GET menyertakan `jumlah_siswa` (nested count) + `wali_kelas_nama`; POST/PUT terima `wali_kelas_id` (validasi guru aktif & belum jadi wali kelas lain) |
| `/api/admin/jurusan` | GET/POST/PUT/DELETE | CRUD jurusan |
| `/api/admin/jadwal` | GET/POST/DELETE | Jadwal per kelas; GET penugasan menyertakan `kelas_id`, `mapel_nama`, `guru_nama` |

### Guru (`/api/teacher/*`)

Semua endpoint memverifikasi sesi guru via `lib/guru-auth.ts` (auth.uid → profiles → guru → guru_kelas) dan hanya mengizinkan akses ke mapel/kelas sesuai penugasan.

| Endpoint | Method | Fungsi |
|---|---|---|
| `/api/teacher/mengajar` | GET | Penugasan mengajar (guru_kelas) + `wali_kelas` opsional (jika kolom `kelas.wali_kelas_id` tersedia) |
| `/api/teacher/jadwal` | GET | Jadwal mingguan dari tabel `jadwal` (hari TEXT, jam, ruangan) difilter penugasan guru_kelas |
| `/api/teacher/nilai` | GET/POST | Roster + nilai per (siswa, mapel, semester, tahun ajaran); POST menghitung `nilai_akhir` otomatis (30% tugas + 30% UTS + 40% UAS) |
| `/api/teacher/tugas` | GET/POST/PUT/DELETE | CRUD tugas + target kelas (`tugas_kelas`); POST mendukung multipart dengan lampiran ke bucket `tugas` |
| `/api/teacher/pengumpulan` | GET | Roster siswa + status pengumpulan per tugas (guru harus mengajar kelas target) |
| `/api/teacher/pengumpulan` | POST | Signed URL (10 menit) unduh file jawaban dari bucket private `pengumpulan` |
| `/api/teacher/materi` | GET/POST/PUT/DELETE | CRUD materi (file via bucket `materi` / deskripsi) + target kelas (`materi_kelas`) |
| `/api/teacher/materi/download` | POST | Signed URL (10 menit) unduh file materi milik guru |
| `/api/teacher/video` | GET/POST/PUT/DELETE | CRUD video pembelajaran (`video_materi` + `video_kelas`); URL divalidasi |
| `/api/teacher/pengumuman` | GET/POST/PUT/DELETE | CRUD pengumuman (`pengumuman` + `pengumuman_kelas`); hanya ke kelas yang diajar |

## Keamanan & Pola Kode

- Semua operasi tulis melewati API routes dengan `adminCheck()` (admin) atau verifikasi role guru (`getProfileRole`) + kepemilikan penugasan (guru). Browser client (anon key) hanya SELECT.
- Database memakai RLS: `SELECT` untuk authenticated; INSERT/UPDATE/DELETE hanya via service role.
- Dashboard admin **jangan** diquery langsung pakai browser client — gunakan `/api/admin/dashboard` (RLS tidak konsisten di setup ini).
- Lint rule `react-hooks/set-state-in-effect`: di dalam `useEffect`, semua `setState` harus berada **setelah `await` pertama** dalam fungsi `async function init()`; jangan memanggil fungsi yang `setState` sinkron langsung dari body effect.

## Alur Fitur

### Alur Admin

#### Penugasan Guru

1. **Buat akun guru** — Manajemen Pengguna → Tambah Pengguna
2. **Buat mata pelajaran** — Manajemen Mata Pelajaran → Tambah
3. **Atur guru pengampu** — dari detail mapel: pilih guru + kelas + semester (+ materi) → Simpan
4. **Hapus akun guru** — penugasan di `guru_mengajar` ikut terhapus (ON DELETE CASCADE)

#### Relasi Siswa → Kelas

- Siswa di-assign ke kelas via **Manajemen Pengguna → Tambah/Edit → field "Kelas"** (muncul hanya untuk role siswa)
- Kelas yang bisa dipilih: kelas aktif tingkat 10–12
- Data kelas menampilkan **jumlah siswa** per kelas

#### Wali Kelas

1. Buka **Data Kelas** → Tambah/Edit Kelas → field **Wali Kelas** (opsional, daftar guru aktif)
2. Wali kelas berbeda dari guru pengampu mapel — pengampu diatur per mapel+kelas di **Mata Pelajaran → Atur Guru Pengampu**, wali diatur satu per kelas di **Data Kelas**
3. Satu guru hanya bisa menjadi wali satu kelas (ditolak API bila sudah wali di kelas lain)
4. Guru dapat melihat status wali kelasnya di **Dashboard Guru** (kartu "Wali Kelas")

#### Jadwal Pelajaran

1. **Siapkan penugasan guru** terlebih dahulu (guru + mapel + kelas + semester)
2. Admin membuka **Jadwal Pelajaran** → pilih kelas → tambah entri (penugasan + hari + jam + ruangan)
3. Blok jadwal tampil di papan mingguan per hari; bisa dihapus dengan konfirmasi

### Alur Guru (Teacher)

Prasyarat: guru harus sudah memiliki penugasan mengajar dari admin (lihat **Alur Admin → Penugasan Guru**). Tanpa penugasan, panel guru hanya menampilkan pesan untuk menghubungi admin.

#### Login & Dashboard

1. **Login** di `/login` dengan akun role `guru` → middleware (`proxy.ts`) mengizinkan akses `/teacher/*` dan redirect ke `/teacher/dashboard`
2. **Dashboard Guru** (`/teacher/dashboard`) — kartu statistik: jumlah mata pelajaran, kelas diajar, jadwal hari ini, presensi diperiksa + daftar mapel & kelas yang diampu (dikelompokkan per mapel)

#### Mata Pelajaran

1. Buka **Mata Pelajaran** (`/teacher/mata-pelajaran`) — daftar penugasan mengajar dikelompokkan per mapel: kelas, semester, tahun ajaran, dan materi
2. Header halaman menampilkan ringkasan jumlah mapel & kelas yang diampu

#### Jadwal Mengajar

1. Buka **Jadwal Mengajar** (`/teacher/jadwal`) — papan jadwal mingguan milik guru (Senin–Sabtu)
2. Setiap sesi menampilkan jam mulai–selesai, mapel, kelas, dan ruangan; hari ini disorot hijau

#### Presensi Siswa

1. Guru membuka **Presensi Siswa** → pilih mapel & kelas (dari penugasan miliknya) + tanggal (maks. hari ini)
2. Tandai status per siswa: Hadir / Terlambat / Izin / Sakit / Alfa (+ keterangan untuk izin/sakit)
3. Klik **Simpan Presensi** — upsert per (penugasan, tanggal, siswa); isi ulang akan memperbarui, tidak menggandakan

#### Nilai & Rapor

1. Guru membuka **Nilai Siswa** → pilih mapel & kelas
2. Isi nilai per komponen: **Ulangan Harian**, **Tugas**, **UTS**, **UAS** → klik **Simpan Nilai**
3. Kosongkan kolom nilai untuk menghapus baris nilai tsb
4. Tab **Rapor**: rata-rata komponen + predikat huruf (A/B/C/D/E) per siswa + rata-rata kelas

### Materi & Video Pembelajaran

1. Guru membuka **Materi & Video** (`/teacher/materi`) → klik **Tambah Materi**
2. Pilih mapel & kelas (dari penugasan miliknya), isi judul, lalu minimal salah satu: deskripsi/ringkasan, URL video (YouTube/Drive), atau URL dokumen
3. Materi tampil sebagai kartu dengan tombol akses video & dokumen; status bisa **Tampil** (terlihat siswa) atau **Draf** (disembunyikan)
4. Edit via ikon pensil, hapus via ikon tempat sampah (dengan konfirmasi) — hanya materi milik sendiri yang bisa diubah

## Running

```bash
npm run dev
```

Buka http://localhost:3000/admin (login sebagai admin) atau http://localhost:3000/teacher (login sebagai guru).

## Catatan Penting

- Sebelum fitur tertentu dipakai, pastikan migration terkait sudah dijalankan di Supabase Dashboard → SQL Editor.
- Gunakan branch `feat/...` untuk pengembangan fitur.
- Role yang tersedia: `admin`, `guru`, `siswa`.
- Lint & typecheck: `npm run lint` dan `npx tsc --noEmit`.

## Riwayat Pembaruan

### 2026-09-15 — Fitur Materi & Video Pembelajaran (Guru)

**Fitur baru:**

- Menu **Materi & Video** di panel guru (`/teacher/materi`): guru dapat menambah, mengedit, dan menghapus materi per penugasan (mapel + kelas + semester).
- Satu materi terdiri dari judul + minimal salah satu: deskripsi/ringkasan, URL video (YouTube/Drive), atau URL dokumen.
- Status materi: **Tampil** (terlihat siswa) atau **Draf** (disembunyikan) — diatur saat edit.
- Badge **Wali Kelas** di header Dashboard Guru (di bawah sambutan).

**File baru:**

| File | Isi |
|---|---|
| `app/teacher/materi/page.tsx` | Halaman Materi & Video di panel guru (auth check + AppShell) |
| `components/teacher/MateriAjarManager.tsx` | UI kartu materi: modal tambah/edit, konfirmasi hapus, tombol akses video & dokumen |
| `app/api/teacher/materi/route.ts` | API CRUD materi (GET/POST/PUT/DELETE) dengan verifikasi kepemilikan penugasan & validasi URL |
| `supabase/migrations/20260915_create_materi_kelas.sql` | Tabel `materi_kelas` + index + trigger `updated_at` + RLS (SELECT authenticated) |

**Perubahan pada file lama:**

- Semua halaman guru (`dashboard`, `mata-pelajaran`, `presensi`, `jadwal`, `nilai`): nav sidebar kini menyertakan entri **Materi & Video**.
- `components/teacher/index.ts`: ekspor baru `MateriAjarManager`.
- `app/teacher/dashboard/page.tsx`: badge wali kelas di header.

**Catatan deploy:**

- Jalankan `supabase/migrations/20260915_create_materi_kelas.sql` di Supabase SQL Editor sebelum memakai fitur ini.

### 2026-09-16 — Rewrite Panel Guru sesuai DATABASE_CONTEXT.md (DB baru)

Panel guru ditulis ulang sepenuhnya mengikuti struktur database baru (lihat `DATABASE_CONTEXT.md`).

**Perubahan besar:**

- Penugasan guru kini dari tabel **`guru_kelas`** (guru + mapel + kelas + tahun ajaran) — tabel lama `guru_mengajar` tidak dipakai lagi.
- Jadwal dari tabel **`jadwal`** (hari TEXT "Senin".."Sabtu") — tabel lama `jadwal_pelajaran` tidak dipakai lagi.
- Nilai: 1 baris per (siswa, mapel, semester, tahun ajaran) dengan kolom `tugas`, `uts`, `uas`, `nilai_akhir` (30/30/40) — skema lama 4-komponen-per-baris diganti.
- **Fitur presensi dihentikan** (tabel `presensi` tidak ada di DB baru) — halaman & API presensi dihapus. Restorasi bisa dari git history bila kelak tabelnya dibuat.
- Siswa kelas dibaca dari tabel **`siswa`** (`siswa.kelas_id`), bukan `profiles.kelas_id`.

**Fitur baru:**

- **Tugas & Pengumpulan** (`/teacher/tugas`): CRUD tugas multi-kelas (draft/published/closed), lampiran ke bucket `tugas`, modal pengumpulan siswa + unduh file via signed URL bucket `pengumpulan`.
- **Materi (file)**: unggah dokumen ke bucket private `materi` + unduh via signed URL (`/api/teacher/materi/download`).
- **Video Pembelajaran**: terpisah dari materi — tabel `video_materi` + `video_kelas` (tab di halaman Materi & Video).
- **Pengumuman** (`/teacher/pengumuman`): kirim per kelas yang diajar (`pengumuman` + `pengumuman_kelas`).
- **Wali kelas (opsional)**: terdeteksi otomatis bila kolom `kelas.wali_kelas_id` tersedia.

**File baru:**

| File | Isi |
|---|---|
| `DATABASE_CONTEXT.md` | Source of truth struktur DB (wajib dibaca agent) |
| `lib/guru-auth.ts` | Helper auth guru: `guruAuth()`, `getGuruKelas()`, `isAssigned()`, `getSiswaKelas()` |
| `lib/teacher-nav.ts` | Nav bersama panel guru |
| `app/api/teacher/tugas/route.ts` | CRUD tugas + lampiran Storage |
| `app/api/teacher/pengumpulan/route.ts` | Status pengumpulan + signed URL unduhan |
| `app/api/teacher/video/route.ts` | CRUD video pembelajaran |
| `app/api/teacher/pengumuman/route.ts` | CRUD pengumuman |
| `app/api/teacher/materi/download/route.ts` | Signed URL unduh materi |
| `app/teacher/tugas/page.tsx`, `app/teacher/pengumuman/page.tsx` | Halaman baru |
| `components/teacher/TugasManager.tsx`, `VideoMateriManager.tsx`, `PengumumanManager.tsx` | Komponen UI baru |

**Diubah / dihapus:**

- Rewrite: `app/api/teacher/{mengajar,jadwal,nilai,materi}/route.ts`, `components/teacher/{AssignmentCard,JadwalMengajar,NilaiManager,MateriAjarManager}.tsx`, semua halaman `/teacher/*`.
- Dihapus: `app/teacher/presensi/`, `app/api/teacher/presensi/`, `app/api/siswa/`, `components/teacher/PresensiManager.tsx`.

**Prasyarat:** database sesuai `DATABASE_CONTEXT.md` (tabel guru, siswa, guru_kelas, tugas, tugas_kelas, pengumpulan_tugas, materi, materi_kelas, video_materi, video_kelas, pengumuman, pengumuman_kelas, nilai, jadwal, notifikasi + bucket materi/tugas/pengumpulan).
- Siswa nantinya membaca materi lewat API siswa (READ saja) — belum tersedia pada pembaruan ini.