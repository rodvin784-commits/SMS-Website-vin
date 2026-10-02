-- Presensi sederhana (butuh approve user — 2026-09-24)
-- 1 row per (siswa, tanggal, mapel). Guru hanya input untuk kelas yang diajar (via guru_kelas).
-- RLS: enable, policy via service_role (API route), SELECT authenticated.

CREATE TABLE IF NOT EXISTS presensi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  siswa_id UUID NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  kelas_id UUID NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
  guru_id UUID NOT NULL REFERENCES guru(id) ON DELETE CASCADE,
  mata_pelajaran_id UUID NOT NULL REFERENCES mata_pelajaran(id) ON DELETE CASCADE,
  tanggal DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('hadir','izin','sakit','alpha')),
  keterangan TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(siswa_id, tanggal, mata_pelajaran_id)
);

CREATE INDEX IF NOT EXISTS idx_presensi_kelas_tanggal ON presensi(kelas_id, tanggal);
CREATE INDEX IF NOT EXISTS idx_presensi_siswa ON presensi(siswa_id);

ALTER TABLE presensi ENABLE ROW LEVEL SECURITY;
-- Izinkan SELECT authenticated (data dibatasi server-side via guru_kelas / siswa.kelas_id)
DROP POLICY IF EXISTS presensi_select_auth ON presensi;
CREATE POLICY presensi_select_auth ON presensi FOR SELECT TO authenticated USING (true);
-- INSERT/UPDATE/DELETE hanya via service_role (API route)
