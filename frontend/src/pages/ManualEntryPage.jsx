import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, useFieldArray } from 'react-hook-form'
import toast from 'react-hot-toast'
import { manualEntryAPI, authAPI, bookkeepingAPI } from '../services/api'
import useAuthStore from '../store/authStore'
import ClientSelector from '../components/shared/ClientSelector'
import { Plus, Trash2, Send, CheckCircle, Clock, XCircle, History, ListChecks, PenLine, ChevronDown, ChevronUp, Info, Scale, BookOpen } from 'lucide-react'

const FY_OPTIONS = ['2026-27','2025-26','2024-25','2023-24','2022-23']
const ENTRY_TYPES = [
  { value: 'sales', label: 'Sales Invoice' },
  { value: 'purchase', label: 'Purchase Invoice' },
  { value: 'expense', label: 'Business Expense' },
  { value: 'salary_slip', label: 'Salary/Payroll' },
  { value: 'bank', label: 'Bank Entry' },
  { value: 'asset_invoice', label: 'Asset Purchase' },
]
const GST_RATES = [{value:0,label:'Nil (0%)'},{value:5,label:'5%'},{value:12,label:'12%'},{value:18,label:'18%'},{value:28,label:'28%'}]
const MONTHS = [{v:4,l:'April'},{v:5,l:'May'},{v:6,l:'June'},{v:7,l:'July'},{v:8,l:'August'},{v:9,l:'September'},{v:10,l:'October'},{v:11,l:'November'},{v:12,l:'December'},{v:1,l:'January'},{v:2,l:'February'},{v:3,l:'March'}]

