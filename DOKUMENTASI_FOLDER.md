# Dokumentasi Projek - Project Tim by Vin-Vines

Tanggal: 2026-09-24 (update terbaru — P0/P1/P2 hardening & perf)

---

## 1. project-tim-vin-vines

**Jenis:** Aplikasi web full-stack (Next.js)
**Fungsi:** Sistem manajemen sekolah (Admin, Guru, Siswa)

### Teknologi
- Next.js (App Router)
- Supabase (database & auth)
- TypeScript
- Vitest (testing)

### Struktur Folder

```
project-tim-vin-vines/
├── app/
│   ├── admin/                  # Halaman admin
│   │   ├── dashboard/
│   │   ├── jadwal/
│   │   ├── jurusan/
│   │   ├── kelas/
│   │   ├── mata-pelajaran/
│   │   └── users/
│   ├── api/
│   │   ├── admin/              # API admin (dashboard, jadwal, jurusan, kelas, mata-pelajaran, users)
│   │   ├── siswa/              # API siswa (dashboard, jadwal, materi + download, nilai, notifikasi, pengumuman, tugas + download, video, pengumpulan)
│   │   └── teacher/            # API guru (jadwal, materi, mengajar, nilai, pengumpulan, pengumuman, tugas, video)
│   ├── teacher/                # Halaman guru
│   │   ├── dashboard/
│   │   ├── jadwal/
│   │   ├── mata-pelajaran/
│   │   ├── materi/
│   │   ├── nilai/
│   │   ├── pengumuman/
│   │   └── tugas/
│   ├── login/                  # Halaman login
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
│   ├── admin/                  # Komponen admin (CreateUserModal, EditUserModal, JadwalManager, dll)
│   ├── teacher/                # Komponen guru (AssignmentCard, JadwalMengajar, MateriAjarManager, dll)
│   ├── layout/                 # AppShell
│   └── ui/                     # Komponen UI (Badge, Button, Input, Modal, Select, dll)
├── hooks/                      # Custom hooks (useFeedback, useKelasOptions)
├── lib/                        # Utility (api-admin, guru-auth, siswa-auth, siswa-query, notifikasi, supabase, dll)
├── scripts/                    # Scripts (seed-test, e2e-siswa)
├── supabase/
│   ├── migrations/             # SQL migrations
│   │   ├── 20260909_add_deskripsi_to_mata_pelajaran.sql
│   │   ├── 20260909_add_updated_at_and_fix_kurusan.sql
│   │   ├── 20260910_enable_rls_and_policies.sql
│   │   ├── 20260915_add_kelas_id_to_profiles.sql
│   │   ├── 20260915_add_wali_kelas.sql
│   │   ├── 20260915_create_materi_kelas.sql
│   │   ├── 20260915_create_nilai.sql
│   │   └── 20260917_make_jurusan_id_nullable_in_siswa.sql  ← NEW!
│   └── audits/                 # Audit RLS
├── tests/                      # Unit tests
├── public/                     # Gambar (gambar1.png, gambar2.png, gambar3.png)
├── middleware.ts               # Middleware auth
├── package.json
├── next.config.ts
├── tsconfig.json
└── vitest.config.ts
```

### Fitur Utama
- **Admin:** Kelola users, jadwal, jurusan, kelas, mata pelajaran
- **Guru:** Kelola jadwal mengajar, materi, tugas, nilai, pengumuman, video
- **Siswa:** Lihat jadwal, materi, tugas, nilai, notifikasi, pengumuman, video, pengumpulan tugas

