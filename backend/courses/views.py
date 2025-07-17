from rest_framework import generics, status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import Q, Count
from django.utils import timezone
from django.shortcuts import get_object_or_404
from django.db import transaction
from datetime import datetime, timedelta
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters
from django.contrib.auth import get_user_model

from .models import (
    College, Department, Course, CourseAssignment, 
    Enrollment, ClassSession, Notification, ClassAttendance
)
from .serializers import (
    CollegeSerializer, DepartmentSerializer, CourseSerializer, 
    CourseAssignmentSerializer, EnrollmentSerializer, 
    ClassSessionSerializer, NotificationSerializer, ClassAttendanceSerializer
)
from face_recognition_app.models import FaceEncoding

User = get_user_model()

# College and Department Views
class CollegeListCreateView(generics.ListCreateAPIView):
    queryset = College.objects.filter(is_active=True)
    serializer_class = CollegeSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def perform_create(self, serializer):
        # Only admins can create colleges
        if self.request.user.role != 'admin':
            return Response({'error': 'Only admins can create colleges'}, status=403)
        serializer.save()

class CollegeDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = College.objects.all()
    serializer_class = CollegeSerializer
    permission_classes = [permissions.IsAuthenticated]
    
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
    permission_classes = [permissions.IsAuthenticated]
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
    permission_classes = [permissions.IsAuthenticated]
    
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
        if user.is_student:
            queryset = queryset.filter(
                department=user.department,
                level=user.level
            )
        
        return queryset
    
    def perform_create(self, serializer):
        if not self.request.user.is_admin:
            raise permissions.PermissionDenied("Only admins can create courses")
        serializer.save(created_by=self.request.user)

class CourseDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Course.objects.all()
    serializer_class = CourseSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def perform_update(self, serializer):
        if not self.request.user.is_admin:
            raise permissions.PermissionDenied("Only admins can update courses")
        serializer.save()
    
    def perform_destroy(self, instance):
        if not self.request.user.is_admin:
            raise permissions.PermissionDenied("Only admins can delete courses")
        instance.is_active = False
        instance.save()

# Course Assignment Views
class CourseAssignmentListCreateView(generics.ListCreateAPIView):
    serializer_class = CourseAssignmentSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['academic_year', 'semester', 'lecturer']
    
    def get_queryset(self):
        user = self.request.user
        queryset = CourseAssignment.objects.filter(is_active=True)
        
        # Lecturers see only their assignments
        if user.is_lecturer:
            queryset = queryset.filter(lecturer=user)
        
        return queryset
    
    def perform_create(self, serializer):
        if not self.request.user.is_admin:
            raise permissions.PermissionDenied("Only admins can create course assignments")
        assignment = serializer.save(assigned_by=self.request.user)
        
        # Create notification for lecturer
        Notification.objects.create(
            recipient=assignment.lecturer,
            sender=self.request.user,
            notification_type='assignment_created',
            title=f'New Course Assignment: {assignment.course.code}',
            message=f'You have been assigned to teach {assignment.course.code} - {assignment.course.title} for {assignment.academic_year} {assignment.semester} semester.'
        )

class CourseAssignmentDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = CourseAssignment.objects.all()
    serializer_class = CourseAssignmentSerializer
    permission_classes = [permissions.IsAuthenticated]

# Enrollment Views
class EnrollmentListView(generics.ListAPIView):
    serializer_class = EnrollmentSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status', 'course_assignment']
    
    def get_queryset(self):
        user = self.request.user
        
        if user.is_student:
            return Enrollment.objects.filter(student=user)
        elif user.is_lecturer:
            return Enrollment.objects.filter(course_assignment__lecturer=user)
        else:  # Admin
            return Enrollment.objects.all()

