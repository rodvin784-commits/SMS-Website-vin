-- DEPRECATED: tabel ini tidak dipakai lagi sejak rewrite 2026-09-16
-- Migration: Tabel jadwal_pelajaran untuk fitur Jadwal Pelajaran
-- Jalankan di: Supabase Dashboard > SQL Editor
--
-- Konsep:
-- - Satu baris = satu pertemuan mingguan (hari + jam mulai-selesai)
-- - Terhubung ke guru_mengajar (guru + mapel + kelas + semester)
--   sehingga jadwal selalu konsisten dengan penugasan yang ada.

CREATE TABLE IF NOT EXISTS jadwal_pelajaran (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guru_mengajar_id UUID NOT NULL REFERENCES guru_mengajar(id) ON DELETE CASCADE,
  hari INT NOT NULL CHECK (hari BETWEEN 1 AND 6), -- 1=Senin ... 6=Sabtu
  jam_mulai TIME NOT NULL,
  jam_selesai TIME NOT NULL,
  ruangan TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT jadwal_waktu_valid CHECK (jam_selesai > jam_mulai)
);

-- Index untuk query per kelas & per guru (paling sering dipakai)
CREATE INDEX IF NOT EXISTS idx_jadwal_guru_mengajar ON jadwal_pelajaran(guru_mengajar_id);
CREATE INDEX IF NOT EXISTS idx_jadwal_hari ON jadwal_pelajaran(hari);

-- Aktifkan RLS: akses tulis hanya lewat API (service role)
ALTER TABLE jadwal_pelajaran ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jadwal_select_authenticated" ON jadwal_pelajaran;
CREATE POLICY "jadwal_select_authenticated"
  ON jadwal_pelajaran
  FOR SELECT
  TO authenticated
  USING (true);