### Updates Terbaru (2026-09-21) — Sederhana: penandaan & P0 awam (siap kembang)
- **Penandaan & penamaan mudah:** tambah header `//` di setiap file inti agar pengembang baru paham struktur: `project-tim-vin-vines/components/layout/AppShell.tsx:1` (AppShell = sidebar+header+main), `components/ui/StatCard.tsx:1`, `lib/teacher-nav.ts:1` (sumber tunggal menu guru), `app/login/page.tsx:1` (alur Auth→cek role→redirect). `use client` tetap baris 1 agar build Next 16 tidak error (Turbopack).
- **P0 awam web:** `app/login/page.tsx:141` link dead `href="#"` "Lupa Kata Sandi?" → ganti `<span> Lupa? Hubungi admin</span>` (sederhana, tidak bikin harapan palsu).
- **Terverifikasi:** `npm run build` Next OK (48 route), `tsc` bersih. Siap untuk pengembangan lanjutan — jangan tambah fitur berat sebelum P0 ini di-merge.

### Updates Terbaru (2026-09-19)
- **Bug fix unduh lampiran tugas siswa:** route baru `app/api/siswa/tugas/download/route.ts` — aplikasi mobile memanggil `POST /api/siswa/tugas/download` tapi sebelumnya handler signed-URL masih menempel di `POST /api/siswa/tugas` sehingga selalu 404. `scripts/e2e-siswa.js` ikut disesuaikan.
- **Fitur notifikasi siswa kini aktif:** helper baru `lib/notifikasi.ts` (best-effort, kegagalan notifikasi tidak membatalkan aksi utama). Notifikasi dibuat saat: tugas dipublikasikan (POST maupun transisi draft→published via PUT), materi baru, video baru, pengumuman baru (ke semua siswa kelas target via `siswa.kelas_id`), dan nilai diperbarui (ke siswa yang nilainya berubah). Tipe: `tugas` / `materi` / `video` / `pengumuman` / `nilai`.
- **Fitur edit jadwal admin:** `PUT /api/admin/jadwal` (validasi hari & jam, cek bentrok kelas + guru dengan pengecualian baris sendiri, `guru_kelas_id` opsional = pertahankan penugasan lama) + tombol edit (✏️) dan modal edit di `components/admin/JadwalManager.tsx`.
- **Cleanup:** dead code `jurusan_id` di `app/api/admin/users/route.ts` dihapus (insert siswa sudah memakai lookup yang benar) — lint warning 0.
- **Terverifikasi:** lint 0 error, `tsc --noEmit` bersih, 14/14 test lulus, endpoint baru smoke-test via dev server (guard 401/403 berfungsi).
- **Masih terbuka (butuh keputusan):** RLS belum diterapkan pada tabel produktif (`guru_kelas`, `tugas`, `notifikasi`, dst. — migration lama hanya menyentuh tabel mati `guru_mengajar`); origin CORS untuk APK release (`http://localhost` tanpa port) belum masuk whitelist `NEXT_PUBLIC_MOBILE_ORIGIN`.

