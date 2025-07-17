'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { apiClient } from '../../utils/api'
import AppLayout from '../../components/AppLayout'

interface ScheduleSession {
  id: number
  title: string
  course: {
    id: number
    code: string
    title: string
  }
  scheduled_date: string
  start_time: string
  end_time: string
  location: string
  class_type: 'lecture' | 'tutorial' | 'practical'
  lecturer?: {
    id: number
    full_name: string
  }
}

export default function SchedulePage() {
  const [sessions, setSessions] = useState<ScheduleSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedWeek, setSelectedWeek] = useState<string>('')
  const [viewType, setViewType] = useState<'week' | 'month'>('week')

  const { user, isAdmin, isLecturer, isStudent } = useAuth()

  useEffect(() => {
    if (user) {
      fetchSchedule()
    }
  }, [user, selectedWeek])

  const fetchSchedule = async () => {
    try {
      setLoading(true)
      let endpoint = ''
      
      if (isAdmin) {
        endpoint = '/courses/sessions/'
      } else if (isLecturer) {
        endpoint = '/courses/sessions/?lecturer=me'
      } else if (isStudent) {
        endpoint = '/courses/sessions/?student=me'
      }

      const params = new URLSearchParams()
      if (selectedWeek) {
        params.append('week', selectedWeek)
      }
      
      const url = endpoint + (params.toString() ? '&' + params.toString() : '')
      const response = await apiClient.get(url)
      setSessions(response.data || [])
      setError('')
    } catch (error) {
      console.error('Error fetching schedule:', error)
      setError('Failed to fetch schedule')
    } finally {
      setLoading(false)
    }
  }

  const getCurrentWeek = () => {
    const now = new Date()
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()))
    return startOfWeek.toISOString().split('T')[0]
  }

  const getWeekDates = (startDate: string) => {
    const start = new Date(startDate)
    const dates = []
    for (let i = 0; i < 7; i++) {
      const date = new Date(start)
      date.setDate(start.getDate() + i)
      dates.push(date)
    }
    return dates
  }

  const getSessionsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0]
    return sessions.filter(session => session.scheduled_date === dateStr)
  }

  const getStatusColor = (session: ScheduleSession) => {
    const now = new Date()
    const sessionDate = new Date(session.scheduled_date + 'T' + session.start_time)
    const endDate = new Date(session.scheduled_date + 'T' + session.end_time)
    
    if (now > endDate) {
      return 'bg-gray-100 text-gray-800 border-gray-300'
    } else if (now >= sessionDate && now <= endDate) {
      return 'bg-green-100 text-green-800 border-green-300'
    } else {
      return 'bg-blue-100 text-blue-800 border-blue-300'
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'lecture': return 'bg-blue-50 border-l-4 border-blue-400'
      case 'tutorial': return 'bg-purple-50 border-l-4 border-purple-400'
      case 'practical': return 'bg-green-50 border-l-4 border-green-400'
      default: return 'bg-gray-50 border-l-4 border-gray-400'
    }
  }

  const renderWeekView = () => {
    const weekStart = selectedWeek || getCurrentWeek()
    const weekDates = getWeekDates(weekStart)
    
    return (
      <div className="grid grid-cols-7 gap-4">
        {weekDates.map((date, index) => (
          <div key={index} className="min-h-96">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h3 className="font-medium text-gray-900 mb-2">
                {date.toLocaleDateString('en-US', { weekday: 'short' })}
              </h3>
              <p className="text-sm text-gray-600 mb-3">
                {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </p>
              
              <div className="space-y-2">
                {getSessionsForDate(date).map((session) => (
                  <div
                    key={session.id}
                    className={`p-2 rounded-lg border ${getTypeColor(session.class_type)} ${getStatusColor(session)}`}
                  >
                    <div className="text-xs font-medium text-gray-900">
                      {session.start_time} - {session.end_time}
                    </div>
                    <div className="text-sm font-medium text-gray-900 mt-1">
                      {session.course.code}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      {session.title}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {session.location}
                    </div>
                    {session.lecturer && (
                      <div className="text-xs text-gray-500 mt-1">
                        {session.lecturer.full_name}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  const renderListView = () => {
    const today = new Date()
    const upcomingSessions = sessions.filter(session => {
      const sessionDate = new Date(session.scheduled_date + 'T' + session.start_time)
      return sessionDate >= today
    }).sort((a, b) => {
      const dateA = new Date(a.scheduled_date + 'T' + a.start_time)
      const dateB = new Date(b.scheduled_date + 'T' + b.start_time)
      return dateA.getTime() - dateB.getTime()
    })

    return (
      <div className="space-y-4">
        {upcomingSessions.map((session) => (
          <div
            key={session.id}
            className={`p-4 rounded-lg border ${getTypeColor(session.class_type)}`}
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <h3 className="text-lg font-medium text-gray-900">{session.course.code}</h3>
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    session.class_type === 'lecture' ? 'bg-blue-100 text-blue-800' :
                    session.class_type === 'tutorial' ? 'bg-purple-100 text-purple-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {session.class_type}
                  </span>
                </div>
                <p className="text-gray-600 mt-1">{session.title}</p>
                <p className="text-sm text-gray-500 mt-1">{session.course.title}</p>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium text-gray-900">
                  {new Date(session.scheduled_date).toLocaleDateString('en-US', { 
                    weekday: 'short', 
                    month: 'short', 
                    day: 'numeric' 
                  })}
                </div>
                <div className="text-sm text-gray-600">
                  {session.start_time} - {session.end_time}
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  {session.location}
                </div>
                {session.lecturer && (
                  <div className="text-sm text-gray-500 mt-1">
                    {session.lecturer.full_name}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (!user) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto p-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <h3 className="text-lg font-medium text-yellow-800">Access Required</h3>
            <p className="text-yellow-700 mt-2">Please log in to view your schedule.</p>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            {isAdmin ? 'All Schedules' : isLecturer ? 'My Teaching Schedule' : 'My Class Schedule'}
          </h1>
          <p className="text-gray-600 mt-2">
            {isAdmin ? 'View all class schedules' : isLecturer ? 'View your teaching schedule' : 'View your class schedule'}
          </p>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Controls */}
        <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Week Starting</label>
                <input
                  type="date"
                  value={selectedWeek || getCurrentWeek()}
                  onChange={(e) => setSelectedWeek(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={fetchSchedule}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Refresh
                </button>
              </div>
            </div>
            <div className="flex rounded-md shadow-sm">
              <button
                onClick={() => setViewType('week')}
                className={`px-4 py-2 text-sm font-medium rounded-l-md border ${
                  viewType === 'week'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                Week View
              </button>
              <button
                onClick={() => setViewType('month')}
                className={`px-4 py-2 text-sm font-medium rounded-r-md border-t border-r border-b ${
                  viewType === 'month'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                List View
              </button>
            </div>
          </div>
        </div>

        {/* Schedule Content */}
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading schedule...</p>
          </div>
        ) : (
          <div>
            {viewType === 'week' ? renderWeekView() : renderListView()}
          </div>
        )}

        {sessions.length === 0 && !loading && (
          <div className="text-center py-8">
            <p className="text-gray-500">No scheduled sessions found.</p>
          </div>
        )}
      </div>
    </AppLayout>
  )
} 