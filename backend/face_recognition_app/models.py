from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.core.validators import MinLengthValidator

User = get_user_model()

class FaceEncoding(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='face_encoding')
    encoding = models.JSONField(help_text="Face encoding as JSON array")
    image = models.ImageField(upload_to='face_images/', null=True, blank=True)
    confidence_score = models.FloatField(default=0.0, help_text="Confidence score of face detection")
    quality_score = models.FloatField(default=0.0, help_text="Quality score of the image")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'face_encodings'
        verbose_name = 'Face Encoding'
        verbose_name_plural = 'Face Encodings'
    
    def __str__(self):
        return f"Face encoding for {self.user.full_name}"

class FaceRecognitionLog(models.Model):
    RECOGNITION_STATUS = [
        ('success', 'Success'),
        ('failed', 'Failed'),
        ('no_face', 'No Face Detected'),
        ('multiple_faces', 'Multiple Faces Detected'),
        ('poor_quality', 'Poor Image Quality'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='recognition_logs')
    status = models.CharField(max_length=20, choices=RECOGNITION_STATUS)
    confidence_score = models.FloatField(default=0.0)
    image = models.ImageField(upload_to='recognition_logs/', null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'face_recognition_logs'
        verbose_name = 'Face Recognition Log'
        verbose_name_plural = 'Face Recognition Logs'
        ordering = ['-timestamp']
    
    def __str__(self):
        return f"{self.user.full_name} - {self.status} - {self.timestamp}"

class FaceDetectionSettings(models.Model):
    tolerance = models.FloatField(
        default=0.6,
        help_text="Face recognition tolerance (0.0 to 1.0, lower is more strict)"
    )
    min_face_size = models.IntegerField(
        default=100,
        help_text="Minimum face size in pixels"
    )
    max_file_size = models.IntegerField(
        default=10485760,  # 10MB
        help_text="Maximum file size in bytes"
    )
    allowed_formats = models.JSONField(
        default=list,
        help_text="Allowed image formats"
    )
    quality_threshold = models.FloatField(
        default=0.5,
        help_text="Minimum image quality threshold"
    )
    blur_threshold = models.FloatField(
        default=100.0,
        help_text="Minimum blur threshold (higher is sharper)"
    )
    brightness_min = models.FloatField(
        default=50.0,
        help_text="Minimum brightness threshold"
    )
    brightness_max = models.FloatField(
        default=200.0,
        help_text="Maximum brightness threshold"
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'face_detection_settings'
        verbose_name = 'Face Detection Settings'
        verbose_name_plural = 'Face Detection Settings'
    
    def __str__(self):
        return f"Face Detection Settings (Active: {self.is_active})"
    
    @classmethod
    def get_active_settings(cls):
        """Get the active face detection settings"""
        return cls.objects.filter(is_active=True).first()

class FaceRecognitionStats(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='face_recognition_stats')
    total_attempts = models.IntegerField(default=0)
    successful_recognitions = models.IntegerField(default=0)
    failed_recognitions = models.IntegerField(default=0)
    success_rate = models.FloatField(default=0.0)
    last_recognition = models.DateTimeField(null=True, blank=True)
    last_updated = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'face_recognition_stats'
        verbose_name = 'Face Recognition Statistics'
        verbose_name_plural = 'Face Recognition Statistics'
    
    def __str__(self):
        return f"{self.user.full_name} - {self.success_rate}% success rate"
    
    def update_stats(self):
        """Update recognition statistics"""
        logs = self.user.recognition_logs.all()
        self.total_attempts = logs.count()
        self.successful_recognitions = logs.filter(status='success').count()
        self.failed_recognitions = self.total_attempts - self.successful_recognitions
        
        if self.total_attempts > 0:
            self.success_rate = (self.successful_recognitions / self.total_attempts) * 100
        else:
            self.success_rate = 0.0
        
        latest_log = logs.first()
        if latest_log:
            self.last_recognition = latest_log.timestamp
        
        self.save()

class FaceImageHistory(models.Model):
    """Model to store history of face images for a user"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='face_image_history')
    image = models.ImageField(upload_to='face_history/')
    confidence_score = models.FloatField(default=0.0)
    quality_score = models.FloatField(default=0.0)
    is_approved = models.BooleanField(default=False)
    approved_by = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='approved_faces'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'face_image_history'
        verbose_name = 'Face Image History'
        verbose_name_plural = 'Face Image History'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.user.full_name} - {self.created_at.date()}" 