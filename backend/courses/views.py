from rest_framework import generics, status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import Q, Count
from django.utils import timezone
from django.shortcuts import get_object_or_404
from django.db import transaction
from datetime import datetime, timedelta, time
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters
from django.contrib.auth import get_user_model
from rest_framework.exceptions import ValidationError
from django.http import HttpResponse
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus.flowables import Flowable
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.pdfgen import canvas
from io import BytesIO
from datetime import datetime

from .models import (
    College, Department, Course, CourseAssignment, 
    Enrollment, ClassSession, Notification, ClassAttendance, Room
)
from .serializers import (
    CollegeSerializer, DepartmentSerializer, CourseSerializer, 
    CourseAssignmentSerializer, EnrollmentSerializer, 
    ClassSessionSerializer, NotificationSerializer, ClassAttendanceSerializer, RoomSerializer, UserBasicSerializer
)
from face_recognition_app.models import FaceEncoding

User = get_user_model()

# Custom permission classes
class PublicReadWriteAuthPermission(permissions.BasePermission):
    """
    Allow public read access but require authentication for write operations
    """
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user and request.user.is_authenticated

class AdminWritePublicReadPermission(permissions.BasePermission):
    """
    Allow public read access but require admin authentication for write operations
    """
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user and request.user.is_authenticated and getattr(request.user, 'role', None) == 'admin'

# Room Management Views
class RoomListCreateView(generics.ListCreateAPIView):
    queryset = Room.objects.filter(is_available=True)
    serializer_class = RoomSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['room_type', 'building', 'floor']
    search_fields = ['code', 'name', 'building', 'location']
    
    def get_queryset(self):
        return Room.objects.filter(is_available=True).order_by('building', 'floor', 'code')
    
    def perform_create(self, serializer):
        # Only admins can create rooms
        if not hasattr(self.request.user, 'role') or self.request.user.role != 'admin':
            raise permissions.PermissionDenied("Only admins can create rooms")
        serializer.save(created_by=self.request.user)

class RoomDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Room.objects.filter(is_available=True)
    serializer_class = RoomSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def perform_update(self, serializer):
        # Only admins can update rooms
        if not hasattr(self.request.user, 'role') or self.request.user.role != 'admin':
            raise permissions.PermissionDenied("Only admins can update rooms")
        serializer.save()
    
    def perform_destroy(self, instance):
        # Only admins can delete rooms
        if not hasattr(self.request.user, 'role') or self.request.user.role != 'admin':
            raise permissions.PermissionDenied("Only admins can delete rooms")
        instance.is_available = False
        instance.save()

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def check_room_availability(request):
    """Check room availability for specific date and time"""
    room_id = request.query_params.get('room_id')
    date = request.query_params.get('date')
    start_time = request.query_params.get('start_time')
    end_time = request.query_params.get('end_time')
    session_id = request.query_params.get('session_id')  # Exclude current session when editing
    
    if not all([room_id, date, start_time, end_time]):
        return Response({'error': 'Missing required parameters'}, status=400)
    
    try:
        room = Room.objects.get(id=room_id)
        conflicts = ClassSession.objects.filter(
            room=room,
            scheduled_date=date,
            is_active=True,
            is_cancelled=False
        )
        
        if session_id:
            conflicts = conflicts.exclude(id=session_id)
        
        start_time_obj = datetime.strptime(start_time, '%H:%M').time()
        end_time_obj = datetime.strptime(end_time, '%H:%M').time()
        
        conflicting_sessions = []
        for session in conflicts:
            if (start_time_obj < session.end_time and end_time_obj > session.start_time):
                conflicting_sessions.append({
                    'id': session.id,
                    'title': session.title,
                    'course': session.course_assignment.course.code,
                    'start_time': session.start_time,
                    'end_time': session.end_time
                })
        
        return Response({
            'room': {
                'id': room.id,
                'name': room.name,
                'code': room.code
            },
            'is_available': len(conflicting_sessions) == 0,
            'conflicts': conflicting_sessions
        })
        
    except Room.DoesNotExist:
        return Response({'error': 'Room not found'}, status=404)
    except Exception as e:
        return Response({'error': str(e)}, status=400)

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def lecturer_free_times(request):
    """Find free time slots for a lecturer"""
    lecturer_id = request.query_params.get('lecturer_id')
    date = request.query_params.get('date')
    duration = int(request.query_params.get('duration', 120))  # Duration in minutes
    
    if not all([lecturer_id, date]):
        return Response({'error': 'Missing required parameters'}, status=400)
    
    try:
        lecturer = User.objects.get(id=lecturer_id, role='lecturer')
        
        # Get lecturer's existing sessions for the date
        existing_sessions = ClassSession.objects.filter(
            course_assignment__lecturer=lecturer,
            scheduled_date=date,
            is_active=True,
            is_cancelled=False
        ).order_by('start_time')
        
        # Define working hours (8 AM to 6 PM)
        working_start = time(8, 0)
        working_end = time(18, 0)
        
        free_slots = []
        current_time = working_start
        
        for session in existing_sessions:
            # Check if there's a gap before this session
            if current_time < session.start_time:
                gap_minutes = (datetime.combine(datetime.today(), session.start_time) - 
                             datetime.combine(datetime.today(), current_time)).seconds // 60
                
                if gap_minutes >= duration:
                    free_slots.append({
                        'start_time': current_time.strftime('%H:%M'),
                        'end_time': session.start_time.strftime('%H:%M'),
                        'duration_minutes': gap_minutes
                    })
            
            current_time = max(current_time, session.end_time)
        
        # Check for time after the last session
        if current_time < working_end:
            remaining_minutes = (datetime.combine(datetime.today(), working_end) - 
                               datetime.combine(datetime.today(), current_time)).seconds // 60
            
            if remaining_minutes >= duration:
                free_slots.append({
                    'start_time': current_time.strftime('%H:%M'),
                    'end_time': working_end.strftime('%H:%M'),
                    'duration_minutes': remaining_minutes
                })
        
        return Response({
            'lecturer': {
                'id': lecturer.id,
                'name': lecturer.full_name
            },
            'date': date,
            'free_slots': free_slots,
            'existing_sessions': [
                {
                    'title': session.title,
                    'course': session.course_assignment.course.code,
                    'start_time': session.start_time.strftime('%H:%M'),
                    'end_time': session.end_time.strftime('%H:%M')
                }
                for session in existing_sessions
            ]
        })
        
    except User.DoesNotExist:
        return Response({'error': 'Lecturer not found'}, status=404)
    except Exception as e:
        return Response({'error': str(e)}, status=400)

# College and Department Views
class CollegeListCreateView(generics.ListCreateAPIView):
    queryset = College.objects.filter(is_active=True)
    serializer_class = CollegeSerializer
    permission_classes = [AdminWritePublicReadPermission]
    
    def perform_create(self, serializer):
        # Only admins can create colleges
        if self.request.user.role != 'admin':
            return Response({'error': 'Only admins can create colleges'}, status=403)
        serializer.save()

class CollegeDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = College.objects.all()
    serializer_class = CollegeSerializer
    permission_classes = [AdminWritePublicReadPermission]
    
    def perform_update(self, serializer):
        if self.request.user.role != 'admin':
            return Response({'error': 'Only admins can update colleges'}, status=403)
        serializer.save()
    
    def perform_destroy(self, instance):
        if self.request.user.role != 'admin':
            return Response({'error': 'Only admins can delete colleges'}, status=403)
        instance.is_active = False
        instance.save()

class DepartmentListCreateView(generics.ListCreateAPIView):
    queryset = Department.objects.filter(is_active=True)
    serializer_class = DepartmentSerializer
    permission_classes = [AdminWritePublicReadPermission]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['college']
    
    def perform_create(self, serializer):
        # Only admins can create departments
        if self.request.user.role != 'admin':
            return Response({'error': 'Only admins can create departments'}, status=403)
        serializer.save()

class DepartmentDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    permission_classes = [AdminWritePublicReadPermission]
    
    def perform_update(self, serializer):
        if self.request.user.role != 'admin':
            return Response({'error': 'Only admins can update departments'}, status=403)
        serializer.save()
    
    def perform_destroy(self, instance):
        if self.request.user.role != 'admin':
            return Response({'error': 'Only admins can delete departments'}, status=403)
        instance.is_active = False
        instance.save()

# Course Management Views
class CourseListCreateView(generics.ListCreateAPIView):
    serializer_class = CourseSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['department', 'level']
    search_fields = ['code', 'title', 'department__name']
    
    def get_queryset(self):
        queryset = Course.objects.filter(is_active=True)
        user = self.request.user
        
        # Students see courses from their department and level
        if hasattr(user, 'role') and user.role == 'student':
            queryset = queryset.filter(
                department=user.department,
                level=user.level
            )
        
        return queryset
    
    def perform_create(self, serializer):
        if not hasattr(self.request.user, 'role') or self.request.user.role != 'admin':
            raise permissions.PermissionDenied("Only admins can create courses")
        serializer.save(created_by=self.request.user)

class CourseDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Course.objects.all()
    serializer_class = CourseSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def perform_update(self, serializer):
        if not hasattr(self.request.user, 'role') or self.request.user.role != 'admin':
            raise permissions.PermissionDenied("Only admins can update courses")
        serializer.save()
    
    def perform_destroy(self, instance):
        if not hasattr(self.request.user, 'role') or self.request.user.role != 'admin':
            raise permissions.PermissionDenied("Only admins can delete courses")
        instance.is_active = False
        instance.save()

# Course Assignment Views
class CourseAssignmentListCreateView(generics.ListCreateAPIView):
    serializer_class = CourseAssignmentSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['course', 'academic_year', 'semester']  # Remove 'lecturer' from here
    search_fields = ['course__code', 'course__title', 'lecturer__full_name']
    
    def get_queryset(self):
        queryset = CourseAssignment.objects.filter(is_active=True)
        
        # Handle lecturer parameter
        lecturer_param = self.request.query_params.get('lecturer')
        if lecturer_param == 'me':
            # Filter by current user if they are a lecturer
            if hasattr(self.request.user, 'role') and self.request.user.role == 'lecturer':
                queryset = queryset.filter(lecturer=self.request.user)
        elif lecturer_param:
            # Filter by specific lecturer ID
            queryset = queryset.filter(lecturer_id=lecturer_param)
        elif hasattr(self.request.user, 'role') and self.request.user.role == 'lecturer':
            # For lecturers without specific filter, show only their assignments
            queryset = queryset.filter(lecturer=self.request.user)
        
        return queryset.select_related('course', 'lecturer', 'assigned_by')
    
    def perform_create(self, serializer):
        # Only admins can create course assignments
        if not hasattr(self.request.user, 'role') or self.request.user.role != 'admin':
            raise permissions.PermissionDenied("Only admins can create course assignments")
        serializer.save(assigned_by=self.request.user)

class CourseAssignmentDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = CourseAssignment.objects.filter(is_active=True)
    serializer_class = CourseAssignmentSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def perform_update(self, serializer):
        if not hasattr(self.request.user, 'role') or self.request.user.role != 'admin':
            raise permissions.PermissionDenied("Only admins can update course assignments")
        serializer.save()
    
    def perform_destroy(self, instance):
        if not hasattr(self.request.user, 'role') or self.request.user.role != 'admin':
            raise permissions.PermissionDenied("Only admins can delete course assignments")
        instance.is_active = False
        instance.save()

# Enrollment Views
class EnrollmentListCreateView(generics.ListCreateAPIView):
    serializer_class = EnrollmentSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status', 'course_assignment']
    
    def get_queryset(self):
        user = self.request.user
        
        if hasattr(user, 'role') and user.role == 'admin':
            return Enrollment.objects.all().select_related('student', 'course_assignment')
        elif hasattr(user, 'role') and user.role == 'lecturer':
            return Enrollment.objects.filter(
                course_assignment__lecturer=user
            ).select_related('student', 'course_assignment')
        else:  # Student
            return Enrollment.objects.filter(student=user).select_related('course_assignment')
    
    def perform_create(self, serializer):
        # Students can only enroll themselves
        if hasattr(self.request.user, 'role') and self.request.user.role == 'student':
            # Get course_assignment_id from request data
            course_assignment_id = self.request.data.get('course_assignment_id')
            if course_assignment_id:
                try:
                    course_assignment = CourseAssignment.objects.get(id=course_assignment_id)
                    serializer.save(
                        student=self.request.user,
                        course_assignment=course_assignment,
                        enrolled_by=self.request.user
                    )
                except CourseAssignment.DoesNotExist:
                    raise ValidationError("Course assignment not found")
            else:
                raise ValidationError("course_assignment_id is required")
        elif hasattr(self.request.user, 'role') and self.request.user.role == 'admin':
            serializer.save()
        else:
            raise permissions.PermissionDenied("You cannot create enrollments")

class EnrollmentDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = EnrollmentSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        
        if hasattr(user, 'role') and user.role == 'admin':
            return Enrollment.objects.all()
        elif hasattr(user, 'role') and user.role == 'lecturer':
            return Enrollment.objects.filter(course_assignment__lecturer=user)
        else:  # Student
            return Enrollment.objects.filter(student=user)

# Notification Views
class NotificationListView(generics.ListAPIView):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['is_read', 'notification_type']
    
    def get_queryset(self):
        return Notification.objects.filter(
            recipient=self.request.user
        ).order_by('-created_at')

class NotificationDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        return Notification.objects.filter(recipient=self.request.user)

# Session Management Views
class ClassSessionListCreateView(generics.ListCreateAPIView):
    """List and create class sessions"""
    serializer_class = ClassSessionSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        queryset = ClassSession.objects.filter(is_active=True)
        
        # Filter by date if provided
        scheduled_date = self.request.query_params.get('scheduled_date')
        if scheduled_date:
            queryset = queryset.filter(scheduled_date=scheduled_date)
        
        # Filter by course assignment if provided
        course_assignment = self.request.query_params.get('course_assignment')
        if course_assignment:
            queryset = queryset.filter(course_assignment=course_assignment)
        
        return queryset.order_by('scheduled_date', 'start_time')
    
    def list(self, request, *args, **kwargs):
        """Override list to add attendance status for students"""
        response = super().list(request, *args, **kwargs)
        
        # If user is a student, add their attendance status to each session
        if hasattr(request.user, 'role') and request.user.role == 'student':
            sessions_data = response.data.get('results', response.data)
            
            for session_data in sessions_data:
                session_id = session_data.get('id')
                
                # Check if student has attendance for this session
                try:
                    from .models import ClassAttendance
                    attendance = ClassAttendance.objects.get(
                        class_session_id=session_id,
                        student=request.user
                    )
                    session_data['user_attendance'] = {
                        'id': attendance.id,
                        'status': attendance.status,
                        'marked_at': attendance.marked_at.isoformat(),
                        'face_verified': attendance.face_verified,
                        'notes': attendance.notes
                    }
                except ClassAttendance.DoesNotExist:
                    session_data['user_attendance'] = None
        
        return response
    
    def perform_create(self, serializer):
        # Only lecturers and admins can create sessions
        if not hasattr(self.request.user, 'role') or self.request.user.role not in ['lecturer', 'admin']:
            raise permissions.PermissionDenied("Only lecturers and admins can create sessions")
        
        # For lecturers, ensure they can only create sessions for their assigned courses
        if self.request.user.role == 'lecturer':
            course_assignment_id = serializer.validated_data.get('course_assignment_id')
            if not CourseAssignment.objects.filter(
                id=course_assignment_id,
                lecturer=self.request.user,
                is_active=True
            ).exists():
                raise permissions.PermissionDenied("You can only create sessions for courses assigned to you")
        
        # Check for conflicts before creating
        session_data = serializer.validated_data
        temp_session = ClassSession(**session_data)
        conflicts = temp_session.check_conflicts()
        
        if conflicts:
            from rest_framework import serializers as drf_serializers
            conflict_messages = [conflict['message'] for conflict in conflicts]
            raise drf_serializers.ValidationError({
                'conflicts': conflict_messages,
                'details': conflicts
            })
        
        # Create the session
        session = serializer.save(created_by=self.request.user)
        
        # Create notifications for enrolled students
        enrolled_students = User.objects.filter(
            enrollments__course_assignment=session.course_assignment,
            enrollments__status='enrolled'
        ).distinct()
        
        for student in enrolled_students:
            Notification.objects.create(
                    recipient=student,
                    sender=self.request.user,
                    notification_type='class_scheduled',
                    title=f'New Class: {session.course_assignment.course.code}',
                    message=f'A new class "{session.title}" has been scheduled for {session.scheduled_date} at {session.start_time} in {session.effective_location}.',
                    related_class_session=session
                )
        
        # Create recurring sessions if specified
        if session.is_recurring and session.recurrence_pattern != 'none':
            self.create_recurring_sessions(session)
    
    def create_recurring_sessions(self, parent_session):
        """Create recurring sessions based on the parent session"""
        try:
            from dateutil.relativedelta import relativedelta
        except ImportError:
            # Fallback if dateutil is not installed
            from datetime import timedelta as relativedelta
        
        current_date = parent_session.scheduled_date
        end_date = parent_session.recurrence_end_date
        
        # Determine the increment based on recurrence pattern
        if parent_session.recurrence_pattern == 'daily':
            increment = timedelta(days=1)
        elif parent_session.recurrence_pattern == 'weekly':
            increment = timedelta(weeks=1)
        elif parent_session.recurrence_pattern == 'biweekly':
            increment = timedelta(weeks=2)
        elif parent_session.recurrence_pattern == 'monthly':
            try:
                increment = relativedelta(months=1)
            except:
                increment = timedelta(days=30)  # Fallback
        else:
            return
        
        created_sessions = []
        if isinstance(increment, timedelta):
            current_date += increment
        else:
            current_date = current_date + increment
        
        while current_date <= end_date:
            # Create a copy of the parent session
            recurring_session = ClassSession(
                course_assignment=parent_session.course_assignment,
                title=parent_session.title,
                description=parent_session.description,
                class_type=parent_session.class_type,
                scheduled_date=current_date,
                start_time=parent_session.start_time,
                end_time=parent_session.end_time,
                timezone=parent_session.timezone,
                room=parent_session.room,
                custom_location=parent_session.custom_location,
                meeting_link=parent_session.meeting_link,
                meeting_id=parent_session.meeting_id,
                meeting_passcode=parent_session.meeting_passcode,
                attendance_window_start=parent_session.attendance_window_start,
                attendance_window_end=parent_session.attendance_window_end,
                attendance_required=parent_session.attendance_required,
                attendance_method=parent_session.attendance_method,
                is_recurring=False,  # Individual sessions are not recurring
                parent_session=parent_session,
                max_capacity=parent_session.max_capacity,
                created_by=parent_session.created_by
            )
            
            # Check for conflicts for this specific date
            conflicts = recurring_session.check_conflicts()
            if not conflicts:  # Only create if no conflicts
                recurring_session.save()
                created_sessions.append(recurring_session)
            
            if isinstance(increment, timedelta):
                current_date += increment
            else:
                current_date = current_date + increment
        
        return created_sessions

class ClassSessionDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ClassSessionSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        queryset = ClassSession.objects.filter(is_active=True)
        
        # Filter by lecturer for lecturers
        if hasattr(self.request.user, 'role') and self.request.user.role == 'lecturer':
            queryset = queryset.filter(course_assignment__lecturer=self.request.user)
        
        return queryset.select_related('course_assignment__course', 'course_assignment__lecturer', 'room')
    
    def perform_update(self, serializer):
        # Only the creator or admin can update
        session = self.get_object()
        if (self.request.user != session.created_by and 
            (not hasattr(self.request.user, 'role') or self.request.user.role != 'admin')):
            raise permissions.PermissionDenied("You can only update sessions you created")
        
        # Check for conflicts before updating
        session_data = serializer.validated_data
        temp_session = ClassSession(**session_data)
        temp_session.id = session.id
        conflicts = temp_session.check_conflicts()
        
        if conflicts:
            from rest_framework import serializers as drf_serializers
            conflict_messages = [conflict['message'] for conflict in conflicts]
            raise drf_serializers.ValidationError({
                'conflicts': conflict_messages,
                'details': conflicts
            })
        
        serializer.save()
    
    def perform_destroy(self, instance):
        # Only the creator or admin can delete
        if (self.request.user != instance.created_by and 
            (not hasattr(self.request.user, 'role') or self.request.user.role != 'admin')):
            raise permissions.PermissionDenied("You can only delete sessions you created")
        
        # If this is a parent session with recurring sessions, ask for confirmation
        if instance.is_recurring and instance.recurring_sessions.exists():
            delete_all = self.request.query_params.get('delete_all', 'false').lower() == 'true'
            if delete_all:
                # Delete all recurring sessions
                instance.recurring_sessions.update(is_active=False)
        
        instance.is_active = False
        instance.save()

