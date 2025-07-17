from django.urls import path
from . import views

urlpatterns = [
    # College and Department endpoints
    path('colleges/', views.CollegeListCreateView.as_view(), name='college-list-create'),
    path('colleges/<int:pk>/', views.CollegeDetailView.as_view(), name='college-detail'),
    path('departments/', views.DepartmentListCreateView.as_view(), name='department-list-create'),
    path('departments/<int:pk>/', views.DepartmentDetailView.as_view(), name='department-detail'),
    
    # Course management endpoints
    path('courses/', views.CourseListCreateView.as_view(), name='course-list-create'),
    path('courses/<int:pk>/', views.CourseDetailView.as_view(), name='course-detail'),
    
    # Course assignment endpoints
    path('assignments/', views.CourseAssignmentListCreateView.as_view(), name='assignment-list-create'),
    path('assignments/<int:pk>/', views.CourseAssignmentDetailView.as_view(), name='assignment-detail'),
    
    # Enrollment endpoints
    path('enrollments/', views.EnrollmentListView.as_view(), name='enrollment-list'),
    path('enrollments/request/', views.EnrollmentRequestView.as_view(), name='enrollment-request'),
    path('enrollments/<int:pk>/process/', views.EnrollmentProcessView.as_view(), name='enrollment-process'),
    
    # Class session endpoints
    path('sessions/', views.ClassSessionListCreateView.as_view(), name='session-list-create'),
    path('sessions/<int:pk>/', views.ClassSessionDetailView.as_view(), name='session-detail'),
    
    # Attendance endpoints
    path('attendance/mark/', views.MarkClassAttendanceView.as_view(), name='mark-class-attendance'),
    path('attendance/session/<int:session_id>/', views.ClassAttendanceListView.as_view(), name='class-attendance-list'),
    
    # Notification endpoints
    path('notifications/', views.NotificationListView.as_view(), name='notification-list'),
    path('notifications/<int:pk>/read/', views.MarkNotificationReadView.as_view(), name='mark-notification-read'),
    
    # Dashboard endpoints
    path('dashboard/lecturer/', views.LecturerDashboardView.as_view(), name='lecturer-dashboard'),
    path('dashboard/student/', views.StudentDashboardView.as_view(), name='student-dashboard'),
    path('dashboard/admin/', views.AdminDashboardView.as_view(), name='admin-dashboard'),
] 