// ICAI Trial Balance accounts grouped
const TB_GROUPS = {
  'Current Assets': [
    {code:'1001',name:'Cash in Hand',normal:'Dr'},
    {code:'1002',name:'Cash at Bank (Current A/c)',normal:'Dr'},
    {code:'1003',name:'Cash at Bank (Savings A/c)',normal:'Dr'},
    {code:'1004',name:'Fixed Deposits (FD)',normal:'Dr'},
    {code:'1010',name:'Sundry Debtors (Accounts Receivable)',normal:'Dr'},
    {code:'1011',name:'Bills Receivable',normal:'Dr'},
    {code:'1020',name:'Opening Stock',normal:'Dr'},
    {code:'1021',name:'Closing Stock',normal:'Dr'},
    {code:'1030',name:'Prepaid Expenses',normal:'Dr'},
    {code:'1031',name:'Advance to Suppliers',normal:'Dr'},
    {code:'1033',name:'TDS Receivable / Tax Refund Due',normal:'Dr'},
    {code:'1034',name:'GST Input Tax Credit (ITC)',normal:'Dr'},
    {code:'1035',name:'Other Current Assets',normal:'Dr'},
  ],
  'Fixed Assets': [
    {code:'1100',name:'Land & Building',normal:'Dr'},
    {code:'1101',name:'Plant & Machinery',normal:'Dr'},
    {code:'1102',name:'Furniture & Fixtures',normal:'Dr'},
    {code:'1103',name:'Computers & IT Equipment',normal:'Dr'},
    {code:'1104',name:'Vehicles',normal:'Dr'},
    {code:'1105',name:'Office Equipment',normal:'Dr'},
    {code:'1106',name:'Less: Accumulated Depreciation',normal:'Cr'},
    {code:'1110',name:'Intangible Assets (Goodwill)',normal:'Dr'},
    {code:'1120',name:'Long-term Investments',normal:'Dr'},
    {code:'1121',name:'Short-term Investments / MF',normal:'Dr'},
  ],
  'Capital': [
    {code:'3001',name:"Capital Account / Proprietor's Capital",normal:'Cr'},
    {code:'3002',name:'Drawings Account',normal:'Dr'},
    {code:'3003',name:'Share Capital (if company)',normal:'Cr'},
    {code:'3004',name:'Reserves & Surplus',normal:'Cr'},
    {code:'3005',name:'Retained Earnings / P&L Surplus',normal:'Cr'},
  ],
  'Current Liabilities': [
    {code:'2001',name:'Sundry Creditors (Accounts Payable)',normal:'Cr'},
    {code:'2002',name:'Bills Payable',normal:'Cr'},
    {code:'2003',name:'Outstanding Expenses',normal:'Cr'},
    {code:'2004',name:'Advance from Customers',normal:'Cr'},
    {code:'2010',name:'GST Payable — CGST',normal:'Cr'},
    {code:'2011',name:'GST Payable — SGST',normal:'Cr'},
    {code:'2012',name:'GST Payable — IGST',normal:'Cr'},
    {code:'2013',name:'TDS Payable',normal:'Cr'},
    {code:'2014',name:'Salary Payable',normal:'Cr'},
    {code:'2015',name:'PF / ESIC Payable',normal:'Cr'},
    {code:'2016',name:'Income Tax Payable',normal:'Cr'},
  ],
  'Loans': [
    {code:'2100',name:'Bank Overdraft (OD)',normal:'Cr'},
    {code:'2101',name:'Bank Term Loan',normal:'Cr'},
    {code:'2102',name:'Mortgage / Hypothecation Loan',normal:'Cr'},
    {code:'2110',name:'Unsecured Loans from Partners/Directors',normal:'Cr'},
  ],
  'Sales Income': [
    {code:'4001',name:'Sales Revenue (Domestic)',normal:'Cr'},
    {code:'4002',name:'Sales Revenue (Export)',normal:'Cr'},
    {code:'4003',name:'Service Income / Fees',normal:'Cr'},
    {code:'4004',name:'Sales Returns (Deduct)',normal:'Dr'},
    {code:'4010',name:'Interest Income (Bank/FD)',normal:'Cr'},
    {code:'4011',name:'Commission Received',normal:'Cr'},
    {code:'4012',name:'Rent Received',normal:'Cr'},
    {code:'4013',name:'Dividend Income',normal:'Cr'},
    {code:'4014',name:'Discount Received',normal:'Cr'},
  ],
  'Direct Expenses (COGS)': [
    {code:'5001',name:'Opening Stock (Raw Material)',normal:'Dr'},
    {code:'5002',name:'Purchases (Net)',normal:'Dr'},
    {code:'5003',name:'Purchase Returns (Deduct)',normal:'Cr'},
    {code:'5004',name:'Direct Wages / Labour Charges',normal:'Dr'},
    {code:'5005',name:'Factory Overhead',normal:'Dr'},
    {code:'5006',name:'Power & Fuel (Factory)',normal:'Dr'},
    {code:'5007',name:'Freight Inward / Carriage on Purchases',normal:'Dr'},
    {code:'5008',name:'Custom Duty / Import Charges',normal:'Dr'},
    {code:'5010',name:'Closing Stock (Raw Material)',normal:'Cr'},
  ],
  'Indirect Expenses': [
    {code:'6001',name:'Salaries & Staff Welfare',normal:'Dr'},
    {code:'6002',name:'Office / Shop Rent',normal:'Dr'},
    {code:'6003',name:'Electricity & Water Charges',normal:'Dr'},
    {code:'6004',name:'Telephone & Internet Charges',normal:'Dr'},
    {code:'6005',name:'Advertising & Marketing Expenses',normal:'Dr'},
    {code:'6006',name:'Repairs & Maintenance',normal:'Dr'},
    {code:'6007',name:'Depreciation on Fixed Assets',normal:'Dr'},
    {code:'6008',name:'Insurance Premium',normal:'Dr'},
    {code:'6009',name:'Printing & Stationery',normal:'Dr'},
    {code:'6010',name:'Travelling & Conveyance',normal:'Dr'},
    {code:'6011',name:'Postage & Courier Charges',normal:'Dr'},
    {code:'6012',name:'Audit & Legal Fees',normal:'Dr'},
    {code:'6013',name:'Professional & Consultation Charges',normal:'Dr'},
    {code:'6014',name:'Bank Charges & Interest on Loans',normal:'Dr'},
    {code:'6015',name:'Bad Debts Written Off',normal:'Dr'},
    {code:'6016',name:'Discount Allowed',normal:'Dr'},
    {code:'6017',name:'Staff PF / ESIC Contribution',normal:'Dr'},
    {code:'6018',name:'Miscellaneous Expenses',normal:'Dr'},
    {code:'6019',name:'Freight Outward / Delivery Charges',normal:'Dr'},
    {code:'6020',name:'Business Promotion Expenses',normal:'Dr'},
    {code:'6030',name:'Income Tax / Advance Tax Paid',normal:'Dr'},
    {code:'6031',name:'TDS Deducted at Source',normal:'Dr'},
  ],
}