# Additional helper views for session management
@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def available_courses_for_assignment(request):
    """Get courses that are available for assignment (not assigned or can have multiple lecturers)"""
    try:
        user = request.user
        
        # Only admins can see all available courses
        if not (hasattr(user, 'role') and user.role == 'admin'):
            return Response({'error': 'Only admins can view available courses'}, status=403)
        
        # Get courses that either have no assignment or can have multiple lecturers
        courses = Course.objects.filter(is_active=True)
        
        available_courses = []
        for course in courses:
            assignments = CourseAssignment.objects.filter(course=course, is_active=True)
            if assignments.count() == 0:  # No lecturer assigned
                available_courses.append({
                    'id': course.id,
                    'code': course.code,
                    'title': course.title,
                    'department': course.department.name if course.department else 'N/A',
                    'level': course.level,
                    'credit_units': course.credit_units,
                    'assigned_lecturers': 0
                })
            else:  # Has lecturers but might accept more
                lecturer_names = [assignment.lecturer.full_name for assignment in assignments]
                available_courses.append({
                    'id': course.id,
                    'code': course.code,
                    'title': course.title,
                    'department': course.department.name if course.department else 'N/A',
                    'level': course.level,
                    'credit_units': course.credit_units,
                    'assigned_lecturers': assignments.count(),
                    'lecturers': lecturer_names
                })
        
        return Response(available_courses)
        
    except Exception as e:
        return Response({'error': str(e)}, status=400)

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def lecturer_workload(request):
    """Get lecturer workload statistics"""
    try:
        user = request.user
        
        # Only admins can see all lecturer workloads
        if not (hasattr(user, 'role') and user.role == 'admin'):
            return Response({'error': 'Only admins can view lecturer workloads'}, status=403)
        
        lecturers = User.objects.filter(role='lecturer', is_active=True)
        workload_data = []
        
        for lecturer in lecturers:
            assignments = CourseAssignment.objects.filter(lecturer=lecturer, is_active=True)
            total_courses = assignments.count()
            total_credit_units = sum(assignment.course.credit_units for assignment in assignments)
            
            # Count sessions this week
            from datetime import datetime, timedelta
            today = datetime.now().date()
            week_start = today - timedelta(days=today.weekday())
            week_end = week_start + timedelta(days=6)
            
            weekly_sessions = ClassSession.objects.filter(
                course_assignment__lecturer=lecturer,
                scheduled_date__range=[week_start, week_end],
                is_active=True,
                is_cancelled=False
            ).count()
            
            workload_data.append({
                'lecturer_id': lecturer.id,
                'lecturer_name': lecturer.full_name,
                'lecturer_email': lecturer.email,
                'total_courses': total_courses,
                'total_credit_units': total_credit_units,
                'weekly_sessions': weekly_sessions,
                'courses': [
                    {
                        'code': assignment.course.code,
                        'title': assignment.course.title,
                        'credit_units': assignment.course.credit_units
                    }
                    for assignment in assignments
                ]
            })
        
        # Sort by total workload (credit units)
        workload_data.sort(key=lambda x: x['total_credit_units'], reverse=True)
        
        return Response(workload_data)
        
    except Exception as e:
        return Response({'error': str(e)}, status=400)

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def my_enrollments(request):
    """Get current user's enrollments"""
    try:
        user = request.user
        
        if not (hasattr(user, 'role') and user.role == 'student'):
            return Response({'error': 'Only students can view enrollments'}, status=403)
        
        enrollments = Enrollment.objects.filter(student=user).select_related(
            'course_assignment__course',
            'course_assignment__lecturer'
        )
        
        serializer = EnrollmentSerializer(enrollments, many=True)
        return Response(serializer.data)
        
    except Exception as e:
        return Response({'error': str(e)}, status=400)

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def mark_notifications_read(request):
    """Mark notifications as read"""
    try:
        user = request.user
        notification_ids = request.data.get('notification_ids', [])
        
        if notification_ids:
            Notification.objects.filter(
                recipient=user,
                id__in=notification_ids
            ).update(is_read=True)
        else:
            # Mark all as read
            Notification.objects.filter(recipient=user).update(is_read=True)
        
        return Response({'message': 'Notifications marked as read'})
        
    except Exception as e:
        return Response({'error': str(e)}, status=400)

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def enrollment_statistics(request):
    """Get enrollment statistics for analytics"""
    try:
        user = request.user
        
        if not (hasattr(user, 'role') and user.role == 'admin'):
            return Response({'error': 'Only admins can view enrollment statistics'}, status=403)
        
        # Total enrollments
        total_enrollments = Enrollment.objects.count()
        
        # Enrollments by status
        enrollment_by_status = {}
        for status, _ in Enrollment.STATUS_CHOICES:
            count = Enrollment.objects.filter(status=status).count()
            enrollment_by_status[status] = count
        
        # Enrollments by department
        from django.db.models import Count
        enrollments_by_dept = (
            Enrollment.objects
            .select_related('course_assignment__course__department')
            .values('course_assignment__course__department__name')
            .annotate(count=Count('id'))
            .order_by('-count')
        )
        
        return Response({
            'total_enrollments': total_enrollments,
            'by_status': enrollment_by_status,
            'by_department': list(enrollments_by_dept),
            'recent_enrollments': Enrollment.objects.order_by('-enrolled_at')[:10].count()
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=400)

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def course_popularity(request):
    """Get course popularity statistics"""
    try:
        user = request.user
        
        if not (hasattr(user, 'role') and user.role == 'admin'):
            return Response({'error': 'Only admins can view course popularity'}, status=403)
        
        from django.db.models import Count
        
        popular_courses = (
            Course.objects
            .filter(is_active=True)
            .annotate(
                enrollment_count=Count('courseassignment__enrollments'),
                assignment_count=Count('courseassignment')
            )
            .order_by('-enrollment_count')[:10]
        )
        
        popularity_data = []
        for course in popular_courses:
            popularity_data.append({
                'course_code': course.code,
                'course_title': course.title,
                'department': course.department.name if course.department else 'N/A',
                'level': course.level,
                'enrollment_count': course.enrollment_count,
                'assignment_count': course.assignment_count
            })
        
        return Response(popularity_data)
        
    except Exception as e:
        return Response({'error': str(e)}, status=400)

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def lecturer_workload_analytics(request):
    """Get detailed lecturer workload analytics"""
    try:
        user = request.user
        
        if not (hasattr(user, 'role') and user.role == 'admin'):
            return Response({'error': 'Only admins can view lecturer analytics'}, status=403)
        
        from django.db.models import Avg, Count, Sum
        
        # Overall statistics
        total_lecturers = User.objects.filter(role='lecturer', is_active=True).count()
        
        # Average workload
        avg_courses = (
            CourseAssignment.objects
            .filter(is_active=True)
            .values('lecturer')
            .annotate(course_count=Count('course'))
            .aggregate(avg_courses=Avg('course_count'))
        )
        
        # Lecturer distribution
        workload_distribution = []
        lecturers = User.objects.filter(role='lecturer', is_active=True)
        
        for lecturer in lecturers:
            assignments = CourseAssignment.objects.filter(lecturer=lecturer, is_active=True)
            total_courses = assignments.count()
            total_sessions = ClassSession.objects.filter(
                course_assignment__lecturer=lecturer,
                is_active=True
            ).count()
            
            workload_distribution.append({
                'lecturer_name': lecturer.full_name,
                'course_count': total_courses,
                'session_count': total_sessions,
                'workload_score': total_courses * 3 + total_sessions  # Simple scoring
            })
        
        # Sort by workload score
        workload_distribution.sort(key=lambda x: x['workload_score'], reverse=True)
        
        return Response({
            'total_lecturers': total_lecturers,
            'average_courses_per_lecturer': avg_courses['avg_courses'] or 0,
            'workload_distribution': workload_distribution,
            'high_workload_lecturers': [
                l for l in workload_distribution if l['workload_score'] > 15
            ],
            'low_workload_lecturers': [
                l for l in workload_distribution if l['workload_score'] < 5
            ]
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=400)

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def check_session_conflicts(request):
    """Check for conflicts before creating/updating a session"""
    try:
        # Don't validate using serializer, just extract the needed fields for conflict check
        data = request.data
        
        # Extract required fields for conflict checking
        course_assignment_id = data.get('course_assignment_id')
        scheduled_date = data.get('scheduled_date')
        start_time = data.get('start_time')
        end_time = data.get('end_time')
        room_id = data.get('room_id')
        session_id = data.get('id')  # For updates
        
        if not all([course_assignment_id, scheduled_date, start_time, end_time]):
            return Response({'error': 'Missing required fields for conflict check'}, status=400)
        
        # Get the course assignment
        try:
            course_assignment = CourseAssignment.objects.get(id=course_assignment_id)
        except CourseAssignment.DoesNotExist:
            return Response({'error': 'Course assignment not found'}, status=404)
        
        # Create a minimal session object for conflict checking
        temp_session = ClassSession(
            course_assignment=course_assignment,
            scheduled_date=scheduled_date,
            start_time=start_time,
            end_time=end_time,
            room_id=room_id if room_id else None
        )
        
        # Set session ID if updating
        if session_id:
            temp_session.id = session_id
        
        conflicts = temp_session.check_conflicts()
        
        return Response({
            'has_conflicts': len(conflicts) > 0,
            'conflicts': conflicts,
            'can_proceed': len(conflicts) == 0
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=400)

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def suggest_optimal_times(request):
    """Suggest optimal time slots based on lecturer and student availability"""
    course_assignment_id = request.query_params.get('course_assignment_id')
    date = request.query_params.get('date')
    duration = int(request.query_params.get('duration', 120))  # Duration in minutes
    room_type = request.query_params.get('room_type', 'physical')
    
    if not all([course_assignment_id, date]):
        return Response({'error': 'Missing required parameters'}, status=400)
    
    try:
        assignment = CourseAssignment.objects.get(id=course_assignment_id)
        lecturer = assignment.lecturer
        course = assignment.course
        
        # Get lecturer's free times
        lecturer_response = lecturer_free_times(request)
        if lecturer_response.status_code != 200:
            return lecturer_response
        
        lecturer_free_slots = lecturer_response.data['free_slots']
        
        # Check for student conflicts (same department and level)
        student_conflicts = ClassSession.objects.filter(
            course_assignment__course__department=course.department,
            course_assignment__course__level=course.level,
            scheduled_date=date,
            is_active=True,
            is_cancelled=False
        ).order_by('start_time')
        
        # Find available rooms for each free slot
        available_rooms = Room.objects.filter(
            room_type=room_type,
            is_available=True
        )
        
        optimal_suggestions = []
        
        for free_slot in lecturer_free_slots:
            if free_slot['duration_minutes'] >= duration:
                start_time = datetime.strptime(free_slot['start_time'], '%H:%M').time()
                end_time = (datetime.combine(datetime.today(), start_time) + 
                           timedelta(minutes=duration)).time()
                
                # Check if this time conflicts with student classes
                has_student_conflict = False
                for student_session in student_conflicts:
                    if (start_time < student_session.end_time and end_time > student_session.start_time):
                        has_student_conflict = True
                        break
                
                if not has_student_conflict:
                    # Find available rooms for this time slot
                    available_rooms_for_slot = []
                    for room in available_rooms:
                        room_conflicts = ClassSession.objects.filter(
                            room=room,
                            scheduled_date=date,
                            is_active=True,
                            is_cancelled=False
                        )
                        
                        room_available = True
                        for room_session in room_conflicts:
                            if (start_time < room_session.end_time and end_time > room_session.start_time):
                                room_available = False
                                break
                        
                        if room_available:
                            available_rooms_for_slot.append({
                                'id': room.id,
                                'name': room.name,
                                'code': room.code,
                                'capacity': room.capacity,
                                'room_type': room.room_type
                            })
                    
                    if available_rooms_for_slot:
                        optimal_suggestions.append({
                            'start_time': start_time.strftime('%H:%M'),
                            'end_time': end_time.strftime('%H:%M'),
                            'duration_minutes': duration,
                            'available_rooms': available_rooms_for_slot,
                            'score': len(available_rooms_for_slot)  # More rooms = higher score
                        })
        
        # Sort by score (number of available rooms)
        optimal_suggestions.sort(key=lambda x: x['score'], reverse=True)
        
        return Response({
            'date': date,
            'course': {
                'code': course.code,
                'title': course.title
            },
            'lecturer': {
                'name': lecturer.full_name
            },
            'optimal_suggestions': optimal_suggestions[:5]  # Top 5 suggestions
        })
        
    except CourseAssignment.DoesNotExist:
        return Response({'error': 'Course assignment not found'}, status=404)
    except Exception as e:
        return Response({'error': str(e)}, status=400) 

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def lecturer_attendance_history(request):
    """Get attendance history for lecturer's courses"""
    try:
        user = request.user
        
        if not (hasattr(user, 'role') and user.role == 'lecturer'):
            return Response({'error': 'Only lecturers can view attendance history'}, status=403)
        
        # Get filter parameters
        course_id = request.query_params.get('course')
        status = request.query_params.get('status')
        date = request.query_params.get('date')
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 50))
        
        # Get attendance records for lecturer's courses
        attendance_query = ClassAttendance.objects.filter(
            class_session__course_assignment__lecturer=user,
            class_session__is_active=True
        ).select_related(
            'student',
            'class_session',
            'class_session__course_assignment',
            'class_session__course_assignment__course'
        ).order_by('-class_session__scheduled_date', '-marked_at')
        
        # Apply filters
        if course_id:
            attendance_query = attendance_query.filter(class_session__course_assignment__course_id=course_id)
        if status:
            attendance_query = attendance_query.filter(status=status)
        if date:
            attendance_query = attendance_query.filter(class_session__scheduled_date=date)
        
        # Pagination
        total_count = attendance_query.count()
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        attendance_records = attendance_query[start_idx:end_idx]
        
        # Serialize data
        serialized_records = []
        for record in attendance_records:
            serialized_records.append({
                'id': record.id,
                'student': {
                    'id': record.student.id,
                    'full_name': record.student.full_name,
                    'email': record.student.email,
                    'student_id': getattr(record.student, 'student_id', 'N/A')
                },
                'class_session': {
                    'id': record.class_session.id,
                    'title': record.class_session.title,
                    'scheduled_date': record.class_session.scheduled_date.isoformat(),
                    'start_time': record.class_session.start_time.strftime('%H:%M'),
                    'end_time': record.class_session.end_time.strftime('%H:%M'),
                    'course_assignment': {
                        'course': {
                            'code': record.class_session.course_assignment.course.code,
                            'title': record.class_session.course_assignment.course.title
                        }
                    }
                },
                'status': record.status,
                'marked_at': record.marked_at.isoformat(),
                'face_verified': record.face_verified,
                'location': record.location or ''
            })
        
        return Response({
            'results': serialized_records,
            'count': total_count,
            'page': page,
            'page_size': page_size,
            'total_pages': (total_count + page_size - 1) // page_size
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=400)

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def lecturer_attendance_stats(request):
    """Get overall attendance statistics for lecturer"""
    try:
        user = request.user
        
        if not (hasattr(user, 'role') and user.role == 'lecturer'):
            return Response({'error': 'Only lecturers can view attendance stats'}, status=403)
        
        # Get date range
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        course_id = request.query_params.get('course')
        
        # Base query for lecturer's sessions
        sessions_query = ClassSession.objects.filter(
            course_assignment__lecturer=user,
            is_active=True
        )
        
        if start_date:
            sessions_query = sessions_query.filter(scheduled_date__gte=start_date)
        if end_date:
            sessions_query = sessions_query.filter(scheduled_date__lte=end_date)
        if course_id:
            sessions_query = sessions_query.filter(course_assignment__course_id=course_id)
        
        # Get attendance records for these sessions
        attendance_query = ClassAttendance.objects.filter(
            class_session__in=sessions_query
        )
        
        # Calculate statistics
        total_sessions = sessions_query.count()
        total_attendance_records = attendance_query.count()
        
        # Count by status
        present_count = attendance_query.filter(status='present').count()
        absent_count = attendance_query.filter(status='absent').count()
        late_count = attendance_query.filter(status='late').count()
        excused_count = attendance_query.filter(status='excused').count()
        
        # Calculate attendance rate
        total_expected = present_count + absent_count + late_count + excused_count
        overall_attendance_rate = (present_count / total_expected * 100) if total_expected > 0 else 0
        
        # Get unique students count
        total_students = attendance_query.values('student').distinct().count()
        
        return Response({
            'total_sessions': total_sessions,
            'total_students': total_students,
            'total_attendance_records': total_attendance_records,
            'overall_attendance_rate': overall_attendance_rate,
            'present_count': present_count,
            'absent_count': absent_count,
            'late_count': late_count,
            'excused_count': excused_count
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=400)

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def course_attendance_stats(request):
    """Get attendance statistics by course for lecturer"""
    try:
        user = request.user
        
        if not (hasattr(user, 'role') and user.role == 'lecturer'):
            return Response({'error': 'Only lecturers can view course stats'}, status=403)
        
        # Get lecturer's course assignments
        assignments = CourseAssignment.objects.filter(
            lecturer=user,
            is_active=True
        ).select_related('course')
        
        course_stats = []
        for assignment in assignments:
            # Get sessions for this course
            sessions = ClassSession.objects.filter(
                course_assignment=assignment,
            is_active=True
            )
            
            # Get attendance records for these sessions
            attendance_records = ClassAttendance.objects.filter(
                class_session__in=sessions
            )
            
            present_count = attendance_records.filter(status='present').count()
            absent_count = attendance_records.filter(status='absent').count()
            late_count = attendance_records.filter(status='late').count()
            
            total_records = attendance_records.count()
            attendance_rate = (present_count / total_records * 100) if total_records > 0 else 0
            
            course_stats.append({
                'course_id': assignment.course.id,
                'course_code': assignment.course.code,
                'course_title': assignment.course.title,
                'sessions_count': sessions.count(),
                'students_count': attendance_records.values('student').distinct().count(),
                'attendance_rate': attendance_rate,
                'present_count': present_count,
                'absent_count': absent_count,
                'late_count': late_count
            })
        
        return Response(course_stats)
        
    except Exception as e:
        return Response({'error': str(e)}, status=400) 

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def student_attendance_stats(request):
    """Get attendance statistics by student for lecturer"""
    try:
        user = request.user
        
        if not (hasattr(user, 'role') and user.role == 'lecturer'):
            return Response({'error': 'Only lecturers can view student stats'}, status=403)
        
        # Get lecturer's course assignments
        assignments = CourseAssignment.objects.filter(
            lecturer=user,
            is_active=True
        )
        
        # Get all students enrolled in lecturer's courses
        enrollments = Enrollment.objects.filter(
            course_assignment__in=assignments,
            status='enrolled'
        ).select_related('student')
        
        student_stats = []
        for enrollment in enrollments:
            student = enrollment.student
            
            # Get attendance records for this student in lecturer's courses
            attendance_records = ClassAttendance.objects.filter(
                student=student,
                class_session__course_assignment__in=assignments
            )
            
            present_count = attendance_records.filter(status='present').count()
            absent_count = attendance_records.filter(status='absent').count()
            late_count = attendance_records.filter(status='late').count()
            
            total_sessions = attendance_records.count()
            attendance_rate = (present_count / total_sessions * 100) if total_sessions > 0 else 0
            
            student_stats.append({
                'student_id': student.id,
                'student_name': student.full_name,
                'student_number': getattr(student, 'student_id', 'N/A'),
                'total_sessions': total_sessions,
                'present_count': present_count,
                'absent_count': absent_count,
                'late_count': late_count,
                'attendance_rate': attendance_rate
            })
        
        # Sort by attendance rate (lowest first to identify at-risk students)
        student_stats.sort(key=lambda x: x['attendance_rate'])
        
        return Response(student_stats)
        
    except Exception as e:
        return Response({'error': str(e)}, status=400)

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def daily_attendance_stats(request):
    """Get daily attendance statistics for lecturer"""
    try:
        user = request.user
        
        if not (hasattr(user, 'role') and user.role == 'lecturer'):
            return Response({'error': 'Only lecturers can view daily stats'}, status=403)
        
        # Get date range
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        
        # Get lecturer's sessions
        sessions_query = ClassSession.objects.filter(
            course_assignment__lecturer=user,
            is_active=True
        )
        
        if start_date:
            sessions_query = sessions_query.filter(scheduled_date__gte=start_date)
        if end_date:
            sessions_query = sessions_query.filter(scheduled_date__lte=end_date)
        
        # Group by date
        from django.db.models import Count
        daily_stats = []
        
        # Get unique dates
        dates = sessions_query.values_list('scheduled_date', flat=True).distinct().order_by('scheduled_date')
        
        for date in dates:
            day_sessions = sessions_query.filter(scheduled_date=date)
            
            # Get attendance records for this day
            attendance_records = ClassAttendance.objects.filter(
                class_session__in=day_sessions
            )
            
            present_count = attendance_records.filter(status='present').count()
            total_expected = attendance_records.count()
            attendance_rate = (present_count / total_expected * 100) if total_expected > 0 else 0
            
            daily_stats.append({
                'date': date.isoformat(),
                'total_sessions': day_sessions.count(),
                'attendance_rate': attendance_rate,
                'present_count': present_count,
                'total_expected': total_expected
            })
        
        return Response(daily_stats)
        
    except Exception as e:
        return Response({'error': str(e)}, status=400) 

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def import_department_students(request):
    """Import all students from a department into a course"""
    try:
        user = request.user
        
        if not (hasattr(user, 'role') and user.role in ['lecturer', 'admin']):
            return Response({'error': 'Only lecturers and admins can import students'}, status=403)
        
        course_assignment_id = request.data.get('course_assignment_id')
        department_id = request.data.get('department_id')
        status = request.data.get('status', 'enrolled')
        
        if not all([course_assignment_id, department_id]):
            return Response({'error': 'course_assignment_id and department_id are required'}, status=400)
        
        # Get the course assignment
        try:
            assignment = CourseAssignment.objects.get(id=course_assignment_id)
        except CourseAssignment.DoesNotExist:
            return Response({'error': 'Course assignment not found'}, status=404)
        
        # Check if user has permission to manage this course
        if user.role == 'lecturer' and assignment.lecturer != user:
            return Response({'error': 'You can only import students to your own courses'}, status=403)
        
        # Get all students from the department with the same level as the course
        from accounts.models import User
        students = User.objects.filter(
            role='student',
            department_id=department_id,
            level=assignment.course.level,
            is_active=True
        )
        
        imported_count = 0
        existing_count = 0
        
        for student in students:
            # Check if student is already enrolled
            existing_enrollment = Enrollment.objects.filter(
                student=student,
                course_assignment=assignment
            ).first()
            
            if not existing_enrollment:
                enrollment = Enrollment.objects.create(
                    student=student,
                    course_assignment=assignment,
                    status=status,
                    enrolled_by=user
                )
                imported_count += 1
                
                # Create notification for the enrolled student
                Notification.objects.create(
                    recipient=student,
                    sender=user,
                    notification_type='enrollment_approved',
                    title=f'Enrolled in {assignment.course.code}',
                    message=f'You have been enrolled in {assignment.course.code} - {assignment.course.title} by {user.full_name}.',
                    related_enrollment=enrollment
                )
            else:
                existing_count += 1
        
        return Response({
            'imported_count': imported_count,
            'existing_count': existing_count,
            'total_students': students.count(),
            'message': f'Successfully imported {imported_count} students. {existing_count} were already enrolled.'
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=400) 

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def deallocate_department_students(request):
    """Remove all students from a specific department from a course"""
    try:
        user = request.user
        
        if not (hasattr(user, 'role') and user.role in ['lecturer', 'admin']):
            return Response({'error': 'Only lecturers and admins can deallocate students'}, status=403)
        
        course_assignment_id = request.data.get('course_assignment_id')
        department_id = request.data.get('department_id')
        
        if not all([course_assignment_id, department_id]):
            return Response({'error': 'course_assignment_id and department_id are required'}, status=400)
        
        # Get the course assignment
        try:
            assignment = CourseAssignment.objects.get(id=course_assignment_id)
        except CourseAssignment.DoesNotExist:
            return Response({'error': 'Course assignment not found'}, status=404)
        
        # Check if user has permission to manage this course
        if user.role == 'lecturer' and assignment.lecturer != user:
            return Response({'error': 'You can only deallocate students from your own courses'}, status=403)
        
        # Get all students from the department enrolled in this course
        from accounts.models import User
        department_students = User.objects.filter(
            role='student',
            department_id=department_id,
            is_active=True
        )
        
        # Remove enrollments for these students
        removed_enrollments = Enrollment.objects.filter(
            student__in=department_students,
            course_assignment=assignment
        )
        
        removed_count = removed_enrollments.count()
        
        # Create notifications for deallocated students
        for enrollment in removed_enrollments:
            Notification.objects.create(
                recipient=enrollment.student,
                sender=user,
                notification_type='enrollment_rejected',
                title=f'Removed from {assignment.course.code}',
                message=f'You have been removed from {assignment.course.code} - {assignment.course.title} by {user.full_name}.',
                related_enrollment=enrollment
            )
        
        # Delete the enrollments
        removed_enrollments.delete()
        
        return Response({
            'removed_count': removed_count,
            'message': f'Successfully removed {removed_count} students from {assignment.course.code}.'
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=400)

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_enrolled_departments(request):
    """Get list of departments that have students enrolled in a course"""
    try:
        user = request.user
        
        if not (hasattr(user, 'role') and user.role in ['lecturer', 'admin']):
            return Response({'error': 'Only lecturers and admins can view enrolled departments'}, status=403)
        
        course_assignment_id = request.query_params.get('course_assignment_id')
        
        if not course_assignment_id:
            return Response({'error': 'course_assignment_id is required'}, status=400)
        
        # Get the course assignment
        try:
            assignment = CourseAssignment.objects.get(id=course_assignment_id)
        except CourseAssignment.DoesNotExist:
            return Response({'error': 'Course assignment not found'}, status=404)
        
        # Check if user has permission to view this course
        if user.role == 'lecturer' and assignment.lecturer != user:
            return Response({'error': 'You can only view your own courses'}, status=403)
        
        # Get departments with enrolled students
        from django.db.models import Count
        enrolled_departments = (
            Department.objects
            .filter(
                users__enrollments__course_assignment=assignment,
                users__enrollments__status='enrolled',
                users__role='student'
            )
            .annotate(student_count=Count('users__enrollments'))
            .distinct()
        )
        
        department_data = []
        for dept in enrolled_departments:
            department_data.append({
                'id': dept.id,
                'name': dept.name,
                'code': dept.code,
                'student_count': dept.student_count,
                'college': dept.college.name if dept.college else 'N/A'
            })
        
        return Response(department_data)
        
    except Exception as e:
        return Response({'error': str(e)}, status=400)

# Lecturer Management Views
class LecturerListView(generics.ListAPIView):
    """List all lecturers for course assignment"""
    serializer_class = UserBasicSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ['full_name', 'email', 'lecturer_id']
    
    def get_queryset(self):
        # Only return active lecturers
        return User.objects.filter(role='lecturer', is_active=True).order_by('full_name') 

# Student Attendance Views
class StudentAttendanceCreateView(generics.CreateAPIView):
    """Allow students to mark their own attendance"""
    serializer_class = ClassAttendanceSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """Allow students to view their own attendance history"""
        if self.request.method == 'GET':
            user = self.request.user
            if hasattr(user, 'role') and user.role == 'student':
                queryset = ClassAttendance.objects.filter(student=user)
                
                # Filter by course if provided
                course_id = self.request.query_params.get('course')
                if course_id:
                    queryset = queryset.filter(class_session__course_assignment__course_id=course_id)
                
                # Filter by date range if provided
                start_date = self.request.query_params.get('start_date')
                end_date = self.request.query_params.get('end_date')
                if start_date:
                    queryset = queryset.filter(class_session__scheduled_date__gte=start_date)
                if end_date:
                    queryset = queryset.filter(class_session__scheduled_date__lte=end_date)
                
                return queryset.select_related('class_session__course_assignment__course').order_by('-marked_at')
        
        return ClassAttendance.objects.none()
    
    def get(self, request, *args, **kwargs):
        """Get student's attendance history"""
        queryset = self.get_queryset()
        serializer = ClassAttendanceSerializer(queryset, many=True)
        return Response(serializer.data)
    
    def perform_create(self, serializer):
        user = self.request.user
        
        # Only students can mark attendance
        if not (hasattr(user, 'role') and user.role == 'student'):
            raise permissions.PermissionDenied("Only students can mark attendance")
        
        class_session_id = self.request.data.get('class_session_id')
        if not class_session_id:
            raise ValidationError("class_session_id is required")
        
        try:
            class_session = ClassSession.objects.get(id=class_session_id, is_active=True)
        except ClassSession.DoesNotExist:
            raise ValidationError("Invalid or inactive class session")
        
        # Check if student is enrolled in the course
        enrollment = Enrollment.objects.filter(
            student=user,
            course_assignment=class_session.course_assignment,
            status='enrolled'
        ).first()
        
        if not enrollment:
            raise ValidationError("You are not enrolled in this course")
        
        # Check attendance window
        now = timezone.now()
        session_date = class_session.scheduled_date
        
        # Create datetime objects for comparison
        window_start = timezone.make_aware(
            timezone.datetime.combine(session_date, class_session.attendance_window_start)
        )
        window_end = timezone.make_aware(
            timezone.datetime.combine(session_date, class_session.attendance_window_end)
        )
        
        if now < window_start:
            raise ValidationError("Attendance window has not opened yet")
        
        if now > window_end:
            raise ValidationError("Attendance window has closed")
        
        # Check if student has already marked attendance
        existing_attendance = ClassAttendance.objects.filter(
            student=user,
            class_session=class_session
        ).first()
        
        if existing_attendance:
            # Return detailed info about existing attendance instead of just raising error
            from rest_framework.exceptions import ValidationError as DRFValidationError
            from django.utils import timezone as tz
            
            time_marked = existing_attendance.marked_at.strftime("%H:%M:%S")
            date_marked = existing_attendance.marked_at.strftime("%B %d, %Y")
            
            error_data = {
                'error': 'Attendance already marked',
                'error_type': 'already_marked',
                'details': {
                    'status': existing_attendance.status,
                    'marked_at': existing_attendance.marked_at.isoformat(),
                    'marked_time': time_marked,
                    'marked_date': date_marked,
                    'face_verified': existing_attendance.face_verified,
                    'session_title': class_session.title,
                    'course_code': class_session.course_assignment.course.code
                },
                'message': f'✅ You have already marked attendance for this session at {time_marked} on {date_marked}',
                'icon': '✅',
                'display_status': existing_attendance.get_status_display()
            }
            
            raise DRFValidationError(error_data)
        
        # Determine if student is late
        session_start = timezone.make_aware(
            timezone.datetime.combine(session_date, class_session.start_time)
        )
        
        status = 'late' if now > session_start else 'present'
        
        # Get additional data from request
        captured_image_data = self.request.data.get('captured_image', '')
        face_verified = self.request.data.get('face_verified', False)
        notes = self.request.data.get('notes', '')
        
        # Add course and session info to notes for better tracking
        course_info = f"Course: {class_session.course_assignment.course.code} - {class_session.course_assignment.course.title}"
        session_info = f"Session: {class_session.title} on {session_date}"
        enhanced_notes = f"{notes}\n{course_info}\n{session_info}"
        
        # Save attendance with all information
        attendance = serializer.save(
            student=user,
            class_session=class_session,
            status=status,
            notes=enhanced_notes,
            face_verified=face_verified
        )
        
        # Save captured image if provided (for audit trail)
        if captured_image_data and face_verified:
            try:
                # Save image data to media folder for audit
                import base64
                import os
                from django.conf import settings
                from datetime import datetime
                
                # Create unique filename
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                filename = f"attendance_{user.id}_{class_session.id}_{timestamp}.jpg"
                
                # Ensure directory exists
                media_dir = os.path.join(settings.MEDIA_ROOT, 'attendance_photos')
                os.makedirs(media_dir, exist_ok=True)
                
                # Remove data URL prefix if present
                if captured_image_data.startswith('data:image'):
                    captured_image_data = captured_image_data.split(',')[1]
                
                # Save image file
                image_path = os.path.join(media_dir, filename)
                with open(image_path, 'wb') as f:
                    f.write(base64.b64decode(captured_image_data))
                
                # Update attendance notes with image info
                attendance.notes += f"\nCaptured image: {filename}"
                attendance.save()
                
                print(f"✅ Saved attendance image: {filename}")
                
            except Exception as e:
                # Don't fail attendance saving if image saving fails
                print(f"⚠️ Failed to save attendance image: {str(e)}")
                attendance.notes += "\nImage save failed"
                attendance.save()
        
        # Add success logging
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"Attendance saved successfully: User {user.id} ({user.full_name}) - Session {class_session.id} - Status: {status} - Face Verified: {face_verified}")
        
        print(f"✅ Attendance saved: {user.username} - {class_session.title} - {status}")
        return attendance

# Custom Canvas class for watermark
class WatermarkCanvas(canvas.Canvas):
    def __init__(self, filename, **kwargs):
        canvas.Canvas.__init__(self, filename, **kwargs)
    
    def save(self):
        # Add watermark on every page
        self.drawWatermark()
        canvas.Canvas.save(self)
    
    def drawWatermark(self):
        # Add a subtle watermark
        self.saveState()
        self.setFont('Helvetica', 50)
        self.setFillColor(colors.lightgrey, alpha=0.1)
        self.translate(300, 400)
        self.rotate(45)
        self.drawCentredText(0, 0, "OUI UNIVERSITY")
        self.restoreState()

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def download_attendance_report(request):
    """Download attendance report as PDF with professional letterhead"""
    course_assignment_id = request.query_params.get('course_assignment_id')
    
    if not course_assignment_id:
        return Response({'error': 'course_assignment_id is required'}, status=400)
    
    try:
        course_assignment = CourseAssignment.objects.get(id=course_assignment_id)
        
        # Check permissions
        if request.user.role == 'lecturer' and course_assignment.lecturer != request.user:
            return Response({'error': 'Permission denied'}, status=403)
        elif request.user.role == 'student':
            return Response({'error': 'Students cannot download course reports'}, status=403)
        
        # Get sessions and attendance data
        sessions = ClassSession.objects.filter(
            course_assignment=course_assignment,
            is_active=True
        ).order_by('scheduled_date', 'start_time')
        
        attendances = ClassAttendance.objects.filter(
            class_session__course_assignment=course_assignment
        ).select_related('student', 'class_session')
        
        # Create PDF with custom canvas
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer, 
            pagesize=A4,
            rightMargin=0.5*inch,
            leftMargin=0.5*inch,
            topMargin=1*inch,
            bottomMargin=1*inch,
            canvasmaker=WatermarkCanvas
        )
        
        elements = []
        styles = getSampleStyleSheet()
        
        # Custom styles
        letterhead_style = ParagraphStyle(
            'Letterhead',
            parent=styles['Heading1'],
            fontSize=20,
            textColor=colors.darkblue,
            alignment=TA_CENTER,
            spaceAfter=10,
            fontName='Helvetica-Bold'
        )
        
        subtitle_style = ParagraphStyle(
            'Subtitle',
            parent=styles['Heading2'],
            fontSize=14,
            textColor=colors.darkblue,
            alignment=TA_CENTER,
            spaceAfter=20,
            fontName='Helvetica-Bold'
        )
        
        header_style = ParagraphStyle(
            'Header',
            parent=styles['Heading3'],
            fontSize=12,
            textColor=colors.black,
            alignment=TA_CENTER,
            spaceAfter=30,
            fontName='Helvetica-Bold'
        )
        
        # University Letterhead
        letterhead = Paragraph("🏛️ OUI UNIVERSITY", letterhead_style)
        elements.append(letterhead)
        
        subtitle = Paragraph("ATTENDANCE MANAGEMENT SYSTEM", subtitle_style)
        elements.append(subtitle)
        
        # Horizontal line
        from reportlab.platypus import HRFlowable
        elements.append(HRFlowable(width="100%", thickness=2, color=colors.darkblue))
        elements.append(Spacer(1, 20))
        
        # Report title
        report_title = Paragraph(f"📊 ATTENDANCE REPORT", header_style)
        elements.append(report_title)
        
        # Course information in a professional table
        course_info_data = [
            ['📚 Course Information', ''],
            ['Course Title:', course_assignment.course.title],
            ['Course Code:', course_assignment.course.code],
            ['Department:', course_assignment.course.department.name],
            ['Level:', f"{course_assignment.course.level} Level"],
            ['Credit Units:', f"{course_assignment.course.credit_units} Units"],
            ['', ''],
            ['👨‍🏫 Lecturer Information', ''],
            ['Lecturer Name:', course_assignment.lecturer.full_name],
            ['Lecturer ID:', course_assignment.lecturer.lecturer_id or 'N/A'],
            ['', ''],
            ['📅 Academic Information', ''],
            ['Academic Year:', course_assignment.academic_year],
            ['Semester:', course_assignment.semester],
            ['Report Generated:', datetime.now().strftime('%Y-%m-%d at %H:%M:%S')],
            ['Generated By:', request.user.full_name]
        ]
        
        course_table = Table(course_info_data, colWidths=[2.5*inch, 4*inch])
        course_table.setStyle(TableStyle([
            # Header rows
            ('BACKGROUND', (0, 0), (1, 0), colors.darkblue),
            ('BACKGROUND', (0, 7), (1, 7), colors.darkblue),
            ('BACKGROUND', (0, 11), (1, 11), colors.darkblue),
            ('TEXTCOLOR', (0, 0), (1, 0), colors.white),
            ('TEXTCOLOR', (0, 7), (1, 7), colors.white),
            ('TEXTCOLOR', (0, 11), (1, 11), colors.white),
            ('FONTNAME', (0, 0), (1, 0), 'Helvetica-Bold'),
            ('FONTNAME', (0, 7), (1, 7), 'Helvetica-Bold'),
            ('FONTNAME', (0, 11), (1, 11), 'Helvetica-Bold'),
            ('SPAN', (0, 0), (1, 0)),
            ('SPAN', (0, 7), (1, 7)),
            ('SPAN', (0, 11), (1, 11)),
            
            # Data rows
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 1), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            
            # Skip empty rows
            ('BACKGROUND', (0, 6), (1, 6), colors.white),
            ('BACKGROUND', (0, 10), (1, 10), colors.white),
            ('GRID', (0, 6), (1, 6), 0, colors.white),
            ('GRID', (0, 10), (1, 10), 0, colors.white),
        ]))
        
        elements.append(course_table)
        elements.append(Spacer(1, 30))
        
        # Attendance summary
        if sessions.exists():
            # Get enrolled students
            enrolled_students = User.objects.filter(
                enrollments__course_assignment=course_assignment,
                enrollments__status='enrolled'
            ).order_by('full_name')
            
            if enrolled_students.exists():
                # Attendance header
                attendance_header = Paragraph("📋 DETAILED ATTENDANCE RECORD", header_style)
                elements.append(attendance_header)
                elements.append(Spacer(1, 10))
                
                # Create attendance matrix
                header_row = ['👤 STUDENT NAME']
                for session in sessions:
                    session_header = f"{session.scheduled_date.strftime('%m/%d')}\n{session.start_time.strftime('%H:%M')}\n{session.title[:15]}..."
                    header_row.append(session_header)
                header_row.append('📊 SUMMARY')
                
                data = [header_row]
                
                for student in enrolled_students:
                    row = [student.full_name]
                    present_count = 0
                    late_count = 0
                    total_sessions = len(sessions)
                    
                    for session in sessions:
                        attendance = attendances.filter(
                            student=student,
                            class_session=session
                        ).first()
                        
                        if attendance:
                            if attendance.status == 'present':
                                status = "✅ P"
                                if attendance.face_verified:
                                    status += "📷"
                                present_count += 1
                            elif attendance.status == 'late':
                                status = "⏰ L"
                                if attendance.face_verified:
                                    status += "📷"
                                late_count += 1
                            else:
                                status = "❌ A"
                            row.append(status)
                        else:
                            row.append('❌ A')
                    
                    # Summary column
                    percentage = ((present_count + late_count) / total_sessions * 100) if total_sessions > 0 else 0
                    summary = f"{percentage:.1f}%\n({present_count}P/{late_count}L)"
                    row.append(summary)
                    data.append(row)
                
                # Create attendance table
                col_widths = [2.5*inch] + [0.8*inch] * len(sessions) + [1*inch]
                attendance_table = Table(data, colWidths=col_widths)
                attendance_table.setStyle(TableStyle([
                    # Header styling
                    ('BACKGROUND', (0, 0), (-1, 0), colors.darkblue),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, 0), 8),
                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                    
                    # Data styling
                    ('FONTSIZE', (0, 1), (-1, -1), 7),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                    ('TOPPADDING', (0, 0), (-1, -1), 4),
                    ('GRID', (0, 0), (-1, -1), 1, colors.black),
                    
                    # Alternating row colors
                    ('BACKGROUND', (0, 1), (-1, -1), colors.lightgrey),
                    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.lightgrey]),
                ]))
                
                elements.append(attendance_table)
                elements.append(Spacer(1, 20))
                
                # Legend
                legend_style = ParagraphStyle(
                    'Legend',
                    fontSize=8,
                    alignment=TA_LEFT,
                    spaceAfter=5
                )
                
                legend_title = Paragraph("<b>📝 LEGEND:</b>", legend_style)
                elements.append(legend_title)
                
                legend_items = [
                    "✅ P = Present",
                    "⏰ L = Late", 
                    "❌ A = Absent",
                    "📷 = Face Recognition Verified",
                    "📊 = Attendance Percentage (Present/Late counts)"
                ]
                
                for item in legend_items:
                    elements.append(Paragraph(item, legend_style))
                
            else:
                elements.append(Paragraph("No enrolled students found.", styles['Normal']))
        else:
            elements.append(Paragraph("No sessions scheduled for this course.", styles['Normal']))
        
        # Footer
        elements.append(Spacer(1, 30))
        footer_style = ParagraphStyle(
            'Footer',
            fontSize=8,
            alignment=TA_CENTER,
            textColor=colors.grey
        )
        footer = Paragraph("Generated by OUI Attendance System - Confidential Document", footer_style)
        elements.append(footer)
        
        # Build PDF
        doc.build(elements)
        buffer.seek(0)
        
        # Return response
        response = HttpResponse(buffer.getvalue(), content_type='application/pdf')
        filename = f"OUI_Attendance_Report_{course_assignment.course.code}_{datetime.now().strftime('%Y%m%d')}.pdf"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response
        
    except CourseAssignment.DoesNotExist:
        return Response({'error': 'Course assignment not found'}, status=404)
    except Exception as e:
        return Response({'error': f'Failed to generate report: {str(e)}'}, status=500) 

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def download_student_attendance_report(request):
    """Download student's personal attendance report as PDF"""
    student_id = request.query_params.get('student_id')
    
    # Students can only download their own report
    if request.user.role == 'student':
        if not student_id or int(student_id) != request.user.id:
            student_id = request.user.id
    elif request.user.role in ['lecturer', 'admin']:
        if not student_id:
            return Response({'error': 'student_id is required'}, status=400)
    else:
        return Response({'error': 'Permission denied'}, status=403)
    
    try:
        student = User.objects.get(id=student_id)
        
        # Get all attendance records for this student
        attendances = ClassAttendance.objects.filter(
            student=student
        ).select_related('class_session__course_assignment__course').order_by('-marked_at')
        
        # Create PDF
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer, 
            pagesize=A4,
            rightMargin=0.5*inch,
            leftMargin=0.5*inch,
            topMargin=1*inch,
            bottomMargin=1*inch,
            canvasmaker=WatermarkCanvas
        )
        
        elements = []
        styles = getSampleStyleSheet()
        
        # Custom styles
        letterhead_style = ParagraphStyle(
            'Letterhead',
            parent=styles['Heading1'],
            fontSize=20,
            textColor=colors.darkblue,
            alignment=TA_CENTER,
            spaceAfter=10,
            fontName='Helvetica-Bold'
        )
        
        subtitle_style = ParagraphStyle(
            'Subtitle',
            parent=styles['Heading2'],
            fontSize=14,
            textColor=colors.darkblue,
            alignment=TA_CENTER,
            spaceAfter=20,
            fontName='Helvetica-Bold'
        )
        
        # University Letterhead
        letterhead = Paragraph("🏛️ OUI UNIVERSITY", letterhead_style)
        elements.append(letterhead)
        
        subtitle = Paragraph("STUDENT ATTENDANCE REPORT", subtitle_style)
        elements.append(subtitle)
        
        # Horizontal line
        from reportlab.platypus import HRFlowable
        elements.append(HRFlowable(width="100%", thickness=2, color=colors.darkblue))
        elements.append(Spacer(1, 20))
        
        # Student information
        student_info_data = [
            ['👤 Student Information', ''],
            ['Full Name:', student.full_name],
            ['Student ID:', student.student_id or 'N/A'],
            ['Email:', student.email],
            ['Department:', student.department.name if student.department else 'N/A'],
            ['Level:', f"{student.level} Level" if student.level else 'N/A'],
            ['', ''],
            ['📅 Report Information', ''],
            ['Total Sessions Attended:', str(attendances.count())],
            ['Report Generated:', datetime.now().strftime('%Y-%m-%d at %H:%M:%S')],
        ]
        
        student_table = Table(student_info_data, colWidths=[2.5*inch, 4*inch])
        student_table.setStyle(TableStyle([
            # Header rows
            ('BACKGROUND', (0, 0), (1, 0), colors.darkblue),
            ('BACKGROUND', (0, 7), (1, 7), colors.darkblue),
            ('TEXTCOLOR', (0, 0), (1, 0), colors.white),
            ('TEXTCOLOR', (0, 7), (1, 7), colors.white),
            ('FONTNAME', (0, 0), (1, 0), 'Helvetica-Bold'),
            ('FONTNAME', (0, 7), (1, 7), 'Helvetica-Bold'),
            ('SPAN', (0, 0), (1, 0)),
            ('SPAN', (0, 7), (1, 7)),
            
            # Data rows
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 1), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            
            # Skip empty rows
            ('BACKGROUND', (0, 6), (1, 6), colors.white),
            ('GRID', (0, 6), (1, 6), 0, colors.white),
        ]))
        
        elements.append(student_table)
        elements.append(Spacer(1, 30))
        
        # Attendance records table
        if attendances.exists():
            # Attendance header
            header_style = ParagraphStyle(
                'Header',
                parent=styles['Heading3'],
                fontSize=12,
                textColor=colors.black,
                alignment=TA_CENTER,
                spaceAfter=20,
                fontName='Helvetica-Bold'
            )
            
            attendance_header = Paragraph("📋 DETAILED ATTENDANCE RECORDS", header_style)
            elements.append(attendance_header)
            
            # Create attendance table
            data = [['📅 Date', '🕐 Time', '📚 Course', '📖 Session', '✅ Status', '📷 Method', '📝 Notes']]
            
            for attendance in attendances:
                session = attendance.class_session
                course = session.course_assignment.course
                
                status_icon = '✅' if attendance.status == 'present' else '⏰' if attendance.status == 'late' else '❌'
                method_icon = '📷' if attendance.face_verified else '📝'
                
                data.append([
                    session.scheduled_date.strftime('%Y-%m-%d'),
                    session.start_time.strftime('%H:%M'),
                    course.code,
                    session.title[:20] + '...' if len(session.title) > 20 else session.title,
                    f"{status_icon} {attendance.get_status_display()}",
                    f"{method_icon} {'Face' if attendance.face_verified else 'Manual'}",
                    attendance.notes[:30] + '...' if len(attendance.notes) > 30 else attendance.notes
                ])
            
            attendance_table = Table(data, colWidths=[1*inch, 0.8*inch, 1*inch, 1.5*inch, 1*inch, 1*inch, 1.7*inch])
            attendance_table.setStyle(TableStyle([
                # Header styling
                ('BACKGROUND', (0, 0), (-1, 0), colors.darkblue),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 8),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                
                # Data styling
                ('FONTSIZE', (0, 1), (-1, -1), 7),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                ('TOPPADDING', (0, 0), (-1, -1), 4),
                ('GRID', (0, 0), (-1, -1), 1, colors.black),
                
                # Alternating row colors
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.lightgrey]),
            ]))
            
            elements.append(attendance_table)
            
        else:
            elements.append(Paragraph("No attendance records found.", styles['Normal']))
        
        # Footer
        elements.append(Spacer(1, 30))
        footer_style = ParagraphStyle(
            'Footer',
            fontSize=8,
            alignment=TA_CENTER,
            textColor=colors.grey
        )
        footer = Paragraph("Generated by OUI Attendance System - Personal Report", footer_style)
        elements.append(footer)
        
        # Build PDF
        doc.build(elements)
        buffer.seek(0)
        
        # Return response
        response = HttpResponse(buffer.getvalue(), content_type='application/pdf')
        filename = f"OUI_Student_Attendance_{student.student_id or student.id}_{datetime.now().strftime('%Y%m%d')}.pdf"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response
        
    except User.DoesNotExist:
        return Response({'error': 'Student not found'}, status=404)
    except Exception as e:
        return Response({'error': f'Failed to generate report: {str(e)}'}, status=500)

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def download_comprehensive_attendance_report(request):
    """Enhanced download for both lecturer and student reports with proper authentication"""
    user = request.user
    report_type = request.query_params.get('type', 'student')  # 'student' or 'lecturer'
    course_assignment_id = request.query_params.get('course_assignment_id')
    student_id = request.query_params.get('student_id')
    start_date = request.query_params.get('start_date')
    end_date = request.query_params.get('end_date')
    
    try:
        if report_type == 'student':
            # Student report logic
            if user.role == 'student':
                # Students can only download their own report
                target_student = user
            elif user.role in ['lecturer', 'admin']:
                # Lecturers/admins can download any student's report
                if not student_id:
                    return Response({'error': 'student_id is required for lecturer/admin access'}, status=400)
                target_student = User.objects.get(id=student_id)
            else:
                return Response({'error': 'Permission denied'}, status=403)
            
            # Get student's attendance records
            attendances_query = ClassAttendance.objects.filter(
                student=target_student
            ).select_related('class_session__course_assignment__course', 'class_session__course_assignment__lecturer')
            
            # Apply date filters if provided
            if start_date:
                attendances_query = attendances_query.filter(class_session__scheduled_date__gte=start_date)
            if end_date:
                attendances_query = attendances_query.filter(class_session__scheduled_date__lte=end_date)
            
            attendances = attendances_query.order_by('-class_session__scheduled_date', '-marked_at')
            
            # Generate student PDF report
            return generate_student_pdf_report(target_student, attendances, request.user)
            
        elif report_type == 'lecturer':
            # Lecturer report logic
            if user.role == 'lecturer':
                # Lecturers can download reports for their own courses
                if not course_assignment_id:
                    return Response({'error': 'course_assignment_id is required'}, status=400)
                
                course_assignment = CourseAssignment.objects.get(
                    id=course_assignment_id,
                    lecturer=user
                )
            elif user.role == 'admin':
                # Admins can download any course report
                if not course_assignment_id:
                    return Response({'error': 'course_assignment_id is required'}, status=400)
                
                course_assignment = CourseAssignment.objects.get(id=course_assignment_id)
            else:
                return Response({'error': 'Permission denied'}, status=403)
            
            # Get course sessions and attendance data
            sessions_query = ClassSession.objects.filter(
                course_assignment=course_assignment,
                is_active=True
            )
            
            # Apply date filters if provided
            if start_date:
                sessions_query = sessions_query.filter(scheduled_date__gte=start_date)
            if end_date:
                sessions_query = sessions_query.filter(scheduled_date__lte=end_date)
            
            sessions = sessions_query.order_by('scheduled_date', 'start_time')
            
            attendances = ClassAttendance.objects.filter(
                class_session__in=sessions
            ).select_related('student', 'class_session')
            
            # Generate course PDF report
            return generate_course_pdf_report(course_assignment, sessions, attendances, request.user, start_date, end_date)
            
        else:
            return Response({'error': 'Invalid report type. Use "student" or "lecturer"'}, status=400)
            
    except CourseAssignment.DoesNotExist:
        return Response({'error': 'Course assignment not found'}, status=404)
    except User.DoesNotExist:
        return Response({'error': 'Student not found'}, status=404)
    except Exception as e:
        return Response({'error': f'Failed to generate report: {str(e)}'}, status=500)

