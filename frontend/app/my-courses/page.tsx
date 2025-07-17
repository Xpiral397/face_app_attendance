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
  department: number
  level: string
  credit_units: number
  lecturer: number
  is_active: boolean
  enrollment_count?: number
}

interface Student {
  id: number
  full_name: string
  email: string
  student_id: string
  level: string
  is_class_rep: boolean
}

interface ClassSession {
  id: number
  course: number
  title: string
  description: string
  scheduled_time: string
  duration: number
  location: string
  is_cancelled: boolean
  is_recurring: boolean
  recurrence_pattern: string
}

export default function MyCoursesPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [sessions, setSessions] = useState<ClassSession[]>([])
  const [activeTab, setActiveTab] = useState('overview') // overview, students, schedule, settings
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showAddStudentModal, setShowAddStudentModal] = useState(false)
  const [showSessionModal, setShowSessionModal] = useState(false)
  const [searchEmail, setSearchEmail] = useState('')
  const [sessionForm, setSessionForm] = useState({
    title: '',
    description: '',
    scheduled_time: '',
    duration: 90,
    location: '',
    is_recurring: false,
    recurrence_pattern: 'weekly'
  })

  const { user, isLecturer } = useAuth()

  useEffect(() => {
    if (isLecturer) {
      fetchMyCourses()
    }
  }, [isLecturer])

  useEffect(() => {
    if (selectedCourse) {
      fetchCourseStudents(selectedCourse.id)
      fetchCourseSessions(selectedCourse.id)
    }
  }, [selectedCourse])

  const fetchMyCourses = async () => {
    try {
      setLoading(true)
      const response = await apiClient.get('/courses/courses/?lecturer=me')
      const coursesData = response.data || []
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

  const fetchCourseStudents = async (courseId: number) => {
    try {
      const response = await apiClient.get(`/courses/enrollments/?course=${courseId}&status=approved`)
      const enrollmentsData = response.data || []
      const studentsData = enrollmentsData.map((enrollment: any) => ({
        ...enrollment.student,
        is_class_rep: enrollment.is_class_rep || false
      }))
      setStudents(studentsData)
    } catch (error) {
      console.error('Error fetching students:', error)
    }
  }

  const fetchCourseSessions = async (courseId: number) => {
    try {
      const response = await apiClient.get(`/courses/sessions/?course=${courseId}`)
      setSessions(response.data || [])
    } catch (error) {
      console.error('Error fetching sessions:', error)
    }
  }

  const handleAddStudent = async () => {
    if (!searchEmail.trim()) return
    
    try {
      const response = await apiClient.post('/courses/enrollments/', {
        course: selectedCourse?.id,
        student_email: searchEmail,
        status: 'approved'
      })
      setSuccess('Student added successfully!')
      setSearchEmail('')
      setShowAddStudentModal(false)
      fetchCourseStudents(selectedCourse!.id)
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to add student')
    }
  }

  const handleRemoveStudent = async (studentId: number) => {
    if (!confirm('Are you sure you want to remove this student from the course?')) return
    
    try {
      await apiClient.delete(`/courses/enrollments/${studentId}/`)
      setSuccess('Student removed successfully!')
      fetchCourseStudents(selectedCourse!.id)
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to remove student')
    }
  }

  const handleSetClassRep = async (studentId: number) => {
    try {
      // First, remove class rep status from all students
      await apiClient.post('/courses/enrollments/set-class-rep/', {
        course: selectedCourse?.id,
        student: studentId
      })
      setSuccess('Class representative updated successfully!')
      fetchCourseStudents(selectedCourse!.id)
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to set class representative')
    }
  }

  const handleCreateSession = async () => {
    try {
      const sessionData = {
        ...sessionForm,
        course: selectedCourse?.id,
        scheduled_time: new Date(sessionForm.scheduled_time).toISOString()
      }
      
      await apiClient.post('/courses/sessions/', sessionData)
      setSuccess('Class session created successfully!')
      setShowSessionModal(false)
      resetSessionForm()
      fetchCourseSessions(selectedCourse!.id)
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to create session')
    }
  }

  const handleCancelSession = async (sessionId: number) => {
    if (!confirm('Are you sure you want to cancel this session?')) return
    
    try {
      await apiClient.patch(`/courses/sessions/${sessionId}/`, { is_cancelled: true })
      setSuccess('Session cancelled successfully!')
      fetchCourseSessions(selectedCourse!.id)
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to cancel session')
    }
  }

  const resetSessionForm = () => {
    setSessionForm({
      title: '',
      description: '',
      scheduled_time: '',
      duration: 90,
      location: '',
      is_recurring: false,
      recurrence_pattern: 'weekly'
    })
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
          {/* Sidebar - Course List */}
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
                        onClick={() => setSelectedCourse(course)}
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

          {/* Main Content */}
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
                <div className="border-b border-gray-200">
                  <nav className="flex space-x-8 px-6">
                    {[
                      { id: 'overview', label: 'Overview' },
                      { id: 'students', label: 'Students' },
                      { id: 'schedule', label: 'Schedule' },
                      { id: 'settings', label: 'Settings' }
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                          activeTab === tab.id
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </nav>
                </div>

                {/* Tab Content */}
                <div className="p-6">
                  {/* Overview Tab */}
                  {activeTab === 'overview' && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-blue-50 p-4 rounded-lg">
                          <h3 className="text-lg font-semibold text-blue-900">{students.length}</h3>
                          <p className="text-blue-700 text-sm">Enrolled Students</p>
                        </div>
                        <div className="bg-green-50 p-4 rounded-lg">
                          <h3 className="text-lg font-semibold text-green-900">{sessions.length}</h3>
                          <p className="text-green-700 text-sm">Scheduled Sessions</p>
                        </div>
                        <div className="bg-purple-50 p-4 rounded-lg">
                          <h3 className="text-lg font-semibold text-purple-900">
                            {students.filter(s => s.is_class_rep).length}
                          </h3>
                          <p className="text-purple-700 text-sm">Class Representative</p>
                        </div>
                      </div>
                      
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-3">Recent Sessions</h3>
                        <div className="space-y-2">
                          {sessions.slice(0, 3).map((session) => (
                            <div key={session.id} className="p-3 bg-gray-50 rounded-lg">
                              <h4 className="font-medium text-gray-900">{session.title}</h4>
                              <p className="text-sm text-gray-600">
                                {new Date(session.scheduled_time).toLocaleString()}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Students Tab */}
                  {activeTab === 'students' && (
                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">Enrolled Students</h3>
                        <button
                          onClick={() => setShowAddStudentModal(true)}
                          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm"
                        >
                          Add Student
                        </button>
                      </div>
                      
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                Student
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                ID
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                Level
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                Role
                              </th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {students.map((student) => (
                              <tr key={student.id}>
                                <td className="px-4 py-2">
                                  <div>
                                    <div className="text-sm font-medium text-gray-900">{student.full_name}</div>
                                    <div className="text-sm text-gray-500">{student.email}</div>
                                  </div>
                                </td>
                                <td className="px-4 py-2 text-sm text-gray-900">{student.student_id}</td>
                                <td className="px-4 py-2 text-sm text-gray-900">{student.level}</td>
                                <td className="px-4 py-2">
                                  {student.is_class_rep ? (
                                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                                      Class Rep
                                    </span>
                                  ) : (
                                    <span className="text-sm text-gray-500">Student</span>
                                  )}
                                </td>
                                <td className="px-4 py-2 text-right text-sm">
                                  <div className="flex justify-end space-x-2">
                                    {!student.is_class_rep && (
                                      <button
                                        onClick={() => handleSetClassRep(student.id)}
                                        className="text-blue-600 hover:text-blue-800 text-xs"
                                      >
                                        Set as Rep
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handleRemoveStudent(student.id)}
                                      className="text-red-600 hover:text-red-800 text-xs"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Schedule Tab */}
                  {activeTab === 'schedule' && (
                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">Class Schedule</h3>
                        <button
                          onClick={() => setShowSessionModal(true)}
                          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm"
                        >
                          Schedule Class
                        </button>
                      </div>
                      
                      <div className="space-y-4">
                        {sessions.map((session) => (
                          <div key={session.id} className="p-4 border border-gray-200 rounded-lg">
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="font-medium text-gray-900">{session.title}</h4>
                                <p className="text-sm text-gray-600 mt-1">{session.description}</p>
                                <div className="mt-2 text-sm text-gray-500">
                                  <p>📅 {new Date(session.scheduled_time).toLocaleString()}</p>
                                  <p>⏱️ {session.duration} minutes</p>
                                  <p>📍 {session.location}</p>
                                  {session.is_recurring && (
                                    <p>🔄 Recurring ({session.recurrence_pattern})</p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                {session.is_cancelled ? (
                                  <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                                    Cancelled
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => handleCancelSession(session.id)}
                                    className="text-red-600 hover:text-red-800 text-sm"
                                  >
                                    Cancel
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Settings Tab */}
                  {activeTab === 'settings' && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Course Settings</h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Course Status
                          </label>
                          <select className="w-full px-3 py-2 border border-gray-300 rounded-md">
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Enrollment Limit
                          </label>
                          <input
                            type="number"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            placeholder="Enter enrollment limit"
                          />
                        </div>
                        
                        <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                          Save Changes
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
                <p className="text-gray-500">Select a course to manage</p>
              </div>
            )}
          </div>
        </div>

        {/* Add Student Modal */}
        {showAddStudentModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Add Student to Course</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Student Email
                    </label>
                    <input
                      type="email"
                      value={searchEmail}
                      onChange={(e) => setSearchEmail(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="Enter student email"
                    />
                  </div>
                  
                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={() => setShowAddStudentModal(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddStudent}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                    >
                      Add Student
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Schedule Session Modal */}
        {showSessionModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Schedule Class Session</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                    <input
                      type="text"
                      value={sessionForm.title}
                      onChange={(e) => setSessionForm({...sessionForm, title: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="Enter session title"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Date & Time</label>
                    <input
                      type="datetime-local"
                      value={sessionForm.scheduled_time}
                      onChange={(e) => setSessionForm({...sessionForm, scheduled_time: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Duration (minutes)</label>
                    <input
                      type="number"
                      value={sessionForm.duration}
                      onChange={(e) => setSessionForm({...sessionForm, duration: parseInt(e.target.value)})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                    <input
                      type="text"
                      value={sessionForm.location}
                      onChange={(e) => setSessionForm({...sessionForm, location: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="Enter location"
                    />
                  </div>
                  
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="recurring"
                      checked={sessionForm.is_recurring}
                      onChange={(e) => setSessionForm({...sessionForm, is_recurring: e.target.checked})}
                      className="mr-2"
                    />
                    <label htmlFor="recurring" className="text-sm text-gray-700">
                      Recurring session
                    </label>
                  </div>
                  
                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={() => setShowSessionModal(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateSession}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                    >
                      Schedule
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
} 