// ── Entry Row ──────────────────────────────────────────────────────────────────
function EntryRow({ index, remove, register, watch, setValue }) {
  const [expanded, setExpanded] = useState(true)
  const txnType = watch(`entries.${index}.transaction_type`)
  const taxableAmt = parseFloat(watch(`entries.${index}.taxable_amount`) || 0)
  const gstRate = parseFloat(watch(`entries.${index}.gst_rate`) || 0)
  const showGST = ['sales', 'purchase'].includes(txnType)
  React.useEffect(() => {
    if (taxableAmt > 0 && showGST && gstRate > 0) {
      const gstAmt = (taxableAmt * gstRate) / 100
      setValue(`entries.${index}.cgst_amount`, (gstAmt/2).toFixed(2))
      setValue(`entries.${index}.sgst_amount`, (gstAmt/2).toFixed(2))
      setValue(`entries.${index}.total_amount`, (taxableAmt+gstAmt).toFixed(2))
    } else if (taxableAmt > 0) {
      setValue(`entries.${index}.cgst_amount`, '0')
      setValue(`entries.${index}.sgst_amount`, '0')
      setValue(`entries.${index}.total_amount`, taxableAmt.toFixed(2))
    }
  }, [taxableAmt, gstRate, showGST])
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
      <div className="flex items-center gap-3 p-4 flex-wrap">
        <span className="w-6 h-6 bg-primary-600 text-white rounded-full text-xs flex items-center justify-center font-bold">{index+1}</span>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-1">
          <div><label className="text-xs text-gray-500 mb-1 block">Type *</label><select className="input text-sm py-1.5" {...register(`entries.${index}.transaction_type`,{required:true})}>{ENTRY_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
          <div><label className="text-xs text-gray-500 mb-1 block">Party Name</label><input className="input text-sm py-1.5" placeholder="Customer/Supplier" {...register(`entries.${index}.party_name`)}/></div>
          <div><label className="text-xs text-gray-500 mb-1 block">Invoice No</label><input className="input text-sm py-1.5" placeholder="INV-001" {...register(`entries.${index}.invoice_number`)}/></div>
          <div><label className="text-xs text-gray-500 mb-1 block">Amount (₹) *</label><input type="number" step="0.01" min="0" className="input text-sm py-1.5" placeholder="0.00" {...register(`entries.${index}.taxable_amount`,{required:true,min:0.01})}/></div>
        </div>
        <div className="flex gap-1">
          <button type="button" onClick={()=>setExpanded(!expanded)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded">{expanded?<ChevronUp size={15}/>:<ChevronDown size={15}/>}</button>
          <button type="button" onClick={()=>remove(index)} className="p-1.5 text-gray-400 hover:text-red-600 rounded"><Trash2 size={15}/></button>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-gray-200 bg-white p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div><label className="text-xs text-gray-500 mb-1 block">Invoice Date</label><input type="date" className="input text-sm py-1.5" {...register(`entries.${index}.invoice_date`)}/></div>
          <div><label className="text-xs text-gray-500 mb-1 block">Month</label><select className="input text-sm py-1.5" {...register(`entries.${index}.month`)}><option value="">Auto from date</option>{MONTHS.map(m=><option key={m.v} value={m.v}>{m.l}</option>)}</select></div>
          <div><label className="text-xs text-gray-500 mb-1 block">Party GSTIN</label><input className="input text-sm py-1.5 font-mono uppercase" placeholder="27ABCDE1234F1Z5" maxLength={15} {...register(`entries.${index}.party_gstin`)}/></div>
          <div><label className="text-xs text-gray-500 mb-1 block">HSN/SAC Code</label><input className="input text-sm py-1.5" placeholder="9954" {...register(`entries.${index}.hsn_code`)}/></div>
          {showGST&&<><div><label className="text-xs text-gray-500 mb-1 block">GST Rate</label><select className="input text-sm py-1.5" {...register(`entries.${index}.gst_rate`)}>{GST_RATES.map(r=><option key={r.value} value={r.value}>{r.label}</option>)}</select></div><div><label className="text-xs text-gray-500 mb-1 block">CGST (₹)</label><input type="number" step="0.01" className="input text-sm py-1.5 bg-gray-50" readOnly {...register(`entries.${index}.cgst_amount`)}/></div><div><label className="text-xs text-gray-500 mb-1 block">SGST (₹)</label><input type="number" step="0.01" className="input text-sm py-1.5 bg-gray-50" readOnly {...register(`entries.${index}.sgst_amount`)}/></div><div><label className="text-xs text-gray-500 mb-1 block">Total (₹)</label><input type="number" step="0.01" className="input text-sm py-1.5 bg-green-50 font-semibold text-green-800" readOnly {...register(`entries.${index}.total_amount`)}/></div></>}
          <div className="md:col-span-4"><label className="text-xs text-gray-500 mb-1 block">Description</label><input className="input text-sm py-1.5" placeholder="Brief description" {...register(`entries.${index}.description`)}/></div>
          <div className="md:col-span-4 bg-blue-50 rounded-lg p-2 flex items-start gap-2 text-xs text-blue-700"><Info size={12} className="flex-shrink-0 mt-0.5"/><span>After CA approval, this updates GST, ITR, P&L and Balance Sheet automatically per ICAI standards.</span></div>
        </div>
      )}
    </div>
  )
}