### Updates Terbaru (2026-09-23) — Fix CORS APK + RLS lengkap (perkuat backend)
- **Fix CORS APK release:** `project-tim-vin-vines/.env.local:6` `NEXT_PUBLIC_MOBILE_ORIGIN` tambah `http://localhost,https://localhost` (ditambah `capacitor://localhost` & `http://localhost:5173` yang sudah ada). Penyebab `Failed to fetch https://sms-website-one.vercel.app/api/siswa/me` di LDPlayer: origin Android Capacitor `http://localhost` tanpa port diblokir `middleware.ts:15`. Vercel env sudah diupdate Config + Redeploy Ready (Washington build 20:47). APK `fence12@gmail.com` / `12345678` kini login OK.
- **RLS lengkap:** migration baru `supabase/migrations/20260923_enable_rls_remaining_tables.sql:1` enable RLS 14 tabel produktif yang bolong: `guru`, `siswa`, `guru_mata_pelajaran`, `guru_kelas`, `tugas`, `tugas_kelas`, `pengumpulan_tugas`, `materi`, `video_materi`, `video_kelas`, `pengumuman`, `pengumuman_kelas`, `jadwal`, `notifikasi` (khusus `notifikasi` policy `USING (profile_id=auth.uid())`). Dijalankan di SQL Editor: `Success. No rows returned`. Verifikasi via `supabase/audits/audit_rls.sql:9` — semua `rls_aktif=true`.
- **Debug APK:** `siswa_apk_by_vin_kuadrat/src/lib/api.ts:43` sempat dibikin detail `[URL :: detail]` + `src/lib/format.ts:6` bypass `::` untuk diagnosa, sudah direvert ke pesan ramah `Koneksi terputus` setelah fix. `npm run build` Vite & Next OK, test 20/20 & 14/14 lulus, Vercel 48 routes Ready.
- **Password test:** `fence12@gmail.com` direset ke `12345678` (service_role) untuk verifikasi end-to-end (Supabase Auth + `/api/siswa/me` 200).
- **Audit hardening 2026-09-23 (lanjutan):** storage 3 bucket `materi/tugas/pengumpulan` `public:false` (anon list `200 []` kosong ✓, signed URL), guru validasi `lib/guru-auth.ts:118` `isAssigned` dipakai di `app/api/teacher/tugas/route.ts:221`, `materi:148`, `video`, `nilai`, `pengumuman:52` (`getKelasDiajar`), siswa isolasi `lib/siswa-query.ts:32` semua query filter `kelasId`/`siswaId` + RLS `notifikasi_select_own` `USING (profile_id=auth.uid())`.
- **Perf render & DB:** APK `src/App.tsx:1` `React.lazy` + `Suspense` + `vite.config.ts:6` `manualChunks (vendor-react/supabase)` + splash `2100→1400ms` `SplashScreen.tsx:13` + keep-alive tabs `display:none` + `cacheDashboard` stale-while-revalidate `lib/cache.ts:71` + prefetch idle tabs; Web `app/api/siswa/dashboard/route.ts:41` `Cache-Control private 15s` + `next.config.ts:26` `avif/webp`; DB `supabase/migrations/20260923_add_indexes_and_dashboard_rpc.sql:1` 16 index + RPC `get_dashboard_stats`; admin filter `app/admin/users/page.tsx:33` fix double fetch → single fetch + filter client instant, stats global tidak jadi 0, UI minimalis `Semua/Guru/Siswa` + status `Aktif`.

### Updates Terbaru (2026-09-24) — P0/P1/P2 Hardening & Perf (review Tech Lead)
- **P0-1 PATCH pengumpulan:** `app/api/siswa/pengumpulan/route.ts:98` ganti full-replace → PATCH scoped: `hasJawabanTeks/hasCatatan/hasHapusFoto` via `form.has()`, `existing` pertahankan jika tidak dikirim; `nextFotoUrls` hanya null jika `hapus_foto=true` atau ada foto baru; validasi `hasContentAfterPatch`. Cegah data loss teks-only hapus 5 foto.
- **P0-2 Middleware:** `middleware.ts:11` CORS fail-closed (`null` jika `origin` tidak whitelist/`MOBILE_ORIGINS` kosong → 403), `Vary: Origin`, `matcher` tambah `/api/admin/:path*`, role guard `/admin` hanya admin, `/teacher` hanya guru (via `profiles.role`).
- **P0-3 Kelas & Jadwal:** `app/api/admin/kelas/route.ts:149` duplikat check pakai `.is()` untuk null, PUT hitung `final*` dari `current` (hapus bug `tingkat ??0`), DELETE cek `siswa.kelas_id`; `app/api/admin/jadwal/route.ts:69` `activeKelasIds.length===0` return kosong (jangan bocorkan semua), PUT validasi `tahun_ajaran` required, DELETE verifikasi exist 404.
- **P0-4/5:** `app/api/siswa/dashboard/route.ts:33` fix `select('*',count)`; `lib/api-admin.ts:17` `serverError` generic (jangan bocorkan `err.message`).
- **P1-1 Batch & Parallel:** `lib/guru-auth.ts:138` `areAllAssigned()` batch 1 query `IN`; pakai di `teacher/tugas:220,486`, `materi:147,288`, `video:148,284`; `teacher/tugas` foto parallel `Promise.all`, `siswa/tugas/download:56` validasi `foto_index` integer + parallel `createSignedUrl`, `lib/siswa-query.ts:473` `getPengumpulanBatch()` 1 query vs N, `siswa/tugas/route.ts:32` `Cache-Control private 15s`.
- **P1-2 Cache-Control:** `app/api/siswa/{materi,video,pengumuman,jadwal,nilai}/route.ts` semua `private, max-age=15, stale-while-revalidate=30`.
- **P1-3 Guard:** `teacher/tugas:232,449` block `html/svg/js/exe` lampiran, `deadline: null` (bukan `now()`), `limit 100` di `teacher/tugas/materi/video` & pagination guard `admin/users?limit 200`; APK `src/lib/cache.ts:1` scoped `siswa_cache_<uid>_*` + `setSiswaScope`/`clearAllCacheIncludingScope`, `App.tsx:6` wiring login/logout; `NilaiManager.tsx:100` debounce 400ms `tahunAjaran`.
- **P2 Clean:** `lib/utils.ts:1` `pickOne` shared, `hooks/useTeacherAuth.ts:1` DRY 7 page guru (`tugas/materi/nilai/jadwal/pengumuman/mata-pelajaran/dashboard` 40→3 baris), `hooks/useAdminMutate.ts:1` & `hooks/useDebouncedValue.ts:1`, `KelasManager.tsx:133` & `JurusanManager.tsx:76` hapus double filter server+client, `App.tsx:133` keep-alive `display:none` → conditional render, `usePollingNotifikasi.ts:32` pause jika `visibilityState !== visible`.
- **P2 Sisa (2026-09-24 lanjut):** `app/admin/users/page.tsx:3` debounce 300ms `debouncedSearch` + pagination client 20/page (`currentPage`, `pagedUsers`, `Prev/Next`), `siswa_apk/src/hooks/usePollingNotifikasi.ts` sudah visibility, `lib/utils.ts` siap untuk semua `pickOne`.

