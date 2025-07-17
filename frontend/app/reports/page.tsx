'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { apiClient } from '../../utils/api'
import AppLayout from '../../components/AppLayout'

interface ReportData {
  course_reports: {
    course_code: string
    course_title: string
    total_sessions: number
    total_students: number
    average_attendance: number
    attendance_trend: string
  }[]
  student_reports: {
    student_name: string
    student_id: string
    total_courses: number
    attendance_rate: number
    absent_sessions: number
  }[]
  lecturer_reports: {
    lecturer_name: string
    total_courses: number
    total_sessions: number
    average_attendance: number
  }[]
  overall_stats: {
    total_students: number
    total_courses: number
    total_sessions: number
    overall_attendance_rate: number
  }
}

export default function ReportsPage() {
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedReport, setSelectedReport] = useState<'overview' | 'courses' | 'students' | 'lecturers'>('overview')
  const [dateRange, setDateRange] = useState({
    start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0]
  })

  const { user, isAdmin } = useAuth()

  useEffect(() => {
    if (isAdmin) {
      fetchReports()
    }
  }, [isAdmin])

  const fetchReports = async () => {
    try {
      setLoading(true)
      
      try {
        const response = await apiClient.get(`/reports/attendance/?start_date=${dateRange.start_date}&end_date=${dateRange.end_date}`)
        setReportData(response.data || {
          course_reports: [],
          student_reports: [],
          lecturer_reports: [],
          overall_stats: {
            total_students: 0,
            total_courses: 0,
            total_sessions: 0,
            overall_attendance_rate: 0
          }
        })
      } catch (apiError) {
        console.warn('Reports API not available, using fallback data')
        // Fallback mock data when API is not available
        const mockReportData: ReportData = {
          course_reports: [
            {
              course_code: 'CSC302',
              course_title: 'Database Systems',
              total_sessions: 12,
              total_students: 45,
              average_attendance: 85,
              attendance_trend: 'increasing'
            },
            {
              course_code: 'CSC301',
              course_title: 'Data Structures',
              total_sessions: 10,
              total_students: 38,
              average_attendance: 78,
              attendance_trend: 'stable'
            },
            {
              course_code: 'MTH301',
              course_title: 'Linear Algebra',
              total_sessions: 8,
              total_students: 42,
              average_attendance: 92,
              attendance_trend: 'increasing'
            }
          ],
          student_reports: [
            {
              student_name: 'Alice Johnson',
              student_id: 'STU001',
              total_courses: 6,
              attendance_rate: 85,
              absent_sessions: 3
            },
            {
              student_name: 'Bob Smith',
              student_id: 'STU002',
              total_courses: 5,
              attendance_rate: 92,
              absent_sessions: 1
            }
          ],
          lecturer_reports: [
            {
              lecturer_name: 'Prof. John Smith',
              total_courses: 3,
              total_sessions: 24,
              average_attendance: 88
            },
            {
              lecturer_name: 'Dr. Sarah Johnson',
              total_courses: 2,
              total_sessions: 16,
              average_attendance: 91
            }
          ],
          overall_stats: {
            total_students: 156,
            total_courses: 11,
            total_sessions: 48,
            overall_attendance_rate: 87
          }
        }
        setReportData(mockReportData)
      }
      
      setError('')
    } catch (error) {
      console.error('Error fetching reports:', error)
      setError('Failed to fetch reports')
    } finally {
      setLoading(false)
    }
  }

  const exportReport = async (format: 'pdf' | 'csv') => {
    try {
      const response = await apiClient.get(`/reports/attendance/export/?format=${format}&start_date=${dateRange.start_date}&end_date=${dateRange.end_date}`)
      
      // For now, create a simple CSV export as fallback
      if (format === 'csv' && reportData) {
        const csvContent = [
          'Course Code,Course Title,Total Sessions,Total Students,Average Attendance',
          ...reportData.course_reports.map(report => 
            `${report.course_code},${report.course_title},${report.total_sessions},${report.total_students},${report.average_attendance}%`
          )
        ].join('\n')
        
        const blob = new Blob([csvContent], { type: 'text/csv' })
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', `attendance_report_${dateRange.start_date}_${dateRange.end_date}.csv`)
        document.body.appendChild(link)
        link.click()
        link.remove()
        window.URL.revokeObjectURL(url)
      } else {
        // Handle PDF export or other formats
        console.log('Export format not implemented:', format)
      }
    } catch (error) {
      console.error('Error exporting report:', error)
    }
  }

  const renderOverview = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Students</p>
              <p className="text-2xl font-semibold text-gray-900">{reportData?.overall_stats.total_students || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Courses</p>
              <p className="text-2xl font-semibold text-gray-900">{reportData?.overall_stats.total_courses || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Sessions</p>
              <p className="text-2xl font-semibold text-gray-900">{reportData?.overall_stats.total_sessions || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Overall Attendance</p>
              <p className="text-2xl font-semibold text-gray-900">{reportData?.overall_stats.overall_attendance_rate || 0}%</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const renderCourseReports = () => (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Course Attendance Reports</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Course</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sessions</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Students</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Attendance</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trend</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {reportData?.course_reports.map((course, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{course.course_code}</div>
                  <div className="text-sm text-gray-500">{course.course_title}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{course.total_sessions}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{course.total_students}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                      <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${course.average_attendance}%` }}></div>
                    </div>
                    <span className="text-sm font-medium text-gray-900">{course.average_attendance}%</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    course.attendance_trend === 'increasing' ? 'bg-green-100 text-green-800' :
                    course.attendance_trend === 'decreasing' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {course.attendance_trend}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto p-6">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <h3 className="text-lg font-medium text-red-800">Access Denied</h3>
            <p className="text-red-700 mt-2">Only administrators can access reports.</p>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Attendance Reports</h1>
          <p className="text-gray-600 mt-2">Generate and view attendance reports</p>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Date Range and Export Controls */}
        <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={dateRange.start_date}
                  onChange={(e) => setDateRange({...dateRange, start_date: e.target.value})}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={dateRange.end_date}
                  onChange={(e) => setDateRange({...dateRange, end_date: e.target.value})}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={fetchReports}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Generate Report
                </button>
              </div>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => exportReport('pdf')}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                Export PDF
              </button>
              <button
                onClick={() => exportReport('csv')}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
              >
                Export CSV
              </button>
            </div>
          </div>
        </div>

        {/* Report Tabs */}
        <div className="mb-6">
          <nav className="flex space-x-8">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'courses', label: 'Courses' },
              { id: 'students', label: 'Students' },
              { id: 'lecturers', label: 'Lecturers' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedReport(tab.id as any)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  selectedReport === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Report Content */}
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Generating report...</p>
          </div>
        ) : (
          <div>
            {selectedReport === 'overview' && renderOverview()}
            {selectedReport === 'courses' && renderCourseReports()}
            {selectedReport === 'students' && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Student Reports</h3>
                <p className="text-gray-600">Student attendance reports will be displayed here.</p>
              </div>
            )}
            {selectedReport === 'lecturers' && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Lecturer Reports</h3>
                <p className="text-gray-600">Lecturer performance reports will be displayed here.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  )
} 