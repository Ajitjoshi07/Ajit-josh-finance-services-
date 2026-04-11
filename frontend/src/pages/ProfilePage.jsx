import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { authAPI } from '../services/api'
import useAuthStore from '../store/authStore'
import { User, Building, Phone, Mail, MapPin, Shield, Key, Save, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react'

const BUSINESS_TYPES = [
  { value: 'proprietorship', label: 'Proprietorship' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'pvt_ltd', label: 'Private Limited' },
  { value: 'llp', label: 'LLP' },
  { value: 'public_ltd', label: 'Public Limited' },
  { value: 'trust', label: 'Trust / Society' },
  { value: 'huf', label: 'HUF' },
  { value: 'individual', label: 'Individual' },
]

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu & Kashmir', 'Ladakh', 'Puducherry', 'Chandigarh',
]

export default function ProfilePage() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [tab, setTab] = useState('profile')
  const [showPwd, setShowPwd] = useState(false)
  const [showNewPwd, setShowNewPwd] = useState(false)

  const { data: myProfile, isLoading } = useQuery({
    queryKey: ['my-profile'],
    queryFn: () => authAPI.myProfile().then(r => r.data),
  })

  const { register: regBusiness, handleSubmit: handleBusiness, formState: { errors: bizErrors } } = useForm()
  const { register: regPwd, handleSubmit: handlePwd, reset: resetPwd, formState: { errors: pwdErrors } } = useForm()

  const saveProfile = useMutation({
    mutationFn: (data) => authAPI.updateMyProfile(data),
    onSuccess: () => {
      toast.success('Profile saved successfully!')
      qc.invalidateQueries(['my-profile'])
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Failed to save profile'),
  })

  const changePassword = useMutation({
    mutationFn: ({ old_password, new_password }) => authAPI.changePassword(old_password, new_password),
    onSuccess: () => { toast.success('Password changed!'); resetPwd() },
    onError: (e) => toast.error(e.response?.data?.detail || 'Failed to change password'),
  })

  if (isLoading) return (
    <div className="flex justify-center items-center py-32">
      <div className="spinner w-10 h-10" />
    </div>
  )

  const profile = myProfile?.profile
  const userInfo = myProfile?.user || user
  const isProfileComplete = profile && profile.pan && profile.business_name && profile.gstin

  const tabs = [
    { id: 'profile', label: 'Personal Info', icon: User },
    { id: 'business', label: 'Business Profile', icon: Building },
    { id: 'security', label: 'Security', icon: Shield },
  ]

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Account</h1>
        <p className="text-sm text-gray-500 mt-1">View and update your profile information</p>
      </div>

      {/* Profile incomplete banner */}
      {!isProfileComplete && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800">Complete your business profile</p>
            <p className="text-sm text-amber-700 mt-0.5">
              Add your PAN, GSTIN and business details to enable GST filing, ITR preparation and all other features.
              Click the <strong>Business Profile</strong> tab below to get started.
            </p>
          </div>
        </div>
      )}

      {isProfileComplete && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle size={20} className="text-green-600" />
          <p className="text-sm text-green-800 font-medium">Profile complete — all features are enabled</p>
        </div>
      )}

      {/* Profile Header */}
      <div className="card p-6">
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 bg-primary-600 rounded-2xl flex items-center justify-center text-white text-3xl font-bold">
            {userInfo?.full_name?.[0] || 'U'}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900">{userInfo?.full_name}</h2>
            <p className="text-gray-500 text-sm">{userInfo?.email}</p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="badge-info capitalize">{userInfo?.role}</span>
              <span className={userInfo?.is_active ? 'badge-success' : 'badge-danger'}>
                {userInfo?.is_active ? 'Active' : 'Inactive'}
              </span>
              {profile?.business_name && (
                <span className="badge-gray">{profile.business_name}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit flex-wrap">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === id ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            <Icon size={16} />{label}
            {id === 'business' && !isProfileComplete && (
              <span className="w-2 h-2 bg-amber-500 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Personal Info Tab */}
      {tab === 'profile' && (
        <div className="card p-6 space-y-4">
          <h3 className="font-semibold text-gray-900">Personal Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { label: 'Full Name', value: userInfo?.full_name, icon: User },
              { label: 'Email Address', value: userInfo?.email, icon: Mail },
              { label: 'Phone Number', value: userInfo?.phone || 'Not provided', icon: Phone },
              { label: 'Account Role', value: userInfo?.role, icon: Shield },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl">
                <div className="p-2 bg-white rounded-lg shadow-sm flex-shrink-0">
                  <Icon size={16} className="text-primary-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="font-medium text-gray-900 capitalize mt-0.5">{value}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400">Contact your CA to update personal information.</p>
        </div>
      )}

      {/* Business Profile Tab */}
      {tab === 'business' && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold text-gray-900">Business Profile</h3>
            {!isProfileComplete && (
              <span className="badge-warning flex items-center gap-1">
                <AlertCircle size={12} /> Incomplete
              </span>
            )}
            {isProfileComplete && (
              <span className="badge-success flex items-center gap-1">
                <CheckCircle size={12} /> Complete
              </span>
            )}
          </div>

          <form onSubmit={handleBusiness((data) => saveProfile.mutate(data))} className="space-y-5">
            {/* Business Identity */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Business Identity</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Business / Trade Name <span className="text-red-500">*</span></label>
                  <input className="input" placeholder="e.g. Ajit Trading Co."
                    defaultValue={profile?.business_name || ''}
                    {...regBusiness('business_name', { required: 'Business name is required' })} />
                  {bizErrors.business_name && <p className="text-red-500 text-xs mt-1">{bizErrors.business_name.message}</p>}
                </div>
                <div>
                  <label className="label">Business Type <span className="text-red-500">*</span></label>
                  <select className="input" defaultValue={profile?.business_type || ''}
                    {...regBusiness('business_type', { required: 'Select business type' })}>
                    <option value="">Select type...</option>
                    {BUSINESS_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                  {bizErrors.business_type && <p className="text-red-500 text-xs mt-1">{bizErrors.business_type.message}</p>}
                </div>
                <div>
                  <label className="label">PAN Number <span className="text-red-500">*</span></label>
                  <input className="input font-mono uppercase" placeholder="ABCDE1234F"
                    maxLength={10} defaultValue={profile?.pan || ''}
                    {...regBusiness('pan', {
                      required: 'PAN is required',
                      pattern: { value: /^[A-Z]{5}[0-9]{4}[A-Z]$/, message: 'Invalid PAN format (e.g. ABCDE1234F)' }
                    })} />
                  {bizErrors.pan && <p className="text-red-500 text-xs mt-1">{bizErrors.pan.message}</p>}
                </div>
                <div>
                  <label className="label">GSTIN</label>
                  <input className="input font-mono uppercase" placeholder="27ABCDE1234F1Z5"
                    maxLength={15} defaultValue={profile?.gstin || ''}
                    {...regBusiness('gstin')} />
                  <p className="text-xs text-gray-400 mt-1">Leave blank if not registered for GST</p>
                </div>
                <div>
                  <label className="label">GST Registration Date</label>
                  <input type="date" className="input"
                    defaultValue={profile?.registration_date || ''}
                    {...regBusiness('registration_date')} />
                </div>
                <div>
                  <label className="label">Financial Year</label>
                  <select className="input" defaultValue={profile?.current_financial_year || '2024-25'}
                    {...regBusiness('current_financial_year')}>
                    {['2024-25', '2023-24', '2022-23', '2021-22'].map(fy => (
                      <option key={fy} value={fy}>{fy}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Address */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Address Details</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="label">Full Address</label>
                  <textarea className="input" rows={2} placeholder="Shop/Office No., Street, Area"
                    defaultValue={profile?.address || ''}
                    {...regBusiness('address')} />
                </div>
                <div>
                  <label className="label">State</label>
                  <select className="input" defaultValue={profile?.state || ''}
                    {...regBusiness('state')}>
                    <option value="">Select state...</option>
                    {INDIAN_STATES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Pincode</label>
                  <input className="input" placeholder="411001" maxLength={6}
                    defaultValue={profile?.pincode || ''}
                    {...regBusiness('pincode')} />
                </div>
              </div>
            </div>

            {/* Read-only stats */}
            {profile && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Status Information</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    ['GSTN Status', profile.gstn_status || 'Not verified'],
                    ['Risk Score', `${((profile.risk_score || 0) * 100).toFixed(0)}%`],
                    ['Current FY', profile.current_financial_year || '2024-25'],
                  ].map(([label, value]) => (
                    <div key={label} className="bg-gray-50 rounded-xl p-3">
                      <p className="text-xs text-gray-500">{label}</p>
                      <p className="font-semibold text-gray-900 mt-1">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={saveProfile.isPending}
                className="btn-primary flex items-center gap-2">
                <Save size={16} />
                {saveProfile.isPending ? 'Saving...' : profile ? 'Update Profile' : 'Save Profile'}
              </button>
              {!profile && (
                <p className="text-sm text-gray-500 self-center">
                  Fill in the required fields (*) to complete your profile
                </p>
              )}
            </div>
          </form>
        </div>
      )}

      {/* Security Tab */}
      {tab === 'security' && (
        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 mb-5">Change Password</h3>
          <form onSubmit={handlePwd((data) => changePassword.mutate(data))} className="space-y-4 max-w-sm">
            <div>
              <label className="label">Current Password</label>
              <div className="relative">
                <input type={showPwd ? 'text' : 'password'} className="input pr-10"
                  placeholder="Your current password"
                  {...regPwd('old_password', { required: 'Current password required' })} />
                <button type="button" onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {pwdErrors.old_password && <p className="text-red-500 text-xs mt-1">{pwdErrors.old_password.message}</p>}
            </div>
            <div>
              <label className="label">New Password</label>
              <div className="relative">
                <input type={showNewPwd ? 'text' : 'password'} className="input pr-10"
                  placeholder="Min 8 characters"
                  {...regPwd('new_password', {
                    required: 'New password required',
                    minLength: { value: 8, message: 'Minimum 8 characters' }
                  })} />
                <button type="button" onClick={() => setShowNewPwd(!showNewPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showNewPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {pwdErrors.new_password && <p className="text-red-500 text-xs mt-1">{pwdErrors.new_password.message}</p>}
            </div>
            <button type="submit" disabled={changePassword.isPending}
              className="btn-primary flex items-center gap-2">
              <Key size={16} />
              {changePassword.isPending ? 'Changing...' : 'Change Password'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
