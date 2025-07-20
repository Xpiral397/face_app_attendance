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
import base64
import json
import cv2
import numpy as np
import logging

User = get_user_model()
logger = logging.getLogger(__name__)

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

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def departments_with_faces(request):
    """Get departments with face registration statistics"""
    from courses.models import Department
    from django.db.models import Count, Q
    
    user = request.user
    if user.role not in ['admin', 'lecturer']:
        return Response(
            {'error': 'Only admins and lecturers can view face registration data'}, 
            status=status.HTTP_403_FORBIDDEN
        )
    
    # Apply filters
    college_filter = request.query_params.get('college')
    department_filter = request.query_params.get('department')
    with_faces_only = request.query_params.get('with_faces_only') == 'true'
    
    # Get departments
    departments = Department.objects.all()
    
    if college_filter:
        departments = departments.filter(college=college_filter)
    
    if department_filter:
        departments = departments.filter(id=department_filter)
    
    # Build response data
    departments_data = []
    for dept in departments:
        # Get users in this department
        users_query = User.objects.filter(department=dept)
        
        # Get users with face encodings
        users_with_faces = users_query.filter(
            id__in=FaceEncoding.objects.filter(is_active=True).values_list('user_id', flat=True)
        )
        
        # If filtering for users with faces only
        if with_faces_only:
            displayed_users = users_with_faces
        else:
            displayed_users = users_query
        
        # Build user data
        users_data = []
        for user in displayed_users:
            face_encoding = FaceEncoding.objects.filter(user=user, is_active=True).first()
            
            user_data = {
                'id': user.id,
                'full_name': user.full_name,
                'username': user.username,
                'email': user.email,
                'student_id': getattr(user, 'student_id', None),
                'lecturer_id': getattr(user, 'lecturer_id', None),
                'role': user.role,
                'department': {
                    'id': dept.id,
                    'name': dept.name,
                    'code': dept.code,
                    'college': {
                        'id': dept.college.id,
                        'name': dept.college.name,
                        'code': dept.college.code,
                    }
                },
                'face_registered': bool(face_encoding),
                'face_registration_date': face_encoding.created_at if face_encoding else None,
                'last_recognition': None,  # You can add this from FaceRecognitionLog if needed
                'recognition_count': FaceRecognitionLog.objects.filter(
                    user=user, status='success'
                ).count(),
                'face_image_url': face_encoding.image.url if face_encoding and face_encoding.image else None,
            }
            users_data.append(user_data)
        
        # Only include department if it has users (when filtering)
        if not with_faces_only or users_data:
            departments_data.append({
                'id': dept.id,
                'name': dept.name,
                'code': dept.code,
                'college': {
                    'id': dept.college.id,
                    'name': dept.college.name,
                    'code': dept.college.code,
                },
                'users_with_face_data': users_data,
                'total_users': users_query.count(),
                'users_with_faces': users_with_faces.count(),
            })
    
    return Response({
        'results': departments_data,
        'total_departments': len(departments_data)
    }) 

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def verify_attendance_face(request):
    """Verify student's face for attendance marking"""
    try:
        user = request.user
        
        # Only students can verify faces for attendance
        if not (hasattr(user, 'role') and user.role == 'student'):
            return Response({'error': 'Only students can verify faces for attendance'}, status=403)
        
        # Get the captured image data
        captured_image_data = request.data.get('captured_image')
        if not captured_image_data:
            return Response({'error': 'No image data provided'}, status=400)
        
        # Check if user has registered face
        try:
            user_face_encoding = FaceEncoding.objects.get(user=user)
        except FaceEncoding.DoesNotExist:
            return Response({
                'error': 'No face registration found. Please register your face first.',
                'verified': False
            }, status=400)
        
        # Process the captured image
        try:
            # Remove data URL prefix if present
            if captured_image_data.startswith('data:image'):
                captured_image_data = captured_image_data.split(',')[1]
            
            # Decode base64 image
            image_data = base64.b64decode(captured_image_data)
            
            # Convert to OpenCV format
            nparr = np.frombuffer(image_data, np.uint8)
            captured_image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if captured_image is None:
                return Response({'error': 'Invalid image format'}, status=400)
            
        except Exception as e:
            return Response({'error': f'Error processing image: {str(e)}'}, status=400)
        
        # Initialize face recognition service
        face_service = FaceRecognitionService()
        
        # Extract face encoding from captured image
        try:
            captured_encodings = face_service.extract_face_encodings(captured_image)
            
            if not captured_encodings:
                return Response({
                    'error': 'No face detected in the captured image. Please ensure your face is clearly visible.',
                    'verified': False
                }, status=400)
            
            # Use the first detected face
            captured_encoding = captured_encodings[0]
            
        except Exception as e:
            return Response({
                'error': f'Error extracting face features: {str(e)}',
                'verified': False
            }, status=400)
        
        # Get user's registered face encoding
        try:
            user_face_encoding = FaceEncoding.objects.get(user=request.user, is_active=True)
        except FaceEncoding.DoesNotExist:
            return Response({
                'verified': False,
                'error': 'No registered face found. Please register your face first before marking attendance.',
                'error_type': 'no_registered_face',
                'redirect_to': '/face-registration'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Compare with registered face
        try:
            # Get registered encoding (it's already a list, not JSON string)
            registered_encoding = user_face_encoding.encoding
            
            # Ensure we have the right data types
            if isinstance(registered_encoding, str):
                # If it's a string, parse as JSON
                registered_encoding = json.loads(registered_encoding)
            
            # Calculate similarity
            confidence = face_service.compare_faces(
                np.array(registered_encoding),
                captured_encoding,
                threshold=0.6  # Adjustable threshold
            )
            
            # Determine if verification passed
            verification_passed = confidence >= 0.6
            
            # Log verification attempt (fix the image_file issue)
            face_service.log_recognition_attempt(
                user=request.user,
                status='success' if verification_passed else 'failed_verification',
                confidence_score=float(confidence),
                image_file=None,  # No file object for base64 data
                request=request
            )
            
            if verification_passed:
                return Response({
                    'verified': True,
                    'confidence': float(confidence),
                    'message': f'Face verification successful! Confidence: {confidence:.2%}',
                    'threshold': 0.6
                })
            else:
                return Response({
                    'verified': False,
                    'confidence': float(confidence),
                    'error': f'Face verification failed. Confidence too low: {confidence:.2%}',
                    'error_type': 'verification_failed',
                    'threshold': 0.6,
                    'suggestions': [
                        'Ensure good lighting conditions',
                        'Face the camera directly',
                        'Remove glasses or accessories if worn during registration',
                        'Re-register your face if you have significantly changed appearance'
                    ]
                }, status=status.HTTP_400_BAD_REQUEST)
            
        except Exception as e:
            # Log technical error (fix the image_file issue)
            logger.error(f"Face comparison error for user {request.user.id}: {str(e)}")
            face_service.log_recognition_attempt(
                user=request.user,
                status='technical_error',
                confidence_score=0.0,
                image_file=None,  # No file object for base64 data
                request=request,
                error_details=str(e)
            )
            
            return Response({
                'verified': False,
                'error': f'Unexpected error: {str(e)}',
                'error_type': 'technical_error',
                'suggestions': [
                    'Check your internet connection',
                    'Try again in a few moments',
                    'Contact support if the problem persists'
                ]
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
    except Exception as e:
        return Response({
            'error': f'Unexpected error: {str(e)}',
            'verified': False
        }, status=500)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def face_registration_status(request):
    """Check if user has registered their face"""
    try:
        user = request.user
        has_face_registration = FaceEncoding.objects.filter(user=user).exists()
        
        return Response({
            'has_registration': has_face_registration,
            'user_id': user.id
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=400) 


class FaceVerifyAndMarkAttendanceView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        """Verify face and mark attendance if successful"""
        from courses.models import ClassSession, ClassAttendance, Enrollment
        from django.core.exceptions import ValidationError as DjangoValidationError
        
        # Only students can mark attendance
        if not (hasattr(request.user, 'role') and request.user.role == 'student'):
            return Response({
                'success': False,
                'error': 'Only students can mark attendance via face recognition'
            }, status=status.HTTP_403_FORBIDDEN)
        
        # Get class session ID from request
        class_session_id = request.data.get('class_session_id')
        if not class_session_id:
            return Response({
                'success': False,
                'error': 'class_session_id is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate class session
        try:
            class_session = ClassSession.objects.get(id=class_session_id, is_active=True)
        except ClassSession.DoesNotExist:
            return Response({
                'success': False,
                'error': 'Invalid or inactive class session'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if student is enrolled
        enrollment = Enrollment.objects.filter(
            student=request.user,
            course_assignment=class_session.course_assignment,
            status='enrolled'
        ).first()
        
        if not enrollment:
            return Response({
                'success': False,
                'error': 'You are not enrolled in this course'
            }, status=status.HTTP_403_FORBIDDEN)
        
        # Check attendance window
        now = timezone.now()
        session_date = class_session.scheduled_date
        
        window_start = timezone.make_aware(
            timezone.datetime.combine(session_date, class_session.attendance_window_start)
        )
        window_end = timezone.make_aware(
            timezone.datetime.combine(session_date, class_session.attendance_window_end)
        )
        
        if now < window_start:
            return Response({
                'success': False,
                'error': 'Attendance window has not opened yet',
                'window_start': window_start.isoformat(),
                'current_time': now.isoformat()
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if now > window_end:
            return Response({
                'success': False,
                'error': 'Attendance window has closed',
                'window_end': window_end.isoformat(),
                'current_time': now.isoformat()
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Check for existing attendance
        existing_attendance = ClassAttendance.objects.filter(
            student=request.user,
            class_session=class_session
        ).first()
        
        if existing_attendance:
            return Response({
                'success': False,
                'error': 'Attendance already marked for this session',
                'error_type': 'already_marked',
                'details': {
                    'status': existing_attendance.status,
                    'marked_at': existing_attendance.marked_at.isoformat(),
                    'face_verified': existing_attendance.face_verified,
                    'session_title': class_session.title,
                    'course_code': class_session.course_assignment.course.code
                }
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Process face verification
        if 'image' not in request.FILES:
            return Response({
                'success': False,
                'error': 'No image file provided'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Get user's face encoding
        try:
            face_encoding = FaceEncoding.objects.get(user=request.user, is_active=True)
        except FaceEncoding.DoesNotExist:
            return Response({
                'success': False,
                'error': 'No face encoding found. Please register your face first',
                'redirect_to': '/face-registration'
            }, status=status.HTTP_400_BAD_REQUEST)

        image_file = request.FILES['image']
        face_service = FaceRecognitionService()

        # Process uploaded image
        result = face_service.get_face_encoding(image_file)

        if not result['success']:
            # Log failed attempt
            face_service.log_recognition_attempt(
                user=request.user,
                status='no_face' if 'No face detected' in result.get('error', '') else 'failed',
                confidence_score=0.0,
                image_file=image_file,
                request=request
            )
            return Response({
                'success': False,
                'error': result.get('error', 'Face processing failed')
            }, status=status.HTTP_400_BAD_REQUEST)

        # Compare faces
        comparison_result = face_service.compare_faces(
            face_encoding.encoding,
            result['encoding']
        )

        if not comparison_result['is_match']:
            # Log failed recognition
            face_service.log_recognition_attempt(
                user=request.user,
                status='failed_verification',
                confidence_score=comparison_result['confidence'],
                image_file=image_file,
                request=request
            )
            return Response({
                'success': False,
                'verified': False,
                'error': 'Face verification failed. Face does not match registered face.',
                'confidence': comparison_result['confidence'],
                'threshold': comparison_result.get('tolerance', 0.6),
                'suggestions': [
                    'Ensure good lighting conditions',
                    'Face the camera directly',
                    'Remove glasses or accessories if worn during registration',
                    'Try again with a clearer image'
                ]
            }, status=status.HTTP_400_BAD_REQUEST)

        # Face verification successful - mark attendance
        try:
            with transaction.atomic():
                # Determine attendance status
                session_start = timezone.make_aware(
                    timezone.datetime.combine(session_date, class_session.start_time)
                )
                attendance_status = 'late' if now > session_start else 'present'
                
                # Create attendance record
                attendance = ClassAttendance.objects.create(
                    student=request.user,
                    class_session=class_session,
                    status=attendance_status,
                    face_verified=True,
                    notes=f"Marked via face recognition. Confidence: {comparison_result['confidence']:.2%}"
                )
                
                # Save captured image for audit trail
                try:
                    import base64
                    import os
                    from django.conf import settings
                    from datetime import datetime
                    
                    # Create unique filename
                    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                    filename = f"attendance_{request.user.id}_{class_session.id}_{timestamp}.jpg"
                    
                    # Ensure directory exists
                    media_dir = os.path.join(settings.MEDIA_ROOT, 'attendance_photos')
                    os.makedirs(media_dir, exist_ok=True)
                    
                    # Save image file
                    image_path = os.path.join(media_dir, filename)
                    with open(image_path, 'wb') as f:
                        for chunk in image_file.chunks():
                            f.write(chunk)
                    
                    # Update attendance notes with image info
                    attendance.notes += f"\nCaptured image: {filename}"
                    attendance.save()
                    
                except Exception as e:
                    # Don't fail attendance saving if image saving fails
                    attendance.notes += f"\nImage save failed: {str(e)}"
                    attendance.save()

                # Log successful recognition and attendance marking
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
                    'verified': True,
                    'message': f'Attendance marked successfully via face recognition!',
                    'attendance': {
                        'id': attendance.id,
                        'status': attendance.status,
                        'marked_at': attendance.marked_at.isoformat(),
                        'face_verified': attendance.face_verified,
                        'session_title': class_session.title,
                        'course_code': class_session.course_assignment.course.code,
                        'course_title': class_session.course_assignment.course.title
                    },
                    'verification': {
                        'confidence': comparison_result['confidence'],
                        'threshold': comparison_result.get('tolerance', 0.6)
                    }
                })

        except Exception as e:
            logger.error(f"Failed to mark attendance: {str(e)}")
            return Response({
                'success': False,
                'error': f'Failed to mark attendance: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR) 