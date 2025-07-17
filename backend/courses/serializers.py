from rest_framework import serializers
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from .models import (
    College, Department, Course, CourseAssignment, 
    Enrollment, ClassSession, Notification, ClassAttendance
)
from django.contrib.auth import get_user_model

User = get_user_model()

class UserBasicSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'full_name', 'email', 'role', 'student_id', 'lecturer_id']

class CollegeSerializer(serializers.ModelSerializer):
    class Meta:
        model = College
        fields = ['id', 'name', 'code', 'description', 'is_active', 'created_at']
        read_only_fields = ['id', 'created_at']

class DepartmentSerializer(serializers.ModelSerializer):
    college = CollegeSerializer(read_only=True)
    
    # For write operations, we still need the college ID
    college_id = serializers.IntegerField(write_only=True)
    
    class Meta:
        model = Department
        fields = ['id', 'name', 'code', 'college', 'college_id', 'description', 'is_active', 'created_at']
        read_only_fields = ['id', 'created_at']

class CourseSerializer(serializers.ModelSerializer):
    department = DepartmentSerializer(read_only=True)
    created_by = UserBasicSerializer(read_only=True)
    
    # For write operations, we still need the department ID
    department_id = serializers.IntegerField(write_only=True)
    
    class Meta:
        model = Course
        fields = [
            'id', 'code', 'title', 'description', 'department', 'department_id',
            'level', 'credit_units', 'is_active', 'created_by', 'created_at'
        ]
        read_only_fields = ['id', 'created_by', 'created_at']

class CourseAssignmentSerializer(serializers.ModelSerializer):
    course = CourseSerializer(read_only=True)
    lecturer = UserBasicSerializer(read_only=True)
    assigned_by = UserBasicSerializer(read_only=True)
    
    # For write operations, we still need the IDs
    course_id = serializers.IntegerField(write_only=True)
    lecturer_id = serializers.IntegerField(write_only=True)
    
    class Meta:
        model = CourseAssignment
        fields = [
            'id', 'course', 'course_id', 'lecturer', 'lecturer_id',
            'academic_year', 'semester', 'is_active', 'assigned_by', 'assigned_at'
        ]
        read_only_fields = ['id', 'assigned_by', 'assigned_at']
    
    def validate(self, attrs):
        lecturer_id = attrs.get('lecturer_id')
        if lecturer_id:
            try:
                lecturer = User.objects.get(id=lecturer_id)
                if lecturer.role != 'lecturer':
                    raise serializers.ValidationError("Only users with lecturer role can be assigned to courses")
            except User.DoesNotExist:
                raise serializers.ValidationError("Lecturer not found")
        return attrs

class EnrollmentSerializer(serializers.ModelSerializer):
    student = UserBasicSerializer(read_only=True)
    course_assignment = CourseAssignmentSerializer(read_only=True)
    processed_by = UserBasicSerializer(read_only=True)
    
    class Meta:
        model = Enrollment
        fields = [
            'id', 'student', 'course_assignment', 'status', 'requested_at',
            'processed_at', 'processed_by', 'notes'
        ]
        read_only_fields = ['id', 'student', 'requested_at', 'processed_by']

class ClassSessionSerializer(serializers.ModelSerializer):
    course_assignment = CourseAssignmentSerializer(read_only=True)
    
    class Meta:
        model = ClassSession
        fields = [
            'id', 'course_assignment', 'title', 'description', 'class_type',
            'scheduled_date', 'start_time', 'end_time', 'venue', 'virtual_link',
            'attendance_window_start', 'attendance_window_end', 'is_recurring',
            'recurrence_pattern', 'is_active', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']

class NotificationSerializer(serializers.ModelSerializer):
    sender = UserBasicSerializer(read_only=True)
    related_enrollment = EnrollmentSerializer(read_only=True)
    related_class_session = ClassSessionSerializer(read_only=True)
    
    class Meta:
        model = Notification
        fields = [
            'id', 'sender', 'notification_type', 'title', 'message', 'is_read',
            'related_enrollment', 'related_class_session', 'created_at'
        ]
        read_only_fields = ['id', 'sender', 'created_at']

class ClassAttendanceSerializer(serializers.ModelSerializer):
    student = UserBasicSerializer(read_only=True)
    class_session = ClassSessionSerializer(read_only=True)
    
    class Meta:
        model = ClassAttendance
        fields = [
            'id', 'class_session', 'student', 'status', 'marked_at',
            'face_verified', 'location', 'notes'
        ]
        read_only_fields = ['id', 'student', 'marked_at'] 