'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import { useRouter, useParams } from 'next/navigation'
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

interface Course {
  id: number
  code: string
  title: string
  description: string
  department: Department
  level: string
  credit_units: number
  is_active: boolean
  created_by: any
  created_at: string
}

interface CourseFormData {
  code: string
  title: string
  description: string
  department: number | string
  level: string
  credit_units: number | string
  lecturer: number | string
  is_active: boolean
}

export default function CourseDetailPage() {
  const [course, setCourse] = useState<Course | null>(null)
  const [faculties, setFaculties] = useState<Faculty[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [lecturers, setLecturers] = useState<Lecturer[]>([])
  const [selectedFaculty, setSelectedFaculty] = useState<number | string>('')
  const [filteredDepartments, setFilteredDepartments] = useState<Department[]>([])
  
  const [formData, setFormData] = useState<CourseFormData>({
    code: '',
    title: '',
    description: '',
    department: '',
    level: '100',
    credit_units: 3,
    lecturer: '',
    is_active: true
  })

  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const { user, isAdmin } = useAuth()
  const router = useRouter()
  const params = useParams()
  const courseId = params.id

  useEffect(() => {
    if (courseId) {
      const loadData = async () => {
        setLoading(true)
        setError('')
        try {
          console.log('Loading course data for ID:', courseId)
          console.log('User role:', user?.role)
          console.log('Is admin:', isAdmin)
          
          await Promise.all([
            fetchCourseData(courseId as string),
            fetchInitialData()
          ])
        } catch (error) {
          console.error('Error loading data:', error)
          setError('Failed to load course data')
        } finally {
          setLoading(false)
        }
      }
      loadData()
    }
  }, [courseId, user])

  useEffect(() => {
    if (selectedFaculty) {
      const filtered = departments.filter(dept => dept.college.id === Number(selectedFaculty))
      setFilteredDepartments(filtered)
    } else {
      setFilteredDepartments([])
    }
  }, [selectedFaculty, departments])

  useEffect(() => {
    if (course && faculties.length > 0) {
      // Set the selected faculty based on the course's department
      const courseFacultyId = course.department.college.id
      setSelectedFaculty(courseFacultyId)
      
      // Set form data
      setFormData({
        code: course.code,
        title: course.title,
        description: course.description,
        department: course.department.id,
        level: course.level,
        credit_units: course.credit_units,
        lecturer: '',
        is_active: course.is_active
      })
    }
  }, [course, faculties])

  const fetchCourseData = async (id: string) => {
    try {
      console.log('Fetching course data from:', `/courses/courses/${id}/`)
      const response = await apiClient.get(`/courses/courses/${id}/`)
      console.log('API Response:', response)
      const courseData = response
      setCourse(courseData)
      console.log('Course data set:', courseData)
    } catch (error) {
      console.error('Error fetching course:', error)
      setError('Failed to load course data')
      throw error
    }
  }

  const fetchInitialData = async () => {
    try {
      const [facultiesResponse, departmentsResponse, lecturersResponse] = await Promise.all([
        apiClient.get('/courses/colleges/'),
        apiClient.get('/courses/departments/'),
        apiClient.get('/users/users/?role=lecturer')
      ])

      const facultiesData = facultiesResponse?.results || facultiesResponse.data || []
      const departmentsData = departmentsResponse?.results || departmentsResponse.data || []
      const lecturersData = lecturersResponse?.results || lecturersResponse.data || []

      setFaculties(facultiesData)
      setDepartments(departmentsData)
      setLecturers(lecturersData)
      console.log(facultiesData, departmentsData, lecturersData, 'rf')

    } catch (error) {
      console.error('Error fetching initial data:', error)
      setError('Failed to load form data')
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
    
    if (!formData.code || !formData.title || !formData.department) {
      setError('Please fill in all required fields')
      return
    }

    try {
      setSaving(true)
      setError('')

      const updateData = {
        ...formData,
        department_id: Number(formData.department),
        credit_units: Number(formData.credit_units)
      }

      const response = await apiClient.put(`/courses/courses/${courseId}/`, updateData)
      
      setSuccess('Course updated successfully!')
      setIsEditing(false)
      
      // Refresh course data
      await fetchCourseData(courseId as string)

    } catch (error: any) {
      console.error('Error updating course:', error)
      setError(error.response?.data?.message || 'Failed to update course')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this course? This action cannot be undone.')) {
      return
    }

    try {
      setSaving(true)
      await apiClient.delete(`/courses/courses/${courseId}/`)
      router.push('/courses')
    } catch (error: any) {
      console.error('Error deleting course:', error)
      setError(error.response?.data?.message || 'Failed to delete course')
      setSaving(false)
    }
  }

  if (!user) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto p-6">
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading...</p>
          </div>
        </div>
      </AppLayout>
    )
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto p-6">
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading course...</p>
          </div>
        </div>
      </AppLayout>
    )
  }

  if (error) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto p-6">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <h3 className="text-lg font-medium text-red-800">Error Loading Course</h3>
            <p className="text-red-700 mt-2">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-3 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      </AppLayout>
    )
  }

  if (!course) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto p-6">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <h3 className="text-lg font-medium text-red-800">Course Not Found</h3>
            <p className="text-red-700 mt-2">The requested course could not be found.</p>
            <button
              onClick={() => router.push('/courses')}
              className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Back to Courses
            </button>
          </div>
        </div>
      </AppLayout>
    )
  }

  // Check permissions after data is loaded
  if (!isAdmin && user?.role !== 'lecturer') {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto p-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <h3 className="text-lg font-medium text-yellow-800">Limited Access</h3>
            <p className="text-yellow-700 mt-2">You can view this course but cannot edit it.</p>
          </div>
          {/* Show read-only view here */}
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
            <span className="text-gray-900">{course.code}</span>
          </nav>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{course.code} - {course.title}</h1>
              <p className="text-gray-600 mt-2">{course.department.college.name} / {course.department.name}</p>
            </div>
            <div className="flex space-x-3">
              {!isEditing ? (
                <>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    Edit Course
                  </button>
                  {isAdmin && (
                    <button
                      onClick={handleDelete}
                      disabled={saving}
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  )}
                </>
              ) : (
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Success Message */}
        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-md p-4">
            <p className="text-green-700">{success}</p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Course Details */}
        {!isEditing ? (
          <div className="bg-white shadow-sm rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Course Details</h3>
            </div>
            <div className="p-6">
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Course Code</dt>
                  <dd className="mt-1 text-sm text-gray-900">{course.code}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Course Title</dt>
                  <dd className="mt-1 text-sm text-gray-900">{course.title}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Faculty</dt>
                  <dd className="mt-1 text-sm text-gray-900">{course.department.college.name}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Department</dt>
                  <dd className="mt-1 text-sm text-gray-900">{course.department.name}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Level</dt>
                  <dd className="mt-1 text-sm text-gray-900">{course.level} Level</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Credit Units</dt>
                  <dd className="mt-1 text-sm text-gray-900">{course.credit_units} Units</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Status</dt>
                  <dd className="mt-1">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      course.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {course.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Created</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {new Date(course.created_at).toLocaleDateString()}
                  </dd>
                </div>
                <div className="md:col-span-2">
                  <dt className="text-sm font-medium text-gray-500">Description</dt>
                  <dd className="mt-1 text-sm text-gray-900">{course.description || 'No description provided'}</dd>
                </div>
              </dl>
            </div>
          </div>
        ) : (
          /* Edit Form */
          <div className="bg-white shadow-sm rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Edit Course</h3>
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
                    name="department"
                    value={formData.department}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="">Select a department</option>
                    {filteredDepartments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.code} - {department.name}
                      </option>
                    ))}
                  </select>
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
                    required
                  />
                </div>
              </div>

              {/* Description */}
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
                />
              </div>

              {/* Level and Credit Units - Read Only */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Level
                  </label>
                  <input
                    type="text"
                    value={`${formData.level} Level`}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50 text-gray-600"
                    disabled
                    readOnly
                  />
                  <p className="mt-1 text-sm text-gray-500">Level cannot be changed after course creation</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Credit Units
                  </label>
                  <input
                    type="text"
                    value={`${formData.credit_units} Units`}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50 text-gray-600"
                    disabled
                    readOnly
                  />
                  <p className="mt-1 text-sm text-gray-500">Credit units cannot be changed after course creation</p>
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
                  onClick={() => setIsEditing(false)}
                  className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Update Course'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </AppLayout>
  )
} 