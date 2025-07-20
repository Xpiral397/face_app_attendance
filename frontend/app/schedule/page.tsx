'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { apiClient } from '../../utils/api'
import AppLayout from '../../components/AppLayout'

interface Session {
  id: number
  title: string
  description: string
  class_type: string
  scheduled_date: string
  start_time: string
  end_time: string
  effective_location: string
  course_assignment: {
    course: {
      code: string
      title: string
    }
    lecturer: {
      full_name: string
    }
  }
  is_recurring: boolean
  recurrence_pattern: string
  is_active: boolean
  is_cancelled: boolean
}

export default function SchedulePage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [viewMode, setViewMode] = useState<'week' | 'list'>('week')

  const { user, isLecturer, isStudent } = useAuth()

  useEffect(() => {
    fetchSessions()
  }, [selectedDate])

  const fetchSessions = async () => {
    try {
      setLoading(true)
      
      // Calculate week range for API call
      const startDate = new Date(selectedDate)
      const dayOfWeek = startDate.getDay()
      const startOfWeek = new Date(startDate)
      startOfWeek.setDate(startDate.getDate() - dayOfWeek)
      
      const endOfWeek = new Date(startOfWeek)
      endOfWeek.setDate(startOfWeek.getDate() + 6)

      const params = new URLSearchParams()
      if (isLecturer) {
        params.append('lecturer', 'me')
      }
      // For students, the backend automatically filters by enrolled courses

      const response = await apiClient.get(`/courses/sessions/?${params}`)
      const allSessions = response.results || response || []
      
      // Filter sessions for the selected week
      const weekSessions = allSessions.filter((session: Session) => {
        const sessionDate = new Date(session.scheduled_date)
        return sessionDate >= startOfWeek && sessionDate <= endOfWeek
      })
      
      setSessions(weekSessions)
    } catch (error) {
      console.error('Error fetching sessions:', error)
      setError('Failed to fetch schedule')
    } finally {
      setLoading(false)
    }
  }

  const getWeekDays = () => {
    const startDate = new Date(selectedDate)
    const dayOfWeek = startDate.getDay()
    const startOfWeek = new Date(startDate)
    startOfWeek.setDate(startDate.getDate() - dayOfWeek)

    const days = []
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek)
      day.setDate(startOfWeek.getDate() + i)
      days.push(day)
    }
    return days
  }

  const getSessionsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0]
    return sessions.filter(session => session.scheduled_date === dateStr)
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
  }

  const navigateWeek = (direction: 'prev' | 'next') => {
    const currentDate = new Date(selectedDate)
    const newDate = new Date(currentDate)
    newDate.setDate(currentDate.getDate() + (direction === 'next' ? 7 : -7))
    setSelectedDate(newDate.toISOString().split('T')[0])
  }

  const weekDays = getWeekDays()
  const today = new Date().toISOString().split('T')[0]

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            {isLecturer ? 'My Teaching Schedule' : 'My Class Schedule'}
          </h1>
          <p className="text-gray-600 mt-2">
            {isLecturer ? 'View your teaching schedule' : 'View your class schedule and session details'}
          </p>
        </div>

        {/* Controls */}
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center space-x-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Week Starting</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <button
              onClick={fetchSessions}
              className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Refresh
            </button>
          </div>

          <div className="flex space-x-2">
            <button
              onClick={() => setViewMode('week')}
              className={`px-4 py-2 text-sm font-medium rounded-md ${
                viewMode === 'week'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Week View
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 text-sm font-medium rounded-md ${
                viewMode === 'list'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              List View
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-500 mt-2">Loading schedule...</p>
          </div>
        ) : viewMode === 'week' ? (
          /* Week View */
          <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
            {/* Week Navigation */}
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <button
                onClick={() => navigateWeek('prev')}
                className="p-2 hover:bg-gray-100 rounded-md"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              
              <h2 className="text-lg font-semibold text-gray-900">
                {weekDays[0].toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - {weekDays[6].toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </h2>
              
              <button
                onClick={() => navigateWeek('next')}
                className="p-2 hover:bg-gray-100 rounded-md"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 divide-x divide-gray-200">
              {weekDays.map((day, index) => {
                const dayStr = day.toISOString().split('T')[0]
                const isToday = dayStr === today
                const daySessions = getSessionsForDate(day)
                
                return (
                  <div key={index} className="min-h-[200px]">
                    {/* Day Header */}
                    <div className={`p-3 text-center border-b border-gray-200 ${isToday ? 'bg-blue-50' : 'bg-gray-50'}`}>
                      <div className="text-sm font-medium text-gray-900">
                        {day.toLocaleDateString('en-US', { weekday: 'short' })}
                      </div>
                      <div className={`text-lg font-semibold ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>
                        {day.getDate()}
                      </div>
                    </div>

                    {/* Day Sessions */}
                    <div className="p-2 space-y-1">
                      {daySessions.map((session) => (
                        <div
                          key={session.id}
                          className={`p-2 rounded text-xs ${
                            session.is_cancelled
                              ? 'bg-red-100 text-red-800 border border-red-200'
                              : session.class_type === 'lecture'
                              ? 'bg-blue-100 text-blue-800 border border-blue-200'
                              : session.class_type === 'practical'
                              ? 'bg-green-100 text-green-800 border border-green-200'
                              : session.class_type === 'tutorial'
                              ? 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                              : 'bg-gray-100 text-gray-800 border border-gray-200'
                          }`}
                        >
                          <div className="font-medium truncate">{session.course_assignment.course.code}</div>
                          <div className="truncate">{session.title}</div>
                          <div className="text-xs opacity-75">
                            {session.start_time} - {session.end_time}
                          </div>
                          <div className="text-xs opacity-75 truncate">
                            📍 {session.effective_location}
                          </div>
                          {session.is_recurring && (
                            <div className="text-xs opacity-75">🔄 Recurring</div>
                          )}
                        </div>
                      ))}
                      
                      {daySessions.length === 0 && (
                        <div className="text-xs text-gray-400 text-center py-4">
                          No classes
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          /* List View */
          <div className="space-y-4">
            {sessions.length === 0 ? (
              <div className="text-center py-8">
                <h3 className="text-lg font-medium text-gray-900">No scheduled sessions found</h3>
                <p className="text-gray-500 mt-2">There are no sessions scheduled for this week.</p>
              </div>
            ) : (
              sessions
                .sort((a, b) => {
                  const dateCompare = a.scheduled_date.localeCompare(b.scheduled_date)
                  if (dateCompare === 0) {
                    return a.start_time.localeCompare(b.start_time)
                  }
                  return dateCompare
                })
                .map((session) => (
                  <div key={session.id} className="bg-white border rounded-lg p-6 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {session.course_assignment.course.code}: {session.title}
                          </h3>
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            session.is_cancelled
                              ? 'bg-red-100 text-red-800'
                              : session.class_type === 'lecture'
                              ? 'bg-blue-100 text-blue-800'
                              : session.class_type === 'practical'
                              ? 'bg-green-100 text-green-800'
                              : session.class_type === 'tutorial'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {session.class_type}
                          </span>
                          {session.is_recurring && (
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                              🔄 {session.recurrence_pattern}
                            </span>
                          )}
                        </div>

                        <p className="text-gray-600 mb-3">{session.description}</p>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-500">
                          <div className="flex items-center">
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            {new Date(session.scheduled_date).toLocaleDateString('en-US', { 
                              weekday: 'long', 
                              year: 'numeric', 
                              month: 'long', 
                              day: 'numeric' 
                            })}
                          </div>
                          
                          <div className="flex items-center">
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {session.start_time} - {session.end_time}
                          </div>
                          
                          <div className="flex items-center">
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            {session.effective_location}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          session.is_active && !session.is_cancelled
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {session.is_cancelled ? 'Cancelled' : session.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
            )}
          </div>
        )}
      </div>
    </AppLayout>
  )
} 