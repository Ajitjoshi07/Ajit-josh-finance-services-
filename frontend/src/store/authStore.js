import { create } from 'zustand'
import { authAPI } from '../services/api'

const safeParseUser = () => {
  try {
    const u = localStorage.getItem('user')
    return u ? JSON.parse(u) : null
  } catch {
    return null
  }
}

const useAuthStore = create((set, get) => ({
  user: safeParseUser(),
  token: localStorage.getItem('token') || null,
  isLoading: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null })
    try {
      const { data } = await authAPI.login({ email, password })
      // Store the ACTUAL user from login response — not cached
      localStorage.setItem('token', data.access_token)
      localStorage.setItem('user', JSON.stringify(data.user))
      set({ user: data.user, token: data.access_token, isLoading: false, error: null })
      return { success: true, user: data.user }
    } catch (err) {
      const error = err.response?.data?.detail || 'Login failed'
      set({ error, isLoading: false })
      return { success: false, error }
    }
  },

  register: async (formData) => {
    set({ isLoading: true, error: null })
    try {
      const { data } = await authAPI.register(formData)
      localStorage.setItem('token', data.access_token)
      localStorage.setItem('user', JSON.stringify(data.user))
      set({ user: data.user, token: data.access_token, isLoading: false, error: null })
      return { success: true }
    } catch (err) {
      const error = err.response?.data?.detail || 'Registration failed'
      set({ error, isLoading: false })
      return { success: false, error }
    }
  },

  // Refresh user from server to get latest role/info
  refreshUser: async () => {
    try {
      const { data } = await authAPI.me()
      localStorage.setItem('user', JSON.stringify(data))
      set({ user: data })
      return data
    } catch {
      return null
    }
  },

  logout: () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    set({ user: null, token: null, error: null })
  },

  // Role checks — always from current user object
  isAdmin: () => get().user?.role === 'admin',
  isCA: () => ['admin', 'ca'].includes(get().user?.role || ''),
  isClient: () => get().user?.role === 'client',
  getRole: () => get().user?.role || 'unknown',
}))

export default useAuthStore
