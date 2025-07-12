from django.urls import path
from .views import (
    AttendanceListView,
    AttendanceCreateView,
    AttendanceDetailView,
    AttendanceStatsView,
    AttendanceAnalyticsView,
    BulkAttendanceView,
    AttendanceSessionListView,
    AttendanceSessionDetailView,
    dashboard_stats,
)

urlpatterns = [
    path('', AttendanceListView.as_view(), name='attendance-list'),
    path('create/', AttendanceCreateView.as_view(), name='attendance-create'),
    path('<int:pk>/', AttendanceDetailView.as_view(), name='attendance-detail'),
    path('stats/', AttendanceStatsView.as_view(), name='attendance-stats'),
    path('analytics/', AttendanceAnalyticsView.as_view(), name='attendance-analytics'),
    path('bulk/', BulkAttendanceView.as_view(), name='bulk-attendance'),
    path('sessions/', AttendanceSessionListView.as_view(), name='attendance-session-list'),
    path('sessions/<int:pk>/', AttendanceSessionDetailView.as_view(), name='attendance-session-detail'),
    path('dashboard-stats/', dashboard_stats, name='dashboard-stats'),
] 