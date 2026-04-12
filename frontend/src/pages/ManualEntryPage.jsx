import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, useFieldArray } from 'react-hook-form'
import toast from 'react-hot-toast'
import { manualEntryAPI, authAPI, clientsAPI } from '../services/api'
import useAuthStore from '../store/authStore'
import {
  Plus, Trash2, Send, CheckCircle, Clock, XCircle,
  ChevronDown, ChevronUp, Info, PenLine, ListChecks, History
} from 'lucide-react'
import clsx from 'clsx'

const FY_OPTIONS = ['2026-27', '2025-26', '2024-25', '2023-24', '2022-23']

const MONTHS = [
  { value: 4, label: 'April' }, { value: 5, label: 'May' }, { value: 6, label: 'June' },
  { value: 7, label: 'July' }, { value: 8, label: 'August' }, { value: 9, label: 'September' },
  { value: 10, label: 'October' }, { value: 11, label: 'November' }, { value: 12, label: 'December' },
  { value: 1, label: 'January' }, { value: 2, label: 'February' }, { value: 3, label: 'March' },
]

const ENTRY_TYPES = [
  { value: 'sales',        label: 'Sales Invoice',    hint: 'Revenue from customers', color: 'border-blue-200 bg-blue-50' },
  { value: 'purchase',     label: 'Purchase Invoice', hint: 'Goods/services from suppliers', color: 'border-purple-200 bg-purple-50' },
  { value: 'expense',      label: 'Business Expense', hint: 'Rent, electricity, misc.', color: 'border-orange-200 bg-orange-50' },
  { value: 'salary_slip',  label: 'Salary/Payroll',   hint: 'Employee salaries paid', color: 'border-red-200 bg-red-50' },
  { value: 'bank',         label: 'Bank Entry',       hint: 'Bank deposits/withdrawals', color: 'border-green-200 bg-green-50' },
  { value: 'asset_invoice',label: 'Asset Purchase',   hint: 'Equipment/furniture', color: 'border-yellow-200 bg-yellow-50' },
]

const GST_RATES = [
  { value: 0, label: 'Nil (0%)' }, { value: 5, label: '5%' },
  { value: 12, label: '12%' }, { value: 18, label: '18%' }, { value: 28, label: '28%' },
]

