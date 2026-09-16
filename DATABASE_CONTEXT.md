# MASTER DATABASE CONTEXT

# SISTEM PORTAL SEKOLAH — SUPABASE

Anda adalah AI Coding Agent yang sedang mengembangkan sistem Portal Sekolah.

Sistem terdiri dari:

1. Admin Panel berbasis Web
2. Portal Guru berbasis Web
3. Aplikasi Siswa berbasis React Native

Teknologi backend:

- Supabase
- PostgreSQL
- Supabase Auth
- Supabase Storage
- Row Level Security atau RLS

Dokumentasi ini adalah sumber utama atau SOURCE OF TRUTH untuk struktur database.

> **INSTRUKSI AWAL UNTUK SETIAP PEKERJAAN AI AGENT:**
> Sebelum melakukan coding, baca file `DATABASE_CONTEXT.md`.
> Anggap file tersebut sebagai sumber utama struktur database.
> Jangan membuat tabel baru jika tabel yang dibutuhkan sudah tersedia.
> Jangan membuat ulang tabel `profiles`.
> Jangan melakukan `DROP TABLE`.
> Jangan mengubah database tanpa persetujuan user.

============================================================

## ATURAN WAJIB UNTUK AI AGENT

============================================================

1. DATABASE SUDAH DIBUAT.
2. Jangan membuat ulang tabel yang sudah tersedia.
3. Jangan membuat tabel `profiles` baru.
4. Jangan menjalankan `DROP TABLE`.
5. Jangan menghapus data database.
6. Jangan mengubah struktur tabel tanpa persetujuan user.
7. Jangan membuat database alternatif.
8. Jangan membuat sistem login sendiri.
9. Gunakan Supabase Auth untuk autentikasi.
10. Jangan membuat fitur Register untuk guru dan siswa.
11. Akun guru dan siswa dibuat oleh Admin.
12. Jangan menyimpan password pada tabel public.
13. Jangan mengekspos Supabase Service Role Key di frontend.
14. Jangan menggunakan Service Role Key di React atau React Native.
15. Jika membutuhkan Service Role Key, gunakan backend/server-side atau Edge Function.
16. Jangan menganggap semua guru dapat mengakses semua kelas.
17. Guru hanya boleh mengakses kelas dan mata pelajaran yang ditugaskan.
18. Siswa hanya boleh mengakses data miliknya sendiri dan kelasnya.
19. Jangan hanya mengandalkan filter frontend untuk keamanan.
20. Gunakan RLS sebagai lapisan keamanan utama.
21. Sebelum membuat fitur baru, pahami relasi database terlebih dahulu.
22. Jika membutuhkan tabel atau kolom baru, jelaskan terlebih dahulu.
23. Jangan mengubah database secara diam-diam.
24. Jika terdapat konflik antara kode dan database, laporkan konflik tersebut.
25. Jangan mengasumsikan tabel lain tersedia jika tidak tercantum dalam dokumentasi ini.

============================================================

## 1. SISTEM AUTENTIKASI

============================================================

Autentikasi menggunakan Supabase Auth.

Tabel Auth bawaan Supabase:

- `auth.users`

Setiap user yang login mempunyai:

- `auth.uid()`

User Auth dihubungkan ke:

- `public.profiles.id`

Alur autentikasi:

```
auth.users
    ↓
profiles
    ↓
guru atau siswa
```

Tidak boleh membuat tabel login baru.
Tidak boleh membuat tabel password sendiri.

============================================================

## 2. TABEL PROFILES

============================================================

Nama tabel: `public.profiles`

Tabel ini SUDAH ADA. JANGAN membuat ulang tabel `profiles`.

Struktur:

- id UUID PRIMARY KEY
- role TEXT NOT NULL
- nama_lengkap TEXT
- created_at TIMESTAMPTZ NOT NULL
- email TEXT
- foto_url TEXT
- status BOOLEAN
- kelas_id UUID
- updated_at TIMESTAMPTZ

Role yang digunakan:

- admin
- guru
- siswa

Relasi:

```
auth.users.id → profiles.id
```

Contoh data:

- id: UUID user dari Supabase Auth
- role: guru
- nama_lengkap: Budi Santoso
- email: budi@sekolah.sch.id
- status: true

Fungsi:

