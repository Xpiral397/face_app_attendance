from django.contrib import admin
from .models import (
    Faculty, Department, Course, CourseAssignment, 
    Enrollment, ClassSession, Notification, ClassAttendance
)

@admin.register(Faculty)
class FacultyAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'is_active', 'created_at']
    list_filter = ['is_active', 'created_at']
    search_fields = ['name', 'code']
    ordering = ['code']

@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'faculty', 'is_active', 'created_at']
    list_filter = ['faculty', 'is_active', 'created_at']
    search_fields = ['name', 'code', 'faculty__name']
    ordering = ['code']

@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ['code', 'title', 'department', 'level', 'credit_units', 'is_active']
    list_filter = ['department', 'level', 'is_active', 'created_at']
    search_fields = ['code', 'title', 'department__name']
    ordering = ['code']
    readonly_fields = ['created_at']

@admin.register(CourseAssignment)
class CourseAssignmentAdmin(admin.ModelAdmin):
    list_display = ['course', 'lecturer', 'academic_year', 'semester', 'is_active']
    list_filter = ['academic_year', 'semester', 'is_active', 'assigned_at']
    search_fields = ['course__code', 'lecturer__full_name', 'course__title']
    ordering = ['-assigned_at']
    readonly_fields = ['assigned_at']

@admin.register(Enrollment)
class EnrollmentAdmin(admin.ModelAdmin):
    list_display = ['student', 'course_assignment', 'status', 'requested_at', 'processed_at']
    list_filter = ['status', 'requested_at', 'processed_at']
    search_fields = ['student__full_name', 'course_assignment__course__code']
    ordering = ['-requested_at']
    readonly_fields = ['requested_at']

@admin.register(ClassSession)
class ClassSessionAdmin(admin.ModelAdmin):
    list_display = ['course_assignment', 'title', 'class_type', 'scheduled_date', 'start_time', 'is_active']
    list_filter = ['class_type', 'scheduled_date', 'is_active', 'is_recurring']
    search_fields = ['title', 'course_assignment__course__code']
    ordering = ['scheduled_date', 'start_time']
    readonly_fields = ['created_at']

@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ['title', 'recipient', 'sender', 'notification_type', 'is_read', 'created_at']
    list_filter = ['notification_type', 'is_read', 'created_at']
    search_fields = ['title', 'recipient__full_name', 'sender__full_name']
    ordering = ['-created_at']
    readonly_fields = ['created_at']

@admin.register(ClassAttendance)
class ClassAttendanceAdmin(admin.ModelAdmin):
    list_display = ['student', 'class_session', 'status', 'face_verified', 'marked_at']
    list_filter = ['status', 'face_verified', 'marked_at']
    search_fields = ['student__full_name', 'class_session__title']
    ordering = ['-marked_at']
    readonly_fields = ['marked_at'] 