def generate_student_pdf_report(student, attendances, generated_by):
    """Generate comprehensive student attendance PDF report"""
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer, 
        pagesize=A4,
        rightMargin=0.5*inch,
        leftMargin=0.5*inch,
        topMargin=1*inch,
        bottomMargin=1*inch,
        canvasmaker=WatermarkCanvas
    )
    
    elements = []
    styles = getSampleStyleSheet()
    
    # Custom styles
    letterhead_style = ParagraphStyle(
        'Letterhead',
        parent=styles['Heading1'],
        fontSize=20,
        textColor=colors.darkblue,
        alignment=TA_CENTER,
        spaceAfter=10,
        fontName='Helvetica-Bold'
    )
    
    subtitle_style = ParagraphStyle(
        'Subtitle',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=colors.darkblue,
        alignment=TA_CENTER,
        spaceAfter=20,
        fontName='Helvetica-Bold'
    )
    
    # Header
    letterhead = Paragraph("🏛️ OUI UNIVERSITY", letterhead_style)
    elements.append(letterhead)
    
    subtitle = Paragraph("STUDENT ATTENDANCE REPORT", subtitle_style)
    elements.append(subtitle)
    
    # Horizontal line
    from reportlab.platypus import HRFlowable
    elements.append(HRFlowable(width="100%", thickness=2, color=colors.darkblue))
    elements.append(Spacer(1, 20))
    
    # Student information
    student_info_data = [
        ['👤 Student Information', ''],
        ['Full Name:', student.full_name],
        ['Student ID:', student.student_id or 'N/A'],
        ['Email:', student.email],
        ['Department:', student.department.name if student.department else 'N/A'],
        ['Level:', f"{student.level} Level" if student.level else 'N/A'],
        ['', ''],
        ['📊 Attendance Summary', ''],
        ['Total Sessions:', str(attendances.count())],
        ['Present:', str(attendances.filter(status='present').count())],
        ['Late:', str(attendances.filter(status='late').count())],
        ['Face Verified:', str(attendances.filter(face_verified=True).count())],
        ['', ''],
        ['📅 Report Information', ''],
        ['Generated By:', generated_by.full_name],
        ['Generated On:', datetime.now().strftime('%Y-%m-%d at %H:%M:%S')],
    ]
    
    student_table = Table(student_info_data, colWidths=[2.5*inch, 4*inch])
    student_table.setStyle(TableStyle([
        # Header rows styling
        ('BACKGROUND', (0, 0), (1, 0), colors.darkblue),
        ('BACKGROUND', (0, 7), (1, 7), colors.darkblue),
        ('BACKGROUND', (0, 13), (1, 13), colors.darkblue),
        ('TEXTCOLOR', (0, 0), (1, 0), colors.white),
        ('TEXTCOLOR', (0, 7), (1, 7), colors.white),
        ('TEXTCOLOR', (0, 13), (1, 13), colors.white),
        ('FONTNAME', (0, 0), (1, 0), 'Helvetica-Bold'),
        ('FONTNAME', (0, 7), (1, 7), 'Helvetica-Bold'),
        ('FONTNAME', (0, 13), (1, 13), 'Helvetica-Bold'),
        ('SPAN', (0, 0), (1, 0)),
        ('SPAN', (0, 7), (1, 7)),
        ('SPAN', (0, 13), (1, 13)),
        
        # General styling
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 1), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        
        # Hide empty rows
        ('BACKGROUND', (0, 6), (1, 6), colors.white),
        ('BACKGROUND', (0, 12), (1, 12), colors.white),
        ('GRID', (0, 6), (1, 6), 0, colors.white),
        ('GRID', (0, 12), (1, 12), 0, colors.white),
    ]))
    
    elements.append(student_table)
    elements.append(Spacer(1, 30))
    
    # Detailed attendance records
    if attendances.exists():
        header_style = ParagraphStyle(
            'Header',
            parent=styles['Heading3'],
            fontSize=12,
            textColor=colors.black,
            alignment=TA_CENTER,
            spaceAfter=20,
            fontName='Helvetica-Bold'
        )
        
        attendance_header = Paragraph("📋 DETAILED ATTENDANCE RECORDS", header_style)
        elements.append(attendance_header)
        
        # Group by course for better organization
        from collections import defaultdict
        courses_attendance = defaultdict(list)
        
        for attendance in attendances:
            course_code = attendance.class_session.course_assignment.course.code
            courses_attendance[course_code].append(attendance)
        
        for course_code, course_attendances in courses_attendance.items():
            # Course header
            course_header = Paragraph(f"📚 {course_code}", styles['Heading4'])
            elements.append(course_header)
            elements.append(Spacer(1, 10))
            
            # Attendance table for this course
            data = [['📅 Date', '🕐 Time', '📖 Session', '✅ Status', '📷 Method', '⏰ Marked At']]
            
            for attendance in course_attendances:
                session = attendance.class_session
                
                status_icon = '✅' if attendance.status == 'present' else '⏰' if attendance.status == 'late' else '❌'
                method_icon = '📷' if attendance.face_verified else '📝'
                
                data.append([
                    session.scheduled_date.strftime('%Y-%m-%d'),
                    session.start_time.strftime('%H:%M'),
                    session.title[:25] + '...' if len(session.title) > 25 else session.title,
                    f"{status_icon} {attendance.get_status_display()}",
                    f"{method_icon} {'Face' if attendance.face_verified else 'Manual'}",
                    attendance.marked_at.strftime('%H:%M:%S')
                ])
            
            course_table = Table(data, colWidths=[1.2*inch, 0.8*inch, 2*inch, 1.2*inch, 1.2*inch, 1.1*inch])
            course_table.setStyle(TableStyle([
                # Header styling
                ('BACKGROUND', (0, 0), (-1, 0), colors.darkblue),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 8),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                
                # Data styling
                ('FONTSIZE', (0, 1), (-1, -1), 7),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                ('TOPPADDING', (0, 0), (-1, -1), 4),
                ('GRID', (0, 0), (-1, -1), 1, colors.black),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.lightgrey]),
            ]))
            
            elements.append(course_table)
            elements.append(Spacer(1, 20))
    
    else:
        elements.append(Paragraph("No attendance records found.", styles['Normal']))
    
    # Build PDF
    doc.build(elements)
    buffer.seek(0)
    
    # Return response
    response = HttpResponse(buffer.getvalue(), content_type='application/pdf')
    filename = f"Student_Attendance_{student.student_id or student.id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response