- Menyimpan identitas dasar user
- Menentukan role user
- Menghubungkan akun Auth dengan data guru/siswa

============================================================

## 3. TABEL JURUSAN

============================================================

Nama tabel: `public.jurusan`

Fungsi: Menyimpan master data jurusan sekolah.

Struktur:

- id UUID PRIMARY KEY
- kode TEXT UNIQUE NOT NULL
- nama TEXT NOT NULL
- status BOOLEAN
- created_at TIMESTAMPTZ

Contoh data:

- RPL — Rekayasa Perangkat Lunak
- TKJ — Teknik Komputer dan Jaringan
- AKL — Akuntansi dan Keuangan Lembaga

Relasi:

```
jurusan.id → kelas.jurusan_id
```

============================================================

## 4. TABEL MATA_PELAJARAN

============================================================

Nama tabel: `public.mata_pelajaran`

Fungsi: Menyimpan master seluruh mata pelajaran.

Struktur:

- id UUID PRIMARY KEY
- kode TEXT UNIQUE NOT NULL
- nama TEXT NOT NULL
- deskripsi TEXT
- status BOOLEAN
- created_at TIMESTAMPTZ
- updated_at TIMESTAMPTZ

Contoh data:

- MTK — Matematika
- BINDO — Bahasa Indonesia
- BING — Bahasa Inggris
- PPKN — Pendidikan Pancasila
- PJOK — Pendidikan Jasmani, Olahraga, dan Kesehatan
- DASPRO — Dasar-Dasar Pemrograman
- BASISDATA — Basis Data
- WEB — Pemrograman Web
- PBO — Pemrograman Berorientasi Objek
- PKK — Projek Kreatif dan Kewirausahaan

Relasi:

```
mata_pelajaran.id
    ├── guru_mata_pelajaran.mata_pelajaran_id
    ├── guru_kelas.mata_pelajaran_id
    ├── tugas.mata_pelajaran_id
    ├── materi.mata_pelajaran_id
    ├── video_materi.mata_pelajaran_id
    ├── nilai.mata_pelajaran_id
    └── jadwal.mata_pelajaran_id
```

Catatan:

Tabel `mata_pelajaran` hanya menyimpan data master mata pelajaran.
Data guru yang mengajar dan kelas yang diajar disimpan pada:

- `guru_mata_pelajaran`
- `guru_kelas`

============================================================

## 5. TABEL KELAS

============================================================

Nama tabel: `public.kelas`

Fungsi: Menyimpan data kelas sekolah.

Struktur:

- id UUID PRIMARY KEY
- nama_kelas TEXT NOT NULL
- tingkat INTEGER
- jurusan_id UUID
- tahun_ajaran TEXT
- status BOOLEAN
- wali_kelas_id UUID
- created_at TIMESTAMPTZ
- updated_at TIMESTAMPTZ

Nilai tingkat:

- 10
- 11
- 12

Contoh data:

- X RPL 1
- X RPL 2
- XI RPL 1
- XI RPL 2
- XII RPL 1
- XII RPL 2

Relasi:

```
kelas.jurusan_id → jurusan.id

kelas.id
    ├── siswa.kelas_id
    ├── guru_kelas.kelas_id
    ├── tugas_kelas.kelas_id
    ├── materi_kelas.kelas_id
    ├── video_kelas.kelas_id
    ├── pengumuman_kelas.kelas_id
    └── jadwal.kelas_id
```

============================================================

## 6. TABEL GURU

============================================================

Nama tabel: `public.guru`

Fungsi: Menyimpan data khusus guru.

Struktur:

- id UUID PRIMARY KEY
- profile_id UUID UNIQUE NOT NULL
- nip TEXT UNIQUE
- nama_lengkap TEXT
- created_at TIMESTAMPTZ
- updated_at TIMESTAMPTZ

Relasi:

```
guru.profile_id → profiles.id
```

Artinya: Satu akun profile guru memiliki satu data guru.

Contoh:

- Nama: Budi Santoso
- NIP: 1987654321

============================================================

## 7. TABEL SISWA

============================================================

Nama tabel: `public.siswa`

Fungsi: Menyimpan data khusus siswa.

Struktur:

