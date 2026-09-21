# Catatan Progres: Jawaban Teks Pengumpulan Tugas (SILAHKAN LANJUTKAN DARI SINI)

> Ditulis: 2026-09-19. Update 2026-09-21: **BLOCKER SELESAI — kolom `jawaban_teks` sudah ter-apply & terverifikasi via service role (`select id,jawaban_teks` → OK rows=0). Build + lint + typecheck + tests (14/14 & 20/20) lulus.**
> Rencana lengkap: `~/.qoder/plans/northern-delta-otter.md` (approved).

## Tujuan fitur

1. Siswa bisa **mengirim jawaban tugas berupa TEKS** (dan/atau file; minimal salah satu) dari APK siswa (`siswa_apk_by_vin_kuadrat`) lewat `POST /api/siswa/pengumpulan`.
2. Jawaban teks **tampil di APK siswa** dan **dapat dilihat guru** di modal pengumpulan panel guru.
3. Gejala awal "daftar tugas kosong di APK" = **masalah data, bukan bug kode**: semua tugas yang ada ditujukannya ke kelas `RPL` (id `719e1450…`), padahal kelas siswa Vinzent = `XI-PRL` (id `ec2a82b6…`). Solusi: guru **Andi Kurniawan** (punya guru_kelas XI-PRL × mapel "Pemprograman Laravel") membuat & mem-publish tugas dengan target XI-PRL.

## Yang sudah dikerjakan (SEMUA code change sudah dilakukan & lolos `npm run check` + `npm run test:run` di kedua repo)

### Backend (`project-tim-vin-vines/`)

| File | Perubahan |
|---|---|
| `supabase/migrations/20260922_add_jawaban_teks_to_pengumpulan_tugas.sql` | BARU: `ALTER TABLE pengumpulan_tugas ADD COLUMN IF NOT EXISTS jawaban_teks TEXT;` — **SUDAH TER-APPLY 2026-09-21 (verifikasi: `c.from('pengumpulan_tugas').select('id,jawaban_teks')` → OK, round-trip insert teks saja → PASS, update full-replace → PASS, cleanup OK)** |
| `app/api/siswa/pengumpulan/route.ts` | POST: `file` opsional (part size 0 dianggap tidak ada), parse `jawaban_teks` (cap 10.000 karakter), validasi baru "Isi jawaban teks atau unggah file jawaban." (400); full-replace: tanpa file → `file_url/nama_file` null + object storage lama dihapus SETELAH update DB sukses; insert/update ikut `jawaban_teks`. GET `?tugas_id=` mengembalikan `jawaban_teks` |
| `lib/siswa-query.ts` | select `getPengumpulanSiswa` += `jawaban_teks` |
| `app/api/siswa/tugas/route.ts` | embed `pengumpulan` (tipe + mapping) += `jawaban_teks` |
| `app/api/teacher/pengumpulan/route.ts` | GET select/tipe/payload += `jawaban_teks` (`has_file` tetap); POST download tidak diubah (sudah 400 saat `file_url` null) |
| `components/teacher/TugasManager.tsx` | kolom tabel "File" → **"Jawaban"**: tampilkan `jawaban_teks` (whitespace-pre-line, line-clamp-4) + tombol unduh hanya bila `has_file`; `—` hanya bila keduanya kosong; tipe `SiswaPengumpulan.pengumpulan` += `jawaban_teks` |
| `scripts/e2e-siswa.js` | Seksi 5 diperluas: (a) POST tanpa file & teks → 400, (b) file → 201 (lama), (c) **teks saja → 201 + round-trip `jawaban_teks` via GET /tugas + `nama_file` jadi null (full-replace) + download → 400** |
| `DATABASE_CONTEXT.md` | #12: kolom `jawaban_teks TEXT` + aturan "file dan/atau teks, minimal satu (ditegakkan di API route)" |
| `README.md` | baris migrations + endpoint `/api/siswa/pengumpulan` & `/api/teacher/pengumpulan` diupdate; section "Riwayat Pembaruan → 2026-09-22 — Jawaban teks pada pengumpulan tugas siswa" |

### APK siswa (`siswa_apk_by_vin_kuadrat/`)

| File | Perubahan |
|---|---|
| `src/lib/types.ts` | `TugasItem.pengumpulan` += `jawaban_teks: string \| null` |
| `src/lib/api.ts` | `uploadPengumpulan(tugasId, file: File \| null, jawabanTeks, catatan, onProgress?)` — append `file`/`jawaban_teks`/`catatan` hanya bila terisi; tetap XHR tanpa set Content-Type |
| `src/screens/TugasScreen.tsx` | state form `{ jawaban, catatan }` per-open (**fix bug lama: `catatan` shared antar item**); textarea "Tulis jawaban di sini…" (rows 4) + hint "File opsional"; submit validasi file-atau-teks; progress bar hanya saat ada file; tombol label "Kirim Jawaban"; kartu tugas menampilkan "Jawaban saya: <teks>" (pre-line); tombol "⬇ Jawaban saya" (unduh) hanya bila `pengumpulan.nama_file` ada |

