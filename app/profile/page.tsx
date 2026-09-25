'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function ProfilePage() {
  const router = useRouter()
  const [role, setRole] = useState<'admin'|'guru'|'siswa'|null>(null)
  const [userName, setUserName] = useState('Pengguna')
  const [editNama, setEditNama] = useState('')
  const [savingNama, setSavingNama] = useState(false)
  const [msgNama, setMsgNama] = useState<{type:'success'|'error', text:string}|null>(null)
  const [loading, setLoading] = useState(true)
  const [used, setUsed] = useState(0)
  const [remaining, setRemaining] = useState(1)
  const [curr, setCurr] = useState('')
  const [next, setNext] = useState('')
  const [msg, setMsg] = useState<{type:'success'|'error', text:string}|null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(()=>{
    let c=false
    async function init(){
      const { data:{session}} = await supabase.auth.getSession()
      if(!session){ router.replace('/login'); return}
      const { data: p } = await supabase.from('profiles').select('role,nama_lengkap').eq('id', session.user.id).maybeSingle()
      if(!c){ setRole((p as {role:string}|null)?.role as unknown as typeof role ?? null); setUserName((p as {nama_lengkap:string}|null)?.nama_lengkap ?? 'Pengguna'); setEditNama((p as {nama_lengkap:string}|null)?.nama_lengkap ?? '') }
      const r=await fetch('/api/profile/change-password'); const j=await r.json().catch(()=>null)
      if(!c && j){ setUsed(j.used ?? 0); setRemaining(j.remaining ?? 1) }
      setLoading(false)
    }
    void init()
    return()=>{c=true}
  },[router])

  const submitNama = async (e: React.FormEvent)=>{
    e.preventDefault()
    setSavingNama(true); setMsgNama(null)
    const r=await fetch('/api/profile/update',{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({nama_lengkap: editNama})})
    const j=await r.json().catch(()=>null)
    if(r.ok){ setMsgNama({type:'success', text: j.message}); setUserName(editNama) }
    else setMsgNama({type:'error', text: j?.error ?? 'Gagal'})
    setSavingNama(false)
  }

  const submit = async (e: React.FormEvent)=>{
    e.preventDefault()
    setSaving(true); setMsg(null)
    const r=await fetch('/api/profile/change-password',{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({currentPassword: curr, newPassword: next})})
    const j=await r.json().catch(()=>null)
    if(r.ok){ setMsg({type:'success', text: j.message}); setUsed(1); setRemaining(0); setCurr(''); setNext('') }
    else setMsg({type:'error', text: j?.error ?? 'Gagal'})
    setSaving(false)
  }

  if(loading) return <div className="flex min-h-screen items-center justify-center">Memuat...</div>

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold">Profil</h1>
            <p className="text-sm text-gray-500">Halo, {userName} ({role})</p>
          </div>
          <Link href={role==='admin' ? '/admin/dashboard' : role==='guru' ? '/teacher/dashboard' : '/login'} className="px-4 py-2 rounded-xl bg-white border text-sm">← Kembali</Link>
        </div>
        <div className="bg-white rounded-2xl p-6 border space-y-3">
          <h2 className="font-bold">Ubah Nama Profil</h2>
          {msgNama && <div className={`px-4 py-2 rounded-xl text-sm ${msgNama.type==='success'?'bg-emerald-50 text-emerald-700':'bg-rose-50 text-rose-700'}`}>{msgNama.text}</div>}
          <form onSubmit={submitNama} className="space-y-3">
            <input type="text" placeholder="Nama lengkap" value={editNama} onChange={e=>setEditNama(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-gray-50 border text-sm" required />
            <button type="submit" disabled={savingNama} className="w-full px-4 py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold disabled:opacity-50">{savingNama?'Menyimpan...':'Simpan Nama'}</button>
          </form>
        </div>
        <div className="bg-white rounded-2xl p-6 border space-y-3">
          <h2 className="font-bold">Ganti Sandi (1x)</h2>
          <p className="text-sm">Kesempatan: <b>{remaining} / 1</b> {used>=1 && <span className="text-rose-600">(sudah dipakai)</span>}</p>
          {msg && <div className={`px-4 py-2 rounded-xl text-sm ${msg.type==='success'?'bg-emerald-50 text-emerald-700':'bg-rose-50 text-rose-700'}`}>{msg.text}</div>}
          <form onSubmit={submit} className="space-y-3">
            <input type="password" placeholder="Password lama" value={curr} onChange={e=>setCurr(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-gray-50 border text-sm" required />
            <input type="password" placeholder="Password baru (min 6)" value={next} onChange={e=>setNext(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-gray-50 border text-sm" required disabled={remaining===0} />
            <button type="submit" disabled={saving || remaining===0} className="w-full px-4 py-3 rounded-xl bg-gray-900 text-white text-sm font-bold disabled:opacity-50">{saving?'Menyimpan...': remaining===0 ? 'Sudah 1x — Hubungi admin' : 'Ganti Sandi'}</button>
          </form>
          {remaining===0 && <p className="text-xs text-gray-400 text-center">Hubungi admin untuk reset.</p>}
        </div>
      </div>
    </div>
  )
}
