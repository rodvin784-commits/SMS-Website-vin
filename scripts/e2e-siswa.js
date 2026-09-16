// Uji end-to-end alur login siswa + seluruh endpoint /api/siswa/*.
//
// Pemakaian:
//   1. Jalankan dev server:  NEXT_PUBLIC_MOBILE_ORIGIN="http://localhost:5173" npm run dev -- -p 3210
//   2. Jalankan skrip ini:   node scripts/e2e-siswa.js http://localhost:3210
//
// Skrip ini:
//   - Memastikan akun uji siswa (buat/aktifkan via Service Role, meniru alur Admin).
//   - Login ala APK (signInWithPassword -> access token -> Bearer).
//   - Memanggil semua endpoint GET + download POST (signed URL).
//   - Uji negatif: tanpa token, token guru, kelas salah, token invalid.
//   - Uji CORS preflight + header CORS pada response.
/* eslint-disable */
const fs = require('fs')
const path = require('path')

const BASE = process.argv[2] || 'http://localhost:3210'
const envPath = path.join(__dirname, '..', '.env.local')
const envFile = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : ''
const env = {}
for (const line of envFile.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_ANON || !SERVICE_KEY) {
  console.error('Env Supabase tidak lengkap. Jalankan dari folder project-tim-vin-vines dengan .env.local terisi.')
  process.exit(1)
}

const { createClient } = require('@supabase/supabase-js')
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
const anon = createClient(SUPABASE_URL, SUPABASE_ANON, { auth: { persistSession: false } })

const SISWA_EMAIL = 'siswa.e2e@sekolah.sch.id'
const SISWA_PASS = 'SiswaE2E#2026'
const GURU_EMAIL = 'guru.test@sekolah.sch.id'
const ORIGIN = 'http://localhost:5173'

let pass = 0
let fail = 0
const gagal = []
function check(nama, ok, detail) {
  if (ok) {
    pass++
    console.log(`  ✅ ${nama}`)
  } else {
    fail++
    gagal.push(nama)
    console.log(`  ❌ ${nama}${detail ? ` — ${detail}` : ''}`)
  }
}

async function api(pathname, { method = 'GET', token, body, origin, form } = {}) {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  let res
  try {
    res = await fetch(`${BASE}${pathname}`, {
      method,
      headers,
      body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
    })
  } catch (e) {
    return { error: String(e) }
  }
  const json = await res.json().catch(() => null)
  return { status: res.status, json, headers: res.headers }
}