### Updates Sebelumnya (2026-09-17)
- **Migration baru:** `20260917_make_jurusan_id_nullable_in_siswa.sql` — Fix constraint error saat membuat siswa
- **API Update:** `app/api/admin/users/route.ts` — Auto-ambil `jurusan_id` dari kelas yang dipilih
- **Bug Fixes:** 12 file diperbaiki untuk bug frontend (downloadLampiranTugas, double fetchMe, loading cache, dll)

---

## 2. siswa_apk_by_vin_kuadrat

**Jenis:** Aplikasi frontend mobile-style (Vite + React)
**Fungsi:** Aplikasi siswa (siswa mobile app)

### Teknologi
- Vite
- React + TypeScript
- Supabase (client)
- Vitest (testing)

### Struktur Folder

```
siswa_apk_by_vin_kuadrat/
├── src/
│   ├── screens/                # Halaman-halaman
│   │   ├── DashboardScreen.tsx
│   │   ├── JadwalScreen.tsx
│   │   ├── LoginScreen.tsx
│   │   ├── MateriScreen.tsx
│   │   ├── NilaiScreen.tsx
│   │   ├── NotifikasiScreen.tsx
│   │   ├── PengumumanScreen.tsx
│   │   ├── TugasScreen.tsx
│   │   └── VideoScreen.tsx
│   ├── lib/                    # Utility
│   │   ├── api.ts              # Fungsi API
│   │   ├── cache.ts            # Cache management
│   │   ├── env.ts              # Environment config
│   │   ├── format.ts           # Format helpers
│   │   ├── notification.ts     # Notifikasi
│   │   ├── supabase.ts         # Supabase client
│   │   └── types.ts            # TypeScript types
│   ├── App.tsx                 # Root component
│   ├── App.css
│   ├── main.tsx                # Entry point
│   └── index.css
├── public/                     # favicon.svg, icons.svg
├── dist/                       # Build output
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── vitest.config.ts
├── CHANGELOG.md                # Documentasi perubahan versi
└── README.md
```

### Fitur Utama
- Login siswa
- Dashboard siswa
- Lihat jadwal pelajaran
- Lihat materi & video
- Lihat tugas & pengumpulan
- Lihat nilai
- Lihat notifikasi & pengumuman

