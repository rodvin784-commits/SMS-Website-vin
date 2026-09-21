-- Migration: Jawaban teks untuk pengumpulan tugas
-- Jalankan di: Supabase Dashboard > SQL Editor
--
-- - pengumpulan_tugas.jawaban_teks: jawaban tertulis siswa (pengganti/pelengkap file).
-- - Aturan bisnis "file ATAU teks wajib" ditegakkan di API route (service role), bukan DB.
-- - Baris lama tetap jawaban_teks NULL = pengumpulan berbasis file.

ALTER TABLE pengumpulan_tugas
ADD COLUMN IF NOT EXISTS jawaban_teks TEXT;
