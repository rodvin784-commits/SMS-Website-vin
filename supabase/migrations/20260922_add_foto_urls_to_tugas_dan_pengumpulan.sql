-- Tambah dukungan foto untuk tugas (guru) dan pengumpulan (siswa)
-- Foto disimpan sebagai path di bucket private `tugas` / `pengumpulan`, mirip lampiran/file
-- Kolom berupa array TEXT agar bisa menyimpan multi-foto (maks 5 di API)

ALTER TABLE public.tugas
  ADD COLUMN IF NOT EXISTS foto_urls TEXT[] DEFAULT NULL;

ALTER TABLE public.pengumpulan_tugas
  ADD COLUMN IF NOT EXISTS foto_urls TEXT[] DEFAULT NULL;

-- komentar kolom
COMMENT ON COLUMN public.tugas.foto_urls IS 'Array path foto di bucket `tugas` (private), dibuat saat guru buat tugas dengan foto';
COMMENT ON COLUMN public.pengumpulan_tugas.foto_urls IS 'Array path foto jawaban di bucket `pengumpulan` (private), dibuat saat siswa kumpul dengan foto';
