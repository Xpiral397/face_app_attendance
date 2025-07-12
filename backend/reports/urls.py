from django.urls import path
from .views import (
    GenerateReportView,
    DownloadReportView,
    UserAttendanceSummaryView,
    ReportListView,
    ReportStatsView,
    cleanup_old_reports,
    delete_report,
)

urlpatterns = [
    path('generate/', GenerateReportView.as_view(), name='generate-report'),
    path('download/<str:filename>/', DownloadReportView.as_view(), name='download-report'),
    path('summary/', UserAttendanceSummaryView.as_view(), name='user-attendance-summary'),
    path('summary/<int:user_id>/', UserAttendanceSummaryView.as_view(), name='user-attendance-summary-by-id'),
    path('list/', ReportListView.as_view(), name='report-list'),
    path('stats/', ReportStatsView.as_view(), name='report-stats'),
    path('cleanup/', cleanup_old_reports, name='cleanup-reports'),
    path('delete/<str:filename>/', delete_report, name='delete-report'),
] 