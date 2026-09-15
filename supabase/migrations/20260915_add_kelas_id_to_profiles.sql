-- Migration: Hubungkan siswa ke kelas
-- Jalankan di: Supabase Dashboard > SQL Editor
--
-- - profiles.kelas_id → kelas.id (ON DELETE SET NULL agar hapus kelas tidak menghapus user)
-- - Hanya bermakna untuk role 'siswa'; guru/admin dibiarkan NULL.

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS kelas_id UUID REFERENCES kelas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_kelas_id ON profiles(kelas_id);