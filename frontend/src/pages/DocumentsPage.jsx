import React, { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useDropzone } from 'react-dropzone'
import toast from 'react-hot-toast'
import { documentsAPI, clientsAPI, authAPI } from '../services/api'
import useAuthStore from '../store/authStore'
import { Upload, FileText, Trash2, RefreshCw, Download, Eye, CheckCircle, AlertCircle, Clock, ArrowLeft, Users, TrendingUp, X } from 'lucide-react'
import clsx from 'clsx'

const DOC_CATEGORIES = [
  { value: 'sales_invoice', label: 'Sales Invoice', group: 'Sales / Income', color: 'bg-blue-100 text-blue-800', desc: 'B2B & B2C sales bills — GSTR-1, Output GST, P&L income' },
  { value: 'sales_return', label: 'Sales Return / Credit Note', group: 'Sales / Income', color: 'bg-blue-100 text-blue-800', desc: 'Credit notes — reduces output GST' },
  { value: 'export_invoice', label: 'Export Invoice', group: 'Sales / Income', color: 'bg-blue-100 text-blue-800', desc: 'Zero-rated exports — Table 6A of GSTR-1' },
  { value: 'service_invoice', label: 'Service Invoice', group: 'Sales / Income', color: 'bg-blue-100 text-blue-800', desc: 'Service billing with SAC codes' },
  { value: 'purchase_invoice', label: 'Purchase Invoice', group: 'Purchases / Expenses', color: 'bg-purple-100 text-purple-800', desc: 'Supplier bills — ITC, GSTR-2B, P&L cost' },
  { value: 'purchase_return', label: 'Purchase Return / Debit Note', group: 'Purchases / Expenses', color: 'bg-purple-100 text-purple-800', desc: 'Debit notes to suppliers' },
  { value: 'import_invoice', label: 'Import Invoice', group: 'Purchases / Expenses', color: 'bg-purple-100 text-purple-800', desc: 'Import bills — IGST reverse charge' },
  { value: 'expense_bill', label: 'Expense Bill', group: 'Purchases / Expenses', color: 'bg-orange-100 text-orange-800', desc: 'Rent, electricity, telephone, misc.' },
  { value: 'salary_slip', label: 'Salary Slip / Payroll', group: 'Purchases / Expenses', color: 'bg-orange-100 text-orange-800', desc: 'Employee salaries — TDS 192, PF, ESIC' },
  { value: 'petty_cash', label: 'Petty Cash Voucher', group: 'Purchases / Expenses', color: 'bg-orange-100 text-orange-800', desc: 'Small cash expenses' },
  { value: 'bank_statement', label: 'Bank Statement', group: 'Bank & Finance', color: 'bg-green-100 text-green-800', desc: 'Bank account statement — reconciliation' },
  { value: 'cash_book', label: 'Cash Book / Cash Flow', group: 'Bank & Finance', color: 'bg-green-100 text-green-800', desc: 'Cash transactions' },
  { value: 'loan_statement', label: 'Loan Statement', group: 'Bank & Finance', color: 'bg-green-100 text-green-800', desc: 'Loan EMI & interest — balance sheet' },
  { value: 'investment_proof', label: 'Investment Proof', group: 'Bank & Finance', color: 'bg-green-100 text-green-800', desc: 'LIC, ELSS, PPF, FD — 80C deductions' },
  { value: 'bank_interest_cert', label: 'Bank Interest Certificate', group: 'Bank & Finance', color: 'bg-green-100 text-green-800', desc: 'FD interest — Schedule OS in ITR' },
  { value: 'tds_certificate', label: 'TDS Certificate (Form 16/16A)', group: 'TDS Documents', color: 'bg-red-100 text-red-800', desc: 'TDS deducted — ITR tax credit' },
  { value: 'form_26as', label: 'Form 26AS / AIS', group: 'TDS Documents', color: 'bg-red-100 text-red-800', desc: 'Annual tax credit statement' },
  { value: 'advance_tax_challan', label: 'Advance Tax Challan', group: 'TDS Documents', color: 'bg-red-100 text-red-800', desc: 'Advance tax paid — ITR credit' },
  { value: 'tds_return', label: 'TDS Return (24Q/26Q)', group: 'TDS Documents', color: 'bg-red-100 text-red-800', desc: 'Quarterly TDS returns' },
  { value: 'gstr2b_statement', label: 'GSTR-2B Statement', group: 'GST Documents', color: 'bg-indigo-100 text-indigo-800', desc: 'Auto-drafted ITC from GSTN' },
  { value: 'eway_bill', label: 'E-Way Bill', group: 'GST Documents', color: 'bg-indigo-100 text-indigo-800', desc: 'Transport document > ₹50,000' },
  { value: 'gst_payment_challan', label: 'GST Payment Challan', group: 'GST Documents', color: 'bg-indigo-100 text-indigo-800', desc: 'GST paid challan PMT-06' },
  { value: 'rcm_invoice', label: 'RCM Invoice (Reverse Charge)', group: 'GST Documents', color: 'bg-indigo-100 text-indigo-800', desc: 'Reverse charge mechanism invoices' },
  { value: 'asset_invoice', label: 'Asset Purchase Invoice', group: 'Fixed Assets', color: 'bg-yellow-100 text-yellow-800', desc: 'Capital assets — depreciation, balance sheet' },
  { value: 'asset_sale_deed', label: 'Asset Sale / Disposal', group: 'Fixed Assets', color: 'bg-yellow-100 text-yellow-800', desc: 'Capital gains — ITR Schedule CG' },
  { value: 'depreciation_chart', label: 'Depreciation Chart', group: 'Fixed Assets', color: 'bg-yellow-100 text-yellow-800', desc: 'WDV depreciation schedule' },
  { value: 'moa_aoa', label: 'MOA / AOA / Partnership Deed', group: 'Compliance & Legal', color: 'bg-gray-100 text-gray-700', desc: 'Incorporation documents' },
  { value: 'previous_itr', label: 'Previous Year ITR', group: 'Compliance & Legal', color: 'bg-gray-100 text-gray-700', desc: 'Last year ITR — carry forward losses' },
  { value: 'audit_report', label: 'Audit Report (3CD/3CB)', group: 'Compliance & Legal', color: 'bg-gray-100 text-gray-700', desc: 'Tax audit report' },
  { value: 'other', label: 'Other Document', group: 'Compliance & Legal', color: 'bg-gray-100 text-gray-700', desc: 'Any other supporting document' },
]
const DOC_GROUPS = [...new Set(DOC_CATEGORIES.map(d => d.group))]
const FY_OPTIONS = ['2026-27','2025-26','2024-25','2023-24','2022-23']

