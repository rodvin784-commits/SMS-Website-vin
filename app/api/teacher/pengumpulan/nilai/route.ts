import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { guruAuth, getGuruKelas } from '@/lib/guru-auth'

// PUT /api/teacher/pengumpulan/nilai
// Body: { pengumpulan_id, nilai (0-100), feedback? }
// Guru memberi nilai & feedback, status otomatis jadi dinilai
export async function PUT(request: NextRequest) {
  try {
    const auth = await guruAuth()
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const body = await request.json().catch(() => null)
    const pengumpulanId = body?.pengumpulan_id ? String(body.pengumpulan_id) : null
    if (!pengumpulanId) return NextResponse.json({ error: 'pengumpulan_id wajib diisi.' }, { status: 400 })

    const nilaiRaw = body?.nilai
    if (nilaiRaw === undefined || nilaiRaw === null || nilaiRaw === '') return NextResponse.json({ error: 'Nilai wajib diisi (0-100).' }, { status: 400 })
    const nilai = Number(nilaiRaw)
    if (Number.isNaN(nilai) || nilai < 0 || nilai > 100) return NextResponse.json({ error: 'Nilai harus angka 0-100.' }, { status: 400 })

    const feedback = body?.feedback ? String(body.feedback).trim().slice(0, 1000) : null

    const supabase = getSupabaseAdmin()

    const { data: peng, error: pengErr } = await supabase
      .from('pengumpulan_tugas')
      .select(`id, tugas_id, siswa_id, tugas(guru_id, mata_pelajaran_id, judul, tugas_kelas(kelas_id))`)
      .eq('id', pengumpulanId)
      .maybeSingle()

    if (pengErr) return NextResponse.json({ error: pengErr.message }, { status: 400 })
    if (!peng) return NextResponse.json({ error: 'Pengumpulan tidak ditemukan.' }, { status: 404 })

    type PengEmbed = {
      id: string
      tugas_id: string
      siswa_id: string
      tugas: { guru_id: string; mata_pelajaran_id: string; judul: string; tugas_kelas: { kelas_id: string }[] | null } | null
    }
    const p = peng as unknown as PengEmbed
    if (!p.tugas || p.tugas.guru_id !== auth.guruId) return NextResponse.json({ error: 'Tidak diizinkan menilai tugas ini.' }, { status: 403 })

    const penugasan = await getGuruKelas(auth.guruId)
    const assigned = new Set(penugasan.map((x) => `${x.mata_pelajaran_id}|${x.kelas_id}`))
    const ok = (p.tugas.tugas_kelas ?? []).some((tk) => assigned.has(`${p.tugas!.mata_pelajaran_id}|${tk.kelas_id}`))
    if (!ok) return NextResponse.json({ error: 'Anda tidak mengajar kelas tujuan tugas ini.' }, { status: 403 })

    const now = new Date().toISOString()
    const { error: updErr } = await supabase
      .from('pengumpulan_tugas')
      .update({
        nilai,
        feedback,
        status: 'dinilai',
        dinilai_at: now,
        dinilai_oleh: auth.guruId,
        updated_at: now,
      })
      .eq('id', pengumpulanId)

    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 })

    // Notifikasi ke siswa
    const { data: siswaRow } = await supabase.from('siswa').select('profile_id').eq('id', p.siswa_id).maybeSingle()
    const profileId = (siswaRow as { profile_id: string } | null)?.profile_id
    if (profileId) {
      await supabase.from('notifikasi').insert({
        profile_id: profileId,
        judul: 'Tugas dinilai',
        pesan: `Tugas "${p.tugas.judul}" telah dinilai: ${nilai}${feedback ? ` • ${feedback}` : ''}`,
        tipe: 'nilai',
        referensi_id: p.tugas_id,
        is_read: false,
      })
    }

    return NextResponse.json({ message: 'Nilai berhasil disimpan.', nilai, feedback })
  } catch (err) {
    console.error('Error PUT nilai:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Terjadi kesalahan server' }, { status: 500 })
  }
}
