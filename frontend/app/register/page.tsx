'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../contexts/AuthContext'
import { apiClient } from '../../utils/api'
import AppLayout from '../../components/AppLayout'

interface College {
  id: number
  name: string
  code: string
}

interface Department {
  id: number
  name: string
  code: string
  college: number
}

interface User {
  id: number
  email: string
  username: string
  full_name: string
  role: 'admin' | 'lecturer' | 'student'
  student_id?: string
  lecturer_id?: string
  department?: number
  level?: string
  is_active: boolean
  created_at: string
}

interface AuthToken {
  access: string
  refresh: string
  user: User
}

interface ApiError {
  response?: {
    data?: {
      message?: string
      [key: string]: any
    }
  }
}

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    full_name: '',
    password: '',
    confirm_password: '',
    role: 'student' as 'admin' | 'student' | 'lecturer',
    student_id: '',
    lecturer_id: '',
    college: '',
    department: '',
    level: '',
    referral_code: '',
  })
  const [colleges, setColleges] = useState<College[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{[key: string]: string}>({})
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const { register, isAuthenticated } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard')
    }
  }, [isAuthenticated, router])

  // Fetch colleges on component mount
  useEffect(() => {
    fetchColleges()
  }, [])

  // Fetch departments when college changes
  useEffect(() => {
    if (formData.college) {
      fetchDepartments(formData.college)
    } else {
      setDepartments([])
      setFormData(prev => ({ ...prev, department: '' }))
    }
  }, [formData.college])

  const fetchColleges = async () => {
    try {
      const response = await apiClient.get('/courses/colleges/')
      setColleges(response?.results || response || [])
    } catch (error) {
      console.error('Error fetching colleges:', error)
    }
  }

  const fetchDepartments = async (collegeId: string) => {
    try {
      const response = await apiClient.get(`/courses/departments/?college=${collegeId}`)
      setDepartments(response?.results || response || [])
    } catch (error) {
      console.error('Error fetching departments:', error)
    }
  }

  const validateForm = () => {
    const errors: {[key: string]: string} = {}
    
    // Email validation
    if (!formData.email) {
      errors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email address'
    }
    
    // Username validation
    if (!formData.username) {
      errors.username = 'Username is required'
    } else if (formData.username.length < 3) {
      errors.username = 'Username must be at least 3 characters long'
    }
    
    // Full name validation
    if (!formData.full_name) {
      errors.full_name = 'Full name is required'
    } else if (formData.full_name.length < 2) {
      errors.full_name = 'Full name must be at least 2 characters long'
    }
    
    // Password validation
    if (!formData.password) {
      errors.password = 'Password is required'
    } else if (formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters long'
    }
    
    // Confirm password validation
    if (!formData.confirm_password) {
      errors.confirm_password = 'Please confirm your password'
    } else if (formData.password !== formData.confirm_password) {
      errors.confirm_password = 'Passwords do not match'
    }
    
    // Role-specific validations
    if (formData.role === 'student') {
      if (!formData.student_id) {
        errors.student_id = 'Student ID is required for students'
      }
      if (!formData.college) {
        errors.college = 'College is required for students'
      }
      if (!formData.department) {
        errors.department = 'Department is required for students'
      }
      if (!formData.level) {
        errors.level = 'Level is required for students'
      }
    } else if (formData.role === 'lecturer') {
      if (!formData.lecturer_id) {
        errors.lecturer_id = 'Lecturer ID is required for lecturers'
      }
      if (!formData.referral_code) {
        errors.referral_code = 'Referral code is required for lecturer registration'
      }
    } else if (formData.role === 'admin') {
      if (!formData.referral_code) {
        errors.referral_code = 'Referral code is required for admin registration'
      }
    }
    
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (!validateForm()) {
      return
    }
    
    setLoading(true)
    
    try {
      // Prepare data for submission
      const submitData = {
        ...formData,
        department: formData.department ? parseInt(formData.department) : null,
      }
      
      const result = await register(submitData)
      if (result.success) {
        if (formData.role === 'student') {
          router.push('/dashboard')
        } else {
          // For admin/lecturer, show success message and redirect to login
          alert('Registration successful! Please wait for admin approval before logging in.')
          router.push('/login')
        }
      } else {
        setError(result.message || 'Registration failed')
      }
    } catch (error: any) {
      console.error('Registration error:', error)
      setError(error.response?.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    
    // Clear field error when user starts typing
    if (fieldErrors[name]) {
      setFieldErrors(prev => ({
        ...prev,
        [name]: ''
      }))
    }
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Create your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Or{' '}
            <a href="/login" className="font-medium text-blue-600 hover:text-blue-500">
              sign in to your existing account
            </a>
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800">Registration Error</h3>
                      <p className="mt-1 text-sm text-red-700">{error}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Role Selection */}
              <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                  Role <span className="text-red-500">*</span>
                </label>
                <select
                  id="role"
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                >
                  <option value="student">Student</option>
                  <option value="lecturer">Lecturer</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {/* Referral Code for Admin and Lecturer */}
              {(formData.role === 'admin' || formData.role === 'lecturer') && (
                <div>
                  <label htmlFor="referral_code" className="block text-sm font-medium text-gray-700">
                    Referral Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="referral_code"
                    name="referral_code"
                    type="text"
                    value={formData.referral_code}
                    onChange={handleChange}
                    className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                      fieldErrors.referral_code ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Enter referral code"
                  />
                  {fieldErrors.referral_code && (
                    <p className="mt-1 text-sm text-red-600">{fieldErrors.referral_code}</p>
                  )}
                  <p className="mt-1 text-sm text-gray-500">
                    A referral code is required for {formData.role} registration
                  </p>
                </div>
              )}

              {/* Personal Information */}
              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label htmlFor="full_name" className="block text-sm font-medium text-gray-700">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="full_name"
                    name="full_name"
                    type="text"
                    value={formData.full_name}
                    onChange={handleChange}
                    className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                      fieldErrors.full_name ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Enter your full name"
                  />
                  {fieldErrors.full_name && (
                    <p className="mt-1 text-sm text-red-600">{fieldErrors.full_name}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                      fieldErrors.email ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Enter your email address"
                  />
                  {fieldErrors.email && (
                    <p className="mt-1 text-sm text-red-600">{fieldErrors.email}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                    Username <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    value={formData.username}
                    onChange={handleChange}
                    className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                      fieldErrors.username ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Choose a username"
                  />
                  {fieldErrors.username && (
                    <p className="mt-1 text-sm text-red-600">{fieldErrors.username}</p>
                  )}
                </div>

                {/* Student-specific fields */}
                {formData.role === 'student' && (
                  <>
                    <div>
                      <label htmlFor="student_id" className="block text-sm font-medium text-gray-700">
                        Student ID <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="student_id"
                        name="student_id"
                        type="text"
                        value={formData.student_id}
                        onChange={handleChange}
                        className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                          fieldErrors.student_id ? 'border-red-300' : 'border-gray-300'
                        }`}
                        placeholder="Enter your student ID"
                      />
                      {fieldErrors.student_id && (
                        <p className="mt-1 text-sm text-red-600">{fieldErrors.student_id}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="college" className="block text-sm font-medium text-gray-700">
                        College/Faculty <span className="text-red-500">*</span>
                      </label>
                      <select
                        id="college"
                        name="college"
                        value={formData.college}
                        onChange={handleChange}
                        className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                          fieldErrors.college ? 'border-red-300' : 'border-gray-300'
                        }`}
                      >
                        <option value="">Select College/Faculty</option>
                        {colleges.map((college) => (
                          <option key={college.id} value={college.id}>
                            {college.name}
                          </option>
                        ))}
                      </select>
                      {fieldErrors.college && (
                        <p className="mt-1 text-sm text-red-600">{fieldErrors.college}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="department" className="block text-sm font-medium text-gray-700">
                        Department <span className="text-red-500">*</span>
                      </label>
                      <select
                        id="department"
                        name="department"
                        value={formData.department}
                        onChange={handleChange}
                        className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                          fieldErrors.department ? 'border-red-300' : 'border-gray-300'
                        }`}
                        disabled={!formData.college}
                      >
                        <option value="">Select Department</option>
                        {departments.map((department) => (
                          <option key={department.id} value={department.id}>
                            {department.name}
                          </option>
                        ))}
                      </select>
                      {fieldErrors.department && (
                        <p className="mt-1 text-sm text-red-600">{fieldErrors.department}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="level" className="block text-sm font-medium text-gray-700">
                        Level <span className="text-red-500">*</span>
                      </label>
                      <select
                        id="level"
                        name="level"
                        value={formData.level}
                        onChange={handleChange}
                        className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                          fieldErrors.level ? 'border-red-300' : 'border-gray-300'
                        }`}
                      >
                        <option value="">Select Level</option>
                        <option value="100">100 Level</option>
                        <option value="200">200 Level</option>
                        <option value="300">300 Level</option>
                        <option value="400">400 Level</option>
                        <option value="500">500 Level</option>
                      </select>
                      {fieldErrors.level && (
                        <p className="mt-1 text-sm text-red-600">{fieldErrors.level}</p>
                      )}
                    </div>
                  </>
                )}

                {/* Lecturer-specific fields */}
                {formData.role === 'lecturer' && (
                  <div>
                    <label htmlFor="lecturer_id" className="block text-sm font-medium text-gray-700">
                      Lecturer ID <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="lecturer_id"
                      name="lecturer_id"
                      type="text"
                      value={formData.lecturer_id}
                      onChange={handleChange}
                      className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                        fieldErrors.lecturer_id ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="Enter your lecturer ID"
                    />
                    {fieldErrors.lecturer_id && (
                      <p className="mt-1 text-sm text-red-600">{fieldErrors.lecturer_id}</p>
                    )}
                  </div>
                )}

                {/* Password fields */}
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <div className="mt-1 relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={handleChange}
                      className={`block w-full px-3 py-2 pr-10 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                        fieldErrors.password ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      ) : (
                        <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                        </svg>
                      )}
                    </button>
                  </div>
                  {fieldErrors.password && (
                    <p className="mt-1 text-sm text-red-600">{fieldErrors.password}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="confirm_password" className="block text-sm font-medium text-gray-700">
                    Confirm Password <span className="text-red-500">*</span>
                  </label>
                  <div className="mt-1 relative">
                    <input
                      id="confirm_password"
                      name="confirm_password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={formData.confirm_password}
                      onChange={handleChange}
                      className={`block w-full px-3 py-2 pr-10 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                        fieldErrors.confirm_password ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="Confirm your password"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? (
                        <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      ) : (
                        <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                        </svg>
                      )}
                    </button>
                  </div>
                  {fieldErrors.confirm_password && (
                    <p className="mt-1 text-sm text-red-600">{fieldErrors.confirm_password}</p>
                  )}
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {loading ? 'Creating Account...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </AppLayout>
  )
} 