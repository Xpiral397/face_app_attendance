export interface User {
  id: number;
  email: string;
  username: string;
  full_name: string;
  role: 'admin' | 'student';
  student_id?: string;
  is_active: boolean;
  created_at: string;
}

export interface UserCreate {
  email: string;
  username: string;
  full_name: string;
  password: string;
  role: 'admin' | 'student';
  student_id?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthToken {
  access: string;
  refresh: string;
  user: User;
}

export interface Attendance {
  id: number;
  user_id: number;
  timestamp: string;
  status: 'present' | 'absent' | 'late';
  user_name: string;
  user_email: string;
  student_id?: string;
  notes?: string;
}

export interface AttendanceStats {
  total_days: number;
  present_days: number;
  absent_days: number;
  attendance_percentage: number;
  total_attendance: number;
} 