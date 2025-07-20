from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.core.exceptions import ValidationError

User = get_user_model()

class College(models.Model):
    name = models.CharField(max_length=200)
    code = models.CharField(max_length=10, unique=True)  # e.g., "SCI", "ENG"
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'colleges'
        verbose_name_plural = 'Colleges'
    
    def __str__(self):
        return f"{self.code} - {self.name}"

class Department(models.Model):
    name = models.CharField(max_length=200)
    code = models.CharField(max_length=10, unique=True)  # e.g., "CSC", "MTH"
    college = models.ForeignKey(College, on_delete=models.CASCADE, related_name='departments')
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'departments'
    
    def __str__(self):
        return f"{self.code} - {self.name}"

class Course(models.Model):
    LEVEL_CHOICES = [
        ('100', '100 Level'),
        ('200', '200 Level'),
        ('300', '300 Level'),
        ('400', '400 Level'),
        ('500', '500 Level'),
    ]
    
    code = models.CharField(max_length=20, unique=True)  # e.g., "CSC-302"
    title = models.CharField(max_length=300)
    description = models.TextField(blank=True)
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name='courses')
    level = models.CharField(max_length=3, choices=LEVEL_CHOICES)
    credit_units = models.IntegerField(default=3)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_courses')
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'courses'
    
    def __str__(self):
        return f"{self.code} - {self.title}"

class CourseAssignment(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='assignments')
    lecturer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='course_assignments')
    academic_year = models.CharField(max_length=20)  # e.g., "2024/2025"
    semester = models.CharField(max_length=20)  # e.g., "First", "Second"
    is_active = models.BooleanField(default=True)
    assigned_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='lecturer_assignments')
    assigned_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'course_assignments'
        unique_together = ['course', 'lecturer', 'academic_year', 'semester']
    
    def __str__(self):
        return f"{self.lecturer.full_name} - {self.course.code}"
    
    def clean(self):
        if self.lecturer.role != 'lecturer':
            raise ValidationError("Only lecturers can be assigned to courses")

class Enrollment(models.Model):
    STATUS_CHOICES = [
        ('enrolled', 'Enrolled'),
        ('pending', 'Pending'),
        ('rejected', 'Rejected'),
        ('withdrawn', 'Withdrawn'),
        ('completed', 'Completed'),
    ]
    
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='enrollments')
    course_assignment = models.ForeignKey(CourseAssignment, on_delete=models.CASCADE, related_name='enrollments')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    enrolled_at = models.DateTimeField(auto_now_add=True)
    enrolled_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_enrollments')
    notes = models.TextField(blank=True)
    
    class Meta:
        db_table = 'enrollments'
        unique_together = ['student', 'course_assignment']
    
    def __str__(self):
        return f"{self.student.full_name} - {self.course_assignment.course.code} ({self.status})"
    
    def clean(self):
        if self.student.role != 'student':
            raise ValidationError("Only students can enroll in courses")

class Room(models.Model):
    ROOM_TYPE_CHOICES = [
        ('physical', 'Physical Room'),
        ('virtual', 'Virtual Room'),
    ]
    
    VIRTUAL_PLATFORM_CHOICES = [
        ('zoom', 'Zoom'),
        ('teams', 'Microsoft Teams'),
        ('meet', 'Google Meet'),
        ('webex', 'Cisco Webex'),
        ('other', 'Other'),
    ]
    
    name = models.CharField(max_length=100)  # e.g., "Room A101", "Virtual Room 1"
    code = models.CharField(max_length=20, unique=True)  # e.g., "A101", "VR001"
    room_type = models.CharField(max_length=20, choices=ROOM_TYPE_CHOICES)
    capacity = models.PositiveIntegerField()
    
    # Physical room fields
    building = models.CharField(max_length=100, blank=True)
    floor = models.CharField(max_length=20, blank=True)
    facilities = models.TextField(blank=True)  # JSON field for facilities like projector, whiteboard, etc.
    
    # Virtual room fields
    virtual_platform = models.CharField(max_length=20, choices=VIRTUAL_PLATFORM_CHOICES, blank=True)
    default_meeting_link = models.URLField(blank=True)
    meeting_id = models.CharField(max_length=100, blank=True)
    passcode = models.CharField(max_length=50, blank=True)
    
    # Common fields
    timezone = models.CharField(max_length=50, default='UTC')
    is_available = models.BooleanField(default=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='created_rooms')
    
    class Meta:
        db_table = 'rooms'
        ordering = ['room_type', 'name']
    
    def __str__(self):
        return f"{self.code} - {self.name} ({self.get_room_type_display()})"
    
    @property
    def is_virtual(self):
        return self.room_type == 'virtual'
    
    @property
    def is_physical(self):
        return self.room_type == 'physical'