## BLOCKER UTAMA — ✅ SELESAI 2026-09-21

**Sebelumnya terblokir:** `ERROR 42703 column pengumpulan_tugas.jawaban_teks does not exist` di project `xlbadglpenrmhsfvccvj.supabase.co`.

**2026-09-21 verifikasi ulang:** `c.from('pengumpulan_tugas').select('id,jawaban_teks').limit(1)` → `OK rows=0` (tidak error). Script verifikasi round-trip (`insert jawaban_teks teks saja → select → update dengan file → guru view has_file → delete`) semua **PASS** dan data uji sudah di-cleanup. Jadi migrasi sekarang sudah benar-benar apply di project yang dipakai aplikasi.

## Verifikasi 2026-09-21 (sudah dilakukan)

- `npm run check` (lint + tsc) di kedua repo → **lulus** (0 error)
- `npm run test:run` → **14/14** (project-tim-vin-vines) & **20/20** (siswa_apk) lulus; `npm run build` keduanya sukses
- DB: `select id,jawaban_teks` OK + round-trip teks saja + full-replace → **PASS** (script `_verify_jawaban.mjs`, sudah cleanup)

## Verifikasi yang MASIH PERLU manual (user action)

Perintah cek API (harus menampilkan "KOLOM TERLIHAT API, oke"):

```bash
cd project-tim-vin-vines && node -e "/* skrip cek singkat: */
const fs=require('fs');const env={};for(const l of fs.readFileSync('.env.local','utf8').split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);if(m)env[m[1]]=m[2].replace(/^[\"']|[\"']$/g,'')}
const {createClient}=require('@supabase/supabase-js');const c=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
c.from('pengumpulan_tugas').select('id,jawaban_teks').limit(1).then(r=>console.log(r.error?('ERROR: '+r.error.message):'KOLOM TERLIHAT API, oke'));"
```

1. **E2E script**: butuh akun & tugas uji — `siswa.e2e@sekolah.sch.id` saat ini TIDAK ada di DB (dibuat otomatis oleh skrip). Kelas e2e "E2E RPL" dibuat skrip bila `.test-ids.json` kosong, tapi tidak ada tugas published utk kelas itu → seksi upload akan di-skip. Untuk menguji jawaban teks lewat skrip: buat tugas published utk kelas e2e (atau pakai cara manual di bawah).
   ```bash
   # terminal 1
   cd project-tim-vin-vines && NEXT_PUBLIC_MOBILE_ORIGIN="http://localhost:5173" npm run dev -- -p 3210
   # terminal 2
   cd project-tim-vin-vines && E2E_SISWA_PASS=<isi> E2E_GURU_PASS=<isi> node scripts/e2e-siswa.js http://localhost:3210
   ```
2. **Manual end-to-end (paling penting — menjawab keluhan user)**:
   - Login guru **Andi Kurniawan** → `/teacher/tugas` → buat tugas mapel **Pemprograman Laravel**, kelas **XI-PRL**, status **published**.
   - APK siswa (Vite: `VITE_API_BASE_URL=http://localhost:3210`, `npm run dev`, port 5173): login siswa **Vinzent** → tugas muncul → isi **teks saja** → "Kirim Jawaban" → badge Terkumpul + teks "Jawaban saya:" tampil.
   - Panel guru: modal pengumpulan tugas tsb → kolom Jawaban menampilkan teks, tanpa tombol unduh.
   - Submit ulang dengan file → tombol unduh muncul, teks lama tertimpa (full-replace), object storage lama terhapus.
3. Test password utk e2e/akun uji di-reset via service role oleh skrip (perilaku bawaan `e2e-siswa.js`) — jangan pakai password itu untuk akun asli; akun asli Vinzent/Andi jangan di-reset passwordnya (verifikasi manual pakai password mereka dari user).

## Fakta DB terkait (hasil probe read-only)

- kelas: `XI-PRL` = `ec2a82b6-f7f8-41be-a7ee-e3098ad7aa59` (kelas Vinzent), `RPL` = `719e1450…`, `KULINER 2`, `DKV 1`
- tugas existing: "Tugas Uji 1" (closed) & "[E2E] Tugas Berlampiran" (published) — dua-duanya tugas_kelas → `RPL` (bukan XI-PRL → sebab daftar APK kosong)
- guru_kelas: Andi Kurniawan × XI-PRL × "Pemprograman Laravel" (2026/2027) ✓ siap publish
- bucket storage private: `materi`, `tugas`, `pengumpulan` (path jawaban: `${siswaId}/${tugasId}/${ts}-${rand}.${ext}`)
