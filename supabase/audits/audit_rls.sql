-- ============================================================
-- AUDIT RLS — jalankan di Supabase Dashboard > SQL Editor
-- Script ini READ-ONLY (tidak mengubah apa pun).
-- Hasilnya menunjukkan kondisi keamanan aktual database kamu.
-- ============================================================

-- 1. Status RLS semua tabel publik
--    alarm: rls_aktif = false berarti tabel TERBUKA untuk anon key!
SELECT
  c.relname                          AS tabel,
  c.relrowsecurity                   AS rls_aktif,
  COALESCE(p.jumlah_policy, 0)       AS jumlah_policy
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN (
  SELECT tablename, COUNT(*) AS jumlah_policy
  FROM pg_policies
  WHERE schemaname = 'public'
  GROUP BY tablename
) p ON p.tablename = c.relname
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
ORDER BY c.relname;

-- 2. Detail policy per tabel (kosong = tidak ada policy sama sekali)
SELECT
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual IS NOT NULL  AS ada_using,
  with_check IS NOT NULL AS ada_with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 3. Daftar tabel dan pemiliknya (mendeteksi tabel yang dibuat bypass)
SELECT tablename, tableowner
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- 4. Cek tabel yang dipakai aplikasi ini secara khusus
--    (tabel-tabel utama sesuai DATABASE_CONTEXT.md)
SELECT
  c.relname AS tabel,
  c.relrowsecurity AS rls_aktif
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN (
    'profiles', 'mata_pelajaran', 'kelas', 'jurusan',
    'guru_kelas', 'siswa', 'guru', 'nilai', 'jadwal',
    'materi', 'materi_kelas', 'tugas', 'tugas_kelas',
    'pengumpulan_tugas', 'video_materi', 'video_kelas',
    'pengumuman', 'pengumuman_kelas', 'notifikasi',
    'guru_mata_pelajaran'
  )
ORDER BY c.relname;