### Updates Terbaru (2026-09-21) — Sederhana: penandaan & P0 awam (siap kembang)
- **Splash anti-tabrakan:** `src/components/layout/SplashScreen.tsx:1,113,124` — timeline `DURATION 2100ms`, logo `scale 2.2` hold 0.58–1.51s, teks `splashTextIn .55s 1.58s` + loader `splashLoaderIn .45s 1.72s` dengan `opacity:0` awal. Hasil: selama animasi **hanya logo** tampil, teks/loader muncul setelah logo mengecil → tidak bertabrakan. Build Vite OK.
- **P0 awam APK:** `src/screens/DashboardScreen.tsx:42,139,152` kartu Materi/Video sebelumnya `onClick={()=>{}}` kosong → sekarang `onOpenMateri`/`onOpenVideo` (di-inject dari `src/App.tsx:104`) + `aria-label`; `src/App.tsx:67` logout tambah `window.confirm` sederhana; `src/components/tugas/FotoPicker.tsx:1` header maks 5 foto 8MB/foto.
- **Penandaan & penamaan mudah:** header `/** */` di `src/App.tsx:1` (alur Splash→Login→Welcome→AppShell), `src/screens/DashboardScreen.tsx:1`, `src/screens/TugasScreen.tsx:1`, `src/screens/LoginScreen.tsx:1`, `src/screens/WelcomeScreen.tsx:1`, `src/components/layout/BottomNav.tsx:2` (TABS terpusat), `src/components/layout/AppHeader.tsx:1`, `src/components/ui/Card.tsx:1`/`Button.tsx:1`. Nama prop konsisten `onOpenX` agar mudah dipahami pengembang baru.
- **Terverifikasi:** `tsc -b && vite build` OK, tidak ada perubahan breaking; siap untuk pengembangan lanjutan.

### Updates Terbaru (2026-09-19) — Perbaikan 16 error (lint + build)
- **Bug App.tsx:** `handleNotifCountChange` dipakai tapi tidak pernah didefinisikan (build gagal) → diganti `setUnreadCount` (stabil, cocok untuk prop `onCountChange`).
- **`react-hooks/set-state-in-effect` (8 error) di 7 layar** (Dashboard, Jadwal, Materi, Nilai, Notifikasi, Pengumuman, Video): pola `muat()` yang memanggil `setState` sinkron di dalam `useEffect` diganti — fetch dipindah ke `async function init()` di dalam effect (semua `setState` setelah `await`), ditambah counter `muatUlang` di state agar tombol "Coba lagi" tetap memicu reload penuh dengan spinner.
- **TugasScreen:** ref callback React 19 tidak boleh mengembalikan nilai → `ref={(el) => { fileRefs.current[t.id] = el }}`.
- **LoginScreen:** `onSuccess: (me: any)` → tipe `Me` dari `lib/types`.
- **Import/fungsi mati dihapus:** `MdSearch` (App), `useCallback` (Dashboard), `isYoutubeUrl` (VideoScreen).
- **Catatan QA:** `npm run typecheck` (`tsc --noEmit`) di proyek ini TIDAK memeriksa apa pun karena `tsconfig.json` solution-style (`"files": []`) — gunakan `tsc -b` / `npm run build`.
- **Terverifikasi:** lint 0 error, `tsc -b` bersih, build sukses, 20/20 test lulus.

### Updates Sebelumnya (2026-09-17)
- **Bug Fixes (12 file):**
  - `api.ts`: Fix endpoint downloadLampiranTugas, hapus dead code, auto Content-Type
  - `App.tsx`: Fix double fetchMe(), hapus tombol search, hapus handleNotifCountChange boilerplate
  - `LoginScreen.tsx`: Hapus assertConfig() yang redundant
  - `MateriScreen.tsx` & `JadwalScreen.tsx`: Fix loading spinner menutupi cache
  - `VideoScreen.tsx`: Fix logic URL non-YouTube, tambah sandbox iframe
  - `DashboardScreen.tsx`: Stat-card clickable, jam real-time
  - `TugasScreen.tsx`: Gunakan fileRefs per tugas
  - `NotifikasiScreen.tsx`: useCallback + fixed dependency array
  - `format.ts`: Preserve server error message
  - `App.css`: Typo fixed + dead CSS removed
  - `index.html`: lang="id" + PWA meta tags

