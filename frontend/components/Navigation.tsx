'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '../contexts/AuthContext'

interface NavigationItem {
  name: string
  href: string
  icon: React.ReactNode
  roles: string[]
  children?: NavigationItem[]
}

const navigationItems: NavigationItem[] = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
      </svg>
    ),
    roles: ['admin', 'lecturer', 'student']
  },
  {
    name: 'Course Management',
    href: '/courses',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    roles: ['admin', 'lecturer'],
    children: [
      { name: 'All Courses', href: '/courses', icon: null, roles: ['admin', 'lecturer'] },
      { name: 'My Assignments', href: '/courses/assignments', icon: null, roles: ['lecturer'] },
      { name: 'Course Creation', href: '/courses/create', icon: null, roles: ['admin'] },
      { name: 'College Management', href: '/colleges', icon: null, roles: ['admin'] },
      { name: 'Department Management', href: '/departments', icon: null, roles: ['admin'] },
    ]
  },
  {
    name: 'My Courses',
    href: '/my-courses',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    roles: ['student']
  },
  {
    name: 'Class Sessions',
    href: '/sessions',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    roles: ['admin', 'lecturer'],
    children: [
      { name: 'All Sessions', href: '/sessions', icon: null, roles: ['admin'] },
      { name: 'Manage Sessions', href: '/sessions/manage', icon: null, roles: ['lecturer'] },
    ]
  },
  {
    name: 'Class Schedule',
    href: '/schedule',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-6 0h6m-6 0l-2 13a2 2 0 002 2h6a2 2 0 002-2l-2-13M9 7h6" />
      </svg>
    ),
    roles: ['student']
  },
  {
    name: 'Attendance',
    href: '/attendance',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    roles: ['admin', 'lecturer', 'student'],
    children: [
      { name: 'Mark Attendance', href: '/attendance/mark', icon: null, roles: ['student'] },
      { name: 'Attendance History', href: '/attendance/history', icon: null, roles: ['admin', 'lecturer', 'student'] },
      { name: 'Attendance Analytics', href: '/attendance/analytics', icon: null, roles: ['admin', 'lecturer'] },
      { name: 'Manage Sessions', href: '/attendance/sessions', icon: null, roles: ['admin'] },
    ]
  },
  {
    name: 'Enrollment Management',
    href: '/enrollment',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
      </svg>
    ),
    roles: ['admin', 'student']
  },
  {
    name: 'Face Recognition',
    href: '/face-registration',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
    roles: ['admin', 'lecturer', 'student'],
    children: [
      { name: 'Register Face', href: '/face-registration', icon: null, roles: ['student'] },
      { name: 'Face Recognition Logs', href: '/face/logs', icon: null, roles: ['admin', 'lecturer'] },
      { name: 'Recognition Settings', href: '/face/settings', icon: null, roles: ['admin'] },
      { name: 'Face Statistics', href: '/face/stats', icon: null, roles: ['admin', 'lecturer'] },
    ]
  },
  {
    name: 'Reports',
    href: '/reports',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    roles: ['admin', 'lecturer'],
    children: [
      { name: 'Generate Reports', href: '/reports/generate', icon: null, roles: ['admin', 'lecturer'] },
      { name: 'Download Reports', href: '/reports/download', icon: null, roles: ['admin', 'lecturer'] },
      { name: 'Report Analytics', href: '/reports/analytics', icon: null, roles: ['admin'] },
    ]
  },
  {
    name: 'User Management',
    href: '/users',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
      </svg>
    ),
    roles: ['admin'],
    children: [
      { name: 'All Users', href: '/users', icon: null, roles: ['admin'] },
      { name: 'Pending Requests', href: '/pending-requests', icon: null, roles: ['admin'] },
      { name: 'Create User', href: '/users/create', icon: null, roles: ['admin'] },
      { name: 'User Statistics', href: '/users/stats', icon: null, roles: ['admin'] },
    ]
  },
  {
    name: 'Notifications',
    href: '/notifications',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM4 19h6v-2H4v2zM4 15h8v-2H4v2zM4 11h8V9H4v2z" />
      </svg>
    ),
    roles: ['admin', 'lecturer', 'student']
  }
]

interface NavigationProps {
  isOpen: boolean
  onClose: () => void
}

export default function Navigation({ isOpen, onClose }: NavigationProps) {
  const { user, logout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [expandedItems, setExpandedItems] = useState<string[]>([])

  const toggleExpanded = (itemName: string) => {
    setExpandedItems(prev =>
      prev.includes(itemName)
        ? prev.filter(name => name !== itemName)
        : [...prev, itemName]
    )
  }

  const isActive = (href: string) => {
    return pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
  }

  const isAuthorized = (roles: string[]) => {
    return user && roles.includes(user.role)
  }

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  const filteredNavigationItems = navigationItems.filter(item => isAuthorized(item.roles))

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={onClose} />
        </div>
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0`}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">
              Attendance System
            </h2>
            <button
              onClick={onClose}
              className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* User Info */}
          <div className="p-4 border-b bg-gray-50">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                {user?.full_name?.charAt(0)?.toUpperCase()}
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900">{user?.full_name}</p>
                <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4">
            <ul className="space-y-2">
              {filteredNavigationItems.map((item) => (
                <li key={item.name}>
                  {item.children ? (
                    <div>
                      <button
                        onClick={() => toggleExpanded(item.name)}
                        className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md ${
                          isActive(item.href)
                            ? 'bg-blue-100 text-blue-700'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                      >
                        <div className="flex items-center">
                          {item.icon}
                          <span className="ml-3">{item.name}</span>
                        </div>
                        <svg
                          className={`w-4 h-4 transition-transform ${
                            expandedItems.includes(item.name) ? 'rotate-180' : ''
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {expandedItems.includes(item.name) && (
                        <ul className="mt-2 ml-6 space-y-1">
                          {item.children.filter(child => isAuthorized(child.roles)).map((child) => (
                            <li key={child.name}>
                              <Link
                                href={child.href}
                                className={`block px-3 py-2 text-sm rounded-md ${
                                  isActive(child.href)
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                }`}
                                onClick={onClose}
                              >
                                {child.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : (
                    <Link
                      href={item.href}
                      className={`flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                        isActive(item.href)
                          ? 'bg-blue-100 text-blue-700'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                      onClick={onClose}
                    >
                      {item.icon}
                      <span className="ml-3">{item.name}</span>
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>

          {/* Footer */}
          <div className="p-4 border-t">
            <button
              onClick={handleLogout}
              className="w-full flex items-center px-3 py-2 text-sm font-medium text-red-600 rounded-md hover:bg-red-50"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="ml-3">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </>
  )
} 