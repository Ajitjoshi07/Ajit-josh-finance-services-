import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, useFieldArray } from 'react-hook-form'
import toast from 'react-hot-toast'
import { manualEntryAPI, authAPI } from '../services/api'
import useAuthStore from '../store/authStore'
import ClientSelector from '../components/shared/ClientSelector'
import { Plus, Trash2, Send, CheckCircle, Clock, XCircle, History, ListChecks, PenLine, ChevronDown, ChevronUp, Info } from 'lucide-react'

const FY_OPTIONS = ['2026-27','2025-26','2024-25','2023-24','2022-23']
const ENTRY_TYPES = [
  { value: 'sales', label: 'Sales Invoice', hint: 'Revenue from customers' },
  { value: 'purchase', label: 'Purchase Invoice', hint: 'Goods/services from suppliers' },
  { value: 'expense', label: 'Business Expense', hint: 'Rent, electricity, misc.' },
  { value: 'salary_slip', label: 'Salary/Payroll', hint: 'Employee salaries' },
  { value: 'bank', label: 'Bank Entry', hint: 'Bank deposits/withdrawals' },
  { value: 'asset_invoice', label: 'Asset Purchase', hint: 'Equipment/furniture' },
]
const GST_RATES = [{ value: 0, label: 'Nil (0%)' },{ value: 5, label: '5%' },{ value: 12, label: '12%' },{ value: 18, label: '18%' },{ value: 28, label: '28%' }]
const MONTHS = [{v:4,l:'April'},{v:5,l:'May'},{v:6,l:'June'},{v:7,l:'July'},{v:8,l:'August'},{v:9,l:'September'},{v:10,l:'October'},{v:11,l:'November'},{v:12,l:'December'},{v:1,l:'January'},{v:2,l:'February'},{v:3,l:'March'}]

