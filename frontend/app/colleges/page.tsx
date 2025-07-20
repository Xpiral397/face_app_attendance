'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { apiClient } from '../../utils/api'
import AppLayout from '../../components/AppLayout'

interface Course {
  id: number
  code: string
  title: string
  level: string
  credit_units: number
  is_active: boolean
  enrollment_count?: number
  lecturer_assigned?: boolean
}

interface Department {
  id: number
  name: string
  code: string
  description: string
  is_active: boolean
  courses: Course[]
  total_courses: number
  active_courses: number
  total_students: number
}

interface College {
  id: number
  name: string
  code: string
  description: string
  is_active: boolean
  created_at: string
  departments: Department[]
  total_departments: number
  total_courses: number
  total_students: number
}

export default function CollegesPage() {
  const [colleges, setColleges] = useState<College[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [expandedColleges, setExpandedColleges] = useState<Set<number>>(new Set())
  const [expandedDepartments, setExpandedDepartments] = useState<Set<number>>(new Set())
  const [showModal, setShowModal] = useState(false)
  const [modalType, setModalType] = useState<'college' | 'department' | 'course'>('college')
  const [selectedCollege, setSelectedCollege] = useState<College | null>(null)
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null)
  
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    college_id: ''
  })

  const { user, isAdmin } = useAuth()

  useEffect(() => {
    if (isAdmin) {
      fetchCollegesWithHierarchy()
    }
  }, [isAdmin])

  const fetchCollegesWithHierarchy = async () => {
    try {
      setLoading(true)
      
      // Fetch colleges, departments, and courses in parallel
      const [collegesResponse, departmentsResponse, coursesResponse, enrollmentsResponse] = await Promise.all([
        apiClient.get('/courses/colleges/'),
        apiClient.get('/courses/departments/'),
        apiClient.get('/courses/courses/'),
        apiClient.get('/courses/enrollments/').catch(() => ({ results: [] })) // Handle if enrollment endpoint doesn't exist
      ])

      const collegesData = collegesResponse?.results || collegesResponse || []
      const departmentsData = departmentsResponse?.results || departmentsResponse || []
      const coursesData = coursesResponse?.results || coursesResponse || []
      const enrollmentsData = enrollmentsResponse?.results || enrollmentsResponse || []

      // Build hierarchical structure
      const hierarchicalColleges = collegesData.map((college: any) => {
        const collegeDepartments = departmentsData.filter((dept: any) => 
          dept.college?.id === college.id || dept.college === college.id
        )

        const departmentsWithCourses = collegeDepartments.map((dept: any) => {
          const departmentCourses = coursesData.filter((course: any) => 
            course.department?.id === dept.id || course.department === dept.id
          )

          const coursesWithStats = departmentCourses.map((course: any) => {
            const courseEnrollments = enrollmentsData.filter((enrollment: any) => 
              enrollment.course?.id === course.id || enrollment.course === course.id
            )
            
            return {
              ...course,
              enrollment_count: courseEnrollments.length,
              lecturer_assigned: course.lecturer_assigned || false
            }
          })

          return {
            ...dept,
            courses: coursesWithStats,
            total_courses: coursesWithStats.length,
            active_courses: coursesWithStats.filter((c: Course) => c.is_active).length,
            total_students: coursesWithStats.reduce((sum, course) => sum + (course.enrollment_count || 0), 0)
          }
        })

        return {
          ...college,
          departments: departmentsWithCourses,
          total_departments: departmentsWithCourses.length,
          total_courses: departmentsWithCourses.reduce((sum, dept) => sum + dept.total_courses, 0),
          total_students: departmentsWithCourses.reduce((sum, dept) => sum + dept.total_students, 0)
        }
      })

      setColleges(hierarchicalColleges)
      setError('')
    } catch (error) {
      console.error('Error fetching hierarchical data:', error)
      setError('Failed to fetch colleges and their structure')
    } finally {
      setLoading(false)
    }
  }

  const toggleCollege = (collegeId: number) => {
    const newExpanded = new Set(expandedColleges)
    if (newExpanded.has(collegeId)) {
      newExpanded.delete(collegeId)
    } else {
      newExpanded.add(collegeId)
    }
    setExpandedColleges(newExpanded)
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

  const openModal = (type: 'college' | 'department' | 'course', college?: College, department?: Department) => {
    setModalType(type)
    setSelectedCollege(college || null)
    setSelectedDepartment(department || null)
    setFormData({
      name: '',
      code: '',
      description: '',
      college_id: college?.id.toString() || ''
    })
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      let endpoint = ''
      let data = { ...formData }
      
      switch (modalType) {
        case 'college':
          endpoint = '/courses/colleges/'
          delete data.college_id
          break
        case 'department':
          endpoint = '/courses/departments/'
          // Backend expects college_id, not college
          data = { ...data, college_id: selectedCollege?.id }
          break
        case 'course':
          endpoint = '/courses/courses/'
          // Backend expects department_id, not department  
          data = { ...data, department_id: selectedDepartment?.id }
          delete data.college_id
          break
      }

      console.log('Submitting data:', data) // Debug log
      await apiClient.post(endpoint, data)
      setSuccess(`${modalType.charAt(0).toUpperCase() + modalType.slice(1)} created successfully`)
      fetchCollegesWithHierarchy()
      setShowModal(false)
    } catch (error: any) {
      console.error(`Error creating ${modalType}:`, error)
      const errorMessage = error.response?.data?.message || error.response?.data?.error || `Failed to create ${modalType}`
      setError(errorMessage)
    }
  }

  const getStatusColor = (isActive: boolean) => {
    return isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
  }

  const getLevelColor = (level: string) => {
    const colors: { [key: string]: string } = {
      '100': 'bg-blue-100 text-blue-800',
      '200': 'bg-purple-100 text-purple-800',
      '300': 'bg-yellow-100 text-yellow-800',
      '400': 'bg-orange-100 text-orange-800',
      '500': 'bg-red-100 text-red-800'
    }
    return colors[level] || 'bg-gray-100 text-gray-800'
  }

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto p-6">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <h3 className="text-lg font-medium text-red-800">Access Denied</h3>
            <p className="text-red-700 mt-2">Only administrators can manage colleges and faculties.</p>
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
          <div className="flex items-center justify-between">
            <div>
          <h1 className="text-3xl font-bold text-gray-900">Colleges & Faculties Management</h1>
              <p className="text-gray-600 mt-2">Hierarchical view of institutional structure</p>
            </div>
            <button
              onClick={() => openModal('college')}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              + Add New College
            </button>
          </div>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-md p-4">
            <p className="text-green-700">{success}</p>
          </div>
        )}
        
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Hierarchical Structure */}
          {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-500">Loading institutional structure...</p>
            </div>
            </div>
          ) : colleges.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No colleges found</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by creating a new college.</p>
            </div>
          ) : (
          <div className="space-y-4">
                  {colleges.map((college) => (
              <div key={college.id} className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
                {/* College Header */}
                <div 
                  className="p-6 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => toggleCollege(college.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0">
                        <svg 
                          className={`h-6 w-6 text-gray-400 transform transition-transform ${
                            expandedColleges.has(college.id) ? 'rotate-90' : ''
                          }`} 
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900">
                          {college.code} - {college.name}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">{college.description}</p>
                        <div className="flex items-center space-x-4 mt-2">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(college.is_active)}`}>
                          {college.is_active ? 'Active' : 'Inactive'}
                        </span>
                          <span className="text-xs text-gray-500">
                            Created: {new Date(college.created_at).toLocaleDateString()}
                        </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <div className="text-2xl font-bold text-blue-600">{college.total_departments}</div>
                          <div className="text-xs text-gray-500">Departments</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-green-600">{college.total_courses}</div>
                          <div className="text-xs text-gray-500">Courses</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-purple-600">{college.total_students}</div>
                          <div className="text-xs text-gray-500">Students</div>
                        </div>
                      </div>
                      <div className="mt-2 space-x-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            openModal('department', college)
                          }}
                          className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                        >
                          Add Department
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Departments */}
                {expandedColleges.has(college.id) && (
                  <div className="border-t border-gray-200 bg-gray-50">
                    {college.departments.length === 0 ? (
                      <div className="p-6 text-center text-gray-500">
                        <p>No departments found in this college.</p>
                        <button
                          onClick={() => openModal('department', college)}
                          className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                        >
                          Add First Department
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2 p-4">
                        {college.departments.map((department) => (
                          <div key={department.id} className="bg-white rounded-md border border-gray-200 overflow-hidden">
                            {/* Department Header */}
                            <div 
                              className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                              onClick={() => toggleDepartment(department.id)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                  <svg 
                                    className={`h-4 w-4 text-gray-400 transform transition-transform ${
                                      expandedDepartments.has(department.id) ? 'rotate-90' : ''
                                    }`} 
                                    fill="none" 
                                    stroke="currentColor" 
                                    viewBox="0 0 24 24"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                  <div>
                                    <h4 className="text-lg font-medium text-gray-900">
                                      {department.code} - {department.name}
                                    </h4>
                                    <p className="text-sm text-gray-500">{department.description}</p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="grid grid-cols-3 gap-3 text-center">
                                    <div>
                                      <div className="text-lg font-semibold text-green-600">{department.total_courses}</div>
                                      <div className="text-xs text-gray-500">Courses</div>
                                    </div>
                                    <div>
                                      <div className="text-lg font-semibold text-blue-600">{department.active_courses}</div>
                                      <div className="text-xs text-gray-500">Active</div>
                                    </div>
                                    <div>
                                      <div className="text-lg font-semibold text-purple-600">{department.total_students}</div>
                                      <div className="text-xs text-gray-500">Students</div>
                                    </div>
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      openModal('course', college, department)
                                    }}
                                    className="mt-2 px-3 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                                  >
                                    Add Course
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Courses */}
                            {expandedDepartments.has(department.id) && (
                              <div className="border-t border-gray-200 bg-gray-50">
                                {department.courses.length === 0 ? (
                                  <div className="p-4 text-center text-gray-500">
                                    <p>No courses found in this department.</p>
                                    <button
                                      onClick={() => openModal('course', college, department)}
                                      className="mt-2 px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
                                    >
                                      Add First Course
                                    </button>
                                  </div>
                                ) : (
                                  <div className="p-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                      {department.courses.map((course) => (
                                        <div key={course.id} className="bg-white p-3 rounded-md border border-gray-200 hover:shadow-sm transition-shadow">
                                          <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                              <h5 className="text-sm font-medium text-gray-900">{course.code}</h5>
                                              <p className="text-xs text-gray-600 mt-1 line-clamp-2">{course.title}</p>
                                              <div className="flex items-center space-x-2 mt-2">
                                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getLevelColor(course.level)}`}>
                                                  {course.level} Level
                                                </span>
                                                <span className="text-xs text-gray-500">{course.credit_units} Units</span>
                                              </div>
                                            </div>
                                            <div className="text-right ml-2">
                                              <div className="text-sm font-medium text-purple-600">{course.enrollment_count || 0}</div>
                                              <div className="text-xs text-gray-500">enrolled</div>
                                              {course.lecturer_assigned && (
                                                <div className="text-xs text-green-600 mt-1">✓ Assigned</div>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
            </div>
          )}
        </div>
            ))}
          </div>
        )}

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">
                Create New {modalType.charAt(0).toUpperCase() + modalType.slice(1)}
                {modalType === 'department' && selectedCollege && ` in ${selectedCollege.name}`}
                {modalType === 'course' && selectedDepartment && ` in ${selectedDepartment.name}`}
                </h3>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {modalType.charAt(0).toUpperCase() + modalType.slice(1)} Code *
                    </label>
                    <input
                      type="text"
                    value={formData.code}
                    onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={`Enter ${modalType} code`}
                    required
                  />
                  </div>

                  <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {modalType.charAt(0).toUpperCase() + modalType.slice(1)} Name *
                    </label>
                    <input
                      type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={`Enter ${modalType} name`}
                    required
                  />
                  </div>

                  <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={3}
                    placeholder={`Enter ${modalType} description`}
                    />
                  </div>

                <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                    className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                    Create {modalType.charAt(0).toUpperCase() + modalType.slice(1)}
                    </button>
                  </div>
                </form>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
} 