function StatusBadge({ status }) {
  const map = {
    completed: { cls: 'bg-green-100 text-green-700', icon: CheckCircle, label: 'Processed' },
    pending: { cls: 'bg-amber-100 text-amber-700', icon: Clock, label: 'Pending' },
    processing: { cls: 'bg-blue-100 text-blue-700', icon: RefreshCw, label: 'Processing' },
    failed: { cls: 'bg-red-100 text-red-700', icon: AlertCircle, label: 'Failed' },
  }
  const { cls, icon: Icon, label } = map[status] || map.pending
  return <span className={`${cls} flex items-center gap-1 text-xs px-2 py-0.5 rounded-full`}><Icon size={10}/>{label}</span>
}

function DocViewModal({ doc, onClose }) {
  const viewUrl = documentsAPI.viewUrl(doc.id)
  const isImage = doc.mime_type?.startsWith('image/')
  const isPdf = doc.mime_type === 'application/pdf'
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-semibold text-gray-900">{doc.original_filename}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{doc.processing_status}</p>
          </div>
          <div className="flex items-center gap-2">
            <a href={documentsAPI.downloadUrl(doc.id)} target="_blank" rel="noreferrer" className="btn-secondary flex items-center gap-2 text-sm"><Download size={14}/>Download</a>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X size={18}/></button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4 bg-gray-100 min-h-0">
          {isPdf ? <iframe src={viewUrl} className="w-full h-full min-h-[500px] rounded-lg border" title={doc.original_filename}/>
            : isImage ? <img src={viewUrl} alt={doc.original_filename} className="max-w-full mx-auto rounded-lg shadow"/>
            : <div className="flex items-center justify-center h-48 text-gray-500 flex-col gap-3"><FileText size={48} className="opacity-40"/><p>Preview not available</p><a href={documentsAPI.downloadUrl(doc.id)} target="_blank" rel="noreferrer" className="btn-primary flex items-center gap-2"><Download size={14}/>Download to view</a></div>}
        </div>
      </div>
    </div>
  )
}