- id UUID PRIMARY KEY
- profile_id UUID UNIQUE NOT NULL
- nis TEXT UNIQUE NOT NULL
- nama_lengkap TEXT NOT NULL
- kelas_id UUID NOT NULL
- jurusan_id UUID
- created_at TIMESTAMPTZ
- updated_at TIMESTAMPTZ

Relasi:

```
siswa.profile_id → profiles.id
siswa.kelas_id → kelas.id
```

Contoh:

- NIS: 102030
- Nama: Vinzen
- Kelas: X RPL 1

Catatan: Satu siswa mempunyai:

- Satu akun Auth
- Satu profile
- Satu NIS
- Satu kelas aktif

============================================================

## 8. TABEL GURU_MATA_PELAJARAN

============================================================

Nama tabel: `public.guru_mata_pelajaran`

Fungsi: Menghubungkan guru dengan mata pelajaran yang diajarkan.

Struktur:

- id UUID PRIMARY KEY
- guru_id UUID
- mata_pelajaran_id UUID
- created_at TIMESTAMPTZ

Relasi:

```
guru_mata_pelajaran.guru_id → guru.id
guru_mata_pelajaran.mata_pelajaran_id → mata_pelajaran.id
```

Contoh:

- Budi Santoso → Matematika
- Andi Wijaya → Basis Data

============================================================

## 9. TABEL GURU_KELAS

============================================================

Nama tabel: `public.guru_kelas`

Tabel ini merupakan tabel PENTING untuk pengaturan hak akses guru.

Fungsi: Menentukan:

- Guru siapa
- Mengajar mata pelajaran apa
- Mengajar di kelas mana
- Pada tahun ajaran berapa

Struktur:

- id UUID PRIMARY KEY
- guru_id UUID
- kelas_id UUID
- mata_pelajaran_id UUID
- tahun_ajaran TEXT
- created_at TIMESTAMPTZ

Relasi:

```
guru_kelas.guru_id → guru.id
guru_kelas.kelas_id → kelas.id
guru_kelas.mata_pelajaran_id → mata_pelajaran.id
```

Contoh:

Guru Budi:

- Matematika → X RPL 1
- Matematika → X RPL 2
- Matematika → XI RPL 1

Artinya Guru Budi hanya dapat mengelola data pembelajaran pada kelas tersebut.

Guru tidak boleh otomatis memiliki akses ke seluruh kelas.

Pengecekan akses guru harus mempertimbangkan:

- profile user yang sedang login
- guru_id
- mata_pelajaran_id
- kelas_id
- data pada `guru_kelas`

============================================================

## 10. TABEL TUGAS

============================================================

Nama tabel: `public.tugas`

Fungsi: Menyimpan tugas yang dibuat guru.

Struktur:

- id UUID PRIMARY KEY
- guru_id UUID
- mata_pelajaran_id UUID
- judul TEXT
- deskripsi TEXT
- tanggal_mulai TIMESTAMPTZ
- deadline TIMESTAMPTZ
- lampiran_url TEXT
- status TEXT
- created_at TIMESTAMPTZ
- updated_at TIMESTAMPTZ

Status tugas:

- draft
- published
- closed

Relasi:

```
tugas.guru_id → guru.id
tugas.mata_pelajaran_id → mata_pelajaran.id
```

Tugas tidak langsung diberikan kepada semua siswa.
Target kelas ditentukan melalui tabel: `tugas_kelas`

============================================================

## 11. TABEL TUGAS_KELAS

============================================================

Nama tabel: `public.tugas_kelas`

Fungsi: Menghubungkan tugas dengan kelas tujuan.

Struktur:

- id UUID PRIMARY KEY
- tugas_id UUID
- kelas_id UUID
- created_at TIMESTAMPTZ

Relasi:

```
tugas_kelas.tugas_id → tugas.id
tugas_kelas.kelas_id → kelas.id
```

Contoh:

Tugas Matematika 01 diberikan kepada:

- X RPL 1
- X RPL 2

Maka tugas tersebut memiliki dua relasi pada `tugas_kelas`.

Guru hanya boleh memilih kelas yang terdapat pada `guru_kelas`.

============================================================

## 12. TABEL PENGUMPULAN_TUGAS

============================================================

Nama tabel: `public.pengumpulan_tugas`

Fungsi: Menyimpan jawaban atau file tugas siswa.

