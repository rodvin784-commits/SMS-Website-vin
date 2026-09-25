'use client'

import { useState, useRef } from 'react'
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useKelasOptions } from '@/hooks/useKelasOptions'
import { EMAIL_RE } from '@/lib/utils'
import { generateSchoolEmail } from '@/lib/school-email'

type ParsedRow = {
  idx: number
  nama_lengkap: string
  email: string
  nis: string
  kelas_id: string
  kelas_label?: string
  error?: string
}

interface BulkResult {
  success: number
  failed: number
  total: number
  results: Array<{ index: number; email: string; ok: boolean; error?: string }>
}

function parseCSV(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '')
  return lines.map(line => {
    // handle quoted csv
    const cells: string[] = []
    let cur = ''
    let inQuote = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++ }
        else inQuote = !inQuote
      } else if (c === ',' && !inQuote) { cells.push(cur.trim()); cur = '' }
      else cur += c
    }
    cells.push(cur.trim())
    return cells.map(c => c.replace(/^"|"$/g, '').trim())
  })
}

export function BulkImportModal({ isOpen, onClose, onDone }: { isOpen: boolean; onClose: () => void; onDone: () => void }) {
  const { kelasOptions } = useKelasOptions(isOpen)
  const [kelasId, setKelasId] = useState('')
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<BulkResult | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleDownloadTemplate = () => {
    const header = 'nama_lengkap,email,nis\n'
    const sample = 'Budi Santoso,budi.santoso@smk.belajar.id,12345\nSiti Aminah,siti.aminah@smk.belajar.id,12346\n'
    const blob = new Blob([header + sample], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'template_import_siswa_smk_belajar.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const handleFile = async (f: File) => {
    const text = await f.text()
    const parsed = parseCSV(text)
    if (parsed.length === 0) return
    const header = parsed[0].map(h => h.toLowerCase().trim())
    const idxNama = header.findIndex(h => h.includes('nama'))
    const idxEmail = header.findIndex(h => h.includes('email'))
    const idxNis = header.findIndex(h => h.includes('nis'))
    // jika tidak ada header, anggap kolom 0=nama,1=email,2=nis
    const hasHeader = idxNama !== -1 || idxEmail !== -1
    const dataLines = hasHeader ? parsed.slice(1) : parsed

    const out: ParsedRow[] = dataLines.slice(0, 200).map((cols, i) => {
      const nama = hasHeader ? (cols[idxNama] ?? cols[0] ?? '') : (cols[0] ?? '')
      let email = hasHeader && idxEmail !== -1 ? (cols[idxEmail] ?? '') : (cols[1] ?? '')
      const nis = hasHeader && idxNis !== -1 ? (cols[idxNis] ?? '') : (cols[2] ?? '')
      email = email.trim().toLowerCase()
      // auto-generate email jika kosong dari nama (smk.belajar.id)
      if (!email && nama.trim()) email = generateSchoolEmail(nama.trim())
      let err: string | undefined
      if (!nama.trim()) err = 'Nama wajib'
      else if (!nis.trim()) err = 'NIS wajib'
      else if (!email) err = 'Email kosong'
      else if (!EMAIL_RE.test(email)) err = 'Email tidak valid'
      else if (!email.endsWith('@smk.belajar.id')) err = 'Harus @smk.belajar.id'
      return { idx: i, nama_lengkap: nama.trim(), email, nis: nis.trim(), kelas_id: kelasId, error: err }
    })
    setRows(out)
    setResult(null)
  }

  const canSubmit = rows.length > 0 && rows.every(r => !r.error) && !!kelasId

  const handleSubmit = async () => {
    if (!kelasId) { alert('Pilih Kelas dulu (akan diterapkan ke semua baris)'); return }
    const payload = rows.map(r => ({ nama_lengkap: r.nama_lengkap, email: r.email, role: 'siswa' as const, kelas_id: kelasId, nis: r.nis }))
    // update rows kelas_id
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/users/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ users: payload }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'Gagal import')
      setResult(data as BulkResult)
      if ((data as BulkResult).failed === 0) {
        setTimeout(() => { onDone(); onClose(); setRows([]); setResult(null) }, 1200)
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Gagal import')
    } finally { setSubmitting(false) }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Import Siswa Massal (CSV)" size="lg">
      <div className="space-y-4 pt-2">
        <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700 flex items-start gap-2">
          <FileSpreadsheet className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <strong>Format CSV:</strong> <code>nama_lengkap,email,nis</code> — email kosong akan auto jadi <code>nama@smk.belajar.id</code>. Maks 200 baris. Kelas dipilih 1 untuk semua baris (sesuai export per kelas dari Google Admin).
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={handleDownloadTemplate}>
            <Download className="h-4 w-4" /> Download Template
          </Button>
          <label className="inline-flex items-center gap-2 px-3 py-2 bg-gray-900 text-white rounded-xl text-xs font-semibold cursor-pointer hover:bg-black">
            <Upload className="h-4 w-4" /> Pilih File CSV
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
          </label>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">Kelas Tujuan <span className="text-red-500">*</span></label>
          <select value={kelasId} onChange={e => { setKelasId(e.target.value); setRows(prev => prev.map(r => ({ ...r, kelas_id: e.target.value }))) }} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm">
            <option value="">-- Pilih Kelas (wajib, untuk semua baris) --</option>
            {kelasOptions.map(k => <option key={k.id} value={k.id}>Kelas {k.tingkat} {k.nama_kelas} {k.tahun_ajaran ? `· ${k.tahun_ajaran}` : ''}</option>)}
          </select>
          <p className="text-[11px] text-gray-400">Tip: Export per kelas dari Google Admin, lalu import per file per kelas.</p>
        </div>

        {rows.length > 0 && (
          <div className="border border-gray-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 sticky top-0">
                <tr><th className="px-3 py-2 text-left">#</th><th className="px-3 py-2 text-left">Nama</th><th className="px-3 py-2 text-left">Email</th><th className="px-3 py-2 text-left">NIS</th><th className="px-3 py-2 text-left">Status</th></tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.idx} className={r.error ? 'bg-red-50' : 'bg-white'}>
                    <td className="px-3 py-2">{r.idx + 1}</td>
                    <td className="px-3 py-2">{r.nama_lengkap || <span className="text-gray-400">-</span>}</td>
                    <td className="px-3 py-2 font-mono">{r.email}</td>
                    <td className="px-3 py-2">{r.nis}</td>
                    <td className="px-3 py-2">{r.error ? <span className="inline-flex items-center gap-1 text-red-600"><AlertCircle className="h-3 w-3" />{r.error}</span> : <span className="inline-flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-3 w-3" />OK</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {result && (
          <div className={`rounded-xl p-3 text-sm ${result.failed === 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>
            <strong>Hasil:</strong> {result.success} sukses, {result.failed} gagal dari {result.total}
            {result.failed > 0 && (
              <ul className="mt-2 text-xs list-disc pl-5">
                {result.results.filter(r => !r.ok).slice(0, 10).map(r => <li key={r.index}>{r.email}: {r.error}</li>)}
              </ul>
            )}
          </div>
        )}

        <div className="flex gap-3 pt-2 border-t border-gray-100">
          <Button type="button" variant="secondary" onClick={onClose} fullWidth> Tutup</Button>
          <Button type="button" onClick={handleSubmit} disabled={!canSubmit || submitting} loading={submitting} fullWidth>
            {submitting ? 'Mengimpor...' : `Import ${rows.length} Siswa`}
          </Button>
        </div>
        {!canSubmit && rows.length > 0 && <p className="text-[11px] text-amber-600">Perbaiki error & pilih kelas dulu sebelum import.</p>}
      </div>
    </Modal>
  )
}
