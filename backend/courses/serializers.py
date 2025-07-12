from rest_framework import serializers
from django.utils import timezone
from .models import (
    Faculty, Department, Course, CourseAssignment, 
    Enrollment, ClassSession, Notification, ClassAttendance
)
from accounts.models import User


class FacultySerializer(serializers.ModelSerializer):
    class Meta:
        model = Faculty
        fields = ['id', 'name', 'code', 'description', 'is_active', 'created_at']
        read_only_fields = ['id', 'created_at']


class DepartmentSerializer(serializers.ModelSerializer):
    faculty_name = serializers.CharField(source='faculty.name', read_only=True)
    
    class Meta:
        model = Department
        fields = ['id', 'name', 'code', 'faculty', 'faculty_name', 'description', 'is_active', 'created_at']
        read_only_fields = ['id', 'created_at']


class CourseSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True)
    
    class Meta:
        model = Course
        fields = [
            'id', 'code', 'title', 'description', 'department', 'department_name',
            'level', 'credit_units', 'is_active', 'created_by', 'created_by_name', 'created_at'
        ]
        read_only_fields = ['id', 'created_by', 'created_at']


class CourseAssignmentSerializer(serializers.ModelSerializer):
    course_code = serializers.CharField(source='course.code', read_only=True)
    course_title = serializers.CharField(source='course.title', read_only=True)
    lecturer_name = serializers.CharField(source='lecturer.full_name', read_only=True)
    assigned_by_name = serializers.CharField(source='assigned_by.full_name', read_only=True)
    
    class Meta:
        model = CourseAssignment
        fields = [
            'id', 'course', 'course_code', 'course_title', 'lecturer', 'lecturer_name',
            'academic_year', 'semester', 'is_active', 'assigned_by', 'assigned_by_name', 'assigned_at'
        ]
        read_only_fields = ['id', 'assigned_by', 'assigned_at']
    
    def validate(self, attrs):
        lecturer = attrs.get('lecturer')
        if lecturer and lecturer.role != 'lecturer':
            raise serializers.ValidationError("Only users with lecturer role can be assigned to courses")
        return attrs


class EnrollmentSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.full_name', read_only=True)
    student_id_number = serializers.CharField(source='student.student_id', read_only=True)
    course_code = serializers.CharField(source='course_assignment.course.code', read_only=True)
    course_title = serializers.CharField(source='course_assignment.course.title', read_only=True)
    lecturer_name = serializers.CharField(source='course_assignment.lecturer.full_name', read_only=True)
    processed_by_name = serializers.CharField(source='processed_by.full_name', read_only=True)
    
    class Meta:
        model = Enrollment
        fields = [
            'id', 'student', 'student_name', 'student_id_number', 'course_assignment',
            'course_code', 'course_title', 'lecturer_name', 'status', 'requested_at',
            'processed_at', 'processed_by', 'processed_by_name', 'notes'
        ]
        read_only_fields = ['id', 'requested_at', 'processed_at', 'processed_by']


class ClassSessionSerializer(serializers.ModelSerializer):
    course_code = serializers.CharField(source='course_assignment.course.code', read_only=True)
    course_title = serializers.CharField(source='course_assignment.course.title', read_only=True)
    lecturer_name = serializers.CharField(source='course_assignment.lecturer.full_name', read_only=True)
    is_attendance_open = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = ClassSession
        fields = [
            'id', 'course_assignment', 'course_code', 'course_title', 'lecturer_name',
            'title', 'description', 'class_type', 'scheduled_date', 'start_time', 'end_time',
            'venue', 'virtual_link', 'attendance_window_start', 'attendance_window_end',
            'is_recurring', 'recurrence_pattern', 'is_active', 'is_attendance_open', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']
    
    def validate(self, attrs):
        start_time = attrs.get('start_time')
        end_time = attrs.get('end_time')
        attendance_start = attrs.get('attendance_window_start')
        attendance_end = attrs.get('attendance_window_end')
        
        if start_time and end_time and start_time >= end_time:
            raise serializers.ValidationError("Start time must be before end time")
        
        if attendance_start and attendance_end and attendance_start >= attendance_end:
            raise serializers.ValidationError("Attendance window start must be before end")
        
        return attrs


class NotificationSerializer(serializers.ModelSerializer):
    sender_name = serializers.CharField(source='sender.full_name', read_only=True)
    related_course_code = serializers.SerializerMethodField()
    
    class Meta:
        model = Notification
        fields = [
            'id', 'recipient', 'sender', 'sender_name', 'notification_type', 'title',
            'message', 'is_read', 'related_enrollment', 'related_class_session',
            'related_course_code', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']
    
    def get_related_course_code(self, obj):
        if obj.related_enrollment:
            return obj.related_enrollment.course_assignment.course.code
        elif obj.related_class_session:
            return obj.related_class_session.course_assignment.course.code
        return None


class ClassAttendanceSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.full_name', read_only=True)
    student_id_number = serializers.CharField(source='student.student_id', read_only=True)
    class_title = serializers.CharField(source='class_session.title', read_only=True)
    course_code = serializers.CharField(source='class_session.course_assignment.course.code', read_only=True)
    
    class Meta:
        model = ClassAttendance
        fields = [
            'id', 'class_session', 'student', 'student_name', 'student_id_number',
            'class_title', 'course_code', 'status', 'marked_at', 'face_verified',
            'location', 'notes'
        ]
        read_only_fields = ['id', 'marked_at']


class UserBasicSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True)
    
    class Meta:
        model = User
        fields = ['id', 'email', 'full_name', 'role', 'student_id', 'lecturer_id', 'department', 'department_name', 'level']
        read_only_fields = ['id'] 