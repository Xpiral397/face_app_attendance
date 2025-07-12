'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface User {
  id: number
  email: string
  username: string
  full_name: string
  role: 'admin' | 'student'
  student_id?: string
  is_active: boolean
  created_at: string
}

interface LoginCredentials {
  email: string
  password: string
}

interface RegisterCredentials {
  email: string
  username: string
  full_name: string
  password: string
  confirm_password: string
  role: 'admin' | 'student'
  student_id?: string
}

interface AuthToken {
  access: string
  refresh: string
  user: User
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (credentials: LoginCredentials) => Promise<boolean>
  register: (credentials: RegisterCredentials) => Promise<{ success: boolean; message?: string }>
  logout: () => void
  isAuthenticated: boolean
  isAdmin: boolean
  isStudent: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Initialize auth state
    const savedUser = localStorage.getItem('user')
    if (savedUser && savedUser !== "undefined") {
      try {
        const parsedUser = JSON.parse(savedUser)
        setUser(parsedUser)
      } catch (error) {
        console.error('Error parsing saved user:', error)
        localStorage.removeItem('user')
      }
    }
    setLoading(false)
  }, [])

  const login = async (credentials: LoginCredentials): Promise<boolean> => {
    try {
      setLoading(true)
      // Make API call to login
      const response = await fetch('http://localhost:8000/api/auth/login/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      })

      if (response.ok) {
        const data: AuthToken = await response.json()
        console.log('Login response:', data)
        setUser(data.user)  // Set the user object, not the whole response
        localStorage.setItem('user', JSON.stringify(data.user))
        localStorage.setItem('access_token', data.access)
        localStorage.setItem('refresh_token', data.refresh)
        return true
      }
      return false
    } catch (error) {
      console.error('Login error:', error)
      return false
    } finally {
      setLoading(false)
    }
  }

  const register = async (credentials: RegisterCredentials): Promise<{ success: boolean; message?: string }> => {
    try {
      setLoading(true)
      // Make API call to register
      const response = await fetch('http://localhost:8000/api/auth/register/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      })

      if (response.ok) {
        const data: AuthToken = await response.json()
        setUser(data.user)
        localStorage.setItem('user', JSON.stringify(data.user))
        localStorage.setItem('access_token', data.access)
        localStorage.setItem('refresh_token', data.refresh)
        return { success: true }
      } else {
        const errorData = await response.json()
        return { 
          success: false, 
          message: errorData.message || 'Registration failed' 
        }
      }
    } catch (error) {
      console.error('Registration error:', error)
      return { 
        success: false, 
        message: 'Network error. Please try again.' 
      }
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('user')
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
  }

  // Computed properties based on user state
  const isAuthenticated = !!user
  const isAdmin = user?.role === 'admin'
  const isStudent = user?.role === 'student'

  const value: AuthContextType = {
    user,
    loading,
    login,
    register,
    logout,
    isAuthenticated,
    isAdmin,
    isStudent,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
} 