// Seed data uji untuk e2e siswa: tugas berlampiran + materi berfile.
// Idempoten: menghapus seed lama (berawalan [E2E]) lalu membuat ulang.
//
// Pemakaian:  node scripts/seed-e2e-siswa.js
/* eslint-disable */
const fs = require('fs')
const path = require('path')

const envPath = path.join(__dirname, '..', '.env.local')
const env = {}
for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const { createClient } = require('@supabase/supabase-js')
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })

const ids = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '.test-ids.json'), 'utf8'))
const GURU_ID = ids.guru
const KELAS_ID = ids.kelas
const BUCKET_TUGAS = 'tugas'
const BUCKET_MATERI = 'materi'
const DEADLINE = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()

async function main() {
  console.log('=== Seed data uji e2e siswa ===\n')

  // ---------- 0. Mapel penunjang ----------
  let { data: mapel } = await admin.from('mata_pelajaran').select('id').eq('kode', 'E2E').maybeSingle()
  if (!mapel) {
    const ins = await admin.from('mata_pelajaran').insert({ kode: 'E2E', nama: 'Mapel Uji E2E', status: true }).select('id').single()
    mapel = ins.data
    console.log('  + mata_pelajaran "E2E" dibuat')
  }
  const mapelId = mapel.id

  // ---------- 0b. Penugasan guru (guru_kelas) ----------
  const { data: gk } = await admin
    .from('guru_kelas')
    .select('id')
    .eq('guru_id', GURU_ID)
    .eq('kelas_id', KELAS_ID)
    .eq('mata_pelajaran_id', mapelId)
    .maybeSingle()
  if (!gk) {
    await admin.from('guru_kelas').insert({ guru_id: GURU_ID, kelas_id: KELAS_ID, mata_pelajaran_id: mapelId, tahun_ajaran: '2025/2026' })
    console.log('  + guru_kelas ditambahkan')
  }

  // ---------- 1. Bersihkan seed lama ----------
  console.log('\nBersihkan seed lama...')
  const { data: tugasLama } = await admin.from('tugas').select('id').ilike('judul', '[E2E]%')
  for (const t of tugasLama ?? []) {
    await admin.from('tugas_kelas').delete().eq('tugas_id', t.id)
    await admin.from('tugas').delete().eq('id', t.id)
  }
  const { data: materiLama } = await admin.from('materi').select('id, file_url').ilike('judul', '[E2E]%')
  for (const m of materiLama ?? []) {
    await admin.from('materi_kelas').delete().eq('materi_id', m.id)
    if (m.file_url) await admin.storage.from(BUCKET_MATERI).remove([m.file_url])
    await admin.from('materi').delete().eq('id', m.id)
  }
  console.log('  selesai')

  // ---------- 2. Upload lampiran tugas ----------
  const lampiranPath = `e2e/${GURU_ID}/lampiran-e2e.txt`
  const upTugas = await admin.storage.from(BUCKET_TUGAS).upload(lampiranPath, 'Lampiran tugas uji e2e siswa.', { upsert: true, contentType: 'text/plain' })
  if (upTugas.error) throw new Error(`Upload lampiran gagal: ${upTugas.error.message}`)

  const { data: tugas, error: tugasErr } = await admin
    .from('tugas')
    .insert({
      guru_id: GURU_ID,
      mata_pelajaran_id: mapelId,
      judul: '[E2E] Tugas Berlampiran',
      deskripsi: 'Tugas uji end-to-end dengan lampiran file (bucket tugas).',
      tanggal_mulai: new Date().toISOString(),
      deadline: DEADLINE,
      lampiran_url: lampiranPath,
      status: 'published',
    })
    .select('id')
    .single()
  if (tugasErr) throw tugasErr
  await admin.from('tugas_kelas').insert({ tugas_id: tugas.id, kelas_id: KELAS_ID })
  console.log(`  + tugas berlampiran: ${tugas.id}`)

  // ---------- 3. Buat materi + upload file ----------
  const fileMateriPath = `e2e/${GURU_ID}/materi-e2e.txt`
  const upMateri = await admin.storage.from(BUCKET_MATERI).upload(fileMateriPath, 'File materi uji e2e siswa.', { upsert: true, contentType: 'text/plain' })
  if (upMateri.error) throw new Error(`Upload materi gagal: ${upMateri.error.message}`)

  const { data: materi, error: materiErr } = await admin
    .from('materi')
    .insert({
      guru_id: GURU_ID,
      mata_pelajaran_id: mapelId,
      judul: '[E2E] Materi Berfile',
      deskripsi: 'Materi uji end-to-end dengan file (bucket materi).',
      file_url: fileMateriPath,
      nama_file: 'materi-e2e.txt',
    })
    .select('id')
    .single()
  if (materiErr) throw materiErr
  await admin.from('materi_kelas').insert({ materi_id: materi.id, kelas_id: KELAS_ID })
  console.log(`  + materi berfile: ${materi.id}`)

  // ---------- 4. Verifikasi cepat ----------
  const { count: cTugas } = await admin.from('tugas').select('id', { count: 'exact', head: true }).ilike('judul', '[E2E]%')
  const { count: cMateri } = await admin.from('materi').select('id', { count: 'exact', head: true }).ilike('judul', '[E2E]%')
  console.log(`\nSelesai. Tugas [E2E]: ${cTugas}, materi [E2E]: ${cMateri}`)
}

main().catch((e) => {
  console.error('Fatal:', e.message ?? e)
  process.exit(1)
})
