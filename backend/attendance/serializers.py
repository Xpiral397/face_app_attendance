from rest_framework import serializers
from django.utils import timezone
from django.db.models import Q
from .models import Attendance, AttendanceStats, AttendanceSession
from accounts.models import User


class AttendanceSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.full_name', read_only=True)
    user_email = serializers.CharField(source='user.email', read_only=True)
    student_id = serializers.CharField(source='user.student_id', read_only=True)
    
    class Meta:
        model = Attendance
        fields = [
            'id', 'user', 'user_name', 'user_email', 'student_id',
            'timestamp', 'status', 'notes', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def validate(self, attrs):
        user = attrs.get('user')
        timestamp = attrs.get('timestamp', timezone.now())
        
        # Check if attendance already exists for this user on this date
        if not self.instance:  # Only for new records
            existing_attendance = Attendance.objects.filter(
                user=user,
                timestamp__date=timestamp.date()
            ).exists()
            
            if existing_attendance:
                raise serializers.ValidationError(
                    "Attendance already marked for this user on this date"
                )
        
        return attrs


class AttendanceCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Attendance
        fields = ['user', 'timestamp', 'status', 'notes']
    
    def validate(self, attrs):
        user = attrs.get('user')
        timestamp = attrs.get('timestamp', timezone.now())
        
        # Check if attendance already exists for this user on this date
        existing_attendance = Attendance.objects.filter(
            user=user,
            timestamp__date=timestamp.date()
        ).exists()
        
        if existing_attendance:
            raise serializers.ValidationError(
                "Attendance already marked for this user on this date"
            )
        
        return attrs


class AttendanceStatsSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.full_name', read_only=True)
    user_email = serializers.CharField(source='user.email', read_only=True)
    student_id = serializers.CharField(source='user.student_id', read_only=True)
    
    class Meta:
        model = AttendanceStats
        fields = [
            'id', 'user', 'user_name', 'user_email', 'student_id',
            'total_days', 'present_days', 'absent_days', 'late_days',
            'attendance_percentage', 'last_updated'
        ]
        read_only_fields = ['id', 'last_updated']


class AttendanceSessionSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True)
    is_ongoing = serializers.BooleanField(read_only=True)
    duration = serializers.DurationField(read_only=True)
    
    class Meta:
        model = AttendanceSession
        fields = [
            'id', 'name', 'start_time', 'end_time', 'is_active',
            'created_by', 'created_by_name', 'is_ongoing', 'duration',
            'created_at'
        ]
        read_only_fields = ['id', 'created_at']
    
    def validate(self, attrs):
        start_time = attrs.get('start_time')
        end_time = attrs.get('end_time')
        
        if start_time and end_time and start_time >= end_time:
            raise serializers.ValidationError("Start time must be before end time")
        
        return attrs


class BulkAttendanceSerializer(serializers.Serializer):
    user_ids = serializers.ListField(
        child=serializers.IntegerField(),
        allow_empty=False
    )
    status = serializers.ChoiceField(choices=Attendance.STATUS_CHOICES)
    timestamp = serializers.DateTimeField(default=timezone.now)
    notes = serializers.CharField(required=False, allow_blank=True)
    
    def validate_user_ids(self, value):
        # Check if all users exist
        existing_users = User.objects.filter(id__in=value).count()
        if existing_users != len(value):
            raise serializers.ValidationError("Some users do not exist")
        return value
    
    def create(self, validated_data):
        user_ids = validated_data.pop('user_ids')
        attendances = []
        
        for user_id in user_ids:
            # Check if attendance already exists for this date
            existing = Attendance.objects.filter(
                user_id=user_id,
                timestamp__date=validated_data['timestamp'].date()
            ).exists()
            
            if not existing:
                attendances.append(
                    Attendance(user_id=user_id, **validated_data)
                )
        
        if attendances:
            Attendance.objects.bulk_create(attendances)
        
        return {
            'created_count': len(attendances),
            'total_users': len(user_ids),
            'message': f"Created {len(attendances)} attendance records out of {len(user_ids)} users"
        }


class AttendanceAnalyticsSerializer(serializers.Serializer):
    """Serializer for attendance analytics data"""
    period = serializers.ChoiceField(
        choices=[
            ('daily', 'Daily'),
            ('weekly', 'Weekly'),
            ('monthly', 'Monthly'),
            ('yearly', 'Yearly'),
        ],
        default='monthly'
    )
    start_date = serializers.DateField(required=False)
    end_date = serializers.DateField(required=False)
    user_id = serializers.IntegerField(required=False)
    
    def validate(self, attrs):
        start_date = attrs.get('start_date')
        end_date = attrs.get('end_date')
        
        if start_date and end_date and start_date > end_date:
            raise serializers.ValidationError("Start date must be before end date")
        
        return attrs


class DashboardStatsSerializer(serializers.Serializer):
    """Serializer for dashboard statistics"""
    total_users = serializers.IntegerField()
    total_attendance_today = serializers.IntegerField()
    present_today = serializers.IntegerField()
    absent_today = serializers.IntegerField()
    late_today = serializers.IntegerField()
    attendance_percentage_today = serializers.FloatField()
    total_sessions = serializers.IntegerField()
    active_sessions = serializers.IntegerField() 