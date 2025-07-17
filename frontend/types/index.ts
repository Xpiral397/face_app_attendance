export interface User {
  id: number;
  email: string;
  username: string;
  full_name: string;
  role: 'admin' | 'lecturer' | 'student';
  student_id?: string;
  lecturer_id?: string;
  department?: Department;
  level?: '100' | '200' | '300' | '400' | '500';
  is_active: boolean;
  created_at: string;
}

export interface UserCreate {
  email: string;
  username: string;
  full_name: string;
  password: string;
  role: 'admin' | 'lecturer' | 'student';
  student_id?: string;
  lecturer_id?: string;
  department?: number;
  level?: '100' | '200' | '300' | '400' | '500';
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

// Course Management Types
export interface College {
  results: {
    id: number;
  name: string;
  code: string;
  description: string;
  is_active: boolean;
  created_at: string;
 }
}

export interface Department {
  results: {
    id: number;
  name: string;
  code: string;
  college: College;
  description: string;
  is_active: boolean;
  created_at: string;
}
}

export interface Course {
  id: number;
  code: string;
  title: string;
  description: string;
  department: Department;
  level: '100' | '200' | '300' | '400' | '500';
  credit_units: number;
  is_active: boolean;
  created_by: User;
  created_at: string;
}

export interface CourseAssignment {
  id: number;
  course: Course;
  lecturer: User;
  academic_year: string;
  semester: string;
  is_active: boolean;
  assigned_by: User;
  assigned_at: string;
}

export interface Enrollment {
  id: number;
  student: User;
  course_assignment: CourseAssignment;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  requested_at: string;
  processed_at?: string;
  processed_by?: User;
  notes?: string;
}

export interface ClassSession {
  id: number;
  course_assignment: CourseAssignment;
  title: string;
  description: string;
  class_type: 'physical' | 'virtual' | 'hybrid';
  scheduled_date: string;
  start_time: string;
  end_time: string;
  venue?: string;
  virtual_link?: string;
  attendance_window_start: string;
  attendance_window_end: string;
  is_recurring: boolean;
  recurrence_pattern?: string;
  is_active: boolean;
  created_at: string;
  is_attendance_open?: boolean;
}

export interface ClassAttendance {
  id: number;
  class_session: ClassSession;
  student: User;
  status: 'present' | 'absent' | 'late' | 'excused';
  marked_at: string;
  face_verified: boolean;
  location?: string;
  notes?: string;
}

export interface Notification {
  id: number;
  recipient: User;
  sender: User;
  notification_type: 'enrollment_request' | 'enrollment_approved' | 'enrollment_rejected' | 'class_scheduled' | 'class_updated' | 'class_cancelled' | 'assignment_created' | 'general';
  title: string;
  message: string;
  is_read: boolean;
  related_enrollment?: Enrollment;
  related_class_session?: ClassSession;
  created_at: string;
}

// Attendance Types (existing, keeping for compatibility)
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
  late_days: number;
  attendance_percentage: number;
  total_attendance: number;
}

export interface AttendanceSession {
  id: number;
  name: string;
  start_time: string;
  end_time: string;
  is_active: boolean;
  created_by: User;
  created_at: string;
  duration?: number;
}

// Face Recognition Types
export interface FaceEncoding {
  id: number;
  user: User;
  encoding: number[];
  image?: string;
  confidence_score: number;
  quality_score: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FaceRecognitionLog {
  id: number;
  user: User;
  status: 'success' | 'failed' | 'no_face' | 'multiple_faces' | 'poor_quality';
  confidence_score: number;
  image?: string;
  ip_address?: string;
  user_agent?: string;
  timestamp: string;
}

export interface FaceDetectionSettings {
  id: number;
  tolerance: number;
  min_face_size: number;
  max_file_size: number;
  allowed_formats: string[];
  quality_threshold: number;
  blur_threshold: number;
  brightness_min: number;
  brightness_max: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FaceRecognitionStats {
  id: number;
  user: User;
  total_attempts: number;
  successful_recognitions: number;
  failed_recognitions: number;
  success_rate: number;
  last_recognition?: string;
  last_updated: string;
}

// Dashboard Types
export interface DashboardStats {
  total_users: number;
  total_attendance_today: number;
  present_today: number;
  absent_today: number;
  late_today: number;
  attendance_percentage_today: number;
  total_sessions: number;
  active_sessions: number;
}

export interface LecturerDashboardStats {
  total_assignments: number;
  active_assignments: number;
  total_students: number;
  total_classes_today: number;
  upcoming_classes: ClassSession[];
  recent_attendances: ClassAttendance[];
}

export interface StudentDashboardStats {
  enrolled_courses: number;
  classes_today: number;
  attendance_rate: number;
  upcoming_classes: ClassSession[];
  recent_notifications: Notification[];
}

export interface AdminDashboardStats {
  total_users: number;
  total_courses: number;
  total_departments: number;
  total_enrollments: number;
  recent_enrollments: Enrollment[];
  system_stats: any;
}

// Report Types
export interface ReportRequest {
  format: 'pdf' | 'csv' | 'xlsx';
  user_id?: number;
  start_date?: string;
  end_date?: string;
  status?: string;
}

export interface ReportFile {
  filename: string;
  created_at: string;
  size: number;
  format: string;
}

// API Response Types
export interface PaginatedResponse<T> {
  count: number;
  next?: string;
  previous?: string;
  results: T[];
}

export interface ApiError {
  message: string;
  field?: string;
  code?: string;
} 