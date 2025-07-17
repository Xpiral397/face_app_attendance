'use client'

import React, { useState, useEffect } from 'react'
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
  college: College
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
  created_at: string
}

interface User {
  id: number
  full_name: string
  email: string
  lecturer_id: string
  role: string
}

interface CourseAssignment {
  id: number
  course: Course
  lecturer: User
  academic_year: string
  semester: string
  is_active: boolean
  assigned_by: User
  assigned_at: string
}

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [assignments, setAssignments] = useState<CourseAssignment[]>([])
  const [lecturers, setLecturers] = useState<User[]>([])
  const [colleges, setColleges] = useState<College[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Filters
  const [selectedCollege, setSelectedCollege] = useState('')
  const [selectedDepartment, setSelectedDepartment] = useState('')
  const [selectedLevel, setSelectedLevel] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [showAssignedOnly, setShowAssignedOnly] = useState(false)

  // Assignment modal
  const [showAssignmentModal, setShowAssignmentModal] = useState(false)
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [assignmentData, setAssignmentData] = useState({
    lecturer_id: '',
    academic_year: new Date().getFullYear() + '/' + (new Date().getFullYear() + 1),
    semester: 'First'
  })

  const { user, isAdmin, isLecturer } = useAuth()

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (selectedCollege) {
      fetchDepartments(selectedCollege)
    } else {
      setDepartments([])
      setSelectedDepartment('')
    }
  }, [selectedCollege])

  const fetchData = async () => {
    try {
      setLoading(true)
      setError('')
      
      const [coursesResponse, assignmentsResponse, lecturersResponse, collegesResponse] = await Promise.all([
        apiClient.get('/courses/courses/'),
        apiClient.get('/courses/assignments/'),
        apiClient.get('/auth/users/?role=lecturer'),
        apiClient.get('/courses/colleges/')
      ])

      setCourses(coursesResponse?.results || coursesResponse || [])
      setAssignments(assignmentsResponse?.results || assignmentsResponse || [])
      setLecturers(lecturersResponse?.results || lecturersResponse || [])
      setColleges(collegesResponse?.results || collegesResponse || [])
    } catch (error) {
      console.error('Error fetching data:', error)
      setError('Failed to fetch data')
    } finally {
      setLoading(false)
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

  const handleAssignLecturer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCourse) return

    try {
      setLoading(true)
      setError('')
      setSuccess('')

      const response = await apiClient.post('/courses/assignments/', {
        course_id: selectedCourse.id,
        lecturer_id: parseInt(assignmentData.lecturer_id),
        academic_year: assignmentData.academic_year,
        semester: assignmentData.semester
      })

      setSuccess(`Lecturer assigned to ${selectedCourse.code} successfully!`)
      setShowAssignmentModal(false)
      setSelectedCourse(null)
      setAssignmentData({
        lecturer_id: '',
        academic_year: new Date().getFullYear() + '/' + (new Date().getFullYear() + 1),
        semester: 'First'
      })
      
      // Refresh assignments
      const assignmentsResponse = await apiClient.get('/courses/assignments/')
      setAssignments(assignmentsResponse?.results || assignmentsResponse || [])
    } catch (error: any) {
      console.error('Error assigning lecturer:', error)
      setError(error.response?.message || 'Failed to assign lecturer')
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveAssignment = async (assignmentId: number) => {
    if (!confirm('Are you sure you want to remove this assignment?')) return

    try {
      setLoading(true)
      await apiClient.delete(`/courses/assignments/${assignmentId}/`)
      setSuccess('Assignment removed successfully!')
      
      // Refresh assignments
      const assignmentsResponse = await apiClient.get('/courses/assignments/')
      setAssignments(assignmentsResponse?.results || assignmentsResponse || [])
    } catch (error: any) {
      console.error('Error removing assignment:', error)
      setError(error.response?.message || 'Failed to remove assignment')
    } finally {
      setLoading(false)
    }
  }

  const getAssignmentForCourse = (courseId: number) => {
    return assignments.find(assignment => assignment.course.id === courseId && assignment.is_active)
  }

  const filteredCourses = courses.filter(course => {
    const matchesCollege = !selectedCollege || course.department.college.id.toString() === selectedCollege
    const matchesDepartment = !selectedDepartment || course.department.id.toString() === selectedDepartment
    const matchesLevel = !selectedLevel || course.level === selectedLevel
    const matchesSearch = !searchTerm || 
      course.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      course.department.name.toLowerCase().includes(searchTerm.toLowerCase())
    
    const hasAssignment = getAssignmentForCourse(course.id)
    const matchesAssignmentFilter = !showAssignedOnly || hasAssignment

    return matchesCollege && matchesDepartment && matchesLevel && matchesSearch && matchesAssignmentFilter
  })

  const getLecturerName = (lecturerId: number) => {
    const lecturer = lecturers.find(l => l.id === lecturerId)
    return lecturer ? lecturer.full_name : 'Unknown'
  }

  if (!user) {
    return <AppLayout><div>Loading...</div></AppLayout>
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Course Management</h1>
          <p className="text-gray-600 mt-2">View and manage all courses with their assigned lecturers</p>
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

        {/* Filters */}
        <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <input
                type="text"
                placeholder="Search courses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">College</label>
              <select
                value={selectedCollege}
                onChange={(e) => setSelectedCollege(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Colleges</option>
                {colleges.map(college => (
                  <option key={college.id} value={college.id}>
                    {college.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={!selectedCollege}
              >
                <option value="">All Departments</option>
                {departments.map(department => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Level</label>
              <select
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Levels</option>
                <option value="100">100 Level</option>
                <option value="200">200 Level</option>
                <option value="300">300 Level</option>
                <option value="400">400 Level</option>
                <option value="500">500 Level</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Filter</label>
              <div className="flex items-center h-10">
                <input
                  type="checkbox"
                  id="showAssignedOnly"
                  checked={showAssignedOnly}
                  onChange={(e) => setShowAssignedOnly(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="showAssignedOnly" className="ml-2 text-sm text-gray-700">
                  Assigned Only
                </label>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Actions</label>
              <button
                onClick={() => {
                  setSelectedCollege('')
                  setSelectedDepartment('')
                  setSelectedLevel('')
                  setSearchTerm('')
                  setShowAssignedOnly(false)
                }}
                className="w-full px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-2xl font-bold text-blue-600">{filteredCourses.length}</div>
            <div className="text-sm text-gray-600">Total Courses</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-2xl font-bold text-green-600">
              {filteredCourses.filter(course => getAssignmentForCourse(course.id)).length}
            </div>
            <div className="text-sm text-gray-600">Assigned Courses</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-2xl font-bold text-orange-600">
              {filteredCourses.filter(course => !getAssignmentForCourse(course.id)).length}
            </div>
            <div className="text-sm text-gray-600">Unassigned Courses</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-2xl font-bold text-purple-600">{lecturers.length}</div>
            <div className="text-sm text-gray-600">Total Lecturers</div>
          </div>
        </div>

        {/* Courses Table */}
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading courses...</p>
          </div>
        ) : (
          <div className="bg-white shadow-md rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Course
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Department
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Level
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Credits
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Assigned Lecturer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Academic Year
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Semester
                    </th>
                    {isAdmin && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredCourses.map((course) => {
                    const assignment = getAssignmentForCourse(course.id)
                    return (
                      <tr key={course.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{course.code}</div>
                            <div className="text-sm text-gray-500">{course.title}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{course.department.name}</div>
                          <div className="text-sm text-gray-500">{course.department.college.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                            {course.level} Level
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {course.credit_units}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {assignment ? (
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {assignment.lecturer.full_name}
                              </div>
                              <div className="text-sm text-gray-500">
                                {assignment.lecturer.lecturer_id}
                              </div>
                            </div>
                          ) : (
                            <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                              Not Assigned
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {assignment ? assignment.academic_year : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {assignment ? assignment.semester : '-'}
                        </td>
                        {isAdmin && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex space-x-2">
                              {assignment ? (
                                <button
                                  onClick={() => handleRemoveAssignment(assignment.id)}
                                  className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                                >
                                  Remove
                                </button>
                              ) : (
                                <button
                                  onClick={() => {
                                    setSelectedCourse(course)
                                    setShowAssignmentModal(true)
                                  }}
                                  className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                                >
                                  Assign
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {filteredCourses.length === 0 && !loading && (
          <div className="text-center py-8">
            <p className="text-gray-500">No courses found matching your criteria.</p>
          </div>
        )}

        {/* Assignment Modal */}
        {showAssignmentModal && selectedCourse && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">
                Assign Lecturer to {selectedCourse.code}
              </h3>
              
              <form onSubmit={handleAssignLecturer} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Lecturer <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={assignmentData.lecturer_id}
                    onChange={(e) => setAssignmentData(prev => ({ ...prev, lecturer_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select Lecturer</option>
                    {lecturers.map(lecturer => (
                      <option key={lecturer.id} value={lecturer.id}>
                        {lecturer.full_name} ({lecturer.lecturer_id})
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Academic Year <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={assignmentData.academic_year}
                    onChange={(e) => setAssignmentData(prev => ({ ...prev, academic_year: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="2024/2025"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Semester <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={assignmentData.semester}
                    onChange={(e) => setAssignmentData(prev => ({ ...prev, semester: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="First">First Semester</option>
                    <option value="Second">Second Semester</option>
                  </select>
                </div>
                
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAssignmentModal(false)
                      setSelectedCourse(null)
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loading ? 'Assigning...' : 'Assign Lecturer'}
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