-- ============================================================
-- MIGRATION: Indexes + RPC dashboard agar render & fetch DB lebih cepat
-- Jalankan di: Supabase Dashboard > SQL Editor
-- Tanggal: 2026-09-23
-- Tujuan: percepat query siswa (kelas_id) & dashboard Promise.all
-- ============================================================

-- 1. INDEXES: foreign keys & filter populer (IF NOT EXISTS agar idempoten)
CREATE INDEX IF NOT EXISTS idx_siswa_kelas_id ON siswa(kelas_id);
CREATE INDEX IF NOT EXISTS idx_siswa_profile_id ON siswa(profile_id);
CREATE INDEX IF NOT EXISTS idx_guru_profile_id ON guru(profile_id);

CREATE INDEX IF NOT EXISTS idx_guru_kelas_guru_id ON guru_kelas(guru_id);
CREATE INDEX IF NOT EXISTS idx_guru_kelas_kelas_id ON guru_kelas(kelas_id);
CREATE INDEX IF NOT EXISTS idx_guru_kelas_mapel_id ON guru_kelas(mata_pelajaran_id);
CREATE INDEX IF NOT EXISTS idx_guru_mata_pelajaran_guru_id ON guru_mata_pelajaran(guru_id);

CREATE INDEX IF NOT EXISTS idx_tugas_kelas_kelas_id ON tugas_kelas(kelas_id);
CREATE INDEX IF NOT EXISTS idx_tugas_kelas_tugas_id ON tugas_kelas(tugas_id);
CREATE INDEX IF NOT EXISTS idx_tugas_guru_id ON tugas(guru_id);
CREATE INDEX IF NOT EXISTS idx_tugas_status ON tugas(status);

CREATE INDEX IF NOT EXISTS idx_materi_kelas_kelas_id ON materi_kelas(kelas_id);
CREATE INDEX IF NOT EXISTS idx_materi_kelas_materi_id ON materi_kelas(materi_id);
CREATE INDEX IF NOT EXISTS idx_video_kelas_kelas_id ON video_kelas(kelas_id);
CREATE INDEX IF NOT EXISTS idx_pengumuman_kelas_kelas_id ON pengumuman_kelas(kelas_id);

CREATE INDEX IF NOT EXISTS idx_pengumpulan_siswa_id ON pengumpulan_tugas(siswa_id);
CREATE INDEX IF NOT EXISTS idx_pengumpulan_tugas_id ON pengumpulan_tugas(tugas_id);
CREATE INDEX IF NOT EXISTS idx_nilai_siswa_id ON nilai(siswa_id);
CREATE INDEX IF NOT EXISTS idx_jadwal_kelas_id ON jadwal(kelas_id);
CREATE INDEX IF NOT EXISTS idx_jadwal_hari ON jadwal(hari);
CREATE INDEX IF NOT EXISTS idx_notifikasi_profile_is_read ON notifikasi(profile_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifikasi_created_at ON notifikasi(created_at DESC);

-- 2. RPC: 1 roundtrip untuk dashboard (ganti 7 query jadi 1)
--    Dipakai oleh app/api/siswa/dashboard/route.ts jika mau.
--    Return: counts + jadwal_hari_ini IDs diambil terpisah agar payload ramping.
CREATE OR REPLACE FUNCTION get_dashboard_stats(p_kelas_id UUID, p_siswa_id UUID, p_profile_id UUID, p_hari TEXT)
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'tugas', (SELECT COUNT(*) FROM tugas_kelas tk JOIN tugas t ON t.id = tk.tugas_id WHERE tk.kelas_id = p_kelas_id AND t.status IN ('published','closed')),
    'materi', (SELECT COUNT(*) FROM materi_kelas mk WHERE mk.kelas_id = p_kelas_id),
    'video', (SELECT COUNT(*) FROM video_kelas vk WHERE vk.kelas_id = p_kelas_id),
    'pengumuman', (SELECT COUNT(*) FROM pengumuman_kelas pk WHERE pk.kelas_id = p_kelas_id),
    'nilai', (SELECT COUNT(*) FROM nilai n WHERE n.siswa_id = p_siswa_id),
    'notifikasi_belum_dibaca', (SELECT COUNT(*) FROM notifikasi nt WHERE nt.profile_id = p_profile_id AND nt.is_read = false),
    'jadwal_hari_ini', (SELECT COUNT(*) FROM jadwal j WHERE j.kelas_id = p_kelas_id AND j.hari = p_hari)
  );
$$;

-- Grant: authenticated boleh panggil (service_role bypass)
GRANT EXECUTE ON FUNCTION get_dashboard_stats(UUID, UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_dashboard_stats(UUID, UUID, UUID, TEXT) TO service_role;
