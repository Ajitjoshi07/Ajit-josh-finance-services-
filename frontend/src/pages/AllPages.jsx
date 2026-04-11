// ─── GST PAGE ────────────────────────────────────────────────────────────────
import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { gstAPI } from '../services/api'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { CheckCircle, Clock, Search } from 'lucide-react'

const MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar']

export function GSTPage() {
  const [fy, setFy] = useState('2024-25')
  const [gstin, setGstin] = useState('')
  const [gstinResult, setGstinResult] = useState(null)
  const [verifying, setVerifying] = useState(false)

  const { data: summary = [], isLoading } = useQuery({
    queryKey: ['gst-summary', fy],
    queryFn: () => gstAPI.summary({ financial_year: fy }).then(r => r.data),
  })

  const chartData = summary.map((m, i) => ({
    month: MONTHS[i],
    'Output GST': parseFloat(m.output_gst || 0),
    'Input GST':  parseFloat(m.input_gst || 0),
    'Net Payable': parseFloat(m.net_gst_payable || 0),
  }))

  const totalPayable = summary.reduce((s, m) => s + parseFloat(m.net_gst_payable || 0), 0)

  const verifyGstin = async () => {
    if (!gstin.trim()) return
    setVerifying(true)
    try {
      const { data } = await gstAPI.verifyGstin(gstin.trim())
      setGstinResult(data)
    } catch { setGstinResult({ error: 'Verification failed' }) }
    setVerifying(false)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">GST Filing</h1>
          <p className="text-sm text-gray-500 mt-1">GSTR-1 & GSTR-3B management</p>
        </div>
        <select className="input w-36" value={fy} onChange={e => setFy(e.target.value)}>
          {['2024-25','2023-24','2022-23'].map(y => <option key={y}>{y}</option>)}
        </select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5">
          <p className="text-sm text-gray-500">Total Net GST Payable</p>
          <p className="text-2xl font-bold text-red-600 mt-1">₹{totalPayable.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">For FY {fy}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500">Months Filed</p>
          <p className="text-2xl font-bold text-green-600 mt-1">
            {summary.filter(m => m.filing_status === 'filed').length}/12
          </p>
          <p className="text-xs text-gray-400 mt-1">GSTR-3B submissions</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500">Pending Months</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">
            {summary.filter(m => m.filing_status !== 'filed').length}
          </p>
          <p className="text-xs text-gray-400 mt-1">Require action</p>
        </div>
      </div>

      {/* Chart */}
      <div className="card p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Monthly GST Breakdown</h3>
        {isLoading ? (
          <div className="flex justify-center py-10"><div className="spinner w-8 h-8" /></div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${v/1000}K`} />
              <Tooltip formatter={v => `₹${v.toLocaleString()}`} />
              <Bar dataKey="Output GST" fill="#6366f1" radius={[3,3,0,0]} />
              <Bar dataKey="Input GST" fill="#10b981" radius={[3,3,0,0]} />
              <Bar dataKey="Net Payable" fill="#ef4444" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Monthly table */}
      <div className="card">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Monthly Filing Status</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                {['Month','Sales','Purchases','Output GST','Input GST','Net Payable','GSTR-1','GSTR-3B','Action'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {summary.map((m, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{m.month_name || MONTHS[i]}</td>
                  <td className="px-4 py-3">₹{parseFloat(m.total_sales||0).toLocaleString()}</td>
                  <td className="px-4 py-3">₹{parseFloat(m.total_purchases||0).toLocaleString()}</td>
                  <td className="px-4 py-3">₹{parseFloat(m.output_gst||0).toLocaleString()}</td>
                  <td className="px-4 py-3">₹{parseFloat(m.input_gst||0).toLocaleString()}</td>
                  <td className="px-4 py-3 font-semibold text-red-600">₹{parseFloat(m.net_gst_payable||0).toLocaleString()}</td>
                  <td className="px-4 py-3"><span className={m.filing_status==='filed'?'badge-success':'badge-warning'}>{m.filing_status==='filed'?'Filed':'Pending'}</span></td>
                  <td className="px-4 py-3"><span className={m.filing_status==='filed'?'badge-success':'badge-warning'}>{m.filing_status==='filed'?'Filed':'Pending'}</span></td>
                  <td className="px-4 py-3">
                    <button className="text-xs text-primary-600 hover:underline">View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* GSTIN Verifier */}
      <div className="card p-5">
        <h3 className="font-semibold text-gray-900 mb-4">GSTIN Verification</h3>
        <div className="flex gap-3 mb-4">
          <input
            className="input flex-1 max-w-xs"
            placeholder="Enter GSTIN (e.g. 27ABCDE1234F1Z5)"
            value={gstin}
            onChange={e => setGstin(e.target.value.toUpperCase())}
            maxLength={15}
          />
          <button onClick={verifyGstin} disabled={verifying} className="btn-primary flex items-center gap-2">
            {verifying ? <div className="spinner w-4 h-4" /> : <Search size={16} />}
            Verify
          </button>
        </div>
        {gstinResult && (
          <div className={`p-4 rounded-lg ${gstinResult.error ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
            {gstinResult.error ? (
              <p className="text-red-700 text-sm">{gstinResult.error}</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                {[
                  ['GSTIN', gstinResult.gstin],
                  ['Business Name', gstinResult.business_name],
                  ['Status', gstinResult.status],
                  ['Type', gstinResult.business_type],
                  ['State', gstinResult.state],
                  ['Risk Score', `${((gstinResult.risk_score||0)*100).toFixed(0)}%`],
                ].map(([k, v]) => (
                  <div key={k}>
                    <p className="text-xs text-gray-500">{k}</p>
                    <p className="font-medium">{v}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── TDS PAGE ─────────────────────────────────────────────────────────────────
export function TDSPage() {
  const [fy, setFy] = useState('2024-25')
  const { data: summary = {}, isLoading } = useQuery({
    queryKey: ['tds-summary', fy],
    queryFn: () => import('../services/api').then(m => m.tdsAPI.quarterlySummary({ financial_year: fy }).then(r => r.data)),
  })

  const quarters = [
    { q: 1, label: 'Q1 (Apr–Jun)' },
    { q: 2, label: 'Q2 (Jul–Sep)' },
    { q: 3, label: 'Q3 (Oct–Dec)' },
    { q: 4, label: 'Q4 (Jan–Mar)' },
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">TDS Management</h1>
          <p className="text-sm text-gray-500">Tax Deducted at Source — quarterly reports</p>
        </div>
        <select className="input w-36" value={fy} onChange={e => setFy(e.target.value)}>
          {['2024-25','2023-24'].map(y=><option key={y}>{y}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {quarters.map(({ q, label }) => {
          const data = summary[q] || {}
          return (
            <div key={q} className="card p-5">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-3">{label}</p>
              <p className="text-xl font-bold text-gray-900">₹{parseFloat(data.total_tds||0).toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-1">TDS deducted</p>
              <p className="text-sm text-gray-600 mt-2">Payments: ₹{parseFloat(data.total_payments||0).toLocaleString()}</p>
              <span className={`mt-2 inline-block ${(data.records||[]).length > 0 ? 'badge-success' : 'badge-warning'}`}>
                {(data.records||[]).length > 0 ? `${(data.records||[]).length} records` : 'No records'}
              </span>
            </div>
          )
        })}
      </div>

      <div className="card p-5">
        <h3 className="font-semibold text-gray-900 mb-4">TDS Sections Reference</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { section: '194C', desc: 'Contractor payments', rate: '1%', threshold: '₹30,000' },
            { section: '194J', desc: 'Professional/Technical fees', rate: '10%', threshold: '₹30,000' },
            { section: '194H', desc: 'Commission/Brokerage', rate: '5%', threshold: '₹15,000' },
            { section: '194I', desc: 'Rent', rate: '10%', threshold: '₹2,40,000/yr' },
            { section: '194A', desc: 'Interest payments', rate: '10%', threshold: '₹40,000' },
            { section: '194B', desc: 'Lottery winnings', rate: '30%', threshold: '₹10,000' },
          ].map(s => (
            <div key={s.section} className="border border-gray-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-primary-700">{s.section}</span>
                <span className="badge-info">{s.rate}</span>
              </div>
              <p className="text-sm text-gray-600">{s.desc}</p>
              <p className="text-xs text-gray-400 mt-1">Threshold: {s.threshold}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── ITR PAGE ─────────────────────────────────────────────────────────────────
export function ITRPage() {
  const [fy, setFy] = useState('2024-25')
  const { data: itr, isLoading } = useQuery({
    queryKey: ['itr', fy],
    queryFn: () => import('../services/api').then(m => m.itrAPI.summary({ financial_year: fy }).then(r => r.data)),
  })

  const rows = itr ? [
    { label: 'Gross Income', value: itr.gross_income, color: 'text-gray-900' },
    { label: 'Less: Total Deductions', value: itr.total_deductions, color: 'text-green-600' },
    { label: 'Net Taxable Income', value: itr.taxable_income, color: 'text-gray-900 font-bold' },
    { label: 'Tax Liability (with 4% cess)', value: itr.tax_liability, color: 'text-red-600' },
    { label: 'Less: TDS Already Paid', value: itr.tds_paid, color: 'text-green-600' },
    { label: 'Net Tax Payable / Refund', value: itr.net_tax_payable, color: 'text-red-600 font-bold text-lg' },
  ] : []

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ITR Preparation</h1>
          <p className="text-sm text-gray-500">Income Tax Return draft — as per IT Act 1961</p>
        </div>
        <select className="input w-36" value={fy} onChange={e => setFy(e.target.value)}>
          {['2024-25','2023-24'].map(y=><option key={y}>{y}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><div className="spinner w-8 h-8" /></div>
      ) : itr ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card p-5 text-center">
              <p className="text-sm text-gray-500">Assessment Year</p>
              <p className="text-xl font-bold mt-1">{itr.assessment_year}</p>
            </div>
            <div className="card p-5 text-center">
              <p className="text-sm text-gray-500">ITR Type</p>
              <p className="text-xl font-bold mt-1">ITR-4</p>
              <p className="text-xs text-gray-400">Presumptive Business Income</p>
            </div>
            <div className="card p-5 text-center">
              <p className="text-sm text-gray-500">Status</p>
              <span className="badge-warning mt-1 inline-block">Draft</span>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 mb-5">ITR Computation Sheet</h3>
            <div className="space-y-3">
              {rows.map(({ label, value, color }) => (
                <div key={label} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                  <span className="text-sm text-gray-600">{label}</span>
                  <span className={`text-sm ${color}`}>₹{parseFloat(value||0).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Tax Slab (New Regime FY 2024-25)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-gray-50">
                  {['Income Slab','Tax Rate'].map(h=><th key={h} className="px-4 py-2 text-left text-xs font-semibold text-gray-500">{h}</th>)}
                </tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {[
                    ['Up to ₹3,00,000','Nil'],
                    ['₹3,00,001 – ₹7,00,000','5%'],
                    ['₹7,00,001 – ₹10,00,000','10%'],
                    ['₹10,00,001 – ₹12,00,000','15%'],
                    ['₹12,00,001 – ₹15,00,000','20%'],
                    ['Above ₹15,00,000','30%'],
                  ].map(([slab, rate]) => (
                    <tr key={slab} className="hover:bg-gray-50">
                      <td className="px-4 py-2">{slab}</td>
                      <td className="px-4 py-2 font-semibold">{rate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="card p-10 text-center text-gray-400">
          <p>No ITR data available. Upload transactions first.</p>
        </div>
      )}
    </div>
  )
}

// ─── BOOKKEEPING PAGE ─────────────────────────────────────────────────────────
export function BookkeepingPage() {
  const [fy, setFy] = useState('2024-25')
  const { data: trial } = useQuery({
    queryKey: ['trial-balance', fy],
    queryFn: () => import('../services/api').then(m => m.bookkeepingAPI.trialBalance({ financial_year: fy }).then(r => r.data)),
  })
  const { data: coa } = useQuery({
    queryKey: ['chart-of-accounts'],
    queryFn: () => import('../services/api').then(m => m.bookkeepingAPI.chartOfAccounts().then(r => r.data)),
  })

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bookkeeping</h1>
          <p className="text-sm text-gray-500">Journal entries, ledger & trial balance</p>
        </div>
        <select className="input w-36" value={fy} onChange={e => setFy(e.target.value)}>
          {['2024-25','2023-24'].map(y=><option key={y}>{y}</option>)}
        </select>
      </div>

      {trial && (
        <div className="card">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Trial Balance — FY {fy}</h3>
            <span className={trial.is_balanced ? 'badge-success' : 'badge-danger'}>
              {trial.is_balanced ? '✓ Balanced' : '✗ Mismatch'}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50">
                {['Account Code','Account Name','Debit','Credit','Balance'].map(h=>(
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {(trial.entries||[]).map((e, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs">{e.account_code}</td>
                    <td className="px-4 py-3">{e.account_name}</td>
                    <td className="px-4 py-3">₹{parseFloat(e.debit_total||0).toLocaleString()}</td>
                    <td className="px-4 py-3">₹{parseFloat(e.credit_total||0).toLocaleString()}</td>
                    <td className={`px-4 py-3 font-semibold ${parseFloat(e.balance||0) >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                      ₹{Math.abs(parseFloat(e.balance||0)).toLocaleString()} {parseFloat(e.balance||0) >= 0 ? 'Dr' : 'Cr'}
                    </td>
                  </tr>
                ))}
                <tr className="bg-gray-50 font-semibold">
                  <td className="px-4 py-3" colSpan={2}>Total</td>
                  <td className="px-4 py-3">₹{parseFloat(trial.total_debit||0).toLocaleString()}</td>
                  <td className="px-4 py-3">₹{parseFloat(trial.total_credit||0).toLocaleString()}</td>
                  <td className="px-4 py-3" />
                </tr>
              </tbody>
            </table>
          </div>
          {!trial.entries?.length && (
            <p className="text-center text-gray-400 py-8">No journal entries yet. Upload and process documents first.</p>
          )}
        </div>
      )}

      {/* Chart of Accounts */}
      {coa && (
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Chart of Accounts</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(coa).map(([group, accounts]) => (
              <div key={group}>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">{group}</p>
                <div className="space-y-1">
                  {accounts.map(a => (
                    <div key={a.code} className="flex gap-3 py-1 border-b border-gray-100 text-sm">
                      <span className="font-mono text-xs text-gray-400 w-10">{a.code}</span>
                      <span className="text-gray-700">{a.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── REPORTS PAGE ─────────────────────────────────────────────────────────────
export function ReportsPage() {
  const [fy, setFy] = useState('2024-25')
  const [tab, setTab] = useState('pl')

  const { data: pl } = useQuery({
    queryKey: ['profit-loss', fy],
    queryFn: () => import('../services/api').then(m => m.reportsAPI.profitLoss({ financial_year: fy }).then(r => r.data)),
    enabled: tab === 'pl',
  })
  const { data: bs } = useQuery({
    queryKey: ['balance-sheet', fy],
    queryFn: () => import('../services/api').then(m => m.reportsAPI.balanceSheet({ financial_year: fy }).then(r => r.data)),
    enabled: tab === 'bs',
  })

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financial Reports</h1>
          <p className="text-sm text-gray-500">P&L Statement, Balance Sheet, Trial Balance</p>
        </div>
        <select className="input w-36" value={fy} onChange={e => setFy(e.target.value)}>
          {['2024-25','2023-24'].map(y=><option key={y}>{y}</option>)}
        </select>
      </div>

      <div className="flex gap-2">
        {[['pl','P&L Statement'],['bs','Balance Sheet']].map(([v,l]) => (
          <button key={v} onClick={() => setTab(v)}
            className={tab === v ? 'btn-primary' : 'btn-secondary'}>{l}</button>
        ))}
      </div>

      {tab === 'pl' && pl && (
        <div className="card">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Profit & Loss Statement — FY {fy}</h3>
          </div>
          <div className="p-5 space-y-6">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Income</p>
              {Object.entries(pl.income || {}).map(([k, v]) => (
                <div key={k} className="flex justify-between py-1.5 border-b border-gray-100 text-sm">
                  <span>{k}</span><span className="font-medium">₹{parseFloat(v||0).toLocaleString()}</span>
                </div>
              ))}
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Cost of Goods Sold</p>
              {Object.entries(pl.cost_of_goods || {}).map(([k, v]) => (
                <div key={k} className="flex justify-between py-1.5 border-b border-gray-100 text-sm">
                  <span>{k}</span><span className="font-medium text-red-600">₹{parseFloat(v||0).toLocaleString()}</span>
                </div>
              ))}
              <div className="flex justify-between py-2 font-semibold text-base border-t-2 border-gray-300 mt-2">
                <span>Gross Profit</span><span className={pl.gross_profit >= 0 ? 'text-green-600' : 'text-red-600'}>₹{parseFloat(pl.gross_profit||0).toLocaleString()}</span>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Expenses</p>
              {Object.entries(pl.expenses || {}).map(([k, v]) => (
                <div key={k} className="flex justify-between py-1.5 border-b border-gray-100 text-sm">
                  <span>{k}</span><span className="font-medium text-red-600">₹{parseFloat(v||0).toLocaleString()}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between py-3 font-bold text-lg border-t-2 border-gray-900">
              <span>Net Profit</span>
              <span className={pl.net_profit >= 0 ? 'text-green-600' : 'text-red-600'}>
                ₹{parseFloat(pl.net_profit||0).toLocaleString()}
              </span>
            </div>
            <div className="bg-gray-50 rounded-lg px-4 py-2 text-sm text-gray-600">
              Net Profit Margin: <span className="font-semibold">{parseFloat(pl.net_profit_margin||0).toFixed(1)}%</span>
            </div>
          </div>
        </div>
      )}

      {tab === 'bs' && bs && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Assets</h3>
            {Object.entries(bs.assets || {}).filter(([k]) => k !== 'total_assets').map(([group, items]) => (
              <div key={group} className="mb-4">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">{group}</p>
                {typeof items === 'object' && Object.entries(items).map(([k, v]) => (
                  <div key={k} className="flex justify-between py-1 text-sm border-b border-gray-100">
                    <span className="text-gray-600">{k}</span>
                    <span>₹{parseFloat(v||0).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            ))}
            <div className="flex justify-between font-bold border-t-2 border-gray-900 pt-2">
              <span>Total Assets</span><span>₹{parseFloat(bs.assets?.total_assets||0).toLocaleString()}</span>
            </div>
          </div>
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Liabilities & Capital</h3>
            {Object.entries(bs.liabilities || {}).filter(([k]) => k !== 'total_liabilities').map(([group, items]) => (
              <div key={group} className="mb-4">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">{group}</p>
                {typeof items === 'object' && Object.entries(items).map(([k, v]) => (
                  <div key={k} className="flex justify-between py-1 text-sm border-b border-gray-100">
                    <span className="text-gray-600">{k}</span>
                    <span>₹{parseFloat(v||0).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            ))}
            {Object.entries(bs.capital || {}).filter(([k]) => k !== 'total_capital').map(([k, v]) => (
              <div key={k} className="flex justify-between py-1 text-sm border-b border-gray-100">
                <span className="text-gray-600">{k}</span>
                <span>₹{parseFloat(v||0).toLocaleString()}</span>
              </div>
            ))}
            <div className="flex justify-between font-bold border-t-2 border-gray-900 pt-2">
              <span>Total L + C</span><span>₹{parseFloat(bs.total_liabilities_capital||0).toLocaleString()}</span>
            </div>
            <div className={`mt-3 p-2 rounded text-sm text-center ${bs.is_balanced ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {bs.is_balanced ? '✓ Balance Sheet is balanced' : '✗ Balance Sheet does not balance'}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── CLIENTS PAGE ─────────────────────────────────────────────────────────────
export function ClientsPage() {
  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: () => import('../services/api').then(m => m.clientsAPI.list().then(r => r.data)),
  })

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Client Management</h1>
      <div className="card">
        {isLoading ? (
          <div className="flex justify-center py-16"><div className="spinner w-8 h-8" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50">
                {['Business Name','PAN','GSTIN','Type','State','FY','Status'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {clients.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{c.business_name}</td>
                    <td className="px-4 py-3 font-mono text-xs">{c.pan}</td>
                    <td className="px-4 py-3 font-mono text-xs">{c.gstin || '—'}</td>
                    <td className="px-4 py-3">{c.business_type}</td>
                    <td className="px-4 py-3">{c.state || '—'}</td>
                    <td className="px-4 py-3">{c.current_fy}</td>
                    <td className="px-4 py-3">
                      <span className={c.is_active ? 'badge-success' : 'badge-danger'}>
                        {c.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!clients.length && <p className="text-center text-gray-400 py-8">No clients yet</p>}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── ADMIN PAGE ───────────────────────────────────────────────────────────────
export function AdminPage() {
  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => import('../services/api').then(m => m.adminAPI.stats().then(r => r.data)),
  })
  const { data: users = [] } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => import('../services/api').then(m => m.adminAPI.users().then(r => r.data)),
  })

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            ['Total Clients', stats.total_clients, 'bg-blue-500'],
            ['Active Clients', stats.active_clients, 'bg-green-500'],
            ['Total Documents', stats.total_documents, 'bg-purple-500'],
            ['Pending OCR', stats.pending_documents, 'bg-amber-500'],
          ].map(([label, value, color]) => (
            <div key={label} className="card p-4">
              <p className="text-sm text-gray-500">{label}</p>
              <p className="text-2xl font-bold mt-1">{value ?? '—'}</p>
            </div>
          ))}
        </div>
      )}
      <div className="card">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">All Users</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50">
              {['ID','Name','Email','Role','Status'].map(h=>(
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
              ))}
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500">#{u.id}</td>
                  <td className="px-4 py-3 font-medium">{u.full_name}</td>
                  <td className="px-4 py-3">{u.email}</td>
                  <td className="px-4 py-3"><span className="badge-info capitalize">{u.role}</span></td>
                  <td className="px-4 py-3">
                    <span className={u.is_active ? 'badge-success' : 'badge-danger'}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── CHATBOT PAGE ─────────────────────────────────────────────────────────────
export function ChatbotPage() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hello! I am your AI Finance Assistant. Ask me anything about GST, TDS, ITR, or accounting.' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const sendMessage = async () => {
    if (!input.trim() || loading) return
    const userMsg = { role: 'user', content: input }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: 'You are a helpful CA assistant for Ajit Joshi Finance Services. Answer questions about Indian GST, TDS, ITR, accounting, and compliance. Be concise and practical.',
          messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content }))
        })
      })
      const data = await response.json()
      const reply = data.content?.[0]?.text || 'Sorry, I could not get a response.'
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error connecting to AI. Please try again.' }])
    }
    setLoading(false)
  }

  return (
    <div className="p-6 flex flex-col h-full" style={{ maxHeight: 'calc(100vh - 64px)' }}>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">AI Finance Assistant</h1>
        <p className="text-sm text-gray-500">Ask questions about GST, TDS, ITR, and accounting</p>
      </div>
      <div className="card flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                m.role === 'user' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-800'
              }`}>
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-2xl px-4 py-3">
                <div className="flex gap-1">
                  {[0,1,2].map(i=><div key={i} className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay:`${i*150}ms`}}/>)}
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="border-t border-gray-100 p-4 flex gap-3">
          <input
            className="input flex-1"
            placeholder="Ask about GST deadlines, TDS sections, ITR filing..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
          />
          <button onClick={sendMessage} disabled={loading} className="btn-primary px-5">Send</button>
        </div>
      </div>
    </div>
  )
}

// ─── PROFILE PAGE ─────────────────────────────────────────────────────────────
export function ProfilePage() {
  const { user } = useAuthStore()
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
      <div className="card p-6 max-w-lg">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
            {user?.full_name?.[0]}
          </div>
          <div>
            <p className="text-lg font-semibold">{user?.full_name}</p>
            <p className="text-sm text-gray-500 capitalize">{user?.role}</p>
          </div>
        </div>
        <div className="space-y-3">
          {[
            ['Email', user?.email],
            ['Role', user?.role],
            ['Account Status', 'Active'],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between py-2 border-b border-gray-100 text-sm">
              <span className="text-gray-500">{k}</span>
              <span className="font-medium capitalize">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
