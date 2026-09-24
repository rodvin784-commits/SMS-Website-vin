'use client'
import { useEffect, useMemo, useState } from 'react'

type Assignment = { id: string; mata_pelajaran_id: string; mapel_nama: string | null; kelas_id: string; kelas_nama: string | null; tingkat: number | null; tahun_ajaran: string | null }
type Row = { siswa_id: string; nis: string; nama_lengkap: string; presensi: { id: string; status: string; keterangan: string | null } | null }

export function PresensiManager() {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [mapel, setMapel] = useState('')
  const [kelas, setKelas] = useState('')
  const [tanggal, setTanggal] = useState(() => new Date().toISOString().slice(0,10))
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{type:'success'|'error', text:string}|null>(null)
  const [draft, setDraft] = useState<Record<string, {status:string, ket:string}>>({})

  useEffect(() => {
    fetch('/api/teacher/mengajar').then(r=>r.json()).then(d=>{
      const list=d.assignments as Assignment[]
      setAssignments(list)
      if(list.length>0){ setMapel(list[0].mata_pelajaran_id); setKelas(list[0].kelas_id)}
      setLoading(false)
    }).catch(()=>setLoading(false))
  }, [])

  const kelasOptions = useMemo(()=> assignments.filter(a=>a.mata_pelajaran_id===mapel), [assignments, mapel])

  const muat = async () => {
    if(!mapel||!kelas||!tanggal) return
    setLoading(true)
    try{
      const r=await fetch(`/api/teacher/presensi?mata_pelajaran_id=${mapel}&kelas_id=${kelas}&tanggal=${tanggal}`)
      const d=await r.json()
      if(r.ok){ setRows(d.siswa as Row[]); const m: Record<string, {status:string, ket:string}> = {}; for(const s of d.siswa as Row[]){ m[s.siswa_id]={status: s.presensi?.status ?? 'hadir', ket: s.presensi?.keterangan ?? ''}}; setDraft(m)}
      else setMsg({type:'error', text: d.error})
    } finally{ setLoading(false)}
  }
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(()=>{ if(mapel&&kelas&&tanggal) void muat() }, [mapel,kelas,tanggal])

  const simpan = async () => {
    setSaving(true); setMsg(null)
    try{
      const entries = Object.entries(draft).map(([siswa_id, v])=>({siswa_id, status: v.status, keterangan: v.ket}))
      const r=await fetch('/api/teacher/presensi',{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({mata_pelajaran_id:mapel, kelas_id:kelas, tanggal, entries})})
      const d=await r.json()
      if(r.ok) setMsg({type:'success', text: d.message})
      else setMsg({type:'error', text: d.error})
    } finally{ setSaving(false)}
  }

  const exportCSV = () => {
    if(rows.length===0) return
    const header=['NIS','Nama','Status','Keterangan','Tanggal']
    const lines=[header.join(','), ...rows.map(r=> {
      const d=draft[r.siswa_id] ?? {status: r.presensi?.status ?? 'hadir', ket: r.presensi?.keterangan ?? ''}
      return [r.nis,`"${r.nama_lengkap.replace(/"/g,'""')}"`,d.status,`"${(d.ket||'').replace(/"/g,'""')}"`,tanggal].join(',')
    })]
    const blob=new Blob([lines.join('\n')],{type:'text/csv;charset=utf-8;'})
    const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`presensi-${kelas}-${tanggal}.csv`; a.click(); URL.revokeObjectURL(url)
  }

  if(loading) return <div className="bg-white rounded-2xl p-10 text-center text-sm text-gray-400">Memuat...</div>
  if(assignments.length===0) return <div className="bg-white rounded-2xl p-10 text-center text-sm">Belum ada penugasan</div>

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-wrap gap-3">
        <select value={mapel} onChange={e=>{setMapel(e.target.value); const first=assignments.find(a=>a.mata_pelajaran_id===e.target.value); if(first) setKelas(first.kelas_id)}} className="px-3 py-2 rounded-xl bg-gray-50 border text-sm">
          {Array.from(new Map(assignments.map(a=>[a.mata_pelajaran_id, a.mapel_nama]))).map(([id,nama])=> <option key={id} value={id}>{nama as string}</option>)}
        </select>
        <select value={kelas} onChange={e=>setKelas(e.target.value)} className="px-3 py-2 rounded-xl bg-gray-50 border text-sm">
          {kelasOptions.map(k=> <option key={k.kelas_id} value={k.kelas_id}>{k.kelas_nama} ({k.tahun_ajaran})</option>)}
        </select>
        <input type="date" value={tanggal} onChange={e=>setTanggal(e.target.value)} className="px-3 py-2 rounded-xl bg-gray-50 border text-sm" />
        <button onClick={muat} className="px-4 py-2 rounded-xl bg-gray-900 text-white text-sm">Muat</button>
      </div>
      {msg && <div className={`px-4 py-2 rounded-xl text-sm ${msg.type==='success'?'bg-emerald-50 text-emerald-700':'bg-rose-50 text-rose-700'}`}>{msg.text}</div>}
      <div className="bg-white rounded-2xl overflow-hidden border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50"><tr><th className="px-4 py-2 text-left">Siswa</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Ket</th></tr></thead>
          <tbody>
            {rows.map(r=> (
              <tr key={r.siswa_id} className="border-t">
                <td className="px-4 py-2"><div className="font-medium">{r.nama_lengkap}</div><div className="text-xs text-gray-400">NIS {r.nis}</div></td>
                <td className="px-4 py-2">
                  <select value={draft[r.siswa_id]?.status ?? 'hadir'} onChange={e=> setDraft(p=>({...p, [r.siswa_id]: {status:e.target.value, ket: p[r.siswa_id]?.ket ?? ''}}))} className="px-2 py-1 rounded border text-xs">
                    <option value="hadir">Hadir</option><option value="izin">Izin</option><option value="sakit">Sakit</option><option value="alpha">Alpha</option>
                  </select>
                </td>
                <td className="px-4 py-2"><input value={draft[r.siswa_id]?.ket ?? ''} onChange={e=> setDraft(p=>({...p, [r.siswa_id]: {status: p[r.siswa_id]?.status ?? 'hadir', ket: e.target.value}}))} placeholder="opsional" className="w-full px-2 py-1 rounded border text-xs" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-3">
        <button onClick={simpan} disabled={saving || rows.length===0} className="px-6 py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold disabled:opacity-50">{saving?'Menyimpan...':'Simpan Presensi'}</button>
        <button onClick={exportCSV} disabled={rows.length===0} className="px-6 py-3 rounded-xl bg-white border text-sm font-bold disabled:opacity-50">Export CSV</button>
      </div>
      {rows.length>0 && <p className="text-xs text-gray-500">{rows.filter(r=> (draft[r.siswa_id]?.status ?? r.presensi?.status) === 'hadir').length} hadir · {rows.filter(r=> (draft[r.siswa_id]?.status) === 'alpha').length} alpha</p>}
    </div>
  )
}
