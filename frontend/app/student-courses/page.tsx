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
    code: string
  }
  level: string
  credit_units: number
  is_active: boolean
  lecturer?: {
    id: number
    full_name: string
    email: string
  }
  enrollment_status?: 'enrolled' | 'pending' | 'not_enrolled'
  enrollment_id?: number
}

interface CourseAssignment {
  id: number
  course: Course
  lecturer: {
    id: number
    full_name: string
    email: string
  }
  academic_year: string
  semester: string
  is_active: boolean
}

export default function StudentCoursesPage() {
  const [courseAssignments, setCourseAssignments] = useState<CourseAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [enrollingCourse, setEnrollingCourse] = useState<number | null>(null)

  const { user, isStudent } = useAuth()

  useEffect(() => {
    if (isStudent && user) {
      fetchDepartmentCourses()
    }
  }, [isStudent, user])

  const fetchDepartmentCourses = async () => {
    try {
      setLoading(true)
      
      // Get all course assignments for the student's department and level
      const response = await apiClient.get('/courses/course-assignments/', {
        params: {
          course__department: user?.department,
          course__level: user?.level
        }
      })
      
      const assignments = response.results || response || []
      
      // Get student's enrollments to check enrollment status
      const enrollmentsResponse = await apiClient.get('/courses/enrollments/my-enrollments/')
      const enrollments = enrollmentsResponse.results || enrollmentsResponse || []
      
      // Map enrollment status to each course
      const assignmentsWithStatus = assignments.map((assignment: CourseAssignment) => {
        const enrollment = enrollments.find((e: any) => 
          e.course_assignment.id === assignment.id
        )
        
        return {
          ...assignment,
          course: {
            ...assignment.course,
            enrollment_status: enrollment ? enrollment.status : 'not_enrolled',
            enrollment_id: enrollment ? enrollment.id : null
          }
        }
      })
      
      setCourseAssignments(assignmentsWithStatus)
      
    } catch (error) {
      console.error('Error fetching courses:', error)
      setError('Failed to fetch courses')
    } finally {
      setLoading(false)
    }
  }

  const handleEnrollment = async (courseAssignmentId: number, action: 'enroll' | 'withdraw') => {
    try {
      setEnrollingCourse(courseAssignmentId)
      
      if (action === 'enroll') {
        await apiClient.post('/courses/enrollments/', {
          course_assignment_id: courseAssignmentId,
          status: 'enrolled'
        })
        setSuccess('Successfully enrolled in course')
      } else {
        const assignment = courseAssignments.find(a => a.id === courseAssignmentId)
        const enrollmentId = assignment?.course.enrollment_id
        
        if (enrollmentId) {
          await apiClient.delete(`/courses/enrollments/${enrollmentId}/`)
          setSuccess('Successfully withdrew from course')
        }
      }
      
      // Refresh the course list
      fetchDepartmentCourses()
      
    } catch (error: any) {
      console.error('Enrollment error:', error.response?.data)
      setError(error.response?.data?.error || `Failed to ${action} course`)
    } finally {
      setEnrollingCourse(null)
    }
  }

  const getEnrollmentStatusColor = (status: string) => {
    switch (status) {
      case 'enrolled':
        return 'bg-green-100 text-green-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'not_enrolled':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (!isStudent) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto p-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <h3 className="text-lg font-medium text-yellow-800">Student Access Only</h3>
            <p className="text-yellow-700 mt-2">Only students can view courses.</p>
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
          <h1 className="text-3xl font-bold text-gray-900">My Courses</h1>
          <p className="text-gray-600 mt-2">
            Courses available for {user?.department ? `${user.department} department` : 'your department'} - Level {user?.level}
          </p>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-md p-4">
            <p className="text-green-700">{success}</p>
            <button 
              onClick={() => setSuccess('')}
              className="mt-2 text-green-600 hover:text-green-800 text-sm underline"
            >
              Dismiss
            </button>
          </div>
        )}
        
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-700">{error}</p>
            <button 
              onClick={() => setError('')}
              className="mt-2 text-red-600 hover:text-red-800 text-sm underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-500 mt-2">Loading courses...</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow border border-gray-200">
            {courseAssignments.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📚</div>
                <h3 className="text-lg font-medium text-gray-900">No Courses Available</h3>
                <p className="text-gray-500 mt-2">
                  No courses are currently available for your department and level.
                </p>
              </div>
            ) : (
              <div className="overflow-hidden">
                <table className="min-w-full divide-y divide-gray-300">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Course
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Lecturer
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Credits
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Semester
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {courseAssignments.map((assignment) => (
                      <tr key={assignment.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {assignment.course.code}
                            </div>
                            <div className="text-sm text-gray-600">
                              {assignment.course.title}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {assignment.course.description}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {assignment.lecturer.full_name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {assignment.lecturer.email}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {assignment.course.credit_units} units
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            getEnrollmentStatusColor(assignment.course.enrollment_status || 'not_enrolled')
                          }`}>
                            {assignment.course.enrollment_status === 'not_enrolled' ? 'Not Enrolled' : 
                             assignment.course.enrollment_status === 'enrolled' ? 'Enrolled' :
                             assignment.course.enrollment_status === 'pending' ? 'Pending' : 'Unknown'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {assignment.semester} {assignment.academic_year}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {assignment.course.enrollment_status === 'enrolled' ? (
                            <button
                              onClick={() => handleEnrollment(assignment.id, 'withdraw')}
                              disabled={enrollingCourse === assignment.id}
                              className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-red-700 bg-red-100 hover:bg-red-200 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50"
                            >
                              {enrollingCourse === assignment.id ? 'Processing...' : 'Withdraw'}
                            </button>
                          ) : assignment.course.enrollment_status === 'pending' ? (
                            <span className="text-xs text-gray-500">Pending approval</span>
                          ) : (
                            <button
                              onClick={() => handleEnrollment(assignment.id, 'enroll')}
                              disabled={enrollingCourse === assignment.id}
                              className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                            >
                              {enrollingCourse === assignment.id ? 'Enrolling...' : 'Enroll'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  )
} 