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
  college_name?: string
  description: string
  is_active: boolean
  created_at: string
}

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [colleges, setColleges] = useState<College[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    college: ''
  })
  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({})
  const [selectedCollege, setSelectedCollege] = useState<string>('')

  const { user, isAdmin } = useAuth()

  useEffect(() => {
    if (isAdmin) {
      fetchColleges()
      fetchDepartments()
    }
  }, [isAdmin])

  const fetchColleges = async () => {
    try {
      const response = await apiClient.get('/courses/colleges/')
      setColleges(response.data || [])
    } catch (error) {
      console.error('Error fetching colleges:', error)
      setError('Failed to fetch colleges')
    }
  }

  const fetchDepartments = async () => {
    try {
      setLoading(true)
      const response = await apiClient.get('/courses/departments/')
      
      // Enrich departments with college names
      const departmentsData = response.data || []
      const enrichedDepartments = departmentsData.map((dept: Department) => {
        const college = colleges.find(c => c.id === dept.college)
        return {
          ...dept,
          college_name: college ? college.name : 'Unknown College'
        }
      })
      
      setDepartments(enrichedDepartments)
      setError('')
    } catch (error) {
      console.error('Error fetching departments:', error)
      setError('Failed to fetch departments')
    } finally {
      setLoading(false)
    }
  }

  // Refetch departments when colleges change
  useEffect(() => {
    if (colleges.length > 0) {
      fetchDepartments()
    }
  }, [colleges])

  const validateForm = () => {
    const errors: {[key: string]: string} = {}
    
    if (!formData.name.trim()) {
      errors.name = 'Department name is required'
    }
    
    if (!formData.college) {
      errors.college = 'College is required'
    }
    
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    
    if (!validateForm()) {
      return
    }

    try {
      const submitData = {
        ...formData,
        code: formData.name.substring(0, 10).toUpperCase().replace(/[^A-Z0-9]/g, ''),
        description: `${formData.name} department`,
        college: parseInt(formData.college)
      }

      if (editingDepartment) {
        // Update existing department
        await apiClient.put(`/courses/departments/${editingDepartment.id}/`, submitData)
        setSuccess('Department updated successfully')
      } else {
        // Create new department
        await apiClient.post('/courses/departments/', submitData)
        setSuccess('Department created successfully')
      }
      
      fetchDepartments()
      resetForm()
      setShowModal(false)
    } catch (error: any) {
      console.error('Error saving department:', error)
      setError(error.response?.data?.message || 'Failed to save department')
    }
  }

  const handleEdit = (department: Department) => {
    setEditingDepartment(department)
    setFormData({
      name: department.name,
      college: department.college.toString()
    })
    setShowModal(true)
  }

  const handleDelete = async (departmentId: number) => {
    if (!confirm('Are you sure you want to delete this department? This action cannot be undone.')) {
      return
    }

    try {
      await apiClient.delete(`/courses/departments/${departmentId}/`)
      setSuccess('Department deleted successfully')
      fetchDepartments()
    } catch (error: any) {
      console.error('Error deleting department:', error)
      setError(error.response?.data?.message || 'Failed to delete department')
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      college: ''
    })
    setFormErrors({})
    setEditingDepartment(null)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    
    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: ''
      }))
    }
  }

  const filteredDepartments = selectedCollege 
    ? departments.filter(dept => dept.college.toString() === selectedCollege)
    : departments

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto p-6">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <h3 className="text-lg font-medium text-red-800">Access Denied</h3>
            <p className="text-red-700 mt-2">Only administrators can manage departments.</p>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Departments Management</h1>
          <p className="text-gray-600 mt-2">Manage departments under colleges and faculties</p>
        </div>

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

        {/* Controls */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => {
                resetForm()
                setShowModal(true)
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors flex items-center"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add New Department
            </button>
          </div>
          
          <div className="flex items-center space-x-4">
            <label htmlFor="college-filter" className="text-sm font-medium text-gray-700">
              Filter by College:
            </label>
            <select
              id="college-filter"
              value={selectedCollege}
              onChange={(e) => setSelectedCollege(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Colleges</option>
              {colleges.map((college) => (
                <option key={college.id} value={college.id}>
                  {college.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Departments Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Departments List {selectedCollege && `(${colleges.find(c => c.id.toString() === selectedCollege)?.name})`}
            </h2>
          </div>
          
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading departments...</p>
            </div>
          ) : filteredDepartments.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <p>{selectedCollege ? 'No departments found for this college.' : 'No departments found. Create your first department to get started.'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Code
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      College
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredDepartments.map((department) => (
                    <tr key={department.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-gray-900">{department.code}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">{department.name}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-600">{department.college_name}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-600">{department.description || '-'}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          department.is_active 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {department.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-600">
                          {new Date(department.created_at).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleEdit(department)}
                          className="text-blue-600 hover:text-blue-900 mr-3"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(department.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  {editingDepartment ? 'Edit Department' : 'Add New Department'}
                </h3>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                      Department Name
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        formErrors.name ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="Enter department name"
                    />
                    {formErrors.name && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.name}</p>
                    )}
                  </div>



                  <div>
                    <label htmlFor="college" className="block text-sm font-medium text-gray-700 mb-1">
                      College
                    </label>
                    <select
                      id="college"
                      name="college"
                      value={formData.college}
                      onChange={handleChange}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        formErrors.college ? 'border-red-300' : 'border-gray-300'
                      }`}
                    >
                      <option value="">Select a college</option>
                      {colleges.map((college) => (
                        <option key={college.id} value={college.id}>
                          {college.name}
                        </option>
                      ))}
                    </select>
                    {formErrors.college && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.college}</p>
                    )}
                  </div>



                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                    >
                      {editingDepartment ? 'Update' : 'Create'}
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