function ClientSelectorView({ onSelectClient }) {
  const { data: clients = [], isLoading } = useQuery({ queryKey: ['clients'], queryFn: () => clientsAPI.list().then(r => r.data) })
  return (
    <div className="p-6 space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-900">Documents</h1><p className="text-sm text-gray-500 mt-1">Select a client to manage their documents</p></div>
      {isLoading ? <div className="flex justify-center py-16"><div className="spinner w-8 h-8"/></div>
        : clients.length === 0 ? <div className="card p-16 text-center text-gray-400"><Users size={40} className="mx-auto mb-3 opacity-40"/><p>No clients found — create a client in Admin first</p></div>
        : <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {clients.map(c => (
            <button key={c.id} onClick={() => onSelectClient(c)} className="card p-5 text-left hover:border-primary-300 hover:shadow-md transition-all cursor-pointer">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center"><Users size={18} className="text-primary-600"/></div>
                <div className="flex-1 min-w-0"><p className="font-semibold text-gray-900 truncate">{c.business_name}</p><p className="text-xs text-gray-500 truncate">{c.email}</p></div>
              </div>
              <div className="grid grid-cols-2 gap-1 text-xs text-gray-500">
                <span><b>PAN:</b> {c.pan||'—'}</span><span><b>GSTIN:</b> {c.gstin||'Not Reg'}</span>
              </div>
            </button>
          ))}
        </div>}
    </div>
  )
}

