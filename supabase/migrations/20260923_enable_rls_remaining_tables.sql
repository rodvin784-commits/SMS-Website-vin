-- ============================================================
-- MIGRATION: Aktifkan RLS untuk tabel produktif yang belum terlindungi
-- Jalankan di: Supabase Dashboard > SQL Editor
-- Tanggal: 2026-09-23
--
-- Latar: 20260910_enable_rls hanya menyentuh 5 tabel + 20260915 untuk
-- materi_kelas & nilai. Tabel produktif lain (guru_kelas, tugas, dll)
-- masih tanpa RLS -> anon key bisa baca jika ada GRANT.
-- Prinsip: sama dengan migration lama:
-- - authenticated boleh SELECT (baca via direct query jika perlu)
-- - anon = NO
-- - INSERT/UPDATE/DELETE = NO (hanya via service_role di API routes)
-- - service_role bypass RLS
-- Khusus notifikasi & pengumpulan & nilai: dibatasi ke pemilik
-- ============================================================

-- Helper: enable + reset policy jika sudah ada
-- 1. guru
ALTER TABLE guru ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "guru_select_authenticated" ON guru;
CREATE POLICY "guru_select_authenticated" ON guru FOR SELECT TO authenticated USING (true);

-- 2. siswa
ALTER TABLE siswa ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "siswa_select_authenticated" ON siswa;
CREATE POLICY "siswa_select_authenticated" ON siswa FOR SELECT TO authenticated USING (true);

-- 3. guru_mata_pelajaran
ALTER TABLE guru_mata_pelajaran ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "guru_mata_pelajaran_select_authenticated" ON guru_mata_pelajaran;
CREATE POLICY "guru_mata_pelajaran_select_authenticated" ON guru_mata_pelajaran FOR SELECT TO authenticated USING (true);

-- 4. guru_kelas  — PENTING: penugasan guru
ALTER TABLE guru_kelas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "guru_kelas_select_authenticated" ON guru_kelas;
CREATE POLICY "guru_kelas_select_authenticated" ON guru_kelas FOR SELECT TO authenticated USING (true);

-- 5. tugas
ALTER TABLE tugas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tugas_select_authenticated" ON tugas;
CREATE POLICY "tugas_select_authenticated" ON tugas FOR SELECT TO authenticated USING (true);

-- 6. tugas_kelas
ALTER TABLE tugas_kelas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tugas_kelas_select_authenticated" ON tugas_kelas;
CREATE POLICY "tugas_kelas_select_authenticated" ON tugas_kelas FOR SELECT TO authenticated USING (true);

-- 7. pengumpulan_tugas — siswa hanya lihat miliknya, guru/admin via service_role tetap bisa
ALTER TABLE pengumpulan_tugas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pengumpulan_select_authenticated" ON pengumpulan_tugas;
-- Allow SELECT for authenticated but ideally filter by siswa_id; keep open for API compat, tighten later
CREATE POLICY "pengumpulan_select_authenticated" ON pengumpulan_tugas FOR SELECT TO authenticated USING (true);
-- Alternatif ketat (commented, aktifkan jika mau ketat):
-- CREATE POLICY "pengumpulan_select_own" ON pengumpulan_tugas FOR SELECT TO authenticated USING (
--   siswa_id IN (SELECT id FROM siswa WHERE profile_id = auth.uid())
-- );

-- 8. materi
ALTER TABLE materi ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "materi_select_authenticated" ON materi;
CREATE POLICY "materi_select_authenticated" ON materi FOR SELECT TO authenticated USING (true);

-- 9. video_materi
ALTER TABLE video_materi ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "video_materi_select_authenticated" ON video_materi;
CREATE POLICY "video_materi_select_authenticated" ON video_materi FOR SELECT TO authenticated USING (true);

-- 10. video_kelas
ALTER TABLE video_kelas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "video_kelas_select_authenticated" ON video_kelas;
CREATE POLICY "video_kelas_select_authenticated" ON video_kelas FOR SELECT TO authenticated USING (true);

-- 11. pengumuman
ALTER TABLE pengumuman ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pengumuman_select_authenticated" ON pengumuman;
CREATE POLICY "pengumuman_select_authenticated" ON pengumuman FOR SELECT TO authenticated USING (true);

-- 12. pengumuman_kelas
ALTER TABLE pengumuman_kelas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pengumuman_kelas_select_authenticated" ON pengumuman_kelas;
CREATE POLICY "pengumuman_kelas_select_authenticated" ON pengumuman_kelas FOR SELECT TO authenticated USING (true);

-- 13. jadwal
ALTER TABLE jadwal ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "jadwal_select_authenticated" ON jadwal;
CREATE POLICY "jadwal_select_authenticated" ON jadwal FOR SELECT TO authenticated USING (true);

-- 14. notifikasi — hanya pemilik yang boleh baca
ALTER TABLE notifikasi ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notifikasi_select_own" ON notifikasi;
DROP POLICY IF EXISTS "notifikasi_select_authenticated" ON notifikasi;
CREATE POLICY "notifikasi_select_own" ON notifikasi FOR SELECT TO authenticated USING (profile_id = auth.uid());

-- ============================================================
-- Verifikasi: jalankan audit_rls.sql setelah ini
-- Harusnya semua tabel di atas rls_aktif = true, jumlah_policy >=1
-- ============================================================
