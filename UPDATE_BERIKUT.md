# Update Berikut — Integrasi Akun Belajar `smk.belajar.id` (Khusus Siswa) — VERSI 10/10 AUTO-LOGIN

Tanggal: 2026-09-25 (update 10/10 — Google One-Tap + Session Persistent)
Status: Rencana 10/10 — siap eksekusi (siswa only, guru menyusul)
Domain: `smk.belajar.id` (khusus siswa, guru tetap password)
Repo: `project-tim-vin-vines` (web Next.js) + `siswa_apk_by_vin_kuadrat` (APK) — Splash 2000ms

---

## 1. Tujuan (10/10 — Paling Mudah)
Siswa buka APK → langsung masuk tanpa ketik apa pun jika HP sudah login Google `smk.belajar.id`. Pakai akun Google Belajar (`xxx@smk.belajar.id`) yang sudah ada. Tetap patuhi `DATABASE_CONTEXT.md:10` — akun dibuat Admin, Google hanya sebagai metode login (OAuth), bukan registrasi bebas. Satu kali login, sesi persistent sampai logout.

## 2. Keputusan Penting
- **JANGAN minta password Google siswa.** Password akun belajar bersifat pribadi & dikelola Google Workspace Kemdikbud. Admin hanya butuh **email + nama lengkap + NIS + kelas**.
- Sumber daftar email: export CSV dari `admin.google.com → Users` via operator sekolah (kolom: email, nama, kelas) atau rekap wali kelas.
- Guru tetap login `email+password` seperti sekarang (`app/login/page.tsx:17`), integrasi Google guru ditunda.

## 3. Perubahan Data & Admin Flow
- `lib/school-email.ts:3` default domain untuk siswa jadi `smk.belajar.id` (auto-generate: `Budi Santoso` → `budi.santoso@smk.belajar.id`). Guru tetap editable / fallback `sekolah.sch.id`.
- `components/admin/CreateUserModal.tsx:74` auto-fill email dari nama (sudah ada, flag `emailEdited` + tombol `↻ Auto`). Untuk siswa OAuth, field password jadi dummy/random auto-generate 16 char (tidak dipakai) — admin tidak perlu input manual, hidden di UI siswa-only.
- `app/api/admin/users/route.ts:137` email saat create siswa **wajib sama persis** dengan `smk.belajar.id` (validasi `endsWith('@smk.belajar.id')`). Jika tidak sama, Google login akan ditolak.
- Rencana tambahan: `Import CSV/Excel` massal (upload 300+ siswa sekaligus) — wajib untuk 10/10, agar admin tidak input 1-1.

## 4. Login — Teknis 10/10 (Supabase Google OAuth + One-Tap Auto-Login + Fallback Hidden)
- Supabase Dashboard → `Auth → Providers → Google` enable, isi `Client ID/Secret` dari Google Cloud Console.
- Google Cloud Console → `APIs & Services → Credentials → OAuth 2.0` → `Authorized redirect URI`: `https://xlbadglpenrmhsfvccvj.supabase.co/auth/v1/callback`
- Env: `NEXT_PUBLIC_GOOGLE_RESTRICTED_DOMAIN=smk.belajar.id` (hardcode `hd=smk.belajar.id` di OAuth).
- **APK — Flow 10/10 (`siswa_apk_by_vin_kuadrat/src/App.tsx:35,71,103`):**
  1. `SplashScreen.tsx:14` 2000ms tetap.
  2. `App.tsx:71` `supabase.auth.getSession()` → jika ada sesi valid (siswa sudah pernah login Google & belum logout) → langsung `fetchMe()` → `setShowWelcome(true)` → **skip Login**, buka APK = langsung `Welcome → Dashboard` (0 tap).
  3. Jika `!sesi.me` → `LoginScreen.tsx:51` tampil tombol besar **primary** `Masuk dengan Akun Belajar @smk.belajar.id` (logo Google) → `supabase.auth.signInWithOAuth({ provider:'google', options:{ redirectTo: capacitor deep link / web callback, queryParams:{ hd:'smk.belajar.id', prompt:'select_account' } } })`. Via `Capacitor Browser` / system browser yang sudah login Google → 1 tap tanpa ketik email.
  4. Form `email+password` lama tidak dihapus tapi disembunyikan di `<details><summary>Cara lain: Masuk dengan password</summary>` — fallback jika Google down / akun belum sync.
  5. `LoginScreen.tsx:94` footer `Hubungi admin` jadi tombol WA `wa.me/62xxx` langsung chat.
- **Web (`app/login/page.tsx`)**: guru/admin tetap `email+password` seperti sekarang. Siswa di web jika buka → blok `app/login/page.tsx:69` tetap, arahkan ke APK (atau jika mau buka, tampilkan Google-only juga dengan validasi sama).
- **Callback** `app/auth/callback/route.ts` (baru, web) & deep link handler APK exchange code → `getProfileRole()` (`lib/supabase-server.ts:108`) cek `profiles`:
  - Jika `profiles` belum ada → `signOut()` + pesan `Akun belum terdaftar, hubungi admin` (blok auto-register liar, patuhi `DATABASE_CONTEXT.md:10`).
  - Jika `status=false` → tolak `Akun dinonaktifkan`.
  - Jika `role=siswa` valid → lanjut `WelcomeScreen.tsx:16`.
