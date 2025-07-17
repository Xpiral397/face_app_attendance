'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { apiClient } from '../../utils/api'
import AppLayout from '../../components/AppLayout'

interface Session {
  id: number
  title: string
  course_assignment: {
    id: number
    course: {
      id: number
      code: string
      title: string
    }
    lecturer: {
      id: number
      full_name: string
    }
  }
  scheduled_date: string
  start_time: string
  end_time: string
  venue: string
  class_type: string
  attendance_count?: number
  total_students?: number
  created_at: string
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedType, setSelectedType] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')

  const { user, isAdmin } = useAuth()

  useEffect(() => {
    if (isAdmin) {
      fetchSessions()
    }
  }, [isAdmin])

  const fetchSessions = async () => {
    try {
      setLoading(true)
      let url = '/courses/sessions/'
      
      const params = new URLSearchParams()
      if (selectedType) params.append('class_type', selectedType)
      if (searchTerm) params.append('search', searchTerm)
      
      if (params.toString()) {
        url += '?' + params.toString()
      }
      
      const response = await apiClient.get(url)
      const sessionsData = response.data?.results || response.data || []
      setSessions(sessionsData)
      console.log('Sessions data:', sessionsData)
      console.log('Full response:', response)
      setError('')
    } catch (error) {
      console.error('Error fetching sessions:', error)
      setError('Failed to fetch sessions')
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (session: Session) => {
    const now = new Date()
    const sessionDate = new Date(session.scheduled_date + 'T' + session.start_time)
    const endDate = new Date(session.scheduled_date + 'T' + session.end_time)
    
    if (now > endDate) {
      return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">Completed</span>
    } else if (now >= sessionDate && now <= endDate) {
      return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">In Progress</span>
    } else {
      return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">Upcoming</span>
    }
  }

  const getTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'lecture':
      case 'physical': return 'bg-blue-100 text-blue-800'
      case 'tutorial': return 'bg-purple-100 text-purple-800'
      case 'practical': return 'bg-green-100 text-green-800'
      case 'virtual': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const filteredSessions = sessions.filter(session => 
    session.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    session.course_assignment.course.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    session.course_assignment.course.title.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto p-6">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <h3 className="text-lg font-medium text-red-800">Access Denied</h3>
            <p className="text-red-700 mt-2">Only administrators can view all sessions.</p>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Class Sessions</h1>
          <p className="text-gray-600 mt-2">View all class sessions across the system</p>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Filters */}
        <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search Sessions</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchSessions()}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Search by title, course code..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Type</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Types</option>
                <option value="physical">Physical</option>
                <option value="virtual">Virtual</option>
                <option value="lecture">Lecture</option>
                <option value="tutorial">Tutorial</option>
                <option value="practical">Practical</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={fetchSessions}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Search
              </button>
            </div>
          </div>
        </div>

        {/* Sessions Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="text-2xl font-bold text-blue-600">{sessions.length}</div>
            <div className="text-sm text-gray-600">Total Sessions</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="text-2xl font-bold text-green-600">{sessions.filter(s => s.class_type === 'lecture' || s.class_type === 'physical').length}</div>
            <div className="text-sm text-gray-600">Physical Sessions</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="text-2xl font-bold text-purple-600">{sessions.filter(s => s.class_type === 'virtual').length}</div>
            <div className="text-sm text-gray-600">Virtual Sessions</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="text-2xl font-bold text-orange-600">{sessions.filter(s => s.class_type === 'practical').length}</div>
            <div className="text-sm text-gray-600">Practicals</div>
          </div>
        </div>

        {/* Sessions Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-6 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading sessions...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Session Details
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Course
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Lecturer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date & Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Location
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredSessions.map((session) => (
                    <tr key={session.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{session.title}</div>
                        <div className="text-sm text-gray-500">ID: {session.id}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{session.course_assignment.course.code}</div>
                        <div className="text-sm text-gray-500">{session.course_assignment.course.title}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{session.course_assignment.lecturer.full_name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getTypeColor(session.class_type)}`}>
                          {session.class_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div>{new Date(session.scheduled_date).toLocaleDateString()}</div>
                        <div className="text-gray-500">{session.start_time} - {session.end_time}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {session.venue}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(session)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {filteredSessions.length === 0 && !loading && (
          <div className="text-center py-8">
            <p className="text-gray-500">No sessions found matching your criteria.</p>
          </div>
        )}
      </div>
    </AppLayout>
  )
} 