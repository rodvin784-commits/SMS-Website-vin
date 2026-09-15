-- Migration: Tabel materi_kelas untuk fitur Materi & Video Pembelajaran guru
-- Jalankan di: Supabase Dashboard > SQL Editor
--
-- Konsep:
-- - Satu baris = satu materi/bab yang diunggah guru untuk satu penugasan
--   (guru_mengajar = guru + mapel + kelas + semester).
-- - video_url: tautan YouTube/Google Drive/LMS lain (bukan upload file),
--   opsional. Disimpan sebagai teks.
-- - materi_url: opsional, tautan dokumen (Google Docs/Slides/PDF) jika guru
--   ingin menyimpan modul di luar aplikasi.
-- - Siswa nanti membaca/menonton lewat API siswa (READ saja).

CREATE TABLE IF NOT EXISTS materi_kelas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guru_mengajar_id UUID NOT NULL REFERENCES guru_mengajar(id) ON DELETE CASCADE,
  judul TEXT NOT NULL,
  deskripsi TEXT,
  video_url TEXT,
  materi_url TEXT,
  status BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index untuk query utama: daftar materi per penugasan (guru) dan per kelas (siswa)
CREATE INDEX IF NOT EXISTS idx_materi_kelas_guru_mengajar ON materi_kelas(guru_mengajar_id);

-- Trigger updated_at otomatis (fungsi set_updated_at sudah ada dari migration sebelumnya)
DROP TRIGGER IF EXISTS trg_materi_kelas_updated_at ON materi_kelas;
CREATE TRIGGER trg_materi_kelas_updated_at
  BEFORE UPDATE ON materi_kelas
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- Aktifkan RLS: SELECT untuk authenticated (siswa & guru membaca lewat UI),
-- semua tulisan hanya via API (service role)
ALTER TABLE materi_kelas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "materi_kelas_select_authenticated" ON materi_kelas;
CREATE POLICY "materi_kelas_select_authenticated"
  ON materi_kelas
  FOR SELECT
  TO authenticated
  USING (true);
