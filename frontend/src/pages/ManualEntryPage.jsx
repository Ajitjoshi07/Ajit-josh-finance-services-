import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, useFieldArray } from 'react-hook-form'
import toast from 'react-hot-toast'
import { manualEntryAPI, bookkeepingAPI } from '../services/api'
import useAuthStore from '../store/authStore'
import ClientSelector from '../components/shared/ClientSelector'
import {
  Plus, Trash2, Send, CheckCircle, Clock, XCircle, History,
  ListChecks, PenLine, ChevronDown, ChevronUp, Info, Scale,
  AlertTriangle, RefreshCw
} from 'lucide-react'

const FY_OPTIONS = ['2026-27','2025-26','2024-25','2023-24','2022-23']
const ENTRY_TYPES = [
  { value:'sales',         label:'Sales Invoice',    hint:'Revenue from customers' },
  { value:'purchase',      label:'Purchase Invoice', hint:'Goods/services from suppliers' },
  { value:'expense',       label:'Business Expense', hint:'Rent, electricity, misc.' },
  { value:'salary_slip',   label:'Salary/Payroll',   hint:'Employee salaries' },
  { value:'bank',          label:'Bank Entry',        hint:'Bank deposits/withdrawals' },
  { value:'asset_invoice', label:'Asset Purchase',   hint:'Equipment/furniture' },
]
const GST_RATES = [
  {value:0,label:'Nil (0%)'},{value:5,label:'5%'},{value:12,label:'12%'},
  {value:18,label:'18%'},{value:28,label:'28%'},
]
const MONTHS = [
  {v:4,l:'April'},{v:5,l:'May'},{v:6,l:'June'},{v:7,l:'July'},
  {v:8,l:'August'},{v:9,l:'September'},{v:10,l:'October'},{v:11,l:'November'},
  {v:12,l:'December'},{v:1,l:'January'},{v:2,l:'February'},{v:3,l:'March'},
]

