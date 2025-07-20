// SessionModal.tsx - Updated with better validation and virtual room handling
'use client'

import React, { useState, useEffect } from 'react'
import { apiClient } from '../../utils/api'

interface Course {
  id: number
  code: string
  title: string
  assignment_id: number
}

interface SessionModalProps {
  selectedCourse: Course
  onClose: () => void
  onSessionCreated: () => void
  editingSession?: any
}

interface Room {
  id: number
  name: string
  code: string
  room_type: 'physical' | 'virtual'
  capacity: number
  building?: string
  virtual_platform?: string
  is_available: boolean
}

interface ConflictCheck {
  has_conflicts: boolean
  conflicts: Array<{
    type: 'room' | 'lecturer' | 'student'
    message: string
  }>
}

export default function SessionModal({ selectedCourse, onClose, onSessionCreated, editingSession }: SessionModalProps) {
  const [formData, setFormData] = useState({
    title: editingSession?.title || '',
    description: editingSession?.description || '',
    class_type: editingSession?.class_type || 'lecture',
    scheduled_date: editingSession?.scheduled_date || '',
    start_time: editingSession?.start_time || '',
    duration: editingSession ? calculateDuration(editingSession.start_time, editingSession.end_time) : 120, // minutes
    room_id: editingSession?.room?.id?.toString() || '',
    meeting_link: editingSession?.meeting_link || '',
    meeting_id: editingSession?.meeting_id || '',
    meeting_passcode: editingSession?.meeting_passcode || '',
    is_recurring: editingSession?.is_recurring || false,
    recurrence_end_date: editingSession?.recurrence_end_date || '',
    extra_minutes: 5
  })

  // Helper function to calculate duration in minutes
  function calculateDuration(startTime: string, endTime: string): number {
    if (!startTime || !endTime) return 120
    const [startHour, startMin] = startTime.split(':').map(Number)
    const [endHour, endMin] = endTime.split(':').map(Number)
    const startMinutes = startHour * 60 + startMin
    const endMinutes = endHour * 60 + endMin
    return endMinutes - startMinutes
  }

  const [rooms, setRooms] = useState<Room[]>([])
  const [conflicts, setConflicts] = useState<ConflictCheck | null>(null)
  const [loading, setLoading] = useState(false)
  const [checkingConflicts, setCheckingConflicts] = useState(false)
  const [showVirtualMeeting, setShowVirtualMeeting] = useState(false)
  const [showCustomVirtual, setShowCustomVirtual] = useState(false)
  const [roomType, setRoomType] = useState<'physical' | 'virtual'>('physical')
  const [error, setError] = useState('')
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)

  // Calculate end time based on start time and duration
  const endTime = React.useMemo(() => {
    if (!formData.start_time || !formData.duration) return ''
    
    const [hours, minutes] = formData.start_time.split(':').map(Number)
    const startMinutes = hours * 60 + minutes
    const endMinutes = startMinutes + formData.duration
    
    const endHours = Math.floor(endMinutes / 60) % 24
    const endMins = endMinutes % 60
    
    return `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`
  }, [formData.start_time, formData.duration])

  // Calculate attendance window end time
  const attendanceEndTime = React.useMemo(() => {
    if (!endTime || !formData.extra_minutes) return ''
    
    const [hours, minutes] = endTime.split(':').map(Number)
    const endMinutes = hours * 60 + minutes + formData.extra_minutes
    
    const attendanceHours = Math.floor(endMinutes / 60) % 24
    const attendanceMins = endMinutes % 60
    
    return `${attendanceHours.toString().padStart(2, '0')}:${attendanceMins.toString().padStart(2, '0')}`
  }, [endTime, formData.extra_minutes])

  // Calculate minimum recurrence end date (7 days from scheduled date)
  const minRecurrenceDate = React.useMemo(() => {
    if (!formData.scheduled_date) return ''
    const scheduleDate = new Date(formData.scheduled_date)
    scheduleDate.setDate(scheduleDate.getDate() + 7)
    return scheduleDate.toISOString().split('T')[0]
  }, [formData.scheduled_date])

  // Calculate recurring sessions count
  const recurringCount = React.useMemo(() => {
    if (!formData.is_recurring || !formData.scheduled_date || !formData.recurrence_end_date) return 0
    
    const startDate = new Date(formData.scheduled_date)
    const endDate = new Date(formData.recurrence_end_date)
    const diffTime = endDate.getTime() - startDate.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    return Math.floor(diffDays / 7) + 1 // +1 to include the initial session
  }, [formData.is_recurring, formData.scheduled_date, formData.recurrence_end_date])

  // Get day of week from scheduled date
  const dayOfWeek = React.useMemo(() => {
    if (!formData.scheduled_date) return ''
    return new Date(formData.scheduled_date).toLocaleDateString('en-US', { weekday: 'long' })
  }, [formData.scheduled_date])

  // Validate form completion
  const validateForm = React.useMemo(() => {
    const errors: string[] = []
    
    if (!formData.title.trim()) errors.push('Session title is required')
    if (!formData.scheduled_date) errors.push('Date is required')
    if (!formData.start_time) errors.push('Start time is required')
    if (!endTime) errors.push('End time calculation failed')
    if (!formData.room_id && !showCustomVirtual) errors.push('Room selection is required')
    
    // Validate attendance window fields are set
    if (!formData.start_time) errors.push('Attendance window start is required')
    if (!attendanceEndTime) errors.push('Attendance window end calculation failed')
    
    if (formData.is_recurring) {
      if (!formData.recurrence_end_date) errors.push('End date for recurring sessions is required')
      else if (formData.recurrence_end_date < minRecurrenceDate) {
        errors.push('Recurring end date must be at least 7 days from schedule date')
      }
    }
    
    if (showCustomVirtual) {
      if (!formData.meeting_link.trim()) errors.push('Meeting link is required for custom virtual room')
    }
    
    if (conflicts?.has_conflicts) errors.push('Please resolve scheduling conflicts')
    
    setValidationErrors(errors)
    return errors.length === 0
  }, [formData, showCustomVirtual, minRecurrenceDate, conflicts, endTime, attendanceEndTime])

  useEffect(() => {
    fetchRooms()
  }, [])

  // Check conflicts when key fields change
  useEffect(() => {
    if (formData.scheduled_date && formData.start_time && endTime && selectedCourse) {
      const timer = setTimeout(checkConflicts, 500)
      return () => clearTimeout(timer)
    }
  }, [formData.scheduled_date, formData.start_time, endTime, formData.room_id])

  const fetchRooms = async () => {
    try {
      const response = await apiClient.get('/courses/rooms/')
      setRooms(response.results || response || [])
    } catch (error) {
      console.error('Error fetching rooms:', error)
    }
  }

  const checkConflicts = async () => {
    if (!selectedCourse) return
    
    try {
      setCheckingConflicts(true)
      const response = await apiClient.post('/courses/sessions/check-conflicts/', {
        course_assignment_id: selectedCourse.assignment_id,
        scheduled_date: formData.scheduled_date,
        start_time: formData.start_time,
        end_time: endTime,
        room_id: formData.room_id || null
      })
      setConflicts(response.results || response)
    } catch (error) {
      console.error('Error checking conflicts:', error)
    } finally {
      setCheckingConflicts(false)
    }
  }

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleRoomTypeChange = (type: 'physical' | 'virtual') => {
    setRoomType(type)
    setFormData(prev => ({ ...prev, room_id: '' }))
    setShowVirtualMeeting(false)
    setShowCustomVirtual(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm) return

    try {
      setSubmitting(true)
      
      const sessionData = {
        course_assignment_id: selectedCourse.assignment_id,
        title: formData.title.trim(),
        description: formData.description.trim(),
        class_type: formData.class_type,
        scheduled_date: formData.scheduled_date,
        start_time: formData.start_time,
        end_time: endTime,
        attendance_window_start: formData.start_time,
        attendance_window_end: attendanceEndTime,
        is_recurring: formData.is_recurring,
        recurrence_pattern: formData.is_recurring ? 'weekly' : 'none',
        recurrence_end_date: formData.is_recurring ? formData.recurrence_end_date : null,
        room_id: showCustomVirtual ? null : (formData.room_id ? parseInt(formData.room_id) : null),
        meeting_link: showCustomVirtual ? formData.meeting_link : '',
        meeting_id: formData.meeting_id,
        meeting_passcode: formData.meeting_passcode
      }

      if (editingSession) {
        // Update existing session
        await apiClient.put(`/courses/sessions/${editingSession.id}/`, sessionData)
        setSuccess('Session updated successfully!')
      } else {
        // Create new session
        await apiClient.post('/courses/sessions/', sessionData)
        setSuccess('Session created successfully!')
      }
      
      setTimeout(() => {
        onSessionCreated()
        onClose()
      }, 1500)
    } catch (error: any) {
      console.error('Session submission error:', error.response?.data)
      if (error.response?.data?.conflicts) {
        setError(`Scheduling conflicts: ${error.response.data.conflicts.join(', ')}`)
      } else {
        setError(error.response?.data?.error || error.response?.data?.message || `Failed to ${editingSession ? 'update' : 'create'} session`)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const filteredRooms = rooms.filter(room => room.room_type === roomType && room.is_available)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-600 bg-opacity-50 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-3xl max-h-[90vh] overflow-hidden m-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-xl font-semibold text-gray-900">Create Session</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-100 border border-green-300 text-green-700 rounded">
              {success}
            </div>
          )}

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div className="mb-4 p-3 bg-orange-100 border border-orange-300 text-orange-700 rounded">
              <h4 className="font-medium mb-2">Please complete the following:</h4>
              <ul className="text-sm space-y-1">
                {validationErrors.map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Session Title *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Introduction to Algorithms"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Class Type</label>
                <select
                  value={formData.class_type}
                  onChange={(e) => handleInputChange('class_type', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="lecture">Lecture</option>
                  <option value="tutorial">Tutorial</option>
                  <option value="practical">Practical</option>
                  <option value="seminar">Seminar</option>
                  <option value="exam">Examination</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Session description..."
              />
            </div>

            {/* Schedule */}
            <div className="border-t pt-6">
              <h4 className="text-lg font-medium text-gray-900 mb-4">📅 Schedule</h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Date *</label>
                  <input
                    type="date"
                    value={formData.scheduled_date}
                    onChange={(e) => handleInputChange('scheduled_date', e.target.value)}
                    required
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Start Time *</label>
                  <input
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => handleInputChange('start_time', e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Duration (minutes) *</label>
                  <select
                    value={formData.duration}
                    onChange={(e) => handleInputChange('duration', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value={60}>1 hour</option>
                    <option value={90}>1.5 hours</option>
                    <option value={120}>2 hours</option>
                    <option value={150}>2.5 hours</option>
                    <option value={180}>3 hours</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">End Time</label>
                  <input
                    type="time"
                    value={endTime}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Auto-calculated</p>
                </div>
              </div>
            </div>

            {/* Recurring */}
            <div className="border-t pt-6">
              <div className="flex items-center mb-4">
                <input
                  type="checkbox"
                  id="is_recurring"
                  checked={formData.is_recurring}
                  onChange={(e) => handleInputChange('is_recurring', e.target.checked)}
                  className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="is_recurring" className="text-lg font-medium text-gray-900">
                  🔄 Repeat this session weekly
                </label>
              </div>

              {formData.is_recurring && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Repeat Until</label>
                      <input
                        type="date"
                        value={formData.recurrence_end_date}
                        onChange={(e) => handleInputChange('recurrence_end_date', e.target.value)}
                        min={minRecurrenceDate}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Must be at least 7 days from schedule date
                      </p>
                    </div>
                    <div className="flex items-center">
                      {dayOfWeek && formData.recurrence_end_date && recurringCount > 0 && (
                        <p className="text-sm text-blue-800">
                          💡 Will repeat every {dayOfWeek} until {formData.recurrence_end_date} ({recurringCount} sessions total)
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Location */}
            <div className="border-t pt-6">
              <h4 className="text-lg font-medium text-gray-900 mb-4">📍 Location</h4>
              
              {/* Room Type Toggle */}
              <div className="flex space-x-4 mb-4">
                <button
                  type="button"
                  onClick={() => handleRoomTypeChange('physical')}
                  className={`px-4 py-2 rounded-md text-sm font-medium ${
                    roomType === 'physical'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  🏢 Physical Room
                </button>
                <button
                  type="button"
                  onClick={() => handleRoomTypeChange('virtual')}
                  className={`px-4 py-2 rounded-md text-sm font-medium ${
                    roomType === 'virtual'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  💻 Virtual Room
                </button>
              </div>

              {/* Room Selection */}
              {!showCustomVirtual && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select {roomType === 'physical' ? 'Physical' : 'Virtual'} Room *
                  </label>
                  <select
                    value={formData.room_id}
                    onChange={(e) => handleInputChange('room_id', e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select a {roomType} room</option>
                    {filteredRooms.map(room => (
                      <option key={room.id} value={room.id}>
                        {room.code} - {room.name}
                        {roomType === 'physical' 
                          ? ` (Capacity: ${room.capacity}${room.building ? `, ${room.building}` : ''})`
                          : ` (${room.virtual_platform})`
                        }
                      </option>
                    ))}
                  </select>
                  
                  {filteredRooms.length === 0 && roomType === 'virtual' && (
                    <p className="text-sm text-gray-500 mt-1">
                      No virtual rooms available.
                    </p>
                  )}
                </div>
              )}

              {/* Virtual Room Options */}
              {roomType === 'virtual' && (
                <div className="mt-4 space-y-3">
                  {filteredRooms.length === 0 || showCustomVirtual ? (
                    <button
                      type="button"
                      onClick={() => setShowCustomVirtual(!showCustomVirtual)}
                      className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700"
                    >
                      {showCustomVirtual ? 'Use Existing Room' : 'Create Custom Virtual Room'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowCustomVirtual(true)}
                      className="px-4 py-2 text-sm font-medium text-purple-600 bg-purple-100 rounded-md hover:bg-purple-200"
                    >
                      Create Custom Virtual Room
                    </button>
                  )}
                </div>
              )}

              {/* Add Virtual Meeting Toggle for Physical Rooms */}
              {roomType === 'physical' && (
                <div className="mt-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="add_virtual_meeting"
                      checked={showVirtualMeeting}
                      onChange={(e) => setShowVirtualMeeting(e.target.checked)}
                      className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="add_virtual_meeting" className="text-sm text-gray-700">
                      Add virtual meeting details (for hybrid session)
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Virtual Meeting Details - Only for hybrid physical rooms or custom virtual */}
            {(showVirtualMeeting || showCustomVirtual) && (
              <div className="border-t pt-6">
                <h4 className="text-lg font-medium text-gray-900 mb-4">
                  💻 {showCustomVirtual ? 'Custom Virtual Room Details' : 'Virtual Meeting Details'}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Meeting Link {showCustomVirtual ? '*' : ''}
                    </label>
                    <input
                      type="url"
                      value={formData.meeting_link}
                      onChange={(e) => handleInputChange('meeting_link', e.target.value)}
                      required={showCustomVirtual}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="https://zoom.us/j/... or Teams link"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Meeting ID</label>
                    <input
                      type="text"
                      value={formData.meeting_id}
                      onChange={(e) => handleInputChange('meeting_id', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="123-456-789"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Passcode</label>
                    <input
                      type="text"
                      value={formData.meeting_passcode}
                      onChange={(e) => handleInputChange('meeting_passcode', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Meeting passcode"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Simplified Attendance */}
            <div className="border-t pt-6">
              <h4 className="text-lg font-medium text-gray-900 mb-4">✅ Attendance</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Extra minutes after class for attendance
                  </label>
                  <select
                    value={formData.extra_minutes}
                    onChange={(e) => handleInputChange('extra_minutes', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={40}>40 minutes</option>
                    <option value={60}>1 hour</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Attendance window: {formData.start_time} - {attendanceEndTime}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Method</label>
                  <select
                    value="face_recognition" // Default to face recognition
                    onChange={(e) => handleInputChange('attendance_method', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="face_recognition">Face Recognition</option>
                    <option value="manual">Manual</option>
                    <option value="both">Both Methods</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Conflict Check Results */}
            {checkingConflicts && (
              <div className="bg-yellow-100 border border-yellow-300 rounded-lg p-4">
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-yellow-600 mr-3"></div>
                  <p className="text-sm text-yellow-800">Checking for conflicts...</p>
                </div>
              </div>
            )}

            {conflicts && (
              <div className={`border rounded-lg p-4 ${conflicts.has_conflicts ? 'bg-red-100 border-red-300' : 'bg-green-100 border-green-300'}`}>
                <h4 className={`text-sm font-medium mb-3 ${conflicts.has_conflicts ? 'text-red-800' : 'text-green-800'}`}>
                  {conflicts.has_conflicts ? '⚠️ Conflicts Detected' : '✅ No Conflicts'}
                </h4>
                {conflicts.has_conflicts && (
                  <ul className="text-sm text-red-700 space-y-1">
                    {conflicts.conflicts.map((conflict, index) => (
                      <li key={index}>• {conflict.message}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!validateForm || submitting}
            className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Saving...' : 'Save Session'}
          </button>
        </div>
      </div>
    </div>
  )
} 