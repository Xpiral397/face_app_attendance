'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import { apiClient } from '../../../utils/api'
import AppLayout from '../../../components/AppLayout'
import FaceScanner from '../../../components/FaceScanner'
import { FaceRecognitionResult } from '../../../utils/faceRecognition'

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
  const [isFaceScanning, setIsFaceScanning] = useState(false)
  const [faceScannerCallback, setFaceScannerCallback] = useState<((result: FaceRecognitionResult) => void) | null>(null)

  const { user, isStudent } = useAuth()

  useEffect(() => {
    if (isStudent) {
      fetchAvailableSessions()
    }
  }, [isStudent])

  const fetchAvailableSessions = async () => {
    try {
      setLoading(true)
      const today = new Date().toISOString().split('T')[0]
      
      // Get today's sessions for the student
      const response = await apiClient.get(`/courses/sessions/?scheduled_date=${today}`)
      const todaySessions = response.results || response || []
      
      // Filter sessions where attendance is open or about to open
      const now = new Date()
      const currentTime = now.toTimeString().substring(0, 5) // HH:MM format
      
      const availableForAttendance = todaySessions.filter((session: Session) => {
        const attendanceStart = session.attendance_window_start
        const attendanceEnd = session.attendance_window_end
        
        // Check if current time is within attendance window or session is about to start
        return currentTime >= attendanceStart && currentTime <= attendanceEnd
      })
      
      setAvailableSessions(availableForAttendance)
    } catch (error) {
      console.error('Error fetching sessions:', error)
      setError('Failed to fetch available sessions')
    } finally {
      setLoading(false)
    }
  }

  const handleMarkAttendance = async (sessionId: number, method: 'manual' | 'face') => {
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      let faceVerified = false
      let capturedImage = ''

      if (method === 'face') {
        setIsFaceScanning(true)
        const faceResult = await new Promise<{verified: boolean, capturedImage?: string, error?: string}>((resolve) => {
          setFaceScannerCallback(() => resolve)
        })

        setIsFaceScanning(false)
        
        if (!faceResult.verified) {
          // Enhanced error handling for face verification failures
          const errorMsg = faceResult.error || 'Face verification failed'
          setError(`❌ ${errorMsg}`)
          return
        }

        faceVerified = true
        capturedImage = faceResult.imageData || '' // Assuming imageData is the correct property from FaceRecognitionResult
        setSuccess('✅ Face verified successfully!')
      }

      const response = await apiClient.post('/courses/attendance/', {
        class_session_id: sessionId,
        face_verified: faceVerified,
        captured_image: capturedImage,
        notes: method === 'face' ? 'Marked via face recognition' : 'Marked manually'
      })

      // Success feedback with status indicator
      const statusIcon = method === 'face' ? '📷✅' : '✅'
      const methodText = method === 'face' ? 'face recognition' : 'manual marking'
      setSuccess(`${statusIcon} Attendance marked successfully via ${methodText}!`)
      
      // Refresh sessions to show updated attendance status
      fetchAvailableSessions()

    } catch (error: any) {
      console.error('Attendance marking error:', error)
      
      // Enhanced error handling with specific error types
      if (error.response?.data) {
        const errorData = error.response.data
        
        // Handle already marked attendance with special UI
        if (errorData.error_type === 'already_marked') {
          const details = errorData.details
          const icon = errorData.icon || '✅'
          const statusBadge = details.face_verified ? '📷' : '📝'
          
          setError(`
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div class="flex items-center">
                <span class="text-2xl mr-3">${icon}</span>
                <div>
                  <h4 class="font-semibold text-blue-900">Attendance Already Marked</h4>
                  <p class="text-blue-700 mt-1">
                    ${statusBadge} ${details.display_status} - ${details.marked_time} on ${details.marked_date}
                  </p>
                  <p class="text-sm text-blue-600">
                    Course: ${details.course_code} - ${details.session_title}
                  </p>
                </div>
              </div>
            </div>
          `)
          return
        }
        
        // Handle face recognition specific errors
        if (errorData.error_type === 'no_face_detected') {
          setError(`
            <div class="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div class="flex items-center mb-2">
                <span class="text-2xl mr-3">📷❌</span>
                <h4 class="font-semibold text-orange-900">No Face Detected</h4>
              </div>
              <p class="text-orange-700 mb-2">${errorData.error}</p>
              <div class="text-sm text-orange-600">
                <p class="font-medium mb-1">Try these suggestions:</p>
                <ul class="list-disc list-inside space-y-1">
                  ${errorData.suggestions?.map((s: string) => `<li>${s}</li>`).join('') || ''}
                </ul>
              </div>
            </div>
          `)
        } else if (errorData.error_type === 'verification_failed') {
          setError(`
            <div class="bg-red-50 border border-red-200 rounded-lg p-4">
              <div class="flex items-center mb-2">
                <span class="text-2xl mr-3">🔍❌</span>
                <h4 class="font-semibold text-red-900">Face Verification Failed</h4>
              </div>
              <p class="text-red-700 mb-2">${errorData.error}</p>
              <div class="text-sm text-red-600">
                <p class="font-medium mb-1">Suggestions:</p>
                <ul class="list-disc list-inside space-y-1">
                  ${errorData.suggestions?.map((s: string) => `<li>${s}</li>`).join('') || ''}
                </ul>
              </div>
            </div>
          `)
        } else if (errorData.error_type === 'no_registered_face') {
          setError(`
            <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div class="flex items-center mb-2">
                <span class="text-2xl mr-3">👤❓</span>
                <h4 class="font-semibold text-yellow-900">No Registered Face</h4>
              </div>
              <p class="text-yellow-700 mb-3">${errorData.error}</p>
              <a href="/face-registration" class="inline-flex items-center px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors">
                📷 Register Your Face
              </a>
            </div>
          `)
        } else {
          // Generic error handling
          const errorIcon = errorData.error_type === 'technical_error' ? '⚠️' : '❌'
          setError(`${errorIcon} ${errorData.error || errorData.message || 'Failed to mark attendance'}`)
        }
      } else {
        setError('❌ Network error. Please check your connection and try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleFaceVerificationComplete = async (result: FaceRecognitionResult) => {
    setShowFaceScanner(false)
    
    if (!selectedSessionForScanning) {
      setError('Session not found')
      return
    }

    if (result.success) {
      await handleMarkAttendance(selectedSessionForScanning.id, 'face')
    } else {
      setError(result.error || 'Face verification failed. Please try again.')
    }
    
    setSelectedSessionForScanning(null)
  }

  const getAttendanceStatus = (session: Session) => {
    const now = new Date()
    const currentTime = now.toTimeString().substring(0, 5)
    const sessionStart = session.start_time
    const attendanceEnd = session.attendance_window_end
    
    if (currentTime < session.attendance_window_start) {
      return { status: 'not_open', message: 'Attendance not open yet', color: 'gray' }
    } else if (currentTime > attendanceEnd) {
      return { status: 'closed', message: 'Attendance window closed', color: 'red' }
    } else if (currentTime <= sessionStart) {
      return { status: 'on_time', message: 'Mark attendance (On Time)', color: 'green' }
    } else {
      return { status: 'late', message: 'Mark attendance (Late)', color: 'yellow' }
    }
  }

  const isAttendanceOpen = (session: Session) => {
    const now = new Date();
    const currentTime = now.toTimeString().substring(0, 5);
    return currentTime >= session.attendance_window_start && currentTime <= session.attendance_window_end;
  };

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
          <p className="text-gray-600 mt-2">Mark your attendance for today's classes</p>
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
            <p className="text-gray-500 mt-2">Loading today's sessions...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {availableSessions.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-6xl mb-4">📅</div>
                <h3 className="text-lg font-medium text-gray-900">No Sessions Available</h3>
                <p className="text-gray-500 mt-2">
                  You don't have any classes scheduled for today or all attendance windows have closed.
                </p>
              </div>
            ) : (
              availableSessions.map((session) => {
                const attendanceStatus = getAttendanceStatus(session)
                
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
                                  📝 ✅ Marked
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
                          {!isAttendanceOpen(session) ? (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                              <div className="flex items-center">
                                <span className="text-xl mr-2">⏳</span>
                                <div>
                                  <p className="text-yellow-800 text-sm font-medium">Attendance window not open</p>
                                  <p className="text-yellow-600 text-xs">
                                    Window: {session.attendance_window_start} - {session.attendance_window_end}
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
                          {isAttendanceOpen(session) && (
                            <>
                              <button
                                onClick={() => handleMarkAttendance(session.id, 'face')}
                                disabled={loading}
                                className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {loading ? (
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                ) : (
                                  <span className="mr-2">📷</span>
                                )}
                                Face Recognition
                              </button>
                              
                              <button
                                onClick={() => handleMarkAttendance(session.id, 'manual')}
                                disabled={loading}
                                className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {loading ? (
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                                ) : (
                                  <span className="mr-2">📝</span>
                                )}
                                Manual Mark
                              </button>
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
            }}
          />
        )}
      </div>
    </AppLayout>
  )
} 