from django.db import models
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError

User = get_user_model()

class Attendance(models.Model):
    STATUS_CHOICES = [
        ('present', 'Present'),
        ('absent', 'Absent'),
        ('late', 'Late'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='attendances')
    timestamp = models.DateTimeField(default=timezone.now)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='present')
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'attendances'
        verbose_name = 'Attendance'
        verbose_name_plural = 'Attendances'
        ordering = ['-timestamp']
    
    def __str__(self):
        return f"{self.user.full_name} - {self.timestamp.date()} - {self.status}"
    
    def clean(self):
        # Check if user already has attendance for the same date
        if self.pk is None:  # Only for new records
            same_date_attendance = Attendance.objects.filter(
                user=self.user,
                timestamp__date=self.timestamp.date()
            ).exists()
            
            if same_date_attendance:
                raise ValidationError("Attendance already marked for this date")
    
    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

class AttendanceStats(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='attendance_stats')
    total_days = models.IntegerField(default=0)
    present_days = models.IntegerField(default=0)
    absent_days = models.IntegerField(default=0)
    late_days = models.IntegerField(default=0)
    attendance_percentage = models.FloatField(default=0.0)
    last_updated = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'attendance_stats'
        verbose_name = 'Attendance Statistics'
        verbose_name_plural = 'Attendance Statistics'
    
    def __str__(self):
        return f"{self.user.full_name} - {self.attendance_percentage}%"
    
    def update_stats(self):
        """Update attendance statistics for the user"""
        attendances = self.user.attendances.all()
        self.total_days = attendances.count()
        self.present_days = attendances.filter(status='present').count()
        self.absent_days = attendances.filter(status='absent').count()
        self.late_days = attendances.filter(status='late').count()
        
        if self.total_days > 0:
            self.attendance_percentage = (self.present_days / self.total_days) * 100
        else:
            self.attendance_percentage = 0.0
        
        self.save()

class AttendanceSession(models.Model):
    """Model to manage attendance sessions"""
    name = models.CharField(max_length=255)
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_sessions')
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'attendance_sessions'
        verbose_name = 'Attendance Session'
        verbose_name_plural = 'Attendance Sessions'
        ordering = ['-start_time']
    
    def __str__(self):
        return f"{self.name} - {self.start_time.date()}"
    
    def clean(self):
        if self.start_time >= self.end_time:
            raise ValidationError("Start time must be before end time")
    
    @property
    def is_ongoing(self):
        now = timezone.now()
        return self.start_time <= now <= self.end_time
    
    @property
    def duration(self):
        return self.end_time - self.start_time 