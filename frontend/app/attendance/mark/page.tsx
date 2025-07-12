'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../../contexts/AuthContext'
import { attendanceApi } from '../../../utils/api'
import Webcam from 'react-webcam'

export default function MarkAttendancePage() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isWebcamReady, setIsWebcamReady] = useState(false)
  const [attendanceMarked, setAttendanceMarked] = useState(false)
  
  const webcamRef = useRef<Webcam>(null)
  const { user, isAuthenticated } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login')
    }
  }, [isAuthenticated, router])

  const capturePhoto = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot()
    return imageSrc
  }, [webcamRef])

  const handleMarkAttendance = async () => {
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

      // Send to backend using API utility
      const result = await attendanceApi.markAttendanceWithFace(formData)
      setMessage(result.message || 'Attendance marked successfully!')
      setAttendanceMarked(true)
      
      // Auto-redirect after 3 seconds
      setTimeout(() => {
        router.push('/dashboard')
      }, 3000)
    } catch (error) {
      console.error('Error marking attendance:', error)
      setError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleManualAttendance = async () => {
    setLoading(true)
    setError('')
    setMessage('')

    try {
      const result = await attendanceApi.markAttendance({
        status: 'present',
        timestamp: new Date().toISOString(),
      })
      
      setMessage('Manual attendance marked successfully!')
      setAttendanceMarked(true)
      
      // Auto-redirect after 3 seconds
      setTimeout(() => {
        router.push('/dashboard')
      }, 3000)
    } catch (error) {
      console.error('Error marking manual attendance:', error)
      setError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (!isAuthenticated) {
    return <div>Redirecting...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={() => router.push('/dashboard')}
                className="text-gray-600 hover:text-gray-900 font-medium"
              >
                ← Back to Dashboard
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

      <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Mark Attendance</h1>
            <p className="mt-2 text-lg text-gray-600">
              Use face recognition or manual check-in
            </p>
          </div>

          {message && (
            <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
              {message}
              {attendanceMarked && (
                <p className="mt-2 text-sm">Redirecting to dashboard in 3 seconds...</p>
              )}
            </div>
          )}

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {!attendanceMarked && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Face Recognition Section */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold mb-4 text-center">Face Recognition</h2>
                
                <div className="mb-4 flex justify-center">
                  <div className="relative">
                    <Webcam
                      ref={webcamRef}
                      audio={false}
                      height={300}
                      width={400}
                      onUserMedia={() => setIsWebcamReady(true)}
                      onUserMediaError={() => setError('Failed to access camera')}
                      screenshotFormat="image/jpeg"
                      className="rounded-lg"
                    />
                    {!isWebcamReady && (
                      <div className="absolute inset-0 flex items-center justify-center bg-gray-200 rounded-lg">
                        <p className="text-gray-600">Loading camera...</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-center">
                  <button
                    onClick={handleMarkAttendance}
                    disabled={loading || !isWebcamReady}
                    className={`w-full py-3 px-4 rounded-md font-medium ${
                      loading || !isWebcamReady
                        ? 'bg-gray-400 cursor-not-allowed text-white'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    {loading ? 'Processing...' : 'Mark Attendance with Face Recognition'}
                  </button>
                  
                  <p className="mt-2 text-sm text-gray-600">
                    Position your face in the camera frame and click to mark attendance
                  </p>
                </div>
              </div>

              {/* Manual Check-in Section */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold mb-4 text-center">Manual Check-in</h2>
                
                <div className="mb-6 text-center">
                  <div className="mx-auto h-32 w-32 bg-gray-100 rounded-full flex items-center justify-center">
                    <svg className="h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <p className="mt-4 text-lg font-medium text-gray-900">{user?.full_name}</p>
                  <p className="text-sm text-gray-600">{user?.student_id}</p>
                </div>

                <div className="text-center">
                  <button
                    onClick={handleManualAttendance}
                    disabled={loading}
                    className={`w-full py-3 px-4 rounded-md font-medium ${
                      loading
                        ? 'bg-gray-400 cursor-not-allowed text-white'
                        : 'bg-green-600 hover:bg-green-700 text-white'
                    }`}
                  >
                    {loading ? 'Processing...' : 'Mark Manual Attendance'}
                  </button>
                  
                  <p className="mt-2 text-sm text-gray-600">
                    Click to mark attendance manually without face recognition
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="mt-8 bg-blue-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">Instructions:</h3>
            <ul className="text-blue-800 space-y-1">
              <li>• Face Recognition: Ensure good lighting and position your face clearly in the camera frame</li>
              <li>• Manual Check-in: Use this option if face recognition is not working</li>
              <li>• You can only mark attendance once per day</li>
              <li>• Late arrivals after 9:00 AM will be marked as "Late"</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  )
} 