class ClassSession(models.Model):
    CLASS_TYPE_CHOICES = [
        ('lecture', 'Lecture'),
        ('tutorial', 'Tutorial'),
        ('practical', 'Practical'),
        ('seminar', 'Seminar'),
        ('exam', 'Examination'),
    ]
    
    RECURRENCE_CHOICES = [
        ('none', 'No Recurrence'),
        ('daily', 'Daily'),
        ('weekly', 'Weekly'),
        ('biweekly', 'Bi-weekly'),
        ('monthly', 'Monthly'),
    ]
    
    course_assignment = models.ForeignKey(CourseAssignment, on_delete=models.CASCADE, related_name='class_sessions')
    title = models.CharField(max_length=300)
    description = models.TextField(blank=True)
    class_type = models.CharField(max_length=20, choices=CLASS_TYPE_CHOICES, default='lecture')
    
    # Scheduling
    scheduled_date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    timezone = models.CharField(max_length=50, default='UTC')
    
    # Room and Location
    room = models.ForeignKey(Room, on_delete=models.SET_NULL, null=True, blank=True, related_name='class_sessions')
    custom_location = models.CharField(max_length=200, blank=True)  # For custom locations not in room system
    meeting_link = models.URLField(blank=True)  # Override room's default link if needed
    meeting_id = models.CharField(max_length=100, blank=True)
    meeting_passcode = models.CharField(max_length=50, blank=True)
    
    # Attendance Configuration
    attendance_window_start = models.TimeField()  # When students can start marking attendance
    attendance_window_end = models.TimeField()  # When attendance window closes
    attendance_required = models.BooleanField(default=True)
    attendance_method = models.CharField(max_length=20, choices=[
        ('manual', 'Manual'),
        ('face_recognition', 'Face Recognition'),
        ('both', 'Both Methods')
    ], default='face_recognition')
    
    # Recurring Sessions
    is_recurring = models.BooleanField(default=False)
    recurrence_pattern = models.CharField(max_length=20, choices=RECURRENCE_CHOICES, default='none')
    recurrence_end_date = models.DateField(null=True, blank=True)
    parent_session = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='recurring_sessions')
    
    # Status and Meta
    is_active = models.BooleanField(default=True)
    is_cancelled = models.BooleanField(default=False)
    cancellation_reason = models.TextField(blank=True)
    max_capacity = models.PositiveIntegerField(null=True, blank=True)  # Override room capacity if needed
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='created_class_sessions')
    
    class Meta:
        db_table = 'class_sessions'
        ordering = ['scheduled_date', 'start_time']
        indexes = [
            models.Index(fields=['scheduled_date', 'start_time']),
            models.Index(fields=['course_assignment', 'scheduled_date']),
            models.Index(fields=['room', 'scheduled_date']),
        ]
    
    def __str__(self):
        return f"{self.course_assignment.course.code} - {self.title} ({self.scheduled_date})"
    
    @property
    def is_attendance_open(self):
        from django.utils import timezone
        now = timezone.now()
        class_datetime = timezone.make_aware(
            timezone.datetime.combine(self.scheduled_date, self.attendance_window_start)
        )
        end_datetime = timezone.make_aware(
            timezone.datetime.combine(self.scheduled_date, self.attendance_window_end)
        )
        return class_datetime <= now <= end_datetime
    
    @property
    def effective_location(self):
        """Returns the effective location string for display"""
        if self.room:
            return str(self.room)
        return self.custom_location or "Location TBD"
    
    @property
    def effective_meeting_link(self):
        """Returns the effective meeting link"""
        if self.meeting_link:
            return self.meeting_link
        if self.room and self.room.is_virtual:
            return self.room.default_meeting_link
        return None
    
    @property
    def capacity(self):
        """Returns the effective capacity for this session"""
        if self.max_capacity:
            return self.max_capacity
        if self.room:
            return self.room.capacity
        return None
    
    def clean(self):
        from django.core.exceptions import ValidationError
        
        # Validate time range
        if self.end_time <= self.start_time:
            raise ValidationError("End time must be after start time")
        
        # Validate attendance window
        if self.attendance_window_end <= self.attendance_window_start:
            raise ValidationError("Attendance window end must be after start")
        
        # Validate recurrence
        if self.is_recurring and self.recurrence_pattern == 'none':
            raise ValidationError("Recurrence pattern must be specified for recurring sessions")
        
        if self.is_recurring and not self.recurrence_end_date:
            raise ValidationError("Recurrence end date is required for recurring sessions")
    
    def check_conflicts(self):
        """Check for scheduling conflicts"""
        conflicts = []
        
        # Check room conflicts
        if self.room:
            room_conflicts = ClassSession.objects.filter(
                room=self.room,
                scheduled_date=self.scheduled_date,
                is_active=True,
                is_cancelled=False
            ).exclude(id=self.id if self.id else None)
            
            for session in room_conflicts:
                if (self.start_time < session.end_time and self.end_time > session.start_time):
                    conflicts.append({
                        'type': 'room',
                        'session_id': session.id,
                        'session_title': session.title,
                        'course_code': session.course_assignment.course.code,
                        'start_time': str(session.start_time),
                        'end_time': str(session.end_time),
                        'message': f"Room {self.room.code} is already booked"
                    })
        
        # Check lecturer conflicts
        lecturer_conflicts = ClassSession.objects.filter(
            course_assignment__lecturer=self.course_assignment.lecturer,
            scheduled_date=self.scheduled_date,
            is_active=True,
            is_cancelled=False
        ).exclude(id=self.id if self.id else None)
        
        for session in lecturer_conflicts:
            if (self.start_time < session.end_time and self.end_time > session.start_time):
                conflicts.append({
                    'type': 'lecturer',
                    'session_id': session.id,
                    'session_title': session.title,
                    'course_code': session.course_assignment.course.code,
                    'start_time': str(session.start_time),
                    'end_time': str(session.end_time),
                    'message': f"Lecturer has another class: {session.course_assignment.course.code}"
                })
        
        # Check student conflicts (same department and level)
        course = self.course_assignment.course
        student_conflicts = ClassSession.objects.filter(
            course_assignment__course__department=course.department,
            course_assignment__course__level=course.level,
            scheduled_date=self.scheduled_date,
            is_active=True,
            is_cancelled=False
        ).exclude(id=self.id if self.id else None)
        
        for session in student_conflicts:
            if (self.start_time < session.end_time and self.end_time > session.start_time):
                conflicts.append({
                    'type': 'student',
                    'session_id': session.id,
                    'session_title': session.title,
                    'course_code': session.course_assignment.course.code,
                    'start_time': str(session.start_time),
                    'end_time': str(session.end_time),
                    'message': f"Students have conflicting class: {session.course_assignment.course.code}"
                })
        
        return conflicts

