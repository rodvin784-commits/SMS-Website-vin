-- DEPRECATED: tabel ini tidak dipakai lagi sejak rewrite 2026-09-16
-- Migration: Tambah kolom semester di guru_mengajar
-- Jalankan di: Supabase Dashboard > SQL Editor
-- Catatan: tahun_ajaran sudah ada di tabel kelas.

-- 1. Tambah kolom semester (Ganjil/Genap) dengan default 'ganjil'
ALTER TABLE guru_mengajar
ADD COLUMN IF NOT EXISTS semester text DEFAULT 'ganjil';

-- 2. Backfill data existing (anggap semester Ganjil)
UPDATE guru_mengajar SET semester = 'ganjil' WHERE semester IS NULL;