function DocumentManagerView({ clientId, clientName, isAdminView, onBack }) {
  const [docType, setDocType] = useState('sales_invoice')
  const [fy, setFy] = useState('2024-25')
  const [activeGroup, setActiveGroup] = useState('All')
  const [activeCategory, setActiveCategory] = useState('all')
  const [uploading, setUploading] = useState(false)
  const [viewDoc, setViewDoc] = useState(null)

  const { data: catData, isLoading, refetch } = useQuery({
    queryKey: ['docs-by-category', clientId, fy],
    queryFn: () => documentsAPI.byCategory(clientId, fy).then(r => r.data),
    enabled: !!clientId, refetchInterval: 8000,
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => documentsAPI.delete(id),
    onSuccess: () => { toast.success('Document deleted'); refetch() },
    onError: (e) => toast.error(e.response?.data?.detail || 'Delete failed'),
  })

  const reprocessMutation = useMutation({
    mutationFn: (id) => documentsAPI.reprocess(id),
    onSuccess: () => { toast.success('Queued for reprocessing'); refetch() },
  })

  const onDrop = useCallback(async (acceptedFiles) => {
    if (!clientId) { toast.error('No client profile found. Complete your profile first.'); return }
    setUploading(true)
    let success = 0
    for (const file of acceptedFiles) {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('document_type', docType)
      fd.append('financial_year', fy)
      // KEY FIX: Only send client_id when admin is uploading for a specific client
      // For client users, backend auto-resolves from their profile - don't send client_id
      if (isAdminView && clientId) fd.append('client_id', String(clientId))
      try {
        await documentsAPI.upload(fd)
        success++
      } catch (e) {
        const msg = e.response?.data?.detail || 'Upload failed'
        toast.error(`${file.name}: ${msg}`)
      }
    }
    setUploading(false)
    if (success > 0) { toast.success(`${success} file(s) uploaded successfully!`); refetch() }
  }, [docType, fy, clientId, isAdminView])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'], 'image/*': ['.jpg','.jpeg','.png','.tiff','.tif'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'], 'text/csv': ['.csv'] },
    maxSize: 20 * 1024 * 1024, multiple: true,
  })

  const fmt = (b) => !b ? '—' : b < 1048576 ? `${(b/1024).toFixed(0)} KB` : `${(b/1048576).toFixed(1)} MB`
  const filteredCats = activeGroup === 'All' ? DOC_CATEGORIES : DOC_CATEGORIES.filter(c => c.group === activeGroup)
  const displayDocs = activeCategory === 'all'
    ? filteredCats.flatMap(c => (catData?.categories?.[c.value]||[]).map(d => ({...d,_catKey:c.value,_catLabel:c.label,_catColor:c.color})))
    : (catData?.categories?.[activeCategory]||[]).map(d => { const cat = DOC_CATEGORIES.find(c=>c.value===activeCategory); return {...d,_catKey:activeCategory,_catLabel:cat?.label,_catColor:cat?.color} })

  return (
    <div className="p-6 space-y-5">
      {viewDoc && <DocViewModal doc={viewDoc} onClose={() => setViewDoc(null)}/>}
      <div className="flex items-center gap-3 flex-wrap">
        {onBack && <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg"><ArrowLeft size={20} className="text-gray-600"/></button>}
        <div className="flex-1"><h1 className="text-2xl font-bold text-gray-900">{clientName || 'My Documents'}</h1><p className="text-sm text-gray-500">{catData?.summary?.total||0} files • {catData?.summary?.processed||0} processed • FY {fy}</p></div>
        <select className="input w-36 text-sm" value={fy} onChange={e=>setFy(e.target.value)}>{FY_OPTIONS.map(y=><option key={y}>{y}</option>)}</select>
      </div>

      <div className="card p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Upload Document</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="label">Document Category</label>
            <select className="input" value={docType} onChange={e=>setDocType(e.target.value)}>
              {DOC_GROUPS.map(grp=><optgroup key={grp} label={`── ${grp} ──`}>{DOC_CATEGORIES.filter(c=>c.group===grp).map(c=><option key={c.value} value={c.value}>{c.label}</option>)}</optgroup>)}
            </select>
            <p className="text-xs text-gray-500 mt-1">📌 {DOC_CATEGORIES.find(c=>c.value===docType)?.desc}</p>
          </div>
          <div><label className="label">Financial Year</label><select className="input" value={fy} onChange={e=>setFy(e.target.value)}>{FY_OPTIONS.map(y=><option key={y}>{y}</option>)}</select></div>
        </div>
        <div {...getRootProps()} className={clsx('border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all', isDragActive?'border-primary-500 bg-primary-50':'border-gray-300 hover:border-primary-400 hover:bg-gray-50')}>
          <input {...getInputProps()}/>
          <div className="flex flex-col items-center gap-3">
            {uploading?<div className="spinner w-10 h-10"/>:<Upload size={32} className={isDragActive?'text-primary-500':'text-gray-400'}/>}
            <div>
              <p className="font-medium text-gray-700">{uploading?'Uploading & processing...':isDragActive?'Drop files here':'Drag & drop or click to select files'}</p>
              <p className="text-sm text-gray-500 mt-1">PDF, JPG, PNG, XLSX — max 20MB each</p>
              <p className="text-xs text-primary-600 mt-1 font-medium">✓ After upload, OCR extracts data → GST, ITR, P&L update automatically</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {['All',...DOC_GROUPS].map(grp=><button key={grp} onClick={()=>{setActiveGroup(grp);setActiveCategory('all')}} className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium transition-all',activeGroup===grp?'bg-primary-600 text-white':'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50')}>{grp}</button>)}
      </div>
      <div className="flex flex-wrap gap-2">
        <button onClick={()=>setActiveCategory('all')} className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium',activeCategory==='all'?'bg-gray-800 text-white':'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50')}>
          All ({filteredCats.reduce((s,c)=>s+(catData?.categories?.[c.value]?.length||0),0)})
        </button>
        {filteredCats.map(cat=>{
          const count=catData?.categories?.[cat.value]?.length||0
          return <button key={cat.value} onClick={()=>setActiveCategory(cat.value)} className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium',activeCategory===cat.value?'bg-gray-800 text-white':'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50')}>{cat.label}{count>0?` (${count})`:''}</button>
        })}
      </div>

      <div className="card">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">{activeCategory==='all'?`${activeGroup} Documents`:DOC_CATEGORIES.find(c=>c.value===activeCategory)?.label} <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{displayDocs.length}</span></h3>
        </div>
        {isLoading?<div className="flex justify-center py-16"><div className="spinner w-8 h-8"/></div>
          :displayDocs.length===0?<div className="text-center py-12 text-gray-400"><FileText size={36} className="mx-auto mb-3 opacity-30"/><p>No documents in this category</p><p className="text-sm mt-1">Upload files using the area above</p></div>
          :<div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="bg-gray-50">{['Filename','Category','Status','OCR%','Size','Date','Actions'].map(h=><th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-100">
              {displayDocs.map(doc=>(
                <tr key={doc.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3"><div className="flex items-center gap-2"><FileText size={14} className="text-gray-400 flex-shrink-0"/><div className="min-w-0"><p className="truncate max-w-[150px] font-medium text-gray-800">{doc.original_filename}</p>{doc.extracted_data?.total_amount&&<p className="text-xs text-green-600">₹{parseFloat(doc.extracted_data.total_amount).toLocaleString()}</p>}</div></div></td>
                  <td className="px-4 py-3"><span className={`text-xs px-2 py-1 rounded-full font-medium ${doc._catColor||'bg-gray-100 text-gray-600'}`}>{doc._catLabel||doc._catKey}</span></td>
                  <td className="px-4 py-3"><StatusBadge status={doc.processing_status}/></td>
                  <td className="px-4 py-3"><div className="flex items-center gap-1.5"><div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden"><div className={clsx('h-full rounded-full',(doc.confidence_score||0)>0.7?'bg-green-500':(doc.confidence_score||0)>0.4?'bg-amber-400':'bg-red-400')} style={{width:`${(doc.confidence_score||0)*100}%`}}/></div><span className="text-xs text-gray-500">{Math.round((doc.confidence_score||0)*100)}%</span></div></td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{fmt(doc.file_size)}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{doc.upload_date?new Date(doc.upload_date).toLocaleDateString('en-IN'):'—'}</td>
                  <td className="px-4 py-3"><div className="flex items-center gap-1">
                    <button onClick={()=>setViewDoc(doc)} className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded" title="View"><Eye size={14}/></button>
                    <a href={documentsAPI.downloadUrl(doc.id)} target="_blank" rel="noreferrer" className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded" title="Download"><Download size={14}/></a>
                    <button onClick={()=>reprocessMutation.mutate(doc.id)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Reprocess"><RefreshCw size={14}/></button>
                    <button onClick={()=>{if(window.confirm(`Delete "${doc.original_filename}"?`))deleteMutation.mutate(doc.id)}} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Delete"><Trash2 size={14}/></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table></div>}
      </div>
    </div>
  )
}

export default function DocumentsPage() {
  const { isCA, user } = useAuthStore()
  const [selectedClient, setSelectedClient] = useState(null)

  const { data: myProfile } = useQuery({
    queryKey: ['my-profile', user?.id],
    queryFn: () => authAPI.myProfile().then(r => r.data),
    enabled: !isCA() && !!user,
  })

  if (!isCA()) {
    const clientId = myProfile?.profile?.id
    const clientName = myProfile?.profile?.business_name || user?.full_name
    if (!myProfile) return <div className="flex justify-center py-20"><div className="spinner w-8 h-8"/></div>
    if (!myProfile.profile) return (
      <div className="p-6 card m-6 p-8 text-center">
        <AlertCircle size={40} className="mx-auto mb-3 text-amber-500"/>
        <p className="font-semibold text-gray-800">Complete your Business Profile first</p>
        <p className="text-sm text-gray-500 mt-1">Go to Profile → Business Profile tab → Add PAN and Business Name</p>
        <a href="/profile" className="btn-primary mt-4 inline-block">Go to Profile</a>
      </div>
    )
    return <DocumentManagerView clientId={clientId} clientName={clientName} isAdminView={false} onBack={null}/>
  }

  if (!selectedClient) return <ClientSelectorView onSelectClient={setSelectedClient}/>
  return <DocumentManagerView clientId={selectedClient.id} clientName={selectedClient.business_name} isAdminView={true} onBack={()=>setSelectedClient(null)}/>
}