async function main() {
  console.log(`\n=== Uji E2E Siswa — ${BASE} ===\n`)

  // ---------- 0. Persiapan akun uji (meniru alur Admin membuat akun siswa) ----------
  console.log('▶ Persiapan akun uji')
  const idsPath = path.join(__dirname, '..', '.test-ids.json')
  const ids = fs.existsSync(idsPath) ? JSON.parse(fs.readFileSync(idsPath, 'utf8')) : {}

  // Kelas: pakai kelas dari .test-ids.json, atau buat sementara.
  let kelasId = ids.kelas
  if (!kelasId) {
    const { data: k } = await admin.from('kelas').insert({ nama_kelas: 'E2E RPL', tingkat: 10, tahun_ajaran: '2025/2026' }).select('id').single()
    kelasId = k.id
  }
  const { data: kelas } = await admin.from('kelas').select('id, nama_kelas').eq('id', kelasId).maybeSingle()
  check('Kelas uji tersedia', !!kelas, kelasId)

  // Auth user siswa: buat baru atau reset password + aktifkan.
  let siswaUserId = ids.siswa_user
  const { data: existingByEmail } = await admin.from('profiles').select('id, role, status').eq('email', SISWA_EMAIL).maybeSingle()
  const existingByFileId = siswaUserId
    ? (await admin.from('profiles').select('id, role, status').eq('id', siswaUserId).maybeSingle()).data
    : null
  const target = existingByEmail || existingByFileId
  let loginEmail = SISWA_EMAIL

  if (target) {
    siswaUserId = target.id
    const { error: updErr } = await admin.auth.admin.updateUserById(siswaUserId, { password: SISWA_PASS, email_confirm: true })
    if (updErr) console.log(`  ⚠️  reset password: ${updErr.message}`)
    await admin.from('profiles').update({ status: true, role: 'siswa' }).eq('id', siswaUserId)
    // Login harus memakai email di auth.users (bukan email hipotesis skrip).
    const { data: authUser } = await admin.auth.admin.getUserById(siswaUserId)
    if (authUser?.user?.email) loginEmail = authUser.user.email
  } else {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: SISWA_EMAIL,
      password: SISWA_PASS,
      email_confirm: true,
    })
    if (createErr || !created) {
      console.error(`  Gagal membuat user auth siswa: ${createErr?.message}`)
      process.exit(1)
    }
    siswaUserId = created.user.id
    const { error: profErr } = await admin
      .from('profiles')
      .insert({ id: siswaUserId, role: 'siswa', nama_lengkap: 'Siswa E2E', email: SISWA_EMAIL, status: true, kelas_id: kelasId })
    if (profErr) console.log(`  ⚠️  insert profiles: ${profErr.message}`)
  }

  // Baris tabel siswa.
  let { data: siswaRow } = await admin.from('siswa').select('id, nama_lengkap, nis').eq('profile_id', siswaUserId).maybeSingle()
  if (!siswaRow) {
    await admin.from('siswa').insert({
      profile_id: siswaUserId,
      nis: 'E2E0001',
      nama_lengkap: 'Siswa E2E',
      kelas_id: kelasId,
    })
    ;({ data: siswaRow } = await admin.from('siswa').select('id').eq('profile_id', siswaUserId).maybeSingle())
  }
  check('Akun uji siswa siap', !!siswaRow, siswaUserId)

  // ---------- 1. Login ala APK ----------
  console.log('\n▶ Login (ala APK: signInWithPassword)')
  const { data: sess, error: loginErr } = await anon.auth.signInWithPassword({ email: loginEmail, password: SISWA_PASS })
  check('signInWithPassword berhasil', !loginErr && !!sess?.session, loginErr?.message)
  const token = sess?.session?.access_token
  check('Access token diterima', !!token)

  // ---------- 2. Endpoint profil ----------
  console.log('\n▶ Endpoint profil (/api/siswa/me)')
  const me = await api('/api/siswa/me', { token })
  check('GET /me -> 200', me.status === 200, `status=${me.status} ${JSON.stringify(me.json)}`)
  check(
    '/me mengembalikan nama & NIS sesuai DB',
    me.json?.siswa?.nama_lengkap === siswaRow?.nama_lengkap && me.json?.siswa?.nis === siswaRow?.nis,
    `api=${JSON.stringify(me.json?.siswa)} db=${JSON.stringify({ nama_lengkap: siswaRow?.nama_lengkap, nis: siswaRow?.nis })}`
  )
  check('/me mengembalikan kelas', !!me.json?.kelas?.nama_kelas, JSON.stringify(me.json?.kelas))

  // ---------- 3. Endpoint GET utama ----------
  console.log('\n▶ Endpoint GET utama')
  for (const [nama, p, kunci] of [
    ['GET /dashboard', '/api/siswa/dashboard', ['kelas', 'counts', 'jadwal_hari_ini']],
    ['GET /tugas', '/api/siswa/tugas', ['tugas']],
    ['GET /materi', '/api/siswa/materi', ['materi']],
    ['GET /video', '/api/siswa/video', ['video']],
    ['GET /pengumuman', '/api/siswa/pengumuman', ['pengumuman']],
    ['GET /jadwal', '/api/siswa/jadwal', ['jadwal']],
    ['GET /nilai', '/api/siswa/nilai', ['nilai']],
    ['GET /notifikasi', '/api/siswa/notifikasi', ['notifikasi']],
  ]) {
    const r = await api(p, { token })
    const ada = r.json && kunci.every((k) => k in r.json)
    check(`${nama} -> 200 + kunci "${kunci.join(',')}"`, r.status === 200 && ada, `status=${r.status} body=${JSON.stringify(r.json)?.slice(0, 120)}`)
  }

  // ---------- 4. Download signed URL (tugas & materi) ----------
  console.log('\n▶ Download (signed URL)')
  const tugasRes = await api('/api/siswa/tugas', { token })
  const tugasList = tugasRes.json?.tugas ?? []
  const denganLampiran = tugasList.find((t) => t.lampiran_url)
  if (denganLampiran) {
    const dl = await api('/api/siswa/tugas', { method: 'POST', token, body: { id: denganLampiran.id } })
    check('POST /tugas (lampiran) -> signed URL', dl.status === 200 && typeof dl.json?.url === 'string' && dl.json.url.includes('sign'), `status=${dl.status} ${JSON.stringify(dl.json)?.slice(0, 100)}`)
  } else {
    console.log('  ⏭️  Tidak ada tugas berlampiran — lewati uji unduh lampiran')
  }

  const materiRes = await api('/api/siswa/materi', { token })
  const materiList = materiRes.json?.materi ?? []
  const materiBerfile = materiList.find((m) => m.file_url)
  if (materiBerfile) {
    const dl = await api('/api/siswa/materi/download', { method: 'POST', token, body: { id: materiBerfile.id } })
    check('POST /materi/download -> signed URL', dl.status === 200 && typeof dl.json?.url === 'string' && dl.json.url.includes('sign'), `status=${dl.status} ${JSON.stringify(dl.json)?.slice(0, 100)}`)
  } else {
    console.log('  ⏭️  Tidak ada materi berfile — lewati uji unduh materi')
  }

  // ---------- 5. Upload pengumpulan (multipart ala APK) ----------
  console.log('\n▶ Upload pengumpulan tugas')
  const tugasBisaKumpul = tugasList.find((t) => t.status === 'published' && !t.pengumpulan)
  if (tugasBisaKumpul) {
    const fd = new FormData()
    fd.append('tugas_id', tugasBisaKumpul.id)
    fd.append('catatan', 'Uji e2e pengumpulan')
    fd.append('file', new File(['jawaban e2e siswa'], 'jawaban-e2e.txt', { type: 'text/plain' }))
    const up = await fetch(`${BASE}/api/siswa/pengumpulan`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    })
    const upJson = await up.json().catch(() => null)
    check('POST /pengumpulan (multipart) -> 201', up.status === 201, `status=${up.status} ${JSON.stringify(upJson)?.slice(0, 120)}`)

    // Status tugas kini harus terkumpul.
    const tugasSetelah = await api('/api/siswa/tugas', { token })
    const baris = (tugasSetelah.json?.tugas ?? []).find((t) => t.id === tugasBisaKumpul.id)
    check('Status tugas menjadi terkumpul', baris?.pengumpulan?.status === 'dikumpulkan', JSON.stringify(baris?.pengumpulan))

    // Unduh jawaban sendiri.
    if (baris?.pengumpulan?.id) {
      const dl = await api('/api/siswa/pengumpulan/download', { method: 'POST', token, body: { pengumpulan_id: baris.pengumpulan.id } })
      check('POST /pengumpulan/download -> signed URL', dl.status === 200 && typeof dl.json?.url === 'string', `status=${dl.status} ${JSON.stringify(dl.json)?.slice(0, 100)}`)
    }

    // Notifikasi pengumpulan masuk.
    const notif = await api('/api/siswa/notifikasi', { token })
    check('Notifikasi pengumpulan muncul', (notif.json?.notifikasi ?? []).some((n) => n.tipe === 'tugas'), 'tidak ada notif tugas')

    // Tandai notifikasi dibaca.
    const belum = (notif.json?.notifikasi ?? []).filter((n) => !n.is_read).map((n) => n.id)
    if (belum.length > 0) {
      const mark = await api('/api/siswa/notifikasi', { method: 'POST', token, body: { ids: belum } })
      check('POST /notifikasi (tandai dibaca) -> ok', mark.status === 200 && mark.json?.ok === true, `status=${mark.status} ${JSON.stringify(mark.json)?.slice(0, 80)}`)
    }
  } else {
    console.log('  ⏭️  Tidak ada tugas published tanpa pengumpulan — lewati uji upload')
  }

  // ---------- 6. Uji negatif keamanan ----------
  console.log('\n▶ Uji negatif (keamanan)')
  const noAuth = await api('/api/siswa/me')
  check('Tanpa token -> 401', noAuth.status === 401, `status=${noAuth.status}`)

  const badToken = await api('/api/siswa/me', { token: 'token.palsu.banget' })
  check('Token invalid -> 401', badToken.status === 401, `status=${badToken.status}`)

  // Login guru lalu pakai tokennya ke API siswa -> harus 403.
  // Password guru uji di-reset via admin agar uji deterministik.
  let guruId = ids.guru_user
  const { data: guruByEmail } = await admin.from('profiles').select('id').eq('email', GURU_EMAIL).maybeSingle()
  guruId = guruId || guruByEmail?.id
  if (guruId) {
    await admin.auth.admin.updateUserById(guruId, { password: 'GuruTest#2026' })
    const { data: guruAuth } = await admin.auth.admin.getUserById(guruId)
    const guruLoginEmail = guruAuth?.user?.email || GURU_EMAIL
    const { data: guruSess, error: guruErr } = await anon.auth.signInWithPassword({ email: guruLoginEmail, password: 'GuruTest#2026' })
    if (!guruErr && guruSess?.session) {
      const guruToken = guruSess.session.access_token
      const asGuru = await api('/api/siswa/me', { token: guruToken })
      check('Token guru -> 403', asGuru.status === 403, `status=${asGuru.status} body=${JSON.stringify(asGuru.json)?.slice(0, 80)}`)
      await anon.auth.signOut()
    } else {
      console.log('  ⏭️  Login guru gagal — lewati uji token guru')
    }
  } else {
    console.log('  ⏭️  Guru uji tidak ditemukan — lewati uji token guru')
  }

  // ---------- 7. CORS ----------
  console.log('\n▶ CORS (origin APK)')
  const pf = await fetch(`${BASE}/api/siswa/me`, {
    method: 'OPTIONS',
    headers: { Origin: ORIGIN, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization, content-type' },
  })
  check(
    'Preflight OPTIONS -> 204',
    pf.status === 204,
    `status=${pf.status}`
  )
  const acao = pf.headers.get('access-control-allow-origin')
  check(
    'Preflight mengembalikan ACAO sesuai origin APK',
    acao === ORIGIN,
    `acao=${acao} (harapnya ${ORIGIN}) — pastikan NEXT_PUBLIC_MOBILE_ORIGIN ada di .env.local dan dev server sudah direstart`
  )
  const withOrigin = await fetch(`${BASE}/api/siswa/me`, { headers: { Origin: ORIGIN, Authorization: `Bearer ${token}` } })
  const acaoGet = withOrigin.headers.get('access-control-allow-origin')
  check(
    'GET dengan Origin -> header ACAO terpasang',
    acaoGet === ORIGIN,
    `acao=${acaoGet} — env NEXT_PUBLIC_MOBILE_ORIGIN belum termuat oleh server`
  )
  const evil = await fetch(`${BASE}/api/siswa/me`, { headers: { Origin: 'https://evil.example' } })
  check('Origin asing -> TANPA header ACAO', evil.headers.get('access-control-allow-origin') === null, `acao=${evil.headers.get('access-control-allow-origin')}`)

  // ---------- Ringkasan ----------
  console.log(`\n=== Hasil: ${pass} lulus, ${fail} gagal ===`)
  if (fail > 0) {
    console.log('Gagal: ' + gagal.join(' | '))
    process.exit(1)
  }
}

main().catch((e) => {
  console.error('Fatal:', e)
  process.exit(1)
})
