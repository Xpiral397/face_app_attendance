'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { apiClient } from '../../utils/api'
import AppLayout from '../../components/AppLayout'

interface College {
  id: number
  name: string
  code: string
}

interface Department {
  id: number
  name: string
  code: string
  college: number
}

interface Course {
  id: number
  code: string
  title: string
  description: string
  department: number
  level: string
  credit_units: number
  lecturer_name?: string
  is_enrolled?: boolean
}

interface User {
  id: number
  username: string
  email: string
  full_name: string
  role: 'admin' | 'lecturer' | 'student'
  department?: string
  level?: string
  lecturer_id?: string
  is_active: boolean
}

interface ReferralCode {
  id: number
  code: string
  role: 'admin' | 'lecturer'
  created_by_name: string
  is_active: boolean
  usage_count: number
  max_usage: number
  expires_at?: string
  created_at: string
}

interface Enrollment {
  id: number
  course: number
  student: number
  status: string
  created_at: string
}

interface StudentInfo {
  full_name: string
  email: string
  matrix_number: string
  password: string
  confirm_password: string
  department: string
  level: string
}

export default function EnrollmentManagementPage() {
  const [activeTab, setActiveTab] = useState<'student' | 'admin'>('student')
  const [step, setStep] = useState(1) // For student enrollment flow
  const [colleges, setColleges] = useState<College[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [referralCodes, setReferralCodes] = useState<ReferralCode[]>([])
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [selectedCollege, setSelectedCollege] = useState<College | null>(null)
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Student info for enrollment
  const [studentInfo, setStudentInfo] = useState<StudentInfo>({
    full_name: '',
    email: '',
    matrix_number: '',
    password: '',
    confirm_password: '',
    department: '',
    level: ''
  })
  const [showStudentForm, setShowStudentForm] = useState(false)

  // Admin tab states
  const [showReferralModal, setShowReferralModal] = useState(false)
  const [showStudentAssignModal, setShowStudentAssignModal] = useState(false)
  const [showLecturerAssignModal, setShowLecturerAssignModal] = useState(false)
  const [referralFormData, setReferralFormData] = useState({
    role: 'lecturer' as 'admin' | 'lecturer',
    max_usage: 50,
    expires_at: ''
  })

  // Lecturer assignment states
  const [assignmentData, setAssignmentData] = useState({
    lecturer_id: '',
    course_id: '',
    academic_year: '',
    semester: ''
  })

  const { user, isStudent, isAdmin } = useAuth()

  useEffect(() => {
    fetchColleges()
    if (user?.role === 'student') {
      fetchMyEnrollments()
    }
    if (isAdmin) {
      fetchReferralCodes()
      fetchUsers()
    }
  }, [user, isAdmin])

  // Fetch departments when college changes
  useEffect(() => {
    if (selectedCollege) {
      fetchDepartments(selectedCollege.id)
    } else {
      setDepartments([])
      setSelectedDepartment(null)
      setCourses([])
    }
  }, [selectedCollege])

  // Fetch courses when department changes
  useEffect(() => {
    if (selectedDepartment) {
      fetchCourses(selectedDepartment.id)
    } else {
      setCourses([])
    }
  }, [selectedDepartment])

  const fetchColleges = async () => {
    try {
      const response = await apiClient.get('/courses/colleges/')
      setColleges(response?.results || response || [])
    } catch (error) {
      console.error('Error fetching colleges:', error)
      setError('Failed to fetch colleges')
    }
  }

  const fetchDepartments = async (collegeId: number) => {
    try {
      setLoading(true)
      const response = await apiClient.get(`/courses/departments/?college=${collegeId}`)
      setDepartments(response?.results || response || [])
    } catch (error) {
      console.error('Error fetching departments:', error)
      setError('Failed to fetch departments')
    } finally {
      setLoading(false)
    }
  }

  const fetchCourses = async (departmentId: number) => {
    try {
      setLoading(true)
      const response = await apiClient.get(`/courses/courses/?department=${departmentId}${user?.role === 'student' ? `&level=${user.level}` : ''}`)
      
      // Check enrollment status for each course if student
      const coursesData = response?.results || response || []
      if (user?.role === 'student') {
        const coursesWithEnrollment = coursesData.map((course: Course) => ({
          ...course,
          is_enrolled: enrollments.some(enrollment => enrollment.course === course.id)
        }))
        setCourses(coursesWithEnrollment)
      } else {
        setCourses(coursesData)
      }
    } catch (error) {
      console.error('Error fetching courses:', error)
      setError('Failed to fetch courses')
    } finally {
      setLoading(false)
    }
  }

  const fetchMyEnrollments = async () => {
    try {
      const response = await apiClient.get('/courses/enrollments/')
      setEnrollments(response?.results || response || [])
    } catch (error) {
      console.error('Error fetching enrollments:', error)
    }
  }

  const fetchReferralCodes = async () => {
    try {
      const response = await apiClient.get('/auth/referral-codes/')
      setReferralCodes(response?.results || response || [])
    } catch (error) {
      console.error('Error fetching referral codes:', error)
    }
  }

  const fetchUsers = async () => {
    try {
      const response = await apiClient.get('/auth/users/')
      setUsers(response?.results || response || [])
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  const handleCollegeSelect = (college: College) => {
    setSelectedCollege(college)
    setSelectedDepartment(null)
    setCourses([])
    if (user?.role === 'student') {
      setShowStudentForm(true)
      setStudentInfo(prev => ({ ...prev, department: college.id.toString() }))
    } else {
      setStep(2)
    }
  }

  const handleDepartmentSelect = (department: Department) => {
    setSelectedDepartment(department)
    setStep(3)
  }

  const handleStudentInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (studentInfo.password !== studentInfo.confirm_password) {
      setError('Passwords do not match')
      return
    }

    try {
      setLoading(true)
      setError('')
      
      // Create student account
      const studentData = {
        email: studentInfo.email,
        username: studentInfo.matrix_number,
        full_name: studentInfo.full_name,
        password: studentInfo.password,
        confirm_password: studentInfo.confirm_password,
        role: 'student',
        student_id: studentInfo.matrix_number,
        department: selectedCollege?.id,
        level: studentInfo.level
      }
      
      const response = await apiClient.post('/auth/register/', studentData)
      
      if (response?.user) {
        setSuccess('Student account created successfully! Proceeding to course selection...')
        setShowStudentForm(false)
        setStep(2)
      }
    } catch (error: any) {
      console.error('Error creating student account:', error)
      setError(error.response?.message || 'Failed to create student account')
    } finally {
      setLoading(false)
    }
  }

  const handleEnrollInCourse = async (courseId: number) => {
    try {
      setLoading(true)
      setError('')
      setSuccess('')
      
      const response = await apiClient.post('/courses/enrollments/request/', {
        course: courseId
      })
      
      setSuccess('Enrollment request submitted successfully!')
      
      // Update the course enrollment status
      setCourses(prev => prev.map(course => 
        course.id === courseId ? { ...course, is_enrolled: true } : course
      ))
      
      // Refresh enrollments
      fetchMyEnrollments()
    } catch (error: any) {
      console.error('Error enrolling in course:', error)
      setError(error.response?.message || 'Failed to enroll in course')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateReferralCode = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setLoading(true)
      setError('')
      setSuccess('')
      
      // Prepare data - convert empty date string to null
      const submitData = {
        ...referralFormData,
        expires_at: referralFormData.expires_at || null
      }
      
      const response = await apiClient.post('/auth/referral-codes/', submitData)
      
      setSuccess('Referral code created successfully!')
      setShowReferralModal(false)
      setReferralFormData({
        role: 'lecturer',
        max_usage: 50,
        expires_at: ''
      })
      
      fetchReferralCodes()
    } catch (error: any) {
      console.error('Error creating referral code:', error)
      setError(error.response?.message || 'Failed to create referral code')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleReferralCode = async (codeId: number, isActive: boolean) => {
    try {
      await apiClient.patch(`/auth/referral-codes/${codeId}/`, {
        is_active: !isActive
      })
      
      setSuccess(`Referral code ${!isActive ? 'activated' : 'deactivated'} successfully!`)
      fetchReferralCodes()
    } catch (error: any) {
      console.error('Error updating referral code:', error)
      setError(error.response?.message || 'Failed to update referral code')
    }
  }

  const handleLecturerAssignment = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setLoading(true)
      setError('')
      setSuccess('')
      
      const response = await apiClient.post('/courses/course-assignments/', {
        lecturer_id: parseInt(assignmentData.lecturer_id),
        course_id: parseInt(assignmentData.course_id),
        academic_year: assignmentData.academic_year,
        semester: assignmentData.semester
      })
      
      setSuccess('Lecturer assigned to course successfully!')
      setShowLecturerAssignModal(false)
      setAssignmentData({
        lecturer_id: '',
        course_id: '',
        academic_year: '',
        semester: ''
      })
    } catch (error: any) {
      console.error('Error assigning lecturer:', error)
      setError(error.response?.message || 'Failed to assign lecturer')
    } finally {
      setLoading(false)
    }
  }

  const resetSelection = () => {
    setStep(1)
    setSelectedCollege(null)
    setSelectedDepartment(null)
    setCourses([])
    setError('')
    setSuccess('')
    setShowStudentForm(false)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  if (!user) {
    return <AppLayout><div>Loading...</div></AppLayout>
  }

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            {isAdmin ? 'Enrollment Management' : 'Course Enrollment'}
          </h1>
          <p className="text-gray-600 mt-2">
            {isAdmin 
              ? 'Manage referral codes, student assignments, and lecturer assignments'
              : 'Select your college, department, and courses'
            }
          </p>
        </div>

        {/* Tab Navigation for Admin */}
        {isAdmin && (
          <div className="mb-8">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8">
                <button
                  onClick={() => setActiveTab('student')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'student'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Student Enrollment
                </button>
                <button
                  onClick={() => setActiveTab('admin')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'admin'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Admin Management
                </button>
              </nav>
            </div>
          </div>
        )}

        {/* Success/Error Messages */}
        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-md p-4">
            <p className="text-green-700">{success}</p>
          </div>
        )}
        
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Admin Management Tab */}
        {isAdmin && activeTab === 'admin' && (
          <div className="space-y-8">
            {/* Referral Code Management */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Referral Code Management</h2>
                <button
                  onClick={() => setShowReferralModal(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Create Referral Code
                </button>
              </div>
              
              {referralCodes.length === 0 ? (
                <p className="text-gray-500">No referral codes created yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usage</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {referralCodes.map((code) => (
                        <tr key={code.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {code.code}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              code.role === 'admin' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                            }`}>
                              {code.role}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {code.usage_count}/{code.max_usage}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              code.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {code.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(code.created_at)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button
                              onClick={() => handleToggleReferralCode(code.id, code.is_active)}
                              className={`px-3 py-1 text-xs rounded ${
                                code.is_active
                                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                  : 'bg-green-100 text-green-700 hover:bg-green-200'
                              }`}
                            >
                              {code.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Student and Lecturer Assignment */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Student Course Assignment</h3>
                <p className="text-gray-600 mb-4">Assign students to courses based on their department and level.</p>
                <button
                  onClick={() => setShowStudentAssignModal(true)}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  Manage Student Assignments
                </button>
              </div>
              
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Lecturer Course Assignment</h3>
                <p className="text-gray-600 mb-4">Assign lecturers to available courses in their departments.</p>
                <button
                  onClick={() => setShowLecturerAssignModal(true)}
                  className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
                >
                  Manage Lecturer Assignments
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Student Enrollment Tab / Default for Students */}
        {(isStudent || (isAdmin && activeTab === 'student')) && (
          <div>
            {/* Progress Steps */}
            <div className="mb-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                    step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                  }`}>
                    1
                  </div>
                  <span className={`text-sm font-medium ${
                    step >= 1 ? 'text-blue-600' : 'text-gray-500'
                  }`}>
                    Select College
                  </span>
                </div>
                
                <div className={`flex-1 h-1 mx-4 ${
                  step >= 2 ? 'bg-blue-600' : 'bg-gray-200'
                }`}></div>
                
                <div className="flex items-center space-x-4">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                    step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                  }`}>
                    2
                  </div>
                  <span className={`text-sm font-medium ${
                    step >= 2 ? 'text-blue-600' : 'text-gray-500'
                  }`}>
                    Select Department
                  </span>
                </div>
                
                <div className={`flex-1 h-1 mx-4 ${
                  step >= 3 ? 'bg-blue-600' : 'bg-gray-200'
                }`}></div>
                
                <div className="flex items-center space-x-4">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                    step >= 3 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                  }`}>
                    3
                  </div>
                  <span className={`text-sm font-medium ${
                    step >= 3 ? 'text-blue-600' : 'text-gray-500'
                  }`}>
                    Select Courses
                  </span>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              {/* Step 1: College Selection */}
              {step === 1 && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Select Your College/Faculty</h2>
                  {colleges.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-500">No colleges available. Please contact admin.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {colleges.map((college) => (
                        <div
                          key={college.id}
                          onClick={() => handleCollegeSelect(college)}
                          className="p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 cursor-pointer transition-colors"
                        >
                          <h3 className="font-medium text-gray-900">{college.name}</h3>
                          <p className="text-sm text-gray-600 mt-1">Code: {college.code}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Student Information Form */}
              {showStudentForm && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Student Information</h2>
                  <form onSubmit={handleStudentInfoSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Full Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={studentInfo.full_name}
                          onChange={(e) => setStudentInfo(prev => ({ ...prev, full_name: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Email <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="email"
                          value={studentInfo.email}
                          onChange={(e) => setStudentInfo(prev => ({ ...prev, email: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Matrix Number <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={studentInfo.matrix_number}
                          onChange={(e) => setStudentInfo(prev => ({ ...prev, matrix_number: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Level <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={studentInfo.level}
                          onChange={(e) => setStudentInfo(prev => ({ ...prev, level: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        >
                          <option value="">Select Level</option>
                          <option value="100">100 Level</option>
                          <option value="200">200 Level</option>
                          <option value="300">300 Level</option>
                          <option value="400">400 Level</option>
                          <option value="500">500 Level</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Password <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="password"
                          value={studentInfo.password}
                          onChange={(e) => setStudentInfo(prev => ({ ...prev, password: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                        <p className="text-xs text-gray-500 mt-1">Default: Matrix number</p>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Confirm Password <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="password"
                          value={studentInfo.confirm_password}
                          onChange={(e) => setStudentInfo(prev => ({ ...prev, confirm_password: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>
                    </div>
                    
                    <div className="flex justify-end space-x-3">
                      <button
                        type="button"
                        onClick={() => setShowStudentForm(false)}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={loading}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                      >
                        {loading ? 'Creating...' : 'Create Student Account'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Step 2: Department Selection */}
              {step === 2 && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-gray-900">
                      Select Department in {selectedCollege?.name}
                    </h2>
                    <button
                      onClick={() => setStep(1)}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      Change College
                    </button>
                  </div>
                  
                  {loading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="mt-2 text-gray-600">Loading departments...</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {departments.map((department) => (
                        <div
                          key={department.id}
                          onClick={() => handleDepartmentSelect(department)}
                          className="p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 cursor-pointer transition-colors"
                        >
                          <h3 className="font-medium text-gray-900">{department.name}</h3>
                          <p className="text-sm text-gray-600 mt-1">Code: {department.code}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Course Selection */}
              {step === 3 && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-gray-900">
                      Available Courses - {selectedDepartment?.name}
                    </h2>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setStep(2)}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        Change Department
                      </button>
                      <button
                        onClick={resetSelection}
                        className="text-gray-600 hover:text-gray-800 text-sm"
                      >
                        Start Over
                      </button>
                    </div>
                  </div>
                  
                  {loading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="mt-2 text-gray-600">Loading courses...</p>
                    </div>
                  ) : courses.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                      <p>No courses available for this department.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {courses.map((course) => (
                        <div
                          key={course.id}
                          className="p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <h3 className="font-medium text-gray-900">{course.code}: {course.title}</h3>
                              <p className="text-sm text-gray-600 mt-1">{course.description}</p>
                              <div className="flex items-center mt-2 text-sm text-gray-500">
                                <span>Level: {course.level}</span>
                                <span className="mx-2">•</span>
                                <span>Credits: {course.credit_units}</span>
                                {course.lecturer_name && (
                                  <>
                                    <span className="mx-2">•</span>
                                    <span>Lecturer: {course.lecturer_name}</span>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="ml-4">
                              {user?.role === 'student' && (
                                course.is_enrolled ? (
                                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                                    Enrolled
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => handleEnrollInCourse(course.id)}
                                    disabled={loading}
                                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                                  >
                                    Enroll
                                  </button>
                                )
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Referral Code Modal */}
        {showReferralModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">Create Referral Code</h3>
              <form onSubmit={handleCreateReferralCode} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Role
                  </label>
                  <select
                    value={referralFormData.role}
                    onChange={(e) => setReferralFormData(prev => ({ ...prev, role: e.target.value as 'admin' | 'lecturer' }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="lecturer">Lecturer</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Maximum Usage
                  </label>
                  <input
                    type="number"
                    value={referralFormData.max_usage}
                    onChange={(e) => setReferralFormData(prev => ({ ...prev, max_usage: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="1"
                    max="100"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Expiration Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={referralFormData.expires_at}
                    onChange={(e) => setReferralFormData(prev => ({ ...prev, expires_at: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowReferralModal(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loading ? 'Creating...' : 'Create Code'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Student Assignment Modal Placeholder */}
        {showStudentAssignModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
              <h3 className="text-lg font-semibold mb-4">Student Course Assignment</h3>
              <p className="text-gray-600 mb-4">Feature coming soon - Assign students to courses based on their department and level.</p>
              <button
                onClick={() => setShowStudentAssignModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Lecturer Assignment Modal */}
        {showLecturerAssignModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold mb-4">Lecturer Course Assignment</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Lecturers List */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Available Lecturers</h4>
                  <div className="max-h-64 overflow-y-auto border rounded-md">
                    {users.filter(user => user.role === 'lecturer').map((lecturer) => (
                      <div key={lecturer.id} className="p-3 border-b hover:bg-gray-50">
                        <div className="font-medium text-gray-900">{lecturer.full_name}</div>
                        <div className="text-sm text-gray-600">{lecturer.email}</div>
                        <div className="text-xs text-gray-500">
                          ID: {lecturer.lecturer_id} | Dept: {lecturer.department}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Courses List */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Available Courses</h4>
                  <div className="max-h-64 overflow-y-auto border rounded-md">
                    {courses.map((course) => (
                      <div key={course.id} className="p-3 border-b hover:bg-gray-50">
                        <div className="font-medium text-gray-900">{course.code}: {course.title}</div>
                        <div className="text-sm text-gray-600">{course.description}</div>
                        <div className="text-xs text-gray-500">
                          Level: {course.level} | Credits: {course.credit_units}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              {/* Assignment Form */}
              <div className="pt-4 border-t">
                <h4 className="font-medium text-gray-900 mb-3">Create Assignment</h4>
                <form onSubmit={handleLecturerAssignment} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Lecturer <span className="text-red-500">*</span>
                    </label>
                    <select 
                      value={assignmentData.lecturer_id}
                      onChange={(e) => setAssignmentData(prev => ({ ...prev, lecturer_id: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Select Lecturer</option>
                      {users.filter(user => user.role === 'lecturer').map((lecturer) => (
                        <option key={lecturer.id} value={lecturer.id}>
                          {lecturer.full_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Course <span className="text-red-500">*</span>
                    </label>
                    <select 
                      value={assignmentData.course_id}
                      onChange={(e) => setAssignmentData(prev => ({ ...prev, course_id: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Select Course</option>
                      {courses.map((course) => (
                        <option key={course.id} value={course.id}>
                          {course.code}: {course.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Academic Year <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={assignmentData.academic_year}
                      onChange={(e) => setAssignmentData(prev => ({ ...prev, academic_year: e.target.value }))}
                      placeholder="2024/2025"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Semester <span className="text-red-500">*</span>
                    </label>
                    <select 
                      value={assignmentData.semester}
                      onChange={(e) => setAssignmentData(prev => ({ ...prev, semester: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Select Semester</option>
                      <option value="First">First Semester</option>
                      <option value="Second">Second Semester</option>
                    </select>
                  </div>
                  
                  <div className="md:col-span-2 lg:col-span-4 flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => setShowLecturerAssignModal(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                    >
                      Close
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:opacity-50"
                    >
                      {loading ? 'Creating...' : 'Create Assignment'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
} 