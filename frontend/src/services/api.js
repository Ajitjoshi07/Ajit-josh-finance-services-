import axios from 'axios'

const BASE = 'http://localhost:8000/api/v1'

const api = axios.create({
  baseURL: BASE,
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      const p = window.location.pathname
      if (p !== '/login' && p !== '/register') {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

const getToken = () => localStorage.getItem('token') || ''

export const authAPI = {
  login: (d) => api.post('/auth/login', d),
  register: (d) => api.post('/auth/register', d),
  me: () => api.get('/auth/me'),
  myProfile: () => api.get('/auth/my-profile'),
  updateMyProfile: (d) => api.put('/auth/my-profile', d),
  changePassword: (op, np) => api.put('/auth/change-password', null, { params: { old_password: op, new_password: np } }),
  adminCreateClient: (d) => api.post('/auth/admin/create-client', d),
}

export const documentsAPI = {
  list: (p) => api.get('/documents/', { params: p }),
  byCategory: (clientId, fy) => api.get(`/documents/by-client/${clientId}/categories`, { params: { financial_year: fy } }),
  upload: (fd) => api.post('/documents/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
  delete: (id) => api.delete(`/documents/${id}`),
  reprocess: (id) => api.post(`/documents/${id}/reprocess`),
  downloadUrl: (id) => `${BASE}/documents/${id}/download?token=${getToken()}`,
  viewUrl: (id) => `${BASE}/documents/${id}/view?token=${getToken()}`,
}

export const gstAPI = {
  summary: (p) => api.get('/gst/summary', { params: p }),
  gstr1: (p) => api.get('/gst/gstr1', { params: p }),
  gstr3b: (p) => api.get('/gst/gstr3b', { params: p }),
  markFiled: (id) => api.post(`/gst/file/${id}`),
  verifyGstin: (gstin) => api.get(`/gst/verify-gstin/${gstin}`),
  deadlines: (fy) => api.get('/gst/deadlines', { params: { financial_year: fy } }),
}

export const tdsAPI = {
  create: (d, p) => api.post('/tds/', d, { params: p }),
  quarterlySummary: (p) => api.get('/tds/quarterly-summary', { params: p }),
  sections: () => api.get('/tds/sections'),
}

export const itrAPI = {
  summary: (p) => api.get('/itr/summary', { params: p }),
  saveDraft: (p) => api.post('/itr/save-draft', null, { params: p }),
}

export const bookkeepingAPI = {
  trialBalance: (p) => api.get('/bookkeeping/trial-balance', { params: p }),
  chartOfAccounts: () => api.get('/bookkeeping/chart-of-accounts'),
  journalEntries: (p) => api.get('/bookkeeping/journal-entries', { params: p }),
}

export const reportsAPI = {
  profitLoss: (p) => api.get('/reports/profit-loss', { params: p }),
  balanceSheet: (p) => api.get('/reports/balance-sheet', { params: p }),
}

export const clientsAPI = {
  list: (p) => api.get('/clients/', { params: p }),
  dashboard: (id) => api.get(`/clients/${id}/dashboard`),
  fullProfile: (id) => api.get(`/clients/${id}/full-profile`),
}

export const adminAPI = {
  stats: () => api.get('/admin/stats'),
  users: () => api.get('/admin/users'),
  toggleUser: (id) => api.put(`/admin/users/${id}/toggle-active`),
  resetPassword: (id, pwd) => api.put(`/admin/users/${id}/reset-password`, null, { params: { new_password: pwd } }),
}

export const notificationsAPI = {
  list: () => api.get('/notifications/'),
  markRead: (id) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/mark-all-read'),
}

export const manualEntryAPI = {
  submit: (d) => api.post('/manual-entry/submit', d),
  myEntries: (fy) => api.get('/manual-entry/my-entries', { params: { financial_year: fy } }),
  pending: (p) => api.get('/manual-entry/pending', { params: p }),
  approve: (id) => api.put(`/manual-entry/approve/${id}`),
  approveBatch: (ids) => api.put('/manual-entry/approve-batch', ids),
  reject: (id, reason) => api.put(`/manual-entry/reject/${id}`, null, { params: { reason } }),
}

export const exportAPI = {
  summary: (fy, clientId) => api.get('/export/ca-file-summary', { params: { financial_year: fy, client_id: clientId } }),
  transactionsUrl: (fy, clientId) => `${BASE}/export/excel/transactions?financial_year=${fy}${clientId ? `&client_id=${clientId}` : ''}&token=${getToken()}`,
  gstUrl: (fy, clientId) => `${BASE}/export/excel/gst?financial_year=${fy}${clientId ? `&client_id=${clientId}` : ''}&token=${getToken()}`,
  tdsUrl: (fy, clientId) => `${BASE}/export/excel/tds?financial_year=${fy}${clientId ? `&client_id=${clientId}` : ''}&token=${getToken()}`,
  completeUrl: (fy, clientId) => `${BASE}/export/excel/complete?financial_year=${fy}${clientId ? `&client_id=${clientId}` : ''}&token=${getToken()}`,
}

export default api
