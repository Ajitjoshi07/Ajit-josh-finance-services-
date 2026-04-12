import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { reportsAPI, clientsAPI, authAPI } from '../services/api'
import useAuthStore from '../store/authStore'
import { Users, TrendingUp, TrendingDown } from 'lucide-react'

const FY_OPTIONS = ['2026-27','2025-26','2024-25','2023-24','2022-23']

function amt(v, showSign = false) {
  const val = parseFloat(v || 0)
  if (val === 0) return '₹ 0'
  const formatted = `₹ ${Math.abs(val).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
  if (showSign && val < 0) return `(${formatted})`
  return formatted
}

function TwoColumnAccount({ title, drTitle, crTitle, drItems, crItems, drTotal, crTotal, highlight }) {
  const allKeys = [...new Set([...Object.keys(drItems), ...Object.keys(crItems)])]
  const maxRows = Math.max(Object.keys(drItems).length, Object.keys(crItems).length)

  const drEntries = Object.entries(drItems)
  const crEntries = Object.entries(crItems)
  const maxLen = Math.max(drEntries.length, crEntries.length)
  const rows = Array.from({ length: maxLen }, (_, i) => ({
    dr: drEntries[i] || null,
    cr: crEntries[i] || null,
  }))

  return (
    <div className="card mb-6">
      <div className="bg-primary-900 text-white px-5 py-3 rounded-t-xl">
        <h3 className="font-bold text-center tracking-wide">{title}</h3>
        <p className="text-xs text-center text-primary-300 mt-0.5">For the Financial Year ending 31st March</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="px-4 py-2 bg-blue-50 text-blue-800 font-semibold text-left border-r border-gray-200 w-1/2">{drTitle} (Dr)</th>
              <th className="px-4 py-2 bg-blue-50 text-blue-800 font-semibold text-right border-r border-gray-200 w-24">Amount (₹)</th>
              <th className="px-4 py-2 bg-green-50 text-green-800 font-semibold text-left w-1/2">{crTitle} (Cr)</th>
              <th className="px-4 py-2 bg-green-50 text-green-800 font-semibold text-right w-24">Amount (₹)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className={`px-4 py-2 border-r border-gray-200 ${row.dr?.[0]?.includes('Total') || row.dr?.[0]?.includes('Profit') || row.dr?.[0]?.includes('Loss') ? 'font-bold bg-blue-50' : ''}`}>
                  {row.dr ? row.dr[0] : ''}
                </td>
                <td className={`px-4 py-2 text-right border-r border-gray-200 font-mono text-xs ${parseFloat(row.dr?.[1] || 0) > 0 ? 'text-gray-800' : 'text-gray-400'}`}>
                  {row.dr ? amt(row.dr[1]) : ''}
                </td>
                <td className={`px-4 py-2 ${row.cr?.[0]?.includes('Total') || row.cr?.[0]?.includes('Profit') || row.cr?.[0]?.includes('Loss') ? 'font-bold bg-green-50' : ''}`}>
                  {row.cr ? row.cr[0] : ''}
                </td>
                <td className={`px-4 py-2 text-right font-mono text-xs ${parseFloat(row.cr?.[1] || 0) > 0 ? 'text-gray-800' : 'text-gray-400'}`}>
                  {row.cr ? amt(row.cr[1]) : ''}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-100 font-bold border-t-2 border-gray-400">
              <td className="px-4 py-2.5 border-r border-gray-200">TOTAL</td>
              <td className={`px-4 py-2.5 text-right border-r border-gray-200 font-mono ${highlight && parseFloat(drTotal) > 0 ? 'text-blue-700' : ''}`}>
                {amt(drTotal)}
              </td>
              <td className="px-4 py-2.5">TOTAL</td>
              <td className={`px-4 py-2.5 text-right font-mono ${highlight && parseFloat(crTotal) > 0 ? 'text-green-700' : ''}`}>
                {amt(crTotal)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

function BalanceSheetTable({ data }) {
  if (!data) return null
  const { liabilities_side, assets_side } = data
  const libItems = {}
  const assetItems = {}

  Object.entries(liabilities_side || {}).forEach(([group, items]) => {
    if (group === 'total_liabilities_capital') return
    if (typeof items === 'object') {
      Object.entries(items).forEach(([k, v]) => {
        libItems[`${group} — ${k}`] = v
      })
    }
  })
  Object.entries(assets_side || {}).forEach(([group, items]) => {
    if (group === 'total_assets') return
    if (typeof items === 'object') {
      Object.entries(items).forEach(([k, v]) => {
        assetItems[`${group} — ${k}`] = v
      })
    }
  })

  const libEntries = Object.entries(libItems)
  const assetEntries = Object.entries(assetItems)
  const maxLen = Math.max(libEntries.length, assetEntries.length)
  const rows = Array.from({ length: maxLen }, (_, i) => ({
    lib: libEntries[i] || null,
    asset: assetEntries[i] || null,
  }))

  return (
    <div className="card mb-6">
      <div className="bg-primary-900 text-white px-5 py-3 rounded-t-xl">
        <h3 className="font-bold text-center tracking-wide">BALANCE SHEET</h3>
        <p className="text-xs text-center text-primary-300 mt-0.5">As at 31st March (ICAI Format)</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="px-4 py-2 bg-red-50 text-red-800 font-semibold text-left border-r border-gray-200 w-1/2">LIABILITIES (Dr)</th>
              <th className="px-4 py-2 bg-red-50 text-red-800 font-semibold text-right border-r border-gray-200 w-24">Amount (₹)</th>
              <th className="px-4 py-2 bg-blue-50 text-blue-800 font-semibold text-left w-1/2">ASSETS (Cr)</th>
              <th className="px-4 py-2 bg-blue-50 text-blue-800 font-semibold text-right w-24">Amount (₹)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row, i) => {
              const libKey = row.lib?.[0] || ''
              const assetKey = row.asset?.[0] || ''
              const isLibGroup = libKey.includes(' — ') && !libKey.split(' — ')[1]?.trim()
              return (
                <tr key={i} className="hover:bg-gray-50">
                  <td className={`px-4 py-1.5 border-r border-gray-200 text-xs ${libKey.split(' — ')?.[1]?.includes('Closing Capital') ? 'font-bold' : ''}`}>
                    {libKey.split(' — ').length > 1 ? (
                      <><span className="text-gray-400 text-xs">{libKey.split(' — ')[0]}</span><br/><span>{libKey.split(' — ')[1]}</span></>
                    ) : libKey}
                  </td>
                  <td className={`px-4 py-1.5 text-right border-r border-gray-200 font-mono text-xs ${parseFloat(row.lib?.[1] || 0) > 0 ? '' : 'text-gray-300'}`}>
                    {row.lib ? amt(row.lib[1]) : ''}
                  </td>
                  <td className={`px-4 py-1.5 text-xs ${assetKey.split(' — ')?.[1]?.includes('Net Block') || assetKey.split(' — ')?.[1]?.includes('Total') ? 'font-bold' : ''}`}>
                    {assetKey.split(' — ').length > 1 ? (
                      <><span className="text-gray-400 text-xs">{assetKey.split(' — ')[0]}</span><br/><span>{assetKey.split(' — ')[1]}</span></>
                    ) : assetKey}
                  </td>
                  <td className={`px-4 py-1.5 text-right font-mono text-xs ${parseFloat(row.asset?.[1] || 0) > 0 ? '' : 'text-gray-300'}`}>
                    {row.asset ? amt(row.asset[1]) : ''}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="bg-gray-100 font-bold border-t-2 border-gray-400">
              <td className="px-4 py-2.5 border-r border-gray-200">TOTAL</td>
              <td className="px-4 py-2.5 text-right border-r border-gray-200 font-mono text-red-700">{amt(liabilities_side?.total_liabilities_capital)}</td>
              <td className="px-4 py-2.5">TOTAL</td>
              <td className="px-4 py-2.5 text-right font-mono text-blue-700">{amt(assets_side?.total_assets)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className={`mx-4 mb-4 mt-2 p-2 rounded text-sm text-center font-medium ${data.is_balanced ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
        {data.is_balanced ? '✓ Balance Sheet is balanced (Assets = Liabilities + Capital)' : '✗ Balance Sheet does not balance — please check data'}
      </div>
    </div>
  )
}

