import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { clientsAPI, adminAPI, gstAPI, authAPI } from '../services/api'
import useAuthStore from '../store/authStore'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import { FileText, TrendingUp, AlertCircle, CheckCircle, Clock, Users, IndianRupee, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import ClientSelector from '../components/shared/ClientSelector'

const MONTHS = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar']

function StatCard({ icon: Icon, label, value, color, sub, to }) {
  const content = (
    <div className="card p-5 flex items-start gap-4 hover:shadow-md transition-shadow">
      <div className={`p-3 rounded-xl ${color}`}><Icon size={20} className="text-white" /></div>
      <div className="flex-1">
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
      {to && <ArrowRight size={16} className="text-gray-300 mt-1" />}
    </div>
  )
  return to ? <Link to={to}>{content}</Link> : content
}

// Admin dashboard showing a selected client's data
function AdminDashboard() {
  const [selectedClient, setSelectedClient] = useState(null)

  const { data: adminStats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => adminAPI.stats().then(r => r.data),
  })

  const { data: clientDash } = useQuery({
    queryKey: ['client-dash', selectedClient?.id],
    queryFn: () => clientsAPI.dashboard(selectedClient.id).then(r => r.data),
    enabled: !!selectedClient?.id,
  })

  const { data: gstSummary = [] } = useQuery({
    queryKey: ['gst-summary', selectedClient?.id],
    queryFn: () => gstAPI.summary({ financial_year: '2024-25', client_id: selectedClient.id }).then(r => r.data),
    enabled: !!selectedClient?.id,
  })

  const chartData = gstSummary.map((m, i) => ({
    month: MONTHS[i],
    Sales: parseFloat(m.total_sales || 0),
    Purchases: parseFloat(m.total_purchases || 0),
    'GST Payable': parseFloat(m.net_gst_payable || 0),
  }))

  const filedCount = gstSummary.filter(m => m.filing_status === 'filed').length

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Ajit Joshi Finance Services — CA Portal</p>
        </div>
        <ClientSelector selectedClient={selectedClient} onSelect={setSelectedClient} label="Client:" />
      </div>

      {/* Platform stats */}
      {adminStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={Users} label="Total Clients" value={adminStats.total_clients || 0} color="bg-primary-600" to="/clients" />
          <StatCard icon={Users} label="Active Clients" value={adminStats.active_clients || 0} color="bg-green-600" />
          <StatCard icon={FileText} label="Total Documents" value={adminStats.total_documents || 0} color="bg-blue-600" />
          <StatCard icon={Clock} label="Pending Docs (OCR)" value={adminStats.pending_documents || 0} color="bg-amber-500" />
        </div>
      )}

      {/* Client-specific data */}
      {!selectedClient ? (
        <div className="card p-10 text-center text-gray-400">
          <Users size={48} className="mx-auto mb-4 opacity-30" />
          <p className="font-medium text-gray-600">Select a client above to view their financial summary</p>
          <p className="text-sm mt-1">You can manage all clients from the Clients menu</p>
          <Link to="/clients" className="btn-primary mt-4 inline-flex items-center gap-2 text-sm">
            <Users size={14} /> Go to Clients
          </Link>
        </div>
      ) : (
        <>
          {/* Client header */}
          <div className="card p-4 bg-primary-50 border-primary-200">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center text-white font-bold">
                {(selectedClient.business_name || 'C')[0].toUpperCase()}
              </div>
              <div>
                <p className="font-bold text-primary-900">{selectedClient.business_name}</p>
                <p className="text-xs text-primary-600">PAN: {selectedClient.pan} | GSTIN: {selectedClient.gstin || 'Not Registered'} | FY: {selectedClient.current_fy}</p>
              </div>
            </div>
          </div>

          {/* Client stats */}
          {clientDash && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard icon={FileText} label="Documents" value={clientDash.stats?.documents_uploaded || 0} color="bg-blue-600" to="/documents" />
              <StatCard icon={CheckCircle} label="GST Months Filed" value={`${clientDash.stats?.gst_months_filed || 0}/12`} color="bg-green-600" to="/gst" />
              <StatCard icon={IndianRupee} label="Total Sales" value={`₹${((clientDash.stats?.total_sales || 0)/1000).toFixed(0)}K`} color="bg-emerald-600" to="/reports" />
              <StatCard icon={IndianRupee} label="Total Purchases" value={`₹${((clientDash.stats?.total_purchases || 0)/1000).toFixed(0)}K`} color="bg-violet-600" to="/reports" />
            </div>
          )}

          {/* GST Chart */}
          {gstSummary.length > 0 && (
            <div className="card p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Monthly GST Overview — {selectedClient.business_name}</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} />
                  <Tooltip formatter={v => `₹${Number(v).toLocaleString('en-IN')}`} />
                  <Legend />
                  <Bar dataKey="Sales" fill="#6366f1" radius={[3,3,0,0]} />
                  <Bar dataKey="Purchases" fill="#8b5cf6" radius={[3,3,0,0]} />
                  <Bar dataKey="GST Payable" fill="#ef4444" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-3 flex gap-4 text-sm text-gray-600">
                <span><CheckCircle size={13} className="inline text-green-500 mr-1" />{filedCount} months filed</span>
                <span><Clock size={13} className="inline text-amber-500 mr-1" />{12 - filedCount} pending</span>
              </div>
            </div>
          )}
        </>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { to: '/admin', label: 'Create Client', icon: Users, color: 'text-primary-600' },
          { to: '/manual-entry', label: 'Review Entries', icon: CheckCircle, color: 'text-green-600' },
          { to: '/gst', label: 'GST Filing', icon: FileText, color: 'text-blue-600' },
          { to: '/reports', label: 'Financial Reports', icon: TrendingUp, color: 'text-violet-600' },
        ].map(({ to, label, icon: Icon, color }) => (
          <Link key={to} to={to} className="card p-4 flex items-center gap-3 hover:shadow-md transition-all">
            <Icon size={18} className={color} />
            <span className="text-sm font-medium text-gray-700">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

// Client dashboard
function ClientDashboard() {
  const { user } = useAuthStore()

  const { data: myProfile } = useQuery({
    queryKey: ['my-profile', user?.id],
    queryFn: () => authAPI.myProfile().then(r => r.data),
  })

  const clientId = myProfile?.profile?.id
  const fy = myProfile?.profile?.current_financial_year || '2024-25'

  const { data: clientDash } = useQuery({
    queryKey: ['client-dash', clientId],
    queryFn: () => clientsAPI.dashboard(clientId).then(r => r.data),
    enabled: !!clientId,
  })

  const { data: gstSummary = [] } = useQuery({
    queryKey: ['gst-summary', clientId, fy],
    queryFn: () => gstAPI.summary({ financial_year: fy, client_id: clientId }).then(r => r.data),
    enabled: !!clientId,
  })

  const chartData = gstSummary.map((m, i) => ({
    month: MONTHS[i],
    Sales: parseFloat(m.total_sales || 0),
    Purchases: parseFloat(m.total_purchases || 0),
    'GST Payable': parseFloat(m.net_gst_payable || 0),
  }))

  const filedCount = gstSummary.filter(m => m.filing_status === 'filed').length
  const profile = myProfile?.profile

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome, {user?.full_name?.split(' ')[0] || 'Client'} 👋
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {profile?.business_name || 'Complete your profile to get started'} — FY {fy}
        </p>
      </div>

      {!profile ? (
        <div className="card p-6 bg-amber-50 border-amber-200">
          <p className="font-semibold text-amber-800">Complete your profile to enable all features</p>
          <p className="text-sm text-amber-700 mt-1">Add your PAN, GSTIN and business details</p>
          <Link to="/profile" className="btn-primary mt-3 inline-flex items-center gap-2 text-sm">
            Complete Profile <ArrowRight size={14} />
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={FileText} label="Documents" value={clientDash?.stats?.documents_uploaded || 0} color="bg-blue-600" to="/documents" />
            <StatCard icon={CheckCircle} label="GST Filed" value={`${filedCount}/12`} color="bg-green-600" to="/gst" />
            <StatCard icon={IndianRupee} label="Total Sales" value={`₹${((clientDash?.stats?.total_sales || 0)/1000).toFixed(0)}K`} color="bg-emerald-600" />
            <StatCard icon={IndianRupee} label="Total Purchases" value={`₹${((clientDash?.stats?.total_purchases || 0)/1000).toFixed(0)}K`} color="bg-violet-600" />
          </div>

          {gstSummary.length > 0 && (
            <div className="card p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Monthly Overview — FY {fy}</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} />
                  <Tooltip formatter={v => `₹${Number(v).toLocaleString('en-IN')}`} />
                  <Legend />
                  <Bar dataKey="Sales" fill="#6366f1" radius={[3,3,0,0]} />
                  <Bar dataKey="GST Payable" fill="#ef4444" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { to: '/documents', label: 'Upload Documents', icon: FileText, desc: 'Auto-updates all features' },
              { to: '/manual-entry', label: 'Enter Data Manually', icon: CheckCircle, desc: 'Submit for CA review' },
              { to: '/reports', label: 'View Reports', icon: TrendingUp, desc: 'P&L, Balance Sheet' },
            ].map(({ to, label, icon: Icon, desc }) => (
              <Link key={to} to={to} className="card p-4 hover:shadow-md transition-all">
                <Icon size={18} className="text-primary-600 mb-2" />
                <p className="font-medium text-gray-800 text-sm">{label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default function DashboardPage() {
  const { isCA } = useAuthStore()
  return isCA() ? <AdminDashboard /> : <ClientDashboard />
}