Struktur:

- id UUID PRIMARY KEY
- tugas_id UUID
- siswa_id UUID
- file_url TEXT
- nama_file TEXT
- catatan TEXT
- status TEXT
- submitted_at TIMESTAMPTZ
- created_at TIMESTAMPTZ
- updated_at TIMESTAMPTZ

Status:

- belum_dikumpulkan
- dikumpulkan
- terlambat
- dinilai

Relasi:

```
pengumpulan_tugas.tugas_id → tugas.id
pengumpulan_tugas.siswa_id → siswa.id
```

Aturan:

- Siswa hanya dapat mengumpulkan tugas untuk dirinya sendiri.
- Siswa tidak boleh mengubah pengumpulan siswa lain.
- Guru hanya dapat melihat pengumpulan dari kelas yang diajar.
- Satu siswa sebaiknya hanya memiliki satu pengumpulan untuk satu tugas.

============================================================

## 13. TABEL MATERI

============================================================

Nama tabel: `public.materi`

Fungsi: Menyimpan materi pembelajaran yang dibuat guru.

Struktur:

- id UUID PRIMARY KEY
- guru_id UUID
- mata_pelajaran_id UUID
- judul TEXT
- deskripsi TEXT
- file_url TEXT
- nama_file TEXT
- created_at TIMESTAMPTZ
- updated_at TIMESTAMPTZ

Relasi:

```
materi.guru_id → guru.id
materi.mata_pelajaran_id → mata_pelajaran.id
```

Target kelas materi ditentukan melalui: `materi_kelas`

============================================================

## 14. TABEL MATERI_KELAS

============================================================

Nama tabel: `public.materi_kelas`

Fungsi: Menghubungkan materi dengan kelas tujuan.

Struktur:

- id UUID PRIMARY KEY
- materi_id UUID
- kelas_id UUID
- created_at TIMESTAMPTZ

Relasi:

```
materi_kelas.materi_id → materi.id
materi_kelas.kelas_id → kelas.id
```

Guru hanya boleh mengirim materi kepada kelas yang ditugaskan kepadanya.

============================================================

## 15. TABEL VIDEO_MATERI

============================================================

Nama tabel: `public.video_materi`

Fungsi: Menyimpan video pembelajaran.

Struktur:

- id UUID PRIMARY KEY
- guru_id UUID
- mata_pelajaran_id UUID
- judul TEXT
- deskripsi TEXT
- video_url TEXT
- thumbnail_url TEXT
- created_at TIMESTAMPTZ
- updated_at TIMESTAMPTZ

Contoh:

- Judul: Pengenalan HTML
- Video URL: Link YouTube atau link video lainnya

Relasi:

```
video_materi.guru_id → guru.id
video_materi.mata_pelajaran_id → mata_pelajaran.id
```

Target kelas video ditentukan melalui: `video_kelas`

============================================================

## 16. TABEL VIDEO_KELAS

============================================================

Nama tabel: `public.video_kelas`

Fungsi: Menghubungkan video pembelajaran dengan kelas.

Struktur:

- id UUID PRIMARY KEY
- video_id UUID
- kelas_id UUID
- created_at TIMESTAMPTZ

Relasi:

```
video_kelas.video_id → video_materi.id
video_kelas.kelas_id → kelas.id
```

Siswa hanya dapat melihat video yang ditujukan kepada kelasnya.

============================================================

## 17. TABEL PENGUMUMAN

============================================================

Nama tabel: `public.pengumuman`

Fungsi: Menyimpan pengumuman yang dibuat guru.

Struktur:

- id UUID PRIMARY KEY
- guru_id UUID
- judul TEXT
- isi TEXT
- created_at TIMESTAMPTZ
- updated_at TIMESTAMPTZ

Relasi:

```
pengumuman.guru_id → guru.id
```

Target kelas pengumuman ditentukan melalui: `pengumuman_kelas`

============================================================

## 18. TABEL PENGUMUMAN_KELAS

============================================================

Nama tabel: `public.pengumuman_kelas`

Fungsi: Menghubungkan pengumuman dengan kelas tujuan.

Struktur:

- id UUID PRIMARY KEY
- pengumuman_id UUID
- kelas_id UUID
- created_at TIMESTAMPTZ

