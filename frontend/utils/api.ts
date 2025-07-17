import { 
  LoginCredentials, 
  UserCreate, 
  PaginatedResponse, 
  Course, 
  College, 
  Department, 
  CourseAssignment, 
  Enrollment, 
  ClassSession, 
  ClassAttendance, 
  Notification, 
  AttendanceSession, 
  FaceRecognitionLog, 
  FaceDetectionSettings, 
  FaceRecognitionStats,
  ReportRequest,
  ReportFile,
  LecturerDashboardStats,
  StudentDashboardStats,
  AdminDashboardStats
} from '../types'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'

class ApiClient {
  private getAuthHeaders() {
    const token = localStorage.getItem('access_token')
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
    }
  }

  private async handleResponse(response: Response) {
    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.message || `HTTP error! status: ${response.status}`)
    }
    return response.json()
  }

  async get(endpoint: string) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: this.getAuthHeaders(),
    })
    return this.handleResponse(response)
  }

  async post(endpoint: string, data: any) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data),
    })
    return this.handleResponse(response)
  }

  async put(endpoint: string, data: any) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data),
    })
    return this.handleResponse(response)
  }

  async patch(endpoint: string, data: any) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PATCH',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data),
    })
    return this.handleResponse(response)
  }

  async delete(endpoint: string) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    })
    return this.handleResponse(response)
  }

  async uploadFile(endpoint: string, formData: FormData) {
    const token = localStorage.getItem('access_token')
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
      body: formData,
    })
    return this.handleResponse(response)
  }

  async downloadFile(endpoint: string): Promise<Blob> {
    const token = localStorage.getItem('access_token')
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
    })
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return response.blob()
  }
}

export const apiClient = new ApiClient()

// Authentication API
export const authApi = {
  login: (credentials: LoginCredentials) =>
    apiClient.post('/auth/login/', credentials),
  
  register: (userData: UserCreate) => 
    apiClient.post('/auth/register/', userData),
  
  logout: () => apiClient.post('/auth/logout/', {}),
  
  profile: () => apiClient.get('/auth/profile/'),
  
  updateProfile: (data: Partial<UserCreate>) => 
    apiClient.put('/auth/profile/', data),
  
  changePassword: (data: { old_password: string; new_password: string }) => 
    apiClient.post('/auth/change-password/', data),
}

// User Management API
export const userApi = {
  getUsers: (page = 1) => 
    apiClient.get(`/users/users/?page=${page}`),
  
  createUser: (userData: UserCreate) => 
    apiClient.post('/users/users/create/', userData),
  
  getUser: (id: number) => 
    apiClient.get(`/users/users/${id}/`),
  
  updateUser: (id: number, data: Partial<UserCreate>) => 
    apiClient.put(`/users/users/${id}/`, data),
  
  deleteUser: (id: number) => 
    apiClient.delete(`/users/users/${id}/`),
  
  getUserStats: () => 
    apiClient.get('/users/users/stats/'),
}

// Course Management API
export const courseApi = {
  // Colleges
  getColleges: (): Promise<College[]> => 
    apiClient.get('/courses/colleges/'),
  
  createCollege: (data: Partial<College>) => 
    apiClient.post('/courses/colleges/', data),
  
  updateCollege: (id: number, data: Partial<College>) => 
    apiClient.put(`/courses/colleges/${id}/`, data),
  
  deleteCollege: (id: number) => 
    apiClient.delete(`/courses/colleges/${id}/`),
  
  // Departments
  getDepartments: (): Promise<Department[]> => 
    apiClient.get('/courses/departments/'),
  
  createDepartment: (data: Partial<Department>) => 
    apiClient.post('/courses/departments/', data),
  
  updateDepartment: (id: number, data: Partial<Department>) => 
    apiClient.put(`/courses/departments/${id}/`, data),
  
  deleteDepartment: (id: number) => 
    apiClient.delete(`/courses/departments/${id}/`),
  
  // Courses
  getCourses: (params?: string): Promise<PaginatedResponse<Course>> => 
    apiClient.get(`/courses/courses/${params ? `?${params}` : ''}`),
  
  createCourse: (data: Partial<Course>) => 
    apiClient.post('/courses/courses/', data),
  
  getCourse: (id: number): Promise<Course> => 
    apiClient.get(`/courses/courses/${id}/`),
  
  updateCourse: (id: number, data: Partial<Course>) => 
    apiClient.put(`/courses/courses/${id}/`, data),
  
  deleteCourse: (id: number) => 
    apiClient.delete(`/courses/courses/${id}/`),
  
  // Course Assignments
  getAssignments: (params?: string): Promise<PaginatedResponse<CourseAssignment>> => 
    apiClient.get(`/courses/assignments/${params ? `?${params}` : ''}`),
  
  createAssignment: (data: Partial<CourseAssignment>) => 
    apiClient.post('/courses/assignments/', data),
  
  getAssignment: (id: number): Promise<CourseAssignment> => 
    apiClient.get(`/courses/assignments/${id}/`),
  
  updateAssignment: (id: number, data: Partial<CourseAssignment>) => 
    apiClient.put(`/courses/assignments/${id}/`, data),
  
  deleteAssignment: (id: number) => 
    apiClient.delete(`/courses/assignments/${id}/`),
}

// Enrollment API
export const enrollmentApi = {
  getEnrollments: (params?: string): Promise<PaginatedResponse<Enrollment>> => 
    apiClient.get(`/courses/enrollments/${params ? `?${params}` : ''}`),
  
  requestEnrollment: (courseAssignmentId: number) => 
    apiClient.post('/courses/enrollments/request/', { course_assignment_id: courseAssignmentId }),
  
  processEnrollment: (id: number, data: { action: 'approve' | 'reject'; notes?: string }) => 
    apiClient.post(`/courses/enrollments/${id}/process/`, data),
}

