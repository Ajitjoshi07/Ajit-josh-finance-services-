// ─── GST PAGE ────────────────────────────────────────────────────────────────
import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { gstAPI, clientsAPI, authAPI } from '../services/api'
import useAuthStore from '../store/authStore'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Search } from 'lucide-react'
import toast from 'react-hot-toast'

const MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar']
const FY_OPTIONS = ['2026-27', '2025-26', '2024-25', '2023-24', '2022-23']
const STATUS_OPTIONS = ['pending', 'draft', 'filed', 'late']

function ClientSelector({ clients, selectedClientId, onSelect }) {
  return (
    <select className="input w-60" value={selectedClientId || ''} onChange={e => onSelect(Number(e.target.value) || null)}>
      <option value="">— Select Client —</option>
      {clients.map(c => <option key={c.id} value={c.id}>{c.business_name}</option>)}
    </select>
  )
}

export function GSTPage() {
  const { isCA } = useAuthStore()
  const [fy, setFy] = useState('2024-25')
  const [gstin, setGstin] = useState('')
  const [gstinResult, setGstinResult] = useState(null)
  const [verifying, setVerifying] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState(null)
  const qc = useQueryClient()

  const { data: myProfile } = useQuery({ queryKey: ['my-profile'], queryFn: () => authAPI.myProfile().then(r => r.data), enabled: !isCA() })
  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: () => clientsAPI.list().then(r => r.data), enabled: isCA() })
  const clientId = isCA() ? selectedClientId : myProfile?.profile?.id

  const { data: summary = [], isLoading } = useQuery({
    queryKey: ['gst-summary', fy, clientId],
    queryFn: () => gstAPI.summary({ financial_year: fy, client_id: clientId }).then(r => r.data),
    enabled: !!clientId,
  })

  const updateStatusMutation = useMutation({
    mutationFn: ({ month, year, status }) => gstAPI.updateStatus(month, year, fy, status, clientId),
    onSuccess: () => { toast.success('Filing status updated!'); qc.invalidateQueries(['gst-summary']) },
    onError: (e) => toast.error(e.response?.data?.detail || 'Update failed'),
  })

  const chartData = summary.map((m, i) => ({
    month: MONTHS[i],
    'Output GST': parseFloat(m.output_gst || 0),
    'Input GST': parseFloat(m.input_gst || 0),
    'Net Payable': parseFloat(m.net_gst_payable || 0),
  }))
  const totalPayable = summary.reduce((s, m) => s + parseFloat(m.net_gst_payable || 0), 0)

  const statusBadge = (s) => ({ filed: 'badge-success', pending: 'badge-warning', late: 'badge-danger', draft: 'badge-info' }[s] || 'badge-gray')

  const verifyGstin = async () => {
    if (!gstin.trim()) return
    setVerifying(true)
    try { const { data } = await gstAPI.verifyGstin(gstin.trim()); setGstinResult(data) }
    catch { setGstinResult({ error: 'Verification failed' }) }
    setVerifying(false)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div><h1 className="text-2xl font-bold text-gray-900">GST Filing</h1><p className="text-sm text-gray-500 mt-1">GSTR-1 & GSTR-3B management</p></div>
        <div className="flex gap-3 flex-wrap">
          {isCA() && <ClientSelector clients={clients} selectedClientId={selectedClientId} onSelect={setSelectedClientId} />}
          <select className="input w-36" value={fy} onChange={e => setFy(e.target.value)}>{FY_OPTIONS.map(y => <option key={y}>{y}</option>)}</select>
        </div>
      </div>

      {isCA() && !clientId ? (
        <div className="card p-10 text-center text-gray-400"><p className="font-medium">Select a client above to view GST data</p></div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card p-5"><p className="text-sm text-gray-500">Total Net GST Payable</p><p className="text-2xl font-bold text-red-600 mt-1">Rs.{totalPayable.toLocaleString()}</p><p className="text-xs text-gray-400 mt-1">For FY {fy}</p></div>
            <div className="card p-5"><p className="text-sm text-gray-500">Months Filed</p><p className="text-2xl font-bold text-green-600 mt-1">{summary.filter(m => m.filing_status === 'filed').length}/12</p></div>
            <div className="card p-5"><p className="text-sm text-gray-500">Pending Months</p><p className="text-2xl font-bold text-amber-600 mt-1">{summary.filter(m => m.filing_status !== 'filed').length}</p></div>
          </div>

          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Monthly GST Breakdown</h3>
            {isLoading ? <div className="flex justify-center py-10"><div className="spinner w-8 h-8" /></div> : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} tickFormatter={v => `Rs.${v / 1000}K`} /><Tooltip formatter={v => `Rs.${v.toLocaleString()}`} /><Bar dataKey="Output GST" fill="#6366f1" radius={[3, 3, 0, 0]} /><Bar dataKey="Input GST" fill="#10b981" radius={[3, 3, 0, 0]} /><Bar dataKey="Net Payable" fill="#ef4444" radius={[3, 3, 0, 0]} /></BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="card">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Monthly Filing Status</h3>
              {isCA() && <span className="text-xs text-gray-400 badge-info">Admin: Use dropdown in Action column to change status</span>}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-gray-50">{['Month', 'Sales', 'Purchases', 'Output GST', 'Input GST', 'Net Payable', 'Status', 'Action'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {summary.map((m, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{m.month_name || MONTHS[i]} {m.year}</td>
                      <td className="px-4 py-3">Rs.{parseFloat(m.total_sales || 0).toLocaleString()}</td>
                      <td className="px-4 py-3">Rs.{parseFloat(m.total_purchases || 0).toLocaleString()}</td>
                      <td className="px-4 py-3">Rs.{parseFloat(m.output_gst || 0).toLocaleString()}</td>
                      <td className="px-4 py-3">Rs.{parseFloat(m.input_gst || 0).toLocaleString()}</td>
                      <td className="px-4 py-3 font-semibold text-red-600">Rs.{parseFloat(m.net_gst_payable || 0).toLocaleString()}</td>
                      <td className="px-4 py-3"><span className={statusBadge(m.filing_status)}>{m.filing_status === 'filed' ? '✓ Filed' : (m.filing_status || 'Pending').charAt(0).toUpperCase() + (m.filing_status || 'Pending').slice(1)}</span></td>
                      <td className="px-4 py-3">
                        {isCA() ? (
                          <select className="input text-xs py-1 w-28" value={m.filing_status || 'pending'} onChange={e => updateStatusMutation.mutate({ month: m.month, year: m.year, status: e.target.value })} disabled={updateStatusMutation.isPending}>
                            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                          </select>
                        ) : <span className="text-xs text-gray-400">CA access only</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!summary.length && <p className="text-center text-gray-400 py-8">No GST data. Upload transactions first.</p>}
            </div>
          </div>

          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-4">GSTIN Verification</h3>
            <div className="flex gap-3 mb-4">
              <input className="input flex-1 max-w-xs" placeholder="Enter GSTIN (e.g. 27ABCDE1234F1Z5)" value={gstin} onChange={e => setGstin(e.target.value.toUpperCase())} maxLength={15} />
              <button onClick={verifyGstin} disabled={verifying} className="btn-primary flex items-center gap-2">{verifying ? <div className="spinner w-4 h-4" /> : <Search size={16} />}Verify</button>
            </div>
            {gstinResult && (
              <div className={`p-4 rounded-lg ${gstinResult.error ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
                {gstinResult.error ? <p className="text-red-700 text-sm">{gstinResult.error}</p> : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">{[['GSTIN', gstinResult.gstin], ['Business Name', gstinResult.business_name], ['Status', gstinResult.status], ['Type', gstinResult.business_type], ['State', gstinResult.state]].map(([k, v]) => (<div key={k}><p className="text-xs text-gray-500">{k}</p><p className="font-medium">{v}</p></div>))}</div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ─── TDS PAGE ─────────────────────────────────────────────────────────────────
export function TDSPage() {
  const { isCA } = useAuthStore()
  const [fy, setFy] = useState('2024-25')
  const [selectedClientId, setSelectedClientId] = useState(null)
  const { data: myProfile } = useQuery({ queryKey: ['my-profile'], queryFn: () => authAPI.myProfile().then(r => r.data), enabled: !isCA() })
  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: () => clientsAPI.list().then(r => r.data), enabled: isCA() })
  const clientId = isCA() ? selectedClientId : myProfile?.profile?.id
  const { data: summary = {} } = useQuery({
    queryKey: ['tds-summary', fy, clientId],
    queryFn: () => import('../services/api').then(m => m.tdsAPI.quarterlySummary({ financial_year: fy, client_id: clientId }).then(r => r.data)),
    enabled: !!clientId,
  })
  const quarters = [{ q: 1, label: 'Q1 (Apr-Jun)', due: '31 Jul' }, { q: 2, label: 'Q2 (Jul-Sep)', due: '31 Oct' }, { q: 3, label: 'Q3 (Oct-Dec)', due: '31 Jan' }, { q: 4, label: 'Q4 (Jan-Mar)', due: '31 May' }]
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div><h1 className="text-2xl font-bold text-gray-900">TDS Management</h1><p className="text-sm text-gray-500">Tax Deducted at Source</p></div>
        <div className="flex gap-3 flex-wrap">
          {isCA() && <ClientSelector clients={clients} selectedClientId={selectedClientId} onSelect={setSelectedClientId} />}
          <select className="input w-36" value={fy} onChange={e => setFy(e.target.value)}>{FY_OPTIONS.map(y => <option key={y}>{y}</option>)}</select>
        </div>
      </div>
      {isCA() && !clientId ? <div className="card p-10 text-center text-gray-400"><p>Select a client to view TDS data</p></div> : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {quarters.map(({ q, label, due }) => { const data = summary[q] || {}; return (<div key={q} className="card p-5"><p className="text-xs font-semibold text-gray-500 uppercase mb-1">{label}</p><p className="text-xs text-gray-400 mb-2">Due: {due}</p><p className="text-xl font-bold text-gray-900">Rs.{parseFloat(data.total_tds || 0).toLocaleString()}</p><p className="text-xs text-gray-500 mt-1">TDS deducted</p><span className={`mt-2 inline-block ${(data.records || []).length > 0 ? 'badge-success' : 'badge-warning'}`}>{(data.records || []).length > 0 ? `${(data.records || []).length} records` : 'No records'}</span></div>) })}
          </div>
          <div className="card p-5"><h3 className="font-semibold text-gray-900 mb-4">TDS Sections Reference (Income Tax Act 1961)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {[['192', 'Salaries', 'Slab rate', 'Basic exemption limit'], ['194A', 'Interest (Banks/Non-bank)', '10%', 'Rs.40,000/yr (Bank)'], ['194B', 'Lottery/Game winnings', '30%', 'Rs.10,000'], ['194C', 'Contractor payments', '1%/2%', 'Rs.30,000 single / Rs.1L aggregate'], ['194H', 'Commission/Brokerage', '5%', 'Rs.15,000'], ['194I', 'Rent (P&M/Land & Building)', '2%/10%', 'Rs.2,40,000/yr'], ['194J', 'Professional/Technical fees', '2%/10%', 'Rs.30,000'], ['194Q', 'Purchase of goods', '0.1%', 'Rs.50L turnover buyer'], ['195', 'Payments to Non-residents', 'DTAA rates', 'Any amount']].map(([sec, desc, rate, thresh]) => (
                <div key={sec} className="border border-gray-200 rounded-lg p-3"><div className="flex items-center justify-between mb-1"><span className="font-semibold text-primary-700">Sec {sec}</span><span className="badge-info text-xs">{rate}</span></div><p className="text-sm text-gray-600">{desc}</p><p className="text-xs text-gray-400 mt-1">Threshold: {thresh}</p></div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── ITR PAGE ─────────────────────────────────────────────────────────────────
export function ITRPage() {
  const { isCA } = useAuthStore()
  const [fy, setFy] = useState('2024-25')
  const [selectedClientId, setSelectedClientId] = useState(null)
  const { data: myProfile } = useQuery({ queryKey: ['my-profile'], queryFn: () => authAPI.myProfile().then(r => r.data), enabled: !isCA() })
  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: () => clientsAPI.list().then(r => r.data), enabled: isCA() })
  const clientId = isCA() ? selectedClientId : myProfile?.profile?.id
  const { data: itr, isLoading } = useQuery({
    queryKey: ['itr', fy, clientId],
    queryFn: () => import('../services/api').then(m => m.itrAPI.summary({ financial_year: fy, client_id: clientId }).then(r => r.data)),
    enabled: !!clientId,
  })
  const safe = v => parseFloat(v || 0)
  const cess = safe(itr?.tax_liability) * 0.04
  const rows = itr ? [
    { label: 'Gross Total Income (GTI)', value: itr.gross_income, color: 'text-gray-900 font-semibold' },
    { label: 'Less: Deductions u/s 80C (PPF, LIC, ELSS, EPF, NSC)', value: itr.deductions_80c || 0, color: 'text-green-700' },
    { label: 'Less: Deductions u/s 80D (Medical Insurance Premium)', value: itr.deductions_80d || 0, color: 'text-green-700' },
    { label: 'Less: Other Chapter VI-A Deductions (80G, 80E, 80TTA)', value: itr.other_deductions || 0, color: 'text-green-700' },
    { label: 'Total Deductions (Chapter VI-A)', value: itr.total_deductions, color: 'text-green-700 font-semibold border-t border-gray-200 pt-1' },
    { label: 'Net Taxable Income', value: itr.taxable_income, color: 'text-gray-900 font-bold' },
    { label: 'Income Tax at Applicable Slab Rates', value: itr.tax_liability, color: 'text-red-600' },
    { label: 'Add: Health & Education Cess @4%', value: cess, color: 'text-red-600' },
    { label: 'Total Tax Liability (after cess)', value: safe(itr.tax_liability) + cess, color: 'text-red-600 font-semibold' },
    { label: 'Less: TDS Deducted at Source', value: itr.tds_paid, color: 'text-green-700' },
    { label: 'Less: Advance Tax Paid', value: itr.advance_tax || 0, color: 'text-green-700' },
    { label: 'Less: Self-Assessment Tax Paid', value: itr.self_assessment_tax || 0, color: 'text-green-700' },
    { label: 'Net Tax Payable / (Refund Due)', value: itr.net_tax_payable, color: safe(itr.net_tax_payable) >= 0 ? 'text-red-600 font-bold text-lg' : 'text-green-600 font-bold text-lg' },
  ] : []

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div><h1 className="text-2xl font-bold text-gray-900">ITR Preparation</h1><p className="text-sm text-gray-500">Income Tax Return — Income Tax Act 1961</p></div>
        <div className="flex gap-3 flex-wrap">
          {isCA() && <ClientSelector clients={clients} selectedClientId={selectedClientId} onSelect={setSelectedClientId} />}
          <select className="input w-36" value={fy} onChange={e => setFy(e.target.value)}>{FY_OPTIONS.map(y => <option key={y}>{y}</option>)}</select>
        </div>
      </div>
      {isCA() && !clientId ? <div className="card p-10 text-center text-gray-400"><p>Select a client to view ITR data</p></div> : isLoading ? <div className="flex justify-center py-20"><div className="spinner w-8 h-8" /></div> : itr ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card p-5 text-center"><p className="text-sm text-gray-500">Assessment Year</p><p className="text-xl font-bold mt-1">{itr.assessment_year}</p></div>
            <div className="card p-5 text-center"><p className="text-sm text-gray-500">ITR Form</p><p className="text-xl font-bold mt-1">ITR-4 Sugam</p><p className="text-xs text-gray-400">Sec 44AD/44ADA Presumptive</p></div>
            <div className="card p-5 text-center"><p className="text-sm text-gray-500">Status</p><span className="badge-warning mt-1 inline-block">Draft — Pending CA Review</span></div>
          </div>
          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 mb-1">ITR Computation Sheet</h3><p className="text-xs text-gray-400 mb-4">FY {fy} | New Tax Regime u/s 115BAC</p>
            <div className="space-y-2">{rows.map(({ label, value, color }) => (<div key={label} className={`flex justify-between items-center py-2 border-b border-gray-100 last:border-0 ${color}`}><span className="text-sm text-gray-600">{label}</span><span className={`text-sm ${color}`}>Rs.{parseFloat(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>))}</div>
          </div>
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-3">New Tax Regime Slabs (Sec 115BAC) — FY 2024-25</h3>
            <table className="w-full text-sm"><thead><tr className="bg-gray-50">{['Income Slab', 'Rate', 'Max Tax'].map(h => <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-gray-500">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-gray-100">{[['Up to Rs.3,00,000', 'Nil', 'Nil'], ['Rs.3,00,001 - Rs.6,00,000', '5%', 'Rs.15,000'], ['Rs.6,00,001 - Rs.9,00,000', '10%', 'Rs.30,000'], ['Rs.9,00,001 - Rs.12,00,000', '15%', 'Rs.45,000'], ['Rs.12,00,001 - Rs.15,00,000', '20%', 'Rs.60,000'], ['Above Rs.15,00,000', '30%', '30% on excess']].map(([slab, rate, tax]) => <tr key={slab} className="hover:bg-gray-50"><td className="px-4 py-2">{slab}</td><td className="px-4 py-2 font-semibold">{rate}</td><td className="px-4 py-2 text-gray-500">{tax}</td></tr>)}</tbody>
            </table>
            <p className="text-xs text-gray-400 mt-3">Rebate u/s 87A: Tax fully rebated if net income does not exceed Rs.7,00,000 (New Regime). Add 4% H&E Cess on computed tax.</p>
          </div>
        </>
      ) : <div className="card p-10 text-center text-gray-400"><p>No ITR data. Upload transactions first.</p></div>}
    </div>
  )
}

// ─── BOOKKEEPING PAGE ─────────────────────────────────────────────────────────
export function BookkeepingPage() {
  const { isCA } = useAuthStore()
  const [fy, setFy] = useState('2024-25')
  const [selectedClientId, setSelectedClientId] = useState(null)
  const { data: myProfile } = useQuery({ queryKey: ['my-profile'], queryFn: () => authAPI.myProfile().then(r => r.data), enabled: !isCA() })
  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: () => clientsAPI.list().then(r => r.data), enabled: isCA() })
  const clientId = isCA() ? selectedClientId : myProfile?.profile?.id
  const { data: trial } = useQuery({ queryKey: ['trial-balance', fy, clientId], queryFn: () => import('../services/api').then(m => m.bookkeepingAPI.trialBalance({ financial_year: fy, client_id: clientId }).then(r => r.data)), enabled: !!clientId })
  const { data: coa } = useQuery({ queryKey: ['chart-of-accounts'], queryFn: () => import('../services/api').then(m => m.bookkeepingAPI.chartOfAccounts().then(r => r.data)) })
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div><h1 className="text-2xl font-bold text-gray-900">Bookkeeping</h1><p className="text-sm text-gray-500">Journal entries, ledger & trial balance</p></div>
        <div className="flex gap-3 flex-wrap">
          {isCA() && <ClientSelector clients={clients} selectedClientId={selectedClientId} onSelect={setSelectedClientId} />}
          <select className="input w-36" value={fy} onChange={e => setFy(e.target.value)}>{FY_OPTIONS.map(y => <option key={y}>{y}</option>)}</select>
        </div>
      </div>
      {isCA() && !clientId ? <div className="card p-10 text-center text-gray-400"><p>Select a client to view bookkeeping data</p></div> : trial && (
        <div className="card">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between"><h3 className="font-semibold text-gray-900">Trial Balance - FY {fy}</h3><span className={trial.is_balanced ? 'badge-success' : 'badge-danger'}>{trial.is_balanced ? 'Balanced' : 'Mismatch'}</span></div>
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="bg-gray-50">{['Code', 'Account Name', 'Debit (Rs.)', 'Credit (Rs.)', 'Balance'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-100">{(trial.entries || []).map((e, i) => (<tr key={i} className="hover:bg-gray-50"><td className="px-4 py-3 font-mono text-xs">{e.account_code}</td><td className="px-4 py-3">{e.account_name}</td><td className="px-4 py-3">Rs.{parseFloat(e.debit_total || 0).toLocaleString()}</td><td className="px-4 py-3">Rs.{parseFloat(e.credit_total || 0).toLocaleString()}</td><td className={`px-4 py-3 font-semibold ${parseFloat(e.balance || 0) >= 0 ? 'text-blue-600' : 'text-red-600'}`}>Rs.{Math.abs(parseFloat(e.balance || 0)).toLocaleString()} {parseFloat(e.balance || 0) >= 0 ? 'Dr' : 'Cr'}</td></tr>))}
              <tr className="bg-gray-50 font-semibold"><td className="px-4 py-3" colSpan={2}>TOTAL</td><td className="px-4 py-3">Rs.{parseFloat(trial.total_debit || 0).toLocaleString()}</td><td className="px-4 py-3">Rs.{parseFloat(trial.total_credit || 0).toLocaleString()}</td><td /></tr>
            </tbody></table>
            {!trial.entries?.length && <p className="text-center text-gray-400 py-8">No entries yet.</p>}
          </div>
        </div>
      )}
      {coa && <div className="card p-5"><h3 className="font-semibold text-gray-900 mb-4">Chart of Accounts</h3><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{Object.entries(coa).map(([group, accounts]) => (<div key={group}><p className="text-xs font-semibold text-gray-500 uppercase mb-2">{group}</p><div className="space-y-1">{accounts.map(a => <div key={a.code} className="flex gap-3 py-1 border-b border-gray-100 text-sm"><span className="font-mono text-xs text-gray-400 w-10">{a.code}</span><span className="text-gray-700">{a.name}</span></div>)}</div></div>))}</div></div>}
    </div>
  )
}

// ─── REPORTS PAGE — ICAI FORMAT ───────────────────────────────────────────────
export function ReportsPage() {
  const { isCA } = useAuthStore()
  const [fy, setFy] = useState('2024-25')
  const [tab, setTab] = useState('manufacturing')
  const [selectedClientId, setSelectedClientId] = useState(null)
  const { data: myProfile } = useQuery({ queryKey: ['my-profile'], queryFn: () => authAPI.myProfile().then(r => r.data), enabled: !isCA() })
  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: () => clientsAPI.list().then(r => r.data), enabled: isCA() })
  const clientId = isCA() ? selectedClientId : myProfile?.profile?.id
  const { data: pl } = useQuery({ queryKey: ['profit-loss', fy, clientId], queryFn: () => import('../services/api').then(m => m.reportsAPI.profitLoss({ financial_year: fy, client_id: clientId }).then(r => r.data)), enabled: !!clientId })
  const { data: bs } = useQuery({ queryKey: ['balance-sheet', fy, clientId], queryFn: () => import('../services/api').then(m => m.reportsAPI.balanceSheet({ financial_year: fy, client_id: clientId }).then(r => r.data)), enabled: !!clientId && tab === 'bs' })

  const safe = v => parseFloat(v || 0)
  const fmt = v => safe(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })

  const fyYear = fy.split('-')[1] ? (fy.split('-')[1].length === 2 ? '20' + fy.split('-')[1] : fy.split('-')[1]) : '2025'

  const pl_data = pl || {}
  const inc = pl_data.income || {}
  const cogs = pl_data.cost_of_goods || {}
  const exp = pl_data.expenses || {}
  const rawMaterial = safe(cogs['Raw Material Consumed']) || safe(cogs['Purchases'])
  const directLabour = safe(exp['Direct Labour'])
  const factoryOverhead = safe(exp['Factory Overhead'])
  const openingWIP = safe(cogs['Opening WIP'])
  const closingWIP = safe(cogs['Closing WIP'])
  const costOfProduction = rawMaterial + directLabour + factoryOverhead + openingWIP - closingWIP
  const openingStock = safe(cogs['Opening Stock'])
  const closingStock = safe(cogs['Closing Stock'])
  const grossProfit = safe(pl_data.gross_profit)
  const netProfit = safe(pl_data.net_profit)
  const totalSales = safe(inc['Sales Revenue']) + safe(inc['Other Operating Income'])
  const totalIncome = Object.values(inc).reduce((a, v) => a + safe(v), 0)
  const totalExp = Object.values(exp).reduce((a, v) => a + safe(v), 0)

  const Row = ({ l1, a1, l2, a2, bold, head }) => (
    head ? <tr><td colSpan={4} className="bg-slate-700 text-white text-xs font-bold px-3 py-1.5 uppercase tracking-wider">{l1}</td></tr> :
    <tr className={bold ? 'bg-gray-50 font-bold' : 'hover:bg-gray-50'}>
      <td className="px-3 py-1.5 text-sm border-b border-gray-100">{l1}</td>
      <td className="px-3 py-1.5 text-sm border-b border-gray-100 text-right">{a1 !== undefined && a1 !== null ? `Rs.${fmt(a1)}` : ''}</td>
      <td className="px-3 py-1.5 text-sm border-b border-gray-100 border-l border-gray-200 pl-3">{l2}</td>
      <td className="px-3 py-1.5 text-sm border-b border-gray-100 text-right pr-3">{a2 !== undefined && a2 !== null ? `Rs.${fmt(a2)}` : ''}</td>
    </tr>
  )

  const TableHead = ({ title, year }) => (
    <>
      <div className="px-5 py-3 bg-slate-900 text-white text-center"><p className="font-bold text-base">{title}</p><p className="text-xs text-slate-300 mt-0.5">For the year ended 31st March, {year}</p></div>
      <table className="w-full">
        <thead><tr className="bg-gray-100 text-xs font-bold text-gray-600"><th className="px-3 py-2 text-left w-5/12">Dr — Particulars</th><th className="px-3 py-2 text-right w-2/12">Rs.</th><th className="px-3 py-2 text-left border-l border-gray-200 pl-3 w-5/12">Cr — Particulars</th><th className="px-3 py-2 text-right w-2/12 pr-3">Rs.</th></tr></thead>
      </table>
    </>
  )

  const tabs = [['manufacturing', 'Manufacturing A/c'], ['trading', 'Trading A/c'], ['pl', 'P&L Account'], ['bs', 'Balance Sheet']]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div><h1 className="text-2xl font-bold text-gray-900">Financial Reports</h1><p className="text-sm text-gray-500">ICAI Standard Format — Manufacturing, Trading, P&L & Balance Sheet</p></div>
        <div className="flex gap-3 flex-wrap">
          {isCA() && <ClientSelector clients={clients} selectedClientId={selectedClientId} onSelect={setSelectedClientId} />}
          <select className="input w-36" value={fy} onChange={e => setFy(e.target.value)}>{FY_OPTIONS.map(y => <option key={y}>{y}</option>)}</select>
        </div>
      </div>

      {isCA() && !clientId ? <div className="card p-10 text-center text-gray-400"><p>Select a client to view reports</p></div> : (
        <>
          <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
            {tabs.map(([v, l]) => <button key={v} onClick={() => setTab(v)} className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-all ${tab === v ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-primary-50 hover:text-primary-600'}`}>{l}</button>)}
          </div>

          {tab === 'manufacturing' && (
            <div className="card overflow-hidden">
              <TableHead title="MANUFACTURING ACCOUNT" year={fyYear} />
              <table className="w-full">
                <tbody>
                  <Row head l1="Opening Balances & Raw Material" />
                  <Row l1="Opening Stock of Raw Material" a1={safe(cogs['Opening Stock of Raw Material'])} l2="Closing Stock of Raw Material" a2={safe(cogs['Closing Stock of Raw Material'])} />
                  <Row l1="Add: Purchases of Raw Material" a1={safe(cogs['Raw Material Purchases'])} l2="Closing WIP (Work-in-Progress)" a2={closingWIP} />
                  <Row l1="Less: Closing Stock of Raw Material" a1={safe(cogs['Closing Stock of Raw Material'])} l2="" a2={null} />
                  <Row l1="Raw Material Consumed" a1={rawMaterial} l2="" a2={null} bold />
                  <Row l1="Opening WIP" a1={openingWIP} l2="" a2={null} />
                  <Row head l1="Direct Manufacturing Costs" />
                  <Row l1="Direct Labour / Wages" a1={directLabour} l2="" a2={null} />
                  <Row l1="Factory Overhead" a1={factoryOverhead} l2="" a2={null} />
                  <Row l1="Power & Fuel" a1={safe(exp['Power & Fuel'])} l2="" a2={null} />
                  <Row l1="Carriage Inward" a1={safe(exp['Carriage Inward'])} l2="" a2={null} />
                  <Row l1="Packing Materials" a1={safe(exp['Packing Materials'])} l2="" a2={null} />
                  <Row l1="Repairs & Maintenance (Factory)" a1={safe(exp['Repairs & Maintenance'])} l2="" a2={null} />
                  <Row l1="Depreciation on Factory Assets" a1={safe(exp['Depreciation (Factory)'])} l2="" a2={null} />
                  <Row l1="Other Manufacturing Expenses" a1={safe(exp['Other Manufacturing Expenses'])} l2="" a2={null} />
                  <Row l1="Cost of Production c/d" a1={costOfProduction || 0} l2="Cost of Production b/d" a2={costOfProduction || 0} bold />
                </tbody>
              </table>
            </div>
          )}

          {tab === 'trading' && (
            <div className="card overflow-hidden">
              <TableHead title="TRADING ACCOUNT" year={fyYear} />
              <table className="w-full">
                <tbody>
                  <Row head l1="Stock & Cost of Goods" />
                  <Row l1="Opening Stock of Finished Goods" a1={openingStock} l2="Sales (Gross)" a2={safe(inc['Sales Revenue'])} />
                  <Row l1="Cost of Production b/d" a1={costOfProduction || 0} l2="Less: Sales Returns" a2={safe(cogs['Sales Returns'])} />
                  <Row l1="Add: Purchases (Trading Goods)" a1={safe(cogs['Purchases'])} l2="Net Sales" a2={totalSales} bold />
                  <Row l1="Less: Purchase Returns" a1={safe(cogs['Purchase Returns'])} l2="Other Operating Income" a2={safe(inc['Other Operating Income'])} />
                  <Row l1="Carriage Outward" a1={safe(exp['Carriage Outward'])} l2="Closing Stock of Finished Goods" a2={closingStock} />
                  <Row l1="Custom Duty / Import Duty" a1={safe(exp['Custom Duty'])} l2="" a2={null} />
                  <Row l1="Octroi & Entry Tax" a1={safe(exp['Octroi'])} l2="" a2={null} />
                  <Row l1={grossProfit >= 0 ? 'Gross Profit c/d' : 'Gross Loss c/d'} a1={Math.abs(grossProfit)} l2={grossProfit < 0 ? 'Gross Loss b/d' : 'Gross Profit b/d'} a2={Math.abs(grossProfit)} bold />
                </tbody>
              </table>
            </div>
          )}

          {tab === 'pl' && pl && (
            <div className="card overflow-hidden">
              <TableHead title="PROFIT & LOSS ACCOUNT" year={fyYear} />
              <table className="w-full">
                <tbody>
                  <Row head l1="Indirect Expenses" />
                  <Row l1={grossProfit < 0 ? 'Gross Loss b/d' : ''} a1={grossProfit < 0 ? Math.abs(grossProfit) : null} l2={grossProfit >= 0 ? 'Gross Profit b/d' : ''} a2={grossProfit >= 0 ? grossProfit : null} />
                  <Row l1="Salaries & Wages" a1={safe(exp['Salaries'])} l2="Commission Received" a2={safe(inc['Commission Income'])} />
                  <Row l1="Rent, Rates & Taxes" a1={safe(exp['Rent'])} l2="Discount Received" a2={safe(inc['Discount Received'])} />
                  <Row l1="Office Electricity & Water" a1={safe(exp['Utilities'])} l2="Interest Received" a2={safe(inc['Interest Income'])} />
                  <Row l1="Printing & Stationery" a1={safe(exp['Printing & Stationery'])} l2="Rent Received" a2={safe(inc['Rental Income'])} />
                  <Row l1="Postage & Courier" a1={safe(exp['Postage'])} l2="Dividend Received" a2={safe(inc['Dividend Income'])} />
                  <Row l1="Telephone & Internet" a1={safe(exp['Telephone'])} l2="Profit on Sale of Fixed Asset" a2={safe(inc['Profit on Sale of Assets'])} />
                  <Row l1="Travelling & Conveyance" a1={safe(exp['Travelling'])} l2="Miscellaneous Income" a2={safe(inc['Other Income'])} />
                  <Row l1="Advertisement & Marketing" a1={safe(exp['Advertisement'])} l2="" a2={null} />
                  <Row l1="Professional / Legal Fees" a1={safe(exp['Professional Fees'])} l2="" a2={null} />
                  <Row l1="Audit Fees" a1={safe(exp['Audit Fees'])} l2="" a2={null} />
                  <Row l1="Bank Charges & Commission" a1={safe(exp['Bank Charges'])} l2="" a2={null} />
                  <Row l1="Interest on Loan / OD / CC" a1={safe(exp['Interest on OD']) + safe(exp['Interest Expense'])} l2="" a2={null} />
                  <Row l1="Depreciation (Office / Non-factory)" a1={safe(exp['Depreciation'])} l2="" a2={null} />
                  <Row l1="Bad Debts Written Off" a1={safe(exp['Bad Debts'])} l2="" a2={null} />
                  <Row l1="Provision for Bad & Doubtful Debts" a1={safe(exp['Provision Bad Debts'])} l2="" a2={null} />
                  <Row l1="Discount Allowed to Customers" a1={safe(exp['Discount Allowed'])} l2="" a2={null} />
                  <Row l1="Insurance Premium" a1={safe(exp['Insurance'])} l2="" a2={null} />
                  <Row l1="Staff Welfare Expenses" a1={safe(exp['Staff Welfare'])} l2="" a2={null} />
                  <Row l1="GST Late Fees & Penalty" a1={safe(exp['GST Late Fees'])} l2="" a2={null} />
                  <Row l1="Miscellaneous Expenses" a1={safe(exp['Miscellaneous'])} l2="" a2={null} />
                  <Row l1={netProfit >= 0 ? 'Net Profit transferred to Capital A/c' : ''} a1={netProfit >= 0 ? netProfit : null} l2={netProfit < 0 ? 'Net Loss transferred to Capital A/c' : ''} a2={netProfit < 0 ? Math.abs(netProfit) : null} bold />
                  <Row l1="TOTAL" a1={totalExp + (grossProfit >= 0 ? 0 : Math.abs(grossProfit))} l2="TOTAL" a2={totalIncome + (grossProfit >= 0 ? grossProfit : 0)} bold />
                </tbody>
              </table>
              <div className={`px-5 py-2 flex justify-between text-sm font-semibold border-t ${netProfit >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                <span>Net Profit Margin</span><span>{parseFloat(pl.net_profit_margin || 0).toFixed(2)}%</span>
              </div>
            </div>
          )}

          {tab === 'bs' && bs && (
            <div className="card overflow-hidden">
              <div className="px-5 py-3 bg-slate-900 text-white text-center"><p className="font-bold text-base">BALANCE SHEET</p><p className="text-xs text-slate-300 mt-0.5">As at 31st March, {fyYear}</p></div>
              <table className="w-full">
                <thead><tr className="bg-gray-100 text-xs font-bold text-gray-600"><th className="px-3 py-2 text-left w-5/12">Liabilities & Capital</th><th className="px-3 py-2 text-right w-2/12">Rs.</th><th className="px-3 py-2 text-left border-l border-gray-200 pl-3 w-5/12">Assets</th><th className="px-3 py-2 text-right w-2/12 pr-3">Rs.</th></tr></thead>
                <tbody>
                  <Row head l1="Capital & Reserves" />
                  <Row l1="Capital Account (Opening)" a1={safe(bs.capital?.['Owner Capital'])} l2="Fixed Assets (Gross Block)" a2={safe(bs.assets?.fixed?.['Plant & Machinery']) + safe(bs.assets?.fixed?.['Land & Building']) + safe(bs.assets?.fixed?.['Furniture']) + safe(bs.assets?.fixed?.['Vehicles'])} />
                  <Row l1="Add: Net Profit for the Year" a1={netProfit > 0 ? netProfit : 0} l2="Less: Accumulated Depreciation" a2={safe(bs.assets?.fixed?.['Accumulated Depreciation'])} />
                  <Row l1="Less: Drawings" a1={safe(bs.capital?.['Drawings'])} l2="Net Fixed Assets" a2={safe(bs.assets?.total_fixed)} bold />
                  <Row l1="Reserves & Surplus" a1={safe(bs.capital?.['Reserves'])} l2="Capital Work-in-Progress (CWIP)" a2={safe(bs.assets?.fixed?.['CWIP'])} />
                  <Row l1="Share Capital" a1={safe(bs.capital?.['Share Capital'])} l2="Intangible Assets (Goodwill etc.)" a2={safe(bs.assets?.fixed?.['Intangibles'])} />
                  <Row head l1="Long-term Liabilities" />
                  <Row l1="Secured Term Loans (Banks)" a1={safe(bs.liabilities?.long_term?.['Secured Loans'])} l2="Long-term Investments" a2={safe(bs.assets?.current?.['Long Term Investments'])} />
                  <Row l1="Unsecured Loans" a1={safe(bs.liabilities?.long_term?.['Unsecured Loans'])} l2="" a2={null} />
                  <Row l1="Debentures" a1={safe(bs.liabilities?.long_term?.['Debentures'])} l2="" a2={null} />
                  <Row l1="Loans from Directors / Partners" a1={safe(bs.liabilities?.long_term?.['Director Loans'])} l2="" a2={null} />
                  <Row head l1="Current Liabilities & Provisions" />
                  <Row l1="Sundry Creditors (Accounts Payable)" a1={safe(bs.liabilities?.current?.['Accounts Payable'])} l2="Current Assets" a2={null} />
                  <Row l1="Bills Payable" a1={safe(bs.liabilities?.current?.['Bills Payable'])} l2="Closing Stock" a2={closingStock} />
                  <Row l1="Bank Overdraft / CC Account" a1={safe(bs.liabilities?.current?.['Bank OD'])} l2="Sundry Debtors (Accounts Receivable)" a2={safe(bs.assets?.current?.['Accounts Receivable'])} />
                  <Row l1="Advance from Customers" a1={safe(bs.liabilities?.current?.['Advance from Customers'])} l2="Bills Receivable" a2={safe(bs.assets?.current?.['Bills Receivable'])} />
                  <Row l1="Outstanding Expenses" a1={safe(bs.liabilities?.current?.['Outstanding Expenses'])} l2="Prepaid Expenses" a2={safe(bs.assets?.current?.['Prepaid Expenses'])} />
                  <Row l1="GST Payable (CGST+SGST+IGST)" a1={safe(bs.liabilities?.current?.['GST Payable'])} l2="Advance Tax / TDS Receivable" a2={safe(bs.assets?.current?.['TDS Receivable'])} />
                  <Row l1="TDS Payable" a1={safe(bs.liabilities?.current?.['TDS Payable'])} l2="Accrued Income" a2={safe(bs.assets?.current?.['Accrued Income'])} />
                  <Row l1="Salaries & Wages Payable" a1={safe(bs.liabilities?.current?.['Salary Payable'])} l2="Cash in Hand" a2={safe(bs.assets?.current?.['Cash'])} />
                  <Row l1="Income Tax Payable" a1={safe(bs.liabilities?.current?.['Tax Payable'])} l2="Bank Balance" a2={safe(bs.assets?.current?.['Bank Account'])} />
                  <Row l1="Provision for Taxation" a1={safe(bs.liabilities?.current?.['Provision Tax'])} l2="Short-term Investments / FDs" a2={safe(bs.assets?.current?.['Short Term Investments'])} />
                  <Row l1="Proposed Dividend" a1={safe(bs.liabilities?.current?.['Dividend Payable'])} l2="Loans & Advances (Given)" a2={safe(bs.assets?.current?.['Loans Given'])} />
                  <Row l1="TOTAL" a1={safe(bs.total_liabilities_capital)} l2="TOTAL" a2={safe(bs.assets?.total_assets)} bold />
                </tbody>
              </table>
              <div className={`px-5 py-2 text-center text-sm font-semibold border-t ${bs.is_balanced ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{bs.is_balanced ? 'Balance Sheet Balanced — Assets = Liabilities + Capital' : 'Balance Sheet DOES NOT balance — check entries'}</div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── CLIENTS PAGE ─────────────────────────────────────────────────────────────
export function ClientsPage() {
  const { data: clients = [], isLoading } = useQuery({ queryKey: ['clients'], queryFn: () => import('../services/api').then(m => m.clientsAPI.list().then(r => r.data)) })
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Client Management</h1>
      <div className="card">{isLoading ? <div className="flex justify-center py-16"><div className="spinner w-8 h-8" /></div> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="bg-gray-50">{['Business Name', 'PAN', 'GSTIN', 'Type', 'State', 'FY', 'Status'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr></thead><tbody className="divide-y divide-gray-100">{clients.map(c => <tr key={c.id} className="hover:bg-gray-50"><td className="px-4 py-3 font-medium">{c.business_name}</td><td className="px-4 py-3 font-mono text-xs">{c.pan}</td><td className="px-4 py-3 font-mono text-xs">{c.gstin || '-'}</td><td className="px-4 py-3">{c.business_type}</td><td className="px-4 py-3">{c.state || '-'}</td><td className="px-4 py-3">{c.current_fy}</td><td className="px-4 py-3"><span className={c.is_active ? 'badge-success' : 'badge-danger'}>{c.is_active ? 'Active' : 'Inactive'}</span></td></tr>)}</tbody></table>{!clients.length && <p className="text-center text-gray-400 py-8">No clients yet</p>}</div>}</div>
    </div>
  )
}

// ─── ADMIN PAGE ───────────────────────────────────────────────────────────────
export function AdminPage() {
  const { data: stats } = useQuery({ queryKey: ['admin-stats'], queryFn: () => import('../services/api').then(m => m.adminAPI.stats().then(r => r.data)) })
  const { data: users = [] } = useQuery({ queryKey: ['admin-users'], queryFn: () => import('../services/api').then(m => m.adminAPI.users().then(r => r.data)) })
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
      {stats && <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[['Total Clients', stats.total_clients], ['Active Clients', stats.active_clients], ['Total Documents', stats.total_documents], ['Pending OCR', stats.pending_documents]].map(([l, v]) => <div key={l} className="card p-4"><p className="text-sm text-gray-500">{l}</p><p className="text-2xl font-bold mt-1">{v ?? '-'}</p></div>)}</div>}
      <div className="card"><div className="px-5 py-4 border-b border-gray-100"><h3 className="font-semibold text-gray-900">All Users</h3></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="bg-gray-50">{['ID', 'Name', 'Email', 'Role', 'Status'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr></thead><tbody className="divide-y divide-gray-100">{users.map(u => <tr key={u.id} className="hover:bg-gray-50"><td className="px-4 py-3 text-gray-500">#{u.id}</td><td className="px-4 py-3 font-medium">{u.full_name}</td><td className="px-4 py-3">{u.email}</td><td className="px-4 py-3"><span className="badge-info capitalize">{u.role}</span></td><td className="px-4 py-3"><span className={u.is_active ? 'badge-success' : 'badge-danger'}>{u.is_active ? 'Active' : 'Inactive'}</span></td></tr>)}</tbody></table></div></div>
    </div>
  )
}

// ─── AI CHATBOT PAGE — Issue 9 Fixed (backend proxy, no CORS) ─────────────────
export function ChatbotPage() {
  const [messages, setMessages] = useState([{ role: 'assistant', content: 'Hello! I am your AI CA Assistant. Ask me anything about GST, TDS, ITR, ICAI accounting standards, or Indian tax compliance.' }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const endRef = React.useRef(null)
  React.useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const sendMessage = async () => {
    if (!input.trim() || loading) return
    const userMsg = { role: 'user', content: input }
    const updated = [...messages, userMsg]
    setMessages(updated)
    setInput('')
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/v1/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ messages: updated.map(m => ({ role: m.role, content: m.content })) })
      })
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || `HTTP ${res.status}`) }
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}. Ensure ANTHROPIC_API_KEY is configured in server environment.` }])
    }
    setLoading(false)
  }

  const quick = ['What is the GST filing deadline for GSTR-3B?', 'Explain TDS under Section 194C', 'What ITR form for business income?', 'How is depreciation calculated as per Companies Act?', 'What deductions under 80C?', 'Difference between CGST, SGST and IGST?']

  return (
    <div className="p-6 flex flex-col" style={{ height: 'calc(100vh - 80px)' }}>
      <div className="mb-4"><h1 className="text-2xl font-bold text-gray-900">AI CA Assistant</h1><p className="text-sm text-gray-500">Powered by Claude - Ask about GST, TDS, ITR, ICAI standards, Indian tax law</p></div>
      {messages.length === 1 && <div className="mb-4 grid grid-cols-2 md:grid-cols-3 gap-2">{quick.map(q => <button key={q} onClick={() => setInput(q)} className="text-left text-xs p-2.5 border border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 text-gray-600">{q}</button>)}</div>}
      <div className="card flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.map((m, i) => <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>{m.role === 'assistant' && <div className="w-7 h-7 bg-primary-600 rounded-full flex items-center justify-center text-white text-xs font-bold mr-2 flex-shrink-0 mt-1">AI</div>}<div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-800'}`}>{m.content}</div></div>)}
          {loading && <div className="flex justify-start"><div className="w-7 h-7 bg-primary-600 rounded-full flex items-center justify-center text-white text-xs font-bold mr-2 flex-shrink-0">AI</div><div className="bg-gray-100 rounded-2xl px-4 py-3"><div className="flex gap-1">{[0,1,2].map(i=><div key={i} className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay:`${i*150}ms`}}/>)}</div></div></div>}
          <div ref={endRef} />
        </div>
        <div className="border-t border-gray-100 p-4 flex gap-3">
          <input className="input flex-1" placeholder="Ask about GST, TDS, ITR, accounting standards..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()} />
          <button onClick={sendMessage} disabled={loading || !input.trim()} className="btn-primary px-5">Send</button>
        </div>
      </div>
    </div>
  )
}

// ─── PROFILE PAGE ─────────────────────────────────────────────────────────────
export function ProfilePage() {
  const { user } = useAuthStore()
  return (
    <div className="p-6 space-y-6"><h1 className="text-2xl font-bold text-gray-900">Profile</h1>
      <div className="card p-6 max-w-lg"><div className="flex items-center gap-4 mb-6"><div className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">{user?.full_name?.[0]}</div><div><p className="text-lg font-semibold">{user?.full_name}</p><p className="text-sm text-gray-500 capitalize">{user?.role}</p></div></div>
        <div className="space-y-3">{[['Email', user?.email], ['Role', user?.role], ['Status', 'Active']].map(([k, v]) => <div key={k} className="flex justify-between py-2 border-b border-gray-100 text-sm"><span className="text-gray-500">{k}</span><span className="font-medium capitalize">{v}</span></div>)}</div>
      </div>
    </div>
  )
}
