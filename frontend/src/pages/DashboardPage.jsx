import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { clientsAPI, adminAPI, gstAPI } from '../services/api'
import useAuthStore from '../store/authStore'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend
} from 'recharts'
import {
  FileText, Calculator, TrendingUp, AlertCircle,
  CheckCircle, Clock, Users, IndianRupee
} from 'lucide-react'

function StatCard({ icon: Icon, label, value, color, sub }) {
  return (
    <div className="card p-5 flex items-start gap-4">
      <div className={`p-3 rounded-xl ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

const MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar']

export default function DashboardPage() {
  const { user, isCA } = useAuthStore()

  const { data: adminStats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => adminAPI.stats().then(r => r.data),
    enabled: isCA(),
  })

  const { data: gstSummary } = useQuery({
    queryKey: ['gst-summary', '2024-25'],
    queryFn: () => gstAPI.summary({ financial_year: '2024-25' }).then(r => r.data),
  })

  const chartData = (gstSummary || []).map((m, i) => ({
    month: MONTHS[i],
    sales: parseFloat(m.total_sales || 0),
    purchases: parseFloat(m.total_purchases || 0),
    gst: parseFloat(m.net_gst_payable || 0),
  }))

  const totalSales = chartData.reduce((s, m) => s + m.sales, 0)
  const totalGST = chartData.reduce((s, m) => s + m.gst, 0)
  const filedCount = (gstSummary || []).filter(m => m.filing_status === 'filed').length
  const pendingCount = 12 - filedCount

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome, {user?.full_name?.split(' ')[0]} 👋
        </h1>
        <p className="text-gray-500 text-sm mt-1">Financial Year 2024–25 Overview</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          icon={IndianRupee} label="Total Sales (FY)" color="bg-blue-500"
          value={`₹${(totalSales / 100000).toFixed(1)}L`}
          sub="Current financial year"
        />
        <StatCard
          icon={Calculator} label="GST Payable" color="bg-amber-500"
          value={`₹${(totalGST / 1000).toFixed(1)}K`}
          sub="Net GST for year"
        />
        <StatCard
          icon={CheckCircle} label="Months Filed" color="bg-green-500"
          value={`${filedCount}/12`}
          sub="GSTR-3B filed"
        />
        <StatCard
          icon={Clock} label="Pending Filings" color="bg-red-500"
          value={pendingCount}
          sub="Action required"
        />
      </div>

      {/* Admin stats */}
      {isCA() && adminStats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Users} label="Total Clients" color="bg-purple-500" value={adminStats.total_clients} />
          <StatCard icon={Users} label="Active Clients" color="bg-teal-500" value={adminStats.active_clients} />
          <StatCard icon={FileText} label="Documents" color="bg-indigo-500" value={adminStats.total_documents} />
          <StatCard icon={AlertCircle} label="Pending OCR" color="bg-orange-500" value={adminStats.pending_documents} />
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Sales vs Purchases</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${v/1000}K`} />
              <Tooltip formatter={(v) => `₹${v.toLocaleString()}`} />
              <Legend />
              <Bar dataKey="sales" name="Sales" fill="#6366f1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="purchases" name="Purchases" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Monthly GST Payable</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${v/1000}K`} />
              <Tooltip formatter={(v) => `₹${v.toLocaleString()}`} />
              <Line
                type="monotone" dataKey="gst" name="Net GST"
                stroke="#ef4444" strokeWidth={2} dot={{ fill: '#ef4444' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* GST Status Table */}
      <div className="card">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Monthly GST Filing Status</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                {['Month', 'Sales', 'Purchases', 'Output GST', 'Input GST', 'Net Payable', 'Status'].map(h => (
                  <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(gstSummary || []).map((m, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{m.month_name || MONTHS[i]} {m.year}</td>
                  <td className="px-4 py-3">₹{parseFloat(m.total_sales || 0).toLocaleString()}</td>
                  <td className="px-4 py-3">₹{parseFloat(m.total_purchases || 0).toLocaleString()}</td>
                  <td className="px-4 py-3">₹{parseFloat(m.output_gst || 0).toLocaleString()}</td>
                  <td className="px-4 py-3">₹{parseFloat(m.input_gst || 0).toLocaleString()}</td>
                  <td className="px-4 py-3 font-semibold text-red-600">₹{parseFloat(m.net_gst_payable || 0).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={m.filing_status === 'filed' ? 'badge-success' : 'badge-warning'}>
                      {m.filing_status === 'filed' ? '✓ Filed' : 'Pending'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card p-5">
        <h3 className="font-semibold text-gray-900 mb-3">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          {[
            { label: '+ Upload Invoice', href: '/documents', cls: 'btn-primary' },
            { label: 'View GST Summary', href: '/gst', cls: 'btn-secondary' },
            { label: 'Generate P&L Report', href: '/reports', cls: 'btn-secondary' },
            { label: 'AI Assistant', href: '/chatbot', cls: 'btn-secondary' },
          ].map(({ label, href, cls }) => (
            <a key={label} href={href} className={cls}>{label}</a>
          ))}
        </div>
      </div>
    </div>
  )
}
// FY_OPTIONS updated - patched
