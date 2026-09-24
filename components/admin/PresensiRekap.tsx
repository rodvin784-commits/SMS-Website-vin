'use client'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Download, Calendar, Users } from 'lucide-react'

interface RekapRow { siswa_id: string; nis: string; nama_lengkap: string; hadir: number; izin: number; sakit: number; alpha: number; total: number }

export function PresensiRekap() {
  const [kelasOptions, setKelasOptions] = useState<{id:string, nama_kelas:string, tingkat:number}[]>([])
  const [kelasId, setKelasId] = useState('')
  const [bulan, setBulan] = useState(()=> new Date().toISOString().slice(0,7))
  const [rekap, setRekap] = useState<RekapRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(()=>{ fetch('/api/admin/kelas?status=active').then(r=>r.json()).then(d=> setKelasOptions(Array.isArray(d)? d : [])).catch(()=>{}) },[])

  const muat = async () => {
    if(!kelasId) return
    setLoading(true)
    const r=await fetch(`/api/admin/presensi?kelas_id=${kelasId}&bulan=${bulan}`)
    const d=await r.json()
    setRekap(d.rekap ?? [])
    setLoading(false)
  }

  const exportCSV = () => {
    if(rekap.length===0) return
    const header=['NIS','Nama','Hadir','Izin','Sakit','Alpha','Total']
    const lines=[header.join(','), ...rekap.map(r=> [r.nis,`"${r.nama_lengkap.replace(/"/g,'""')}"`,r.hadir,r.izin,r.sakit,r.alpha,r.total].join(','))]
    const blob=new Blob([lines.join('\n')],{type:'text/csv;charset=utf-8;'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`rekap-presensi-${kelasId}-${bulan}.csv`; a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold flex items-center gap-2"><Calendar className="h-6 w-6 text-emerald-600"/> Rekap Presensi</h1>
        <p className="text-sm text-gray-500">Rekap bulanan per kelas (hadir/izin/sakit/alpha) — export CSV untuk wali kelas & TU.</p>
      </div>
      <div className="bg-white rounded-2xl p-4 shadow-sm border flex flex-wrap gap-3">
        <select value={kelasId} onChange={e=>setKelasId(e.target.value)} className="px-3 py-2 rounded-xl bg-gray-50 border text-sm">
          <option value="">Pilih Kelas</option>
          {kelasOptions.map(k=> <option key={k.id} value={k.id}>Kelas {k.tingkat} {k.nama_kelas}</option>)}
        </select>
        <input type="month" value={bulan} onChange={e=>setBulan(e.target.value)} className="px-3 py-2 rounded-xl bg-gray-50 border text-sm" />
        <Button onClick={muat} disabled={!kelasId} size="sm">Muat</Button>
        <Button variant="secondary" onClick={exportCSV} disabled={rekap.length===0} size="sm"><Download className="h-4 w-4"/> Export CSV</Button>
      </div>
      {loading ? <div className="bg-white rounded-2xl p-10 text-center text-sm text-gray-400">Memuat...</div> : rekap.length===0 ? <div className="bg-white rounded-2xl p-10 text-center text-sm text-gray-400">Belum ada data — pilih kelas & bulan lalu Muat.</div> : (
        <div className="bg-white rounded-2xl overflow-hidden border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50"><tr><th className="px-4 py-2 text-left">Siswa</th><th className="px-2 py-2 text-center">Hadir</th><th className="px-2 py-2 text-center">Izin</th><th className="px-2 py-2 text-center">Sakit</th><th className="px-2 py-2 text-center">Alpha</th><th className="px-2 py-2 text-center">Total</th></tr></thead>
              <tbody>
                {rekap.map(r=> (
                  <tr key={r.siswa_id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-2"><div className="font-medium">{r.nama_lengkap}</div><div className="text-xs text-gray-400">NIS {r.nis}</div></td>
                    <td className="px-2 py-2 text-center"><span className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 font-bold">{r.hadir}</span></td>
                    <td className="px-2 py-2 text-center"><span className="px-2 py-1 rounded bg-blue-50 text-blue-700 font-bold">{r.izin}</span></td>
                    <td className="px-2 py-2 text-center"><span className="px-2 py-1 rounded bg-amber-50 text-amber-700 font-bold">{r.sakit}</span></td>
                    <td className="px-2 py-2 text-center"><span className="px-2 py-1 rounded bg-rose-50 text-rose-700 font-bold">{r.alpha}</span></td>
                    <td className="px-2 py-2 text-center font-bold">{r.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 text-xs text-gray-500 flex items-center gap-1"><Users className="h-3.5 w-3.5"/> {rekap.length} siswa</div>
        </div>
      )}
    </div>
  )
}
