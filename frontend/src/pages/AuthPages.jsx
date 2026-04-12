import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import useAuthStore from '../store/authStore'
import { Eye, EyeOff, LogIn, Shield } from 'lucide-react'

export function LoginPage() {
  const { register, handleSubmit, formState: { errors } } = useForm()
  const { login, isLoading } = useAuthStore()
  const navigate = useNavigate()
  const [showPwd, setShowPwd] = useState(false)

  const onSubmit = async (data) => {
    const result = await login(data.email, data.password)
    if (result.success) {
      toast.success(`Welcome back!`)
      navigate('/dashboard')
    } else {
      toast.error(result.error || 'Login failed')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-700 to-primary-600 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gold-400 rounded-2xl mb-4 shadow-lg">
            <span className="text-2xl font-bold text-primary-900">AJ</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Ajit Joshi Finance Services</h1>
          <p className="text-primary-200 mt-1 text-sm">Professional CA Services Platform</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-6 text-center">Sign in to your account</h2>
          
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="label">Email Address</label>
              <input
                type="email"
                className="input"
                placeholder="your@email.com"
                autoComplete="email"
                {...register('email', { required: 'Email is required' })}
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  className="input pr-10"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  {...register('password', { required: 'Password is required' })}
                />
                <button type="button" onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
            </div>

            <button type="submit" disabled={isLoading}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-base">
              {isLoading ? (
                <div className="spinner w-5 h-5" />
              ) : (
                <><LogIn size={18} /> Sign In</>
              )}
            </button>
          </form>

          <div className="mt-6 flex items-center gap-2 justify-center text-xs text-gray-400">
            <Shield size={12} />
            <span>Secured with 256-bit encryption</span>
          </div>

          <p className="mt-4 text-center text-sm text-gray-500">
            New client?{' '}
            <Link to="/register" className="text-primary-600 font-medium hover:underline">
              Contact your CA to get access
            </Link>
          </p>
        </div>

        <p className="text-center text-primary-300 text-xs mt-6">
          © {new Date().getFullYear()} Ajit Joshi Finance Services. All rights reserved.
        </p>
      </div>
    </div>
  )
}

export function RegisterPage() {
  const { register, handleSubmit, watch, formState: { errors } } = useForm()
  const { register: registerUser, isLoading } = useAuthStore()
  const navigate = useNavigate()

  const onSubmit = async (data) => {
    const result = await registerUser({
      email: data.email,
      password: data.password,
      full_name: data.full_name,
      phone: data.phone,
      role: 'client',
    })
    if (result.success) {
      toast.success('Account created successfully!')
      navigate('/dashboard')
    } else {
      toast.error(result.error || 'Registration failed')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-700 to-primary-600 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gold-400 rounded-2xl mb-4">
            <span className="text-2xl font-bold text-primary-900">AJ</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Ajit Joshi Finance Services</h1>
          <p className="text-primary-200 mt-1 text-sm">Create your client account</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-6 text-center">Create Account</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="label">Full Name</label>
              <input className="input" placeholder="Your full name"
                {...register('full_name', { required: 'Name is required' })} />
              {errors.full_name && <p className="text-red-500 text-xs mt-1">{errors.full_name.message}</p>}
            </div>

            <div>
              <label className="label">Email Address</label>
              <input type="email" className="input" placeholder="your@email.com" autoComplete="email"
                {...register('email', { required: 'Email is required' })} />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="label">Phone Number</label>
              <input className="input" placeholder="+91 98765 43210"
                {...register('phone')} />
            </div>

            <div>
              <label className="label">Password</label>
              <input type="password" className="input" placeholder="Min 8 characters" autoComplete="new-password"
                {...register('password', { required: 'Password is required', minLength: { value: 6, message: 'Minimum 6 characters' } })} />
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
            </div>

            <div>
              <label className="label">Confirm Password</label>
              <input type="password" className="input" placeholder="Re-enter password"
                {...register('confirm_password', {
                  required: 'Please confirm password',
                  validate: (v) => v === watch('password') || 'Passwords do not match'
                })} />
              {errors.confirm_password && <p className="text-red-500 text-xs mt-1">{errors.confirm_password.message}</p>}
            </div>

            <button type="submit" disabled={isLoading}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3 mt-2">
              {isLoading ? <div className="spinner w-4 h-4" /> : 'Create Account'}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-gray-600">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-600 font-medium hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
