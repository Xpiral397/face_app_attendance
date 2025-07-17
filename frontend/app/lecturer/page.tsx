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
      id: number
      name: string
    }
  }
  level: string
  credit_units: number
  is_active: boolean
}

interface Student {
  id: number
  full_name: string
  email: string
  level: string
  is_class_rep: boolean
  is_active: boolean
}

interface ClassSession {
  id: number
  course: number
  title: string
  description: string
  scheduled_time: string
  duration: number
  location: string
  is_recurring: boolean
  recurrence_pattern: string
  class_rep: number
  attendance_window_start: number
  attendance_window_end: number
  is_active: boolean
  created_at: string
}

export default function LecturerDashboard() {
  const [courses, setCourses] = useState<Course[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [sessions, setSessions] = useState<ClassSession[]>([])
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [selectedLevel, setSelectedLevel] = useState('')
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [scheduleForm, setScheduleForm] = useState({
    title: '',
    description: '',
    scheduled_time: '',
    duration: 60,
    location: '',
    is_recurring: false,
    recurrence_pattern: 'weekly',
    class_rep: '',
    attendance_window_start: -15,
    attendance_window_end: 15
  })

  const { user, isLecturer } = useAuth()

  useEffect(() => {
    if (isLecturer) {
      fetchLecturerCourses()
    }
  }, [isLecturer])

  useEffect(() => {
    if (selectedCourse) {
      fetchCourseStudents(selectedCourse.id)
      fetchCourseSessions(selectedCourse.id)
    }
  }, [selectedCourse])

  const fetchLecturerCourses = async () => {
    try {
      setLoading(true)
      const response = await apiClient.get('/courses/my-courses/')
      setCourses(response.data?.results || response.data || [])
    } catch (error) {
      console.error('Error fetching lecturer courses:', error)
      setError('Failed to load your courses')
    } finally {
      setLoading(false)
    }
  }

  const fetchCourseStudents = async (courseId: number) => {
    try {
      const response = await apiClient.get(`/courses/${courseId}/students/`)
      setStudents(response.data?.results || response.data || [])
    } catch (error) {
      console.error('Error fetching course students:', error)
      setError('Failed to load course students')
    }
  }

  const fetchCourseSessions = async (courseId: number) => {
    try {
      const response = await apiClient.get(`/courses/${courseId}/sessions/`)
      setSessions(response.data?.results || response.data || [])
    } catch (error) {
      console.error('Error fetching course sessions:', error)
      setError('Failed to load course sessions')
    }
  }

  const handleScheduleClass = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedCourse || !scheduleForm.title || !scheduleForm.scheduled_time) {
      setError('Please fill in all required fields')
      return
    }

    try {
      setError('')
      setSuccess('')

      const sessionData = {
        course: selectedCourse.id,
        title: scheduleForm.title,
        description: scheduleForm.description,
        scheduled_time: scheduleForm.scheduled_time,
        duration: scheduleForm.duration,
        location: scheduleForm.location,
        is_recurring: scheduleForm.is_recurring,
        recurrence_pattern: scheduleForm.is_recurring ? scheduleForm.recurrence_pattern : null,
        class_rep: scheduleForm.class_rep ? Number(scheduleForm.class_rep) : null,
        attendance_window_start: scheduleForm.attendance_window_start,
        attendance_window_end: scheduleForm.attendance_window_end
      }

      await apiClient.post('/courses/sessions/', sessionData)
      setSuccess('Class scheduled successfully!')
      setShowScheduleModal(false)
      resetScheduleForm()
      fetchCourseSessions(selectedCourse.id)
    } catch (error: any) {
      console.error('Error scheduling class:', error)
      setError(error.response?.data?.message || 'Failed to schedule class')
    }
  }

  const handleCancelSession = async (sessionId: number) => {
    if (!confirm('Are you sure you want to cancel this class session?')) {
      return
    }

    try {
      await apiClient.delete(`/courses/sessions/${sessionId}/`)
      setSuccess('Class session cancelled successfully!')
      if (selectedCourse) {
        fetchCourseSessions(selectedCourse.id)
      }
    } catch (error: any) {
      console.error('Error cancelling session:', error)
      setError(error.response?.data?.message || 'Failed to cancel session')
    }
  }

  const handleSetClassRep = async (studentId: number) => {
    if (!selectedCourse) return

    try {
      await apiClient.post(`/courses/${selectedCourse.id}/set-class-rep/`, {
        student_id: studentId
      })
      setSuccess('Class representative set successfully!')
      fetchCourseStudents(selectedCourse.id)
    } catch (error: any) {
      console.error('Error setting class rep:', error)
      setError(error.response?.data?.message || 'Failed to set class representative')
    }
  }

  const resetScheduleForm = () => {
    setScheduleForm({
      title: '',
      description: '',
      scheduled_time: '',
      duration: 60,
      location: '',
      is_recurring: false,
      recurrence_pattern: 'weekly',
      class_rep: '',
      attendance_window_start: -15,
      attendance_window_end: 15
    })
  }

  const handleScheduleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked
      setScheduleForm(prev => ({ ...prev, [name]: checked }))
    } else {
      setScheduleForm(prev => ({ ...prev, [name]: value }))
    }
  }

  const filteredStudents = selectedLevel 
    ? students.filter(student => student.level === selectedLevel)
    : students

  const upcomingSessions = sessions.filter(session => 
    new Date(session.scheduled_time) >= new Date()
  ).sort((a, b) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime())

  if (!user) {
    return <AppLayout><div>Loading...</div></AppLayout>
  }

  if (!isLecturer) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto p-6">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <h3 className="text-lg font-medium text-red-800">Access Denied</h3>
            <p className="text-red-700 mt-2">This page is only accessible to lecturers.</p>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Lecturer Dashboard</h1>
          <p className="text-gray-600 mt-2">Manage your courses and schedule classes</p>
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

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading your courses...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Courses Sidebar */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold mb-4">Your Courses</h2>
                <div className="space-y-3">
                  {courses.map((course) => (
                    <div
                      key={course.id}
                      className={`p-3 rounded-md border-2 cursor-pointer transition-colors ${
                        selectedCourse?.id === course.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedCourse(course)}
                    >
                      <div className="font-medium text-gray-900">{course.code}</div>
                      <div className="text-sm text-gray-500">{course.title}</div>
                      <div className="text-xs text-gray-400 mt-1">
                        {course.level} Level • {course.credit_units} Units
                      </div>
                    </div>
                  ))}
                </div>

                {courses.length === 0 && (
                  <p className="text-gray-500 text-center py-4">
                    No courses assigned to you yet.
                  </p>
                )}
              </div>
            </div>

            {/* Main Content */}
            <div className="lg:col-span-2">
              {selectedCourse ? (
                <div className="space-y-6">
                  {/* Course Header */}
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900">
                          {selectedCourse.code} - {selectedCourse.title}
                        </h2>
                        <p className="text-gray-600">
                          {selectedCourse.department.name} • {selectedCourse.level} Level
                        </p>
                      </div>
                      <button
                        onClick={() => setShowScheduleModal(true)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                      >
                        Schedule Class
                      </button>
                    </div>
                    <p className="text-gray-700">{selectedCourse.description}</p>
                  </div>

                  {/* Upcoming Sessions */}
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <h3 className="text-lg font-semibold mb-4">Upcoming Sessions</h3>
                    {upcomingSessions.length > 0 ? (
                      <div className="space-y-3">
                        {upcomingSessions.map((session) => (
                          <div key={session.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                            <div>
                              <div className="font-medium text-gray-900">{session.title}</div>
                              <div className="text-sm text-gray-500">
                                {new Date(session.scheduled_time).toLocaleDateString()} at{' '}
                                {new Date(session.scheduled_time).toLocaleTimeString()}
                              </div>
                              <div className="text-xs text-gray-400">
                                {session.location} • {session.duration} minutes
                                {session.is_recurring && ` • Recurring ${session.recurrence_pattern}`}
                              </div>
                            </div>
                            <button
                              onClick={() => handleCancelSession(session.id)}
                              className="text-red-600 hover:text-red-800 text-sm"
                            >
                              Cancel
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500">No upcoming sessions scheduled.</p>
                    )}
                  </div>

                  {/* Students */}
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold">Course Students</h3>
                      <select
                        value={selectedLevel}
                        onChange={(e) => setSelectedLevel(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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

                    {filteredStudents.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Student
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Level
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Status
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {filteredStudents.map((student) => (
                              <tr key={student.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div>
                                    <div className="text-sm font-medium text-gray-900">{student.full_name}</div>
                                    <div className="text-sm text-gray-500">{student.email}</div>
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                                    {student.level} Level
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  {student.is_class_rep ? (
                                    <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                                      Class Rep
                                    </span>
                                  ) : (
                                    <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                                      Student
                                    </span>
                                  )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                  {!student.is_class_rep && (
                                    <button
                                      onClick={() => handleSetClassRep(student.id)}
                                      className="text-blue-600 hover:text-blue-900"
                                    >
                                      Set as Class Rep
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-gray-500">No students found for this course.</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow-md p-6">
                  <div className="text-center py-8">
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">Select a Course</h2>
                    <p className="text-gray-600">Choose a course from the sidebar to view details and manage classes.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Schedule Class Modal */}
        {showScheduleModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold mb-4">Schedule Class Session</h2>
              
              <form onSubmit={handleScheduleClass} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Session Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="title"
                      value={scheduleForm.title}
                      onChange={handleScheduleFormChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Location
                    </label>
                    <input
                      type="text"
                      name="location"
                      value={scheduleForm.location}
                      onChange={handleScheduleFormChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    name="description"
                    value={scheduleForm.description}
                    onChange={handleScheduleFormChange}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date & Time <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="datetime-local"
                      name="scheduled_time"
                      value={scheduleForm.scheduled_time}
                      onChange={handleScheduleFormChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Duration (minutes)
                    </label>
                    <input
                      type="number"
                      name="duration"
                      value={scheduleForm.duration}
                      onChange={handleScheduleFormChange}
                      min="15"
                      max="300"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Class Representative
                  </label>
                  <select
                    name="class_rep"
                    value={scheduleForm.class_rep}
                    onChange={handleScheduleFormChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select class representative...</option>
                    {students.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.full_name} ({student.level} Level)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center space-x-4">
                  <input
                    type="checkbox"
                    name="is_recurring"
                    checked={scheduleForm.is_recurring}
                    onChange={handleScheduleFormChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label className="text-sm font-medium text-gray-700">
                    Recurring Event
                  </label>
                  
                  {scheduleForm.is_recurring && (
                    <select
                      name="recurrence_pattern"
                      value={scheduleForm.recurrence_pattern}
                      onChange={handleScheduleFormChange}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  )}
                </div>

                <div className="bg-gray-50 p-4 rounded-md">
                  <h4 className="font-medium text-gray-900 mb-3">Attendance Window</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Start (minutes before class)
                      </label>
                      <input
                        type="number"
                        name="attendance_window_start"
                        value={scheduleForm.attendance_window_start}
                        onChange={handleScheduleFormChange}
                        min="-60"
                        max="0"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        End (minutes after class starts)
                      </label>
                      <input
                        type="number"
                        name="attendance_window_end"
                        value={scheduleForm.attendance_window_end}
                        onChange={handleScheduleFormChange}
                        min="0"
                        max="60"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 mt-2">
                    Students can mark attendance from {Math.abs(scheduleForm.attendance_window_start)} minutes before 
                    class to {scheduleForm.attendance_window_end} minutes after class starts.
                  </p>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowScheduleModal(false)
                      resetScheduleForm()
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                  >
                    Schedule Class
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