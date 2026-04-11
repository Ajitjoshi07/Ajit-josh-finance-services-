import React, { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import useAuthStore from '../../store/authStore'
import { notificationsAPI } from '../../services/api'
import {
  LayoutDashboard, FileText, Calculator, Receipt, FilePen,
  BookOpen, BarChart3, Users, Settings, MessageSquare,
  LogOut, Menu, Bell, ChevronRight, Download, PenLine
} from 'lucide-react'
import clsx from 'clsx'

const navItems = [
  { to: '/dashboard',    icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/documents',    icon: FileText,         label: 'Documents' },
  { to: '/manual-entry', icon: PenLine,          label: 'Enter Data' },
  { to: '/gst',          icon: Calculator,       label: 'GST Filing' },
  { to: '/tds',          icon: Receipt,          label: 'TDS' },
  { to: '/itr',          icon: FilePen,          label: 'ITR' },
  { to: '/bookkeeping',  icon: BookOpen,          label: 'Bookkeeping' },
  { to: '/reports',      icon: BarChart3,         label: 'Reports' },
  { to: '/export',       icon: Download,          label: 'Export & CA File' },
  { to: '/chatbot',      icon: MessageSquare,     label: 'AI Assistant' },
]
const adminItems = [
  { to: '/clients', icon: Users,    label: 'Clients' },
  { to: '/admin',   icon: Settings, label: 'Admin' },
]

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showNotif, setShowNotif] = useState(false)
  const { user, logout, isCA } = useAuthStore()
  const navigate = useNavigate()

  const { data: notifications = [], refetch: refetchNotif } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsAPI.list().then(r => r.data),
    refetchInterval: 30000,
  })
  const unread = notifications.filter(n => !n.is_read).length

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-gradient-to-b from-primary-900 to-primary-700 text-white">
      <div className="px-6 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gold-400 rounded-lg flex items-center justify-center font-bold text-primary-900 text-sm">AJ</div>
          <div>
            <p className="font-semibold text-sm">Ajit Joshi</p>
            <p className="text-xs text-primary-200">Finance Services</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="px-3 py-1.5 text-xs font-semibold text-primary-300 uppercase tracking-wider">Main</p>
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} onClick={() => setSidebarOpen(false)}
            className={({ isActive }) => clsx(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all',
              isActive ? 'bg-white/20 text-white' : 'text-primary-200 hover:bg-white/10 hover:text-white'
            )}>
            <Icon size={16} /><span>{label}</span>
          </NavLink>
        ))}
        {isCA() && (
          <>
            <p className="px-3 py-1.5 mt-3 text-xs font-semibold text-primary-300 uppercase tracking-wider">Management</p>
            {adminItems.map(({ to, icon: Icon, label }) => (
              <NavLink key={to} to={to} onClick={() => setSidebarOpen(false)}
                className={({ isActive }) => clsx(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                  isActive ? 'bg-white/20 text-white' : 'text-primary-200 hover:bg-white/10 hover:text-white'
                )}>
                <Icon size={16} /><span>{label}</span>
              </NavLink>
            ))}
          </>
        )}
      </nav>
      <div className="px-3 py-4 border-t border-white/10">
        <NavLink to="/profile" onClick={() => setSidebarOpen(false)}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/10 transition-all mb-1">
          <div className="w-8 h-8 bg-gold-400 rounded-full flex items-center justify-center text-primary-900 font-semibold text-xs">
            {user?.full_name?.[0] || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.full_name}</p>
            <p className="text-xs text-primary-300 capitalize">{user?.role}</p>
          </div>
          <ChevronRight size={14} className="text-primary-300" />
        </NavLink>
        <button onClick={() => { logout(); navigate('/login') }}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-primary-200 hover:bg-white/10 hover:text-white transition-all">
          <LogOut size={15} />Sign out
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-gray-50">
      <div className="hidden lg:flex flex-shrink-0 w-60"><SidebarContent /></div>
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-64 z-50"><SidebarContent /></div>
        </div>
      )}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-4 flex-shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100">
            <Menu size={20} />
          </button>
          <div className="flex-1" />
          <div className="relative">
            <button onClick={() => { setShowNotif(!showNotif); refetchNotif() }}
              className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100">
              <Bell size={20} />
              {unread > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-white text-xs flex items-center justify-center font-medium">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>
            {showNotif && (
              <div className="absolute right-0 top-12 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 z-50">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <p className="font-semibold text-sm text-gray-900">Notifications</p>
                  <button onClick={() => notificationsAPI.markAllRead().then(() => refetchNotif())}
                    className="text-xs text-primary-600 hover:underline">Mark all read</button>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-8 text-center text-gray-400 text-sm">
                      <Bell size={24} className="mx-auto mb-2 opacity-30" />No notifications
                    </div>
                  ) : notifications.map(n => (
                    <div key={n.id} className={clsx('px-4 py-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50', !n.is_read && 'bg-blue-50')}
                      onClick={() => notificationsAPI.markRead(n.id).then(() => refetchNotif())}>
                      <p className="font-medium text-gray-900 text-sm">{n.title}</p>
                      <p className="text-gray-500 text-xs mt-0.5">{n.message}</p>
                      <p className="text-gray-400 text-xs mt-1">{new Date(n.created_at).toLocaleDateString('en-IN')}</p>
                    </div>
                  ))}
                </div>
                <button onClick={() => setShowNotif(false)}
                  className="w-full py-2 text-xs text-gray-500 hover:bg-gray-50 rounded-b-xl text-center">Close</button>
              </div>
            )}
          </div>
          <NavLink to="/profile" className="p-1.5 rounded-lg hover:bg-gray-100">
            <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-white text-xs font-semibold">
              {user?.full_name?.[0] || 'U'}
            </div>
          </NavLink>
        </header>
        <main className="flex-1 overflow-y-auto"><Outlet /></main>
      </div>
    </div>
  )
}
