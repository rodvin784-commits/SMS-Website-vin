-- Migration: Tambah kolom deskripsi di tabel mata_pelajaran
-- Jalankan di: Supabase Dashboard > SQL Editor

ALTER TABLE mata_pelajaran
ADD COLUMN IF NOT EXISTS deskripsi text;
