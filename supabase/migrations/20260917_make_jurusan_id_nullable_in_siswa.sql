-- Migration: Make jurusan_id nullable in siswa table
-- Jalankan di: Supabase Dashboard > SQL Editor
--
-- Solusi error: "null value in column jurusan_id of relation siswa violates not-null constraint"
-- Mengubah jurusan_id dari NOT NULL menjadi NULLABLE terlebih dahulu agar siswa bisa dibuat tanpa jurusan_id.
-- 
-- Catatan: Jika Anda ingin menghubungkan siswa ke jurusan:
-- 1. Jalankan migration ini terlebih dahulu
-- 2. Buat data jurusan melalui menu Admin → Jurusan
-- 3. Buat migration berikutnya untuk mengisi jurusan_id siswa berdasarkan kelas yang dipilih

ALTER TABLE siswa
ALTER COLUMN jurusan_id DROP NOT NULL;