// ── Trial Balance ──────────────────────────────────────────────────────────────
function TrialBalanceForm({ fy, setFy, forClientId }) {
  const [values, setValues] = useState({})
  const [submitting, setSubmitting] = useState(false)

  const totalDr = Object.values(values).reduce((s, v) => s + parseFloat(v?.dr || 0), 0)
  const totalCr = Object.values(values).reduce((s, v) => s + parseFloat(v?.cr || 0), 0)
  const isBalanced = Math.abs(totalDr - totalCr) < 0.01
  const hasEntries = Object.values(values).some(v => parseFloat(v?.dr||0) > 0 || parseFloat(v?.cr||0) > 0)

  const setValue = (code, side, val) => {
    setValues(prev => ({ ...prev, [code]: { ...prev[code], [side]: val } }))
  }

  const handleSubmit = async () => {
    if (!hasEntries) { toast.error('Enter at least one value first'); return }
    if (!isBalanced) { toast.error(`Trial Balance not balanced! Dr: ₹${totalDr.toFixed(2)} vs Cr: ₹${totalCr.toFixed(2)}`); return }
    setSubmitting(true)
    try {
      const entries = []
      Object.entries(TB_GROUPS).forEach(([group, accounts]) => {
        accounts.forEach(acc => {
          const v = values[acc.code]
          const dr = parseFloat(v?.dr || 0)
          const cr = parseFloat(v?.cr || 0)
          if (dr > 0 || cr > 0) {
            entries.push({ account_code: acc.code, account_name: acc.name, debit_amount: dr, credit_amount: cr })
          }
        })
      })
      await bookkeepingAPI.submitTrialBalance({ financial_year: fy, client_id: forClientId || null, entries })
      toast.success('✅ Trial Balance submitted! All reports updated automatically.')
      setValues({})
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Submission failed')
    }
    setSubmitting(false)
  }

  return (
    <div className="space-y-6">
      <div className="card p-4 bg-blue-50 border-blue-200">
        <div className="flex items-start gap-3">
          <Info size={16} className="text-blue-600 flex-shrink-0 mt-0.5"/>
          <div className="text-sm text-blue-800">
            <p className="font-semibold">ICAI Standard Trial Balance</p>
            <p>Enter debit or credit amounts for each account. After submission, all features (GST, ITR, P&L, Balance Sheet) will update automatically. Trial balance MUST be balanced (Total Dr = Total Cr).</p>
          </div>
        </div>
      </div>

      {/* Sticky totals bar */}
      <div className="card p-4 flex items-center gap-6 flex-wrap sticky top-0 z-10 bg-white shadow-sm">
        <div className="flex-1">
          <p className="text-xs text-gray-500">Total Debit</p>
          <p className="text-xl font-bold text-blue-700">₹{totalDr.toLocaleString('en-IN', {minimumFractionDigits:2})}</p>
        </div>
        <div className="flex-1">
          <p className="text-xs text-gray-500">Total Credit</p>
          <p className="text-xl font-bold text-green-700">₹{totalCr.toLocaleString('en-IN', {minimumFractionDigits:2})}</p>
        </div>
        <div className="flex-1">
          <p className="text-xs text-gray-500">Difference</p>
          <p className={`text-xl font-bold ${isBalanced ? 'text-green-600' : 'text-red-600'}`}>
            {isBalanced ? '✓ Balanced' : `₹${Math.abs(totalDr-totalCr).toFixed(2)}`}
          </p>
        </div>
        <button onClick={handleSubmit} disabled={submitting || !hasEntries}
          className="btn-primary flex items-center gap-2 px-6">
          {submitting ? <div className="spinner w-4 h-4"/> : <Send size={15}/>}
          Submit & Update All Reports
        </button>
      </div>

      {/* Account groups */}
      {Object.entries(TB_GROUPS).map(([group, accounts]) => (
        <div key={group} className="card overflow-hidden">
          <div className="bg-gray-800 text-white px-4 py-2.5 flex items-center justify-between">
            <h3 className="font-semibold text-sm">{group}</h3>
            <span className="text-xs text-gray-400">{accounts.length} accounts</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 w-20">Code</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Account Name</th>
                <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500 w-16">Normal</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-blue-600 w-40">Debit (₹)</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-green-600 w-40">Credit (₹)</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {accounts.map(acc => {
                  const v = values[acc.code] || {}
                  const hasDr = parseFloat(v.dr || 0) > 0
                  const hasCr = parseFloat(v.cr || 0) > 0
                  return (
                    <tr key={acc.code} className={`hover:bg-gray-50 ${hasDr||hasCr?'bg-blue-50':''}`}>
                      <td className="px-4 py-2 text-xs text-gray-400 font-mono">{acc.code}</td>
                      <td className="px-4 py-2 text-gray-800 font-medium text-xs">{acc.name}</td>
                      <td className="px-4 py-2 text-center">
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${acc.normal==='Dr'?'bg-blue-100 text-blue-700':'bg-green-100 text-green-700'}`}>{acc.normal}</span>
                      </td>
                      <td className="px-4 py-2">
                        <input type="number" step="0.01" min="0" placeholder="0.00"
                          value={v.dr || ''}
                          onChange={e => setValue(acc.code, 'dr', e.target.value)}
                          className="input text-right text-xs py-1 w-full focus:bg-blue-50"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input type="number" step="0.01" min="0" placeholder="0.00"
                          value={v.cr || ''}
                          onChange={e => setValue(acc.code, 'cr', e.target.value)}
                          className="input text-right text-xs py-1 w-full focus:bg-green-50"
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── History Table ──────────────────────────────────────────────────────────────
function HistoryTable({ entries, showClient = false }) {
  if (!entries.length) return <div className="text-center py-10 text-gray-400"><History size={32} className="mx-auto mb-2 opacity-40"/><p>No entries yet</p></div>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="bg-gray-50">{[showClient&&'Client','Type','Invoice','Party','Amount','Status','Date'].filter(Boolean).map(h=><th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-gray-100">
          {entries.map(e=>(
            <tr key={e.id} className="hover:bg-gray-50">
              {showClient&&<td className="px-4 py-3 text-xs text-gray-500">#{e.client_id}</td>}
              <td className="px-4 py-3"><span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full capitalize">{e.transaction_type}</span></td>
              <td className="px-4 py-3 text-xs">{e.invoice_number||'—'}</td>
              <td className="px-4 py-3 text-xs">{e.party_name||'—'}</td>
              <td className="px-4 py-3 font-semibold text-xs">₹{parseFloat(e.total_amount||0).toLocaleString()}</td>
              <td className="px-4 py-3">
                {e.status==='approved'&&<span className="bg-green-100 text-green-700 flex items-center gap-1 w-fit text-xs px-2 py-0.5 rounded-full"><CheckCircle size={10}/>Approved</span>}
                {e.status==='pending'&&<span className="bg-amber-100 text-amber-700 flex items-center gap-1 w-fit text-xs px-2 py-0.5 rounded-full"><Clock size={10}/>Pending</span>}
                {e.status==='rejected'&&<span className="bg-red-100 text-red-700 flex items-center gap-1 w-fit text-xs px-2 py-0.5 rounded-full"><XCircle size={10}/>Rejected</span>}
              </td>
              <td className="px-4 py-3 text-xs text-gray-500">{e.created_at?new Date(e.created_at).toLocaleDateString('en-IN'):'—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Entry Form ─────────────────────────────────────────────────────────────────
function EntryForm({ fy, setFy, forClientId }) {
  const { user } = useAuthStore()
  const { register, handleSubmit, control, watch, setValue, reset } = useForm({
    defaultValues: { entries: [{transaction_type:'sales',party_name:'',invoice_number:'',taxable_amount:'',invoice_date:'',month:'',party_gstin:'',hsn_code:'',gst_rate:18,cgst_amount:0,sgst_amount:0,igst_amount:0,total_amount:'',description:''}] }
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'entries' })
  const { data: myEntries = [], refetch } = useQuery({
    queryKey: ['my-entries', fy, forClientId || user?.id],
    queryFn: () => manualEntryAPI.myEntries(fy).then(r => r.data),
  })
  const submitMutation = useMutation({
    mutationFn: (data) => manualEntryAPI.submit({
      financial_year: fy,
      // Only send client_id when admin is entering for a client
      ...(forClientId ? { client_id: forClientId } : {}),
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
    onSuccess: (res) => { toast.success(`${res.data.transaction_ids?.length || 'All'} entries submitted for CA review!`); reset(); refetch() },
    onError: (e) => toast.error(e.response?.data?.detail || 'Submission failed — check your profile is complete'),
  })
  const pending = myEntries.filter(e=>e.status==='pending').length
  const approved = myEntries.filter(e=>e.status==='approved').length
  const rejected = myEntries.filter(e=>e.status==='rejected').length
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 text-center"><Clock size={18} className="text-amber-500 mx-auto mb-1"/><p className="text-xl font-bold">{pending}</p><p className="text-xs text-gray-500">Pending Review</p></div>
        <div className="card p-4 text-center"><CheckCircle size={18} className="text-green-500 mx-auto mb-1"/><p className="text-xl font-bold">{approved}</p><p className="text-xs text-gray-500">Approved</p></div>
        <div className="card p-4 text-center"><XCircle size={18} className="text-red-500 mx-auto mb-1"/><p className="text-xl font-bold">{rejected}</p><p className="text-xs text-gray-500">Rejected</p></div>
      </div>
      <div className="card p-5">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <h3 className="font-semibold text-gray-900">Add Transactions</h3>
          <select className="input w-36 text-sm" value={fy} onChange={e=>setFy(e.target.value)}>{FY_OPTIONS.map(y=><option key={y}>{y}</option>)}</select>
        </div>
        <form onSubmit={handleSubmit(d=>submitMutation.mutate(d))} className="space-y-4">
          {fields.map((field,i)=><EntryRow key={field.id} index={i} remove={remove} register={register} watch={watch} setValue={setValue}/>)}
          <button type="button" onClick={()=>append({transaction_type:'sales',party_name:'',invoice_number:'',taxable_amount:'',invoice_date:'',month:'',party_gstin:'',hsn_code:'',gst_rate:18,cgst_amount:0,sgst_amount:0,igst_amount:0,total_amount:'',description:''})} className="w-full border-2 border-dashed border-gray-300 rounded-xl p-4 text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-all flex items-center justify-center gap-2"><Plus size={16}/><span className="font-medium">Add Another Transaction</span></button>
          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">{fields.length} {fields.length===1?'entry':'entries'} ready</p>
            <button type="submit" disabled={submitMutation.isPending||fields.length===0} className="btn-primary flex items-center gap-2 px-6">{submitMutation.isPending?<div className="spinner w-4 h-4"/>:<Send size={15}/>}Submit for CA Review</button>
          </div>
        </form>
      </div>
      <div className="card">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2"><History size={18} className="text-gray-500"/><h3 className="font-semibold text-gray-900">Submission History — FY {fy}</h3><span className="ml-auto bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">{myEntries.length}</span></div>
        <HistoryTable entries={myEntries}/>
      </div>
    </div>
  )
}

// ── CA Review ─────────────────────────────────────────────────────────────────
function CAReviewView({ fy, setFy }) {
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
  const approveMutation = useMutation({ mutationFn: (id)=>manualEntryAPI.approve(id), onSuccess: ()=>{toast.success('Approved!');refetch()}, onError: (e)=>toast.error(e.response?.data?.detail||'Failed') })
  const approveBatchMutation = useMutation({ mutationFn: (ids)=>manualEntryAPI.approveBatch(ids), onSuccess: (r)=>{toast.success(`${r.data.approved} approved!`);setSelectedIds([]);refetch()} })
  const rejectMutation = useMutation({ mutationFn: ({id,reason})=>manualEntryAPI.reject(id,reason), onSuccess: ()=>{toast.success('Rejected');refetch()} })
  return (
    <div className="space-y-6">
      <div className="card p-5">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
          <div className="flex items-center gap-3"><h3 className="font-semibold text-gray-900">Pending Review</h3><span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full">{pending.length}</span></div>
          <div className="flex gap-3 flex-wrap items-center">
            <select className="input w-40 text-sm" value={fy} onChange={e=>setFy(e.target.value)}>{FY_OPTIONS.map(y=><option key={y}>{y}</option>)}</select>
            <ClientSelector selectedClient={selectedClient} onSelect={setSelectedClient} label="Filter:"/>
            {selectedIds.length>0&&<button onClick={()=>approveBatchMutation.mutate(selectedIds)} className="btn-primary flex items-center gap-2 text-sm"><CheckCircle size={14}/>Approve ({selectedIds.length})</button>}
          </div>
        </div>
        {isLoading?<div className="flex justify-center py-10"><div className="spinner w-8 h-8"/></div>
          :pending.length===0?<div className="text-center py-10 text-gray-400"><ListChecks size={36} className="mx-auto mb-2 opacity-40"/><p>No pending entries</p></div>
          :<div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="bg-gray-50"><th className="px-3 py-3 w-10"><input type="checkbox" checked={selectedIds.length===pending.length&&pending.length>0} onChange={e=>setSelectedIds(e.target.checked?pending.map(p=>p.id):[])}/></th>{['Client','Type','Invoice','Party','Total','Date','Actions'].map(h=><th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-100">
              {pending.map(e=>(
                <tr key={e.id} className={selectedIds.includes(e.id)?'bg-blue-50':'hover:bg-gray-50'}>
                  <td className="px-3 py-3"><input type="checkbox" checked={selectedIds.includes(e.id)} onChange={()=>setSelectedIds(p=>p.includes(e.id)?p.filter(i=>i!==e.id):[...p,e.id])}/></td>
                  <td className="px-3 py-3 text-xs text-gray-500">#{e.client_id}</td>
                  <td className="px-3 py-3"><span className="bg-blue-100 text-blue-700 capitalize text-xs px-2 py-0.5 rounded-full">{e.transaction_type}</span></td>
                  <td className="px-3 py-3 text-xs">{e.invoice_number||'—'}</td>
                  <td className="px-3 py-3 text-xs">{e.party_name||'—'}</td>
                  <td className="px-3 py-3 font-semibold text-xs">₹{parseFloat(e.total_amount||0).toLocaleString()}</td>
                  <td className="px-3 py-3 text-xs text-gray-500">{e.created_at?new Date(e.created_at).toLocaleDateString('en-IN'):'—'}</td>
                  <td className="px-3 py-3"><div className="flex gap-1"><button onClick={()=>approveMutation.mutate(e.id)} className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Approve"><CheckCircle size={14}/></button><button onClick={()=>{const r=window.prompt('Rejection reason:');if(r)rejectMutation.mutate({id:e.id,reason:r})}} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Reject"><XCircle size={14}/></button></div></td>
                </tr>
              ))}
            </tbody>
          </table></div>}
      </div>
      <div className="card"><div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2"><History size={18} className="text-gray-500"/><h3 className="font-semibold text-gray-900">All History — FY {fy}</h3></div><HistoryTable entries={allEntries} showClient/></div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ManualEntryPage() {
  const { isCA } = useAuthStore()
  const [view, setView] = useState(isCA() ? 'review' : 'entry')
  const [fy, setFy] = useState('2024-25')
  const [selectedClient, setSelectedClient] = useState(null)

  const tabs = isCA()
    ? [
        { id: 'review', label: 'Pending Review', icon: ListChecks },
        { id: 'entry', label: 'Add Entry for Client', icon: PenLine },
        { id: 'trialbalance', label: 'Trial Balance', icon: Scale },
      ]
    : [
        { id: 'entry', label: 'Add Transactions', icon: PenLine },
        { id: 'trialbalance', label: 'Trial Balance', icon: Scale },
      ]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{isCA() ? 'Manual Entry & Review' : 'Enter Data Manually'}</h1>
          <p className="text-sm text-gray-500 mt-1">{isCA() ? 'Review client entries and manage trial balance data' : 'Enter transactions or full trial balance — CA will review and all reports update automatically'}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setView(id)}
              className={view === id ? 'btn-primary flex items-center gap-2 text-sm' : 'btn-secondary flex items-center gap-2 text-sm'}>
              <Icon size={14}/>{label}
            </button>
          ))}
        </div>
      </div>

      {/* Client selector for admin */}
      {isCA() && (view === 'entry' || view === 'trialbalance') && (
        <div className="card p-4 bg-blue-50 border-blue-200">
          <p className="text-sm font-medium text-blue-800 mb-2">Entering data as Admin/CA on behalf of client:</p>
          <ClientSelector selectedClient={selectedClient} onSelect={setSelectedClient} label="Select client:"/>
          {!selectedClient && <p className="text-xs text-amber-600 mt-2">⚠ Select a client to proceed</p>}
        </div>
      )}

      {view === 'entry' && (!isCA() || selectedClient) && (
        <EntryForm fy={fy} setFy={setFy} forClientId={isCA() ? selectedClient?.id : null}/>
      )}
      {view === 'trialbalance' && (!isCA() || selectedClient) && (
        <TrialBalanceForm fy={fy} setFy={setFy} forClientId={isCA() ? selectedClient?.id : null}/>
      )}
      {view === 'review' && isCA() && <CAReviewView fy={fy} setFy={setFy}/>}

      {isCA() && (view === 'entry' || view === 'trialbalance') && !selectedClient && (
        <div className="card p-10 text-center text-gray-400">
          <Scale size={40} className="mx-auto mb-3 opacity-40"/>
          <p>Select a client above to {view === 'trialbalance' ? 'enter trial balance' : 'add entries'}</p>
        </div>
      )}
    </div>
  )
}
