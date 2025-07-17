'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import { apiClient } from '../../../utils/api'
import AppLayout from '../../../components/AppLayout'

interface Course {
  id: number
  code: string
  title: string
  description: string
  department: {
    id: number
    name: string
    college: {
      id: number
      name: string
    }
  }
  level: string
  credit_units: number
  lecturer?: {
    id: number
    full_name: string
    email: string
    lecturer_id: string
  }
  is_active: boolean
}

interface Lecturer {
  id: number
  full_name: string
  email: string
  lecturer_id: string
}

interface Assignment {
  id: number
  course: number
  lecturer: number
  assigned_at: string
  is_active: boolean
}

export default function CourseAssignmentsPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [lecturers, setLecturers] = useState<Lecturer[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [selectedLecturer, setSelectedLecturer] = useState<number | string>('')
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [levelFilter, setLevelFilter] = useState('')

  const { user, isAdmin } = useAuth()

  useEffect(() => {
    if (isAdmin) {
      fetchData()
    }
  }, [isAdmin])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [coursesResponse, lecturersResponse, assignmentsResponse] = await Promise.all([
        apiClient.get('/courses/courses/'),
        apiClient.get('/users/users/?role=lecturer'),
        apiClient.get('/courses/assignments/')
      ])

      setCourses(coursesResponse.data?.results || coursesResponse.data || [])
      setLecturers(lecturersResponse.data?.results || lecturersResponse.data || [])
      setAssignments(assignmentsResponse.data?.results || assignmentsResponse.data || [])
    } catch (error) {
      console.error('Error fetching data:', error)
      setError('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const handleAssignLecturer = async () => {
    if (!selectedCourse || !selectedLecturer) {
      setError('Please select both course and lecturer')
      return
    }

    try {
      setError('')
      setSuccess('')
      
      const assignmentData = {
        course: selectedCourse.id,
        lecturer: Number(selectedLecturer)
      }

      await apiClient.post('/courses/assignments/', assignmentData)
      setSuccess('Lecturer assigned successfully!')
      setShowAssignModal(false)
      setSelectedCourse(null)
      setSelectedLecturer('')
      fetchData()
    } catch (error: any) {
      console.error('Error assigning lecturer:', error)
      setError(error.response?.data?.message || 'Failed to assign lecturer')
    }
  }

  const handleRemoveAssignment = async (courseId: number) => {
    if (!confirm('Are you sure you want to remove this lecturer assignment?')) {
      return
    }

    try {
      const assignment = assignments.find(a => a.course === courseId)
      if (assignment) {
        await apiClient.delete(`/courses/assignments/${assignment.id}/`)
        setSuccess('Assignment removed successfully!')
        fetchData()
      }
    } catch (error: any) {
      console.error('Error removing assignment:', error)
      setError(error.response?.data?.message || 'Failed to remove assignment')
    }
  }

  const getLecturerForCourse = (courseId: number) => {
    const assignment = assignments.find(a => a.course === courseId)
    if (assignment) {
      return lecturers.find(l => l.id === assignment.lecturer)
    }
    return null
  }

  const filteredCourses = courses.filter(course => {
    const matchesSearch = course.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         course.department.name.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesLevel = !levelFilter || course.level === levelFilter
    
    return matchesSearch && matchesLevel
  })

  if (!user) {
    return <AppLayout><div>Loading...</div></AppLayout>
  }

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto p-6">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <h3 className="text-lg font-medium text-red-800">Access Denied</h3>
            <p className="text-red-700 mt-2">You don't have permission to access this page.</p>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Course Assignments</h1>
          <p className="text-gray-600 mt-2">Assign lecturers to courses</p>
        </div>

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

        {/* Filters */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search courses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Levels</option>
            <option value="100">100 Level</option>
            <option value="200">200 Level</option>
            <option value="300">300 Level</option>
            <option value="400">400 Level</option>
            <option value="500">500 Level</option>
            <option value="600">600 Level</option>
          </select>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading courses...</p>
          </div>
        ) : (
          <>
            {/* Courses Table */}
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
                        Credit Units
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Assigned Lecturer
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredCourses.map((course) => {
                      const assignedLecturer = getLecturerForCourse(course.id)
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
                            {course.credit_units} units
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {assignedLecturer ? (
                              <div>
                                <div className="text-sm font-medium text-gray-900">{assignedLecturer.full_name}</div>
                                <div className="text-sm text-gray-500">{assignedLecturer.email}</div>
                              </div>
                            ) : (
                              <span className="text-sm text-gray-500">Not assigned</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            {assignedLecturer ? (
                              <button
                                onClick={() => handleRemoveAssignment(course.id)}
                                className="text-red-600 hover:text-red-900"
                              >
                                Remove
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  setSelectedCourse(course)
                                  setShowAssignModal(true)
                                }}
                                className="text-blue-600 hover:text-blue-900"
                              >
                                Assign
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {filteredCourses.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-500">No courses found matching your criteria.</p>
              </div>
            )}
          </>
        )}

        {/* Assignment Modal */}
        {showAssignModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h2 className="text-xl font-bold mb-4">Assign Lecturer</h2>
              
              {selectedCourse && (
                <div className="mb-4">
                  <h3 className="font-medium text-gray-900">{selectedCourse.code}</h3>
                  <p className="text-sm text-gray-500">{selectedCourse.title}</p>
                </div>
              )}

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Lecturer
                </label>
                <select
                  value={selectedLecturer}
                  onChange={(e) => setSelectedLecturer(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Choose a lecturer...</option>
                  {lecturers.map((lecturer) => (
                    <option key={lecturer.id} value={lecturer.id}>
                      {lecturer.full_name} ({lecturer.lecturer_id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowAssignModal(false)
                    setSelectedCourse(null)
                    setSelectedLecturer('')
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssignLecturer}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                  Assign
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
} 