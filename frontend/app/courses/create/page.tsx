'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { apiClient } from '../../../utils/api'
import AppLayout from '../../../components/AppLayout'

interface Faculty {
  id: number
  name: string
  code: string
  description: string
  is_active: boolean
}

interface Department {
  id: number
  name: string
  code: string
  college: Faculty
  description: string
  is_active: boolean
}

interface Lecturer {
  id: number
  full_name: string
  email: string
  lecturer_id: string
}

interface CourseFormData {
  code: string
  title: string
  description: string
  department_id: number | string
  level: string
  credit_units: number | string
  is_active: boolean
}

export default function CreateCoursePage() {
  const [faculties, setFaculties] = useState<Faculty[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [lecturers, setLecturers] = useState<Lecturer[]>([])
  const [selectedFaculty, setSelectedFaculty] = useState<number | string>('')
  const [filteredDepartments, setFilteredDepartments] = useState<Department[]>([])
  
  const [formData, setFormData] = useState<CourseFormData>({
    code: '',
    title: '',
    description: '',
    department_id: '',
    level: '100',
    credit_units: 3,
    is_active: true
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const { user, isAdmin } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isAdmin) {
      fetchInitialData()
    }
  }, [isAdmin])

  useEffect(() => {
    if (selectedFaculty) {
      const filtered = departments.filter(dept => dept.college.id === Number(selectedFaculty))
      setFilteredDepartments(filtered)
      // Reset department selection when faculty changes
      setFormData(prev => ({ ...prev, department_id: '' }))
    } else {
      setFilteredDepartments([])
    }
  }, [selectedFaculty, departments])

  const fetchInitialData = async () => {
    try {
      setLoading(true)
      
      // Fetch faculties and departments in parallel
      const [facultiesResponse, departmentsResponse] = await Promise.all([
        apiClient.get('/courses/colleges/'),
        apiClient.get('/courses/departments/')
      ])

      const facultiesData = facultiesResponse?.results || facultiesResponse || []
      const departmentsData = departmentsResponse?.results || departmentsResponse || []

      setFaculties(facultiesData)
      setDepartments(departmentsData)
      
      console.log('Faculties:', facultiesData)
      console.log('Departments:', departmentsData)

    } catch (error) {
      console.error('Error fetching initial data:', error)
      setError('Failed to load form data')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked
      setFormData(prev => ({ ...prev, [name]: checked }))
    } else {
      setFormData(prev => ({ ...prev, [name]: value }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.code || !formData.title || !formData.department_id) {
      setError('Please fill in all required fields')
      return
    }

    try {
      setLoading(true)
      setError('')

      const courseData = {
        code: formData.code,
        title: formData.title,
        description: formData.description,
        department_id: Number(formData.department_id),
        level: formData.level,
        credit_units: Number(formData.credit_units),
        is_active: formData.is_active
      }

      const response = await apiClient.post('/courses/courses/', courseData)
      
      setSuccess('Course created successfully!')
      
      // Reset form
      setFormData({
        code: '',
        title: '',
        description: '',
        department_id: '',
        level: '100',
        credit_units: 3,
        is_active: true
      })
      setSelectedFaculty('')

      // Redirect after 2 seconds
      setTimeout(() => {
        router.push('/courses')
      }, 2000)

    } catch (error: any) {
      console.error('Error creating course:', error)
      setError(error.response?.message || error.message || 'Failed to create course')
    } finally {
      setLoading(false)
    }
  }

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto p-6">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <h3 className="text-lg font-medium text-red-800">Access Denied</h3>
            <p className="text-red-700 mt-2">Only administrators can create courses.</p>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <nav className="flex items-center space-x-2 text-sm text-gray-500 mb-4">
            <button 
              onClick={() => router.push('/courses')}
              className="hover:text-gray-700"
            >
              Courses
            </button>
            <span>/</span>
            <span className="text-gray-900">Create New Course</span>
          </nav>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Create New Course</h1>
              <p className="text-gray-600 mt-2">Add a new course to the system</p>
            </div>
            <button
              onClick={() => router.push('/courses')}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
            >
              ← Back to Courses
            </button>
          </div>
        </div>

        {/* Success Message */}
        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-green-800">{success}</p>
              </div>
            </div>
          </div>
        )}

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

        {/* Course Creation Form */}
        <div className="bg-white shadow-sm rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Course Information</h3>
            <p className="text-sm text-gray-500 mt-1">Fill in the details for the new course</p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Faculty and Department Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Faculty <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedFaculty}
                  onChange={(e) => setSelectedFaculty(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Select a faculty</option>
                  {faculties.map((faculty) => (
                    <option key={faculty.id} value={faculty.id}>
                      {faculty.code} - {faculty.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Department <span className="text-red-500">*</span>
                </label>
                <select
                  name="department_id"
                  value={formData.department_id}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                  disabled={!selectedFaculty}
                >
                  <option value="">Select a department</option>
                  {filteredDepartments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.code} - {department.name}
                    </option>
                  ))}
                </select>
                {!selectedFaculty && (
                  <p className="text-sm text-gray-500 mt-1">Please select a faculty first</p>
                )}
              </div>
            </div>

            {/* Course Code and Title */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Course Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="code"
                  value={formData.code}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., CSC301"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Course Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Data Structures and Algorithms"
                  required
                />
              </div>
            </div>

            {/* Course Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Course Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Brief description of the course content and objectives..."
              />
            </div>

            {/* Level and Credit Units */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Level <span className="text-red-500">*</span>
                </label>
                <select
                  name="level"
                  value={formData.level}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="100">100 Level</option>
                  <option value="200">200 Level</option>
                  <option value="300">300 Level</option>
                  <option value="400">400 Level</option>
                  <option value="500">500 Level</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Credit Units <span className="text-red-500">*</span>
                </label>
                <select
                  name="credit_units"
                  value={formData.credit_units}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value={1}>1 Unit</option>
                  <option value={2}>2 Units</option>
                  <option value={3}>3 Units</option>
                  <option value={4}>4 Units</option>
                  <option value={5}>5 Units</option>
                  <option value={6}>6 Units</option>
                </select>
              </div>
            </div>

            {/* Active Status */}
            <div className="flex items-center">
              <input
                type="checkbox"
                name="is_active"
                checked={formData.is_active}
                onChange={handleInputChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label className="ml-2 block text-sm font-medium text-gray-700">
                Mark course as active
              </label>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={() => router.push('/courses')}
                className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading}
              >
                {loading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Creating...
                  </div>
                ) : (
                  'Create Course'
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Note about Course Assignment */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">Course Assignment</h3>
              <p className="text-sm text-blue-700 mt-1">
                After creating the course, you can assign lecturers to it from the main courses page.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
} 