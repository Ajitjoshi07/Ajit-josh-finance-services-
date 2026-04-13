import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { exportAPI, authAPI, clientsAPI } from '../services/api'
import useAuthStore from '../store/authStore'
import ClientSelector from '../components/shared/ClientSelector'
import { Download, FileSpreadsheet, BarChart3, Receipt, BookOpen, AlertCircle, CheckCircle, Users } from 'lucide-react'
import toast from 'react-hot-toast'

const FY_OPTIONS = ['2026-27','2025-26','2024-25','2023-24','2022-23','2021-22']

function ExportCard({ icon: Icon, title, description, color, onDownload }) {
  const [loading, setLoading] = useState(false)
  const handleClick = async () => {
    setLoading(true)
    try { await onDownload() }
    finally { setTimeout(() => setLoading(false), 2000) }
  }
  return (
    <div className="card p-5">
      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-xl ${color} flex-shrink-0`}><Icon size={22} className="text-white" /></div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-500 mt-1">{description}</p>
        </div>
        <button onClick={handleClick} disabled={loading}
          className="btn-primary flex items-center gap-2 flex-shrink-0 text-sm px-4">
          {loading ? <div className="spinner w-4 h-4" /> : <Download size={15} />}
          {loading ? 'Preparing...' : 'Download'}
        </button>
      </div>
    </div>
  )
}

export default function ExportPage() {
  const { isCA, isClient, user } = useAuthStore()
  const [fy, setFy] = useState('2024-25')
  const [selectedClient, setSelectedClient] = useState(null)

  const { data: myProfile } = useQuery({
    queryKey: ['my-profile', user?.id],
    queryFn: () => authAPI.myProfile().then(r => r.data),
    enabled: !isCA(),
  })

  const clientId = isCA() ? selectedClient?.id : myProfile?.profile?.id
  const clientName = isCA() ? selectedClient?.business_name : myProfile?.profile?.business_name

  const { data: summary } = useQuery({
    queryKey: ['export-summary', fy, clientId],
    queryFn: () => exportAPI.summary(fy, clientId).then(r => r.data),
    enabled: !!clientId,
  })

  // Use window.location.href for file downloads — this is the correct approach
  // The token is embedded in the URL as a query param which the backend reads
  const doDownload = (urlFn) => {
    if (!clientId) { toast.error('Select a client first'); return }
    const url = urlFn(fy, clientId)
    // Open in new tab to avoid page navigation, triggers file download
    const a = document.createElement('a')
    a.href = url
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    toast.success('Download started...')
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Export & CA File</h1>
          <p className="text-sm text-gray-500">Download financial data as Excel files</p>
        </div>
        <select className="input w-36" value={fy} onChange={e => setFy(e.target.value)}>
          {FY_OPTIONS.map(y => <option key={y}>{y}</option>)}
        </select>
      </div>

      {isCA() && (
        <div className="card p-4">
          <ClientSelector selectedClient={selectedClient} onSelect={setSelectedClient} label="Export data for:" />
        </div>
      )}

      {!clientId ? (
        <div className="card p-10 text-center text-gray-400">
          <Users size={40} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">{isCA() ? 'Select a client to export their data' : 'Complete your profile to enable exports'}</p>
        </div>
      ) : (
        <>
          {/* Summary */}
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Transactions', value: summary.data_summary?.total_transactions || 0 },
                { label: 'Total Documents', value: summary.data_summary?.total_documents || 0 },
                { label: 'Total Sales', value: `₹${((summary.data_summary?.total_sales || 0)/1000).toFixed(0)}K` },
                { label: 'Net Tax Payable', value: `₹${((summary.itr?.net_payable || 0)/1000).toFixed(0)}K` },
              ].map(({ label, value }) => (
                <div key={label} className="card p-4 text-center">
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="text-lg font-bold text-gray-900 mt-1">{value}</p>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-3">
            <h3 className="font-semibold text-gray-700">Available Downloads — {clientName} — FY {fy}</h3>

            <ExportCard
              icon={FileSpreadsheet}
              title="Transaction Register"
              description="All sales, purchases, expenses with GST breakup — for audit and CA review"
              color="bg-blue-600"
              onDownload={() => doDownload(exportAPI.transactionsUrl)}
            />
            <ExportCard
              icon={BarChart3}
              title="GST Summary"
              description="Monthly GSTR-1/3B data, output tax, ITC, net payable — all 12 months"
              color="bg-green-600"
              onDownload={() => doDownload(exportAPI.gstUrl)}
            />
            <ExportCard
              icon={Receipt}
              title="TDS Records"
              description="TDS deducted/deposited by quarter and section — Form 26Q data"
              color="bg-purple-600"
              onDownload={() => doDownload(exportAPI.tdsUrl)}
            />
            <ExportCard
              icon={BookOpen}
              title="Complete CA File"
              description="Full package — Transactions + GST + TDS + P&L + Balance Sheet + ITR Summary"
              color="bg-primary-700"
              onDownload={() => doDownload(exportAPI.completeUrl)}
            />
          </div>

          <div className="card p-4 bg-blue-50 border-blue-200 text-sm text-blue-800">
            <div className="flex items-start gap-2">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <p>All exports are based on <strong>validated transactions only</strong>. Upload documents or get manual entries approved by CA to populate data.</p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
