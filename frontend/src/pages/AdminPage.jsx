import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { adminAPI, authAPI } from '../services/api'
import { Users, FileText, BarChart3, Plus, X, UserCheck, UserX, Key, Eye, EyeOff } from 'lucide-react'

function CreateClientModal({ onClose }) {
  const qc = useQueryClient()
  const { register, handleSubmit, formState: { errors } } = useForm()
  const [showPwd, setShowPwd] = useState(false)
  const [created, setCreated] = useState(null)

  const createMutation = useMutation({
    mutationFn: (data) => authAPI.adminCreateClient(data),
    onSuccess: (res) => {
      setCreated(res.data)
      qc.invalidateQueries(['admin-users'])
      qc.invalidateQueries(['clients'])
      toast.success('Client created successfully!')
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Failed to create client'),
  })

  if (created) return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="text-center mb-5">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <UserCheck size={28} className="text-green-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-900">Client Created!</h3>
          <p className="text-sm text-gray-500 mt-1">Share these credentials with the client</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm mb-5">
          <div className="flex justify-between">
            <span className="text-gray-500">Email:</span>
            <span className="font-semibold">{created.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Password:</span>
            <span className="font-semibold font-mono">{created.temp_password}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Login URL:</span>
            <span className="font-semibold text-primary-600">localhost:3000/login</span>
          </div>
        </div>
        <p className="text-xs text-amber-600 bg-amber-50 p-3 rounded-lg mb-4">
          ⚠️ Ask the client to change their password after first login.
        </p>
        <button onClick={onClose} className="btn-primary w-full">Done</button>
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-gray-900">Create New Client</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
          <div>
            <label className="label">Full Name</label>
            <input className="input" placeholder="Client's full name"
              {...register('full_name', { required: 'Name is required' })} />
            {errors.full_name && <p className="text-red-500 text-xs mt-1">{errors.full_name.message}</p>}
          </div>
          <div>
            <label className="label">Email</label>
            <input type="email" className="input" placeholder="client@example.com"
              {...register('email', { required: 'Email is required' })} />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" placeholder="+91 9876543210"
              {...register('phone')} />
          </div>
          <div>
            <label className="label">Password</label>
            <div className="relative">
              <input type={showPwd ? 'text' : 'password'} className="input pr-10"
                placeholder="Set initial password"
                {...register('password', { required: 'Password required', minLength: { value: 6, message: 'Min 6 characters' } })} />
              <button type="button" onClick={() => setShowPwd(!showPwd)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={createMutation.isPending} className="btn-primary flex-1">
              {createMutation.isPending ? 'Creating...' : 'Create Client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function AdminPage() {
  const qc = useQueryClient()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [resetUserId, setResetUserId] = useState(null)
  const [newPwd, setNewPwd] = useState('')

  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => adminAPI.stats().then(r => r.data),
  })
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => adminAPI.users().then(r => r.data),
  })

  const toggleMutation = useMutation({
    mutationFn: (id) => adminAPI.toggleUser(id),
    onSuccess: () => { toast.success('Updated'); qc.invalidateQueries(['admin-users']) },
  })

  const resetPwdMutation = useMutation({
    mutationFn: ({ id, pwd }) => adminAPI.resetPassword(id, pwd),
    onSuccess: () => { toast.success('Password reset!'); setResetUserId(null); setNewPwd('') },
    onError: (e) => toast.error(e.response?.data?.detail || 'Failed'),
  })

  const statCards = stats ? [
    { label: 'Total Clients', value: stats.total_clients, color: 'bg-blue-500', icon: Users },
    { label: 'Active Clients', value: stats.active_clients, color: 'bg-green-500', icon: UserCheck },
    { label: 'Total Documents', value: stats.total_documents, color: 'bg-purple-500', icon: FileText },
    { label: 'Pending OCR', value: stats.pending_documents, color: 'bg-amber-500', icon: BarChart3 },
  ] : []

  return (
    <div className="p-6 space-y-6">
      {showCreateModal && <CreateClientModal onClose={() => setShowCreateModal(false)} />}

      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-sm text-gray-500">Manage users, clients and system settings</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Create New Client
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map(({ label, value, color, icon: Icon }) => (
            <div key={label} className="card p-5 flex items-start gap-4">
              <div className={`p-3 rounded-xl ${color}`}><Icon size={18} className="text-white" /></div>
              <div>
                <p className="text-sm text-gray-500">{label}</p>
                <p className="text-2xl font-bold">{value ?? '—'}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Users Table */}
      <div className="card">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">All Users</h3>
          <span className="badge-gray">{users.length} users</span>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-16"><div className="spinner w-8 h-8" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  {['ID', 'Name', 'Email', 'Phone', 'Role', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500">#{u.id}</td>
                    <td className="px-4 py-3 font-medium">{u.full_name}</td>
                    <td className="px-4 py-3">{u.email}</td>
                    <td className="px-4 py-3 text-gray-500">{u.phone || '—'}</td>
                    <td className="px-4 py-3"><span className="badge-info capitalize">{u.role}</span></td>
                    <td className="px-4 py-3">
                      <span className={u.is_active ? 'badge-success' : 'badge-danger'}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => toggleMutation.mutate(u.id)}
                          className={`p-1.5 rounded hover:bg-gray-100 ${u.is_active ? 'text-red-500' : 'text-green-600'}`}
                          title={u.is_active ? 'Deactivate' : 'Activate'}>
                          {u.is_active ? <UserX size={15} /> : <UserCheck size={15} />}
                        </button>
                        {resetUserId === u.id ? (
                          <div className="flex items-center gap-1">
                            <input className="input text-xs w-24 py-1" placeholder="New pwd"
                              value={newPwd} onChange={e => setNewPwd(e.target.value)} />
                            <button onClick={() => resetPwdMutation.mutate({ id: u.id, pwd: newPwd })}
                              className="text-xs bg-primary-600 text-white px-2 py-1 rounded">Set</button>
                            <button onClick={() => setResetUserId(null)} className="text-xs text-gray-500">×</button>
                          </div>
                        ) : (
                          <button onClick={() => setResetUserId(u.id)}
                            className="p-1.5 rounded hover:bg-gray-100 text-amber-600" title="Reset Password">
                            <Key size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
