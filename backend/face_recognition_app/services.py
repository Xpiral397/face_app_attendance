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
    
    def compare_faces(self, known_encoding: List[float], unknown_encoding: List[float]) -> Dict[str, any]:
        """
        Compare two face encodings
        
        Args:
            known_encoding: Stored face encoding
            unknown_encoding: New face encoding to compare
            
        Returns:
            Dictionary with comparison results
        """
        try:
            # Convert to numpy arrays
            known_encoding_array = np.array(known_encoding)
            unknown_encoding_array = np.array(unknown_encoding)
            
            # Calculate distance
            distance = face_recognition.face_distance([known_encoding_array], unknown_encoding_array)[0]
            
            # Determine if faces match
            is_match = distance <= self.settings.tolerance
            
            # Calculate confidence percentage
            confidence = max(0, (1 - distance) * 100)
            
            return {
                'is_match': is_match,
                'distance': float(distance),
                'confidence': float(confidence),
                'tolerance': self.settings.tolerance
            }
            
        except Exception as e:
            logger.error(f"Error comparing faces: {str(e)}")
            return {
                'is_match': False,
                'distance': 1.0,
                'confidence': 0.0,
                'error': str(e)
            }
    
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
    
    def log_recognition_attempt(self, user, status: str, confidence_score: float = 0.0, 
                              image_file: Optional[InMemoryUploadedFile] = None,
                              request = None) -> 'FaceRecognitionLog':
        """
        Log face recognition attempt
        
        Args:
            user: User object
            status: Recognition status
            confidence_score: Confidence score of recognition
            image_file: Optional image file
            request: Optional request object for IP and user agent
            
        Returns:
            FaceRecognitionLog object
        """
        log_data = {
            'user': user,
            'status': status,
            'confidence_score': confidence_score,
        }
        
        if request:
            log_data['ip_address'] = self._get_client_ip(request)
            log_data['user_agent'] = request.META.get('HTTP_USER_AGENT', '')
        
        if image_file:
            log_data['image'] = image_file
        
        return FaceRecognitionLog.objects.create(**log_data)
    
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