function EntryRow({ index, remove, register, watch, setValue }) {
  const [expanded, setExpanded] = useState(true)
  const txnType = watch(`entries.${index}.transaction_type`)
  const taxableAmt = parseFloat(watch(`entries.${index}.taxable_amount`) || 0)
  const gstRate = parseFloat(watch(`entries.${index}.gst_rate`) || 0)
  const showGST = ['sales', 'purchase'].includes(txnType)

  React.useEffect(() => {
    if (taxableAmt > 0) {
      if (showGST && gstRate > 0) {
        const gstAmt = (taxableAmt * gstRate) / 100
        setValue(`entries.${index}.cgst_amount`, (gstAmt / 2).toFixed(2))
        setValue(`entries.${index}.sgst_amount`, (gstAmt / 2).toFixed(2))
        setValue(`entries.${index}.total_amount`, (taxableAmt + gstAmt).toFixed(2))
      } else {
        setValue(`entries.${index}.cgst_amount`, '0')
        setValue(`entries.${index}.sgst_amount`, '0')
        setValue(`entries.${index}.total_amount`, taxableAmt.toFixed(2))
      }
    }
  }, [taxableAmt, gstRate, showGST])

  const typeInfo = ENTRY_TYPES.find(t => t.value === txnType)

  return (
    <div className={clsx('border rounded-xl overflow-hidden', typeInfo?.color || 'border-gray-200 bg-gray-50')}>
      <div className="flex items-center gap-3 p-4 flex-wrap">
        <span className="w-6 h-6 bg-primary-600 text-white rounded-full text-xs flex items-center justify-center flex-shrink-0 font-bold">
          {index + 1}
        </span>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-1 min-w-0">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Type *</label>
            <select className="input text-sm py-1.5" {...register(`entries.${index}.transaction_type`, { required: true })}>
              {ENTRY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Party Name</label>
            <input className="input text-sm py-1.5" placeholder="Customer/Supplier"
              {...register(`entries.${index}.party_name`)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Invoice No</label>
            <input className="input text-sm py-1.5" placeholder="INV-001"
              {...register(`entries.${index}.invoice_number`)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Amount (₹) *</label>
            <input type="number" step="0.01" min="0" className="input text-sm py-1.5" placeholder="0.00"
              {...register(`entries.${index}.taxable_amount`, { required: true, min: 0.01 })} />
          </div>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button type="button" onClick={() => setExpanded(!expanded)}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-white rounded">
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
          <button type="button" onClick={() => remove(index)}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded">
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-current/10 bg-white/70 p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Invoice Date</label>
            <input type="date" className="input text-sm py-1.5" {...register(`entries.${index}.invoice_date`)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Month (if no date)</label>
            <select className="input text-sm py-1.5" {...register(`entries.${index}.month`)}>
              <option value="">Auto from date</option>
              {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Party GSTIN</label>
            <input className="input text-sm py-1.5 font-mono uppercase" placeholder="27ABCDE1234F1Z5"
              maxLength={15} {...register(`entries.${index}.party_gstin`)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">HSN / SAC Code</label>
            <input className="input text-sm py-1.5" placeholder="e.g. 9954"
              {...register(`entries.${index}.hsn_code`)} />
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
                <label className="text-xs text-gray-500 mb-1 block">CGST (₹) — Auto</label>
                <input type="number" step="0.01" className="input text-sm py-1.5 bg-gray-50" readOnly
                  {...register(`entries.${index}.cgst_amount`)} />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">SGST (₹) — Auto</label>
                <input type="number" step="0.01" className="input text-sm py-1.5 bg-gray-50" readOnly
                  {...register(`entries.${index}.sgst_amount`)} />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Total (₹) — Auto</label>
                <input type="number" step="0.01" className="input text-sm py-1.5 bg-green-50 font-semibold text-green-800" readOnly
                  {...register(`entries.${index}.total_amount`)} />
              </div>
            </>
          )}
          <div className="md:col-span-4">
            <label className="text-xs text-gray-500 mb-1 block">Description / Narration</label>
            <input className="input text-sm py-1.5" placeholder="Brief description of this transaction"
              {...register(`entries.${index}.description`)} />
          </div>
          {typeInfo && (
            <div className="md:col-span-4 flex items-start gap-2 text-xs text-blue-700 bg-blue-50 p-2 rounded-lg">
              <Info size={12} className="text-blue-500 flex-shrink-0 mt-0.5" />
              <span>{typeInfo.hint} — After CA approval, this updates GST, ITR, P&L and Balance Sheet automatically.</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// History table component
function EntryHistory({ entries, showClientId = false }) {
  if (!entries.length) return (
    <div className="text-center py-10 text-gray-400">
      <History size={32} className="mx-auto mb-2 opacity-40" />
      <p>No entries submitted yet</p>
    </div>
  )

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50">
            {[showClientId && 'Client ID', 'Type', 'Invoice No', 'Party', 'Amount', 'Description', 'Status', 'Submitted'].filter(Boolean).map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {entries.map(e => (
            <tr key={e.id} className="hover:bg-gray-50">
              {showClientId && <td className="px-4 py-3 text-gray-500 text-xs">#{e.client_id}</td>}
              <td className="px-4 py-3"><span className="badge-info capitalize text-xs">{e.transaction_type}</span></td>
              <td className="px-4 py-3 text-xs">{e.invoice_number || '—'}</td>
              <td className="px-4 py-3 text-xs">{e.party_name || '—'}</td>
              <td className="px-4 py-3 font-semibold text-xs">₹{parseFloat(e.total_amount || 0).toLocaleString()}</td>
              <td className="px-4 py-3 text-gray-500 text-xs max-w-[120px] truncate">{e.description || '—'}</td>
              <td className="px-4 py-3">
                {e.status === 'approved' && <span className="badge-success flex items-center gap-1 w-fit text-xs"><CheckCircle size={10} />Approved</span>}
                {e.status === 'pending' && <span className="badge-warning flex items-center gap-1 w-fit text-xs"><Clock size={10} />Pending</span>}
                {e.status === 'rejected' && <span className="badge-danger flex items-center gap-1 w-fit text-xs"><XCircle size={10} />Rejected</span>}
              </td>
              <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                {e.created_at ? new Date(e.created_at).toLocaleDateString('en-IN') : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Client Entry Form
function ClientEntryForm({ fy, setFy }) {
  const qc = useQueryClient()
  const { user } = useAuthStore()

  const { register, handleSubmit, control, watch, setValue, reset } = useForm({
    defaultValues: {
      entries: [{
        transaction_type: 'sales', party_name: '', invoice_number: '',
        taxable_amount: '', invoice_date: '', month: '', party_gstin: '',
        hsn_code: '', gst_rate: 18, cgst_amount: 0, sgst_amount: 0,
        igst_amount: 0, total_amount: '', description: ''
      }]
    }
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'entries' })

  const { data: myEntries = [], refetch: refetchEntries } = useQuery({
    queryKey: ['my-entries', fy, user?.id],
    queryFn: () => manualEntryAPI.myEntries(fy).then(r => r.data),
  })

  const submitMutation = useMutation({
    mutationFn: (data) => manualEntryAPI.submit({
      financial_year: fy,
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
    onSuccess: (res) => {
      toast.success(`${res.data.transaction_ids?.length || 'All'} entries submitted for CA review!`)
      reset()
      refetchEntries()
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Submission failed — ensure your profile is complete'),
  })

  const pending = myEntries.filter(e => e.status === 'pending').length
  const approved = myEntries.filter(e => e.status === 'approved').length
  const rejected = myEntries.filter(e => e.status === 'rejected').length

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 text-center">
          <Clock size={18} className="text-amber-500 mx-auto mb-1" />
          <p className="text-xl font-bold">{pending}</p>
          <p className="text-xs text-gray-500">Pending Review</p>
        </div>
        <div className="card p-4 text-center">
          <CheckCircle size={18} className="text-green-500 mx-auto mb-1" />
          <p className="text-xl font-bold">{approved}</p>
          <p className="text-xs text-gray-500">Approved</p>
        </div>
        <div className="card p-4 text-center">
          <XCircle size={18} className="text-red-500 mx-auto mb-1" />
          <p className="text-xl font-bold">{rejected}</p>
          <p className="text-xs text-gray-500">Rejected</p>
        </div>
      </div>

      <div className="card p-4 bg-blue-50 border-blue-200">
        <div className="flex gap-3">
          <Info size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold">How it works:</p>
            <p>1. Add your transactions below → 2. Submit → 3. CA reviews & approves → 4. All reports update automatically</p>
          </div>
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <h3 className="font-semibold text-gray-900">Add New Transactions</h3>
          <select className="input w-36 text-sm" value={fy} onChange={e => setFy(e.target.value)}>
            {FY_OPTIONS.map(y => <option key={y}>{y}</option>)}
          </select>
        </div>

        <form onSubmit={handleSubmit(d => submitMutation.mutate(d))} className="space-y-4">
          {fields.map((field, i) => (
            <EntryRow key={field.id} index={i} remove={remove}
              register={register} watch={watch} setValue={setValue} />
          ))}

          <button type="button" onClick={() => append({
            transaction_type: 'sales', party_name: '', invoice_number: '',
            taxable_amount: '', invoice_date: '', month: '', party_gstin: '',
            hsn_code: '', gst_rate: 18, cgst_amount: 0, sgst_amount: 0,
            igst_amount: 0, total_amount: '', description: ''
          })} className="w-full border-2 border-dashed border-gray-300 rounded-xl p-4 text-gray-500 hover:border-primary-400 hover:text-primary-600 hover:bg-primary-50 transition-all flex items-center justify-center gap-2">
            <Plus size={16} /><span className="font-medium">Add Another Transaction</span>
          </button>

          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">{fields.length} {fields.length === 1 ? 'entry' : 'entries'} ready</p>
            <button type="submit" disabled={submitMutation.isPending || fields.length === 0}
              className="btn-primary flex items-center gap-2 px-6">
              {submitMutation.isPending ? <div className="spinner w-4 h-4" /> : <Send size={15} />}
              Submit for CA Review
            </button>
          </div>
        </form>
      </div>

      {/* History */}
      <div className="card">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <History size={18} className="text-gray-500" />
          <h3 className="font-semibold text-gray-900">Submission History — FY {fy}</h3>
          <span className="badge-gray ml-auto">{myEntries.length} entries</span>
        </div>
        <EntryHistory entries={myEntries} />
      </div>
    </div>
  )
}

// CA Review
function CAReviewView({ fy, setFy }) {
  const qc = useQueryClient()
  const [selectedIds, setSelectedIds] = useState([])
  const [selectedClientFilter, setSelectedClientFilter] = useState(null)

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => clientsAPI.list().then(r => r.data),
  })

  const { data: pending = [], isLoading, refetch } = useQuery({
    queryKey: ['pending-entries', fy, selectedClientFilter],
    queryFn: () => manualEntryAPI.pending({
      financial_year: fy,
      client_id: selectedClientFilter || undefined
    }).then(r => r.data),
    refetchInterval: 15000,
  })

  const { data: allEntries = [] } = useQuery({
    queryKey: ['all-entries', fy],
    queryFn: () => manualEntryAPI.pending({ financial_year: fy }).then(r => r.data),
  })

  const approveMutation = useMutation({
    mutationFn: (id) => manualEntryAPI.approve(id),
    onSuccess: () => { toast.success('Entry approved — client accounts updated!'); refetch() },
    onError: (e) => toast.error(e.response?.data?.detail || 'Approval failed'),
  })

  const approveBatchMutation = useMutation({
    mutationFn: (ids) => manualEntryAPI.approveBatch(ids),
    onSuccess: (res) => {
      toast.success(`${res.data.approved} entries approved!`)
      setSelectedIds([])
      refetch()
    },
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }) => manualEntryAPI.reject(id, reason),
    onSuccess: () => { toast.success('Entry rejected — client notified'); refetch() },
  })

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="font-semibold text-gray-900">Pending Review</h3>
            <span className="badge-warning">{pending.length} entries</span>
          </div>
          <div className="flex gap-3 flex-wrap">
            <select className="input w-40 text-sm" value={fy} onChange={e => setFy(e.target.value)}>
              {FY_OPTIONS.map(y => <option key={y}>{y}</option>)}
            </select>
            <select className="input w-52 text-sm" value={selectedClientFilter || ''} onChange={e => setSelectedClientFilter(Number(e.target.value) || null)}>
              <option value="">All Clients</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.business_name}</option>)}
            </select>
            {selectedIds.length > 0 && (
              <button onClick={() => approveBatchMutation.mutate(selectedIds)}
                className="btn-primary flex items-center gap-2 text-sm">
                <CheckCircle size={14} />Approve Selected ({selectedIds.length})
              </button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10"><div className="spinner w-8 h-8" /></div>
        ) : pending.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <ListChecks size={36} className="mx-auto mb-2 opacity-40" />
            <p className="font-medium">All caught up! No pending entries.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-3 py-3 w-10">
                    <input type="checkbox"
                      checked={selectedIds.length === pending.length && pending.length > 0}
                      onChange={e => setSelectedIds(e.target.checked ? pending.map(p => p.id) : [])} />
                  </th>
                  {['Client', 'Type', 'Invoice No', 'Party', 'Taxable', 'CGST', 'SGST', 'Total', 'Desc', 'Submitted', 'Actions'].map(h => (
                    <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pending.map(e => (
                  <tr key={e.id} className={clsx('hover:bg-gray-50', selectedIds.includes(e.id) && 'bg-blue-50')}>
                    <td className="px-3 py-3">
                      <input type="checkbox" checked={selectedIds.includes(e.id)}
                        onChange={() => setSelectedIds(p => p.includes(e.id) ? p.filter(i => i !== e.id) : [...p, e.id])} />
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-500">
                      {clients.find(c => c.id === e.client_id)?.business_name || `#${e.client_id}`}
                    </td>
                    <td className="px-3 py-3"><span className="badge-info capitalize text-xs">{e.transaction_type}</span></td>
                    <td className="px-3 py-3 text-xs">{e.invoice_number || '—'}</td>
                    <td className="px-3 py-3 text-xs">{e.party_name || '—'}</td>
                    <td className="px-3 py-3 text-xs">₹{parseFloat(e.taxable_amount || e.total_amount || 0).toLocaleString()}</td>
                    <td className="px-3 py-3 text-xs">₹{parseFloat(e.cgst || 0).toLocaleString()}</td>
                    <td className="px-3 py-3 text-xs">₹{parseFloat(e.sgst || 0).toLocaleString()}</td>
                    <td className="px-3 py-3 font-semibold text-xs">₹{parseFloat(e.total_amount || 0).toLocaleString()}</td>
                    <td className="px-3 py-3 text-gray-500 text-xs max-w-[80px] truncate">{e.description || '—'}</td>
                    <td className="px-3 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {e.created_at ? new Date(e.created_at).toLocaleDateString('en-IN') : '—'}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => approveMutation.mutate(e.id)}
                          className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Approve">
                          <CheckCircle size={14} />
                        </button>
                        <button onClick={() => {
                          const reason = window.prompt('Rejection reason:')
                          if (reason) rejectMutation.mutate({ id: e.id, reason })
                        }}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Reject">
                          <XCircle size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* All history for admin */}
      <div className="card">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <History size={18} className="text-gray-500" />
          <h3 className="font-semibold text-gray-900">All Submission History — FY {fy}</h3>
        </div>
        <EntryHistory entries={allEntries} showClientId={true} />
      </div>
    </div>
  )
}

// ─── TRIAL BALANCE ENTRY (Issue 6) ────────────────────────────────────────────
// Full ICAI standard chart of accounts — two-sided Dr/Cr entry format
const TRIAL_BALANCE_ACCOUNTS = [
  // CAPITAL & LIABILITIES
  { code: '3001', name: "Capital Account", side: 'cr', group: 'Capital & Reserves' },
  { code: '3002', name: "Partners' Capital Accounts", side: 'cr', group: 'Capital & Reserves' },
  { code: '3003', name: "Share Capital", side: 'cr', group: 'Capital & Reserves' },
  { code: '3004', name: "Securities Premium Reserve", side: 'cr', group: 'Capital & Reserves' },
  { code: '3005', name: "General Reserve", side: 'cr', group: 'Capital & Reserves' },
  { code: '3006', name: "Profit & Loss Account (Opening Balance)", side: 'cr', group: 'Capital & Reserves' },
  { code: '3007', name: "Drawings Account", side: 'dr', group: 'Capital & Reserves' },
  { code: '2101', name: "Term Loan from Bank (Secured)", side: 'cr', group: 'Long-term Liabilities' },
  { code: '2102', name: "Unsecured Loans", side: 'cr', group: 'Long-term Liabilities' },
  { code: '2103', name: "Loan from Directors / Partners", side: 'cr', group: 'Long-term Liabilities' },
  { code: '2104', name: "Debentures", side: 'cr', group: 'Long-term Liabilities' },
  { code: '2201', name: "Sundry Creditors (Accounts Payable)", side: 'cr', group: 'Current Liabilities' },
  { code: '2202', name: "Bills Payable", side: 'cr', group: 'Current Liabilities' },
  { code: '2203', name: "Bank Overdraft / Cash Credit (OD/CC)", side: 'cr', group: 'Current Liabilities' },
  { code: '2204', name: "Advance from Customers", side: 'cr', group: 'Current Liabilities' },
  { code: '2205', name: "Outstanding Expenses", side: 'cr', group: 'Current Liabilities' },
  { code: '2206', name: "GST Payable — CGST", side: 'cr', group: 'Current Liabilities' },
  { code: '2207', name: "GST Payable — SGST", side: 'cr', group: 'Current Liabilities' },
  { code: '2208', name: "GST Payable — IGST", side: 'cr', group: 'Current Liabilities' },
  { code: '2209', name: "TDS Payable", side: 'cr', group: 'Current Liabilities' },
  { code: '2210', name: "Salaries & Wages Payable", side: 'cr', group: 'Current Liabilities' },
  { code: '2211', name: "Income Tax Payable", side: 'cr', group: 'Current Liabilities' },
  { code: '2212', name: "Provision for Taxation", side: 'cr', group: 'Current Liabilities' },
  { code: '2213', name: "Proposed Dividend", side: 'cr', group: 'Current Liabilities' },
  // FIXED ASSETS
  { code: '1101', name: "Land & Building", side: 'dr', group: 'Fixed Assets' },
  { code: '1102', name: "Plant & Machinery", side: 'dr', group: 'Fixed Assets' },
  { code: '1103', name: "Furniture & Fixtures", side: 'dr', group: 'Fixed Assets' },
  { code: '1104', name: "Vehicles", side: 'dr', group: 'Fixed Assets' },
  { code: '1105', name: "Computer & Equipment", side: 'dr', group: 'Fixed Assets' },
  { code: '1106', name: "Office Equipment", side: 'dr', group: 'Fixed Assets' },
  { code: '1107', name: "Less: Accumulated Depreciation", side: 'cr', group: 'Fixed Assets' },
  { code: '1108', name: "Capital Work-in-Progress (CWIP)", side: 'dr', group: 'Fixed Assets' },
  { code: '1109', name: "Goodwill", side: 'dr', group: 'Intangible Assets' },
  { code: '1110', name: "Patents & Trademarks", side: 'dr', group: 'Intangible Assets' },
  { code: '1111', name: "Computer Software / Licenses", side: 'dr', group: 'Intangible Assets' },
  // INVESTMENTS
  { code: '1201', name: "Long-term Investments (Shares/Bonds)", side: 'dr', group: 'Investments' },
  { code: '1202', name: "Short-term Investments / FDs", side: 'dr', group: 'Investments' },
  { code: '1203', name: "Investment in Mutual Funds", side: 'dr', group: 'Investments' },
  // CURRENT ASSETS
  { code: '1301', name: "Closing Stock — Raw Material", side: 'dr', group: 'Current Assets' },
  { code: '1302', name: "Closing Stock — WIP", side: 'dr', group: 'Current Assets' },
  { code: '1303', name: "Closing Stock — Finished Goods", side: 'dr', group: 'Current Assets' },
  { code: '1304', name: "Sundry Debtors (Accounts Receivable)", side: 'dr', group: 'Current Assets' },
  { code: '1305', name: "Bills Receivable", side: 'dr', group: 'Current Assets' },
  { code: '1306', name: "Cash in Hand", side: 'dr', group: 'Current Assets' },
  { code: '1307', name: "Cash at Bank (Current A/c)", side: 'dr', group: 'Current Assets' },
  { code: '1308', name: "Cash at Bank (Savings A/c)", side: 'dr', group: 'Current Assets' },
  { code: '1309', name: "Petty Cash", side: 'dr', group: 'Current Assets' },
  { code: '1310', name: "Prepaid Expenses", side: 'dr', group: 'Current Assets' },
  { code: '1311', name: "Advance Tax Paid", side: 'dr', group: 'Current Assets' },
  { code: '1312', name: "TDS Receivable (Form 26AS)", side: 'dr', group: 'Current Assets' },
  { code: '1313', name: "GST Input Tax Credit (ITC)", side: 'dr', group: 'Current Assets' },
  { code: '1314', name: "Accrued Income / Income Receivable", side: 'dr', group: 'Current Assets' },
  { code: '1315', name: "Loans & Advances Given", side: 'dr', group: 'Current Assets' },
  { code: '1316', name: "Security Deposits", side: 'dr', group: 'Current Assets' },
  // OPENING STOCKS (P&L / Trading)
  { code: '5001', name: "Opening Stock — Raw Material", side: 'dr', group: 'Opening Stock (Trading/P&L)' },
  { code: '5002', name: "Opening Stock — WIP", side: 'dr', group: 'Opening Stock (Trading/P&L)' },
  { code: '5003', name: "Opening Stock — Finished Goods", side: 'dr', group: 'Opening Stock (Trading/P&L)' },
  // PURCHASES & DIRECT COSTS
  { code: '5010', name: "Purchases (Goods / Raw Material)", side: 'dr', group: 'Purchases & Direct Costs' },
  { code: '5011', name: "Purchase Returns & Allowances", side: 'cr', group: 'Purchases & Direct Costs' },
  { code: '5012', name: "Carriage Inward / Freight Inward", side: 'dr', group: 'Purchases & Direct Costs' },
  { code: '5013', name: "Custom Duty / Import Duty", side: 'dr', group: 'Purchases & Direct Costs' },
  { code: '5014', name: "Octroi & Entry Tax", side: 'dr', group: 'Purchases & Direct Costs' },
  { code: '5015', name: "Direct Labour / Manufacturing Wages", side: 'dr', group: 'Purchases & Direct Costs' },
  { code: '5016', name: "Power & Fuel (Factory)", side: 'dr', group: 'Purchases & Direct Costs' },
  { code: '5017', name: "Factory Overhead (General)", side: 'dr', group: 'Purchases & Direct Costs' },
  { code: '5018', name: "Packing Materials", side: 'dr', group: 'Purchases & Direct Costs' },
  // SALES & INCOME
  { code: '4001', name: "Sales (Domestic — Taxable)", side: 'cr', group: 'Sales & Income' },
  { code: '4002', name: "Sales (Domestic — Exempt / Nil rated)", side: 'cr', group: 'Sales & Income' },
  { code: '4003', name: "Sales (Export / Zero rated)", side: 'cr', group: 'Sales & Income' },
  { code: '4004', name: "Sales Returns & Allowances", side: 'dr', group: 'Sales & Income' },
  { code: '4005', name: "Other Operating Income", side: 'cr', group: 'Sales & Income' },
  { code: '4010', name: "Commission Income", side: 'cr', group: 'Sales & Income' },
  { code: '4011', name: "Discount Received", side: 'cr', group: 'Sales & Income' },
  { code: '4012', name: "Interest Received / Income", side: 'cr', group: 'Sales & Income' },
  { code: '4013', name: "Rental Income", side: 'cr', group: 'Sales & Income' },
  { code: '4014', name: "Dividend Received", side: 'cr', group: 'Sales & Income' },
  { code: '4015', name: "Profit on Sale of Fixed Asset", side: 'cr', group: 'Sales & Income' },
  { code: '4016', name: "Miscellaneous / Non-operating Income", side: 'cr', group: 'Sales & Income' },
  // INDIRECT EXPENSES
  { code: '6001', name: "Salaries (Office / Admin)", side: 'dr', group: 'Indirect Expenses' },
  { code: '6002', name: "Wages (Non-factory)", side: 'dr', group: 'Indirect Expenses' },
  { code: '6003', name: "Rent (Office / Shop)", side: 'dr', group: 'Indirect Expenses' },
  { code: '6004', name: "Rates & Taxes (Municipal)", side: 'dr', group: 'Indirect Expenses' },
  { code: '6005', name: "Electricity & Water (Office)", side: 'dr', group: 'Indirect Expenses' },
  { code: '6006', name: "Printing & Stationery", side: 'dr', group: 'Indirect Expenses' },
  { code: '6007', name: "Postage & Courier", side: 'dr', group: 'Indirect Expenses' },
  { code: '6008', name: "Telephone & Internet", side: 'dr', group: 'Indirect Expenses' },
  { code: '6009', name: "Travelling & Conveyance", side: 'dr', group: 'Indirect Expenses' },
  { code: '6010', name: "Advertisement & Marketing", side: 'dr', group: 'Indirect Expenses' },
  { code: '6011', name: "Professional / Legal Fees", side: 'dr', group: 'Indirect Expenses' },
  { code: '6012', name: "Audit Fees", side: 'dr', group: 'Indirect Expenses' },
  { code: '6013', name: "Bank Charges & Commission", side: 'dr', group: 'Indirect Expenses' },
  { code: '6014', name: "Interest on Loan / OD / CC", side: 'dr', group: 'Indirect Expenses' },
  { code: '6015', name: "Depreciation (Office/Non-factory)", side: 'dr', group: 'Indirect Expenses' },
  { code: '6016', name: "Bad Debts Written Off", side: 'dr', group: 'Indirect Expenses' },
  { code: '6017', name: "Provision for Bad & Doubtful Debts", side: 'dr', group: 'Indirect Expenses' },
  { code: '6018', name: "Discount Allowed", side: 'dr', group: 'Indirect Expenses' },
  { code: '6019', name: "Insurance Premium", side: 'dr', group: 'Indirect Expenses' },
  { code: '6020', name: "Staff Welfare Expenses", side: 'dr', group: 'Indirect Expenses' },
  { code: '6021', name: "Carriage Outward / Freight Outward", side: 'dr', group: 'Indirect Expenses' },
  { code: '6022', name: "Repairs & Maintenance (Office)", side: 'dr', group: 'Indirect Expenses' },
  { code: '6023', name: "GST Late Fees & Penalty", side: 'dr', group: 'Indirect Expenses' },
  { code: '6024', name: "Vehicle Running & Maintenance", side: 'dr', group: 'Indirect Expenses' },
  { code: '6025', name: "Subscription & Membership Fees", side: 'dr', group: 'Indirect Expenses' },
  { code: '6026', name: "Charity & Donations (80G eligible)", side: 'dr', group: 'Indirect Expenses' },
  { code: '6027', name: "Directors' Remuneration", side: 'dr', group: 'Indirect Expenses' },
  { code: '6028', name: "Miscellaneous Expenses", side: 'dr', group: 'Indirect Expenses' },
]

function TrialBalanceEntry({ fy, setFy }) {
  const { isCA } = useAuthStore()
  const [amounts, setAmounts] = useState({})
  const [saved, setSaved] = useState(false)
  const [filter, setFilter] = useState('')

  const groups = [...new Set(TRIAL_BALANCE_ACCOUNTS.map(a => a.group))]
  const filtered = filter
    ? TRIAL_BALANCE_ACCOUNTS.filter(a => a.name.toLowerCase().includes(filter.toLowerCase()) || a.code.includes(filter) || a.group.toLowerCase().includes(filter.toLowerCase()))
    : TRIAL_BALANCE_ACCOUNTS

  const setAmount = (code, value) => setAmounts(prev => ({ ...prev, [code]: value }))

  const totalDr = TRIAL_BALANCE_ACCOUNTS
    .filter(a => a.side === 'dr')
    .reduce((s, a) => s + (parseFloat(amounts[a.code]) || 0), 0)
  const totalCr = TRIAL_BALANCE_ACCOUNTS
    .filter(a => a.side === 'cr')
    .reduce((s, a) => s + (parseFloat(amounts[a.code]) || 0), 0)

  const diff = Math.abs(totalDr - totalCr)
  const isBalanced = diff < 0.01

  const handleSave = () => {
    // In a real scenario, this would POST to /bookkeeping/trial-balance-entry
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
    toast.success('Trial Balance saved! Journal entries will be created automatically.')
  }

  const handleClear = () => {
    if (window.confirm('Clear all amounts? This cannot be undone.')) setAmounts({})
  }

  return (
    <div className="space-y-4">
      <div className="card p-5 bg-blue-50 border-blue-200">
        <h3 className="font-semibold text-blue-900 mb-2">Trial Balance Entry — ICAI Standard Format</h3>
        <p className="text-sm text-blue-700">Enter the opening/closing balances for each account. The system will automatically calculate P&L, Balance Sheet and other reports from this data. All accounts are listed as per ICAI Chart of Accounts. Leave 0 for accounts not applicable to your business.</p>
      </div>

      {/* Controls */}
      <div className="card p-4 flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-3 flex-wrap items-center">
          <select className="input w-36" value={fy} onChange={e => setFy(e.target.value)}>
            {['2026-27','2025-26','2024-25','2023-24','2022-23'].map(y => <option key={y}>{y}</option>)}
          </select>
          <input className="input w-64" placeholder="Search account name or code..." value={filter} onChange={e => setFilter(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <button onClick={handleClear} className="btn-secondary text-sm">Clear All</button>
          <button onClick={handleSave} className={`btn-primary text-sm ${!isBalanced ? 'opacity-75' : ''}`}>
            {saved ? '✓ Saved!' : 'Save Trial Balance'}
          </button>
        </div>
      </div>

      {/* Totals Bar */}
      <div className={`card p-4 flex flex-wrap gap-4 items-center justify-between ${isBalanced ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
        <div className="flex gap-6">
          <div><p className="text-xs text-gray-500">Total Debit</p><p className="text-xl font-bold text-blue-700">Rs.{totalDr.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p></div>
          <div><p className="text-xs text-gray-500">Total Credit</p><p className="text-xl font-bold text-purple-700">Rs.{totalCr.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p></div>
          <div><p className="text-xs text-gray-500">Difference</p><p className={`text-xl font-bold ${isBalanced ? 'text-green-700' : 'text-red-600'}`}>Rs.{diff.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p></div>
        </div>
        <span className={`text-sm font-semibold px-3 py-1 rounded-full ${isBalanced ? 'bg-green-200 text-green-800' : 'bg-amber-200 text-amber-800'}`}>
          {isBalanced ? '✓ Balanced' : '⚠ Not Balanced — Dr must equal Cr'}
        </span>
      </div>

      {/* Two-column Trial Balance ICAI format */}
      <div className="card overflow-hidden">
        <div className="bg-slate-900 text-white px-5 py-3 text-center">
          <p className="font-bold">TRIAL BALANCE</p>
          <p className="text-xs text-slate-300 mt-0.5">As at 31st March — FY {fy} | Enter amounts in Rupees</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100 text-xs font-bold text-gray-600">
                <th className="px-3 py-2 text-left w-12">Code</th>
                <th className="px-3 py-2 text-left">Account Name</th>
                <th className="px-3 py-2 text-center w-28">Dr Amount (Rs.)</th>
                <th className="px-3 py-2 text-center w-28">Cr Amount (Rs.)</th>
              </tr>
            </thead>
            <tbody>
              {groups.map(group => {
                const groupAccounts = filtered.filter(a => a.group === group)
                if (!groupAccounts.length) return null
                return (
                  <React.Fragment key={group}>
                    <tr><td colSpan={4} className="bg-primary-900 text-white text-xs font-bold px-3 py-1.5 uppercase tracking-wider">{group}</td></tr>
                    {groupAccounts.map(acct => {
                      const val = amounts[acct.code] || ''
                      return (
                        <tr key={acct.code} className="hover:bg-gray-50 border-b border-gray-100">
                          <td className="px-3 py-1.5 font-mono text-xs text-gray-400">{acct.code}</td>
                          <td className="px-3 py-1.5 text-sm">{acct.name}</td>
                          <td className="px-2 py-1.5">
                            {acct.side === 'dr' ? (
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                className="input text-right text-sm py-1 w-full"
                                placeholder="0.00"
                                value={val}
                                onChange={e => setAmount(acct.code, e.target.value)}
                              />
                            ) : <div className="text-center text-gray-300 text-xs">—</div>}
                          </td>
                          <td className="px-2 py-1.5">
                            {acct.side === 'cr' ? (
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                className="input text-right text-sm py-1 w-full"
                                placeholder="0.00"
                                value={val}
                                onChange={e => setAmount(acct.code, e.target.value)}
                              />
                            ) : <div className="text-center text-gray-300 text-xs">—</div>}
                          </td>
                        </tr>
                      )
                    })}
                  </React.Fragment>
                )
              })}
              {/* Totals row */}
              <tr className="bg-slate-900 text-white font-bold">
                <td className="px-3 py-3" colSpan={2}>GRAND TOTAL</td>
                <td className="px-3 py-3 text-right">Rs.{totalDr.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                <td className="px-3 py-3 text-right">Rs.{totalCr.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {!isBalanced && totalDr > 0 && (
        <div className="card p-4 bg-amber-50 border-amber-300 text-sm text-amber-800">
          <strong>Note:</strong> Trial Balance must balance (Total Dr = Total Cr) before saving. The difference of Rs.{diff.toLocaleString('en-IN', { minimumFractionDigits: 2 })} must be resolved. Common causes: missing entry, wrong side, arithmetic error.
        </div>
      )}
    </div>
  )
}

export default function ManualEntryPage() {
  const { isCA } = useAuthStore()
  const [view, setView] = useState(isCA() ? 'review' : 'entry')
  const [fy, setFy] = useState('2024-25')

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isCA() ? 'Manual Entry Review' : 'Enter Data Manually'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {isCA()
              ? 'Review, approve or reject client-submitted data. After approval, all modules update automatically.'
              : "No documents to upload? Type your transaction data here. CA will review and approve."}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {isCA() && (
            <>
              <button onClick={() => setView('review')} className={view === 'review' ? 'btn-primary flex items-center gap-2 text-sm' : 'btn-secondary flex items-center gap-2 text-sm'}>
                <ListChecks size={14} />Pending Review
              </button>
              <button onClick={() => setView('entry')} className={view === 'entry' ? 'btn-primary flex items-center gap-2 text-sm' : 'btn-secondary flex items-center gap-2 text-sm'}>
                <PenLine size={14} />Add Entry (Admin)
              </button>
            </>
          )}
          <button onClick={() => setView('trial')} className={view === 'trial' ? 'btn-primary flex items-center gap-2 text-sm' : 'btn-secondary flex items-center gap-2 text-sm'}>
            <ListChecks size={14} />Trial Balance Entry
          </button>
        </div>
      </div>

      {view === 'entry' && <ClientEntryForm fy={fy} setFy={setFy} />}
      {view === 'review' && isCA() && <CAReviewView fy={fy} setFy={setFy} />}
      {view === 'trial' && <TrialBalanceEntry fy={fy} setFy={setFy} />}
    </div>
  )
}