class EnrollmentRequestView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        if not request.user.is_student:
            return Response(
                {'error': 'Only students can request enrollment'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        assignment_id = request.data.get('course_assignment_id')
        if not assignment_id:
            return Response(
                {'error': 'course_assignment_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            assignment = CourseAssignment.objects.get(id=assignment_id, is_active=True)
        except CourseAssignment.DoesNotExist:
            return Response(
                {'error': 'Course assignment not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Check if student's department matches course department
        if request.user.department != assignment.course.department:
            return Response(
                {'error': 'You can only enroll in courses from your department'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if student's level matches course level
        if request.user.level != assignment.course.level:
            return Response(
                {'error': 'You can only enroll in courses for your level'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if already enrolled
        if Enrollment.objects.filter(student=request.user, course_assignment=assignment).exists():
            return Response(
                {'error': 'You have already requested enrollment for this course'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create enrollment request
        enrollment = Enrollment.objects.create(
            student=request.user,
            course_assignment=assignment
        )
        
        # Create notification for lecturer
        Notification.objects.create(
            recipient=assignment.lecturer,
            sender=request.user,
            notification_type='enrollment_request',
            title=f'New Enrollment Request for {assignment.course.code}',
            message=f'{request.user.full_name} ({request.user.student_id}) has requested to enroll in {assignment.course.code}.',
            related_enrollment=enrollment
        )
        
        return Response(
            EnrollmentSerializer(enrollment).data,
            status=status.HTTP_201_CREATED
        )

class EnrollmentProcessView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request, pk):
        try:
            enrollment = Enrollment.objects.get(id=pk)
        except Enrollment.DoesNotExist:
            return Response(
                {'error': 'Enrollment not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Only lecturer assigned to the course or admin can process
        if not (request.user == enrollment.course_assignment.lecturer or request.user.is_admin):
            return Response(
                {'error': 'You are not authorized to process this enrollment'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        action = request.data.get('action')  # 'approve' or 'reject'
        notes = request.data.get('notes', '')
        
        if action not in ['approve', 'reject']:
            return Response(
                {'error': 'Action must be either "approve" or "reject"'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        enrollment.status = 'approved' if action == 'approve' else 'rejected'
        enrollment.processed_at = timezone.now()
        enrollment.processed_by = request.user
        enrollment.notes = notes
        enrollment.save()
        
        # Create notification for student
        notification_type = 'enrollment_approved' if action == 'approve' else 'enrollment_rejected'
        message = f'Your enrollment request for {enrollment.course_assignment.course.code} has been {action}d.'
        if notes:
            message += f' Notes: {notes}'
        
        Notification.objects.create(
            recipient=enrollment.student,
            sender=request.user,
            notification_type=notification_type,
            title=f'Enrollment {action.title()}d: {enrollment.course_assignment.course.code}',
            message=message,
            related_enrollment=enrollment
        )
        
        return Response(
            EnrollmentSerializer(enrollment).data,
            status=status.HTTP_200_OK
        )

# Class Session Views
class ClassSessionListCreateView(generics.ListCreateAPIView):
    serializer_class = ClassSessionSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['course_assignment', 'class_type', 'scheduled_date']
    
    def get_queryset(self):
        user = self.request.user
        
        if user.is_lecturer:
            return ClassSession.objects.filter(course_assignment__lecturer=user, is_active=True)
        elif user.is_student:
            # Show sessions for courses student is enrolled in
            enrolled_assignments = Enrollment.objects.filter(
                student=user, status='approved'
            ).values_list('course_assignment', flat=True)
            return ClassSession.objects.filter(
                course_assignment__in=enrolled_assignments, 
                is_active=True
            )
        else:  # Admin
            return ClassSession.objects.filter(is_active=True)
    
    def perform_create(self, serializer):
        if not self.request.user.is_lecturer:
            raise permissions.PermissionDenied("Only lecturers can create class sessions")
        
        # Ensure lecturer is assigned to the course
        assignment = serializer.validated_data['course_assignment']
        if assignment.lecturer != self.request.user:
            raise permissions.PermissionDenied("You can only create sessions for your assigned courses")
        
        session = serializer.save()
        
        # Create notifications for enrolled students
        enrolled_students = Enrollment.objects.filter(
            course_assignment=assignment,
            status='approved'
        ).select_related('student')
        
        notifications = []
        for enrollment in enrolled_students:
            notifications.append(Notification(
                recipient=enrollment.student,
                sender=self.request.user,
                notification_type='class_scheduled',
                title=f'New Class: {session.course_assignment.course.code}',
                message=f'A new class "{session.title}" has been scheduled for {session.scheduled_date} at {session.start_time}.',
                related_class_session=session
            ))
        
        Notification.objects.bulk_create(notifications)

class ClassSessionDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = ClassSession.objects.all()
    serializer_class = ClassSessionSerializer
    permission_classes = [permissions.IsAuthenticated]

# Attendance Views
class MarkClassAttendanceView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        if not request.user.is_student:
            return Response(
                {'error': 'Only students can mark attendance'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        session_id = request.data.get('session_id')
        try:
            session = ClassSession.objects.get(id=session_id, is_active=True)
        except ClassSession.DoesNotExist:
            return Response(
                {'error': 'Class session not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Check if student is enrolled
        if not Enrollment.objects.filter(
            student=request.user,
            course_assignment=session.course_assignment,
            status='approved'
        ).exists():
            return Response(
                {'error': 'You are not enrolled in this course'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Check if attendance window is open
        if not session.is_attendance_open:
            return Response(
                {'error': 'Attendance window is not open for this session'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if already marked attendance
        if ClassAttendance.objects.filter(class_session=session, student=request.user).exists():
            return Response(
                {'error': 'You have already marked attendance for this session'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Handle face verification if image provided
        face_verified = False
        if 'image' in request.FILES:
            try:
                face_encoding = FaceEncoding.objects.get(user=request.user, is_active=True)
                # Here you would implement face verification logic
                # For now, we'll assume verification is successful
                face_verified = True
            except FaceEncoding.DoesNotExist:
                return Response(
                    {'error': 'No face encoding found. Please register your face first.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Determine attendance status based on time
        now = timezone.now().time()
        status_value = 'present'
        if now > session.start_time:
            # Calculate minutes late
            start_datetime = timezone.datetime.combine(session.scheduled_date, session.start_time)
            now_datetime = timezone.now()
            if start_datetime.date() == now_datetime.date():
                minutes_late = (now_datetime.time().hour * 60 + now_datetime.time().minute) - \
                             (session.start_time.hour * 60 + session.start_time.minute)
                if minutes_late > 15:  # More than 15 minutes late
                    status_value = 'late'
        
        # Create attendance record
        attendance = ClassAttendance.objects.create(
            class_session=session,
            student=request.user,
            status=status_value,
            face_verified=face_verified,
            notes=request.data.get('notes', '')
        )
        
        return Response(
            ClassAttendanceSerializer(attendance).data,
            status=status.HTTP_201_CREATED
        )

class ClassAttendanceListView(generics.ListAPIView):
    serializer_class = ClassAttendanceSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        session_id = self.kwargs['session_id']
        session = get_object_or_404(ClassSession, id=session_id)
        
        # Only lecturer of the course or admin can view attendance
        if not (self.request.user == session.course_assignment.lecturer or self.request.user.is_admin):
            raise permissions.PermissionDenied("You are not authorized to view this attendance data")
        
        return ClassAttendance.objects.filter(class_session=session)

# Notification Views
class NotificationListView(generics.ListAPIView):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['is_read', 'notification_type']
    
    def get_queryset(self):
        return Notification.objects.filter(recipient=self.request.user)

class MarkNotificationReadView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request, pk):
        try:
            notification = Notification.objects.get(id=pk, recipient=request.user)
            notification.mark_as_read()
            return Response({'message': 'Notification marked as read'})
        except Notification.DoesNotExist:
            return Response(
                {'error': 'Notification not found'},
                status=status.HTTP_404_NOT_FOUND
            )

# Dashboard Views
class LecturerDashboardView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        if not request.user.is_lecturer:
            return Response(
                {'error': 'Only lecturers can access this dashboard'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Get lecturer's course assignments
        total_assignments = CourseAssignment.objects.filter(lecturer=request.user).count()
        active_assignments = CourseAssignment.objects.filter(lecturer=request.user, is_active=True).count()
        
        # Get total students enrolled in lecturer's courses
        total_students = Enrollment.objects.filter(
            course_assignment__lecturer=request.user,
            status='approved'
        ).values('student').distinct().count()
        
        # Get classes for today
        today = timezone.now().date()
        total_classes_today = ClassSession.objects.filter(
            course_assignment__lecturer=request.user,
            scheduled_date=today,
            is_active=True
        ).count()
        
        # Get upcoming classes
        upcoming_classes = ClassSession.objects.filter(
            course_assignment__lecturer=request.user,
            scheduled_date__gte=today,
            is_active=True
        ).order_by('scheduled_date', 'start_time')[:5]
        
        # Get recent attendances from lecturer's classes
        from courses.models import ClassAttendance
        recent_attendances = ClassAttendance.objects.filter(
            class_session__course_assignment__lecturer=request.user
        ).order_by('-marked_at')[:10]
        
        return Response({
            'total_assignments': total_assignments,
            'active_assignments': active_assignments,
            'total_students': total_students,
            'total_classes_today': total_classes_today,
            'upcoming_classes': ClassSessionSerializer(upcoming_classes, many=True).data,
            'recent_attendances': ClassAttendanceSerializer(recent_attendances, many=True).data,
        })

class StudentDashboardView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        if not request.user.is_student:
            return Response(
                {'error': 'Only students can access this dashboard'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Get student's enrollments
        enrollments = Enrollment.objects.filter(student=request.user)
        approved_enrollments = enrollments.filter(status='approved')
        
        # Get upcoming classes for enrolled courses
        upcoming_classes = ClassSession.objects.filter(
            course_assignment__in=approved_enrollments.values_list('course_assignment', flat=True),
            scheduled_date__gte=timezone.now().date(),
            is_active=True
        ).order_by('scheduled_date', 'start_time')[:5]
        
        # Get classes for today
        today = timezone.now().date()
        classes_today = ClassSession.objects.filter(
            course_assignment__in=approved_enrollments.values_list('course_assignment', flat=True),
            scheduled_date=today,
            is_active=True
        ).count()
        
        # Calculate attendance rate
        from courses.models import ClassAttendance
        total_past_sessions = ClassSession.objects.filter(
            course_assignment__in=approved_enrollments.values_list('course_assignment', flat=True),
            scheduled_date__lt=today,
            is_active=True
        ).count()
        
        attended_sessions = ClassAttendance.objects.filter(
            student=request.user,
            status='present',
            class_session__scheduled_date__lt=today
        ).count()
        
        attendance_rate = (attended_sessions / total_past_sessions * 100) if total_past_sessions > 0 else 0
        
        # Get recent notifications
        recent_notifications = Notification.objects.filter(
            recipient=request.user
        ).order_by('-created_at')[:5]
        
        return Response({
            'enrolled_courses': approved_enrollments.count(),
            'classes_today': classes_today,
            'attendance_rate': round(attendance_rate, 1),
            'upcoming_classes': ClassSessionSerializer(upcoming_classes, many=True).data,
            'recent_notifications': NotificationSerializer(recent_notifications, many=True).data,
        })

class AdminDashboardView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        if not request.user.is_admin:
            return Response(
                {'error': 'Only admins can access this dashboard'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Get system-wide statistics
        total_users = User.objects.count()
        total_courses = Course.objects.filter(is_active=True).count()
        total_departments = Department.objects.filter(is_active=True).count()
        total_enrollments = Enrollment.objects.count()
        
        # Get recent enrollments (last 10)
        recent_enrollments = Enrollment.objects.select_related(
            'student', 'course_assignment__course', 'course_assignment__lecturer'
        ).order_by('-requested_at')[:10]
        
        # System stats
        pending_enrollments = Enrollment.objects.filter(status='pending').count()
        total_sessions = ClassSession.objects.filter(is_active=True).count()
        total_assignments = CourseAssignment.objects.filter(is_active=True).count()
        
        return Response({
            'total_users': total_users,
            'total_courses': total_courses,
            'total_departments': total_departments,
            'total_enrollments': total_enrollments,
            'recent_enrollments': EnrollmentSerializer(recent_enrollments, many=True).data,
            'system_stats': {
                'pending_enrollments': pending_enrollments,
                'total_sessions': total_sessions,
                'total_assignments': total_assignments,
            }
        }) 