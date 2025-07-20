from django.contrib import admin
from .models import College, Department, Course, CourseAssignment, Enrollment, ClassSession, Notification, ClassAttendance, Room

@admin.register(College)
class CollegeAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'is_active', 'created_at']
    list_filter = ['is_active', 'created_at']
    search_fields = ['name', 'code']
    readonly_fields = ['created_at']

@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'college', 'is_active', 'created_at']
    list_filter = ['college', 'is_active', 'created_at']
    search_fields = ['name', 'code', 'college__name']
    readonly_fields = ['created_at']

@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'room_type', 'capacity', 'building', 'is_available', 'created_at']
    list_filter = ['room_type', 'is_available', 'building', 'virtual_platform', 'created_at']
    search_fields = ['name', 'code', 'building']
    readonly_fields = ['created_at', 'created_by']
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('name', 'code', 'room_type', 'capacity', 'is_available')
        }),
        ('Physical Room Details', {
            'fields': ('building', 'floor', 'facilities'),
            'classes': ('collapse',),
        }),
        ('Virtual Room Details', {
            'fields': ('virtual_platform', 'default_meeting_link', 'meeting_id', 'passcode'),
            'classes': ('collapse',),
        }),
        ('Additional Settings', {
            'fields': ('timezone', 'notes'),
            'classes': ('collapse',),
        }),
        ('System Information', {
            'fields': ('created_at', 'created_by'),
            'classes': ('collapse',),
        }),
    )
    
    def save_model(self, request, obj, form, change):
        if not change:  # If creating new object
            obj.created_by = request.user
        super().save_model(request, obj, form, change)

@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ['code', 'title', 'department', 'level', 'credit_units', 'is_active', 'created_at']
    list_filter = ['department', 'level', 'credit_units', 'is_active', 'created_at']
    search_fields = ['code', 'title', 'department__name']
    readonly_fields = ['created_at', 'created_by']

@admin.register(CourseAssignment)
class CourseAssignmentAdmin(admin.ModelAdmin):
    list_display = ['course', 'lecturer', 'academic_year', 'semester', 'is_active', 'assigned_at']
    list_filter = ['academic_year', 'semester', 'is_active', 'assigned_at']
    search_fields = ['course__code', 'course__title', 'lecturer__full_name']
    readonly_fields = ['assigned_at', 'assigned_by']

@admin.register(ClassSession)
class ClassSessionAdmin(admin.ModelAdmin):
    list_display = ['title', 'course_assignment', 'scheduled_date', 'start_time', 'end_time', 'room', 'class_type', 'is_active']
    list_filter = ['class_type', 'scheduled_date', 'is_active', 'is_cancelled', 'is_recurring', 'recurrence_pattern']
    search_fields = ['title', 'course_assignment__course__code', 'course_assignment__lecturer__full_name']
    readonly_fields = ['created_at', 'updated_at', 'created_by']
    date_hierarchy = 'scheduled_date'
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('course_assignment', 'title', 'description', 'class_type')
        }),
        ('Scheduling', {
            'fields': ('scheduled_date', 'start_time', 'end_time', 'timezone')
        }),
        ('Location & Virtual Meeting', {
            'fields': ('room', 'custom_location', 'meeting_link', 'meeting_id', 'meeting_passcode')
        }),
        ('Attendance Configuration', {
            'fields': ('attendance_window_start', 'attendance_window_end', 'attendance_required', 'attendance_method')
        }),
        ('Recurring Sessions', {
            'fields': ('is_recurring', 'recurrence_pattern', 'recurrence_end_date', 'parent_session'),
            'classes': ('collapse',),
        }),
        ('Status & Capacity', {
            'fields': ('is_active', 'is_cancelled', 'cancellation_reason', 'max_capacity')
        }),
        ('System Information', {
            'fields': ('created_at', 'updated_at', 'created_by'),
            'classes': ('collapse',),
        }),
    )
    
    def save_model(self, request, obj, form, change):
        if not change:  # If creating new object
            obj.created_by = request.user
        super().save_model(request, obj, form, change)

@admin.register(Enrollment)
class EnrollmentAdmin(admin.ModelAdmin):
    list_display = ['student', 'course_assignment', 'status', 'enrolled_at']
    list_filter = ['status', 'enrolled_at']
    search_fields = ['student__full_name', 'course_assignment__course__code']
    readonly_fields = ['enrolled_at']

@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ['recipient', 'sender', 'notification_type', 'title', 'is_read', 'created_at']
    list_filter = ['notification_type', 'is_read', 'created_at']
    search_fields = ['title', 'recipient__full_name', 'sender__full_name']
    readonly_fields = ['created_at']

@admin.register(ClassAttendance)
class ClassAttendanceAdmin(admin.ModelAdmin):
    list_display = ['student', 'class_session', 'status', 'marked_at', 'face_verified']
    list_filter = ['status', 'marked_at', 'face_verified']
    search_fields = ['student__full_name', 'class_session__title']
    readonly_fields = ['marked_at']