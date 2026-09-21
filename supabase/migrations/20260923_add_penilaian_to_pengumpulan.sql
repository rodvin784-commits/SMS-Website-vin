-- Penilaian tugas oleh guru
ALTER TABLE public.pengumpulan_tugas
  ADD COLUMN IF NOT EXISTS nilai NUMERIC CHECK (nilai >= 0 AND nilai <= 100),
  ADD COLUMN IF NOT EXISTS feedback TEXT,
  ADD COLUMN IF NOT EXISTS dinilai_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dinilai_oleh UUID REFERENCES public.guru(id);

COMMENT ON COLUMN public.pengumpulan_tugas.nilai IS 'Nilai 0-100 diberikan guru untuk pengumpulan ini';
COMMENT ON COLUMN public.pengumpulan_tugas.feedback IS 'Catatan/feedback guru';
