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

export default function CourseDetailClient() {
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
      const courseFacultyId = course.department.college.id
      setSelectedFaculty(courseFacultyId)
      
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
      const response = await apiClient.get(`/courses/courses/${id}/`)
      const courseData = response
      setCourse(courseData)
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
        apiClient.get('/auth/users/?role=lecturer')
      ])

      const facultiesData = facultiesResponse?.results || facultiesResponse.data || []
      const departmentsData = departmentsResponse?.results || departmentsResponse.data || []
      const lecturersData = lecturersResponse?.results || lecturersResponse.data || []

      setFaculties(facultiesData)
      setDepartments(departmentsData)
      setLecturers(lecturersData)

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

      await apiClient.put(`/courses/courses/${courseId}/`, updateData)
      
      setSuccess('Course updated successfully!')
      setIsEditing(false)
      
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

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto p-6">
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading course details...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <h3 className="text-lg font-medium text-red-800">Error</h3>
            <p className="text-red-700 mt-2">{error}</p>
          </div>
        ) : course ? (
          <div>
            {success && (
              <div className="mb-6 bg-green-50 border border-green-200 rounded-md p-4">
                <p className="text-green-700">{success}</p>
              </div>
            )}

            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">
                      {course.code}: {course.title}
                    </h2>
                    <p className="text-gray-600 mt-1">{course.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Level {course.level}</p>
                    <p className="text-sm text-gray-500">{course.credit_units} credits</p>
                  </div>
                </div>
              </div>

              <div className="p-6">
                {isEditing ? (
                  <form onSubmit={handleSubmit}>
                    {/* Form fields */}
                    <div className="space-y-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Course Code</label>
                        <input
                          type="text"
                          name="code"
                          value={formData.code}
                          onChange={handleInputChange}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">Title</label>
                        <input
                          type="text"
                          name="title"
                          value={formData.title}
                          onChange={handleInputChange}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">Description</label>
                        <textarea
                          name="description"
                          value={formData.description}
                          onChange={handleInputChange}
                          rows={3}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">Level</label>
                        <select
                          name="level"
                          value={formData.level}
                          onChange={handleInputChange}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        >
                          {['100', '200', '300', '400', '500'].map(level => (
                            <option key={level} value={level}>Level {level}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">Credit Units</label>
                        <input
                          type="number"
                          name="credit_units"
                          value={formData.credit_units}
                          onChange={handleInputChange}
                          min="1"
                          max="6"
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            name="is_active"
                            checked={formData.is_active}
                            onChange={handleInputChange}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">Active</span>
                        </label>
                      </div>
                    </div>

                    <div className="mt-6 flex justify-end space-x-3">
                      <button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={saving}
                        className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                      >
                        {saving ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div>
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">Course Details</h3>
                        <dl className="mt-4 space-y-4">
                          <div>
                            <dt className="text-sm font-medium text-gray-500">Department</dt>
                            <dd className="mt-1 text-sm text-gray-900">{course.department.name}</dd>
                          </div>
                          <div>
                            <dt className="text-sm font-medium text-gray-500">Faculty/College</dt>
                            <dd className="mt-1 text-sm text-gray-900">{course.department.college.name}</dd>
                          </div>
                          <div>
                            <dt className="text-sm font-medium text-gray-500">Created</dt>
                            <dd className="mt-1 text-sm text-gray-900">
                              {new Date(course.created_at).toLocaleDateString()}
                            </dd>
                          </div>
                        </dl>
                      </div>
                    </div>

                    <div className="mt-6 flex justify-end space-x-3">
                      <button
                        onClick={() => setIsEditing(true)}
                        className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        Edit Course
                      </button>
                      <button
                        onClick={handleDelete}
                        className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      >
                        Delete Course
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <h3 className="text-lg font-medium text-yellow-800">Course Not Found</h3>
            <p className="text-yellow-700 mt-2">The requested course could not be found.</p>
          </div>
        )}
      </div>
    </AppLayout>
  )
} 