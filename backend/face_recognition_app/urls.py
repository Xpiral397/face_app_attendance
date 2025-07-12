from django.urls import path
from .views import (
    FaceRegistrationView,
    FaceRecognitionAttendanceView,
    FaceRecognitionVerifyView,
    FaceRecognitionStatsView,
    FaceRecognitionSettingsView,
    face_recognition_logs,
    validate_image_quality,
)

urlpatterns = [
    path('register/', FaceRegistrationView.as_view(), name='face-register'),
    path('attendance/', FaceRecognitionAttendanceView.as_view(), name='face-attendance'),
    path('verify/', FaceRecognitionVerifyView.as_view(), name='face-verify'),
    path('stats/', FaceRecognitionStatsView.as_view(), name='face-stats'),
    path('settings/', FaceRecognitionSettingsView.as_view(), name='face-settings'),
    path('logs/', face_recognition_logs, name='face-logs'),
    path('validate-image/', validate_image_quality, name='validate-image'),
] 