### Cara Menjalankan
```bash
cd siswa_apk_by_vin_kuadrat
npm install
npm run dev
```

---

## Hubungan Kedua Projek

Kedua projek ini saling melengkapi:
- **project-tim-vin-vines** = Backend + Frontend lengkap (Admin, Guru, Siswa) berbasis Next.js
- **siswa_apk_by_vin_kuadrat** = Frontend khusus siswa (mobile-style) yang terhubung ke backend yang sama (Supabase)

Kedua-duanya menggunakan Supabase sebagai database dan memiliki fitur-fitur yang berkaitan dengan sistem manajemen sekolah.

---

## 3. Cara Push ke Git (2 repo terpisah)

> Folder `D:\project tim by vin-vines\` **bukan** git repo. Yang punya `.git` adalah sub-folder `project-tim-vin-vines` dan `siswa_apk_by_vin_kuadrat` masing-masing dengan remote berbeda. Push harus per-repo.

### A. Cek status
```bash
# Web (Next.js)
cd "D:\project tim by vin-vines\project-tim-vin-vines"
git status
git remote -v
# APK (Vite)
cd "D:\project tim by vin-vines\siswa_apk_by_vin_kuadrat"
git status
git remote -v
```

### B. Push Web
```bash
cd "D:\project tim by vin-vines\project-tim-vin-vines"
git add app/login/page.tsx components/layout/AppShell.tsx components/ui/StatCard.tsx lib/teacher-nav.ts DOKUMENTASI_FOLDER.md
# atau jika DOKUMENTASI ada di parent, copy dulu atau add dari parent: git -C "D:\project tim by vin-vines" tidak akan work karena parent bukan repo — cukup commit file di dalam repo saja
git status
git diff --staged
git commit -m "docs: penandaan sederhana + fix lupa sandi dead-link (siap kembang)"
git pull --rebase origin main
git push origin main
```

### C. Push APK
```bash
cd "D:\project tim by vin-vines\siswa_apk_by_vin_kuadrat"
git add src/App.tsx src/screens/DashboardScreen.tsx src/components/layout/SplashScreen.tsx src/components/layout/BottomNav.tsx src/components/layout/AppHeader.tsx src/components/tugas/FotoPicker.tsx src/components/ui/Card.tsx src/components/ui/Button.tsx src/screens/LoginScreen.tsx src/screens/WelcomeScreen.tsx src/screens/TugasScreen.tsx
git status
git diff --staged
git commit -m "fix(apk): splash hanya logo saat animasi + hubung kartu Materi/Video + penandaan siap kembang"
git pull --rebase origin main
git push origin main
```

### D. Update dokumentasi pusat
`DOKUMENTASI_FOLDER.md` ada di parent (bukan repo). Untuk melacaknya, copy ke tiap repo atau commit manual:
```bash
# opsi sederhana: copy ke web repo lalu push
copy "D:\project tim by vin-vines\DOKUMENTASI_FOLDER.md" "D:\project tim by vin-vines\project-tim-vin-vines\DOKUMENTASI_FOLDER.md"
cd "D:\project tim by vin-vines\project-tim-vin-vines"
git add DOKUMENTASI_FOLDER.md
git commit -m "docs: update DOKUMENTASI 2026-09-21 splash & penandaan"
git push origin main
```

### Tips
- Selalu `git pull --rebase` sebelum `push` untuk hindari conflict.
- Gunakan pesan commit jelas: `fix:`, `feat:`, `docs:`.
- Jangan push `node_modules`, `.env.local`, `dist/` — sudah di `.gitignore`.
- Jika `remote` belum ada: `git remote add origin https://github.com/USERNAME/REPO.git`.
