from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone
import uuid

class ReferralCode(models.Model):
    ROLE_CHOICES = [
        ('admin', 'Admin'),
        ('lecturer', 'Lecturer'),
    ]
    
    code = models.CharField(max_length=50, unique=True, default=uuid.uuid4)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    created_by = models.ForeignKey('User', on_delete=models.CASCADE, related_name='created_referral_codes')
    is_active = models.BooleanField(default=True)
    usage_count = models.IntegerField(default=0)
    max_usage = models.IntegerField(default=50)  # Maximum number of times this code can be used
    expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'referral_codes'
        verbose_name = 'Referral Code'
        verbose_name_plural = 'Referral Codes'
    
    def __str__(self):
        return f"{self.code} ({self.role})"
    
    @property
    def is_expired(self):
        return self.expires_at and self.expires_at < timezone.now()
    
    @property
    def is_available(self):
        return self.is_active and not self.is_expired and self.usage_count < self.max_usage
    
    def use(self):
        """Increment usage count"""
        self.usage_count += 1
        self.save()

class User(AbstractUser):
    ROLE_CHOICES = [
        ('admin', 'Admin'),
        ('lecturer', 'Lecturer'),
        ('student', 'Student'),
    ]
    
    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=255)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='student')
    student_id = models.CharField(max_length=50, unique=True, null=True, blank=True)
    lecturer_id = models.CharField(max_length=50, unique=True, null=True, blank=True)
    department = models.ForeignKey('courses.Department', on_delete=models.SET_NULL, null=True, blank=True, related_name='users')
    level = models.CharField(max_length=3, choices=[
        ('100', '100 Level'),
        ('200', '200 Level'),
        ('300', '300 Level'),
        ('400', '400 Level'),
        ('500', '500 Level'),
    ], blank=True)
    referral_code = models.ForeignKey(ReferralCode, on_delete=models.SET_NULL, null=True, blank=True, related_name='users')
    is_active = models.BooleanField(default=False)  # Changed to False for manual activation
    is_approved = models.BooleanField(default=False)  # New field for approval tracking
    approved_by = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_users')
    approved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username', 'full_name']
    
    class Meta:
        db_table = 'users'
        verbose_name = 'User'
        verbose_name_plural = 'Users'
    
    def __str__(self):
        return f"{self.full_name} ({self.email})"
    
    @property
    def is_admin(self):
        return self.role == 'admin'
    
    @property
    def is_lecturer(self):
        return self.role == 'lecturer'
    
    @property
    def is_student(self):
        return self.role == 'student'
    
    def approve(self, approved_by_user):
        """Approve and activate user"""
        self.is_approved = True
        self.is_active = True
        self.approved_by = approved_by_user
        self.approved_at = timezone.now()
        self.save()
    
    def save(self, *args, **kwargs):
        if not self.username:
            self.username = self.email
        super().save(*args, **kwargs) 