class Notification(models.Model):
    NOTIFICATION_TYPES = [
        ('enrollment_request', 'Enrollment Request'),
        ('enrollment_approved', 'Enrollment Approved'),
        ('enrollment_rejected', 'Enrollment Rejected'),
        ('class_scheduled', 'Class Scheduled'),
        ('class_updated', 'Class Updated'),
        ('class_cancelled', 'Class Cancelled'),
        ('assignment_created', 'Course Assignment Created'),
        ('general', 'General Notification'),
    ]
    
    recipient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_notifications')
    notification_type = models.CharField(max_length=30, choices=NOTIFICATION_TYPES)
    title = models.CharField(max_length=200)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    related_enrollment = models.ForeignKey(Enrollment, on_delete=models.CASCADE, null=True, blank=True)
    related_class_session = models.ForeignKey(ClassSession, on_delete=models.CASCADE, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'notifications'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.title} - {self.recipient.full_name}"
    
    def mark_as_read(self):
        self.is_read = True
        self.save()

class ClassAttendance(models.Model):
    STATUS_CHOICES = [
        ('present', 'Present'),
        ('absent', 'Absent'),
        ('late', 'Late'),
        ('excused', 'Excused'),
    ]
    
    class_session = models.ForeignKey(ClassSession, on_delete=models.CASCADE, related_name='attendances')
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='class_attendances')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='present')
    marked_at = models.DateTimeField(auto_now_add=True)
    face_verified = models.BooleanField(default=False)
    location = models.CharField(max_length=200, blank=True)  # GPS location if needed
    notes = models.TextField(blank=True)
    
    class Meta:
        db_table = 'class_attendances'
        unique_together = ['class_session', 'student']
    
    def __str__(self):
        return f"{self.student.full_name} - {self.class_session.title} ({self.status})"
    
    def clean(self):
        # Ensure student is enrolled in the course
        if not Enrollment.objects.filter(
            student=self.student,
            course_assignment=self.class_session.course_assignment,
            status='approved'
        ).exists():
            raise ValidationError("Student is not enrolled in this course") 