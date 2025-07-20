from django.urls import path
from . import views

urlpatterns = [
    path('register/', views.FaceRegistrationView.as_view(), name='face_register'),
    path('verify-attendance/', views.verify_attendance_face, name='verify_attendance_face'),
    path('registration-status/', views.face_registration_status, name='face_registration_status'),
    path('attendance/', views.FaceRecognitionAttendanceView.as_view(), name='face_attendance'),
    path('verify/', views.FaceRecognitionVerifyView.as_view(), name='face_verify'),
    path('stats/', views.FaceRecognitionStatsView.as_view(), name='face_stats'),
    path('settings/', views.FaceRecognitionSettingsView.as_view(), name='face_settings'),
    path('logs/', views.face_recognition_logs, name='face_logs'),
    path('validate-quality/', views.validate_image_quality, name='validate_image_quality'),
    path('departments-with-faces/', views.departments_with_faces, name='departments_with_faces'),
] 