-- Migration: Fix kurusan typo + tambah updated_at
-- Jalankan di: Supabase Dashboard > SQL Editor

-- 1. Tambah kolom updated_at di mata_pelajaran
ALTER TABLE mata_pelajaran
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- 2. Update updated_at = created_at untuk data existing
UPDATE mata_pelajaran SET updated_at = created_at WHERE updated_at IS NULL;

-- 3. Buat function untuk auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 4. Pasang trigger di mata_pelajaran
DROP TRIGGER IF EXISTS update_mata_pelajaran_updated_at ON mata_pelajaran;
CREATE TRIGGER update_mata_pelajaran_updated_at
  BEFORE UPDATE ON mata_pelajaran
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
