import { NextResponse } from 'next/server'
import { adminCheck, getSupabaseAdmin } from '@/lib/supabase-server'
import { denyResponse, serverError } from '@/lib/api-admin'
import { EMAIL_RE } from '@/lib/utils'

const ROLES = ['guru', 'siswa'] as const
type Role = (typeof ROLES)[number]
function isRole(v: unknown): v is Role { return typeof v === 'string' && (ROLES as readonly string[]).includes(v) }

async function validKelasId(supabaseAdmin: ReturnType<typeof getSupabaseAdmin>, kelasId: string | null | undefined): Promise<string | null> {
  if (!kelasId) return null
  const { data } = await supabaseAdmin.from('kelas').select('id').eq('id', kelasId).eq('status', true).gte('tingkat', 10).lte('tingkat', 12).maybeSingle()
  return data?.id ?? null
}

function genRandomPassword(len = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%'
  let out = ''
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

type BulkItem = {
  nama_lengkap: string
  email: string
  password?: string
  role: string
  kelas_id?: string | null
  nis?: string | null
  nip?: string | null
}

export async function POST(request: Request) {
  try {
    const auth = await adminCheck()
    if (!auth.ok) return denyResponse()

    const body = await request.json()
    const items: BulkItem[] = Array.isArray(body?.users) ? body.users : Array.isArray(body) ? body : []
    if (items.length === 0) return NextResponse.json({ error: 'Payload users kosong (array)' }, { status: 400 })
    if (items.length > 200) return NextResponse.json({ error: 'Maksimal 200 baris per import' }, { status: 400 })

    const supabaseAdmin = getSupabaseAdmin()
    const results: Array<{ index: number; email: string; ok: boolean; error?: string; userId?: string }> = []

    for (let i = 0; i < items.length; i++) {
      const raw = items[i]
      const nama_lengkap = String(raw.nama_lengkap ?? '').trim()
      const email = String(raw.email ?? '').trim().toLowerCase()
      const roleRaw = String(raw.role ?? '').trim().toLowerCase() || 'siswa'
      const role = roleRaw as Role
      // password: jika kosong untuk siswa OAuth → generate random aman (tidak dipakai login Google)
      let password = raw.password ? String(raw.password) : ''
      if (!password && role === 'siswa') password = genRandomPassword(12)
      const kelas_id = raw.kelas_id ? String(raw.kelas_id).trim() : null
      const nis = raw.nis ? String(raw.nis).trim() : ''
      const nip = raw.nip ? String(raw.nip).trim() : ''

      // Validasi per baris (ringan, lanjut ke baris berikutnya jika gagal)
      if (!nama_lengkap) { results.push({ index: i, email, ok: false, error: 'Nama lengkap wajib' }); continue }
      if (!EMAIL_RE.test(email)) { results.push({ index: i, email, ok: false, error: 'Email tidak valid' }); continue }
      // Enforce domain smk.belajar.id untuk siswa (sesuai UPDATE_BERIKUT 10/10)
      if (role === 'siswa' && !email.endsWith('@smk.belajar.id')) {
        results.push({ index: i, email, ok: false, error: 'Email siswa harus @smk.belajar.id' }); continue
      }
      if (!isRole(role)) { results.push({ index: i, email, ok: false, error: 'Role harus guru/siswa' }); continue }
      if (!password || password.length < 6) { results.push({ index: i, email, ok: false, error: 'Password minimal 6 karakter (auto jika kosong untuk siswa)' }); continue }
      if (role === 'siswa') {
        if (!nis) { results.push({ index: i, email, ok: false, error: 'NIS wajib untuk siswa' }); continue }
        if (!(await validKelasId(supabaseAdmin, kelas_id))) { results.push({ index: i, email, ok: false, error: 'Kelas wajib & harus aktif' }); continue }
      }

      // Cek duplikat email
      const { data: existing } = await supabaseAdmin.from('profiles').select('id').eq('email', email).maybeSingle()
      if (existing) { results.push({ index: i, email, ok: false, error: 'Email sudah terdaftar' }); continue }

      // Buat auth user
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true })
      if (authError || !authData?.user) {
        const msg = authError?.message ?? 'Gagal create auth'
        if (msg.includes('already exists')) results.push({ index: i, email, ok: false, error: 'Email sudah terdaftar di Auth' })
        else results.push({ index: i, email, ok: false, error: msg })
        continue
      }
      const userId = authData.user.id

      const { error: profileError } = await supabaseAdmin.from('profiles').insert({ id: userId, email, nama_lengkap, role, status: true })
      if (profileError) {
        await supabaseAdmin.auth.admin.deleteUser(userId)
        results.push({ index: i, email, ok: false, error: profileError.message }); continue
      }

      if (role === 'guru') {
        const { error: guruError } = await supabaseAdmin.from('guru').insert({ profile_id: userId, nip: nip || null, nama_lengkap })
        if (guruError) {
          await supabaseAdmin.auth.admin.deleteUser(userId)
          await supabaseAdmin.from('profiles').delete().eq('id', userId)
          results.push({ index: i, email, ok: false, error: guruError.message }); continue
        }
      } else {
        const resolvedKelasId = (await validKelasId(supabaseAdmin, kelas_id)) as string
        const { data: kelasData } = await supabaseAdmin.from('kelas').select('jurusan_id').eq('id', resolvedKelasId).maybeSingle()
        const jurusan_id = kelasData?.jurusan_id
        const { error: siswaError } = await supabaseAdmin.from('siswa').insert({ profile_id: userId, nis, nama_lengkap, kelas_id: resolvedKelasId, jurusan_id })
        if (siswaError) {
          await supabaseAdmin.auth.admin.deleteUser(userId)
          await supabaseAdmin.from('profiles').delete().eq('id', userId)
          results.push({ index: i, email, ok: false, error: siswaError.message }); continue
        }
      }

      results.push({ index: i, email, ok: true, userId })
    }

    const success = results.filter(r => r.ok).length
    const failed = results.filter(r => !r.ok).length
    return NextResponse.json({ success, failed, total: items.length, results }, { status: 200 })
  } catch (err) {
    return serverError(err, 'Error bulk import users:')
  }
}
