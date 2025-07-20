'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../contexts/AuthContext'
import { faceApi } from '../../utils/api'
import Webcam from 'react-webcam'

export default function FaceRegistrationPage() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isWebcamReady, setIsWebcamReady] = useState(false)
  const [registrationComplete, setRegistrationComplete] = useState(false)
  const [qualityMetrics, setQualityMetrics] = useState<any>(null)
  
  const webcamRef = useRef<Webcam>(null)
  const { user, isAuthenticated, isStudent } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login')
    } else if (!isStudent) {
      // Non-students (lecturers/admins) should go to their appropriate pages
      const userData = JSON.parse(localStorage.getItem('user') || '{}')
      if (userData.role === 'lecturer') {
        router.push('/my-courses')
      } else {
        router.push('/dashboard')
      }
    }
  }, [isAuthenticated, isStudent, router])

  const capturePhoto = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot()
    return imageSrc
  }, [webcamRef])

  const handleRegisterFace = async () => {
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
      formData.append('image', blob, 'face_registration.jpg')

      // Send to backend
      const result = await faceApi.registerFace(formData)
      
      setMessage(result.message || 'Face registered successfully!')
      setRegistrationComplete(true)
      setQualityMetrics(result)
      
      // Auto-redirect after 5 seconds
      setTimeout(() => {
        const userData = JSON.parse(localStorage.getItem('user') || '{}')
        if (userData.role === 'student') {
          router.push('/student-courses')
        } else if (userData.role === 'lecturer') {
          router.push('/my-courses')
        } else {
          router.push('/dashboard')
        }
      }, 5000)
    } catch (error) {
      console.error('Error registering face:', error)
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
                onClick={() => {
                  const userData = JSON.parse(localStorage.getItem('user') || '{}')
                  if (userData.role === 'student') {
                    router.push('/student-courses')
                  } else if (userData.role === 'lecturer') {
                    router.push('/my-courses')
                  } else {
                    router.push('/dashboard')
                  }
                }}
                className="text-gray-600 hover:text-gray-900 font-medium"
              >
                ← Back to Home
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
            <h1 className="text-3xl font-bold text-gray-900">Face Registration</h1>
            <p className="mt-2 text-lg text-gray-600">
              Register your face for attendance recognition
            </p>
          </div>

          {message && (
            <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
              {message}
              {registrationComplete && (
                <p className="mt-2 text-sm">Redirecting to dashboard in 5 seconds...</p>
              )}
            </div>
          )}

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {!registrationComplete && (
            <div className="bg-white rounded-lg shadow-md p-6 max-w-2xl mx-auto">
              <h2 className="text-xl font-semibold mb-4 text-center">Capture Your Face</h2>
              
              <div className="mb-6 flex justify-center">
                <div className="relative">
                  <Webcam
                    ref={webcamRef}
                    audio={false}
                    height={400}
                    width={500}
                    onUserMedia={() => setIsWebcamReady(true)}
                    onUserMediaError={() => setError('Failed to access camera')}
                    screenshotFormat="image/jpeg"
                    className="rounded-lg border-4 border-blue-200"
                  />
                  {!isWebcamReady && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-200 rounded-lg">
                      <p className="text-gray-600">Loading camera...</p>
                    </div>
                  )}
                  
                  {/* Face detection overlay */}
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="relative w-full h-full">
                      {/* Face guide overlay */}
                      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-80 border-2 border-blue-500 border-dashed rounded-full opacity-50"></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-center">
                <button
                  onClick={handleRegisterFace}
                  disabled={loading || !isWebcamReady}
                  className={`w-full py-3 px-6 rounded-md font-medium text-lg ${
                    loading || !isWebcamReady
                      ? 'bg-gray-400 cursor-not-allowed text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {loading ? 'Processing...' : 'Register My Face'}
                </button>
                
                <p className="mt-3 text-sm text-gray-600">
                  Position your face within the oval guide and click to register
                </p>
              </div>
            </div>
          )}

          {/* Registration Results */}
          {registrationComplete && qualityMetrics && (
            <div className="bg-white rounded-lg shadow-md p-6 max-w-2xl mx-auto mt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Registration Results</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-green-50 rounded-lg">
                  <h4 className="font-medium text-green-900 mb-2">✅ Success</h4>
                  <p className="text-sm text-green-700">
                    Face registered successfully with {(qualityMetrics.confidence_score * 100).toFixed(1)}% confidence
                  </p>
                </div>
                
                {qualityMetrics.quality_score && (
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-2">📊 Quality Score</h4>
                    <p className="text-sm text-blue-700">
                      {(qualityMetrics.quality_score * 100).toFixed(1)}% quality rating
                    </p>
                  </div>
                )}
              </div>

              {qualityMetrics.recommendations && qualityMetrics.recommendations.length > 0 && (
                <div className="mt-4 p-4 bg-yellow-50 rounded-lg">
                  <h4 className="font-medium text-yellow-900 mb-2">💡 Recommendations</h4>
                  <ul className="text-sm text-yellow-700 space-y-1">
                    {qualityMetrics.recommendations.map((rec: string, index: number) => (
                      <li key={index}>• {rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Instructions */}
          <div className="mt-8 bg-blue-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-3">Face Registration Tips:</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium text-blue-800 mb-2">📷 Camera Setup</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Ensure good lighting (avoid shadows)</li>
                  <li>• Position face in the center of the frame</li>
                  <li>• Keep camera at eye level</li>
                  <li>• Stay still during capture</li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-medium text-blue-800 mb-2">✨ Best Practices</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Look directly at the camera</li>
                  <li>• Keep a neutral expression</li>
                  <li>• Remove glasses if possible</li>
                  <li>• Ensure face is clearly visible</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
} 