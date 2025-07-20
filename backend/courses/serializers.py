from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import (
    College, Department, Course, CourseAssignment, 
    Enrollment, ClassSession, Notification, ClassAttendance, Room
)

User = get_user_model()

class UserBasicSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'full_name', 'email', 'lecturer_id']

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

class RoomSerializer(serializers.ModelSerializer):
    created_by = UserBasicSerializer(read_only=True)
    
    class Meta:
        model = Room
        fields = [
            'id', 'name', 'code', 'room_type', 'capacity',
            'building', 'floor', 'facilities',
            'virtual_platform', 'default_meeting_link', 'meeting_id', 'passcode',
            'timezone', 'is_available', 'notes', 'created_at', 'created_by'
        ]
        read_only_fields = ['id', 'created_at', 'created_by']

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
    
    # For write operations
    course_id = serializers.IntegerField(write_only=True)
    lecturer_id = serializers.IntegerField(write_only=True)
    
    class Meta:
        model = CourseAssignment
        fields = [
            'id', 'course', 'course_id', 'lecturer', 'lecturer_id',
            'academic_year', 'semester', 'is_active', 'assigned_by', 'assigned_at'
        ]
        read_only_fields = ['id', 'assigned_by', 'assigned_at']

class ClassSessionSerializer(serializers.ModelSerializer):
    course_assignment = CourseAssignmentSerializer(read_only=True)
    room = RoomSerializer(read_only=True)
    created_by = UserBasicSerializer(read_only=True)
    parent_session = serializers.PrimaryKeyRelatedField(read_only=True)
    
    # For write operations
    course_assignment_id = serializers.IntegerField(write_only=True)
    room_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    
    # Computed fields
    effective_location = serializers.CharField(read_only=True)
    effective_meeting_link = serializers.URLField(read_only=True)
    capacity = serializers.IntegerField(read_only=True)
    conflicts = serializers.SerializerMethodField()
    
    class Meta:
        model = ClassSession
        fields = [
            'id', 'course_assignment', 'course_assignment_id', 'title', 'description', 'class_type',
            'scheduled_date', 'start_time', 'end_time', 'timezone',
            'room', 'room_id', 'custom_location', 'effective_location',
            'meeting_link', 'meeting_id', 'meeting_passcode', 'effective_meeting_link',
            'attendance_window_start', 'attendance_window_end', 'attendance_required', 'attendance_method',
            'is_recurring', 'recurrence_pattern', 'recurrence_end_date', 'parent_session',
            'is_active', 'is_cancelled', 'cancellation_reason', 'max_capacity', 'capacity',
            'created_at', 'updated_at', 'created_by', 'conflicts'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'created_by', 'effective_location', 'effective_meeting_link', 'capacity', 'conflicts']
    
    def get_conflicts(self, obj):
        """Get scheduling conflicts for this session"""
        if obj.id:  # Only check conflicts for existing sessions
            return obj.check_conflicts()
        return []
    
    def validate(self, data):
        """Custom validation for session data"""
        # Validate time range
        if data.get('end_time') and data.get('start_time'):
            if data['end_time'] <= data['start_time']:
                raise serializers.ValidationError("End time must be after start time")
        
        # Validate attendance window
        if data.get('attendance_window_end') and data.get('attendance_window_start'):
            if data['attendance_window_end'] <= data['attendance_window_start']:
                raise serializers.ValidationError("Attendance window end must be after start")
        
        # Validate recurrence
        if data.get('is_recurring') and data.get('recurrence_pattern') == 'none':
            raise serializers.ValidationError("Recurrence pattern must be specified for recurring sessions")
        
        if data.get('is_recurring') and not data.get('recurrence_end_date'):
            raise serializers.ValidationError("Recurrence end date is required for recurring sessions")
        
        return data

class EnrollmentSerializer(serializers.ModelSerializer):
    student = UserBasicSerializer(read_only=True)
    course_assignment = CourseAssignmentSerializer(read_only=True)
    enrolled_by = UserBasicSerializer(read_only=True)
    
    # For write operations
    course_assignment_id = serializers.IntegerField(write_only=True, source='course_assignment')
    
    class Meta:
        model = Enrollment
        fields = ['id', 'student', 'course_assignment', 'course_assignment_id', 'status', 'enrolled_at', 'enrolled_by']
        read_only_fields = ['id', 'enrolled_at']

class NotificationSerializer(serializers.ModelSerializer):
    sender = UserBasicSerializer(read_only=True)
    recipient = UserBasicSerializer(read_only=True)
    
    class Meta:
        model = Notification
        fields = [
            'id', 'recipient', 'sender', 'notification_type', 'title', 'message',
            'is_read', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']

class ClassAttendanceSerializer(serializers.ModelSerializer):
    student = UserBasicSerializer(read_only=True)
    class_session = ClassSessionSerializer(read_only=True)
    
    # For write operations
    class_session_id = serializers.IntegerField(write_only=True, source='class_session')
    captured_image = serializers.CharField(write_only=True, required=False, allow_blank=True)
    
    class Meta:
        model = ClassAttendance
        fields = [
            'id', 'student', 'class_session', 'class_session_id', 'status', 
            'marked_at', 'face_verified', 'location', 'notes', 'captured_image'
        ]
        read_only_fields = ['id', 'marked_at', 'student']
    
    def create(self, validated_data):
        # Remove captured_image from validated_data since it's not a model field
        captured_image = validated_data.pop('captured_image', None)
        
        # Create the attendance record without captured_image
        attendance = ClassAttendance.objects.create(**validated_data)
        
        # TODO: If needed, save captured_image to a separate model or file storage
        # For now, we'll just ignore it since the main functionality is attendance marking
        
        return attendance 