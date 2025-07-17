'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { apiClient } from '../../utils/api'
import AppLayout from '../../components/AppLayout'

interface PendingUser {
  id: number
  email: string
  username: string
  full_name: string
  role: 'admin' | 'lecturer' | 'student'
  student_id?: string
  lecturer_id?: string
  department?: string
  department_name?: string
  level?: string
  referral_code_info?: {
    code: string
    role: string
    created_by_name: string
  }
  created_at: string
}

export default function PendingRequestsPage() {
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [selectedUsers, setSelectedUsers] = useState<number[]>([])
  const [bulkAction, setBulkAction] = useState<'approve' | 'reject'>('approve')
  const [processingUser, setProcessingUser] = useState<number | null>(null)
  const [processingBulk, setProcessingBulk] = useState(false)

  const { user, isAdmin } = useAuth()

  useEffect(() => {
    if (isAdmin) {
      fetchPendingUsers()
    }
  }, [isAdmin])

  const fetchPendingUsers = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await apiClient.get('/auth/pending-users/')
      setPendingUsers(response?.results || response || [])
    } catch (error: any) {
      console.error('Error fetching pending users:', error)
      setError(error.response?.message || 'Failed to fetch pending users')
    } finally {
      setLoading(false)
    }
  }

  const handleUserAction = async (userId: number, action: 'approve' | 'reject') => {
    try {
      setProcessingUser(userId)
      setError('')
      setSuccess('')
      
      const response = await apiClient.post('/auth/user-approval/', {
        user_id: userId,
        action: action
      })
      
      setSuccess(response?.message || `User ${action}ed successfully`)
      
      // Remove the user from the pending list
      setPendingUsers(prev => prev.filter(user => user.id !== userId))
      
      // Clear selection if this user was selected
      setSelectedUsers(prev => prev.filter(id => id !== userId))
    } catch (error: any) {
      console.error('Error processing user:', error)
      setError(error.response?.message || `Failed to ${action} user`)
    } finally {
      setProcessingUser(null)
    }
  }

  const handleBulkAction = async () => {
    if (selectedUsers.length === 0) {
      setError('Please select users to process')
      return
    }

    try {
      setProcessingBulk(true)
      setError('')
      setSuccess('')
      
      const response = await apiClient.post('/auth/bulk-user-approval/', {
        user_ids: selectedUsers,
        action: bulkAction
      })
      
      setSuccess(response?.message || `Users ${bulkAction}ed successfully`)
      
      // Remove processed users from the pending list
      setPendingUsers(prev => prev.filter(user => !selectedUsers.includes(user.id)))
      
      // Clear selection
      setSelectedUsers([])
    } catch (error: any) {
      console.error('Error processing bulk action:', error)
      setError(error.response?.message || `Failed to ${bulkAction} users`)
    } finally {
      setProcessingBulk(false)
    }
  }

  const handleUserSelect = (userId: number) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  const handleSelectAll = () => {
    if (selectedUsers.length === pendingUsers.length) {
      setSelectedUsers([])
    } else {
      setSelectedUsers(pendingUsers.map(user => user.id))
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (!user) {
    return <AppLayout><div>Loading...</div></AppLayout>
  }

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto p-6">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <h3 className="text-lg font-medium text-red-800">Access Denied</h3>
            <p className="text-red-700 mt-2">You don't have permission to access this page.</p>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Pending User Requests</h1>
          <p className="text-gray-600 mt-2">
            Review and approve or reject pending user registration requests
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-md p-4">
            <p className="text-green-700">{success}</p>
          </div>
        )}

        {/* Bulk Actions */}
        {pendingUsers.length > 0 && (
          <div className="mb-6 bg-gray-50 border border-gray-200 rounded-md p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={handleSelectAll}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  {selectedUsers.length === pendingUsers.length ? 'Deselect All' : 'Select All'}
                </button>
                <span className="text-sm text-gray-600">
                  {selectedUsers.length} of {pendingUsers.length} selected
                </span>
              </div>
              
              {selectedUsers.length > 0 && (
                <div className="flex items-center space-x-3">
                  <select
                    value={bulkAction}
                    onChange={(e) => setBulkAction(e.target.value as 'approve' | 'reject')}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="approve">Approve</option>
                    <option value="reject">Reject</option>
                  </select>
                  <button
                    onClick={handleBulkAction}
                    disabled={processingBulk}
                    className={`px-4 py-2 text-sm font-medium rounded-md ${
                      bulkAction === 'approve'
                        ? 'bg-green-600 text-white hover:bg-green-700'
                        : 'bg-red-600 text-white hover:bg-red-700'
                    } disabled:opacity-50`}
                  >
                    {processingBulk ? 'Processing...' : `${bulkAction.charAt(0).toUpperCase() + bulkAction.slice(1)} Selected`}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading pending requests...</p>
          </div>
        ) : pendingUsers.length === 0 ? (
          <div className="text-center py-8">
            <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-gray-500">No pending user requests found.</p>
          </div>
        ) : (
          <div className="bg-white shadow-md rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <input
                        type="checkbox"
                        checked={selectedUsers.length === pendingUsers.length}
                        onChange={handleSelectAll}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User Details
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Department
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Referral Code
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Requested
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {pendingUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedUsers.includes(user.id)}
                          onChange={() => handleUserSelect(user.id)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{user.full_name}</div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                          <div className="text-xs text-gray-400">@{user.username}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          user.role === 'admin' ? 'bg-red-100 text-red-800' :
                          user.role === 'lecturer' ? 'bg-blue-100 text-blue-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                        </span>
                        {user.role === 'student' && user.level && (
                          <div className="text-xs text-gray-500 mt-1">Level: {user.level}</div>
                        )}
                        {user.role === 'lecturer' && user.lecturer_id && (
                          <div className="text-xs text-gray-500 mt-1">ID: {user.lecturer_id}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {user.department_name || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {user.referral_code_info ? (
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {user.referral_code_info.code}
                            </div>
                            <div className="text-xs text-gray-500">
                              Created by: {user.referral_code_info.created_by_name}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400">N/A</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(user.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleUserAction(user.id, 'approve')}
                            disabled={processingUser === user.id}
                            className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50"
                          >
                            {processingUser === user.id ? 'Processing...' : 'Approve'}
                          </button>
                          <button
                            onClick={() => handleUserAction(user.id, 'reject')}
                            disabled={processingUser === user.id}
                            className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50"
                          >
                            {processingUser === user.id ? 'Processing...' : 'Reject'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
} 