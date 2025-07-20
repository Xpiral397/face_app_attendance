import face_recognition
import numpy as np
from PIL import Image
import cv2
import io
import logging
from typing import Optional, List, Dict, Tuple
from django.conf import settings
from django.core.files.uploadedfile import InMemoryUploadedFile
from .models import FaceDetectionSettings, FaceRecognitionLog

logger = logging.getLogger(__name__)

class FaceRecognitionService:
    def __init__(self):
        self.settings = FaceDetectionSettings.get_active_settings()
        if not self.settings:
            # Create default settings if none exist
            self.settings = FaceDetectionSettings.objects.create(
                tolerance=0.6,
                min_face_size=100,
                max_file_size=10485760,
                allowed_formats=['jpg', 'jpeg', 'png', 'gif', 'webp'],
                quality_threshold=0.5,
                blur_threshold=100.0,
                brightness_min=50.0,
                brightness_max=200.0,
                is_active=True
            )
    
    def validate_image(self, image_file: InMemoryUploadedFile) -> Dict[str, any]:
        """
        Validate uploaded image file
        
        Args:
            image_file: Uploaded image file
            
        Returns:
            Dictionary with validation results
        """
        result = {
            'is_valid': False,
            'errors': [],
            'warnings': [],
            'file_info': {}
        }
        
        try:
            # Check file size
            if image_file.size > self.settings.max_file_size:
                result['errors'].append(f"File size too large. Max size: {self.settings.max_file_size / 1024 / 1024:.1f}MB")
                return result
            
            # Check file format
            file_extension = image_file.name.split('.')[-1].lower()
            if file_extension not in self.settings.allowed_formats:
                result['errors'].append(f"Unsupported file format. Allowed formats: {', '.join(self.settings.allowed_formats)}")
                return result
            
            # Try to open and validate image
            image = Image.open(image_file)
            result['file_info'] = {
                'format': image.format,
                'size': image.size,
                'mode': image.mode,
                'file_size': image_file.size
            }
            
            # Check image dimensions
            width, height = image.size
            min_dimension = min(width, height)
            if min_dimension < self.settings.min_face_size:
                result['errors'].append(f"Image too small. Minimum dimension: {self.settings.min_face_size}px")
                return result
            
            result['is_valid'] = True
            return result
            
        except Exception as e:
            result['errors'].append(f"Invalid image file: {str(e)}")
            return result
    
    def get_face_encoding(self, image_file: InMemoryUploadedFile) -> Optional[Dict[str, any]]:
        """
        Extract face encoding from image
        
        Args:
            image_file: Uploaded image file
            
        Returns:
            Dictionary with face encoding and metadata or None if no face detected
        """
        try:
            # Validate image first
            validation_result = self.validate_image(image_file)
            if not validation_result['is_valid']:
                return {
                    'success': False,
                    'error': 'Image validation failed',
                    'details': validation_result['errors']
                }
            
            # Load image
            image = Image.open(image_file)
            
            # Convert to RGB if needed
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            # Convert to numpy array
            image_array = np.array(image)
            
            # Analyze image quality
            quality_metrics = self._analyze_image_quality(image_array)
            
            # Find face locations
            face_locations = face_recognition.face_locations(image_array)
            
            if not face_locations:
                return {
                    'success': False,
                    'error': 'No face detected in image',
                    'quality_metrics': quality_metrics
                }
            
            if len(face_locations) > 1:
                return {
                    'success': False,
                    'error': 'Multiple faces detected. Please use image with single face',
                    'quality_metrics': quality_metrics,
                    'faces_count': len(face_locations)
                }
            
            # Get face encodings
            face_encodings = face_recognition.face_encodings(image_array, face_locations)
            
            if not face_encodings:
                return {
                    'success': False,
                    'error': 'Could not generate face encoding',
                    'quality_metrics': quality_metrics
                }
            
            # Calculate confidence score based on face size and quality
            face_location = face_locations[0]
            face_size = (face_location[2] - face_location[0]) * (face_location[1] - face_location[3])
            confidence_score = min(face_size / (self.settings.min_face_size * self.settings.min_face_size), 1.0)
            
            return {
                'success': True,
                'encoding': face_encodings[0].tolist(),
                'confidence_score': confidence_score,
                'quality_metrics': quality_metrics,
                'face_location': face_location,
                'face_size': face_size
            }
            
        except Exception as e:
            logger.error(f"Error processing face encoding: {str(e)}")
            return {
                'success': False,
                'error': f'Error processing image: {str(e)}'
            }
    
    def extract_face_encodings(self, image_array: np.ndarray) -> List[np.ndarray]:
        """
        Extract face encodings from image array
        
        Args:
            image_array: OpenCV image array (BGR format)
            
        Returns:
            List of face encodings as numpy arrays
        """
        try:
            # Convert BGR to RGB (face_recognition expects RGB)
            rgb_image = cv2.cvtColor(image_array, cv2.COLOR_BGR2RGB)
            
            # Find face locations
            face_locations = face_recognition.face_locations(rgb_image)
            
            if not face_locations:
                return []
            
            # Get face encodings
            face_encodings = face_recognition.face_encodings(rgb_image, face_locations)
            
            return face_encodings
            
        except Exception as e:
            logger.error(f"Error extracting face encodings: {str(e)}")
            return []

    def compare_faces(self, known_encoding: np.ndarray, unknown_encoding: np.ndarray, threshold: float = 0.6) -> float:
        """
        Compare two face encodings and return confidence score
        
        Args:
            known_encoding: Known face encoding
            unknown_encoding: Unknown face encoding to compare
            threshold: Similarity threshold
            
        Returns:
            Confidence score (higher is more similar)
        """
        try:
            # Calculate face distance
            face_distance = face_recognition.face_distance([known_encoding], unknown_encoding)[0]
            
            # Convert distance to confidence (1 - distance)
            confidence = 1 - face_distance
            
            return confidence
            
        except Exception as e:
            logger.error(f"Error comparing faces: {str(e)}")
            return 0.0
    
    def _analyze_image_quality(self, image_array: np.ndarray) -> Dict[str, float]:
        """
        Analyze image quality metrics
        
        Args:
            image_array: Image as numpy array
            
        Returns:
            Dictionary with quality metrics
        """
        try:
            # Convert to grayscale for analysis
            gray = cv2.cvtColor(image_array, cv2.COLOR_RGB2GRAY)
            
            # Calculate brightness
            brightness = np.mean(gray)
            
            # Calculate blur using Laplacian variance
            blur_score = cv2.Laplacian(gray, cv2.CV_64F).var()
            
            # Calculate contrast
            contrast = gray.std()
            
            # Calculate overall quality score
            quality_score = self._calculate_quality_score(brightness, blur_score, contrast)
            
            return {
                'brightness': float(brightness),
                'blur_score': float(blur_score),
                'contrast': float(contrast),
                'quality_score': float(quality_score)
            }
            
        except Exception as e:
            logger.error(f"Error analyzing image quality: {str(e)}")
            return {
                'brightness': 0.0,
                'blur_score': 0.0,
                'contrast': 0.0,
                'quality_score': 0.0
            }
    
    def _calculate_quality_score(self, brightness: float, blur_score: float, contrast: float) -> float:
        """
        Calculate overall image quality score
        
        Args:
            brightness: Image brightness
            blur_score: Image blur score
            contrast: Image contrast
            
        Returns:
            Quality score between 0 and 1
        """
        score = 0.0
        
        # Brightness score (prefer 50-200 range)
        if self.settings.brightness_min <= brightness <= self.settings.brightness_max:
            score += 0.3
        elif brightness > self.settings.brightness_max * 0.5:
            score += 0.15
        
        # Blur score (higher is better, prefer > threshold)
        if blur_score > self.settings.blur_threshold:
            score += 0.4
        elif blur_score > self.settings.blur_threshold * 0.5:
            score += 0.2
        
        # Contrast score (prefer higher contrast)
        if contrast > 50:
            score += 0.3
        elif contrast > 25:
            score += 0.15
        
        return min(score, 1.0)
    
    def log_recognition_attempt(self, user, status, confidence_score=0.0, image_file=None, request=None, error_details=None):
        """
        Enhanced logging for face recognition attempts
        
        Args:
            user: User object
            status: Recognition status ('success', 'no_face_detected', 'verification_failed', 'technical_error')
            confidence_score: Confidence score (0.0 to 1.0)
            image_file: Uploaded image file
            request: HTTP request object
            error_details: Additional error information
        """
        try:
            from django.utils import timezone
            import logging
            
            logger = logging.getLogger(__name__)
            
            # Create log entry with detailed information
            log_data = {
                'user_id': user.id,
                'username': user.username,
                'full_name': getattr(user, 'full_name', ''),
                'status': status,
                'confidence_score': confidence_score,
                'timestamp': timezone.now().isoformat(),
                'ip_address': request.META.get('REMOTE_ADDR') if request else None,
                'user_agent': request.META.get('HTTP_USER_AGENT') if request else None,
                'error_details': error_details
            }
            
            # Log based on status level
            if status == 'success':
                logger.info(f"✅ Face recognition SUCCESS: User {user.id} ({user.username}) - Confidence: {confidence_score:.2%}")
            elif status == 'no_face_detected':
                logger.warning(f"👤❌ No face detected: User {user.id} ({user.username}) - {error_details}")
            elif status == 'verification_failed':
                logger.warning(f"🔍❌ Face verification FAILED: User {user.id} ({user.username}) - Confidence: {confidence_score:.2%}")
            elif status == 'technical_error':
                logger.error(f"⚠️ Technical error in face recognition: User {user.id} ({user.username}) - {error_details}")
            else:
                logger.warning(f"❓ Unknown face recognition status: {status} for User {user.id} ({user.username})")
            
            # Detailed log for debugging (only in debug mode)
            logger.debug(f"Face recognition attempt details: {log_data}")
            
            # Here you could also save to database for audit trail if needed
            # FaceRecognitionLog.objects.create(**log_data)
            
        except Exception as e:
            # Don't let logging errors break the main functionality
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to log face recognition attempt: {str(e)}")
            pass
    
    def _get_client_ip(self, request) -> str:
        """Get client IP address from request"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip
    
    def batch_process_faces(self, image_files: List[InMemoryUploadedFile]) -> List[Dict[str, any]]:
        """
        Process multiple face images in batch
        
        Args:
            image_files: List of uploaded image files
            
        Returns:
            List of processing results
        """
        results = []
        
        for i, image_file in enumerate(image_files):
            result = self.get_face_encoding(image_file)
            result['file_index'] = i
            result['filename'] = image_file.name
            results.append(result)
        
        return results
    
    def get_face_recognition_recommendations(self, quality_metrics: Dict[str, float]) -> List[str]:
        """
        Get recommendations for improving face recognition accuracy
        
        Args:
            quality_metrics: Image quality metrics
            
        Returns:
            List of recommendations
        """
        recommendations = []
        
        if quality_metrics['brightness'] < self.settings.brightness_min:
            recommendations.append("Increase lighting - image is too dark")
        elif quality_metrics['brightness'] > self.settings.brightness_max:
            recommendations.append("Reduce lighting - image is too bright")
        
        if quality_metrics['blur_score'] < self.settings.blur_threshold:
            recommendations.append("Ensure image is sharp and in focus")
        
        if quality_metrics['contrast'] < 25:
            recommendations.append("Improve contrast - ensure face is clearly visible")
        
        if quality_metrics['quality_score'] < self.settings.quality_threshold:
            recommendations.append("Overall image quality is low - retake photo")
        
        return recommendations 