export default function ReportsPage() {
  const { isCA, user } = useAuthStore()
  const [fy, setFy] = useState('2024-25')
  const [selectedClient, setSelectedClient] = useState(null)
  const [activeTab, setActiveTab] = useState('icai')

  const { data: myProfile } = useQuery({
    queryKey: ['my-profile', user?.id],
    queryFn: () => authAPI.myProfile().then(r => r.data),
    enabled: !isCA(),
  })

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => clientsAPI.list().then(r => r.data),
    enabled: isCA(),
  })

  const clientId = isCA() ? selectedClient?.id : myProfile?.profile?.id
  const clientName = isCA() ? selectedClient?.business_name : myProfile?.profile?.business_name

  const { data: icai, isLoading } = useQuery({
    queryKey: ['icai-complete', fy, clientId],
    queryFn: () => reportsAPI.icaiComplete({ financial_year: fy, client_id: clientId }).then(r => r.data),
    enabled: !!clientId,
  })

  const tabs = [
    { id: 'icai', label: 'ICAI Complete (All 4 Accounts)' },
    { id: 'manufacturing', label: 'Manufacturing A/c' },
    { id: 'trading', label: 'Trading A/c' },
    { id: 'pl', label: 'P&L Account' },
    { id: 'bs', label: 'Balance Sheet' },
  ]

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financial Reports</h1>
          <p className="text-sm text-gray-500">ICAI Standard Format — Manufacturing, Trading, P&L & Balance Sheet</p>
        </div>
        <select className="input w-36" value={fy} onChange={e => setFy(e.target.value)}>
          {FY_OPTIONS.map(y => <option key={y}>{y}</option>)}
        </select>
      </div>

      {isCA() && (
        <div className="card p-4">
          <label className="label">Select Client</label>
          <select className="input w-72" value={selectedClient?.id || ''} onChange={e => {
            const c = clients.find(x => x.id === Number(e.target.value))
            setSelectedClient(c || null)
          }}>
            <option value="">— Select a client —</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.business_name}</option>)}
          </select>
        </div>
      )}

      {!clientId ? (
        <div className="card p-10 text-center text-gray-400">
          <Users size={40} className="mx-auto mb-3 opacity-40" />
          <p>{isCA() ? 'Select a client to view reports' : 'Complete your profile to view reports'}</p>
        </div>
      ) : isLoading ? (
        <div className="flex justify-center py-20"><div className="spinner w-8 h-8" /></div>
      ) : !icai?.has_data ? (
        <div className="card p-10 text-center text-gray-400">
          <TrendingUp size={40} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">No validated transaction data yet</p>
          <p className="text-sm mt-1">Upload documents or enter data manually. All figures will show as ₹0 until data is available.</p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          {icai.summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Total Income', value: icai.summary.total_income, color: 'text-green-700' },
                { label: 'Gross Profit', value: icai.summary.gross_profit, color: icai.summary.gross_profit >= 0 ? 'text-blue-700' : 'text-red-600' },
                { label: 'Net Profit', value: icai.summary.net_profit, color: icai.summary.net_profit >= 0 ? 'text-green-700' : 'text-red-600' },
                { label: 'Net GST Payable', value: icai.summary.net_gst_payable, color: 'text-red-600' },
              ].map(({ label, value, color }) => (
                <div key={label} className="card p-4">
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className={`text-lg font-bold mt-1 ${color}`}>₹{parseFloat(value || 0).toLocaleString('en-IN')}</p>
                </div>
              ))}
            </div>
          )}

          {/* Account Tabs */}
          <div className="flex flex-wrap gap-2">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === t.id ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ICAI All 4 */}
          {(activeTab === 'icai' || activeTab === 'manufacturing') && icai.manufacturing_account && (
            <TwoColumnAccount
              title="MANUFACTURING ACCOUNT"
              drTitle="Dr — Expenses / Inputs"
              crTitle="Cr — Output / Production"
              drItems={icai.manufacturing_account.dr_side}
              crItems={icai.manufacturing_account.cr_side}
              drTotal={icai.manufacturing_account.cost_of_production}
              crTotal={icai.manufacturing_account.cost_of_production}
            />
          )}

          {(activeTab === 'icai' || activeTab === 'trading') && icai.trading_account && (
            <TwoColumnAccount
              title="TRADING ACCOUNT"
              drTitle="Dr — Purchases & Direct Expenses"
              crTitle="Cr — Sales & Income"
              drItems={icai.trading_account.dr_side}
              crItems={icai.trading_account.cr_side}
              drTotal={Object.values(icai.trading_account.dr_side).reduce((s, v) => s + parseFloat(v || 0), 0)}
              crTotal={Object.values(icai.trading_account.cr_side).reduce((s, v) => s + parseFloat(v || 0), 0)}
              highlight
            />
          )}

          {(activeTab === 'icai' || activeTab === 'pl') && icai.profit_loss_account && (
            <TwoColumnAccount
              title="PROFIT & LOSS ACCOUNT"
              drTitle="Dr — Indirect Expenses"
              crTitle="Cr — Gross Profit & Other Income"
              drItems={icai.profit_loss_account.dr_side}
              crItems={icai.profit_loss_account.cr_side}
              drTotal={Object.values(icai.profit_loss_account.dr_side).reduce((s, v) => s + parseFloat(v || 0), 0)}
              crTotal={Object.values(icai.profit_loss_account.cr_side).reduce((s, v) => s + parseFloat(v || 0), 0)}
              highlight
            />
          )}

          {(activeTab === 'icai' || activeTab === 'bs') && icai.balance_sheet && (
            <BalanceSheetTable data={icai.balance_sheet} />
          )}

          <div className="card p-4 bg-amber-50 border-amber-200 text-sm text-amber-800">
            <p className="font-semibold mb-1">⚠ Note on Accuracy:</p>
            <p>These reports are auto-calculated from uploaded and approved transaction data. For production use, upload bank statements, reconcile entries, and have your CA verify before filing. Figures marked "(Est.)" are estimated from available data.</p>
          </div>
        </>
      )}
    </div>
  )
}
