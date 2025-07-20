'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { apiClient } from '../../utils/api'
import AppLayout from '../../components/AppLayout'

interface Lecturer {
  id: number
  full_name: string
  email: string
  lecturer_id: string
  department?: {
    id: number
    name: string
    code: string
    college: {
      id: number
      name: string
      code: string
    }
  }
  assigned_courses: Course[]
  max_courses: number
  workload_percentage: number
}

interface Course {
  id: number
  code: string
  title: string
  level: string
  credit_units: number
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
  enrollment_count?: number
  is_active: boolean
  assigned_lecturer?: {
    id: number
    full_name: string
    lecturer_id: string
  }
}

interface DragItem {
  type: 'lecturer' | 'course'
  id: number
  data: Lecturer | Course
}

export default function LecturerAssignmentPage() {
  const [lecturers, setLecturers] = useState<Lecturer[]>([])
  const [unassignedCourses, setUnassignedCourses] = useState<Course[]>([])
  const [assignedCourses, setAssignedCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [levelFilter, setLevelFilter] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [draggedItem, setDraggedItem] = useState<DragItem | null>(null)
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null)
  
  // Filters
  const [departments, setDepartments] = useState<any[]>([])
  const [assignments, setAssignments] = useState<any[]>([])

  const { user, isAdmin } = useAuth()

  useEffect(() => {
    if (isAdmin) {
      fetchAllData()
    }
  }, [isAdmin])

  const fetchAllData = async () => {
    try {
      setLoading(true)
      
      // Fetch all required data
      const [lecturersResponse, coursesResponse, assignmentsResponse, departmentsResponse] = await Promise.all([
        apiClient.get('/courses/lecturers/'),
        apiClient.get('/courses/courses/'),
        apiClient.get('/courses/course-assignments/'),
        apiClient.get('/courses/departments/')
      ])

      const lecturersData = lecturersResponse?.results || lecturersResponse || []
      const coursesData = coursesResponse?.results || coursesResponse || []
      const assignmentsData = assignmentsResponse?.results || assignmentsResponse || []
      const departmentsData = departmentsResponse?.results || departmentsResponse || []

      setDepartments(departmentsData)
      setAssignments(assignmentsData)

      // Process lecturers with their assigned courses
      const processedLecturers = lecturersData.map((lecturer: any) => {
        const lecturerAssignments = assignmentsData.filter((assignment: any) => 
          assignment.lecturer?.id === lecturer.id && assignment.is_active
        )
        
        const assignedCourses = lecturerAssignments.map((assignment: any) => assignment.course)
        const workloadPercentage = Math.min((assignedCourses.length / 6) * 100, 100) // Assuming max 6 courses

        return {
          ...lecturer,
          assigned_courses: assignedCourses,
          max_courses: 6,
          workload_percentage: workloadPercentage
        }
      })

      // Separate assigned and unassigned courses
      const assignedCourseIds = new Set(assignmentsData.map((assignment: any) => assignment.course?.id))
      const unassigned = coursesData.filter((course: any) => 
        !assignedCourseIds.has(course.id) && course.is_active
      )
      const assigned = coursesData.filter((course: any) => 
        assignedCourseIds.has(course.id) && course.is_active
      )

      // Add lecturer info to assigned courses
      const assignedWithLecturer = assigned.map((course: any) => {
        const assignment = assignmentsData.find((assignment: any) => assignment.course?.id === course.id)
        return {
          ...course,
          assigned_lecturer: assignment?.lecturer || null
        }
      })

      setLecturers(processedLecturers)
      setUnassignedCourses(unassigned)
      setAssignedCourses(assignedWithLecturer)
      
    } catch (error) {
      console.error('Error fetching data:', error)
      setError('Failed to load assignment data')
    } finally {
      setLoading(false)
    }
  }

  const handleDragStart = (e: React.DragEvent, item: DragItem) => {
    setDraggedItem(item)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', JSON.stringify(item))
  }

  const handleDragOver = (e: React.DragEvent, targetType: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverTarget(targetType)
  }

  const handleDragLeave = () => {
    setDragOverTarget(null)
  }

  const handleDrop = async (e: React.DragEvent, targetType: string, targetLecturerId?: number) => {
    e.preventDefault()
    setDragOverTarget(null)

    if (!draggedItem) return

    try {
      if (draggedItem.type === 'course' && targetType === 'lecturer' && targetLecturerId) {
        // Assign course to lecturer
        const course = draggedItem.data as Course
        await assignCourseToLecturer(course.id, targetLecturerId)
      } else if (draggedItem.type === 'course' && targetType === 'unassigned') {
        // Unassign course
        const course = draggedItem.data as Course
        await unassignCourse(course.id)
      }
    } catch (error) {
      console.error('Error in drag and drop:', error)
      // setError('Failed to update assignment')
    }

    setDraggedItem(null)
  }

  const assignCourseToLecturer = async (courseId: number, lecturerId: number) => {
    try {
      await apiClient.post('/courses/course-assignments/', {
        course_id: courseId,
        lecturer_id: lecturerId,
        academic_year: '2024/2025',
        semester: 'First'
      })
      
      setSuccess('Course assigned successfully!')
      fetchAllData() // Refresh data
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000)
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to assign course')
    }
  }

  const unassignCourse = async (courseId: number) => {
    try {
      const assignment = assignments.find(a => a.course?.id === courseId)
      if (assignment) {
        await apiClient.delete(`/courses/course-assignments/${assignment.id}/`)
        setSuccess('Course unassigned successfully!')
        fetchAllData() // Refresh data
        
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(''), 3000)
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to unassign course')
    }
  }

  const filteredUnassignedCourses = unassignedCourses.filter(course => {
    const matchesSearch = course.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         course.title.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesLevel = !levelFilter || course.level === levelFilter
    const matchesDepartment = !departmentFilter || (course.department?.id && course.department.id.toString() === departmentFilter)
    
    return matchesSearch && matchesLevel && matchesDepartment
  })

  const filteredLecturers = lecturers.filter(lecturer =>
    lecturer.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lecturer.lecturer_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lecturer.email?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getWorkloadColor = (percentage: number) => {
    if (percentage < 50) return 'bg-green-500'
    if (percentage < 80) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const getDepartmentBadgeColor = (deptName: string) => {
    const colors = [
      'bg-blue-100 text-blue-800',
      'bg-green-100 text-green-800',
      'bg-purple-100 text-purple-800',
      'bg-yellow-100 text-yellow-800',
      'bg-pink-100 text-pink-800',
      'bg-indigo-100 text-indigo-800'
    ]
    
    // Add null/undefined check
    if (!deptName || typeof deptName !== 'string') {
      return 'bg-gray-100 text-gray-800' // Default color for missing department
    }
    
    const hash = deptName.split('').reduce((a, b) => a + b.charCodeAt(0), 0)
    return colors[hash % colors.length]
  }

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto p-6">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <h3 className="text-lg font-medium text-red-800">Access Denied</h3>
            <p className="text-red-700 mt-2">Only administrators can manage lecturer assignments.</p>
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
          <h1 className="text-3xl font-bold text-gray-900">Lecturer Assignment Center</h1>
          <p className="text-gray-600 mt-2">Drag and drop courses to assign them to lecturers</p>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-md p-4">
            <div className="flex items-center">
              <svg className="h-5 w-5 text-green-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-green-700">{success}</p>
            </div>
          </div>
        )}
        
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex items-center">
              <svg className="h-5 w-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="mb-6 bg-white shadow-sm rounded-lg border border-gray-200 p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <input
                type="text"
                placeholder="Search lecturers or courses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Level</label>
              <select
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Departments</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>
                    {dept.code} - {dept.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={fetchAllData}
                className="w-full px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Refresh Data
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-500">Loading assignment data...</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Lecturers Column */}
            <div className="lg:col-span-1">
              <div className="bg-white shadow-sm rounded-lg border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">
                    Lecturers ({filteredLecturers.length})
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">Drop courses here to assign</p>
                </div>
                
                <div className="max-h-screen overflow-y-auto">
                  {filteredLecturers.map((lecturer) => (
                    <div
                      key={lecturer.id}
                      className={`p-4 border-b border-gray-100 transition-colors ${
                        dragOverTarget === `lecturer-${lecturer.id}` ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'
                      }`}
                      onDragOver={(e) => handleDragOver(e, `lecturer-${lecturer.id}`)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, 'lecturer', lecturer.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="text-sm font-medium text-gray-900">{lecturer.full_name}</h4>
                          <p className="text-xs text-gray-500">{lecturer.lecturer_id}</p>
                          <p className="text-xs text-gray-400">{lecturer.email}</p>
                          
                          {lecturer.department && (
                            <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full mt-1 ${getDepartmentBadgeColor(lecturer.department.name)}`}>
                              {lecturer.department.code}
                            </span>
                          )}
                          
                          {!lecturer.department && (
                            <span className="inline-block px-2 py-1 text-xs font-medium rounded-full mt-1 bg-gray-100 text-gray-800">
                              No Dept
                            </span>
                          )}
                          
                          {/* Workload Bar */}
                          <div className="mt-2">
                            <div className="flex items-center justify-between text-xs text-gray-500">
                              <span>Workload</span>
                              <span>{lecturer.assigned_courses.length}/{lecturer.max_courses}</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                              <div 
                                className={`h-2 rounded-full transition-all ${getWorkloadColor(lecturer.workload_percentage)}`}
                                style={{ width: `${lecturer.workload_percentage}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Assigned Courses */}
                      {lecturer.assigned_courses.length > 0 && (
                        <div className="mt-3 space-y-1">
                          <p className="text-xs font-medium text-gray-700">Assigned Courses:</p>
                          {lecturer.assigned_courses.map((course) => (
                            <div
                              key={course.id}
                              className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded cursor-move"
                              draggable
                              onDragStart={(e) => handleDragStart(e, { type: 'course', id: course.id, data: course })}
                            >
                              {course.code} - {course.title}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Unassigned Courses Column */}
            <div className="lg:col-span-1">
              <div className="bg-white shadow-sm rounded-lg border border-gray-200">
                <div 
                  className={`px-6 py-4 border-b border-gray-200 transition-colors ${
                    dragOverTarget === 'unassigned' ? 'bg-yellow-50 border-yellow-200' : ''
                  }`}
                  onDragOver={(e) => handleDragOver(e, 'unassigned')}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, 'unassigned')}
                >
                  <h3 className="text-lg font-medium text-gray-900">
                    Unassigned Courses ({filteredUnassignedCourses.length})
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">Drag courses to lecturers to assign</p>
                </div>
                
                <div className="max-h-screen overflow-y-auto">
                  {filteredUnassignedCourses.length === 0 ? (
                    <div className="p-6 text-center text-gray-500">
                      <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <h3 className="mt-2 text-sm font-medium text-gray-900">No unassigned courses</h3>
                      <p className="mt-1 text-sm text-gray-500">All courses have been assigned to lecturers.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {filteredUnassignedCourses.map((course) => (
                        <div
                          key={course.id}
                          className="p-4 cursor-move hover:bg-gray-50 transition-colors"
                          draggable
                          onDragStart={(e) => handleDragStart(e, { type: 'course', id: course.id, data: course })}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="text-sm font-medium text-gray-900">{course.code}</h4>
                              <p className="text-xs text-gray-600 mt-1 line-clamp-2">{course.title}</p>
                              
                              <div className="flex items-center space-x-2 mt-2">
                                <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded-full">
                                  {course.level} Level
                                </span>
                                <span className="text-xs text-gray-500">{course.credit_units} Units</span>
                              </div>
                              
                              <div className="mt-1">
                                <span className={`text-xs px-2 py-1 rounded-full ${getDepartmentBadgeColor(course.department?.name || 'Unknown')}`}>
                                  {course.department?.code || 'N/A'}
                                </span>
                              </div>
                            </div>
                            
                            <div className="text-right ml-2">
                              <div className="text-xs text-gray-500">{course.enrollment_count || 0} enrolled</div>
                              <svg className="h-4 w-4 text-gray-400 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                              </svg>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Assigned Courses Column */}
            <div className="lg:col-span-1">
              <div className="bg-white shadow-sm rounded-lg border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">
                    Assigned Courses ({assignedCourses.length})
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">Courses with lecturers assigned</p>
                </div>
                
                <div className="max-h-screen overflow-y-auto">
                  {assignedCourses.length === 0 ? (
                    <div className="p-6 text-center text-gray-500">
                      <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                      </svg>
                      <h3 className="mt-2 text-sm font-medium text-gray-900">No assigned courses</h3>
                      <p className="mt-1 text-sm text-gray-500">Start by dragging courses to lecturers.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {assignedCourses.map((course) => (
                        <div key={course.id} className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="text-sm font-medium text-gray-900">{course.code}</h4>
                              <p className="text-xs text-gray-600 mt-1 line-clamp-2">{course.title}</p>
                              
                              {course.assigned_lecturer && (
                                <div className="mt-2 p-2 bg-green-50 rounded-md">
                                  <p className="text-xs font-medium text-green-800">
                                    Assigned to: {course.assigned_lecturer.full_name}
                                  </p>
                                  <p className="text-xs text-green-600">
                                    ID: {course.assigned_lecturer.lecturer_id}
                                  </p>
                                </div>
                              )}
                              
                              <div className="flex items-center space-x-2 mt-2">
                                <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded-full">
                                  {course.level} Level
                                </span>
                                <span className="text-xs text-gray-500">{course.credit_units} Units</span>
                              </div>
                            </div>
                            
                            <div className="text-right ml-2">
                              <div className="text-xs text-gray-500">{course.enrollment_count || 0} enrolled</div>
                              <svg className="h-4 w-4 text-green-500 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">How to Use</h3>
              <div className="mt-2 text-sm text-blue-700">
                <ul className="list-disc list-inside space-y-1">
                  <li>Drag courses from the "Unassigned Courses" column to any lecturer to assign them</li>
                  <li>Drag courses from a lecturer back to "Unassigned Courses" to unassign them</li>
                  <li>Use the search and filters to find specific courses or lecturers</li>
                  <li>Lecturer workload bars show current assignment load (green: low, yellow: medium, red: high)</li>
                  <li>Cross-department assignments are allowed - lecturers can teach any course</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
} 