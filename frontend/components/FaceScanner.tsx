'use client'

import React, { useRef, useEffect, useState } from 'react'
import { FaceRecognitionService, FaceRecognitionResult } from '../utils/faceRecognition'

interface FaceScannerProps {
  onVerificationComplete: (result: FaceRecognitionResult) => void
  onClose: () => void
  sessionTitle: string
}

export default function FaceScanner({ onVerificationComplete, onClose, sessionTitle }: FaceScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [faceService] = useState(new FaceRecognitionService())
  const [isScanning, setIsScanning] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [status, setStatus] = useState<'initializing' | 'ready' | 'scanning' | 'verifying' | 'complete'>('initializing')
  const [error, setError] = useState('')

  useEffect(() => {
    initializeCamera()
    return () => {
      faceService.stopCamera()
    }
  }, [])

  const initializeCamera = async () => {
    try {
      setStatus('initializing')
      setError('')
      
      const cameraStarted = await faceService.startCamera()
      if (!cameraStarted) {
        setError('Unable to access camera. Please check permissions.')
        return
      }

      if (videoRef.current && canvasRef.current) {
        faceService.setVideoElement(videoRef.current)
        faceService.setCanvasElement(canvasRef.current)
        
        videoRef.current.onloadedmetadata = () => {
          setStatus('ready')
        }
      }
    } catch (error) {
      setError('Error initializing camera')
      console.error('Camera error:', error)
    }
  }

  const startScan = () => {
    setStatus('scanning')
    setCountdown(3)
    
    const countdownTimer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownTimer)
          captureAndVerify()
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const captureAndVerify = async () => {
    try {
      setStatus('verifying')
      setIsScanning(true)

      const imageData = faceService.captureImage()
      if (!imageData) {
        setError('Failed to capture image')
        setStatus('ready')
        setIsScanning(false)
        return
      }

      const result = await faceService.verifyFace(imageData)
      
      setStatus('complete')
      setIsScanning(false)
      
      // Give user time to see the result before closing
      setTimeout(() => {
        onVerificationComplete(result)
      }, 1500)

    } catch (error) {
      setError('Error during face verification')
      setStatus('ready')
      setIsScanning(false)
    }
  }

  const getStatusMessage = () => {
    switch (status) {
      case 'initializing':
        return 'Initializing camera...'
      case 'ready':
        return 'Position your face in the frame and click "Scan Face"'
      case 'scanning':
        return `Scanning in ${countdown}...`
      case 'verifying':
        return 'Verifying your identity...'
      case 'complete':
        return 'Verification complete!'
      default:
        return ''
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-semibold text-gray-900">
            Face Recognition - {sessionTitle}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Camera View */}
        <div className="relative mb-6">
          <div className="relative bg-gray-900 rounded-lg overflow-hidden" style={{ aspectRatio: '4/3' }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            
            {/* Face Detection Overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="border-2 border-blue-500 rounded-full w-64 h-64 flex items-center justify-center">
                <div className="text-white text-center">
                  <div className="text-sm opacity-75">Position your face here</div>
                  {countdown > 0 && (
                    <div className="text-4xl font-bold mt-2">{countdown}</div>
                  )}
                </div>
              </div>
            </div>

            {/* Scanning Animation */}
            {isScanning && (
              <div className="absolute inset-0 bg-blue-500 bg-opacity-20 animate-pulse"></div>
            )}
          </div>
          
          {/* Hidden canvas for image capture */}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Status Message */}
        <div className="text-center mb-6">
          <p className="text-lg text-gray-700">{getStatusMessage()}</p>
          {error && (
            <p className="text-red-600 mt-2">{error}</p>
          )}
        </div>

        {/* Controls */}
        <div className="flex justify-center space-x-4">
          {status === 'ready' && (
            <button
              onClick={startScan}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              📷 Scan Face
            </button>
          )}
          
          {status === 'verifying' && (
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="text-blue-600">Verifying...</span>
            </div>
          )}

          {status === 'complete' && (
            <div className="flex items-center space-x-2 text-green-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              <span>Processing result...</span>
            </div>
          )}

          <button
            onClick={onClose}
            className="px-6 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            Cancel
          </button>
        </div>

        {/* Instructions */}
        <div className="mt-6 bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-2">Instructions:</h4>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Ensure good lighting on your face</li>
            <li>• Look directly at the camera</li>
            <li>• Keep your face within the blue circle</li>
            <li>• Remove glasses or masks if possible</li>
            <li>• Stay still during the scan</li>
          </ul>
        </div>
      </div>
    </div>
  )
} 