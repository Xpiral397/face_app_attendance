'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import { apiClient } from '../../../utils/api'
import AppLayout from '../../../components/AppLayout'
import FaceScanner from '../../../components/FaceScanner'

interface Session {
  id: number
  title: string
  course_assignment: {
    course: {
      code: string
      title: string
    }
    lecturer: {
      full_name: string
    }
  }
  scheduled_date: string
  start_time: string
  end_time: string
  attendance_window_start: string
  attendance_window_end: string
  attendance_method: 'manual' | 'face_recognition' | 'both'
  effective_location: string
  class_type: string
  is_attendance_open: boolean
  user_attendance?: {
    id: number;
    face_verified: boolean;
    status: 'present' | 'late' | string;
    marked_at: string;
    notes?: string;
  };
  description?: string;
}

export default function MarkAttendancePage() {
  const [availableSessions, setAvailableSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [markingAttendance, setMarkingAttendance] = useState<number | null>(null)
  const [showFaceScanner, setShowFaceScanner] = useState(false)
  const [selectedSessionForScanning, setSelectedSessionForScanning] = useState<Session | null>(null)

  const { user, isStudent } = useAuth()

  useEffect(() => {
    if (isStudent) {
      fetchAvailableSessions()
    }
  }, [isStudent])

  const isAttendanceOpen = (session: Session) => {
    const now = new Date()
    const currentTime = now.toTimeString().substring(0, 5) // HH:MM format
    
    const attendanceStart = session.attendance_window_start
    const attendanceEnd = session.attendance_window_end
    
    return currentTime >= attendanceStart && currentTime <= attendanceEnd
  }

  const fetchAvailableSessions = async () => {
    try {
      setLoading(true)
      setError('')
      const today = new Date().toISOString().split('T')[0]
      
      console.log('Fetching sessions for date:', today)
      
      // Get today's sessions
      const response = await apiClient.get(`/courses/sessions/?scheduled_date=${today}`)
      const todaySessions = response.results || response || []
      
      console.log('API Response:', todaySessions)
      
      // Don't filter - show ALL sessions and let UI show status
      setAvailableSessions(todaySessions)
      
      if (todaySessions.length === 0) {
        setError('No classes scheduled for today.')
      }
      
    } catch (error: any) {
      console.error('Error fetching sessions:', error)
      setError(`Failed to fetch sessions: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleFaceRecognition = async (sessionId: number) => {
    try {
      setError('')
      setSuccess('')
      setMarkingAttendance(sessionId)
      
      const session = availableSessions.find(s => s.id === sessionId)
      if (!session) {
        setError('❌ Session not found')
        return
      }

      setSelectedSessionForScanning(session)
      setShowFaceScanner(true)
    } catch (error: any) {
      console.error('Face recognition error:', error)
      setError('❌ Failed to start face recognition')
    } finally {
      setMarkingAttendance(null)
    }
  }

  const handleFaceVerificationComplete = async (result: { success: boolean; imageData?: string; error?: string }) => {
    setShowFaceScanner(false)
    
    if (!selectedSessionForScanning) {
      setError('❌ Session not found')
      return
    }

    if (!result.success) {
      setError(result.error || '❌ Face verification failed. Please try again.')
      setSelectedSessionForScanning(null)
      return
    }

    try {
      setMarkingAttendance(selectedSessionForScanning.id)
      
      // Create FormData for sending image
      const formData = new FormData()
      
      // Convert base64 image to blob
      if (result.imageData) {
        const response = await fetch(result.imageData)
        const blob = await response.blob()
        formData.append('image', blob, 'face_capture.jpg')
      }
      
      formData.append('class_session_id', selectedSessionForScanning.id.toString())

      console.log('Sending face verification and attendance marking request...')

      // Use the uploadFile method for FormData
      const response = await apiClient.uploadFile('/face/verify-and-mark-attendance/', formData)

      if (response.success) {
        setSuccess(`📷✅ ${response.message}`)
        
        // Refresh sessions to show updated attendance status
        await fetchAvailableSessions()
        
        // Clear success message after 5 seconds
        setTimeout(() => setSuccess(''), 5000)
      } else {
        setError(`❌ ${response.error || 'Attendance marking failed'}`)
      }

    } catch (error: any) {
      console.error('Attendance marking error:', error)
      
      const errorData = error.response?.data || error
      
      if (errorData?.error_type === 'already_marked') {
        const details = errorData.details
        setError(`
          ✅ Attendance already marked for this session!
          
          📋 Status: ${details.status}
          🕐 Marked at: ${new Date(details.marked_at).toLocaleString()}
          ${details.face_verified ? '📷 Face Verified' : '📝 Manual Entry'}
          📚 Course: ${details.course_code} - ${details.session_title}
        `)
        
        // Refresh to show current status
        await fetchAvailableSessions()
      } else {
        setError(`❌ ${errorData?.error || error.message || 'Failed to mark attendance'}`)
      }
    } finally {
      setMarkingAttendance(null)
      setSelectedSessionForScanning(null)
    }
  }

  const handleManualMark = async (sessionId: number) => {
    try {
      setError('')
      setSuccess('')
      setMarkingAttendance(sessionId)

      const session = availableSessions.find(s => s.id === sessionId)
      if (!session) {
        setError('❌ Session not found')
        return
      }

      const attendanceData = {
        class_session_id: sessionId,
        face_verified: false,
        notes: 'Marked manually'
      }

      console.log('Saving manual attendance:', attendanceData)

      const response = await apiClient.post('/courses/attendance/', attendanceData)

      setSuccess('✅ Attendance marked manually!')
      
      // Refresh sessions to show updated attendance status
      await fetchAvailableSessions()
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000)

    } catch (error: any) {
      console.error('Manual attendance error:', error)
      
      const errorData = error.response?.data
      
      if (errorData?.error_type === 'already_marked') {
        const details = errorData.details
        setError(`
          ✅ Attendance already marked for this session!
          
          📋 Status: ${details.status}
          🕐 Marked at: ${new Date(details.marked_at).toLocaleString()}
          ${details.face_verified ? '📷 Face Verified' : '📝 Manual Entry'}
        `)
        
        await fetchAvailableSessions()
      } else {
        setError(`❌ ${errorData?.error || error.message || 'Failed to mark attendance'}`)
      }
    } finally {
      setMarkingAttendance(null)
    }
  }

  const getAttendanceStatus = (session: Session) => {
    const now = new Date()
    const currentTime = now.toTimeString().substring(0, 5) // HH:MM format
    
    const attendanceStart = session.attendance_window_start
    const attendanceEnd = session.attendance_window_end
    
    if (currentTime < attendanceStart) {
      return 'upcoming'
    } else if (currentTime > attendanceEnd) {
      return 'closed'
    } else {
      return 'open'
    }
  }

  if (!isStudent) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto p-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <h3 className="text-lg font-medium text-yellow-800">Student Access Only</h3>
            <p className="text-yellow-700 mt-2">Only students can mark attendance.</p>
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
          <h1 className="text-3xl font-bold text-gray-900">Mark Attendance</h1>
          <p className="text-gray-600 mt-2">Mark your attendance for today's classes using face recognition or manual entry</p>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-md p-4">
            <p className="text-green-700 whitespace-pre-line">{success}</p>
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
            <p className="text-red-700 whitespace-pre-line">{error}</p>
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
            <p className="text-gray-500 mt-2">Loading today's sessions...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {availableSessions.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-6xl mb-4">📅</div>
                <h3 className="text-lg font-medium text-gray-900">No Sessions Available</h3>
                <p className="text-gray-500 mt-2">
                  You don't have any classes scheduled for today.
                </p>
              </div>
            ) : (
              availableSessions.map((session) => {
                const attendanceStatus = getAttendanceStatus(session)
                const isMarking = markingAttendance === session.id
                
                return (
                  <div key={session.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h3 className="text-lg font-semibold text-gray-900">{session.title}</h3>
                          {/* Attendance Status Badge */}
                          {session.user_attendance && (
                            <div className="flex items-center space-x-1">
                              {session.user_attendance.face_verified ? (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  📷 ✅ Face Verified
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  📝 ✅ Manually Marked
                                </span>
                              )}
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                {session.user_attendance.status === 'present' ? '⏰ On Time' : 
                                 session.user_attendance.status === 'late' ? '⏰ Late' : 
                                 session.user_attendance.status}
                              </span>
                            </div>
                          )}
                        </div>
                        <p className="text-gray-600 mt-1">{session.description}</p>
                        <div className="mt-2 space-y-1 text-sm text-gray-500">
                          <p>📅 {new Date(session.scheduled_date).toLocaleDateString()}</p>
                          <p>🕐 {session.start_time} - {session.end_time}</p>
                          <p>📍 {session.effective_location}</p>
                          <p>🎓 {session.course_assignment.course.code} - {session.course_assignment.course.title}</p>
                          <p>👨‍🏫 {session.course_assignment.lecturer.full_name}</p>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          session.class_type === 'lecture' ? 'bg-blue-100 text-blue-800' :
                          session.class_type === 'practical' ? 'bg-green-100 text-green-800' :
                          session.class_type === 'tutorial' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {session.class_type}
                        </span>
                      </div>
                    </div>

                    {/* Attendance Status Info */}
                    {session.user_attendance ? (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                        <div className="flex items-center">
                          <span className="text-2xl mr-3">✅</span>
                          <div>
                            <h4 className="font-semibold text-green-900">Attendance Marked</h4>
                            <p className="text-green-700 text-sm">
                              {session.user_attendance.face_verified ? '📷 Verified with face recognition' : '📝 Marked manually'} 
                              {' '}at {new Date(session.user_attendance.marked_at).toLocaleTimeString()}
                            </p>
                            <p className="text-green-600 text-xs mt-1">
                              Status: {session.user_attendance.status === 'present' ? '⏰ On Time' : 
                                      session.user_attendance.status === 'late' ? '⏰ Late' : 
                                      session.user_attendance.status}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Attendance Window Status */}
                        <div className="mb-4">
                          {attendanceStatus === 'upcoming' ? (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                              <div className="flex items-center">
                                <span className="text-xl mr-2">⏳</span>
                                <div>
                                  <p className="text-blue-800 text-sm font-medium">Attendance window not open yet</p>
                                  <p className="text-blue-600 text-xs">
                                    Window opens at {session.attendance_window_start}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ) : attendanceStatus === 'closed' ? (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                              <div className="flex items-center">
                                <span className="text-xl mr-2">🔒</span>
                                <div>
                                  <p className="text-red-800 text-sm font-medium">Attendance window closed</p>
                                  <p className="text-red-600 text-xs">
                                    Window closed at {session.attendance_window_end}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                              <div className="flex items-center">
                                <span className="text-xl mr-2">🟢</span>
                                <div>
                                  <p className="text-green-800 text-sm font-medium">Attendance window is open</p>
                                  <p className="text-green-600 text-xs">
                                    Closes at {session.attendance_window_end}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex space-x-3">
                          {attendanceStatus === 'open' && (
                            <>
                              <button
                                onClick={() => handleFaceRecognition(session.id)}
                                disabled={isMarking}
                                className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {isMarking ? (
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                ) : (
                                  <span className="mr-2">📷</span>
                                )}
                                {isMarking ? 'Processing...' : 'Face Recognition'}
                              </button>
                              
                              {session.attendance_method === 'both' && (
                                <button
                                  onClick={() => handleManualMark(session.id)}
                                  disabled={isMarking}
                                  className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {isMarking ? (
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                                  ) : (
                                    <span className="mr-2">📝</span>
                                  )}
                                  {isMarking ? 'Processing...' : 'Manual Mark'}
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* Face Scanner Modal */}
        {showFaceScanner && selectedSessionForScanning && (
          <FaceScanner
            sessionTitle={`${selectedSessionForScanning.course_assignment.course.code} - ${selectedSessionForScanning.title}`}
            onVerificationComplete={handleFaceVerificationComplete}
            onClose={() => {
              setShowFaceScanner(false)
              setSelectedSessionForScanning(null)
              setMarkingAttendance(null)
            }}
          />
        )}
      </div>
    </AppLayout>
  )
} 