-- Fix RLS presensi: dari USING (true) → hanya pemilik/ pengajar / admin
-- Alasan P0: anon SELECT true bocor, siswa bisa intip presensi kelas lain via curl
DROP POLICY IF EXISTS presensi_select_auth ON presensi;

CREATE POLICY presensi_select_auth ON presensi
FOR SELECT TO authenticated
USING (
  -- siswa hanya lihat miliknya sendiri
  EXISTS (SELECT 1 FROM siswa WHERE siswa.id = presensi.siswa_id AND siswa.profile_id = auth.uid())
  OR
  -- guru hanya lihat yang dia ajar (guru_id miliknya)
  EXISTS (SELECT 1 FROM guru WHERE guru.id = presensi.guru_id AND guru.profile_id = auth.uid())
  OR
  -- admin lihat semua
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);