- **One-Tap (opsional next):** `google.accounts.id.initialize` untuk auto prompt tanpa klik, jika HP sudah login Google — bisa ditambah setelah OAuth stabil.
- `middleware.ts:85` tetap verifikasi `getUser()` + role guard. Untuk `/api/siswa/*` tetap pakai `Authorization: Bearer` dari APK.

## 5. Nama Depan Saja
- DB tetap simpan `profiles.nama_lengkap` full. Tampilkan `nama_lengkap.split(' ')[0]` di UI (`components/layout/AppShell.tsx:1`, dashboard guru/siswa).
- Dari Google `user_metadata.given_name` bisa dipakai fallback saat provisioning.

## 6. Langkah Operator & Siswa (10/10 — 0 Ketik)
1. Operator export daftar siswa dari Google Admin (`email`, `nama`) → kirim CSV ke Admin web.
2. Admin web import/create user dengan email `smk.belajar.id` tersebut + NIS + Kelas (via modal `CreateUserModal.tsx:74` atau Import CSV massal).
3. Siswa install APK → buka:
   - Jika HP sudah login Google `smk.belajar.id` & pernah login sekali → `Splash (2s) → Welcome → Dashboard` (0 tap, auto-login).
   - Jika belum → `Splash → Login` → tap 1x `Masuk dengan Akun Belajar @smk.belajar.id` → pilih akun Google → `Welcome → Dashboard` (1 tap, tanpa ketik password).
4. Tidak ada pengumpulan password Google. Sesi persistent sampai `Keluar` (`App.tsx:93` confirm).

## 7. Checklist 10/10 — Butuh Persetujuan
- [x] Domain final `smk.belajar.id` siswa only (guru menyusul)
- [ ] Akses Google Cloud untuk buat OAuth Client (butuh admin Workspace `smk.belajar.id`)
- [ ] APK Google OAuth via `Capacitor Browser` + deep link `capacitor://localhost` (sudah ada di `NEXT_PUBLIC_MOBILE_ORIGIN`)
- [ ] Setuju password dummy auto-random untuk siswa OAuth (hidden) + Import CSV massal?
- [ ] Update `NEXT_PUBLIC_SCHOOL_EMAIL_DOMAIN=smk.belajar.id` di `.env.local` & Vercel env
- [ ] Tombol WA Hubungi Admin di `LoginScreen.tsx:94` (isi nomor WA admin)
- [ ] Siswa tetap APK only (web blok `app/login/page.tsx:69`) — tidak buka login siswa di web?

## 8. File Terkait (10/10)
- `lib/school-email.ts:1` — helper generate email (siswa `smk.belajar.id`)
- `components/admin/CreateUserModal.tsx:1` — modal tambah user (auto + dummy password)
- `app/api/admin/users/route.ts:1` — API create user (validasi domain)
- `siswa_apk_by_vin_kuadrat/src/App.tsx:1` — Splash 2000ms → Welcome → Dashboard (auto-login check)
- `siswa_apk_by_vin_kuadrat/src/screens/LoginScreen.tsx:1` — tombol Google primary + form fallback hidden
- `siswa_apk_by_vin_kuadrat/src/components/layout/SplashScreen.tsx:1` — animasi
- `siswa_apk_by_vin_kuadrat/src/screens/WelcomeScreen.tsx:1` — sapa setelah login
- `app/login/page.tsx:1` — web login guru/admin (siswa blok)
- `app/auth/callback/route.ts:1` — (baru) exchange code + cek profiles
- `lib/supabase-server.ts:1` — `getProfileRole()` & `getSessionUser()`
- `middleware.ts:1` — CORS + role guard
- `DATABASE_CONTEXT.md:1` — source of truth

---
## 9. Kenapa Ini 10/10 (vs Form Biasa)
- Form `email+password` berdampingan = siswa bingung, salah ketik, lupa password web vs Google → support naik.
- Google primary + auto-login = 0-1 tap, tanpa ketik, tanpa hafal password baru. Session persistent = buka APK langsung masuk. Fallback password tetap ada tapi hidden.

