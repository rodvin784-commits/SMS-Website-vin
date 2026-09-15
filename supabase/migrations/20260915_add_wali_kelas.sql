-- Migration: Wali kelas (homeroom teacher)
-- Jalankan di: Supabase Dashboard > SQL Editor
--
-- - kelas.wali_kelas_id → profiles.id (ON DELETE SET NULL agar hapus guru tidak merusak kelas)
-- - Wali kelas = guru yang bertanggung jawab atas satu kelas (berbeda dari guru pengampu
--   yang diatur di tabel guru_mengajar per mapel + kelas).
-- - Setiap guru idealnya hanya wali dari satu kelas; unique index parsial menegakkan itu.

ALTER TABLE kelas
ADD COLUMN IF NOT EXISTS wali_kelas_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_kelas_wali_kelas_id ON kelas(wali_kelas_id);

-- Satu guru hanya boleh menjadi wali satu kelas (baris dengan NULL dikecualikan)
CREATE UNIQUE INDEX IF NOT EXISTS uq_kelas_wali_aktif
  ON kelas(wali_kelas_id)
  WHERE wali_kelas_id IS NOT NULL;
