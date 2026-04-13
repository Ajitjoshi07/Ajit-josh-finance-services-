import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { clientsAPI } from '../../services/api'
import { Users } from 'lucide-react'

/**
 * Reusable client selector for Admin/CA pages
 * Returns null for client users (they only see their own data)
 */
export default function ClientSelector({ selectedClient, onSelect, label = "Viewing data for:" }) {
  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients-list'],
    queryFn: () => clientsAPI.list().then(r => r.data),
    staleTime: 30000,
  })

  if (isLoading) return <div className="h-10 w-64 bg-gray-100 animate-pulse rounded-lg" />

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Users size={15} />
        <span>{label}</span>
      </div>
      <select
        className="input w-72 text-sm"
        value={selectedClient?.id || ''}
        onChange={e => {
          const c = clients.find(x => x.id === Number(e.target.value))
          onSelect(c || null)
        }}
      >
        <option value="">— Select a client —</option>
        {clients.map(c => (
          <option key={c.id} value={c.id}>
            {c.business_name || c.full_name} ({c.pan || c.email})
          </option>
        ))}
      </select>
      {selectedClient && (
        <div className="flex items-center gap-2 text-xs">
          <span className={`px-2 py-1 rounded-full font-medium ${selectedClient.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {selectedClient.is_active !== false ? 'Active' : 'Inactive'}
          </span>
          {selectedClient.gstin && (
            <span className="text-gray-400 font-mono">{selectedClient.gstin}</span>
          )}
        </div>
      )}
    </div>
  )
}

export function ClientSelectorCard({ selectedClient, onSelect }) {
  const { data: clients = [] } = useQuery({
    queryKey: ['clients-list'],
    queryFn: () => clientsAPI.list().then(r => r.data),
    staleTime: 30000,
  })

  if (selectedClient) return null // Already selected — don't show card

  return (
    <div className="card p-8 text-center">
      <Users size={48} className="mx-auto mb-4 text-gray-300" />
      <h3 className="font-semibold text-gray-700 mb-1">Select a Client</h3>
      <p className="text-sm text-gray-500 mb-4">Choose a client to view their data</p>
      <select
        className="input w-72 mx-auto block"
        value=""
        onChange={e => {
          const c = clients.find(x => x.id === Number(e.target.value))
          if (c) onSelect(c)
        }}
      >
        <option value="">— Select a client —</option>
        {clients.map(c => (
          <option key={c.id} value={c.id}>
            {c.business_name || c.full_name} ({c.pan || c.email})
          </option>
        ))}
      </select>
    </div>
  )
}
