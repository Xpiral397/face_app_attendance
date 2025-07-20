'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { apiClient } from '../../utils/api'
import AppLayout from '../../components/AppLayout'

interface Course {
  id: number
  code: string
  title: string
  description: string
  department: {
    id: number
    name: string
    college: {
      name: string
    }
  }
  level: string
  credit_units: number
  assignment?: {
    id: number
    lecturer: {
      id: number
      full_name: string
      lecturer_id: string
    }
    academic_year: string
    semester: string
  }
}

interface Lecturer {
  id: number
  full_name: string
  email: string
  lecturer_id: string
}

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [lecturers, setLecturers] = useState<Lecturer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCollege, setSelectedCollege] = useState('all')
  const [selectedDepartment, setSelectedDepartment] = useState('all')
  const [selectedLevel, setSelectedLevel] = useState('all')
  const [assignedOnly, setAssignedOnly] = useState(false)
  const [unassignedOnly, setUnassignedOnly] = useState(false)
  const [colleges, setColleges] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])

  const { user, isStudent, isLecturer, isAdmin } = useAuth()

  useEffect(() => {
    fetchCourses()
    fetchLecturers()
    fetchColleges()
    fetchDepartments()
  }, [])

  const fetchCourses = async () => {
    try {
      setLoading(true)
      
      if (isStudent) {
        // For students, get their enrolled courses
        const response = await apiClient.get('/courses/enrollments/')
        const enrollments = response.results || response || []
        
        const enrolledCourses = enrollments.map((enrollment: any) => ({
          id: enrollment.course_assignment.course.id,
          code: enrollment.course_assignment.course.code,
          title: enrollment.course_assignment.course.title,
          description: enrollment.course_assignment.course.description,
          department: enrollment.course_assignment.course.department,
          level: enrollment.course_assignment.course.level,
          credit_units: enrollment.course_assignment.course.credit_units,
          assignment: enrollment.course_assignment
        }))
        
        setCourses(enrolledCourses)
      } else {
        // For admin/lecturer, get all courses with assignments
        const response = await apiClient.get('/courses/courses/')
        const allCourses = response.results || response || []
        
        // Get assignments for each course
        const coursesWithAssignments = await Promise.all(
          allCourses.map(async (course: any) => {
            try {
              const assignmentResponse = await apiClient.get(`/courses/course-assignments/?course=${course.id}`)
              const assignments = assignmentResponse.results || assignmentResponse || []
              const assignment = assignments.length > 0 ? assignments[0] : null
              
              return {
                ...course,
                assignment: assignment
              }
            } catch (error) {
              return {
                ...course,
                assignment: null
              }
            }
          })
        )
        
        setCourses(coursesWithAssignments)
      }
    } catch (error) {
      console.error('Error fetching courses:', error)
      setError('Failed to fetch courses')
    } finally {
      setLoading(false)
    }
  }

  const fetchLecturers = async () => {
    try {
      const response = await apiClient.get('/courses/lecturers/')
      setLecturers(response.results || response || [])
    } catch (error) {
      console.error('Error fetching lecturers:', error)
    }
  }

  const fetchColleges = async () => {
    try {
      const response = await apiClient.get('/courses/colleges/')
      setColleges(response.results || response || [])
    } catch (error) {
      console.error('Error fetching colleges:', error)
    }
  }

  const fetchDepartments = async () => {
    try {
      const response = await apiClient.get('/courses/departments/')
      setDepartments(response.results || response || [])
    } catch (error) {
      console.error('Error fetching departments:', error)
    }
  }

  const handleAssignLecturer = async (courseId: number, lecturerId: number) => {
    try {
      // Find the course assignment or create one
      const assignmentResponse = await apiClient.get(`/courses/course-assignments/?course=${courseId}`)
      const assignments = assignmentResponse.results || assignmentResponse || []
      
      let assignmentId
      if (assignments.length > 0) {
        // Update existing assignment
        assignmentId = assignments[0].id
        await apiClient.put(`/courses/course-assignments/${assignmentId}/`, {
          lecturer: lecturerId,
          academic_year: '2025/2026',
          semester: 'First'
        })
      } else {
        // Create new assignment
        const newAssignment = await apiClient.post('/courses/course-assignments/', {
          course: courseId,
          lecturer: lecturerId,
          academic_year: '2025/2026',
        semester: 'First'
      })
        assignmentId = newAssignment.id
      }
      
      setSuccess('Lecturer assigned successfully!')
      fetchCourses()
    } catch (error: any) {
      console.error('Assignment error:', error.response?.data)
      setError(error.response?.data?.error || 'Failed to assign lecturer')
    }
  }

  const handleRemoveAssignment = async (assignmentId: number) => {
    try {
      await apiClient.delete(`/courses/course-assignments/${assignmentId}/`)
      setSuccess('Assignment removed successfully!')
      fetchCourses()
    } catch (error: any) {
      console.error('Remove error:', error.response?.data)
      setError(error.response?.data?.error || 'Failed to remove assignment')
    }
  }

  const clearFilters = () => {
    setSearchTerm('')
    setSelectedCollege('all')
    setSelectedDepartment('all')
    setSelectedLevel('all')
    setAssignedOnly(false)
    setUnassignedOnly(false)
  }

  // Filter courses based on search and filters
  const filteredCourses = courses.filter(course => {
    const matchesSearch = course.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         course.title.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesCollege = selectedCollege === 'all' || 
                          course.department.college.name === selectedCollege
    
    const matchesDepartment = selectedDepartment === 'all' || 
                             course.department.name === selectedDepartment
    
    const matchesLevel = selectedLevel === 'all' || course.level === selectedLevel
    
    const isAssigned = course.assignment && course.assignment.lecturer
    const matchesAssignedFilter = !assignedOnly || isAssigned
    const matchesUnassignedFilter = !unassignedOnly || !isAssigned
    
    return matchesSearch && matchesCollege && matchesDepartment && 
           matchesLevel && matchesAssignedFilter && matchesUnassignedFilter
  })

  // Calculate statistics
  const totalCourses = courses.length
  const assignedCourses = courses.filter(course => course.assignment && course.assignment.lecturer).length
  const unassignedCourses = totalCourses - assignedCourses
  const totalLecturers = lecturers.length

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Course Management</h1>
          <p className="text-gray-600 mt-2">View and manage all courses with their assigned lecturers.</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <input
                type="text"
                placeholder="Search courses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">College</label>
              <select
                value={selectedCollege}
                onChange={(e) => setSelectedCollege(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Colleges</option>
                {colleges.map(college => (
                  <option key={college.id} value={college.name}>{college.name}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Departments</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.name}>{dept.name}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Level</label>
              <select
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Levels</option>
                <option value="100">100 Level</option>
                <option value="200">200 Level</option>
                <option value="300">300 Level</option>
                <option value="400">400 Level</option>
                <option value="500">500 Level</option>
              </select>
            </div>
            </div>
            
          <div className="flex items-center space-x-4 mb-4">
            <label className="block text-sm font-medium text-gray-700">Filter</label>
            <label className="flex items-center">
                <input
                  type="checkbox"
                checked={assignedOnly}
                onChange={(e) => setAssignedOnly(e.target.checked)}
                className="mr-2"
              />
                  Assigned Only
                </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={unassignedOnly}
                onChange={(e) => setUnassignedOnly(e.target.checked)}
                className="mr-2"
              />
              Unassigned Only
            </label>
            </div>
            
              <button
            onClick={clearFilters}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Clear Filters
              </button>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
            <div className="text-2xl font-bold text-blue-600">{totalCourses}</div>
            <div className="text-sm text-gray-600">Total Courses</div>
          </div>
          <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
            <div className="text-2xl font-bold text-green-600">{assignedCourses}</div>
            <div className="text-sm text-gray-600">Assigned Courses</div>
          </div>
          <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
            <div className="text-2xl font-bold text-red-600">{unassignedCourses}</div>
            <div className="text-sm text-gray-600">Unassigned Courses</div>
          </div>
          <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
            <div className="text-2xl font-bold text-purple-600">{totalLecturers}</div>
            <div className="text-sm text-gray-600">Total Lecturers</div>
          </div>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-700">{error}</p>
          </div>
        )}
        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-md p-4">
            <p className="text-green-700">{success}</p>
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-500 mt-2">Loading courses...</p>
          </div>
        ) : (
          /* Courses Table */
          <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">COURSE</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">DEPARTMENT</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">LEVEL</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CREDITS</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ASSIGNED LECTURER</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ACADEMIC YEAR</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SEMESTER</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredCourses.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-4 text-center text-gray-500">
                        No courses found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredCourses.map((course) => (
                      <tr key={course.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{course.code}</div>
                            <div className="text-sm text-gray-500">{course.title}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {course.department.name} {course.department.college.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                            {course.level} Level
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {course.credit_units}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {course.assignment && course.assignment.lecturer ? (
                            <div>
                              <div className="font-medium">{course.assignment.lecturer.full_name}</div>
                              <div className="text-gray-500">({course.assignment.lecturer.lecturer_id})</div>
                            </div>
                          ) : (
                            <span className="text-red-600">Not Assigned</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {course.assignment ? course.assignment.academic_year : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {course.assignment ? course.assignment.semester : '-'}
                        </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          {course.assignment && course.assignment.lecturer ? (
                                <button
                              onClick={() => handleRemoveAssignment(course.assignment!.id)}
                              className="text-red-600 hover:text-red-900"
                                >
                                  Remove
                                </button>
                              ) : (
                            <select
                              onChange={(e) => {
                                if (e.target.value) {
                                  handleAssignLecturer(course.id, parseInt(e.target.value))
                                }
                              }}
                              className="text-indigo-600 hover:text-indigo-900 border border-gray-300 rounded px-2 py-1"
                            >
                              <option value="">Assign</option>
                              {lecturers.map(lecturer => (
                                <option key={lecturer.id} value={lecturer.id}>
                                  {lecturer.full_name} ({lecturer.lecturer_id})
                                </option>
                              ))}
                            </select>
                          )}
                          </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
} 