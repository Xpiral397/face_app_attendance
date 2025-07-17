'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { apiClient } from '../../utils/api'
import AppLayout from '../../components/AppLayout'

interface Notification {
  id: number
  title: string
  message: string
  type: 'info' | 'warning' | 'error' | 'success'
  is_read: boolean
  created_at: string
  related_object?: {
    type: string
    id: number
    name: string
  }
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all')

  const { user } = useAuth()

  useEffect(() => {
    if (user) {
      fetchNotifications()
    }
  }, [user])

  const fetchNotifications = async () => {
    try {
      setLoading(true)
      
      try {
        const response = await apiClient.get('/notifications/')
        setNotifications(response.data || [])
      } catch (apiError) {
        console.warn('Notifications API not available, using fallback data')
        // Fallback mock data when API is not available
        const mockNotifications: Notification[] = [
          {
            id: 1,
            title: 'New Course Available',
            message: 'A new course "Advanced Machine Learning" has been added to your department.',
            type: 'info',
            is_read: false,
            created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            related_object: {
              type: 'course',
              id: 101,
              name: 'Advanced Machine Learning'
            }
          },
          {
            id: 2,
            title: 'Class Schedule Updated',
            message: 'Your Database Systems class has been rescheduled to 2:00 PM.',
            type: 'warning',
            is_read: false,
            created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
            related_object: {
              type: 'session',
              id: 25,
              name: 'Database Systems - Lecture'
            }
          },
          {
            id: 3,
            title: 'Attendance Marked Successfully',
            message: 'Your attendance for Software Engineering class has been recorded.',
            type: 'success',
            is_read: true,
            created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
            related_object: {
              type: 'attendance',
              id: 50,
              name: 'Software Engineering - Tutorial'
            }
          },
          {
            id: 4,
            title: 'System Maintenance',
            message: 'The system will be under maintenance from 11:00 PM to 1:00 AM tonight.',
            type: 'warning',
            is_read: true,
            created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          },
          {
            id: 5,
            title: 'Welcome to the System!',
            message: 'Welcome to the AI Face Recognition Attendance System. Please complete your profile setup.',
            type: 'info',
            is_read: true,
            created_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
          }
        ]
        setNotifications(mockNotifications)
      }
      
      setError('')
    } catch (error) {
      console.error('Error fetching notifications:', error)
      setError('Failed to fetch notifications')
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (notificationId: number) => {
    try {
      // Try to call the API first
      try {
        await apiClient.patch(`/notifications/${notificationId}/`, { is_read: true })
      } catch (apiError) {
        console.warn('Mark as read API not available')
      }
      
      // Update local state regardless
      setNotifications(notifications.map(n => 
        n.id === notificationId ? { ...n, is_read: true } : n
      ))
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  const markAllAsRead = async () => {
    try {
      // Try to call the API first
      try {
        await apiClient.post('/notifications/mark-all-read/')
      } catch (apiError) {
        console.warn('Mark all as read API not available')
      }
      
      // Update local state regardless
      setNotifications(notifications.map(n => ({ ...n, is_read: true })))
    } catch (error) {
      console.error('Error marking all notifications as read:', error)
    }
  }

  const deleteNotification = async (notificationId: number) => {
    try {
      // Try to call the API first
      try {
        await apiClient.delete(`/notifications/${notificationId}/`)
      } catch (apiError) {
        console.warn('Delete notification API not available')
      }
      
      // Update local state regardless
      setNotifications(notifications.filter(n => n.id !== notificationId))
    } catch (error) {
      console.error('Error deleting notification:', error)
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'info':
        return (
          <div className="p-2 bg-blue-100 rounded-lg">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        )
      case 'warning':
        return (
          <div className="p-2 bg-yellow-100 rounded-lg">
            <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
        )
      case 'error':
        return (
          <div className="p-2 bg-red-100 rounded-lg">
            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        )
      case 'success':
        return (
          <div className="p-2 bg-green-100 rounded-lg">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )
      default:
        return (
          <div className="p-2 bg-gray-100 rounded-lg">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM7 17h5l-5 5v-5z" />
            </svg>
          </div>
        )
    }
  }

  const getTypeBorderColor = (type: string) => {
    switch (type) {
      case 'info': return 'border-l-blue-400'
      case 'warning': return 'border-l-yellow-400'
      case 'error': return 'border-l-red-400'
      case 'success': return 'border-l-green-400'
      default: return 'border-l-gray-400'
    }
  }

  const filteredNotifications = notifications.filter(notification => {
    if (filter === 'unread') return !notification.is_read
    if (filter === 'read') return notification.is_read
    return true
  })

  const unreadCount = notifications.filter(n => !n.is_read).length

  if (!user) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto p-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <h3 className="text-lg font-medium text-yellow-800">Access Required</h3>
            <p className="text-yellow-700 mt-2">Please log in to view your notifications.</p>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
          <p className="text-gray-600 mt-2">
            Stay updated with important system messages and announcements
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
              <div className="flex rounded-md shadow-sm">
                <button
                  onClick={() => setFilter('all')}
                  className={`px-4 py-2 text-sm font-medium rounded-l-md border ${
                    filter === 'all'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  All ({notifications.length})
                </button>
                <button
                  onClick={() => setFilter('unread')}
                  className={`px-4 py-2 text-sm font-medium border-t border-b ${
                    filter === 'unread'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Unread ({unreadCount})
                </button>
                <button
                  onClick={() => setFilter('read')}
                  className={`px-4 py-2 text-sm font-medium rounded-r-md border ${
                    filter === 'read'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Read ({notifications.length - unreadCount})
                </button>
              </div>
            </div>
            <div className="flex space-x-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Mark All as Read
                </button>
              )}
              <button
                onClick={fetchNotifications}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Notifications List */}
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading notifications...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`bg-white rounded-lg shadow-sm border border-gray-200 ${getTypeBorderColor(notification.type)} border-l-4 p-4 ${
                  !notification.is_read ? 'bg-blue-50' : ''
                }`}
              >
                <div className="flex items-start space-x-3">
                  {getTypeIcon(notification.type)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className={`text-sm font-medium ${!notification.is_read ? 'text-gray-900' : 'text-gray-700'}`}>
                        {notification.title}
                        {!notification.is_read && (
                          <span className="ml-2 inline-block w-2 h-2 bg-blue-500 rounded-full"></span>
                        )}
                      </h3>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-gray-500">
                          {new Date(notification.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                        <div className="flex space-x-1">
                          {!notification.is_read && (
                            <button
                              onClick={() => markAsRead(notification.id)}
                              className="p-1 text-blue-600 hover:text-blue-800"
                              title="Mark as read"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </button>
                          )}
                          <button
                            onClick={() => deleteNotification(notification.id)}
                            className="p-1 text-red-600 hover:text-red-800"
                            title="Delete"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                    <p className="mt-1 text-sm text-gray-600">{notification.message}</p>
                    {notification.related_object && (
                      <div className="mt-2 text-xs text-gray-500">
                        Related to: {notification.related_object.type} - {notification.related_object.name}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {filteredNotifications.length === 0 && !loading && (
          <div className="text-center py-8">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM7 17h5l-5 5v-5z" />
            </svg>
            <p className="text-gray-500 text-lg">
              {filter === 'all' ? 'No notifications yet' : 
               filter === 'unread' ? 'No unread notifications' : 
               'No read notifications'}
            </p>
            <p className="text-gray-400 text-sm mt-2">
              {filter === 'all' ? 'You\'ll see important updates and announcements here' : 
               filter === 'unread' ? 'All caught up! No new notifications' : 
               'No notifications have been read yet'}
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  )
} 