Relasi:

```
pengumuman_kelas.pengumuman_id → pengumuman.id
pengumuman_kelas.kelas_id → kelas.id
```

Guru hanya boleh mengirim pengumuman kepada kelas yang diajar.

============================================================

## 19. TABEL NILAI

============================================================

Nama tabel: `public.nilai`

Fungsi: Menyimpan nilai siswa.

Struktur:

- id UUID PRIMARY KEY
- siswa_id UUID
- guru_id UUID
- mata_pelajaran_id UUID
- tugas NUMERIC
- uts NUMERIC
- uas NUMERIC
- nilai_akhir NUMERIC
- semester TEXT
- tahun_ajaran TEXT
- created_at TIMESTAMPTZ
- updated_at TIMESTAMPTZ

Relasi:

```
nilai.siswa_id → siswa.id
nilai.guru_id → guru.id
nilai.mata_pelajaran_id → mata_pelajaran.id
```

Aturan:

- Guru hanya dapat mengelola nilai sesuai kelas dan mapel yang diajarkan.
- Siswa hanya dapat melihat nilai miliknya sendiri.
- Siswa tidak boleh mengubah nilai.
- Admin dapat mengelola atau melihat nilai sesuai hak akses Admin.

============================================================

## 20. TABEL JADWAL

============================================================

Nama tabel: `public.jadwal`

Fungsi: Menyimpan jadwal pelajaran.

Struktur:

- id UUID PRIMARY KEY
- guru_id UUID
- mata_pelajaran_id UUID
- kelas_id UUID
- hari TEXT
- jam_mulai TIME
- jam_selesai TIME
- ruangan TEXT
- tahun_ajaran TEXT
- created_at TIMESTAMPTZ
- updated_at TIMESTAMPTZ

Relasi:

```
jadwal.guru_id → guru.id
jadwal.mata_pelajaran_id → mata_pelajaran.id
jadwal.kelas_id → kelas.id
```

Contoh:

- Hari: Senin
- Jam: 07:00–08:30
- Mata Pelajaran: Matematika
- Kelas: X RPL 1
- Ruangan: RPL 1

============================================================

## 21. TABEL NOTIFIKASI

============================================================

Nama tabel: `public.notifikasi`

Fungsi: Menyimpan notifikasi untuk user.

Struktur:

- id UUID PRIMARY KEY
- profile_id UUID
- judul TEXT
- pesan TEXT
- tipe TEXT
- referensi_id UUID
- is_read BOOLEAN
- created_at TIMESTAMPTZ

Relasi:

```
notifikasi.profile_id → profiles.id
```

Contoh notifikasi:

- Tugas baru telah ditambahkan
- Materi baru tersedia
- Pengumpulan tugas berhasil
- Nilai telah diperbarui
- Pengumuman baru
- Deadline tugas semakin dekat

============================================================

## 22. SUPABASE STORAGE

============================================================

Bucket Storage yang sudah dibuat:

1. `materi`
2. `tugas`
3. `pengumpulan`

Semua bucket bersifat PRIVATE.

Bucket `materi`:
Digunakan untuk menyimpan file materi pembelajaran.
Contoh: PDF, DOCX, PPTX, ZIP

Bucket `tugas`:
Digunakan untuk menyimpan lampiran tugas guru.

Bucket `pengumpulan`:
Digunakan untuk menyimpan jawaban atau file tugas siswa.

- Jangan membuat bucket baru jika bucket yang tersedia sudah cukup.
- Jangan membuat URL file publik secara sembarangan.
- Gunakan signed URL atau mekanisme akses private sesuai kebutuhan.

============================================================

## 23. RELASI DATABASE UTAMA

============================================================

```
auth.users
    ↓
profiles
    ├── guru
    │    ├── guru_mata_pelajaran
    │    ├── guru_kelas
    │    ├── tugas
    │    ├── materi
    │    ├── video_materi
    │    ├── pengumuman
    │    ├── nilai
    │    └── jadwal
    │
    └── siswa
         ├── kelas
         ├── pengumpulan_tugas
         ├── nilai
         └── notifikasi


jurusan
    ↓
kelas
    ├── siswa
    ├── guru_kelas
    ├── tugas_kelas
    ├── materi_kelas
    ├── video_kelas
    ├── pengumuman_kelas
    └── jadwal


mata_pelajaran
    ├── guru_mata_pelajaran
    ├── guru_kelas
    ├── tugas
    ├── materi
    ├── video_materi
    ├── nilai
    └── jadwal
```

