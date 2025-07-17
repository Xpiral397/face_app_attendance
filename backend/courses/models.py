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
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('withdrawn', 'Withdrawn'),
    ]
    
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='enrollments')
    course_assignment = models.ForeignKey(CourseAssignment, on_delete=models.CASCADE, related_name='enrollments')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    requested_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    processed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='processed_enrollments')
    notes = models.TextField(blank=True)
    
    class Meta:
        db_table = 'enrollments'
        unique_together = ['student', 'course_assignment']
    
    def __str__(self):
        return f"{self.student.full_name} - {self.course_assignment.course.code} ({self.status})"
    
    def clean(self):
        if self.student.role != 'student':
            raise ValidationError("Only students can enroll in courses")

class ClassSession(models.Model):
    CLASS_TYPE_CHOICES = [
        ('physical', 'Physical'),
        ('virtual', 'Virtual'),
        ('hybrid', 'Hybrid'),
    ]
    
    course_assignment = models.ForeignKey(CourseAssignment, on_delete=models.CASCADE, related_name='class_sessions')
    title = models.CharField(max_length=300)
    description = models.TextField(blank=True)
    class_type = models.CharField(max_length=20, choices=CLASS_TYPE_CHOICES)
    scheduled_date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    venue = models.CharField(max_length=200, blank=True)  # For physical classes
    virtual_link = models.URLField(blank=True)  # For virtual classes
    attendance_window_start = models.TimeField()  # When students can start marking attendance
    attendance_window_end = models.TimeField()  # When attendance window closes
    is_recurring = models.BooleanField(default=False)
    recurrence_pattern = models.CharField(max_length=50, blank=True)  # e.g., "weekly", "biweekly"
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'class_sessions'
        ordering = ['scheduled_date', 'start_time']
    
    def __str__(self):
        return f"{self.course_assignment.course.code} - {self.title} ({self.scheduled_date})"
    
    @property
    def is_attendance_open(self):
        now = timezone.now()
        class_datetime = timezone.make_aware(
            timezone.datetime.combine(self.scheduled_date, self.attendance_window_start)
        )
        end_datetime = timezone.make_aware(
            timezone.datetime.combine(self.scheduled_date, self.attendance_window_end)
        )
        return class_datetime <= now <= end_datetime

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