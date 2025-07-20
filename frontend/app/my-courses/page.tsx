// File: /app/my-courses/page.tsx
'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { apiClient } from '../../utils/api'
import AppLayout from '../../components/AppLayout'
import SessionModal from './SessionModal'

interface Course {
  id: number
  code: string
  title: string
  description: string
  department: number
  level: string
  credit_units: number
  lecturer: number
  is_active: boolean
  enrollment_count?: number
  assignment_id: number
  academic_year?: string
  semester?: string
}

interface Student {
  id: number
  full_name: string
  email: string
  student_id: string
  level: string
  is_class_rep: boolean
}

export default function MyCoursesPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showSessionModal, setShowSessionModal] = useState(false)
  const [showDepartmentImport, setShowDepartmentImport] = useState(false)
  const [departments, setDepartments] = useState<any[]>([])
  const [selectedDepartment, setSelectedDepartment] = useState('')
  const [importingStudents, setImportingStudents] = useState(false)
  const [sessions, setSessions] = useState<any[]>([])
  const [loadingSessions, setLoadingSessions] = useState(false)

  const { user, isLecturer } = useAuth()

  useEffect(() => {
    if (isLecturer) {
      fetchMyCourses()
      fetchDepartments()
    }
  }, [isLecturer])

  const fetchMyCourses = async () => {
    try {
      setLoading(true)
      const response = await apiClient.get('/courses/course-assignments/?lecturer=me')
      const assignmentsData = response.results || response || []
      const coursesData = assignmentsData.map((assignment: any) => ({
        id: assignment.course.id,
        code: assignment.course.code,
        title: assignment.course.title,
        description: assignment.course.description,
        department: assignment.course.department,
        level: assignment.course.level,
        credit_units: assignment.course.credit_units,
        lecturer: assignment.lecturer.id,
        is_active: assignment.is_active,
        assignment_id: assignment.id,
        academic_year: assignment.academic_year,
        semester: assignment.semester
      }))
      setCourses(coursesData)
      if (coursesData.length > 0) {
        setSelectedCourse(coursesData[0])
      }
    } catch (error) {
      console.error('Error fetching courses:', error)
      setError('Failed to fetch courses')
    } finally {
      setLoading(false)
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

  const handleImportDepartment = async () => {
    if (!selectedDepartment || !selectedCourse?.assignment_id) return
    try {
      setImportingStudents(true)
      const response = await apiClient.post('/courses/enrollments/import-department/', {
        course_assignment_id: selectedCourse.assignment_id,
        department_id: parseInt(selectedDepartment),
        status: 'enrolled',
        enrolled_by: user?.id
      })
      setSuccess(`Successfully imported ${response.imported_count || 0} students from department`)
      setShowDepartmentImport(false)
      setSelectedDepartment('')
      if (selectedCourse) {
        fetchCourseStudents(selectedCourse.id)
        fetchCourseSessions(selectedCourse.assignment_id)
      }
    } catch (error: any) {
      console.error('Import error:', error.response?.data)
      setError(error.response?.data?.error || error.response?.data?.message || 'Failed to import department students')
    } finally {
      setImportingStudents(false)
    }
  }

  const fetchCourseStudents = async (courseId: number) => {
    try {
      const response = await apiClient.get(`/courses/enrollments/?course_assignment=${selectedCourse?.assignment_id}&status=enrolled`)
      const enrollmentsData = response.results || response || []
      const studentsData = enrollmentsData.map((enrollment: any) => ({
        ...enrollment.student,
        is_class_rep: enrollment.is_class_rep || false
      }))
      setStudents(studentsData)
    } catch (error) {
      console.error('Error fetching students:', error)
    }
  }

  // Add function to fetch sessions
  const fetchCourseSessions = async (courseAssignmentId: number) => {
    try {
      setLoadingSessions(true)
      const response = await apiClient.get(`/courses/sessions/?course_assignment=${courseAssignmentId}`)
      setSessions(response.results || response || [])
    } catch (error) {
      console.error('Error fetching sessions:', error)
    } finally {
      setLoadingSessions(false)
    }
  }

  // Add function to delete session
  const handleDeleteSession = async (sessionId: number) => {
    if (!confirm('Are you sure you want to delete this session?')) return
    
    try {
      await apiClient.delete(`/courses/sessions/${sessionId}/`)
      setSuccess('Session deleted successfully')
      if (selectedCourse) {
        fetchCourseSessions(selectedCourse.assignment_id)
      }
    } catch (error: any) {
      console.error('Delete error:', error.response?.data)
      setError(error.response?.data?.error || 'Failed to delete session')
    }
  }

  // Add function to edit session
  const [editingSession, setEditingSession] = useState<any>(null)

  const handleEditSession = (session: any) => {
    setEditingSession(session)
    setShowSessionModal(true)
  }

  if (!isLecturer) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto p-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <h3 className="text-lg font-medium text-yellow-800">Lecturer Access Only</h3>
            <p className="text-yellow-700 mt-2">Only lecturers can manage courses.</p>
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
          <p className="text-gray-600 mt-2">Manage your courses, students, and class schedules</p>
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

        <div className="flex space-x-6">
          {/* Sidebar */}
          <div className="w-1/3">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-4 py-3 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Your Courses</h2>
              </div>
              <div className="p-4">
                {loading ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                  </div>
                ) : courses.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No courses assigned</p>
                ) : (
                  <div className="space-y-2">
                    {courses.map((course) => (
                      <div
                        key={course.id}
                        onClick={() => { setSelectedCourse(course); setActiveTab('overview'); setStudents([]) }}
                        className={`p-3 rounded-lg cursor-pointer transition-colors ${
                          selectedCourse?.id === course.id
                            ? 'bg-blue-50 border-blue-200 border'
                            : 'hover:bg-gray-50 border border-transparent'
                        }`}
                      >
                        <h3 className="font-medium text-gray-900">{course.code}</h3>
                        <p className="text-sm text-gray-600">{course.title}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Level {course.level} • {course.credit_units} credits
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Main */}
          <div className="flex-1">
            {selectedCourse ? (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                {/* Course Header */}
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">
                        {selectedCourse.code}: {selectedCourse.title}
                      </h2>
                      <p className="text-gray-600 mt-1">{selectedCourse.description}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Level {selectedCourse.level}</p>
                      <p className="text-sm text-gray-500">{selectedCourse.credit_units} credits</p>
                    </div>
                  </div>
                </div>

                {/* Tabs */}
                <div className="px-6 py-4">
                  <div className="flex space-x-4 border-b border-gray-200">
                    {['overview','students','schedule','settings'].map(tab => (
                      <button
                        key={tab}
                        onClick={() => {
                          setActiveTab(tab)
                          if (tab === 'students') fetchCourseStudents(selectedCourse.id)
                          if (tab === 'schedule') fetchCourseSessions(selectedCourse.assignment_id)
                        }}
                        className={`px-3 py-2 text-sm font-medium ${
                          activeTab === tab
                            ? 'text-blue-600 border-b-2 border-blue-600'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        {tab.charAt(0).toUpperCase()+tab.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tab Content */}
                <div className="px-6 py-4">
                  {activeTab === 'overview' && (
                      <div>
                      <h3 className="text-lg font-medium text-gray-900">Course Overview</h3>
                      <p className="text-sm text-gray-600 mt-2">
                        This is a brief overview of the course content and objectives.
                      </p>
                    </div>
                  )}

                  {activeTab === 'students' && (
                    <div className="p-6">
                      <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-medium text-gray-900">Enrolled Students</h3>
                        <button
                          onClick={() => setShowDepartmentImport(true)}
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                        >
                          Import Department
                        </button>
                      </div>
                      
                      {students.length === 0 ? (
                        <div className="text-center py-8">
                          <h3 className="mt-2 text-sm font-medium text-gray-900">No students enrolled</h3>
                          <p className="mt-1 text-sm text-gray-500">
                            Import students from a department to get started.
                          </p>
                        </div>
                      ) : (
                        <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                          <table className="min-w-full divide-y divide-gray-300">
                          <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Level</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                          </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                            {students.map((student) => (
                              <tr key={student.id}>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                      <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                                        <span className="text-sm font-medium text-gray-700">
                                          {student.full_name?.charAt(0) || 'S'}
                                        </span>
                                      </div>
                                      <div className="ml-4">
                                    <div className="text-sm font-medium text-gray-900">{student.full_name}</div>
                                    <div className="text-sm text-gray-500">{student.email}</div>
                                  </div>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {student.student_id || 'N/A'}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {student.level || 'N/A'}
                                </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                  {student.is_class_rep ? (
                                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                                      Class Rep
                                    </span>
                                  ) : (
                                      <button
                                        onClick={() => {/* handleSetClassRep */}}
                                        className="text-indigo-600 hover:text-indigo-900 text-xs"
                                      >
                                        Make Class Rep
                                      </button>
                                    )}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    <button className="text-red-600 hover:text-red-900">Remove</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'schedule' && (
                    <div>
                      <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-medium text-gray-900">Class Schedule</h3>
                        <button
                          onClick={() => setShowSessionModal(true)}
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                        >
                          Create Session
                        </button>
                      </div>
                      
                      {/* Sessions List */}
                      {loadingSessions ? (
                        <div className="text-center py-4">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                        </div>
                      ) : sessions.length === 0 ? (
                        <div className="text-center py-8">
                          <h3 className="mt-2 text-sm font-medium text-gray-900">No sessions created</h3>
                          <p className="mt-1 text-sm text-gray-500">
                            Create your first class session to get started.
                          </p>
                        </div>
                      ) : (
                      <div className="space-y-4">
                        {sessions.map((session) => (
                            <div key={session.id} className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start">
                              <div>
                                  <h4 className="text-lg font-medium text-gray-900">{session.title}</h4>
                                  <p className="text-sm text-gray-600">{session.description}</p>
                                  <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
                                    <span>📅 {new Date(session.scheduled_date).toLocaleDateString()}</span>
                                    <span>🕐 {session.start_time} - {session.end_time}</span>
                                    <span>📍 {session.effective_location}</span>
                                    <span className="capitalize bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                                      {session.class_type}
                                    </span>
                                  </div>
                                  {session.is_recurring && (
                                    <div className="mt-1 text-xs text-purple-600">
                                      🔄 Recurring {session.recurrence_pattern}
                                    </div>
                                  )}
                                </div>
                                <div className="text-right">
                                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                    session.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                  }`}>
                                    {session.is_active ? 'Active' : 'Inactive'}
                                  </span>
                                  <button
                                    onClick={() => handleEditSession(session)}
                                    className="ml-2 text-indigo-600 hover:text-indigo-900 text-xs"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleDeleteSession(session.id)}
                                    className="ml-2 text-red-600 hover:text-red-900 text-xs"
                                  >
                                    Delete
                                  </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'settings' && (
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">Course Settings</h3>
                      <p className="text-sm text-gray-600 mt-2">
                        Adjust course settings and preferences here.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <h3 className="mt-2 text-sm font-medium text-gray-900">No course selected</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Select a course to view details.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Session Modal */}
        {showSessionModal && selectedCourse && (
          <SessionModal
            selectedCourse={selectedCourse}
            onClose={() => {
              setShowSessionModal(false)
              setEditingSession(null)
            }}
            onSessionCreated={() => fetchCourseSessions(selectedCourse.assignment_id)}
            editingSession={editingSession}
          />
        )}

        {/* Department Import Modal */}
        {showDepartmentImport && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Import Students from Department</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Department
                    </label>
                  <select
                    value={selectedDepartment}
                    onChange={(e) => setSelectedDepartment(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select a department</option>
                    {departments.map(dept => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                  </div>
                  
                  <div className="flex justify-end space-x-3">
                    <button
                    onClick={() => setShowDepartmentImport(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                    >
                      Cancel
                    </button>
                    <button
                    onClick={handleImportDepartment}
                    disabled={!selectedDepartment || importingStudents}
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                    >
                    {importingStudents ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    ) : null}
                    {importingStudents ? 'Importing...' : 'Import Students'}
                    </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
} 
