'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { apiClient } from '../../utils/api'
import AppLayout from '../../components/AppLayout'

interface UserWithFaceData {
  id: number
  full_name: string
  username: string
  email: string
  student_id?: string
  lecturer_id?: string
  role: string
  department: {
    id: number
    name: string
    code: string
    college: {
      id: number
      name: string
      code: string
    }
  }
  face_registered: boolean
  face_registration_date?: string
  last_recognition?: string
  recognition_count: number
  face_image_url?: string
}

interface Department {
  id: number
  name: string
  code: string
  college: {
    id: number
    name: string
    code: string
  }
  users_with_face_data: UserWithFaceData[]
  total_users: number
  users_with_faces: number
}

interface College {
  id: number
  name: string
  code: string
}

export default function FaceStaticPage() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [colleges, setColleges] = useState<College[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedCollege, setSelectedCollege] = useState<string>('')
  const [selectedDepartment, setSelectedDepartment] = useState<string>('')
  const [showOnlyWithFaces, setShowOnlyWithFaces] = useState(false)
  const [expandedDepartments, setExpandedDepartments] = useState<Set<number>>(new Set())

  const { user, isAdmin, isLecturer } = useAuth()

  useEffect(() => {
    if (isAdmin || isLecturer) {
      fetchInitialData()
    }
  }, [isAdmin, isLecturer])

  useEffect(() => {
    if (selectedCollege || selectedDepartment || showOnlyWithFaces !== false) {
      fetchFilteredData()
    }
  }, [selectedCollege, selectedDepartment, showOnlyWithFaces])

  const fetchInitialData = async () => {
    try {
      setLoading(true)
      const [departmentsResponse, collegesResponse] = await Promise.all([
        apiClient.get('/face/departments-with-faces/'),
        apiClient.get('/courses/colleges/')
      ])

      setDepartments(departmentsResponse?.results || departmentsResponse || [])
      setColleges(collegesResponse?.results || collegesResponse || [])
    } catch (error) {
      console.error('Error fetching initial data:', error)
      setError('Failed to load face data')
    } finally {
      setLoading(false)
    }
  }

  const fetchFilteredData = async () => {
    try {
      setLoading(true)
      let url = '/face/departments-with-faces/'
      const params = new URLSearchParams()
      
      if (selectedCollege) params.append('college', selectedCollege)
      if (selectedDepartment) params.append('department', selectedDepartment)
      if (showOnlyWithFaces) params.append('with_faces_only', 'true')
      
      if (params.toString()) {
        url += '?' + params.toString()
      }

      const response = await apiClient.get(url)
      setDepartments(response?.results || response || [])
    } catch (error) {
      console.error('Error fetching filtered data:', error)
      setError('Failed to load filtered face data')
    } finally {
      setLoading(false)
    }
  }

  const toggleDepartment = (departmentId: number) => {
    const newExpanded = new Set(expandedDepartments)
    if (newExpanded.has(departmentId)) {
      newExpanded.delete(departmentId)
    } else {
      newExpanded.add(departmentId)
    }
    setExpandedDepartments(newExpanded)
  }

  const getFaceRegistrationStatus = (user: UserWithFaceData) => {
    if (user.face_registered) {
      return (
        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
          Registered
        </span>
      )
    } else {
      return (
        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
          Not Registered
        </span>
      )
    }
  }

  const getDepartmentStats = (dept: Department) => {
    const percentage = dept.total_users > 0 ? (dept.users_with_faces / dept.total_users * 100).toFixed(1) : '0'
    return `${dept.users_with_faces}/${dept.total_users} (${percentage}%)`
  }

  if (!isAdmin && !isLecturer) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto p-6">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <h3 className="text-lg font-medium text-red-800">Access Denied</h3>
            <p className="text-red-700 mt-2">Only administrators and lecturers can view face registration data.</p>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Face Registration Status</h1>
          <p className="text-gray-600 mt-2">Monitor face registration status by department and college</p>
        </div>

        {/* Filters */}
        <div className="bg-white shadow-sm rounded-lg p-6 mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Filter by Department</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                College/Faculty
              </label>
              <select
                value={selectedCollege}
                onChange={(e) => setSelectedCollege(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Colleges</option>
                {colleges.map((college) => (
                  <option key={college.id} value={college.id}>
                    {college.code} - {college.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Department
              </label>
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Departments</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.code} - {dept.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={showOnlyWithFaces}
                  onChange={(e) => setShowOnlyWithFaces(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">Show only users with face data</span>
              </label>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={() => {
                setSelectedCollege('')
                setSelectedDepartment('')
                setShowOnlyWithFaces(false)
                fetchInitialData()
              }}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
            >
              Clear Filters
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Departments List */}
        <div className="space-y-4">
          {loading ? (
            <div className="bg-white shadow-sm rounded-lg p-6 text-center">
              <div className="inline-flex items-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>
                Loading face registration data...
              </div>
            </div>
          ) : departments.length === 0 ? (
            <div className="bg-white shadow-sm rounded-lg p-6 text-center text-gray-500">
              No departments found for the selected criteria.
            </div>
          ) : (
            departments.map((department) => (
              <div key={department.id} className="bg-white shadow-sm rounded-lg overflow-hidden">
                <div 
                  className="px-6 py-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50"
                  onClick={() => toggleDepartment(department.id)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">
                        {department.code} - {department.name}
                      </h3>
                      <p className="text-sm text-gray-500">{department.college.name}</p>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-900">
                          Face Registration: {getDepartmentStats(department)}
                        </div>
                        <div className="text-xs text-gray-500">
                          Click to {expandedDepartments.has(department.id) ? 'collapse' : 'expand'} user list
                        </div>
                      </div>
                      <svg 
                        className={`h-5 w-5 text-gray-400 transform transition-transform ${
                          expandedDepartments.has(department.id) ? 'rotate-180' : ''
                        }`} 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {expandedDepartments.has(department.id) && (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            User
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            ID Number
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Face Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Registration Date
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Recognition Count
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Last Recognition
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {department.users_with_face_data.map((user) => (
                          <tr key={user.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                {user.face_image_url && (
                                  <div className="flex-shrink-0 h-10 w-10">
                                    <img 
                                      className="h-10 w-10 rounded-full object-cover" 
                                      src={user.face_image_url} 
                                      alt={user.full_name}
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement
                                        target.style.display = 'none'
                                      }}
                                    />
                                  </div>
                                )}
                                <div className={user.face_image_url ? "ml-4" : ""}>
                                  <div className="text-sm font-medium text-gray-900">{user.full_name}</div>
                                  <div className="text-sm text-gray-500">@{user.username}</div>
                                  <div className="text-xs text-gray-400 capitalize">{user.role}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {user.student_id || user.lecturer_id || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {getFaceRegistrationStatus(user)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {user.face_registration_date 
                                ? new Date(user.face_registration_date).toLocaleDateString()
                                : '-'
                              }
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-sm font-medium text-gray-900">
                                {user.recognition_count}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {user.last_recognition 
                                ? new Date(user.last_recognition).toLocaleDateString()
                                : '-'
                              }
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </AppLayout>
  )
} 