## 10. Struktur Akun Guru & Kepala Sekolah — Apakah Harus Ikut Struktur?
- **Guru WAJIB ikut struktur** `guru → guru_mata_pelajaran → guru_kelas` (`DATABASE_CONTEXT.md:7-9`) agar `lib/guru-auth.ts:118 isAssigned` & RLS `20260923_enable_rls_remaining_tables.sql:1` jalan. Tapi ringan: 1 guru = 2-4 baris `guru_kelas` (contoh `Budi - MTK → X RPL 1, X RPL 2`), total 30 guru ≈ 100 baris.
- Alur: `Tambah Guru` (`components/admin/CreateUserModal.tsx:40`, `app/api/admin/users/route.ts:223`) → isi `nama,email,NIP` → lalu `Mata Pelajaran → Detail → Guru Pengampu` centang kelas. 2 langkah, 1 menit/guru. Tidak bikin web besar — cuma relasi, bukan modul baru.
- Tanpa struktur (guru akses semua kelas) = bisa tapi langgar `DATABASE_CONTEXT.md:16` & rawan salah edit nilai kelas lain. Bisa tambah toggle `Guru akses semua` jika sekolah kecil & mau simpel — opsional.
- **Kepala Sekolah & jajaran tidak wajib semua dibuat.** Saat ini `profiles.role` hanya `admin|guru|siswa` (`DATABASE_CONTEXT.md:118`):
  - Opsi simpel (rekomendasi tahap 1): Kepsek = `admin` (1 akun, full akses dashboard), Wakasek/TU = `admin` atau `guru` sesuai kebutuhan. Cukup 3-5 akun struktural, tidak perlu `kapsek, wakasis, wakur` semua.
  - Opsi hierarki (tahap 2 jika diminta): tambah role `kepsek` (read-only laporan, approve), `wakasek`, `tu` → tambah `middleware.ts:107` guard + RLS. Baru perlu jika Kepsek mau monitoring terpisah tanpa hak hapus.
- Kesimpulan: Buat akun hanya untuk yang **butuh login** (Kepsek jika mau monitoring, Wakasek jika kelola jadwal/nilai, TU jika input presensi/SPP). Tidak perlu buat semua jabatan.

---

## 11. Update Hari Ini — 2026-09-25 (Pisah Login + P0 Security + Import CSV Live)

**Ringkasan push hari ini `main` web `610b388` + APK `4fc54f2`:**

- **Domain:** `lib/school-email.ts:4` default `sekolah.sch.id` → `smk.belajar.id` (auto `budi.santoso@smk.belajar.id`) — commit `73ad7a2`
- **Import Massal CSV:** `app/api/admin/users/bulk/route.ts:1` POST max 200, validasi `@smk.belajar.id` + NIS + kelas aktif, auto-password 12 char; `components/admin/BulkImportModal.tsx:1` template `nama,email,nis`, preview, pilih kelas untuk semua baris; `app/admin/users/page.tsx:297` tombol `Import CSV` — commit `4e91a7c`
- **Google OAuth 10/10:** `app/auth/callback/route.ts:1` exchange code + enforce hd + cek profiles (blok auto-register); `siswa_apk_by_vin_kuadrat/src/screens/LoginScreen.tsx:86` tombol besar Google primary + form password hidden `details` + WA `wa.me`; `lib/school-email.ts:42` & `components/admin/CreateUserModal.tsx:164` password siswa opsional auto; `App.tsx:71` auto-login tetap — commit `6c2fc97` (web) + `4fc54f2` (APK)
- **Pisah Login Admin/Guru:** `/admin/login` baru `app/admin/login/page.tsx:1` khusus admin (block guru), `/login` jadi khusus guru (block admin → `/admin/login`), `middleware.ts:92,102` redirect terpisah, `app/admin/layout.tsx:12` bypass AppShell untuk `/admin/login` (fix hamburger nongol) — commit `8cc68c5` + `fedc5cb`
- **Bersih Teks Login:** `app/login/page.tsx:113,147` hapus `Admin? Login Admin`, `app/admin/login/page.tsx:58,70` hapus `Guru? Login Guru` + `Lupa? Hubungi super admin` — commit `c55fcb3`, `7b02c85`, `7755c2c`
- **P0 Security:** `lib/login-rate-limit.ts:1` 5 gagal/15 menit per email (admin=`admin`, guru=`guru`), `app/admin/login/page.tsx:17` & `app/login/page.tsx:17` cek block + `console.warn`, `next.config.ts:18` `X-Robots-Tag: noindex` untuk `/admin/login` (CSP/HSTS sudah ada) — commit `610b388`
- **Google Cloud:** Project `SMK-Bagimu-Negeriku` org `smk.belajar.id` dibuat, OAuth `Web application` Client ID `527789...apps.googleusercontent.com`, Supabase `Providers→Google` Enabled + `URL Configuration` `https://sms-website-one.vercel.app/auth/callback` + `capacitor://localhost` — terverifikasi di dashboard
- **Dok:** `docWeb/` + `docApk/` sejajar web/apk (92KB+31KB), `dokumentasi/` lama dihapus, duplikat dipertahankan (source tetap di repo)
- **Build:** `tsc` bersih, `npm run build` 59 routes (`/admin/login`, `/auth/callback`) OK, Vercel deploy `main` live

**Next:** tes login Google `smk.belajar.id` real (1 siswa sudah dibuat), lalu P1 audit log / export rapor jika diminta.

Catatan: Jangan commit `.env.local` & jangan minta password Google siswa.
