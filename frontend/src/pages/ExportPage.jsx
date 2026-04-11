import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { exportAPI, authAPI, clientsAPI } from '../services/api'
import useAuthStore from '../store/authStore'
import {
  Download, FileSpreadsheet, FileText, Package,
  CheckCircle, AlertCircle, BarChart3, Receipt, FilePen, BookOpen
} from 'lucide-react'

const FY_OPTIONS = ['2026-27', '2025-26', '2024-25', '2023-24', '2022-23', '2021-22']

function ExportCard({ icon: Icon, title, description, color, onDownload, loading }) {
  return (
    <div className="card p-5">
      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-xl ${color} flex-shrink-0`}>
          <Icon size={22} className="text-white" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-500 mt-1">{description}</p>
        </div>
        <button onClick={onDownload} disabled={loading}
          className="btn-primary flex items-center gap-2 flex-shrink-0">
          {loading ? <div className="spinner w-4 h-4" /> : <Download size={15} />}
          Export
        </button>
      </div>
    </div>
  )
}

export default function ExportPage() {
  const { isCA } = useAuthStore()
  const [fy, setFy] = useState('2024-25')
  const [selectedClientId, setSelectedClientId] = useState(null)
  const [downloading, setDownloading] = useState({})

  const { data: myProfile } = useQuery({
    queryKey: ['my-profile'],
    queryFn: () => authAPI.myProfile().then(r => r.data),
    enabled: !isCA(),
  })

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => clientsAPI.list().then(r => r.data),
    enabled: isCA(),
  })

  const clientId = isCA() ? selectedClientId : myProfile?.profile?.id
  const clientName = isCA()
    ? clients.find(c => c.id === selectedClientId)?.business_name
    : myProfile?.profile?.business_name

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['export-summary', fy, clientId],
    queryFn: () => exportAPI.summary(fy, clientId).then(r => r.data),
    enabled: !!clientId,
  })

  const download = (key, url) => {
    setDownloading(p => ({ ...p, [key]: true }))
    const a = document.createElement('a')
    a.href = url
    a.target = '_blank'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => setDownloading(p => ({ ...p, [key]: false })), 2000)
  }

  const exports = [
    {
      key: 'transactions',
      icon: Receipt,
      title: 'Transaction Register',
      description: 'All sales, purchases, expenses and bank entries with GST breakup',
      color: 'bg-blue-500',
      url: () => exportAPI.transactionsUrl(fy, clientId),
    },
    {
      key: 'gst',
      icon: BarChart3,
      title: 'GST Summary Report',
      description: 'Month-wise GSTR-1/3B data — Output GST, Input ITC, Net payable',
      color: 'bg-indigo-500',
      url: () => exportAPI.gstUrl(fy, clientId),
    },
    {
      key: 'tds',
      icon: FileText,
      title: 'TDS Records',
      description: 'Quarter-wise TDS deductions by section — 194C, 194J, 194H etc.',
      color: 'bg-red-500',
      url: () => exportAPI.tdsUrl(fy, clientId),
    },
    {
      key: 'complete',
      icon: Package,
      title: 'Complete CA File (All-in-One)',
      description: '8-sheet Excel — Transactions, Sales Register, Purchase Register, GST, TDS, P&L, Balance Sheet, ITR Summary',
      color: 'bg-green-600',
      url: () => exportAPI.completeUrl(fy, clientId),
    },
  ]

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Export & CA File</h1>
        <p className="text-sm text-gray-500 mt-1">
          Export financial data for CA verification, audit, and ITR filing
        </p>
      </div>

      {/* Filters */}
      <div className="card p-5 flex flex-wrap items-end gap-4">
        <div>
          <label className="label">Financial Year</label>
          <select className="input w-40" value={fy} onChange={e => setFy(e.target.value)}>
            {FY_OPTIONS.map(y => <option key={y}>{y}</option>)}
          </select>
        </div>
        {isCA() && (
          <div>
            <label className="label">Select Client</label>
            <select className="input w-60" value={selectedClientId || ''} onChange={e => setSelectedClientId(Number(e.target.value) || null)}>
              <option value="">— Select Client —</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.business_name}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Data Summary */}
      {clientId && summary && (
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-4">
            Data Summary — {summary.client?.name} — FY {fy}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Transactions', value: summary.data_summary?.total_transactions, icon: Receipt, color: 'text-blue-600' },
              { label: 'Total Documents', value: summary.data_summary?.total_documents, icon: FileText, color: 'text-purple-600' },
              { label: 'Total Sales', value: `₹${(summary.data_summary?.total_sales || 0).toLocaleString()}`, icon: BarChart3, color: 'text-green-600' },
              { label: 'Net GST Payable', value: `₹${(summary.gst?.total_payable || 0).toLocaleString()}`, icon: FilePen, color: 'text-red-600' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="text-center p-3 bg-gray-50 rounded-xl">
                <Icon size={20} className={`${color} mx-auto mb-1`} />
                <p className="text-lg font-bold text-gray-900">{value}</p>
                <p className="text-xs text-gray-500">{label}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            {[
              ['Total Purchases', `₹${(summary.data_summary?.total_purchases || 0).toLocaleString()}`],
              ['GST Months Filed', `${summary.gst?.months_filed || 0}/12`],
              ['Gross Income', `₹${(summary.itr?.gross_income || 0).toLocaleString()}`],
              ['Tax Liability', `₹${(summary.itr?.tax_liability || 0).toLocaleString()}`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between p-2 border border-gray-100 rounded-lg">
                <span className="text-gray-500">{k}</span>
                <span className="font-semibold">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!clientId && (
        <div className="card p-10 text-center text-gray-400">
          <FileSpreadsheet size={40} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">
            {isCA() ? 'Select a client to generate exports' : 'Complete your profile to export data'}
          </p>
        </div>
      )}

      {/* Export Options */}
      {clientId && (
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900">Export Options — FY {fy}</h3>
          {exports.map(exp => (
            <ExportCard
              key={exp.key}
              icon={exp.icon}
              title={exp.title}
              description={exp.description}
              color={exp.color}
              loading={downloading[exp.key]}
              onDownload={() => download(exp.key, exp.url())}
            />
          ))}
        </div>
      )}

      {/* CA File Instructions */}
      {clientId && (
        <div className="card p-5 bg-amber-50 border-amber-200">
          <h3 className="font-semibold text-amber-900 mb-3 flex items-center gap-2">
            <BookOpen size={18} />
            How to prepare the CA file for ITR filing
          </h3>
          <ol className="space-y-2 text-sm text-amber-800">
            {[
              'Download the "Complete CA File" — it has all 8 sheets in one Excel',
              'Print the P&L Statement and Balance Sheet sheets for CA signature',
              'Attach original TDS certificates (Form 16/16A) from clients/employers',
              'Attach Form 26AS downloaded from income tax portal',
              'CA reviews data, makes adjustments if needed, then signs',
              'File ITR using the verified data from the CA file',
            ].map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="w-5 h-5 bg-amber-600 text-white rounded-full text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}
