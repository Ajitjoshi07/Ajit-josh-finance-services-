import React, { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { authAPI } from '../services/api'
import useAuthStore from '../store/authStore'
import { User, Building2, Shield, CheckCircle, Eye, EyeOff, Save, Lock } from 'lucide-react'

const STATES = ['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal','Delhi','Jammu & Kashmir','Ladakh','Puducherry','Chandigarh','Dadra & Nagar Haveli','Daman & Diu','Lakshadweep','Andaman & Nicobar Islands']
const BIZ_TYPES = ['Proprietorship','Partnership','LLP','Private Limited','Public Limited','HUF','Trust','Society','Government']
const FY_OPTIONS = ['2026-27','2025-26','2024-25','2023-24','2022-23']

export default function ProfilePage() {
  const { user, refreshUser } = useAuthStore()
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState('personal')
  const [showOld, setShowOld] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const isAdminOrCA = ['admin', 'ca'].includes(user?.role)

  const { data: profileData, refetch } = useQuery({
    queryKey: ['my-profile', user?.id],
    queryFn: () => authAPI.myProfile().then(r => r.data),
  })

  const profile = profileData?.profile
  const userInfo = profileData?.user || user

  // Profile form
  const profileForm = useForm()
  useEffect(() => {
    if (profile) {
      profileForm.reset({
        business_name: profile.business_name || '',
        business_type: profile.business_type || 'Proprietorship',
        pan: profile.pan || '',
        gstin: profile.gstin || '',
        address: profile.address || '',
        state: profile.state || 'Maharashtra',
        pincode: profile.pincode || '',
        registration_date: profile.registration_date || '',
        current_financial_year: profile.current_financial_year || '2024-25',
      })
    }
  }, [profile])

  const saveMutation = useMutation({
    mutationFn: (data) => authAPI.updateMyProfile(data),
    onSuccess: () => {
      toast.success('Profile saved successfully!')
      refetch()
      qc.invalidateQueries(['my-profile'])
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Failed to save profile'),
  })

  // Password form
  const pwdForm = useForm()
  const pwdMutation = useMutation({
    mutationFn: (data) => authAPI.changePassword(data.old_password, data.new_password),
    onSuccess: () => { toast.success('Password changed!'); pwdForm.reset() },
    onError: (e) => toast.error(e.response?.data?.detail || 'Failed'),
  })

  const isProfileComplete = isAdminOrCA || (profile && profile.pan && profile.business_name)

  const tabs = [
    { id: 'personal', label: 'Personal Info', icon: User },
    // Only show Business Profile tab for clients, or for admin/CA if they want
    ...(!isAdminOrCA ? [{ id: 'business', label: 'Business Profile', icon: Building2, dot: !isProfileComplete }] : []),
    { id: 'security', label: 'Security', icon: Shield },
  ]

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Account</h1>
        <p className="text-sm text-gray-500">View and update your profile information</p>
      </div>

      {/* Profile complete banner — ONLY for clients */}
      {!isAdminOrCA && !isProfileComplete && (
        <div className="card p-4 bg-amber-50 border-amber-200">
          <p className="font-semibold text-amber-800">⚠ Complete your business profile</p>
          <p className="text-sm text-amber-700 mt-1">
            Add your PAN, GSTIN and business details to enable GST filing, ITR and all features.
          </p>
        </div>
      )}

      {/* Admin/CA — no profile required banner */}
      {isAdminOrCA && (
        <div className="card p-4 bg-green-50 border-green-200">
          <div className="flex items-center gap-2">
            <CheckCircle size={16} className="text-green-600" />
            <p className="font-semibold text-green-800">
              You are logged in as <strong>{userInfo?.role?.toUpperCase()}</strong> — Ajit Joshi Finance Services
            </p>
          </div>
          <p className="text-sm text-green-700 mt-1">
            Full admin access enabled. No business profile required for your role.
          </p>
        </div>
      )}

      {/* User card */}
      <div className="card p-5 flex items-center gap-4">
        <div className="w-16 h-16 bg-primary-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold">
          {(userInfo?.full_name || 'U')[0].toUpperCase()}
        </div>
        <div>
          <p className="text-xl font-bold text-gray-900">{userInfo?.full_name}</p>
          <p className="text-sm text-gray-500">{userInfo?.email}</p>
          <div className="flex gap-2 mt-2">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${isAdminOrCA ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600'}`}>
              {userInfo?.role?.charAt(0).toUpperCase() + userInfo?.role?.slice(1)}
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Active</span>
            {!isAdminOrCA && profile?.business_name && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                {profile.business_name}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map(({ id, label, icon: Icon, dot }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === id ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            <Icon size={15} />
            {label}
            {dot && <span className="w-2 h-2 bg-amber-500 rounded-full" />}
          </button>
        ))}
      </div>

      {/* Personal Info Tab */}
      {activeTab === 'personal' && (
        <div className="card p-5 space-y-4">
          <h3 className="font-semibold text-gray-900">Personal Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { label: 'Full Name', value: userInfo?.full_name },
              { label: 'Email Address', value: userInfo?.email },
              { label: 'Phone Number', value: userInfo?.phone || '—' },
              { label: 'Account Role', value: userInfo?.role?.charAt(0).toUpperCase() + userInfo?.role?.slice(1) },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs text-gray-400 mb-1">{label}</p>
                <p className="font-medium text-gray-800">{value}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400">Contact your CA to update personal information.</p>
        </div>
      )}

      {/* Business Profile Tab — clients only */}
      {activeTab === 'business' && !isAdminOrCA && (
        <form onSubmit={profileForm.handleSubmit(d => saveMutation.mutate(d))} className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Business Profile</h3>
            {isProfileComplete ? (
              <span className="badge-success flex items-center gap-1"><CheckCircle size={12} />Complete</span>
            ) : (
              <span className="badge-warning">Incomplete</span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="label">Business / Trade Name *</label>
              <input className="input" placeholder="e.g. Mukesh Traders & Co."
                {...profileForm.register('business_name', { required: true })} />
            </div>
            <div>
              <label className="label">Business Type *</label>
              <select className="input" {...profileForm.register('business_type')}>
                {BIZ_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">PAN Number *</label>
              <input className="input font-mono uppercase" placeholder="ABCDE1234F" maxLength={10}
                {...profileForm.register('pan')} />
            </div>
            <div>
              <label className="label">GSTIN</label>
              <input className="input font-mono uppercase" placeholder="27ABCDE1234F1Z5" maxLength={15}
                {...profileForm.register('gstin')} />
              <p className="text-xs text-gray-400 mt-1">Leave blank if not GST registered</p>
            </div>
            <div>
              <label className="label">GST Registration Date</label>
              <input type="date" className="input" {...profileForm.register('registration_date')} />
            </div>
            <div>
              <label className="label">Financial Year</label>
              <select className="input" {...profileForm.register('current_financial_year')}>
                {FY_OPTIONS.map(y => <option key={y}>{y}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="label">Full Address</label>
              <textarea className="input h-20 resize-none" placeholder="Shop/Office No., Street, Area"
                {...profileForm.register('address')} />
            </div>
            <div>
              <label className="label">State</label>
              <select className="input" {...profileForm.register('state')}>
                {STATES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Pincode</label>
              <input className="input" placeholder="411004" maxLength={6}
                {...profileForm.register('pincode')} />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button type="submit" disabled={saveMutation.isPending}
              className="btn-primary flex items-center gap-2 px-6">
              {saveMutation.isPending ? <div className="spinner w-4 h-4" /> : <Save size={15} />}
              Save Profile
            </button>
          </div>
        </form>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <form onSubmit={pwdForm.handleSubmit(d => pwdMutation.mutate(d))} className="card p-5 space-y-4">
          <h3 className="font-semibold text-gray-900">Change Password</h3>
          <div>
            <label className="label">Current Password</label>
            <div className="relative">
              <input type={showOld ? 'text' : 'password'} className="input pr-10"
                {...pwdForm.register('old_password', { required: true })} />
              <button type="button" onClick={() => setShowOld(!showOld)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showOld ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
          <div>
            <label className="label">New Password</label>
            <div className="relative">
              <input type={showNew ? 'text' : 'password'} className="input pr-10"
                {...pwdForm.register('new_password', { required: true, minLength: 6 })} />
              <button type="button" onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
          <div>
            <label className="label">Confirm New Password</label>
            <input type="password" className="input"
              {...pwdForm.register('confirm_password', {
                required: true,
                validate: v => v === pwdForm.watch('new_password') || 'Passwords do not match'
              })} />
            {pwdForm.formState.errors.confirm_password && (
              <p className="text-red-500 text-xs mt-1">{pwdForm.formState.errors.confirm_password.message}</p>
            )}
          </div>
          <button type="submit" disabled={pwdMutation.isPending}
            className="btn-primary flex items-center gap-2">
            {pwdMutation.isPending ? <div className="spinner w-4 h-4" /> : <Lock size={15} />}
            Change Password
          </button>
        </form>
      )}
    </div>
  )
}