// Class Session API
export const sessionApi = {
  getSessions: (params?: string): Promise<PaginatedResponse<ClassSession>> => 
    apiClient.get(`/courses/sessions/${params ? `?${params}` : ''}`),
  
  createSession: (data: Partial<ClassSession>) => 
    apiClient.post('/courses/sessions/', data),
  
  getSession: (id: number): Promise<ClassSession> => 
    apiClient.get(`/courses/sessions/${id}/`),
  
  updateSession: (id: number, data: Partial<ClassSession>) => 
    apiClient.put(`/courses/sessions/${id}/`, data),
  
  deleteSession: (id: number) => 
    apiClient.delete(`/courses/sessions/${id}/`),
  
  // Class Attendance
  markClassAttendance: (data: { session_id: number; status?: string }) => 
    apiClient.post('/courses/attendance/mark/', data),
  
  getClassAttendance: (sessionId: number): Promise<PaginatedResponse<ClassAttendance>> => 
    apiClient.get(`/courses/attendance/session/${sessionId}/`),
}

// Notification API
export const notificationApi = {
  getNotifications: (params?: string): Promise<PaginatedResponse<Notification>> => 
    apiClient.get(`/courses/notifications/${params ? `?${params}` : ''}`),
  
  markAsRead: (id: number) => 
    apiClient.post(`/courses/notifications/${id}/read/`, {}),
}

// Dashboard API
export const dashboardApi = {
  getAdminDashboard: (): Promise<AdminDashboardStats> => 
    apiClient.get('/dashboard/admin/'),
  
  getLecturerDashboard: (): Promise<LecturerDashboardStats> => 
    apiClient.get('/dashboard/lecturer/'),
  
  getStudentDashboard: (): Promise<StudentDashboardStats> => 
    apiClient.get('/dashboard/student/'),
    
  // Fallback API calls for basic stats
  getAdminStats: () => apiClient.get('/dashboard/admin/'),
  getLecturerStats: () => apiClient.get('/dashboard/lecturer/'),
  getStudentStats: () => apiClient.get('/dashboard/student/'),
}

// Basic Attendance API (existing)
export const attendanceApi = {
  getAttendance: (page = 1) => apiClient.get(`/attendance/?page=${page}`),
  
  markAttendance: (data: { status: string; timestamp: string }) =>
    apiClient.post('/attendance/create/', data),
  
  getStats: () => apiClient.get('/attendance/stats/'),
  
  getDashboardStats: () => apiClient.get('/attendance/dashboard-stats/'),
  
  markAttendanceWithFace: (formData: FormData) =>
    apiClient.uploadFile('/face/attendance/', formData),
  
  // Advanced Attendance Features
  getSessions: (params?: string): Promise<PaginatedResponse<AttendanceSession>> => 
    apiClient.get(`/attendance/sessions/${params ? `?${params}` : ''}`),
  
  createSession: (data: Partial<AttendanceSession>) => 
    apiClient.post('/attendance/sessions/', data),
  
  getSession: (id: number): Promise<AttendanceSession> => 
    apiClient.get(`/attendance/sessions/${id}/`),
  
  updateSession: (id: number, data: Partial<AttendanceSession>) => 
    apiClient.put(`/attendance/sessions/${id}/`, data),
  
  deleteSession: (id: number) => 
    apiClient.delete(`/attendance/sessions/${id}/`),
  
  getAnalytics: (params?: string) => 
    apiClient.get(`/attendance/analytics/${params ? `?${params}` : ''}`),
  
  bulkAttendance: (data: any) => 
    apiClient.post('/attendance/bulk/', data),
}

// Face Recognition API
export const faceApi = {
  registerFace: (formData: FormData) =>
    apiClient.uploadFile('/face/register/', formData),
  
  verifyFace: (formData: FormData) =>
    apiClient.uploadFile('/face/verify/', formData),
  
  getLogs: (params?: string): Promise<PaginatedResponse<FaceRecognitionLog>> => 
    apiClient.get(`/face/logs/${params ? `?${params}` : ''}`),
  
  getStats: (): Promise<FaceRecognitionStats> => 
    apiClient.get('/face/stats/'),
  
  getSettings: (): Promise<FaceDetectionSettings> => 
    apiClient.get('/face/settings/'),
  
  updateSettings: (data: Partial<FaceDetectionSettings>) => 
    apiClient.post('/face/settings/', data),
  
  validateImageQuality: (formData: FormData) =>
    apiClient.uploadFile('/face/validate-quality/', formData),
}

// Reports API
export const reportsApi = {
  generateReport: (data: ReportRequest) => 
    apiClient.post('/reports/generate/', data),
  
  downloadReport: (filename: string): Promise<Blob> => 
    apiClient.downloadFile(`/reports/download/${filename}/`),
  
  getReports: (): Promise<ReportFile[]> => 
    apiClient.get('/reports/list/'),
  
  deleteReport: (filename: string) => 
    apiClient.delete(`/reports/delete/${filename}/`),
  
  getReportStats: () => 
    apiClient.get('/reports/stats/'),
  
  getUserAttendanceSummary: (userId?: number) => 
    apiClient.get(`/reports/user-summary/${userId ? `${userId}/` : ''}`),
  
  cleanupOldReports: () => 
    apiClient.delete('/reports/cleanup/'),
} 