function EntryRow({ index, remove, register, watch, setValue }) {
  const [expanded, setExpanded] = useState(true)
  const txnType = watch(`entries.${index}.transaction_type`)
  const taxableAmt = parseFloat(watch(`entries.${index}.taxable_amount`) || 0)
  const gstRate = parseFloat(watch(`entries.${index}.gst_rate`) || 0)
  const showGST = ['sales', 'purchase'].includes(txnType)

  React.useEffect(() => {
    if (taxableAmt > 0 && showGST && gstRate > 0) {
      const gstAmt = (taxableAmt * gstRate) / 100
      setValue(`entries.${index}.cgst_amount`, (gstAmt / 2).toFixed(2))
      setValue(`entries.${index}.sgst_amount`, (gstAmt / 2).toFixed(2))
      setValue(`entries.${index}.total_amount`, (taxableAmt + gstAmt).toFixed(2))
    } else if (taxableAmt > 0) {
      setValue(`entries.${index}.cgst_amount`, '0')
      setValue(`entries.${index}.sgst_amount`, '0')
      setValue(`entries.${index}.total_amount`, taxableAmt.toFixed(2))
    }
  }, [taxableAmt, gstRate, showGST])

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
      <div className="flex items-center gap-3 p-4 flex-wrap">
        <span className="w-6 h-6 bg-primary-600 text-white rounded-full text-xs flex items-center justify-center font-bold flex-shrink-0">{index+1}</span>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-1 min-w-0">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Type *</label>
            <select className="input text-sm py-1.5" {...register(`entries.${index}.transaction_type`, { required: true })}>
              {ENTRY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Party Name</label>
            <input className="input text-sm py-1.5" placeholder="Customer/Supplier" {...register(`entries.${index}.party_name`)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Invoice No</label>
            <input className="input text-sm py-1.5" placeholder="INV-001" {...register(`entries.${index}.invoice_number`)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Amount (₹) *</label>
            <input type="number" step="0.01" min="0" className="input text-sm py-1.5" placeholder="0.00" {...register(`entries.${index}.taxable_amount`, { required: true, min: 0.01 })} />
          </div>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button type="button" onClick={() => setExpanded(!expanded)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded">
            {expanded ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}
          </button>
          <button type="button" onClick={() => remove(index)} className="p-1.5 text-gray-400 hover:text-red-600 rounded">
            <Trash2 size={15}/>
          </button>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-gray-200 bg-white p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Invoice Date</label>
            <input type="date" className="input text-sm py-1.5" {...register(`entries.${index}.invoice_date`)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Month</label>
            <select className="input text-sm py-1.5" {...register(`entries.${index}.month`)}>
              <option value="">Auto from date</option>
              {MONTHS.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Party GSTIN</label>
            <input className="input text-sm py-1.5 font-mono uppercase" placeholder="27ABCDE1234F1Z5" maxLength={15} {...register(`entries.${index}.party_gstin`)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">HSN/SAC Code</label>
            <input className="input text-sm py-1.5" placeholder="e.g. 9954" {...register(`entries.${index}.hsn_code`)} />
          </div>
          {showGST && (
            <>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">GST Rate</label>
                <select className="input text-sm py-1.5" {...register(`entries.${index}.gst_rate`)}>
                  {GST_RATES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">CGST (₹)</label>
                <input type="number" step="0.01" className="input text-sm py-1.5 bg-gray-50" readOnly {...register(`entries.${index}.cgst_amount`)} />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">SGST (₹)</label>
                <input type="number" step="0.01" className="input text-sm py-1.5 bg-gray-50" readOnly {...register(`entries.${index}.sgst_amount`)} />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Total (₹)</label>
                <input type="number" step="0.01" className="input text-sm py-1.5 bg-green-50 font-semibold text-green-800" readOnly {...register(`entries.${index}.total_amount`)} />
              </div>
            </>
          )}
          <div className="md:col-span-4">
            <label className="text-xs text-gray-500 mb-1 block">Description</label>
            <input className="input text-sm py-1.5" placeholder="Brief description" {...register(`entries.${index}.description`)} />
          </div>
          <div className="md:col-span-4 bg-blue-50 rounded-lg p-2 flex items-start gap-2 text-xs text-blue-700">
            <Info size={12} className="flex-shrink-0 mt-0.5"/>
            <span>After CA approval, this updates GST, ITR, P&L and Balance Sheet automatically per ICAI standards.</span>
          </div>
        </div>
      )}
    </div>
  )
}

function HistoryTable({ entries, showClient = false }) {
  if (!entries.length) return (
    <div className="text-center py-10 text-gray-400">
      <History size={32} className="mx-auto mb-2 opacity-40"/>
      <p>No entries yet</p>
    </div>
  )
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="bg-gray-50">
          {showClient && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Client</th>}
          {['Type','Invoice','Party','Amount','Description','Status','Date'].map(h => (
            <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
          ))}
        </tr></thead>
        <tbody className="divide-y divide-gray-100">
          {entries.map(e => (
            <tr key={e.id} className="hover:bg-gray-50">
              {showClient && <td className="px-4 py-3 text-xs text-gray-500">#{e.client_id}</td>}
              <td className="px-4 py-3"><span className="badge-info capitalize text-xs">{e.transaction_type}</span></td>
              <td className="px-4 py-3 text-xs">{e.invoice_number||'—'}</td>
              <td className="px-4 py-3 text-xs">{e.party_name||'—'}</td>
              <td className="px-4 py-3 font-semibold text-xs">₹{parseFloat(e.total_amount||0).toLocaleString()}</td>
              <td className="px-4 py-3 text-xs text-gray-500 max-w-[100px] truncate">{e.description||'—'}</td>
              <td className="px-4 py-3">
                {e.status==='approved' && <span className="badge-success flex items-center gap-1 w-fit text-xs"><CheckCircle size={10}/>Approved</span>}
                {e.status==='pending' && <span className="badge-warning flex items-center gap-1 w-fit text-xs"><Clock size={10}/>Pending</span>}
                {e.status==='rejected' && <span className="badge-danger flex items-center gap-1 w-fit text-xs"><XCircle size={10}/>Rejected</span>}
              </td>
              <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                {e.created_at ? new Date(e.created_at).toLocaleDateString('en-IN') : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function EntryForm({ fy, setFy, forClientId = null }) {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const { register, handleSubmit, control, watch, setValue, reset } = useForm({
    defaultValues: { entries: [{ transaction_type: 'sales', party_name: '', invoice_number: '', taxable_amount: '', invoice_date: '', month: '', party_gstin: '', hsn_code: '', gst_rate: 18, cgst_amount: 0, sgst_amount: 0, igst_amount: 0, total_amount: '', description: '' }] }
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'entries' })

  const { data: myEntries = [], refetch } = useQuery({
    queryKey: ['my-entries', fy, forClientId || user?.id],
    queryFn: () => manualEntryAPI.myEntries(fy).then(r => r.data),
  })

  const submitMutation = useMutation({
    mutationFn: (data) => manualEntryAPI.submit({
      financial_year: fy,
      client_id: forClientId,
      entries: data.entries.map(e => ({
        transaction_type: e.transaction_type,
        invoice_number: e.invoice_number || null,
        invoice_date: e.invoice_date || null,
        party_name: e.party_name || null,
        party_gstin: e.party_gstin || null,
        description: e.description || null,
        hsn_code: e.hsn_code || null,
        taxable_amount: parseFloat(e.taxable_amount) || 0,
        cgst_amount: parseFloat(e.cgst_amount) || 0,
        sgst_amount: parseFloat(e.sgst_amount) || 0,
        igst_amount: 0,
        total_amount: parseFloat(e.total_amount) || parseFloat(e.taxable_amount) || 0,
        tds_amount: 0,
        month: e.month ? parseInt(e.month) : null,
        financial_year: fy,
      }))
    }),
    onSuccess: () => { toast.success('Submitted for CA review!'); reset(); refetch() },
    onError: (e) => toast.error(e.response?.data?.detail || 'Submission failed'),
  })

  const pending = myEntries.filter(e => e.status === 'pending').length
  const approved = myEntries.filter(e => e.status === 'approved').length

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 text-center"><Clock size={18} className="text-amber-500 mx-auto mb-1"/><p className="text-xl font-bold">{pending}</p><p className="text-xs text-gray-500">Pending Review</p></div>
        <div className="card p-4 text-center"><CheckCircle size={18} className="text-green-500 mx-auto mb-1"/><p className="text-xl font-bold">{approved}</p><p className="text-xs text-gray-500">Approved</p></div>
        <div className="card p-4 text-center"><XCircle size={18} className="text-red-500 mx-auto mb-1"/><p className="text-xl font-bold">{myEntries.filter(e=>e.status==='rejected').length}</p><p className="text-xs text-gray-500">Rejected</p></div>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <h3 className="font-semibold text-gray-900">Add Transactions</h3>
          <select className="input w-36 text-sm" value={fy} onChange={e => setFy(e.target.value)}>
            {FY_OPTIONS.map(y => <option key={y}>{y}</option>)}
          </select>
        </div>
        <form onSubmit={handleSubmit(d => submitMutation.mutate(d))} className="space-y-4">
          {fields.map((field, i) => (
            <EntryRow key={field.id} index={i} remove={remove} register={register} watch={watch} setValue={setValue} />
          ))}
          <button type="button" onClick={() => append({ transaction_type: 'sales', party_name: '', invoice_number: '', taxable_amount: '', invoice_date: '', month: '', party_gstin: '', hsn_code: '', gst_rate: 18, cgst_amount: 0, sgst_amount: 0, igst_amount: 0, total_amount: '', description: '' })}
            className="w-full border-2 border-dashed border-gray-300 rounded-xl p-4 text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-all flex items-center justify-center gap-2">
            <Plus size={16}/><span className="font-medium">Add Another Transaction</span>
          </button>
          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">{fields.length} {fields.length===1?'entry':'entries'} ready</p>
            <button type="submit" disabled={submitMutation.isPending || fields.length === 0} className="btn-primary flex items-center gap-2 px-6">
              {submitMutation.isPending ? <div className="spinner w-4 h-4"/> : <Send size={15}/>}
              Submit for CA Review
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <History size={18} className="text-gray-500"/>
          <h3 className="font-semibold text-gray-900">Submission History — FY {fy}</h3>
          <span className="badge-gray ml-auto">{myEntries.length}</span>
        </div>
        <HistoryTable entries={myEntries} />
      </div>
    </div>
  )
}

function CAReviewView({ fy, setFy }) {
  const qc = useQueryClient()
  const [selectedClient, setSelectedClient] = useState(null)
  const [selectedIds, setSelectedIds] = useState([])

  const { data: pending = [], isLoading, refetch } = useQuery({
    queryKey: ['pending-entries', fy, selectedClient?.id],
    queryFn: () => manualEntryAPI.pending({ financial_year: fy, client_id: selectedClient?.id }).then(r => r.data),
    refetchInterval: 15000,
  })

  const { data: allEntries = [] } = useQuery({
    queryKey: ['all-entries', fy],
    queryFn: () => manualEntryAPI.pending({ financial_year: fy }).then(r => r.data),
  })

  const approveMutation = useMutation({
    mutationFn: (id) => manualEntryAPI.approve(id),
    onSuccess: () => { toast.success('Entry approved!'); refetch() },
    onError: (e) => toast.error(e.response?.data?.detail || 'Failed'),
  })
  const approveBatchMutation = useMutation({
    mutationFn: (ids) => manualEntryAPI.approveBatch(ids),
    onSuccess: (res) => { toast.success(`${res.data.approved} entries approved!`); setSelectedIds([]); refetch() },
  })
  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }) => manualEntryAPI.reject(id, reason),
    onSuccess: () => { toast.success('Entry rejected'); refetch() },
  })

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="font-semibold text-gray-900">Pending Review</h3>
            <span className="badge-warning">{pending.length} entries</span>
          </div>
          <div className="flex gap-3 flex-wrap items-center">
            <select className="input w-40 text-sm" value={fy} onChange={e => setFy(e.target.value)}>
              {FY_OPTIONS.map(y => <option key={y}>{y}</option>)}
            </select>
            <ClientSelector selectedClient={selectedClient} onSelect={setSelectedClient} label="Filter by:" />
            {selectedIds.length > 0 && (
              <button onClick={() => approveBatchMutation.mutate(selectedIds)} className="btn-primary flex items-center gap-2 text-sm">
                <CheckCircle size={14}/>Approve ({selectedIds.length})
              </button>
            )}
          </div>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-10"><div className="spinner w-8 h-8"/></div>
        ) : pending.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <ListChecks size={36} className="mx-auto mb-2 opacity-40"/>
            <p>No pending entries{selectedClient ? ` for ${selectedClient.business_name}` : ''}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50">
                <th className="px-3 py-3 w-10"><input type="checkbox" checked={selectedIds.length===pending.length&&pending.length>0} onChange={e=>setSelectedIds(e.target.checked?pending.map(p=>p.id):[])}/></th>
                {['Client','Type','Invoice','Party','Taxable','Total','Desc','Date','Actions'].map(h=>(
                  <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {pending.map(e => (
                  <tr key={e.id} className={selectedIds.includes(e.id)?'bg-blue-50 hover:bg-blue-50':'hover:bg-gray-50'}>
                    <td className="px-3 py-3"><input type="checkbox" checked={selectedIds.includes(e.id)} onChange={()=>setSelectedIds(p=>p.includes(e.id)?p.filter(i=>i!==e.id):[...p,e.id])}/></td>
                    <td className="px-3 py-3 text-xs text-gray-500">#{e.client_id}</td>
                    <td className="px-3 py-3"><span className="badge-info capitalize text-xs">{e.transaction_type}</span></td>
                    <td className="px-3 py-3 text-xs">{e.invoice_number||'—'}</td>
                    <td className="px-3 py-3 text-xs">{e.party_name||'—'}</td>
                    <td className="px-3 py-3 text-xs">₹{parseFloat(e.taxable_amount||0).toLocaleString()}</td>
                    <td className="px-3 py-3 font-semibold text-xs">₹{parseFloat(e.total_amount||0).toLocaleString()}</td>
                    <td className="px-3 py-3 text-xs text-gray-500 max-w-[80px] truncate">{e.description||'—'}</td>
                    <td className="px-3 py-3 text-xs text-gray-500 whitespace-nowrap">{e.created_at?new Date(e.created_at).toLocaleDateString('en-IN'):'—'}</td>
                    <td className="px-3 py-3">
                      <div className="flex gap-1">
                        <button onClick={()=>approveMutation.mutate(e.id)} className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Approve"><CheckCircle size={14}/></button>
                        <button onClick={()=>{const r=window.prompt('Reason for rejection:');if(r)rejectMutation.mutate({id:e.id,reason:r})}} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Reject"><XCircle size={14}/></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="card">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <History size={18} className="text-gray-500"/>
          <h3 className="font-semibold text-gray-900">All Submission History — FY {fy}</h3>
        </div>
        <HistoryTable entries={allEntries} showClient={true} />
      </div>
    </div>
  )
}

export default function ManualEntryPage() {
  const { isCA } = useAuthStore()
  const [view, setView] = useState(isCA() ? 'review' : 'entry')
  const [fy, setFy] = useState('2024-25')
  const [selectedClient, setSelectedClient] = useState(null)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{isCA() ? 'Manual Entry Review' : 'Enter Data Manually'}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {isCA() ? 'Review and approve client-submitted entries. Approved entries auto-update all accounts.' : 'No documents? Enter your transactions here. CA will review and approve.'}
          </p>
        </div>
        {isCA() && (
          <div className="flex gap-2">
            {[{id:'review',label:'Pending Review',icon:ListChecks},{id:'entry',label:'Add Entry for Client',icon:PenLine}].map(({id,label,icon:Icon})=>(
              <button key={id} onClick={()=>setView(id)} className={view===id?'btn-primary flex items-center gap-2 text-sm':'btn-secondary flex items-center gap-2 text-sm'}>
                <Icon size={14}/>{label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Admin adding entry on behalf of client */}
      {view === 'entry' && isCA() && (
        <div className="card p-4 bg-blue-50 border-blue-200">
          <p className="text-sm font-medium text-blue-800 mb-2">You are adding entries as Admin/CA</p>
          <ClientSelector selectedClient={selectedClient} onSelect={setSelectedClient} label="For client:" />
        </div>
      )}

      {view === 'entry' && <EntryForm fy={fy} setFy={setFy} forClientId={isCA() ? selectedClient?.id : null} />}
      {view === 'review' && isCA() && <CAReviewView fy={fy} setFy={setFy} />}
    </div>
  )
}
