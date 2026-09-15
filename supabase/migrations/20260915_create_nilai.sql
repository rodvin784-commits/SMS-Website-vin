-- Migration: Tabel nilai untuk fitur Nilai/Rapor
-- Jalankan di: Supabase Dashboard > SQL Editor
--
-- Konsep:
-- - Satu baris = satu nilai siswa pada (penugasan, jenis_nilai)
-- - Komponen nilai: harian (ulangan harian), tugas, uts, uas
-- - Rapor dihitung dari rata-rata komponen (fitur ini).
-- - Unique (guru_mengajar_id, siswa_id, jenis_nilai) -> isi ulang = update.

CREATE TABLE IF NOT EXISTS nilai (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guru_mengajar_id UUID NOT NULL REFERENCES guru_mengajar(id) ON DELETE CASCADE,
  siswa_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  jenis_nilai TEXT NOT NULL CHECK (jenis_nilai IN ('harian', 'tugas', 'uts', 'uas')),
  nilai NUMERIC(5, 2) NOT NULL CHECK (nilai >= 0 AND nilai <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT nilai_unik UNIQUE (guru_mengajar_id, siswa_id, jenis_nilai)
);

-- Index untuk query per penugasan (pola GET paling sering dipakai)
CREATE INDEX IF NOT EXISTS idx_nilai_guru_mengajar ON nilai(guru_mengajar_id);
CREATE INDEX IF NOT EXISTS idx_nilai_siswa ON nilai(siswa_id);

-- Trigger updated_at otomatis (fungsi sama dengan tabel presensi)
DROP TRIGGER IF EXISTS trg_nilai_updated_at ON nilai;
CREATE TRIGGER trg_nilai_updated_at
  BEFORE UPDATE ON nilai
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- Aktifkan RLS: hanya SELECT untuk authenticated, tulis via API (service role)
ALTER TABLE nilai ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nilai_select_authenticated" ON nilai;
CREATE POLICY "nilai_select_authenticated"
  ON nilai
  FOR SELECT
  TO authenticated
  USING (true);