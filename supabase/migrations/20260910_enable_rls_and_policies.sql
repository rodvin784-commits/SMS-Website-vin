-- ============================================================
-- MIGRATION: Aktifkan RLS + policy untuk semua tabel aplikasi
-- Jalankan di: Supabase Dashboard > SQL Editor
--
-- Prinsip keamanan:
-- - Anon key (browser) HANYA boleh SELECT data yang memang perlu
--   ditampilkan di UI (statistik, profil sendiri, mapel/kelas aktif).
-- - SEMUA penulisan (INSERT/UPDATE/DELETE) hanya lewat API routes
--   yang memakai service role + adminCheck() — jadi NO semuanya.
-- - guru_mengajar mengikuti akses profiles (dibaca lewat UI guru/admin).
-- ============================================================

-- ============================================================
-- 1. PROFILES
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Kebijakan dasar: siapa pun yang sudah login boleh melihat
-- sebagian kolom profiles — TIDAK termasuk role/status milik orang lain.
-- (Supabase tidak punya column-level security, jadi kita putuskan:
--  login = boleh baca baris. Data sensitif role/status dikelola API.)

DROP POLICY IF EXISTS "profiles_select_authenticated" ON profiles;
CREATE POLICY "profiles_select_authenticated"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Login page butuh membaca role & status milik SENDIRI setelah signIn.
-- (Sudah tercakup policy di atas, tapi diperjelas di sini:
--  kebijakan per-user sendiri tidak diperlukan terpisah karena
--  policy SELECT di atas mengizinkan semua authenticated.)

-- Anon (belum login) TIDAK BOLEH apa pun:
DROP POLICY IF EXISTS "profiles_select_anon" ON profiles;

-- Tidak ada policy INSERT/UPDATE/DELETE untuk anon/authenticated:
-- semua penulisan lewat service role (API).

-- ============================================================
-- 2. MATA PELAJARAN
-- ============================================================
ALTER TABLE mata_pelajaran ENABLE ROW LEVEL SECURITY;

-- Mapel aktif boleh dibaca user yang login (dipakai dashboard & guru)
DROP POLICY IF EXISTS "mapel_select_authenticated" ON mata_pelajaran;
CREATE POLICY "mapel_select_authenticated"
  ON mata_pelajaran
  FOR SELECT
  TO authenticated
  USING (true);

-- Anon tidak boleh (dashboard admin di belakang login, jadi aman)
DROP POLICY IF EXISTS "mapel_select_anon" ON mata_pelajaran;

-- ============================================================
-- 3. KELAS
-- ============================================================
ALTER TABLE kelas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kelas_select_authenticated" ON kelas;
CREATE POLICY "kelas_select_authenticated"
  ON kelas
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "kelas_select_anon" ON kelas;

-- ============================================================
-- 4. JURUSAN
-- ============================================================
ALTER TABLE jurusan ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jurusan_select_authenticated" ON jurusan;
CREATE POLICY "jurusan_select_authenticated"
  ON jurusan
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "jurusan_select_anon" ON jurusan;

-- ============================================================
-- 5. GURU_MENGAJAR
-- ============================================================
ALTER TABLE guru_mengajar ENABLE ROW LEVEL SECURITY;

-- Guru boleh melihat penugasan (API guru juga membaca via service role,
-- tapi policy ini untuk konsistensi jika suatu saat query langsung)
DROP POLICY IF EXISTS "guru_mengajar_select_authenticated" ON guru_mengajar;
CREATE POLICY "guru_mengajar_select_authenticated"
  ON guru_mengajar
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "guru_mengajar_select_anon" ON guru_mengajar;

-- ============================================================
-- RINGKASAN
-- ============================================================
-- | Tabel          | anon  | authenticated | service_role (API) |
-- |----------------|-------|---------------|--------------------|
-- | profiles       | -     | SELECT        | ALL (bypass RLS)   |
-- | mata_pelajaran | -     | SELECT        | ALL (bypass RLS)   |
-- | kelas          | -     | SELECT        | ALL (bypass RLS)   |
-- | jurusan        | -     | SELECT        | ALL (bypass RLS)   |
-- | guru_mengajar  | -     | SELECT        | ALL (bypass RLS)   |
--
-- Semua INSERT/UPDATE/DELETE hanya via API (service role).
