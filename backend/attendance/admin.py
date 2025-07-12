from django.contrib import admin
from .models import Attendance, AttendanceStats, AttendanceSession

@admin.register(Attendance)
class AttendanceAdmin(admin.ModelAdmin):
    list_display = ['user', 'timestamp', 'status', 'created_at']
    list_filter = ['status', 'timestamp', 'created_at']
    search_fields = ['user__full_name', 'user__email', 'user__student_id']
    ordering = ['-timestamp']
    readonly_fields = ['created_at', 'updated_at']

@admin.register(AttendanceStats)
class AttendanceStatsAdmin(admin.ModelAdmin):
    list_display = ['user', 'total_days', 'present_days', 'attendance_percentage', 'last_updated']
    search_fields = ['user__full_name', 'user__email']
    readonly_fields = ['last_updated']

@admin.register(AttendanceSession)
class AttendanceSessionAdmin(admin.ModelAdmin):
    list_display = ['name', 'start_time', 'end_time', 'is_active', 'created_by']
    list_filter = ['is_active', 'start_time', 'created_at']
    search_fields = ['name', 'created_by__full_name'] 