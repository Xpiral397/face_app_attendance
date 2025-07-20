'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { apiClient } from '../../utils/api'
import AppLayout from '../../components/AppLayout'

interface Lecturer {
  id: number
  full_name: string
  email: string
  lecturer_id: string
  department?: {
    id: number
    name: string
    code: string
  }
  courses: Course[]
  total_students: number
  active_sessions: number
}

interface Course {
  id: number
  code: string
  title: string
  level: string
  credit_units: number
  department: {
    id: number
    name: string
    code: string
    college: {
      id: number
      name: string
      code: string
    }
  }
  enrollment_count: number
}

interface Node {
  id: string
  x: number
  y: number
  type: 'lecturer' | 'course'
  data: Lecturer | Course
  color: string
}

interface Connection {
  from: string
  to: string
}

export default function LecturerManagementPage() {
  const [lecturers, setLecturers] = useState<Lecturer[]>([])
  const [selectedLecturer, setSelectedLecturer] = useState<Lecturer | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [nodes, setNodes] = useState<Node[]>([])
  const [connections, setConnections] = useState<Connection[]>([])
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const { user, isAdmin, isLecturer } = useAuth()

  useEffect(() => {
    if (isAdmin || isLecturer) {
      fetchLecturers()
    }
  }, [isAdmin, isLecturer])

  useEffect(() => {
    if (selectedLecturer) {
      generateGraph(selectedLecturer)
    }
  }, [selectedLecturer])

  useEffect(() => {
    if (nodes.length > 0) {
      drawGraph()
    }
  }, [nodes, connections])

  const fetchLecturers = async () => {
    try {
      setLoading(true)
      const response = await apiClient.get('/auth/users/?role=lecturer')
      const lecturersData = response?.results || response || []
      
      // Fetch detailed data for each lecturer including their courses
      const lecturersWithCourses = await Promise.all(
        lecturersData.map(async (lecturer: any) => {
          try {
            const assignmentsResponse = await apiClient.get(`/courses/course-assignments/?lecturer=${lecturer.id}`)
            const assignments = assignmentsResponse?.results || assignmentsResponse || []
            
            const courses = assignments.map((assignment: any) => assignment.course)
            
            return {
              ...lecturer,
              courses,
              total_students: courses.reduce((acc: number, course: Course) => acc + (course.enrollment_count || 0), 0),
              active_sessions: courses.length
            }
          } catch (error) {
            console.error(`Error fetching data for lecturer ${lecturer.id}:`, error)
            return {
              ...lecturer,
              courses: [],
              total_students: 0,
              active_sessions: 0
            }
          }
        })
      )
      
      setLecturers(lecturersWithCourses)
    } catch (error) {
      console.error('Error fetching lecturers:', error)
      setError('Failed to load lecturers')
    } finally {
      setLoading(false)
    }
  }

  const generateGraph = (lecturer: Lecturer) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const centerX = canvas.width / 2
    const centerY = canvas.height / 2
    const radius = 150

    // Create lecturer node (center)
    const lecturerNode: Node = {
      id: `lecturer-${lecturer.id}`,
      x: centerX,
      y: centerY,
      type: 'lecturer',
      data: lecturer,
      color: '#3b82f6'
    }

    // Create course nodes (around the lecturer)
    const courseNodes: Node[] = lecturer.courses.map((course, index) => {
      const angle = (2 * Math.PI * index) / lecturer.courses.length
      const x = centerX + radius * Math.cos(angle)
      const y = centerY + radius * Math.sin(angle)

      return {
        id: `course-${course.id}`,
        x,
        y,
        type: 'course',
        data: course,
        color: '#10b981'
      }
    })

    // Create connections
    const newConnections: Connection[] = lecturer.courses.map(course => ({
      from: `lecturer-${lecturer.id}`,
      to: `course-${course.id}`
    }))

    setNodes([lecturerNode, ...courseNodes])
    setConnections(newConnections)
  }

  const drawGraph = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Draw connections
    ctx.strokeStyle = '#e5e7eb'
    ctx.lineWidth = 2
    connections.forEach(connection => {
      const fromNode = nodes.find(n => n.id === connection.from)
      const toNode = nodes.find(n => n.id === connection.to)
      
      if (fromNode && toNode) {
        ctx.beginPath()
        ctx.moveTo(fromNode.x, fromNode.y)
        ctx.lineTo(toNode.x, toNode.y)
        ctx.stroke()
      }
    })

    // Draw nodes
    nodes.forEach(node => {
      // Draw node circle
      ctx.fillStyle = node.color
      ctx.beginPath()
      ctx.arc(node.x, node.y, node.type === 'lecturer' ? 40 : 25, 0, 2 * Math.PI)
      ctx.fill()

      // Draw node border
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 3
      ctx.stroke()

      // Draw text
      ctx.fillStyle = '#ffffff'
      ctx.font = node.type === 'lecturer' ? 'bold 12px Arial' : '10px Arial'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      
      if (node.type === 'lecturer') {
        const lecturer = node.data as Lecturer
        ctx.fillText(lecturer.full_name.split(' ')[0], node.x, node.y - 5)
        ctx.fillText(lecturer.lecturer_id, node.x, node.y + 8)
      } else {
        const course = node.data as Course
        ctx.fillText(course.code, node.x, node.y)
      }
    })
  }

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    // Check if click is on a node
    const clickedNode = nodes.find(node => {
      const distance = Math.sqrt((x - node.x) ** 2 + (y - node.y) ** 2)
      return distance <= (node.type === 'lecturer' ? 40 : 25)
    })

    if (clickedNode && clickedNode.type === 'course') {
      const course = clickedNode.data as Course
      alert(`Course: ${course.code} - ${course.title}\nLevel: ${course.level}\nDepartment: ${course.department.name}\nEnrollment: ${course.enrollment_count || 0} students`)
    }
  }

  const filteredLecturers = lecturers.filter(lecturer =>
    lecturer.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lecturer.lecturer_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lecturer.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (!isAdmin && !isLecturer) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto p-6">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <h3 className="text-lg font-medium text-red-800">Access Denied</h3>
            <p className="text-red-700 mt-2">Only administrators and lecturers can view lecturer management.</p>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Lecturer Management</h1>
          <p className="text-gray-600 mt-2">Manage lecturers and visualize their course assignments</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Lecturer List */}
          <div className="lg:col-span-1">
            <div className="bg-white shadow-sm rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Lecturers</h3>
                <div className="mt-2">
                  <input
                    type="text"
                    placeholder="Search lecturers..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="max-h-96 overflow-y-auto">
                {loading ? (
                  <div className="p-6 text-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-2 text-sm text-gray-500">Loading lecturers...</p>
                  </div>
                ) : filteredLecturers.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">
                    No lecturers found.
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {filteredLecturers.map((lecturer) => (
                      <div
                        key={lecturer.id}
                        className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                          selectedLecturer?.id === lecturer.id ? 'bg-blue-50 border-r-4 border-blue-500' : ''
                        }`}
                        onClick={() => setSelectedLecturer(lecturer)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{lecturer.full_name}</div>
                            <div className="text-sm text-gray-500">{lecturer.lecturer_id}</div>
                            <div className="text-xs text-gray-400">{lecturer.department?.name || 'No Department'}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium text-blue-600">{lecturer.courses.length}</div>
                            <div className="text-xs text-gray-500">courses</div>
                          </div>
                        </div>
                        <div className="mt-2 flex justify-between text-xs text-gray-500">
                          <span>{lecturer.total_students} students</span>
                          <span>{lecturer.email}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Graph Visualization */}
          <div className="lg:col-span-2">
            <div className="bg-white shadow-sm rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">
                  {selectedLecturer ? `Course Network: ${selectedLecturer.full_name}` : 'Course Network'}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {selectedLecturer 
                    ? `Click on course nodes to view details. ${selectedLecturer.courses.length} courses assigned.`
                    : 'Select a lecturer to view their course network'
                  }
                </p>
              </div>

              <div className="p-6">
                {selectedLecturer ? (
                  <div>
                    <canvas
                      ref={canvasRef}
                      width={600}
                      height={400}
                      className="border border-gray-200 rounded cursor-pointer"
                      onClick={handleCanvasClick}
                    />
                    
                    {/* Legend */}
                    <div className="mt-4 flex justify-center space-x-6">
                      <div className="flex items-center">
                        <div className="w-4 h-4 bg-blue-500 rounded-full mr-2"></div>
                        <span className="text-sm text-gray-600">Lecturer</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-4 h-4 bg-green-500 rounded-full mr-2"></div>
                        <span className="text-sm text-gray-600">Course</span>
                      </div>
                    </div>

                    {/* Course Details */}
                    {selectedLecturer.courses.length > 0 && (
                      <div className="mt-6">
                        <h4 className="text-sm font-medium text-gray-900 mb-3">Course Details</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {selectedLecturer.courses.map((course) => (
                            <div key={course.id} className="bg-gray-50 p-3 rounded-md">
                              <div className="text-sm font-medium text-gray-900">{course.code}</div>
                              <div className="text-sm text-gray-600">{course.title}</div>
                              <div className="text-xs text-gray-500 mt-1">
                                {course.level} Level • {course.credit_units} Units • {course.enrollment_count || 0} Students
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-64 text-gray-500">
                    <div className="text-center">
                      <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                      </svg>
                      <h3 className="mt-2 text-sm font-medium text-gray-900">No lecturer selected</h3>
                      <p className="mt-1 text-sm text-gray-500">Choose a lecturer from the list to view their course network</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
} 