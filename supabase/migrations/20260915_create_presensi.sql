-- Migration: Tabel presensi untuk fitur Presensi Siswa
-- Jalankan di: Supabase Dashboard > SQL Editor
--
-- Konsep:
-- - Satu baris = satu catatan kehadiran untuk 1 siswa pada (penugasan, tanggal)
-- - Terhubung ke guru_mengajar (guru + mapel + kelas + semester), sehingga
--   guru hanya bisa mengisi presensi untuk kelas/mapel yang diampunya.
-- - Unique (guru_mengajar_id, siswa_id, tanggal) -> mengisi ulang = update,
--   tidak menimbulkan baris ganda.

CREATE TABLE IF NOT EXISTS presensi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guru_mengajar_id UUID NOT NULL REFERENCES guru_mengajar(id) ON DELETE CASCADE,
  siswa_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tanggal DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('hadir', 'terlambat', 'izin', 'sakit', 'alfa')),
  keterangan TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT presensi_unik_per_hari UNIQUE (guru_mengajar_id, siswa_id, tanggal)
);

-- Index untuk query per penugasan + tanggal (pola GET paling sering dipakai)
CREATE INDEX IF NOT EXISTS idx_presensi_guru_mengajar ON presensi(guru_mengajar_id);
CREATE INDEX IF NOT EXISTS idx_presensi_jam ON presensi(tanggal);
CREATE INDEX IF NOT EXISTS idx_presensi_siswa ON presensi(siswa_id);

-- Trigger update updated_at otomatis
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_presensi_updated_at ON presensi;
CREATE TRIGGER trg_presensi_updated_at
  BEFORE UPDATE ON presensi
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- Aktifkan RLS: hanya SELECT untuk authenticated, tulis via API (service role)
ALTER TABLE presensi ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "presensi_select_authenticated" ON presensi;
CREATE POLICY "presensi_select_authenticated"
  ON presensi
  FOR SELECT
  TO authenticated
  USING (true);