// ── ICAI Chart of Accounts ────────────────────────────────────────────────────
const ICAI_ACCOUNTS = [
  {code:'1001',name:'Cash in Hand',                           group:'Current Assets',     normal:'Dr'},
  {code:'1002',name:'Cash at Bank (Current A/c)',             group:'Current Assets',     normal:'Dr'},
  {code:'1003',name:'Cash at Bank (Savings A/c)',             group:'Current Assets',     normal:'Dr'},
  {code:'1004',name:'Fixed Deposits (FD)',                    group:'Current Assets',     normal:'Dr'},
  {code:'1010',name:'Sundry Debtors (Accounts Receivable)',   group:'Current Assets',     normal:'Dr'},
  {code:'1011',name:'Bills Receivable',                       group:'Current Assets',     normal:'Dr'},
  {code:'1020',name:'Opening Stock',                          group:'Current Assets',     normal:'Dr'},
  {code:'1021',name:'Closing Stock',                          group:'Current Assets',     normal:'Dr'},
  {code:'1030',name:'Prepaid Expenses',                       group:'Current Assets',     normal:'Dr'},
  {code:'1031',name:'Advance to Suppliers',                   group:'Current Assets',     normal:'Dr'},
  {code:'1032',name:'Advance to Employees',                   group:'Current Assets',     normal:'Dr'},
  {code:'1033',name:'TDS Receivable / Tax Refund Due',        group:'Current Assets',     normal:'Dr'},
  {code:'1034',name:'GST Input Tax Credit (ITC)',             group:'Current Assets',     normal:'Dr'},
  {code:'1035',name:'Other Current Assets',                   group:'Current Assets',     normal:'Dr'},
  {code:'1100',name:'Land & Building',                        group:'Fixed Assets',       normal:'Dr'},
  {code:'1101',name:'Plant & Machinery',                      group:'Fixed Assets',       normal:'Dr'},
  {code:'1102',name:'Furniture & Fixtures',                   group:'Fixed Assets',       normal:'Dr'},
  {code:'1103',name:'Computers & IT Equipment',               group:'Fixed Assets',       normal:'Dr'},
  {code:'1104',name:'Vehicles',                               group:'Fixed Assets',       normal:'Dr'},
  {code:'1105',name:'Office Equipment',                       group:'Fixed Assets',       normal:'Dr'},
  {code:'1106',name:'Less: Accumulated Depreciation',         group:'Fixed Assets',       normal:'Cr'},
  {code:'1110',name:'Intangible Assets (Goodwill)',           group:'Fixed Assets',       normal:'Dr'},
  {code:'1120',name:'Long-term Investments',                  group:'Investments',        normal:'Dr'},
  {code:'1121',name:'Short-term Investments / MF',            group:'Investments',        normal:'Dr'},
  {code:'1130',name:'Preliminary Expenses',                   group:'Misc Expenditure',   normal:'Dr'},
  {code:'2001',name:'Sundry Creditors (Accounts Payable)',    group:'Current Liabilities',normal:'Cr'},
  {code:'2002',name:'Bills Payable',                          group:'Current Liabilities',normal:'Cr'},
  {code:'2003',name:'Outstanding Expenses',                   group:'Current Liabilities',normal:'Cr'},
  {code:'2004',name:'Advance from Customers',                 group:'Current Liabilities',normal:'Cr'},
  {code:'2010',name:'GST Payable — CGST',                    group:'Current Liabilities',normal:'Cr'},
  {code:'2011',name:'GST Payable — SGST',                    group:'Current Liabilities',normal:'Cr'},
  {code:'2012',name:'GST Payable — IGST',                    group:'Current Liabilities',normal:'Cr'},
  {code:'2013',name:'TDS Payable',                            group:'Current Liabilities',normal:'Cr'},
  {code:'2014',name:'Salary Payable',                         group:'Current Liabilities',normal:'Cr'},
  {code:'2015',name:'PF / ESIC Payable',                     group:'Current Liabilities',normal:'Cr'},
  {code:'2016',name:'Income Tax Payable',                     group:'Current Liabilities',normal:'Cr'},
  {code:'2017',name:'Other Current Liabilities',              group:'Current Liabilities',normal:'Cr'},
  {code:'2100',name:'Bank Overdraft (OD)',                    group:'Secured Loans',      normal:'Cr'},
  {code:'2101',name:'Bank Term Loan',                         group:'Secured Loans',      normal:'Cr'},
  {code:'2102',name:'Mortgage / Hypothecation Loan',          group:'Secured Loans',      normal:'Cr'},
  {code:'2110',name:'Unsecured Loans from Partners/Directors',group:'Unsecured Loans',    normal:'Cr'},
  {code:'2111',name:'Inter-Corporate Deposits',               group:'Unsecured Loans',    normal:'Cr'},
  {code:'3001',name:"Capital Account / Proprietor's Capital", group:'Capital',            normal:'Cr'},
  {code:'3002',name:'Drawings Account',                       group:'Capital',            normal:'Dr'},
  {code:'3003',name:'Share Capital (if company)',             group:'Capital',            normal:'Cr'},
  {code:'3004',name:'Reserves & Surplus',                     group:'Capital',            normal:'Cr'},
  {code:'3005',name:'Retained Earnings',                      group:'Capital',            normal:'Cr'},
  {code:'4001',name:'Sales Revenue (Domestic)',               group:'Sales Income',       normal:'Cr'},
  {code:'4002',name:'Sales Revenue (Export)',                 group:'Sales Income',       normal:'Cr'},
  {code:'4003',name:'Service Income / Fees',                  group:'Sales Income',       normal:'Cr'},
  {code:'4004',name:'Sales Returns (Deduct)',                 group:'Sales Income',       normal:'Dr'},
  {code:'4005',name:'Other Operating Income',                 group:'Other Income',       normal:'Cr'},
  {code:'4010',name:'Interest Income (Bank/FD)',              group:'Other Income',       normal:'Cr'},
  {code:'4011',name:'Commission Received',                    group:'Other Income',       normal:'Cr'},
  {code:'4012',name:'Rent Received',                          group:'Other Income',       normal:'Cr'},
  {code:'4013',name:'Dividend Income',                        group:'Other Income',       normal:'Cr'},
  {code:'4014',name:'Discount Received',                      group:'Other Income',       normal:'Cr'},
  {code:'4015',name:'Profit on Sale of Fixed Assets',         group:'Other Income',       normal:'Cr'},
  {code:'5001',name:'Opening Stock (Raw Material)',           group:'Direct Expenses',    normal:'Dr'},
  {code:'5002',name:'Purchases (Net)',                         group:'Direct Expenses',    normal:'Dr'},
  {code:'5003',name:'Purchase Returns (Deduct)',              group:'Direct Expenses',    normal:'Cr'},
  {code:'5004',name:'Direct Wages / Labour Charges',          group:'Direct Expenses',    normal:'Dr'},
  {code:'5005',name:'Factory Overhead',                       group:'Direct Expenses',    normal:'Dr'},
  {code:'5006',name:'Power & Fuel (Factory)',                 group:'Direct Expenses',    normal:'Dr'},
  {code:'5007',name:'Freight Inward / Carriage on Purchases', group:'Direct Expenses',    normal:'Dr'},
  {code:'5008',name:'Custom Duty / Import Charges',           group:'Direct Expenses',    normal:'Dr'},
  {code:'5009',name:'Manufacturing / Production Expenses',    group:'Direct Expenses',    normal:'Dr'},
  {code:'5010',name:'Closing Stock (Raw Material)',           group:'Direct Expenses',    normal:'Cr'},
  {code:'6001',name:'Salaries & Staff Welfare',               group:'Indirect Expenses',  normal:'Dr'},
  {code:'6002',name:'Office / Shop Rent',                     group:'Indirect Expenses',  normal:'Dr'},
  {code:'6003',name:'Electricity & Water Charges',            group:'Indirect Expenses',  normal:'Dr'},
  {code:'6004',name:'Telephone & Internet Charges',           group:'Indirect Expenses',  normal:'Dr'},
  {code:'6005',name:'Advertising & Marketing Expenses',       group:'Indirect Expenses',  normal:'Dr'},
  {code:'6006',name:'Repairs & Maintenance',                  group:'Indirect Expenses',  normal:'Dr'},
  {code:'6007',name:'Depreciation on Fixed Assets',           group:'Indirect Expenses',  normal:'Dr'},
  {code:'6008',name:'Insurance Premium',                      group:'Indirect Expenses',  normal:'Dr'},
  {code:'6009',name:'Printing & Stationery',                  group:'Indirect Expenses',  normal:'Dr'},
  {code:'6010',name:'Travelling & Conveyance',                group:'Indirect Expenses',  normal:'Dr'},
  {code:'6011',name:'Postage & Courier Charges',              group:'Indirect Expenses',  normal:'Dr'},
  {code:'6012',name:'Audit & Legal Fees',                     group:'Indirect Expenses',  normal:'Dr'},
  {code:'6013',name:'Professional & Consultation Charges',    group:'Indirect Expenses',  normal:'Dr'},
  {code:'6014',name:'Bank Charges & Interest on Loans',       group:'Indirect Expenses',  normal:'Dr'},
  {code:'6015',name:'Bad Debts Written Off',                  group:'Indirect Expenses',  normal:'Dr'},
  {code:'6016',name:'Discount Allowed',                       group:'Indirect Expenses',  normal:'Dr'},
  {code:'6017',name:'Staff PF / ESIC Contribution',          group:'Indirect Expenses',  normal:'Dr'},
  {code:'6018',name:'Miscellaneous Expenses',                 group:'Indirect Expenses',  normal:'Dr'},
  {code:'6019',name:'Freight Outward / Delivery Charges',     group:'Indirect Expenses',  normal:'Dr'},
  {code:'6020',name:'Office Expenses',                        group:'Indirect Expenses',  normal:'Dr'},
  {code:'6021',name:'Business Promotion Expenses',            group:'Indirect Expenses',  normal:'Dr'},
  {code:'6022',name:'Loss on Sale of Fixed Assets',           group:'Indirect Expenses',  normal:'Dr'},
  {code:'6030',name:'Income Tax / Advance Tax Paid',          group:'Tax',                normal:'Dr'},
  {code:'6031',name:'TDS Deducted at Source',                 group:'Tax',                normal:'Dr'},
]
const TB_GROUPS = [...new Set(ICAI_ACCOUNTS.map(a => a.group))]
const GROUP_COLORS = {
  'Current Assets':     'bg-blue-50 text-blue-800',
  'Fixed Assets':       'bg-indigo-50 text-indigo-800',
  'Investments':        'bg-cyan-50 text-cyan-800',
  'Misc Expenditure':   'bg-gray-100 text-gray-700',
  'Current Liabilities':'bg-red-50 text-red-800',
  'Secured Loans':      'bg-orange-50 text-orange-800',
  'Unsecured Loans':    'bg-amber-50 text-amber-800',
  'Capital':            'bg-purple-50 text-purple-800',
  'Sales Income':       'bg-green-50 text-green-800',
  'Other Income':       'bg-teal-50 text-teal-800',
  'Direct Expenses':    'bg-rose-50 text-rose-800',
  'Indirect Expenses':  'bg-pink-50 text-pink-800',
  'Tax':                'bg-yellow-50 text-yellow-800',
}

