import React, { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import useAuthStore from './store/authStore'
import Layout from './components/shared/Layout'
import { LoginPage, RegisterPage } from './pages/AuthPages'
import DashboardPage from './pages/DashboardPage'
import DocumentsPage from './pages/DocumentsPage'
import GSTPage from './pages/GSTPage'
import TDSPage from './pages/TDSPage'
import ITRPage from './pages/ITRPage'
import BookkeepingPage from './pages/BookkeepingPage'
import ReportsPage from './pages/ReportsPage'
import ClientsPage from './pages/ClientsPage'
import AdminPage from './pages/AdminPage'
import { ChatbotPage } from './pages/AllPages'
import ProfilePage from './pages/ProfilePage'
import ExportPage from './pages/ExportPage'
import ManualEntryPage from './pages/ManualEntryPage'

function ProtectedRoute({ children, adminOnly = false }) {
  const { user } = useAuthStore()
  if (!user) return <Navigate to="/login" replace />
  if (adminOnly && !['admin', 'ca'].includes(user.role)) {
    return <Navigate to="/dashboard" replace />
  }
  return children
}

export default function App() {
  const { token, refreshUser } = useAuthStore()

  // Refresh user from server on app load to get correct role
  useEffect(() => {
    if (token) {
      refreshUser()
    }
  }, [token])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="documents" element={<DocumentsPage />} />
          <Route path="manual-entry" element={<ManualEntryPage />} />
          <Route path="gst" element={<GSTPage />} />
          <Route path="tds" element={<TDSPage />} />
          <Route path="itr" element={<ITRPage />} />
          <Route path="bookkeeping" element={<BookkeepingPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="export" element={<ExportPage />} />
          <Route path="chatbot" element={<ChatbotPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="clients" element={<ProtectedRoute adminOnly><ClientsPage /></ProtectedRoute>} />
          <Route path="admin" element={<ProtectedRoute adminOnly><AdminPage /></ProtectedRoute>} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