def generate_course_pdf_report(course_assignment, sessions, attendances, generated_by, start_date=None, end_date=None):
    """Generate comprehensive course attendance PDF report"""
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer, 
        pagesize=A4,
        rightMargin=0.5*inch,
        leftMargin=0.5*inch,
        topMargin=1*inch,
        bottomMargin=1*inch,
        canvasmaker=WatermarkCanvas
    )
    
    elements = []
    styles = getSampleStyleSheet()
    
    # Custom styles
    letterhead_style = ParagraphStyle(
        'Letterhead',
        parent=styles['Heading1'],
        fontSize=20,
        textColor=colors.darkblue,
        alignment=TA_CENTER,
        spaceAfter=10,
        fontName='Helvetica-Bold'
    )
    
    subtitle_style = ParagraphStyle(
        'Subtitle',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=colors.darkblue,
        alignment=TA_CENTER,
        spaceAfter=20,
        fontName='Helvetica-Bold'
    )
    
    # Header
    letterhead = Paragraph("🏛️ OUI UNIVERSITY", letterhead_style)
    elements.append(letterhead)
    
    subtitle = Paragraph("COURSE ATTENDANCE REPORT", subtitle_style)
    elements.append(subtitle)
    
    # Horizontal line
    from reportlab.platypus import HRFlowable
    elements.append(HRFlowable(width="100%", thickness=2, color=colors.darkblue))
    elements.append(Spacer(1, 20))
    
    # Course information
    date_range = ""
    if start_date and end_date:
        date_range = f"From {start_date} to {end_date}"
    elif start_date:
        date_range = f"From {start_date} onwards"
    elif end_date:
        date_range = f"Up to {end_date}"
    else:
        date_range = "All available data"
    
    course_info_data = [
        ['📚 Course Information', ''],
        ['Course Title:', course_assignment.course.title],
        ['Course Code:', course_assignment.course.code],
        ['Department:', course_assignment.course.department.name],
        ['Level:', f"{course_assignment.course.level} Level"],
        ['Credit Units:', f"{course_assignment.course.credit_units} Units"],
        ['', ''],
        ['👨‍🏫 Lecturer Information', ''],
        ['Lecturer Name:', course_assignment.lecturer.full_name],
        ['Lecturer ID:', course_assignment.lecturer.lecturer_id or 'N/A'],
        ['', ''],
        ['📅 Report Information', ''],
        ['Academic Year:', course_assignment.academic_year],
        ['Semester:', course_assignment.semester],
        ['Date Range:', date_range],
        ['Total Sessions:', str(sessions.count())],
        ['Total Attendance Records:', str(attendances.count())],
        ['Generated By:', generated_by.full_name],
        ['Generated On:', datetime.now().strftime('%Y-%m-%d at %H:%M:%S')]
    ]
    
    course_table = Table(course_info_data, colWidths=[2.5*inch, 4*inch])
    course_table.setStyle(TableStyle([
        # Header rows
        ('BACKGROUND', (0, 0), (1, 0), colors.darkblue),
        ('BACKGROUND', (0, 7), (1, 7), colors.darkblue),
        ('BACKGROUND', (0, 11), (1, 11), colors.darkblue),
        ('TEXTCOLOR', (0, 0), (1, 0), colors.white),
        ('TEXTCOLOR', (0, 7), (1, 7), colors.white),
        ('TEXTCOLOR', (0, 11), (1, 11), colors.white),
        ('FONTNAME', (0, 0), (1, 0), 'Helvetica-Bold'),
        ('FONTNAME', (0, 7), (1, 7), 'Helvetica-Bold'),
        ('FONTNAME', (0, 11), (1, 11), 'Helvetica-Bold'),
        ('SPAN', (0, 0), (1, 0)),
        ('SPAN', (0, 7), (1, 7)),
        ('SPAN', (0, 11), (1, 11)),
        
        # General styling
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 1), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        
        # Hide empty rows
        ('BACKGROUND', (0, 6), (1, 6), colors.white),
        ('BACKGROUND', (0, 10), (1, 10), colors.white),
        ('GRID', (0, 6), (1, 6), 0, colors.white),
        ('GRID', (0, 10), (1, 10), 0, colors.white),
    ]))
    
    elements.append(course_table)
    elements.append(Spacer(1, 30))
    
    # Attendance matrix
    if sessions.exists():
        # Get enrolled students
        enrolled_students = User.objects.filter(
            enrollments__course_assignment=course_assignment,
            enrollments__status='enrolled'
        ).order_by('full_name')
        
        if enrolled_students.exists():
            header_style = ParagraphStyle(
                'Header',
                parent=styles['Heading3'],
                fontSize=12,
                textColor=colors.black,
                alignment=TA_CENTER,
                spaceAfter=20,
                fontName='Helvetica-Bold'
            )
            
            attendance_header = Paragraph("📋 ATTENDANCE MATRIX", header_style)
            elements.append(attendance_header)
            
            # Create attendance matrix
            header_row = ['👤 STUDENT NAME']
            for session in sessions:
                session_header = f"{session.scheduled_date.strftime('%m/%d')}\n{session.start_time.strftime('%H:%M')}"
                header_row.append(session_header)
            header_row.append('📊 SUMMARY')
            
            data = [header_row]
            
            for student in enrolled_students:
                row = [student.full_name]
                present_count = 0
                late_count = 0
                face_verified_count = 0
                total_sessions = len(sessions)
                
                for session in sessions:
                    attendance = attendances.filter(
                        student=student,
                        class_session=session
                    ).first()
                    
                    if attendance:
                        if attendance.status == 'present':
                            status = "✅"
                            present_count += 1
                        elif attendance.status == 'late':
                            status = "⏰"
                            late_count += 1
                        else:
                            status = "❌"
                        
                        if attendance.face_verified:
                            status += "📷"
                            face_verified_count += 1
                        
                        row.append(status)
                    else:
                        row.append('❌')
                
                # Summary column
                attendance_rate = ((present_count + late_count) / total_sessions * 100) if total_sessions > 0 else 0
                summary = f"{attendance_rate:.1f}%\n({present_count}P/{late_count}L)\n({face_verified_count}📷)"
                row.append(summary)
                data.append(row)
            
            # Create attendance table
            col_widths = [2.2*inch] + [0.6*inch] * len(sessions) + [1.2*inch]
            attendance_table = Table(data, colWidths=col_widths)
            attendance_table.setStyle(TableStyle([
                # Header styling
                ('BACKGROUND', (0, 0), (-1, 0), colors.darkblue),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 7),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                
                # Data styling
                ('FONTSIZE', (0, 1), (-1, -1), 6),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
                ('TOPPADDING', (0, 0), (-1, -1), 3),
                ('GRID', (0, 0), (-1, -1), 1, colors.black),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.lightgrey]),
            ]))
            
            elements.append(attendance_table)
            elements.append(Spacer(1, 20))
            
            # Legend
            legend_style = ParagraphStyle(
                'Legend',
                fontSize=8,
                alignment=TA_LEFT,
                spaceAfter=5
            )
            
            legend_title = Paragraph("<b>📝 LEGEND:</b>", legend_style)
            elements.append(legend_title)
            
            legend_items = [
                "✅ = Present",
                "⏰ = Late", 
                "❌ = Absent",
                "📷 = Face Recognition Verified",
                "📊 = (Attendance%) (Present/Late) (Face Verified)"
            ]
            
            for item in legend_items:
                elements.append(Paragraph(item, legend_style))
        
        else:
            elements.append(Paragraph("No enrolled students found.", styles['Normal']))
    else:
        elements.append(Paragraph("No sessions found for the specified criteria.", styles['Normal']))
    
    # Build PDF
    doc.build(elements)
    buffer.seek(0)
    
    # Return response
    response = HttpResponse(buffer.getvalue(), content_type='application/pdf')
    filename = f"Course_Attendance_{course_assignment.course.code}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response