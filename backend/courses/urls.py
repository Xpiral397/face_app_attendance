from django.urls import path
from . import views

urlpatterns = [
    # College and Department URLs
    path('colleges/', views.CollegeListCreateView.as_view(), name='college-list-create'),
    path('colleges/<int:pk>/', views.CollegeDetailView.as_view(), name='college-detail'),
    path('departments/', views.DepartmentListCreateView.as_view(), name='department-list-create'),
    path('departments/<int:pk>/', views.DepartmentDetailView.as_view(), name='department-detail'),
    
    # Room Management URLs
    path('rooms/', views.RoomListCreateView.as_view(), name='room-list-create'),
    path('rooms/<int:pk>/', views.RoomDetailView.as_view(), name='room-detail'),
    path('rooms/check-availability/', views.check_room_availability, name='check-room-availability'),
    
    # Course URLs
    path('courses/', views.CourseListCreateView.as_view(), name='course-list-create'),
    path('courses/<int:pk>/', views.CourseDetailView.as_view(), name='course-detail'),
    
    # Course Assignment URLs
    path('course-assignments/', views.CourseAssignmentListCreateView.as_view(), name='course-assignment-list-create'),
    path('course-assignments/<int:pk>/', views.CourseAssignmentDetailView.as_view(), name='course-assignment-detail'),
    path('course-assignments/available-courses/', views.available_courses_for_assignment, name='available-courses'),
    path('course-assignments/lecturer-workload/', views.lecturer_workload, name='lecturer-workload'),
    
    # Lecturers endpoint for course management
    path('lecturers/', views.LecturerListView.as_view(), name='lecturer-list'),
    
    # Session Management URLs
    path('sessions/', views.ClassSessionListCreateView.as_view(), name='session-list-create'),
    path('sessions/<int:pk>/', views.ClassSessionDetailView.as_view(), name='session-detail'),
    path('sessions/check-conflicts/', views.check_session_conflicts, name='check-session-conflicts'),
    path('sessions/suggest-times/', views.suggest_optimal_times, name='suggest-optimal-times'),
    path('lecturer-free-times/', views.lecturer_free_times, name='lecturer-free-times'),
    
    # Enrollment URLs
    path('enrollments/', views.EnrollmentListCreateView.as_view(), name='enrollment-list-create'),
    path('enrollments/<int:pk>/', views.EnrollmentDetailView.as_view(), name='enrollment-detail'),
    path('enrollments/my-enrollments/', views.my_enrollments, name='my-enrollments'),
    path('enrollments/import-department/', views.import_department_students, name='import-department-students'),
    
    # Notification URLs
    path('notifications/', views.NotificationListView.as_view(), name='notification-list'),
    path('notifications/<int:pk>/', views.NotificationDetailView.as_view(), name='notification-detail'),
    path('notifications/mark-read/', views.mark_notifications_read, name='mark-notifications-read'),
    
    # Analytics and Reports
    path('analytics/enrollment-stats/', views.enrollment_statistics, name='enrollment-stats'),
    path('analytics/course-popularity/', views.course_popularity, name='course-popularity'),
    path('analytics/lecturer-workload/', views.lecturer_workload_analytics, name='lecturer-workload-analytics'),
    
    # PDF Reports
    path('attendance/download-report/', views.download_attendance_report, name='download-attendance-report'),
    path('attendance/download-student-report/', views.download_student_attendance_report, name='download-student-attendance-report'),
    path('attendance/download-comprehensive/', views.download_comprehensive_attendance_report, name='download-comprehensive-attendance-report'),
    
    # Lecturer Attendance Analytics
    path('attendance/lecturer-history/', views.lecturer_attendance_history, name='lecturer-attendance-history'),
    path('attendance/lecturer-stats/', views.lecturer_attendance_stats, name='lecturer-attendance-stats'),
    path('attendance/course-stats/', views.course_attendance_stats, name='course-attendance-stats'),
    path('attendance/student-stats/', views.student_attendance_stats, name='student-attendance-stats'),
    path('attendance/daily-stats/', views.daily_attendance_stats, name='daily-attendance-stats'),
    # Student Attendance
    path('attendance/', views.StudentAttendanceCreateView.as_view(), name='student-attendance'),
    path('attendance/history/', views.StudentAttendanceCreateView.as_view(), name='student-attendance-history'),
] 