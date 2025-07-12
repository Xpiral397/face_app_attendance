from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.db import transaction
from .models import FaceEncoding, FaceRecognitionLog, FaceDetectionSettings, FaceRecognitionStats
from .services import FaceRecognitionService
from attendance.models import Attendance

User = get_user_model()

class FaceRegistrationView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    
    def post(self, request):
        """Register face encoding for user"""
        if 'image' not in request.FILES:
            return Response(
                {'error': 'No image file provided'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        image_file = request.FILES['image']
        face_service = FaceRecognitionService()
        
        # Process face encoding
        result = face_service.get_face_encoding(image_file)
        
        if not result['success']:
            # Log failed attempt
            face_service.log_recognition_attempt(
                user=request.user,
                status='failed',
                confidence_score=0.0,
                image_file=image_file,
                request=request
            )
            return Response(result, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            with transaction.atomic():
                # Update or create face encoding
                face_encoding, created = FaceEncoding.objects.update_or_create(
                    user=request.user,
                    defaults={
                        'encoding': result['encoding'],
                        'confidence_score': result['confidence_score'],
                        'quality_score': result['quality_metrics']['quality_score'],
                        'image': image_file,
                        'is_active': True
                    }
                )
                
                # Log successful registration
                face_service.log_recognition_attempt(
                    user=request.user,
                    status='success',
                    confidence_score=result['confidence_score'],
                    image_file=image_file,
                    request=request
                )
                
                # Get or create recognition stats
                stats, _ = FaceRecognitionStats.objects.get_or_create(user=request.user)
                stats.update_stats()
                
                return Response({
                    'success': True,
                    'message': 'Face registered successfully',
                    'created': created,
                    'confidence_score': result['confidence_score'],
                    'quality_score': result['quality_metrics']['quality_score'],
                    'recommendations': face_service.get_face_recognition_recommendations(
                        result['quality_metrics']
                    )
                })
                
        except Exception as e:
            return Response(
                {'error': f'Failed to save face encoding: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class FaceRecognitionAttendanceView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    
    def post(self, request):
        """Mark attendance using face recognition"""
        if request.user.role != 'student':
            return Response(
                {'error': 'Only students can mark attendance'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        if 'image' not in request.FILES:
            return Response(
                {'error': 'No image file provided'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if attendance already marked today
        today = timezone.now().date()
        existing_attendance = Attendance.objects.filter(
            user=request.user,
            timestamp__date=today
        ).exists()
        
        if existing_attendance:
            return Response(
                {'error': 'Attendance already marked for today'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get user's face encoding
        try:
            face_encoding = FaceEncoding.objects.get(user=request.user, is_active=True)
        except FaceEncoding.DoesNotExist:
            return Response(
                {'error': 'No face encoding found. Please register your face first'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        image_file = request.FILES['image']
        face_service = FaceRecognitionService()
        
        # Process uploaded image
        result = face_service.get_face_encoding(image_file)
        
        if not result['success']:
            # Log failed attempt
            face_service.log_recognition_attempt(
                user=request.user,
                status='no_face' if 'No face detected' in result['error'] else 'failed',
                confidence_score=0.0,
                image_file=image_file,
                request=request
            )
            return Response(result, status=status.HTTP_400_BAD_REQUEST)
        
        # Compare faces
        comparison_result = face_service.compare_faces(
            face_encoding.encoding,
            result['encoding']
        )
        
        if not comparison_result['is_match']:
            # Log failed recognition
            face_service.log_recognition_attempt(
                user=request.user,
                status='failed',
                confidence_score=comparison_result['confidence'],
                image_file=image_file,
                request=request
            )
            return Response({
                'success': False,
                'error': 'Face does not match registered face',
                'confidence': comparison_result['confidence'],
                'distance': comparison_result['distance']
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            with transaction.atomic():
                # Mark attendance
                attendance = Attendance.objects.create(
                    user=request.user,
                    timestamp=timezone.now(),
                    status='present'
                )
                
                # Log successful recognition
                face_service.log_recognition_attempt(
                    user=request.user,
                    status='success',
                    confidence_score=comparison_result['confidence'],
                    image_file=image_file,
                    request=request
                )
                
                # Update recognition stats
                stats, _ = FaceRecognitionStats.objects.get_or_create(user=request.user)
                stats.update_stats()
                
                return Response({
                    'success': True,
                    'message': 'Attendance marked successfully',
                    'attendance_id': attendance.id,
                    'confidence': comparison_result['confidence'],
                    'timestamp': attendance.timestamp
                })
                
        except Exception as e:
            return Response(
                {'error': f'Failed to mark attendance: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class FaceRecognitionVerifyView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    
    def post(self, request):
        """Verify face without marking attendance"""
        if 'image' not in request.FILES:
            return Response(
                {'error': 'No image file provided'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get user's face encoding
        try:
            face_encoding = FaceEncoding.objects.get(user=request.user, is_active=True)
        except FaceEncoding.DoesNotExist:
            return Response(
                {'error': 'No face encoding found. Please register your face first'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        image_file = request.FILES['image']
        face_service = FaceRecognitionService()
        
        # Process uploaded image
        result = face_service.get_face_encoding(image_file)
        
        if not result['success']:
            return Response(result, status=status.HTTP_400_BAD_REQUEST)
        
        # Compare faces
        comparison_result = face_service.compare_faces(
            face_encoding.encoding,
            result['encoding']
        )
        
        return Response({
            'is_match': comparison_result['is_match'],
            'confidence': comparison_result['confidence'],
            'distance': comparison_result['distance'],
            'tolerance': comparison_result['tolerance'],
            'quality_metrics': result['quality_metrics']
        })

class FaceRecognitionStatsView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        """Get face recognition statistics"""
        try:
            stats = FaceRecognitionStats.objects.get(user=request.user)
            stats.update_stats()
            
            return Response({
                'total_attempts': stats.total_attempts,
                'successful_recognitions': stats.successful_recognitions,
                'failed_recognitions': stats.failed_recognitions,
                'success_rate': stats.success_rate,
                'last_recognition': stats.last_recognition
            })
        except FaceRecognitionStats.DoesNotExist:
            return Response({
                'total_attempts': 0,
                'successful_recognitions': 0,
                'failed_recognitions': 0,
                'success_rate': 0.0,
                'last_recognition': None
            })

class FaceRecognitionSettingsView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        """Get face recognition settings"""
        if request.user.role != 'admin':
            return Response(
                {'error': 'Only admins can view settings'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        settings = FaceDetectionSettings.get_active_settings()
        if not settings:
            return Response({'error': 'No settings found'}, status=status.HTTP_404_NOT_FOUND)
        
        return Response({
            'tolerance': settings.tolerance,
            'min_face_size': settings.min_face_size,
            'max_file_size': settings.max_file_size,
            'allowed_formats': settings.allowed_formats,
            'quality_threshold': settings.quality_threshold,
            'blur_threshold': settings.blur_threshold,
            'brightness_min': settings.brightness_min,
            'brightness_max': settings.brightness_max
        })
    
    def post(self, request):
        """Update face recognition settings"""
        if request.user.role != 'admin':
            return Response(
                {'error': 'Only admins can update settings'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Deactivate current settings
        FaceDetectionSettings.objects.filter(is_active=True).update(is_active=False)
        
        # Create new settings
        settings = FaceDetectionSettings.objects.create(
            tolerance=request.data.get('tolerance', 0.6),
            min_face_size=request.data.get('min_face_size', 100),
            max_file_size=request.data.get('max_file_size', 10485760),
            allowed_formats=request.data.get('allowed_formats', ['jpg', 'jpeg', 'png', 'gif', 'webp']),
            quality_threshold=request.data.get('quality_threshold', 0.5),
            blur_threshold=request.data.get('blur_threshold', 100.0),
            brightness_min=request.data.get('brightness_min', 50.0),
            brightness_max=request.data.get('brightness_max', 200.0),
            is_active=True
        )
        
        return Response({
            'message': 'Settings updated successfully',
            'settings_id': settings.id
        })

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def face_recognition_logs(request):
    """Get face recognition logs"""
    user = request.user
    if user.role == 'student':
        logs = FaceRecognitionLog.objects.filter(user=user)
    else:  # admin
        logs = FaceRecognitionLog.objects.all()
    
    # Apply filters
    status_filter = request.query_params.get('status')
    if status_filter:
        logs = logs.filter(status=status_filter)
    
    start_date = request.query_params.get('start_date')
    if start_date:
        logs = logs.filter(timestamp__date__gte=start_date)
    
    end_date = request.query_params.get('end_date')
    if end_date:
        logs = logs.filter(timestamp__date__lte=end_date)
    
    # Paginate results
    logs = logs.order_by('-timestamp')[:50]
    
    log_data = []
    for log in logs:
        log_data.append({
            'id': log.id,
            'user': log.user.full_name,
            'status': log.status,
            'confidence_score': log.confidence_score,
            'timestamp': log.timestamp,
            'ip_address': log.ip_address
        })
    
    return Response({
        'logs': log_data,
        'total': len(log_data)
    })

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def validate_image_quality(request):
    """Validate image quality for face recognition"""
    if 'image' not in request.FILES:
        return Response(
            {'error': 'No image file provided'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    image_file = request.FILES['image']
    face_service = FaceRecognitionService()
    
    # Validate image
    validation_result = face_service.validate_image(image_file)
    
    if not validation_result['is_valid']:
        return Response(validation_result, status=status.HTTP_400_BAD_REQUEST)
    
    # Analyze quality
    result = face_service.get_face_encoding(image_file)
    
    if result['success']:
        recommendations = face_service.get_face_recognition_recommendations(
            result['quality_metrics']
        )
        return Response({
            'is_valid': True,
            'quality_metrics': result['quality_metrics'],
            'recommendations': recommendations,
            'file_info': validation_result['file_info']
        })
    else:
        return Response(result, status=status.HTTP_400_BAD_REQUEST) 