============================================================

## 24. HAK AKSES ADMIN

============================================================

Admin adalah pengendali utama sistem.

Admin dapat:

- Membuat akun guru
- Membuat akun siswa
- Mengaktifkan/nonaktifkan akun
- Mengelola profile user
- Mengelola jurusan
- Mengelola kelas
- Mengelola mata pelajaran
- Mengelola data guru
- Mengelola data siswa
- Menentukan guru mengajar mata pelajaran
- Menentukan guru mengajar kelas
- Mengelola jadwal
- Melihat data tugas
- Melihat data materi
- Melihat data pengumpulan
- Melihat data nilai
- Mengelola pengumuman
- Melihat laporan sistem

Admin menentukan relasi:

```
guru → mata pelajaran → kelas
```

============================================================

## 25. HAK AKSES GURU

============================================================

Guru login menggunakan akun yang dibuat oleh Admin.

Alur setelah login:

```
auth.uid() → profiles → guru → guru_kelas → kelas dan mata pelajaran yang ditugaskan
```

Guru dapat:

- Melihat dashboard sendiri
- Membuat tugas
- Mengedit tugas sendiri
- Menghapus tugas sendiri sesuai policy
- Melihat pengumpulan tugas
- Mengunduh file pengumpulan
- Membuat materi
- Mengirim video pembelajaran
- Membuat pengumuman
- Memberikan nilai
- Melihat jadwal mengajar

Namun, guru hanya boleh mengelola data pada:

- Guru yang sedang login
- Mata pelajaran yang ditugaskan
- Kelas yang ditugaskan
- Tahun ajaran yang sesuai

Guru tidak boleh:

- Mengakses semua kelas
- Mengirim tugas ke kelas yang tidak diajar
- Mengirim materi ke kelas yang tidak diajar
- Mengirim pengumuman ke kelas yang tidak diajar
- Mengubah data guru lain
- Mengubah nilai secara sembarangan
- Melihat data siswa di luar kelas yang diajar

============================================================

## 26. HAK AKSES SISWA

============================================================

Siswa login menggunakan akun yang dibuat oleh Admin.

Alur setelah login:

```
auth.uid() → profiles → siswa → siswa.kelas_id → data kelas siswa
```

Siswa dapat:

- Melihat profile sendiri
- Melihat kelas sendiri
- Melihat tugas kelas sendiri
- Mengumpulkan tugas
- Melihat materi kelas sendiri
- Melihat video kelas sendiri
- Melihat pengumuman kelas sendiri
- Melihat jadwal kelas sendiri
- Melihat nilai sendiri
- Melihat notifikasi sendiri

Siswa tidak boleh:

- Melihat data siswa lain secara bebas
- Mengubah nilai
- Membuat tugas
- Membuat materi
- Membuat pengumuman
- Mengakses kelas lain
- Mengubah data guru
- Mengakses data administrasi

============================================================

## 27. ALUR PEMBUATAN AKUN GURU

============================================================

Akun guru dibuat oleh Admin.

Alur:

```
Admin login
↓
Admin membuka menu Guru
↓
Admin menambahkan guru
↓
Input data: Nama lengkap, Email, NIP
↓
Backend atau Edge Function membuat user Auth
↓
Membuat profiles dengan role guru
↓
Membuat data pada tabel guru
↓
Admin menentukan mata pelajaran
↓
Admin menentukan kelas yang diajar
↓
Menyimpan data ke: guru_mata_pelajaran, guru_kelas
↓
Guru dapat login
```

Pembuatan akun menggunakan Supabase Service Role hanya boleh dilakukan di:

- Server-side
- API route backend
- Supabase Edge Function

Jangan pernah menaruh Service Role Key di:

- React
- Next.js Client Component
- React Native
- File .env yang dikirim ke frontend

============================================================

## 28. ALUR PEMBUATAN AKUN SISWA

============================================================

Akun siswa dibuat oleh Admin.

Alur:

