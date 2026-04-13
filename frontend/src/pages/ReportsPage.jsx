import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { reportsAPI, clientsAPI, authAPI } from '../services/api'
import useAuthStore from '../store/authStore'
import ClientSelector from '../components/shared/ClientSelector'
import { Users } from 'lucide-react'

const FY_OPTIONS = ['2026-27','2025-26','2024-25','2023-24','2022-23']

const fmt = (v) => {
  const n = parseFloat(v || 0)
  if (n === 0) return <span className="text-gray-300">0.00</span>
  return <span className={n < 0 ? 'text-red-600 font-semibold' : ''}>{n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
}

// ICAI two-column T-account table
function TAccount({ title, subtitle, drItems, crItems, drTotal, crTotal, drLabel = 'Dr', crLabel = 'Cr' }) {
  const drEntries = Object.entries(drItems || {})
  const crEntries = Object.entries(crItems || {})
  const maxLen = Math.max(drEntries.length, crEntries.length)
  const rows = Array.from({ length: maxLen }, (_, i) => ({ dr: drEntries[i], cr: crEntries[i] }))

  const isGroupHeader = (key) => key && (
    key.startsWith('──') || key.endsWith(':') ||
    ['Capital Account','Current Assets','Fixed Assets','Current Liabilities','Secured Loans','Unsecured Loans','Investments','Miscellaneous Expenditure'].includes(key)
  )

  return (
    <div className="card mb-5 overflow-hidden">
      <div className="bg-gray-900 text-white px-5 py-3">
        <h3 className="font-bold text-center text-base tracking-wide uppercase">{title}</h3>
        {subtitle && <p className="text-xs text-center text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="px-3 py-2 bg-blue-700 text-white font-semibold text-left border-r border-blue-800 w-[42%]">
                {drLabel} — Particulars
              </th>
              <th className="px-3 py-2 bg-blue-700 text-white font-semibold text-right border-r border-gray-200 w-[8%]">
                ₹
              </th>
              <th className="px-3 py-2 bg-green-700 text-white font-semibold text-left border-r border-green-800 w-[42%]">
                {crLabel} — Particulars
              </th>
              <th className="px-3 py-2 bg-green-700 text-white font-semibold text-right w-[8%]">
                ₹
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const drKey = row.dr?.[0]
              const crKey = row.cr?.[0]
              const drVal = row.dr?.[1]
              const crVal = row.cr?.[1]
              const drIsGroup = isGroupHeader(drKey)
              const crIsGroup = isGroupHeader(crKey)
              return (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className={`px-3 py-1.5 border-r border-gray-200 ${drIsGroup ? 'font-bold text-gray-800 bg-blue-50' : 'text-gray-700 pl-5'}`}>
                    {drKey || ''}
                  </td>
                  <td className="px-3 py-1.5 text-right border-r border-gray-200 font-mono">
                    {drVal !== undefined ? fmt(drVal) : ''}
                  </td>
                  <td className={`px-3 py-1.5 border-r border-gray-200 ${crIsGroup ? 'font-bold text-gray-800 bg-green-50' : 'text-gray-700 pl-5'}`}>
                    {crKey || ''}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono">
                    {crVal !== undefined ? fmt(crVal) : ''}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-400 bg-gray-100">
              <td className="px-3 py-2 font-bold text-gray-900 border-r border-gray-300 uppercase text-xs">Total</td>
              <td className="px-3 py-2 text-right font-bold font-mono border-r border-gray-300 text-blue-800">
                {fmt(drTotal)}
              </td>
              <td className="px-3 py-2 font-bold text-gray-900 border-r border-gray-300 uppercase text-xs">Total</td>
              <td className="px-3 py-2 text-right font-bold font-mono text-green-800">
                {fmt(crTotal)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// Build ICAI accounts with ALL items always shown (zero if no data)
function buildAccounts(icai) {
  const d = icai || {}

  // Manufacturing Account
  const mfgDr = {
    'Opening Stock of Raw Material': d.manufacturing_account?.dr_side?.['Opening Stock of Raw Material'] ?? 0,
    'Add: Purchases of Raw Material': d.manufacturing_account?.dr_side?.['Purchases of Raw Material'] ?? 0,
    'Add: Direct Wages / Labour': d.manufacturing_account?.dr_side?.['Direct Wages / Labour'] ?? 0,
    'Add: Factory Overhead': d.manufacturing_account?.dr_side?.['Factory Overhead'] ?? 0,
    'Add: Power & Fuel': d.manufacturing_account?.dr_side?.['Power & Fuel'] ?? 0,
    'Add: Freight Inward': d.manufacturing_account?.dr_side?.['Freight Inward'] ?? 0,
    'Add: Carriage on Purchases': d.manufacturing_account?.dr_side?.['Carriage on Purchases'] ?? 0,
    'Add: Manufacturing Expenses': d.manufacturing_account?.dr_side?.['Manufacturing Expenses'] ?? 0,
    'Add: Royalty': d.manufacturing_account?.dr_side?.['Royalty'] ?? 0,
    'Cost of Production c/f →': d.manufacturing_account?.cost_of_production ?? 0,
  }
  const mfgCr = {
    'Less: Closing Stock of Raw Material': d.manufacturing_account?.cr_side?.['Closing Stock of Raw Material'] ?? 0,
    'Less: Closing Work-in-Progress': d.manufacturing_account?.cr_side?.['Closing Work-in-Progress'] ?? 0,
    'Cost of Goods Produced b/f ←': d.manufacturing_account?.cost_of_production ?? 0,
  }

  // Trading Account
  const tradDr = {
    'Opening Stock (Finished Goods)': d.trading_account?.dr_side?.['Opening Stock (Finished Goods)'] ?? 0,
    'Add: Purchases (Net of Returns)': d.trading_account?.dr_side?.['Purchases (Net of Returns)'] ?? 0,
    'Add: Cost of Production b/f': d.manufacturing_account?.cost_of_production ?? 0,
    'Add: Direct Expenses / Wages': d.trading_account?.dr_side?.['Direct Expenses / Wages'] ?? 0,
    'Add: Carriage Inwards': d.trading_account?.dr_side?.['Carriage Inwards'] ?? 0,
    'Add: Custom Duty / Import Charges': d.trading_account?.dr_side?.['Custom Duty / Import Charges'] ?? 0,
    'Gross Profit c/d →': Math.max(d.trading_account?.gross_profit ?? 0, 0),
    'Gross Loss c/d →': Math.abs(Math.min(d.trading_account?.gross_profit ?? 0, 0)),
  }
  const tradCr = {
    'Sales Revenue (Net of Returns)': d.trading_account?.cr_side?.['Sales Revenue (Net)'] ?? 0,
    'Add: Service Income': d.trading_account?.cr_side?.['Service Income'] ?? 0,
    'Add: Export Sales': d.trading_account?.cr_side?.['Export Sales'] ?? 0,
    'Add: Closing Stock (Finished Goods)': d.trading_account?.cr_side?.['Closing Stock (Finished Goods)'] ?? 0,
    'Gross Loss b/d ←': Math.abs(Math.min(d.trading_account?.gross_profit ?? 0, 0)),
  }

  // P&L Account
  const gp = d.trading_account?.gross_profit ?? 0
  const plDr = {
    'Gross Loss b/d ←': Math.abs(Math.min(gp, 0)),
    'Salaries & Staff Welfare': d.profit_loss_account?.dr_side?.['Salaries & Staff Welfare'] ?? 0,
    'Office Rent': d.profit_loss_account?.dr_side?.['Office Rent'] ?? 0,
    'Electricity & Water Charges': d.profit_loss_account?.dr_side?.['Electricity & Water Charges'] ?? 0,
    'Telephone & Internet Charges': d.profit_loss_account?.dr_side?.['Telephone & Internet'] ?? 0,
    'Advertising & Marketing': d.profit_loss_account?.dr_side?.['Advertising & Marketing'] ?? 0,
    'Repairs & Maintenance': d.profit_loss_account?.dr_side?.['Repairs & Maintenance'] ?? 0,
    'Depreciation on Fixed Assets': d.profit_loss_account?.dr_side?.['Depreciation'] ?? 0,
    'Insurance Premium': d.profit_loss_account?.dr_side?.['Insurance Premium'] ?? 0,
    'Printing & Stationery': d.profit_loss_account?.dr_side?.['Printing & Stationery'] ?? 0,
    'Travelling & Conveyance': d.profit_loss_account?.dr_side?.['Travelling & Conveyance'] ?? 0,
    'Postage & Courier Charges': d.profit_loss_account?.dr_side?.['Postage & Courier'] ?? 0,
    'Audit & Legal Fees': d.profit_loss_account?.dr_side?.['Audit & Legal Fees'] ?? 0,
    'Professional Charges': d.profit_loss_account?.dr_side?.['Professional Charges'] ?? 0,
    'Bank Charges & Interest': d.profit_loss_account?.dr_side?.['Bank Charges & Interest'] ?? 0,
    'Bad Debts Written Off': d.profit_loss_account?.dr_side?.['Bad Debts'] ?? 0,
    'Miscellaneous Expenses': d.profit_loss_account?.dr_side?.['Miscellaneous Expenses'] ?? 0,
    'Other Indirect Expenses': d.profit_loss_account?.dr_side?.['Other Indirect Expenses'] ?? 0,
    'Income Tax Provision': d.profit_loss_account?.dr_side?.['Income Tax Provision'] ?? 0,
    'Net Profit (to Capital A/c) →': Math.max(d.profit_loss_account?.net_profit ?? 0, 0),
    'Net Loss (to Capital A/c) →': Math.abs(Math.min(d.profit_loss_account?.net_profit ?? 0, 0)),
  }
  const plCr = {
    'Gross Profit b/d ←': Math.max(gp, 0),
    'Commission Received': d.profit_loss_account?.cr_side?.['Commission Received'] ?? 0,
    'Interest Received / Income': d.profit_loss_account?.cr_side?.['Interest Received'] ?? 0,
    'Discount Received': d.profit_loss_account?.cr_side?.['Discount Received'] ?? 0,
    'Rent Received': d.profit_loss_account?.cr_side?.['Rent Received'] ?? 0,
    'Dividend Income': d.profit_loss_account?.cr_side?.['Dividend Income'] ?? 0,
    'Profit on Sale of Assets': 0,
    'Other Non-Operating Income': d.profit_loss_account?.cr_side?.['Other Non-Operating Income'] ?? 0,
    'Net Loss (to Capital A/c) ←': Math.abs(Math.min(d.profit_loss_account?.net_profit ?? 0, 0)),
  }

  // Balance Sheet — Liabilities
  const np = d.profit_loss_account?.net_profit ?? 0
  const bs = d.balance_sheet || {}
  const bsLib = {
    'Capital Account:': '',
    '  Opening Capital': bs.liabilities_side?.['Capital Account']?.['Opening Capital'] ?? 0,
    '  Add: Net Profit for Year': Math.max(np, 0),
    '  Less: Net Loss for Year': Math.abs(Math.min(np, 0)),
    '  Less: Drawings': bs.liabilities_side?.['Capital Account']?.['Less: Drawings'] ?? 0,
    '  Closing Capital': bs.liabilities_side?.['Capital Account']?.['Closing Capital'] ?? 0,
    'Secured Loans:': '',
    '  Bank Overdraft (OD)': bs.liabilities_side?.['Secured Loans']?.['Bank Overdraft'] ?? 0,
    '  Bank Term Loan': bs.liabilities_side?.['Secured Loans']?.['Bank Term Loan'] ?? 0,
    '  Mortgage / Hypothecation Loan': bs.liabilities_side?.['Secured Loans']?.['Mortgage Loan'] ?? 0,
    'Unsecured Loans:': '',
    '  Loans from Partners/Directors': bs.liabilities_side?.['Unsecured Loans']?.['Loans from Directors/Partners'] ?? 0,
    '  Inter-Corporate Deposits': bs.liabilities_side?.['Unsecured Loans']?.['Inter-Corporate Deposits'] ?? 0,
    'Current Liabilities:': '',
    '  Sundry Creditors (A/c Payable)': bs.liabilities_side?.['Current Liabilities']?.['Sundry Creditors'] ?? 0,
    '  Bills Payable': bs.liabilities_side?.['Current Liabilities']?.['Bills Payable'] ?? 0,
    '  Outstanding Expenses': bs.liabilities_side?.['Current Liabilities']?.['Outstanding Expenses'] ?? 0,
    '  Advance Received from Customers': bs.liabilities_side?.['Current Liabilities']?.['Advance from Customers'] ?? 0,
    '  GST Payable (CGST+SGST+IGST)': bs.liabilities_side?.['Current Liabilities']?.['GST Payable (Net)'] ?? 0,
    '  TDS Payable': bs.liabilities_side?.['Current Liabilities']?.['TDS Payable'] ?? 0,
    '  Salary Payable': bs.liabilities_side?.['Current Liabilities']?.['Salary Payable'] ?? 0,
    '  Other Current Liabilities': bs.liabilities_side?.['Current Liabilities']?.['Other Current Liabilities'] ?? 0,
  }

  // Balance Sheet — Assets
  const bsAssets = {
    'Fixed Assets:': '',
    '  Land & Building': bs.assets_side?.['Fixed Assets']?.['Land & Building'] ?? 0,
    '  Plant & Machinery': bs.assets_side?.['Fixed Assets']?.['Plant & Machinery'] ?? 0,
    '  Furniture & Fixtures': bs.assets_side?.['Fixed Assets']?.['Furniture & Fixtures'] ?? 0,
    '  Computers & IT Equipment': bs.assets_side?.['Fixed Assets']?.['Computers & IT Equipment'] ?? 0,
    '  Vehicles': bs.assets_side?.['Fixed Assets']?.['Vehicles'] ?? 0,
    '  Intangible Assets (Goodwill)': bs.assets_side?.['Fixed Assets']?.['Intangible Assets'] ?? 0,
    '  Less: Accumulated Depreciation': bs.assets_side?.['Fixed Assets']?.['Less: Accumulated Depreciation'] ?? 0,
    '  Net Block (WDV)': bs.assets_side?.['Fixed Assets']?.['Net Block'] ?? 0,
    'Investments:': '',
    '  Long-term Investments': bs.assets_side?.['Investments']?.['Long-term Investments'] ?? 0,
    '  Short-term / Mutual Fund': bs.assets_side?.['Investments']?.['Short-term Investments'] ?? 0,
    'Current Assets:': '',
    '  Opening Stock (b/f)': bs.assets_side?.['Current Assets']?.['Opening Stock (brought forward)'] ?? 0,
    '  Closing Stock (at Cost/NRV)': bs.assets_side?.['Current Assets']?.['Closing Stock (at cost or NRV)'] ?? 0,
    '  Sundry Debtors (A/c Receivable)': bs.assets_side?.['Current Assets']?.['Sundry Debtors (Accounts Receivable)'] ?? 0,
    '  Bills Receivable': bs.assets_side?.['Current Assets']?.['Bills Receivable'] ?? 0,
    '  Cash in Hand': bs.assets_side?.['Current Assets']?.['Cash in Hand'] ?? 0,
    '  Cash at Bank': bs.assets_side?.['Current Assets']?.['Cash at Bank'] ?? 0,
    '  Prepaid Expenses': bs.assets_side?.['Current Assets']?.['Prepaid Expenses'] ?? 0,
    '  Advance to Suppliers': bs.assets_side?.['Current Assets']?.['Advance to Suppliers'] ?? 0,
    '  TDS Credit Receivable (IT Dept)': bs.assets_side?.['Current Assets']?.['Tax Refund Receivable (TDS Credit)'] ?? 0,
    '  Other Current Assets': bs.assets_side?.['Current Assets']?.['Other Current Assets'] ?? 0,
    'Miscellaneous Expenditure:': '',
    '  Preliminary Expenses': bs.assets_side?.['Miscellaneous Expenditure']?.['Preliminary Expenses'] ?? 0,
    '  Deferred Revenue Expenditure': bs.assets_side?.['Miscellaneous Expenditure']?.['Deferred Revenue Expenditure'] ?? 0,
  }

  return { mfgDr, mfgCr, tradDr, tradCr, plDr, plCr, bsLib, bsAssets }
}

export default function ReportsPage() {
  const { isCA, user } = useAuthStore()
  const [fy, setFy] = useState('2024-25')
  const [selectedClient, setSelectedClient] = useState(null)
  const [activeTab, setActiveTab] = useState('all')

  const { data: myProfile } = useQuery({
    queryKey: ['my-profile', user?.id],
    queryFn: () => authAPI.myProfile().then(r => r.data),
    enabled: !isCA(),
  })

  const clientId = isCA() ? selectedClient?.id : myProfile?.profile?.id
  const clientName = isCA() ? selectedClient?.business_name : myProfile?.profile?.business_name

  const { data: icai, isLoading } = useQuery({
    queryKey: ['icai-complete', fy, clientId],
    queryFn: () => reportsAPI.icaiComplete({ financial_year: fy, client_id: clientId }).then(r => r.data),
    enabled: !!clientId,
    // Always show — even when no data, show zero tables
  })

  const accounts = buildAccounts(icai)
  const hasData = icai?.has_data

  const gp = parseFloat(icai?.trading_account?.gross_profit ?? 0)
  const np = parseFloat(icai?.profit_loss_account?.net_profit ?? 0)
  const ta = parseFloat(icai?.balance_sheet?.assets_side?.total_assets ?? 0)
  const tlc = parseFloat(icai?.balance_sheet?.liabilities_side?.total_liabilities_capital ?? 0)
  const isBalanced = icai?.balance_sheet?.is_balanced

  const tabs = [
    { id: 'all', label: 'All Accounts' },
    { id: 'manufacturing', label: 'Manufacturing A/c' },
    { id: 'trading', label: 'Trading A/c' },
    { id: 'pl', label: 'Profit & Loss A/c' },
    { id: 'bs', label: 'Balance Sheet' },
  ]

  const showAccount = (id) => activeTab === 'all' || activeTab === id

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financial Reports</h1>
          <p className="text-sm text-gray-500">ICAI Standard Format — All 4 Accounts</p>
        </div>
        <select className="input w-36" value={fy} onChange={e => setFy(e.target.value)}>
          {FY_OPTIONS.map(y => <option key={y}>{y}</option>)}
        </select>
      </div>

      {isCA() && (
        <div className="card p-4">
          <ClientSelector selectedClient={selectedClient} onSelect={setSelectedClient} label="Client:" />
        </div>
      )}

      {!clientId ? (
        <div className="card p-10 text-center text-gray-400">
          <Users size={40} className="mx-auto mb-3 opacity-40" />
          <p>{isCA() ? 'Select a client to view their financial reports' : 'Complete your profile to view reports'}</p>
        </div>
      ) : isLoading ? (
        <div className="flex justify-center py-20"><div className="spinner w-8 h-8" /></div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Total Income', value: icai?.summary?.total_income ?? 0, color: 'text-green-700' },
              { label: 'Gross Profit / (Loss)', value: gp, color: gp >= 0 ? 'text-blue-700' : 'text-red-600' },
              { label: 'Net Profit / (Loss)', value: np, color: np >= 0 ? 'text-green-700' : 'text-red-600' },
              { label: 'Net GST Payable', value: icai?.summary?.net_gst_payable ?? 0, color: 'text-orange-600' },
            ].map(({ label, value, color }) => (
              <div key={label} className="card p-4">
                <p className="text-xs text-gray-500">{label}</p>
                <p className={`text-lg font-bold mt-1 ${color}`}>
                  {value < 0 ? '(' : ''}₹{Math.abs(parseFloat(value)).toLocaleString('en-IN')}{value < 0 ? ')' : ''}
                </p>
              </div>
            ))}
          </div>

          {!hasData && (
            <div className="card p-3 bg-amber-50 border-amber-200 text-sm text-amber-800">
              ⚠ No validated data yet — all figures show as ₹0. Upload documents or submit manual entries for CA approval.
            </div>
          )}

          {/* Account selector tabs */}
          <div className="flex flex-wrap gap-2">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === t.id ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Manufacturing Account */}
          {showAccount('manufacturing') && (
            <TAccount
              title="MANUFACTURING ACCOUNT"
              subtitle={`For the year ended 31st March ${fy.split('-')[1] ? '20' + fy.split('-')[1] : ''}`}
              drLabel="Dr — Inputs & Expenses"
              crLabel="Cr — Output"
              drItems={accounts.mfgDr}
              crItems={accounts.mfgCr}
              drTotal={Object.values(accounts.mfgDr).reduce((s,v) => s + parseFloat(v||0), 0)}
              crTotal={Object.values(accounts.mfgCr).reduce((s,v) => s + parseFloat(v||0), 0)}
            />
          )}

          {/* Trading Account */}
          {showAccount('trading') && (
            <TAccount
              title="TRADING ACCOUNT"
              subtitle={`For the year ended 31st March — FY ${fy}`}
              drLabel="Dr — Purchases & Direct Expenses"
              crLabel="Cr — Sales & Closing Stock"
              drItems={accounts.tradDr}
              crItems={accounts.tradCr}
              drTotal={Object.values(accounts.tradDr).reduce((s,v) => s + parseFloat(v||0), 0)}
              crTotal={Object.values(accounts.tradCr).reduce((s,v) => s + parseFloat(v||0), 0)}
            />
          )}

          {/* P&L Account */}
          {showAccount('pl') && (
            <TAccount
              title="PROFIT & LOSS ACCOUNT"
              subtitle={`For the year ended 31st March — FY ${fy}`}
              drLabel="Dr — Indirect Expenses"
              crLabel="Cr — Gross Profit & Other Income"
              drItems={accounts.plDr}
              crItems={accounts.plCr}
              drTotal={Object.values(accounts.plDr).reduce((s,v) => s + parseFloat(v||0), 0)}
              crTotal={Object.values(accounts.plCr).reduce((s,v) => s + parseFloat(v||0), 0)}
            />
          )}

          {/* Balance Sheet */}
          {showAccount('bs') && (
            <>
              <TAccount
                title="BALANCE SHEET"
                subtitle={`As at 31st March — FY ${fy}`}
                drLabel="Liabilities & Capital"
                crLabel="Assets"
                drItems={accounts.bsLib}
                crItems={accounts.bsAssets}
                drTotal={tlc}
                crTotal={ta}
              />
              <div className={`card p-3 text-sm text-center font-medium ${isBalanced ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                {isBalanced
                  ? '✓ Balance Sheet is balanced — Total Assets = Total Liabilities + Capital'
                  : '⚠ Balance Sheet does not balance — upload more documents or check entries'}
              </div>
            </>
          )}

          <div className="card p-4 bg-gray-50 text-xs text-gray-500">
            <p className="font-semibold mb-1">Notes:</p>
            <p>1. All figures in Indian Rupees (₹). Values in brackets () represent losses/negative figures.</p>
            <p>2. Figures marked ₹0 indicate no data available — upload documents or submit manual entries.</p>
            <p>3. Depreciation calculated on Written Down Value (WDV) basis as per Income Tax Act.</p>
            <p>4. This report is auto-generated from validated transactions. Have your CA verify before filing.</p>
          </div>
        </>
      )}
    </div>
  )
}
