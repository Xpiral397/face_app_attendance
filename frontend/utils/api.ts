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
}

export const apiClient = new ApiClient()

// Specific API functions
export const authApi = {
  login: (credentials: { email: string; password: string }) =>
    apiClient.post('/auth/login/', credentials),
  
  register: (userData: {
    email: string
    username: string
    full_name: string
    password: string
    confirm_password: string
    role: 'admin' | 'student'
    student_id?: string
  }) => apiClient.post('/auth/register/', userData),
  
  logout: () => apiClient.post('/auth/logout/', {}),
}

export const attendanceApi = {
  getAttendance: (page = 1) => apiClient.get(`/attendance/?page=${page}`),
  
  markAttendance: (data: { status: string; timestamp: string }) =>
    apiClient.post('/attendance/create/', data),
  
  getStats: () => apiClient.get('/attendance/stats/'),
  
  getDashboardStats: () => apiClient.get('/attendance/dashboard-stats/'),
  
  markAttendanceWithFace: (formData: FormData) =>
    apiClient.uploadFile('/face/attendance/', formData),
}

export const faceApi = {
  registerFace: (formData: FormData) =>
    apiClient.uploadFile('/face/register/', formData),
  
  verifyFace: (formData: FormData) =>
    apiClient.uploadFile('/face/verify/', formData),
  
  getFaceStats: () => apiClient.get('/face/stats/'),
}

export const userApi = {
  getProfile: () => apiClient.get('/auth/profile/'),
  
  updateProfile: (data: any) => apiClient.put('/auth/profile/', data),
  
  getUsers: () => apiClient.get('/auth/users/'),
  
  createUser: (userData: any) => apiClient.post('/auth/users/create/', userData),
  
  getCurrentUser: () => apiClient.get('/auth/profile/'),
} 