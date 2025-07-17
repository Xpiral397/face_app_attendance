from django.contrib import admin
from .models import (
    College, Department, Course, CourseAssignment, 
    Enrollment, ClassSession, Notification, ClassAttendance
)

@admin.register(College)
class CollegeAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'is_active', 'created_at']
    list_filter = ['is_active', 'created_at']
    search_fields = ['name', 'code']
    readonly_fields = ['created_at']

@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'college', 'is_active', 'created_at']
    list_filter = ['college', 'is_active', 'created_at']
    search_fields = ['name', 'code', 'college__name']
    readonly_fields = ['created_at']

@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ['code', 'title', 'department', 'level', 'credit_units', 'is_active', 'created_at']
    list_filter = ['department', 'level', 'is_active', 'created_at']
    search_fields = ['code', 'title', 'department__name']
    readonly_fields = ['created_at']

@admin.register(CourseAssignment)
class CourseAssignmentAdmin(admin.ModelAdmin):
    list_display = ['course', 'lecturer', 'academic_year', 'semester', 'is_active', 'assigned_at']
    list_filter = ['academic_year', 'semester', 'is_active', 'assigned_at']
    search_fields = ['course__code', 'lecturer__full_name']
    readonly_fields = ['assigned_at']

@admin.register(Enrollment)
class EnrollmentAdmin(admin.ModelAdmin):
    list_display = ['student', 'course_assignment', 'status', 'requested_at', 'processed_at']
    list_filter = ['status', 'requested_at', 'processed_at']
    search_fields = ['student__full_name', 'course_assignment__course__code']
    readonly_fields = ['requested_at']

@admin.register(ClassSession)
class ClassSessionAdmin(admin.ModelAdmin):
    list_display = ['title', 'course_assignment', 'scheduled_date', 'start_time', 'end_time', 'class_type', 'is_active']
    list_filter = ['class_type', 'is_active', 'scheduled_date']
    search_fields = ['title', 'course_assignment__course__code']
    readonly_fields = ['created_at']

@admin.register(ClassAttendance)
class ClassAttendanceAdmin(admin.ModelAdmin):
    list_display = ['student', 'class_session', 'status', 'marked_at', 'face_verified']
    list_filter = ['status', 'face_verified', 'marked_at']
    search_fields = ['student__full_name', 'class_session__title']
    readonly_fields = ['marked_at']

@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ['recipient', 'sender', 'notification_type', 'title', 'is_read', 'created_at']
    list_filter = ['notification_type', 'is_read', 'created_at']
    search_fields = ['recipient__full_name', 'title']
    readonly_fields = ['created_at'] 