import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { gstAPI, clientsAPI, authAPI } from '../services/api'
import useAuthStore from '../store/authStore'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { CheckCircle, Clock, Search, Users, TrendingUp } from 'lucide-react'
import toast from 'react-hot-toast'

const MONTHS = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar']
const FY_OPTIONS = ['2026-27','2025-26','2024-25','2023-24','2022-23']

function ClientSelector({ clients, selectedClient, onSelect }) {
  return (
    <div className="card p-4 mb-4">
      <label className="label">Select Client</label>
      <select className="input w-72" value={selectedClient?.id || ''} onChange={e => {
        const c = clients.find(x => x.id === Number(e.target.value))
        onSelect(c || null)
      }}>
        <option value="">— Select a client —</option>
        {clients.map(c => <option key={c.id} value={c.id}>{c.business_name} ({c.pan || 'No PAN'})</option>)}
      </select>
    </div>
  )
}

export default function GSTPage() {
  const { isCA, user } = useAuthStore()
  const qc = useQueryClient()
  const [fy, setFy] = useState('2024-25')
  const [gstin, setGstin] = useState('')
  const [gstinResult, setGstinResult] = useState(null)
  const [verifying, setVerifying] = useState(false)
  const [selectedClient, setSelectedClient] = useState(null)

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

  const { data: summary = [], isLoading } = useQuery({
    queryKey: ['gst-summary', fy, clientId],
    queryFn: () => gstAPI.summary({ financial_year: fy, client_id: clientId }).then(r => r.data),
    enabled: !!clientId,
  })

  const fileMutation = useMutation({
    mutationFn: ({ month }) => gstAPI.markFiled(clientId, fy, month),
    onSuccess: () => { toast.success('Month marked as filed!'); qc.invalidateQueries(['gst-summary']) },
    onError: (e) => toast.error(e.response?.data?.detail || 'Failed to update'),
  })

  const unfileMutation = useMutation({
    mutationFn: ({ month }) => gstAPI.unmarkFiled(clientId, fy, month),
    onSuccess: () => { toast.success('Reverted to pending'); qc.invalidateQueries(['gst-summary']) },
    onError: (e) => toast.error(e.response?.data?.detail || 'Failed'),
  })

  const chartData = summary.map((m, i) => ({
    month: MONTHS[i],
    'Output GST': parseFloat(m.output_gst || 0),
    'Input GST': parseFloat(m.input_gst || 0),
    'Net Payable': parseFloat(m.net_gst_payable || 0),
  }))

  const totalPayable = summary.reduce((s, m) => s + parseFloat(m.net_gst_payable || 0), 0)
  const filedCount = summary.filter(m => m.filing_status === 'filed').length

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
          <p className="text-sm text-gray-500">GSTR-1 & GSTR-3B management</p>
        </div>
        <select className="input w-36" value={fy} onChange={e => setFy(e.target.value)}>
          {FY_OPTIONS.map(y => <option key={y}>{y}</option>)}
        </select>
      </div>

      {isCA() && <ClientSelector clients={clients} selectedClient={selectedClient} onSelect={setSelectedClient} />}

      {!clientId && (
        <div className="card p-10 text-center text-gray-400">
          <Users size={40} className="mx-auto mb-3 opacity-40" />
          <p>{isCA() ? 'Select a client above to view GST data' : 'Complete your profile to view GST data'}</p>
        </div>
      )}

      {clientId && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card p-5">
              <p className="text-sm text-gray-500">Total Net GST Payable</p>
              <p className="text-2xl font-bold text-red-600 mt-1">₹{totalPayable.toLocaleString()}</p>
              <p className="text-xs text-gray-400 mt-1">FY {fy} — {clientName}</p>
            </div>
            <div className="card p-5">
              <p className="text-sm text-gray-500">Months Filed</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{filedCount}/12</p>
              <p className="text-xs text-gray-400 mt-1">GSTR-3B submissions</p>
            </div>
            <div className="card p-5">
              <p className="text-sm text-gray-500">Pending Months</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">{12 - filedCount}</p>
              <p className="text-xs text-gray-400 mt-1">Require action</p>
            </div>
          </div>

          {summary.length > 0 && (
            <div className="card p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Monthly GST Breakdown</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} />
                  <Tooltip formatter={v => `₹${v.toLocaleString()}`} />
                  <Bar dataKey="Output GST" fill="#6366f1" radius={[3,3,0,0]} />
                  <Bar dataKey="Input GST" fill="#10b981" radius={[3,3,0,0]} />
                  <Bar dataKey="Net Payable" fill="#ef4444" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="card">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Monthly Filing Status</h3>
              {isCA() && clientId && (
                <p className="text-xs text-gray-500">Click "Mark Filed" to update status</p>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    {['Month','Year','Sales','Purchases','Output GST','Input GST (ITC)','Net Payable','Status','Action'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {summary.map((m, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{m.month_name || MONTHS[i]}</td>
                      <td className="px-4 py-3 text-gray-600">{m.year}</td>
                      <td className="px-4 py-3">₹{parseFloat(m.total_sales||0).toLocaleString()}</td>
                      <td className="px-4 py-3">₹{parseFloat(m.total_purchases||0).toLocaleString()}</td>
                      <td className="px-4 py-3">₹{parseFloat(m.output_gst||0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-green-700">₹{parseFloat(m.input_gst||0).toLocaleString()}</td>
                      <td className="px-4 py-3 font-semibold text-red-600">₹{parseFloat(m.net_gst_payable||0).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        {m.filing_status === 'filed'
                          ? <span className="badge-success flex items-center gap-1 w-fit"><CheckCircle size={11}/>Filed</span>
                          : <span className="badge-warning flex items-center gap-1 w-fit"><Clock size={11}/>Pending</span>}
                      </td>
                      <td className="px-4 py-3">
                        {isCA() && clientId ? (
                          m.filing_status === 'filed' ? (
                            <button onClick={() => unfileMutation.mutate({ month: m.month })}
                              className="text-xs text-amber-600 hover:underline border border-amber-300 px-2 py-1 rounded">
                              Revert
                            </button>
                          ) : (
                            <button onClick={() => fileMutation.mutate({ month: m.month })}
                              className="text-xs text-white bg-green-600 hover:bg-green-700 px-2 py-1 rounded">
                              Mark Filed
                            </button>
                          )
                        ) : (
                          <span className="text-xs text-gray-400">CA only</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* GSTIN Verifier */}
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-4">GSTIN Verification Tool</h3>
            <div className="flex gap-3 mb-4">
              <input className="input flex-1 max-w-xs" placeholder="Enter GSTIN (e.g. 27ABCDE1234F1Z5)"
                value={gstin} onChange={e => setGstin(e.target.value.toUpperCase())} maxLength={15} />
              <button onClick={verifyGstin} disabled={verifying} className="btn-primary flex items-center gap-2">
                {verifying ? <div className="spinner w-4 h-4" /> : <Search size={16} />} Verify
              </button>
            </div>
            {gstinResult && (
              <div className={`p-4 rounded-lg ${gstinResult.error ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
                {gstinResult.error ? (
                  <p className="text-red-700 text-sm">{gstinResult.error}</p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                    {[['GSTIN',gstinResult.gstin],['Business Name',gstinResult.business_name],['Status',gstinResult.status],['Type',gstinResult.business_type],['State',gstinResult.state],['Risk Score',`${((gstinResult.risk_score||0)*100).toFixed(0)}%`]].map(([k,v])=>(
                      <div key={k}><p className="text-xs text-gray-500">{k}</p><p className="font-medium">{v}</p></div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