// ── EntryRow ──────────────────────────────────────────────────────────────────
function EntryRow({ index, remove, register, watch, setValue }) {
  const [expanded, setExpanded] = useState(true)
  const txnType   = watch(`entries.${index}.transaction_type`)
  const taxable   = parseFloat(watch(`entries.${index}.taxable_amount`) || 0)
  const gstRate   = parseFloat(watch(`entries.${index}.gst_rate`) || 0)
  const showGST   = ['sales','purchase'].includes(txnType)

  React.useEffect(() => {
    if (taxable > 0 && showGST && gstRate > 0) {
      const gst = (taxable * gstRate) / 100
      setValue(`entries.${index}.cgst_amount`,  (gst/2).toFixed(2))
      setValue(`entries.${index}.sgst_amount`,  (gst/2).toFixed(2))
      setValue(`entries.${index}.total_amount`, (taxable+gst).toFixed(2))
    } else if (taxable > 0) {
      setValue(`entries.${index}.cgst_amount`,  '0')
      setValue(`entries.${index}.sgst_amount`,  '0')
      setValue(`entries.${index}.total_amount`, taxable.toFixed(2))
    }
  }, [taxable, gstRate, showGST])

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
      <div className="flex items-center gap-3 p-4 flex-wrap">
        <span className="w-6 h-6 bg-primary-600 text-white rounded-full text-xs flex items-center justify-center font-bold flex-shrink-0">{index+1}</span>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-1 min-w-0">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Type *</label>
            <select className="input text-sm py-1.5" {...register(`entries.${index}.transaction_type`,{required:true})}>
              {ENTRY_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Party Name</label>
            <input className="input text-sm py-1.5" placeholder="Customer/Supplier" {...register(`entries.${index}.party_name`)}/>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Invoice No</label>
            <input className="input text-sm py-1.5" placeholder="INV-001" {...register(`entries.${index}.invoice_number`)}/>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Amount (Rs) *</label>
            <input type="number" step="0.01" min="0" className="input text-sm py-1.5" placeholder="0.00"
              {...register(`entries.${index}.taxable_amount`,{required:true,min:0.01})}/>
          </div>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button type="button" onClick={()=>setExpanded(!expanded)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded">
            {expanded?<ChevronUp size={15}/>:<ChevronDown size={15}/>}
          </button>
          <button type="button" onClick={()=>remove(index)} className="p-1.5 text-gray-400 hover:text-red-600 rounded">
            <Trash2 size={15}/>
          </button>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-gray-200 bg-white p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Invoice Date</label>
            <input type="date" className="input text-sm py-1.5" {...register(`entries.${index}.invoice_date`)}/>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Month</label>
            <select className="input text-sm py-1.5" {...register(`entries.${index}.month`)}>
              <option value="">Auto from date</option>
              {MONTHS.map(m=><option key={m.v} value={m.v}>{m.l}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Party GSTIN</label>
            <input className="input text-sm py-1.5 font-mono uppercase" placeholder="27ABCDE1234F1Z5"
              maxLength={15} {...register(`entries.${index}.party_gstin`)}/>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">HSN/SAC Code</label>
            <input className="input text-sm py-1.5" placeholder="e.g. 9954" {...register(`entries.${index}.hsn_code`)}/>
          </div>
          {showGST && (
            <>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">GST Rate</label>
                <select className="input text-sm py-1.5" {...register(`entries.${index}.gst_rate`)}>
                  {GST_RATES.map(r=><option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">CGST (Rs)</label>
                <input type="number" step="0.01" className="input text-sm py-1.5 bg-gray-50" readOnly {...register(`entries.${index}.cgst_amount`)}/>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">SGST (Rs)</label>
                <input type="number" step="0.01" className="input text-sm py-1.5 bg-gray-50" readOnly {...register(`entries.${index}.sgst_amount`)}/>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Total (Rs)</label>
                <input type="number" step="0.01" className="input text-sm py-1.5 bg-green-50 font-semibold text-green-800" readOnly {...register(`entries.${index}.total_amount`)}/>
              </div>
            </>
          )}
          <div className="md:col-span-4">
            <label className="text-xs text-gray-500 mb-1 block">Description</label>
            <input className="input text-sm py-1.5" placeholder="Brief description" {...register(`entries.${index}.description`)}/>
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

// ── HistoryTable ──────────────────────────────────────────────────────────────
function HistoryTable({ entries, showClient=false }) {
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
          {['Type','Invoice','Party','Amount','Description','Status','Date'].map(h=>(
            <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
          ))}
        </tr></thead>
        <tbody className="divide-y divide-gray-100">
          {entries.map(e=>(
            <tr key={e.id} className="hover:bg-gray-50">
              {showClient && <td className="px-4 py-3 text-xs text-gray-500">#{e.client_id}</td>}
              <td className="px-4 py-3"><span className="badge-info capitalize text-xs">{e.transaction_type}</span></td>
              <td className="px-4 py-3 text-xs">{e.invoice_number||'—'}</td>
              <td className="px-4 py-3 text-xs">{e.party_name||'—'}</td>
              <td className="px-4 py-3 font-semibold text-xs">Rs {parseFloat(e.total_amount||0).toLocaleString()}</td>
              <td className="px-4 py-3 text-xs text-gray-500 max-w-[100px] truncate">{e.description||'—'}</td>
              <td className="px-4 py-3">
                {e.status==='approved' && <span className="badge-success flex items-center gap-1 w-fit text-xs"><CheckCircle size={10}/>Approved</span>}
                {e.status==='pending'  && <span className="badge-warning flex items-center gap-1 w-fit text-xs"><Clock size={10}/>Pending</span>}
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

// ── EntryForm ─────────────────────────────────────────────────────────────────
function EntryForm({ fy, setFy, forClientId=null }) {
  const { user } = useAuthStore()
  const { register, handleSubmit, control, watch, setValue, reset } = useForm({
    defaultValues:{entries:[{transaction_type:'sales',party_name:'',invoice_number:'',taxable_amount:'',invoice_date:'',month:'',party_gstin:'',hsn_code:'',gst_rate:18,cgst_amount:0,sgst_amount:0,igst_amount:0,total_amount:'',description:''}]}
  })
  const { fields, append, remove } = useFieldArray({control,name:'entries'})

  const {data:myEntries=[],refetch} = useQuery({
    queryKey:['my-entries',fy,forClientId||user?.id],
    queryFn:()=>manualEntryAPI.myEntries(fy).then(r=>r.data),
  })

  const submitMutation = useMutation({
    mutationFn:(data)=>manualEntryAPI.submit({
      financial_year:fy, client_id:forClientId,
      entries:data.entries.map(e=>({
        transaction_type:e.transaction_type, invoice_number:e.invoice_number||null,
        invoice_date:e.invoice_date||null, party_name:e.party_name||null,
        party_gstin:e.party_gstin||null, description:e.description||null,
        hsn_code:e.hsn_code||null, taxable_amount:parseFloat(e.taxable_amount)||0,
        cgst_amount:parseFloat(e.cgst_amount)||0, sgst_amount:parseFloat(e.sgst_amount)||0,
        igst_amount:0, total_amount:parseFloat(e.total_amount)||parseFloat(e.taxable_amount)||0,
        tds_amount:0, month:e.month?parseInt(e.month):null, financial_year:fy,
      }))
    }),
    onSuccess:()=>{toast.success('Submitted for CA review!');reset();refetch()},
    onError:(e)=>toast.error(e.response?.data?.detail||'Submission failed'),
  })

  const pending  = myEntries.filter(e=>e.status==='pending').length
  const approved = myEntries.filter(e=>e.status==='approved').length

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
          <select className="input w-36 text-sm" value={fy} onChange={e=>setFy(e.target.value)}>
            {FY_OPTIONS.map(y=><option key={y}>{y}</option>)}
          </select>
        </div>
        <form onSubmit={handleSubmit(d=>submitMutation.mutate(d))} className="space-y-4">
          {fields.map((field,i)=>(
            <EntryRow key={field.id} index={i} remove={remove} register={register} watch={watch} setValue={setValue}/>
          ))}
          <button type="button"
            onClick={()=>append({transaction_type:'sales',party_name:'',invoice_number:'',taxable_amount:'',invoice_date:'',month:'',party_gstin:'',hsn_code:'',gst_rate:18,cgst_amount:0,sgst_amount:0,igst_amount:0,total_amount:'',description:''})}
            className="w-full border-2 border-dashed border-gray-300 rounded-xl p-4 text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-all flex items-center justify-center gap-2">
            <Plus size={16}/><span className="font-medium">Add Another Transaction</span>
          </button>
          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">{fields.length} {fields.length===1?'entry':'entries'} ready</p>
            <button type="submit" disabled={submitMutation.isPending||fields.length===0} className="btn-primary flex items-center gap-2 px-6">
              {submitMutation.isPending?<div className="spinner w-4 h-4"/>:<Send size={15}/>}
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
        <HistoryTable entries={myEntries}/>
      </div>
    </div>
  )
}

// ── TrialBalanceForm ──────────────────────────────────────────────────────────
function TrialBalanceForm({ fy, setFy, forClientId=null }) {
  const [activeGroup,    setActiveGroup]    = useState('All')
  const [amounts,        setAmounts]        = useState({})
  const [notes,          setNotes]          = useState('')
  const [showOnlyFilled, setShowOnlyFilled] = useState(false)

  const {data:existing, isLoading, refetch} = useQuery({
    queryKey:['trial-balance',fy,forClientId],
    queryFn:()=>bookkeepingAPI.trialBalance({financial_year:fy,client_id:forClientId}).then(r=>r.data),
  })

  React.useEffect(()=>{
    if (existing?.entries?.length) {
      const filled = {}
      existing.entries.forEach(e=>{
        if (e.account_code) {
          filled[e.account_code] = {
            dr: e.debit_amount  > 0 ? String(e.debit_amount)  : '',
            cr: e.credit_amount > 0 ? String(e.credit_amount) : '',
          }
        }
      })
      setAmounts(filled)
    }
  },[existing])

  const setAmount = (code, side, value) => {
    setAmounts(prev=>({...prev,[code]:{...(prev[code]||{dr:'',cr:''}), [side]:value}}))
  }

  const totalDr     = useMemo(()=>Object.values(amounts).reduce((s,v)=>s+(parseFloat(v.dr)||0),0),[amounts])
  const totalCr     = useMemo(()=>Object.values(amounts).reduce((s,v)=>s+(parseFloat(v.cr)||0),0),[amounts])
  const diff        = Math.abs(totalDr-totalCr)
  const isBalanced  = diff < 0.01
  const filledCount = Object.values(amounts).filter(v=>(parseFloat(v.dr)||0)+(parseFloat(v.cr)||0)>0).length

  const submitMutation = useMutation({
    mutationFn:()=>{
      const entries = ICAI_ACCOUNTS
        .map(acc=>({account_code:acc.code, account_name:acc.name, debit_amount:parseFloat(amounts[acc.code]?.dr)||0, credit_amount:parseFloat(amounts[acc.code]?.cr)||0}))
        .filter(e=>e.debit_amount>0||e.credit_amount>0)
      if (entries.length===0) { toast.error('Please enter at least one amount.'); return Promise.reject() }
      return bookkeepingAPI.submitTrialBalance({financial_year:fy, client_id:forClientId||null, entries, notes})
    },
    onSuccess:()=>{toast.success('Trial balance saved!');refetch()},
    onError:(e)=>{ if(e) toast.error(e.response?.data?.detail||'Save failed') },
  })

  const visibleAccounts = ICAI_ACCOUNTS
    .filter(acc=>activeGroup==='All'||acc.group===activeGroup)
    .filter(acc=>!showOnlyFilled||((parseFloat(amounts[acc.code]?.dr)||0)+(parseFloat(amounts[acc.code]?.cr)||0)>0))

  const fmt = (n) => n.toLocaleString('en-IN',{minimumFractionDigits:2})

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Scale size={18} className="text-primary-600"/>Trial Balance Entry
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {ICAI_ACCOUNTS.length} ICAI standard accounts — enter Dr/Cr opening balances
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <select className="input w-36 text-sm" value={fy} onChange={e=>setFy(e.target.value)}>
              {FY_OPTIONS.map(y=><option key={y}>{y}</option>)}
            </select>
            <button onClick={()=>{if(window.confirm('Clear all entered amounts?')){setAmounts({});setNotes('')}}}
              className="btn-secondary text-sm flex items-center gap-1.5">
              <RefreshCw size={13}/>Clear All
            </button>
          </div>
        </div>

        {/* Balance summary bar */}
        <div className={`rounded-xl p-4 flex flex-wrap gap-6 items-center ${isBalanced&&filledCount>0?'bg-green-50 border border-green-200':filledCount>0?'bg-red-50 border border-red-200':'bg-gray-50 border border-gray-200'}`}>
          <div className="text-center">
            <p className="text-xs text-gray-500 mb-0.5">Total Debit</p>
            <p className="text-xl font-bold text-blue-700">Rs {fmt(totalDr)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 mb-0.5">Total Credit</p>
            <p className="text-xl font-bold text-red-600">Rs {fmt(totalCr)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 mb-0.5">Difference</p>
            <p className={`text-xl font-bold ${isBalanced&&filledCount>0?'text-green-600':'text-red-600'}`}>Rs {fmt(diff)}</p>
          </div>
          <div>
            {filledCount===0 ? (
              <span className="text-sm text-gray-400">No amounts entered yet</span>
            ) : isBalanced ? (
              <span className="flex items-center gap-1.5 text-green-700 font-semibold text-sm">
                <CheckCircle size={16}/>Balanced
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-red-700 font-semibold text-sm">
                <AlertTriangle size={16}/>Out of balance
              </span>
            )}
          </div>
          <div className="ml-auto text-right">
            <p className="text-xs text-gray-500">Accounts filled</p>
            <p className="text-lg font-bold text-gray-700">{filledCount} / {ICAI_ACCOUNTS.length}</p>
          </div>
        </div>
      </div>

      {/* Group filters */}
      <div className="flex flex-wrap gap-2">
        {['All',...TB_GROUPS].map(grp=>{
          const cnt = grp==='All'
            ? filledCount
            : ICAI_ACCOUNTS.filter(a=>a.group===grp&&((parseFloat(amounts[a.code]?.dr)||0)+(parseFloat(amounts[a.code]?.cr)||0)>0)).length
          return (
            <button key={grp} onClick={()=>setActiveGroup(grp)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${activeGroup===grp?'bg-primary-600 text-white':'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
              {grp}
              {cnt>0 && <span className={`text-xs rounded-full px-1.5 py-0.5 font-bold ${activeGroup===grp?'bg-white/20 text-white':'bg-primary-100 text-primary-700'}`}>{cnt}</span>}
            </button>
          )
        })}
        <button onClick={()=>setShowOnlyFilled(p=>!p)}
          className={`ml-auto px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${showOnlyFilled?'bg-amber-100 text-amber-800 border-amber-300':'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
          {showOnlyFilled?'Showing filled only':'Show filled only'}
        </button>
      </div>

      {/* Accounts table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-16">Code</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Account Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-32">Group</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase w-16">Bal</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-blue-600 uppercase w-40">Debit (Dr)</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-red-500 uppercase w-40">Credit (Cr)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={6} className="text-center py-10"><div className="spinner w-6 h-6 mx-auto"/></td></tr>
              ) : visibleAccounts.length===0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-gray-400 text-sm">No accounts match this filter</td></tr>
              ) : visibleAccounts.map(acc=>{
                const dr = amounts[acc.code]?.dr||''
                const cr = amounts[acc.code]?.cr||''
                const hasVal = (parseFloat(dr)||0)+(parseFloat(cr)||0)>0
                return (
                  <tr key={acc.code} className={hasVal?'bg-yellow-50/50':'hover:bg-gray-50'}>
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-xs text-gray-400">{acc.code}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-sm ${hasVal?'font-semibold text-gray-900':'text-gray-700'}`}>{acc.name}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${GROUP_COLORS[acc.group]||'bg-gray-100 text-gray-600'}`}>{acc.group}</span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${acc.normal==='Dr'?'bg-blue-100 text-blue-700':'bg-red-100 text-red-600'}`}>{acc.normal}</span>
                    </td>
                    <td className="px-4 py-2">
                      <input type="number" step="0.01" min="0" value={dr}
                        onChange={e=>setAmount(acc.code,'dr',e.target.value)}
                        placeholder="0.00"
                        className="input text-right text-sm py-1.5 w-full border-blue-200 focus:border-blue-500"/>
                    </td>
                    <td className="px-4 py-2">
                      <input type="number" step="0.01" min="0" value={cr}
                        onChange={e=>setAmount(acc.code,'cr',e.target.value)}
                        placeholder="0.00"
                        className="input text-right text-sm py-1.5 w-full border-red-200 focus:border-red-500"/>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {filledCount>0 && (
              <tfoot>
                <tr className="bg-gray-100 border-t-2 border-gray-300 font-bold">
                  <td colSpan={4} className="px-4 py-3 text-gray-700 text-sm">TOTAL ({filledCount} accounts)</td>
                  <td className="px-4 py-3 text-right text-blue-700">Rs {fmt(totalDr)}</td>
                  <td className="px-4 py-3 text-right text-red-600">Rs {fmt(totalCr)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Notes + submit */}
      <div className="card p-5 space-y-4">
        <div>
          <label className="label">Notes / Remarks (optional)</label>
          <textarea className="input text-sm" rows={2}
            placeholder="e.g. Opening balances as on 01-Apr-2024"
            value={notes} onChange={e=>setNotes(e.target.value)}/>
        </div>
        {!isBalanced && filledCount>0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2 text-sm text-amber-800">
            <AlertTriangle size={16} className="flex-shrink-0 mt-0.5 text-amber-600"/>
            <div>
              <p className="font-semibold">Trial balance is not balanced</p>
              <p className="text-xs mt-0.5">Difference: Rs {fmt(diff)} — you can still save and fix later.</p>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">{filledCount} accounts with balances entered</p>
          <button onClick={()=>submitMutation.mutate()} disabled={submitMutation.isPending||filledCount===0}
            className="btn-primary flex items-center gap-2 px-8">
            {submitMutation.isPending?<div className="spinner w-4 h-4"/>:<Send size={15}/>}
            Save Trial Balance
          </button>
        </div>
      </div>
    </div>
  )
}

// ── CAReviewView ──────────────────────────────────────────────────────────────
function CAReviewView({ fy, setFy }) {
  const [selectedClient, setSelectedClient] = useState(null)
  const [selectedIds,    setSelectedIds]    = useState([])

  const {data:pending=[],isLoading,refetch} = useQuery({
    queryKey:['pending-entries',fy,selectedClient?.id],
    queryFn:()=>manualEntryAPI.pending({financial_year:fy,client_id:selectedClient?.id}).then(r=>r.data),
    refetchInterval:15000,
  })
  const {data:allEntries=[]} = useQuery({
    queryKey:['all-entries',fy],
    queryFn:()=>manualEntryAPI.pending({financial_year:fy}).then(r=>r.data),
  })

  const approveMutation      = useMutation({mutationFn:(id)=>manualEntryAPI.approve(id),onSuccess:()=>{toast.success('Entry approved!');refetch()},onError:(e)=>toast.error(e.response?.data?.detail||'Failed')})
  const approveBatchMutation = useMutation({mutationFn:(ids)=>manualEntryAPI.approveBatch(ids),onSuccess:(res)=>{toast.success(`${res.data.approved} entries approved!`);setSelectedIds([]);refetch()}})
  const rejectMutation       = useMutation({mutationFn:({id,reason})=>manualEntryAPI.reject(id,reason),onSuccess:()=>{toast.success('Entry rejected');refetch()}})

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="font-semibold text-gray-900">Pending Review</h3>
            <span className="badge-warning">{pending.length} entries</span>
          </div>
          <div className="flex gap-3 flex-wrap items-center">
            <select className="input w-40 text-sm" value={fy} onChange={e=>setFy(e.target.value)}>
              {FY_OPTIONS.map(y=><option key={y}>{y}</option>)}
            </select>
            <ClientSelector selectedClient={selectedClient} onSelect={setSelectedClient} label="Filter by:"/>
            {selectedIds.length>0 && (
              <button onClick={()=>approveBatchMutation.mutate(selectedIds)} className="btn-primary flex items-center gap-2 text-sm">
                <CheckCircle size={14}/>Approve ({selectedIds.length})
              </button>
            )}
          </div>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-10"><div className="spinner w-8 h-8"/></div>
        ) : pending.length===0 ? (
          <div className="text-center py-10 text-gray-400">
            <ListChecks size={36} className="mx-auto mb-2 opacity-40"/>
            <p>No pending entries{selectedClient?` for ${selectedClient.business_name}`:''}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50">
                <th className="px-3 py-3 w-10">
                  <input type="checkbox" checked={selectedIds.length===pending.length&&pending.length>0}
                    onChange={e=>setSelectedIds(e.target.checked?pending.map(p=>p.id):[])}/>
                </th>
                {['Client','Type','Invoice','Party','Taxable','Total','Desc','Date','Actions'].map(h=>(
                  <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {pending.map(e=>(
                  <tr key={e.id} className={selectedIds.includes(e.id)?'bg-blue-50 hover:bg-blue-50':'hover:bg-gray-50'}>
                    <td className="px-3 py-3"><input type="checkbox" checked={selectedIds.includes(e.id)} onChange={()=>setSelectedIds(p=>p.includes(e.id)?p.filter(i=>i!==e.id):[...p,e.id])}/></td>
                    <td className="px-3 py-3 text-xs text-gray-500">#{e.client_id}</td>
                    <td className="px-3 py-3"><span className="badge-info capitalize text-xs">{e.transaction_type}</span></td>
                    <td className="px-3 py-3 text-xs">{e.invoice_number||'—'}</td>
                    <td className="px-3 py-3 text-xs">{e.party_name||'—'}</td>
                    <td className="px-3 py-3 text-xs">Rs {parseFloat(e.taxable_amount||0).toLocaleString()}</td>
                    <td className="px-3 py-3 font-semibold text-xs">Rs {parseFloat(e.total_amount||0).toLocaleString()}</td>
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
        <HistoryTable entries={allEntries} showClient={true}/>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ManualEntryPage() {
  const { isCA } = useAuthStore()
  const [view, setView] = useState(isCA() ? 'review' : 'entry')
  const [fy, setFy]     = useState('2024-25')
  const [selectedClient, setSelectedClient] = useState(null)

  const clientTabs = [
    {id:'entry',         label:'Enter Transactions', icon:PenLine},
    {id:'trial_balance', label:'Trial Balance',      icon:Scale  },
  ]
  const adminTabs = [
    {id:'review',        label:'Pending Review',        icon:ListChecks},
    {id:'entry',         label:'Add Entry for Client',  icon:PenLine   },
    {id:'trial_balance', label:'Trial Balance',         icon:Scale     },
  ]
  const tabs = isCA() ? adminTabs : clientTabs

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isCA() ? 'Manual Entry & Review' : 'Enter Data Manually'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {isCA()
              ? 'Review client submissions, add entries, and manage trial balances.'
              : 'No documents? Enter transactions or your full trial balance directly.'}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {tabs.map(({id,label,icon:Icon})=>(
            <button key={id} onClick={()=>setView(id)}
              className={view===id?'btn-primary flex items-center gap-2 text-sm':'btn-secondary flex items-center gap-2 text-sm'}>
              <Icon size={14}/>{label}
            </button>
          ))}
        </div>
      </div>

      {isCA() && (view==='entry'||view==='trial_balance') && (
        <div className="card p-4 bg-blue-50 border-blue-200">
          <p className="text-sm font-medium text-blue-800 mb-2">
            You are {view==='trial_balance'?'entering trial balance':'adding entries'} as Admin/CA
          </p>
          <ClientSelector selectedClient={selectedClient} onSelect={setSelectedClient} label="For client:"/>
        </div>
      )}

      {view==='entry'         && <EntryForm         fy={fy} setFy={setFy} forClientId={isCA()?selectedClient?.id:null}/>}
      {view==='trial_balance' && <TrialBalanceForm  fy={fy} setFy={setFy} forClientId={isCA()?selectedClient?.id:null}/>}
      {view==='review'&&isCA()&& <CAReviewView      fy={fy} setFy={setFy}/>}
    </div>
  )
}
