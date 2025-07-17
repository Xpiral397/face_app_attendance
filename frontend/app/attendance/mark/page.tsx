'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '../../../contexts/AuthContext'
import { sessionApi, enrollmentApi, faceApi } from '../../../utils/api'
import { ClassSession, Enrollment, PaginatedResponse } from '../../../types'
import { format, parseISO, isWithinInterval, subMinutes, addMinutes } from 'date-fns'
import Webcam from 'react-webcam'
import toast from 'react-hot-toast'

interface AvailableSession {
  session: ClassSession
  course_code: string
  course_title: string
  lecturer: string
  time_remaining: number
  can_mark: boolean
}

export default function MarkAttendancePage() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isWebcamReady, setIsWebcamReady] = useState(false)
  const [attendanceMarked, setAttendanceMarked] = useState(false)
  const [availableSessions, setAvailableSessions] = useState<AvailableSession[]>([])
  const [selectedSession, setSelectedSession] = useState<ClassSession | null>(null)
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [useManualMode, setUseManualMode] = useState(false)
  
  const webcamRef = useRef<Webcam>(null)
  const { user, isAuthenticated, isStudent } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login')
    } else if (!isStudent) {
      router.push('/dashboard')
    } else {
      fetchAvailableSessions()
    }
  }, [isAuthenticated, isStudent, router])

  useEffect(() => {
    // Auto-select session if provided in URL
    const sessionId = searchParams.get('session_id')
    if (sessionId && availableSessions.length > 0) {
      const session = availableSessions.find(s => s.session.id === parseInt(sessionId))
      if (session) {
        setSelectedSession(session.session)
      }
    }
  }, [searchParams, availableSessions])

  const fetchAvailableSessions = async () => {
    try {
      setLoadingSessions(true)
      
      // Get student's enrollments
      const enrollmentsResponse: PaginatedResponse<Enrollment> = await enrollmentApi.getEnrollments('status=approved')
      const enrollments = enrollmentsResponse.results || []
      
      const now = new Date()
      const today = now.toISOString().split('T')[0]
      
      const availableSessionsData: AvailableSession[] = []
      
      for (const enrollment of enrollments) {
        // Get today's sessions for this course
        const sessionsResponse: PaginatedResponse<ClassSession> = await sessionApi.getSessions(
          `course_assignment=${enrollment.course_assignment.id}&scheduled_date=${today}`
        )
        const sessions = sessionsResponse.results || []
        
        for (const session of sessions) {
          const sessionStart = new Date(`${session.scheduled_date}T${session.start_time}`)
          const windowStart = subMinutes(sessionStart, session.attendance_window_start || 5)
          const windowEnd = addMinutes(sessionStart, session.attendance_window_end || 5)
          
          const isInWindow = isWithinInterval(now, { start: windowStart, end: windowEnd })
          
          if (isInWindow) {
            // Check if student has already marked attendance
            try {
              const attendanceResponse = await sessionApi.getClassAttendance(session.id)
              const hasAttended = attendanceResponse.results?.some(
                (record: any) => record.student.id === user?.id
              )
              
              if (!hasAttended) {
                const timeRemaining = Math.max(0, windowEnd.getTime() - now.getTime())
                
                availableSessionsData.push({
                  session,
                  course_code: enrollment.course_assignment.course.code,
                  course_title: enrollment.course_assignment.course.title,
                  lecturer: enrollment.course_assignment.lecturer.full_name,
                  time_remaining: timeRemaining,
                  can_mark: true
                })
              }
            } catch (err) {
              // If we can't get attendance records, assume student hasn't attended
              const timeRemaining = Math.max(0, windowEnd.getTime() - now.getTime())
              
              availableSessionsData.push({
                session,
                course_code: enrollment.course_assignment.course.code,
                course_title: enrollment.course_assignment.course.title,
                lecturer: enrollment.course_assignment.lecturer.full_name,
                time_remaining: timeRemaining,
                can_mark: true
              })
            }
          }
        }
      }
      
      setAvailableSessions(availableSessionsData)
    } catch (error) {
      console.error('Error fetching available sessions:', error)
      setError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setLoadingSessions(false)
    }
  }

  const capturePhoto = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot()
    return imageSrc
  }, [webcamRef])

  const handleMarkAttendanceWithFace = async () => {
    if (!selectedSession) {
      setError('Please select a session first')
      return
    }

    if (!isWebcamReady) {
      setError('Please wait for the camera to initialize')
      return
    }

    setLoading(true)
    setError('')
    setMessage('')

    try {
      const imageData = capturePhoto()
      if (!imageData) {
        throw new Error('Failed to capture image')
      }

      // Convert base64 to blob
      const response = await fetch(imageData)
      const blob = await response.blob()

      // Create FormData
      const formData = new FormData()
      formData.append('image', blob, 'attendance_photo.jpg')
      formData.append('session_id', selectedSession.id.toString())

      // Send to backend using face recognition attendance endpoint
      const result = await faceApi.verifyFace(formData)
      
      if (result.success) {
        // Mark attendance via class session API
        await sessionApi.markClassAttendance({
          session_id: selectedSession.id,
          status: 'present'
        })
        
        setMessage('Attendance marked successfully with face verification!')
        setAttendanceMarked(true)
        toast.success('Attendance marked successfully!')
        
        // Refresh available sessions
        fetchAvailableSessions()
        
        // Auto-redirect after 3 seconds
        setTimeout(() => {
          router.push('/attendance/history')
        }, 3000)
      } else {
        throw new Error(result.message || 'Face verification failed')
      }
    } catch (error) {
      console.error('Error marking attendance:', error)
      setError(error instanceof Error ? error.message : 'An error occurred')
      toast.error(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleMarkAttendanceManually = async () => {
    if (!selectedSession) {
      setError('Please select a session first')
      return
    }

    setLoading(true)
    setError('')
    setMessage('')

    try {
      const result = await sessionApi.markClassAttendance({
        session_id: selectedSession.id,
        status: 'present'
      })
      
      setMessage('Manual attendance marked successfully!')
      setAttendanceMarked(true)
      toast.success('Attendance marked successfully!')
      
      // Refresh available sessions
      fetchAvailableSessions()
      
      // Auto-redirect after 3 seconds
      setTimeout(() => {
        router.push('/attendance/history')
      }, 3000)
    } catch (error) {
      console.error('Error marking manual attendance:', error)
      setError(error instanceof Error ? error.message : 'An error occurred')
      toast.error(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const formatTimeRemaining = (milliseconds: number) => {
    const minutes = Math.floor(milliseconds / 60000)
    const seconds = Math.floor((milliseconds % 60000) / 1000)
    return `${minutes}m ${seconds}s`
  }

  if (!isAuthenticated || user?.role !== 'student') {
    return <div>Redirecting...</div>
  }

  if (loadingSessions) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading available sessions...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={() => router.push('/attendance/history')}
                className="text-gray-600 hover:text-gray-900 font-medium"
              >
                ← Back to Attendance History
              </button>
            </div>
            <div className="flex items-center">
              <span className="text-gray-700">
                {user?.full_name}
              </span>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Mark Attendance</h1>
          <p className="text-gray-600">Select a session and mark your attendance</p>
        </div>

        {availableSessions.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-500 mb-4">No sessions available for attendance marking</div>
            <p className="text-sm text-gray-400 mb-6">
              Sessions are only available during the attendance window (5 minutes before to 5 minutes after class starts)
            </p>
            <button
              onClick={() => router.push('/attendance/history')}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
            >
              View Attendance History
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Available Sessions */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4">Available Sessions</h2>
              <div className="space-y-3">
                {availableSessions.map((availableSession) => (
                  <div
                    key={availableSession.session.id}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedSession?.id === availableSession.session.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                    }`}
                    onClick={() => setSelectedSession(availableSession.session)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-900">
                          {availableSession.course_code} - {availableSession.course_title}
                        </div>
                        <div className="text-sm text-gray-600">
                          {availableSession.lecturer} • {availableSession.session.location}
                        </div>
                        <div className="text-sm text-gray-600">
                          {format(parseISO(availableSession.session.scheduled_date), 'EEEE, MMM d, yyyy')} at {availableSession.session.start_time} - {availableSession.session.end_time}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-red-600">
                          {formatTimeRemaining(availableSession.time_remaining)} left
                        </div>
                        <div className="text-xs text-gray-500">
                          Attendance window
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Attendance Marking */}
            {selectedSession && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold mb-4">Mark Attendance</h2>
                <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                  <div className="font-medium text-blue-900">
                    Selected: {selectedSession.course_assignment.course.code} - {selectedSession.title}
                  </div>
                  <div className="text-sm text-blue-700">
                    {format(parseISO(selectedSession.scheduled_date), 'EEEE, MMM d, yyyy')} at {selectedSession.start_time}
                  </div>
                </div>

                {/* Mode Selection */}
                <div className="mb-6">
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="attendanceMode"
                        checked={!useManualMode}
                        onChange={() => setUseManualMode(false)}
                        className="mr-2"
                      />
                      Face Recognition
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="attendanceMode"
                        checked={useManualMode}
                        onChange={() => setUseManualMode(true)}
                        className="mr-2"
                      />
                      Manual Entry
                    </label>
                  </div>
                </div>

                {!useManualMode ? (
                  /* Face Recognition Mode */
                  <div className="space-y-4">
                    <div className="flex justify-center">
                      <div className="relative">
                        <Webcam
                          ref={webcamRef}
                          audio={false}
                          height={300}
                          screenshotFormat="image/jpeg"
                          width={400}
                          videoConstraints={{
                            width: 400,
                            height: 300,
                            facingMode: "user"
                          }}
                          onUserMedia={() => setIsWebcamReady(true)}
                          onUserMediaError={() => setError('Camera access denied')}
                          className="rounded-lg"
                        />
                        {!isWebcamReady && (
                          <div className="absolute inset-0 flex items-center justify-center bg-gray-200 rounded-lg">
                            <div className="text-center">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                              <p className="text-sm text-gray-600">Initializing camera...</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-center">
                      <button
                        onClick={handleMarkAttendanceWithFace}
                        disabled={loading || !isWebcamReady || attendanceMarked}
                        className={`px-6 py-3 rounded-md text-white font-medium ${
                          loading || !isWebcamReady || attendanceMarked
                            ? 'bg-gray-400 cursor-not-allowed'
                            : 'bg-blue-500 hover:bg-blue-600'
                        }`}
                      >
                        {loading ? 'Marking Attendance...' : 'Mark Attendance with Face'}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Manual Mode */
                  <div className="text-center">
                    <button
                      onClick={handleMarkAttendanceManually}
                      disabled={loading || attendanceMarked}
                      className={`px-6 py-3 rounded-md text-white font-medium ${
                        loading || attendanceMarked
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'bg-green-500 hover:bg-green-600'
                      }`}
                    >
                      {loading ? 'Marking Attendance...' : 'Mark Attendance Manually'}
                    </button>
                  </div>
                )}

                {/* Messages */}
                {error && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                    <div className="text-red-700 text-sm">{error}</div>
                  </div>
                )}

                {message && (
                  <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
                    <div className="text-green-700 text-sm">{message}</div>
                  </div>
                )}

                {attendanceMarked && (
                  <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md text-center">
                    <div className="text-green-700 font-medium">✓ Attendance marked successfully!</div>
                    <div className="text-sm text-green-600 mt-1">
                      Redirecting to attendance history...
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
} 