```
Admin login
↓
Admin membuka menu Siswa
↓
Admin menambahkan siswa
↓
Input data: Nama lengkap, NIS, Email atau username sesuai implementasi, Kelas
↓
Backend atau Edge Function membuat user Auth
↓
Membuat profiles dengan role siswa
↓
Membuat data pada tabel siswa
↓
Menghubungkan siswa ke kelas
↓
Siswa dapat login
```

============================================================

## 29. KEAMANAN RLS

============================================================

RLS sudah digunakan pada tabel utama.

AI Agent wajib memperhatikan:

- User login diidentifikasi menggunakan `auth.uid()`.
- Role dibaca dari `profiles`.
- Guru dihubungkan melalui `guru.profile_id`.
- Siswa dihubungkan melalui `siswa.profile_id`.
- Akses guru diperiksa melalui `guru_kelas`.
- Akses siswa diperiksa melalui `siswa.kelas_id`.
- Jangan hanya menyembunyikan data melalui frontend.
- Query database harus tetap aman jika dipanggil langsung.
- Jangan memberikan akses luas hanya berdasarkan role guru.
- Pastikan policy INSERT, UPDATE, DELETE, dan SELECT sesuai kebutuhan.

Pengecekan guru minimal:

```
role = guru
+ guru.profile_id = auth.uid()
+ kelas_id terdapat pada guru_kelas
+ mata_pelajaran_id sesuai penugasan guru
```

Pengecekan siswa minimal:

```
role = siswa
+ siswa.profile_id = auth.uid()
+ siswa.kelas_id sesuai kelas target
```

============================================================

## 30. ATURAN IMPLEMENTASI FITUR

============================================================

Sebelum membuat fitur baru, AI Agent wajib melakukan:

1. Menentukan tabel yang digunakan.
2. Menentukan relasi foreign key.
3. Menentukan role pengguna.
4. Menentukan user yang sedang login.
5. Menentukan kelas yang boleh diakses.
6. Menentukan mata pelajaran yang boleh diakses.
7. Memeriksa RLS yang berlaku.
8. Memeriksa apakah tabel dan kolom sudah tersedia.
9. Baru membuat kode aplikasi.

Jika fitur belum didukung oleh database:

- Jangan langsung membuat tabel baru.
- Tampilkan terlebih dahulu:
  - Masalah yang ditemukan
  - Tabel yang sudah tersedia
  - Relasi yang dapat digunakan
  - Kekurangan struktur database
  - Perubahan yang disarankan
  - Dampak perubahan terhadap aplikasi
- Tunggu persetujuan sebelum melakukan perubahan database.

============================================================

## 31. DAFTAR DATABASE YANG SUDAH TERSEDIA

============================================================

Tabel yang sudah dibuat:

1. profiles
2. jurusan
3. mata_pelajaran
4. kelas
5. guru
6. siswa
7. guru_mata_pelajaran
8. guru_kelas
9. tugas
10. tugas_kelas
11. pengumpulan_tugas
12. materi
13. materi_kelas
14. video_materi
15. video_kelas
16. pengumuman
17. pengumuman_kelas
18. nilai
19. jadwal
20. notifikasi

Supabase Storage bucket yang sudah dibuat:

21. materi
22. tugas
23. pengumpulan

Fitur keamanan yang sudah tersedia:

- Supabase Auth
- profiles untuk role
- Row Level Security
- Policy database
- Helper function role
- Helper function guru aktif
- Helper function siswa aktif
- Helper function pengecekan guru mengajar kelas
- Private Storage Bucket

============================================================

## 32. RINGKASAN ARSITEKTUR

============================================================

```
ADMIN PANEL
    ↓
Mengelola akun, master data, kelas, mapel, guru, siswa,
penugasan guru, jadwal, dan laporan.

PORTAL GURU
    ↓
Mengelola tugas, materi, video, pengumuman,
pengumpulan tugas, nilai, dan jadwal sesuai penugasan.

APLIKASI SISWA
    ↓
Melihat tugas, materi, video, pengumuman, jadwal,
nilai, notifikasi, dan mengumpulkan tugas.
```

Struktur utama:

```
ADMIN
    ↓
profiles
    ↓
guru atau siswa
    ↓
kelas dan mata pelajaran
    ↓
tugas / materi / video / pengumuman / nilai / jadwal
```
