# Sistem Manajemen Sekolah (SMS)

Admin panel untuk pengelolaan data sekolah — guru, siswa, mata pelajaran, kelas, dan jurusan.

## Tech Stack

- **Framework:** Next.js 16.3 + React 19
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth + custom middleware
- **UI:** Tailwind CSS v4, lucide-react icons
- **Language:** TypeScript

## Struktur Database

### Tabel Utama

| Tabel | Fungsi |
|---|---|
| `profiles` | Data pengguna (guru, siswa, admin) |
| `mata_pelajaran` | Daftar mata pelajaran (kode, nama, deskripsi, status) |
| `kelas` | Daftar kelas (nama, tingkat, tahun ajaran) |
| `jurusan` | Daftar jurusan |
| `guru_mengajar` | Tabel junction many-to-many: guru ↔ mata_pelajaran + kelas |

### Relasi

```
profiles (guru) ──1:N──► guru_mengajar ◄──N:1── mata_pelajaran
                                  │
                                  └──N:1── kelas
```

### Kolom Penting

- `mata_pelajaran.status` — `true` = aktif, `false` = nonaktif
- `mata_pelajaran.updated_at` — timestamp terakhir diperbarui (via trigger)
- `profiles.status` — `true` = aktif, `false` = nonaktif

## Routes

### Admin (`/admin/*`)

| Route | Fungsi |
|---|---|
| `/admin/dashboard` | Dashboard utama |
| `/admin/users` | Manajemen pengguna (guru & siswa) |
| `/admin/mata-pelajaran` | Manajemen mata pelajaran |
| `/admin/kelas` | Manajemen kelas |
| `/admin/jurusan` | Manajemen jurusan |

### API (`/api/admin/*`)

| Endpoint | Method | Fungsi |
|---|---|---|
| `/api/admin/users` | GET/POST/PUT/DELETE | CRUD pengguna (PUT mendukung reset password opsional) |
| `/api/admin/mata-pelajaran` | GET/POST/PUT/DELETE | CRUD mata pelajaran + guru pengampu |
| `/api/admin/mata-pelajaran/[id]/penugasan` | GET/POST/PUT/DELETE | Kelola penugasan guru per mapel (kelas + semester + materi) |
| `/api/admin/kelas` | GET/POST/PUT/DELETE | CRUD kelas |
| `/api/admin/jurusan` | GET/POST/PUT/DELETE | CRUD jurusan |

### Auth & Middleware

- Middleware di `proxy.ts` melindungi route `/admin/*` dan `/teacher/*`
- `adminCheck()` di `lib/supabase-server.ts` — cek apakah user adalah admin
- Hanya admin yang bisa akses semua API dan halaman admin

## Flow Penugasan Guru

1. **Buat akun guru** — Manajemen Pengguna → Tambah Pengguna → isi data → Simpan
2. **Buat mata pelajaran** — Manajemen Mata Pelajaran → Tambah Mata Pelajaran → isi kode, nama, deskripsi → Simpan
3. **Detail modal terbuka otomatis** — Atur guru pengampu langsung dari sini:
   pilih guru + kelas + semester (+ materi opsional) → Simpan
4. **Edit/hapus penugasan** — di modal detail yang sama; edit materi & semester per baris penugasan
5. **Hapus akun guru** — penugasannya di `guru_mengajar` ikut terhapus otomatis

> Catatan: reset password guru/siswa dilakukan lewat Manajemen Pengguna → Edit → field "Password Baru" (kosongkan jika tidak diubah).

## Perubahan Terakhir

### Mata Pelajaran — Detail View & Nonaktifkan

- **Detail Modal** — Klik baris mata pelajaran → lihat info lengkap:
  - Kode, nama, status, deskripsi
  - Daftar guru pengampu + kelas yang diampu per guru
  - Daftar semua kelas yang terkait
  - Tanggal dibuat & terakhir diperbarui

- **Nonaktifkan (Soft Delete)**
  - Tombol "Nonaktifkan" (ikon archive) mengubah `status` ke `false`
  - Konfirmasi: "Apakah Anda yakin ingin menonaktifkan mata pelajaran ini?"
  - Mata pelajaran nonaktif tidak muncul di pilihan penugasan guru
  - Penugasan yang sudah ada tetap tersimpan

- **Hapus Permanen**
  - Hanya bisa dilakukan pada mata pelajaran yang sudah nonaktif
  - Jika masih ada penugasan (guru_mengajar), hapus ditolak
  - Konfirmasi: "Hapus permanen? Tindakan ini tidak dapat dibatalkan."

### API Mata Pelajaran

- Single join query: `mata_pelajaran` → `guru_mengajar` → `profiles` + `kelas`
- Response termasuk `guru_pengampu[]` (dengan `kelas[]` per guru) dan `kelas_list[]`
- Validasi: `kode` max 20 karakter, `nama` max 100 karakter
- `updated_at` otomatis terupdate via PostgreSQL trigger

### Migration

```sql
-- Tambah kolom deskripsi
ALTER TABLE mata_pelajaran
ADD COLUMN IF NOT EXISTS deskripsi TEXT;

-- Tambah kolom updated_at + trigger
ALTER TABLE mata_pelajaran
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE OR REPLACE FUNCTION update_mata_pelajaran_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER mata_pelajaran_updated_at
  BEFORE UPDATE ON mata_pelajaran
  FOR EACH ROW
  EXECUTE FUNCTION update_mata_pelajaran_updated_at();
```

### Fix Bug Kritis

- `app/api/admin/kelas/route.ts` — Typo `jurusan:kurusan(...)` → `jurusan:jurusan(...)`
  - Sebelumnya semua kelas menampilkan "Tanpa Jurusan" meskipun `jurusan_id` terisi

## Running

```bash
npm run dev
```

Buka http://localhost:3000/admin

## Catatan Penting

- Gunakan branch `feat/tambah-guru-dengan-mapel` untuk开发 fitur
- Branch `backup-sebelum-fitur-tambah-guru` adalah backup sebelum perubahan
- Semua API admin dilindungi oleh `adminCheck()` — tidak bisa diakses tanpa login admin
- Role yang tersedia: `admin`, `guru`, `siswa`
