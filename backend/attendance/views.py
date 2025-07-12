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
from .models import Attendance, AttendanceStats, AttendanceSession
from accounts.models import User
from .serializers import (
    AttendanceSerializer,
    AttendanceCreateSerializer,
    AttendanceStatsSerializer,
    AttendanceSessionSerializer,
    BulkAttendanceSerializer,
    AttendanceAnalyticsSerializer,
    DashboardStatsSerializer,
)


class AttendanceListView(generics.ListAPIView):
    """List all attendance records with filtering and search capabilities"""
    serializer_class = AttendanceSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'user', 'timestamp']
    search_fields = ['user__full_name', 'user__email', 'user__student_id']
    ordering_fields = ['timestamp', 'created_at']
    ordering = ['-timestamp']
    
    def get_queryset(self):
        queryset = Attendance.objects.select_related('user')
        
        # If user is not admin, only show their own attendance
        if not self.request.user.is_admin:
            queryset = queryset.filter(user=self.request.user)
        
        # Date filtering
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        
        if start_date:
            try:
                start_date = datetime.strptime(start_date, '%Y-%m-%d').date()
                queryset = queryset.filter(timestamp__date__gte=start_date)
            except ValueError:
                pass
        
        if end_date:
            try:
                end_date = datetime.strptime(end_date, '%Y-%m-%d').date()
                queryset = queryset.filter(timestamp__date__lte=end_date)
            except ValueError:
                pass
        
        return queryset


class AttendanceCreateView(generics.CreateAPIView):
    """Create a new attendance record"""
    serializer_class = AttendanceCreateSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def perform_create(self, serializer):
        # If user is not admin, they can only mark their own attendance
        if not self.request.user.is_admin:
            serializer.save(user=self.request.user)
        else:
            serializer.save()
        
        # Update attendance stats after creating
        user = serializer.instance.user
        stats, created = AttendanceStats.objects.get_or_create(user=user)
        stats.update_stats()


class AttendanceDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update, or delete a specific attendance record"""
    serializer_class = AttendanceSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        queryset = Attendance.objects.select_related('user')
        
        # If user is not admin, only show their own attendance
        if not self.request.user.is_admin:
            queryset = queryset.filter(user=self.request.user)
        
        return queryset
    
    def perform_update(self, serializer):
        serializer.save()
        
        # Update attendance stats after updating
        user = serializer.instance.user
        stats, created = AttendanceStats.objects.get_or_create(user=user)
        stats.update_stats()
    
    def perform_destroy(self, instance):
        user = instance.user
        instance.delete()
        
        # Update attendance stats after deleting
        stats, created = AttendanceStats.objects.get_or_create(user=user)
        stats.update_stats()


class AttendanceStatsView(generics.ListAPIView):
    """View attendance statistics for users"""
    serializer_class = AttendanceStatsSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['user__full_name', 'user__email', 'user__student_id']
    ordering_fields = ['attendance_percentage', 'total_days', 'present_days']
    ordering = ['-attendance_percentage']
    
    def get_queryset(self):
        queryset = AttendanceStats.objects.select_related('user')
        
        # If user is not admin, only show their own stats
        if not self.request.user.is_admin:
            queryset = queryset.filter(user=self.request.user)
        
        return queryset


class AttendanceAnalyticsView(APIView):
    """Provide detailed analytics for attendance data"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        serializer = AttendanceAnalyticsSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        
        period = serializer.validated_data.get('period', 'monthly')
        start_date = serializer.validated_data.get('start_date')
        end_date = serializer.validated_data.get('end_date')
        user_id = serializer.validated_data.get('user_id')
        
        # Base queryset
        queryset = Attendance.objects.all()
        
        # Filter by user if not admin
        if not request.user.is_admin:
            queryset = queryset.filter(user=request.user)
        elif user_id:
            queryset = queryset.filter(user_id=user_id)
        
        # Filter by date range
        if start_date:
            queryset = queryset.filter(timestamp__date__gte=start_date)
        if end_date:
            queryset = queryset.filter(timestamp__date__lte=end_date)
        
        # Generate analytics based on period
        if period == 'daily':
            analytics = self._get_daily_analytics(queryset)
        elif period == 'weekly':
            analytics = self._get_weekly_analytics(queryset)
        elif period == 'monthly':
            analytics = self._get_monthly_analytics(queryset)
        else:  # yearly
            analytics = self._get_yearly_analytics(queryset)
        
        return Response(analytics)
    
    def _get_daily_analytics(self, queryset):
        """Get daily attendance analytics"""
        daily_stats = []
        
        # Get date range
        dates = queryset.values_list('timestamp__date', flat=True).distinct()
        
        for date in dates:
            day_attendance = queryset.filter(timestamp__date=date)
            total = day_attendance.count()
            present = day_attendance.filter(status='present').count()
            absent = day_attendance.filter(status='absent').count()
            late = day_attendance.filter(status='late').count()
            
            daily_stats.append({
                'date': date,
                'total': total,
                'present': present,
                'absent': absent,
                'late': late,
                'percentage': (present / total * 100) if total > 0 else 0
            })
        
        return {
            'period': 'daily',
            'data': daily_stats,
            'summary': {
                'total_days': len(daily_stats),
                'avg_attendance': sum(day['percentage'] for day in daily_stats) / len(daily_stats) if daily_stats else 0
            }
        }
    
    def _get_monthly_analytics(self, queryset):
        """Get monthly attendance analytics"""
        monthly_stats = queryset.extra(
            select={'month': 'EXTRACT(month FROM timestamp)', 'year': 'EXTRACT(year FROM timestamp)'}
        ).values('month', 'year').annotate(
            total=Count('id'),
            present=Count('id', filter=Q(status='present')),
            absent=Count('id', filter=Q(status='absent')),
            late=Count('id', filter=Q(status='late'))
        ).order_by('year', 'month')
        
        for stat in monthly_stats:
            stat['percentage'] = (stat['present'] / stat['total'] * 100) if stat['total'] > 0 else 0
            stat['month_name'] = datetime(int(stat['year']), int(stat['month']), 1).strftime('%B')
        
        return {
            'period': 'monthly',
            'data': list(monthly_stats),
            'summary': {
                'total_months': len(monthly_stats),
                'avg_attendance': sum(stat['percentage'] for stat in monthly_stats) / len(monthly_stats) if monthly_stats else 0
            }
        }
    
    def _get_weekly_analytics(self, queryset):
        """Get weekly attendance analytics"""
        # This is a simplified version - you might want to implement proper week grouping
        return self._get_monthly_analytics(queryset)
    
    def _get_yearly_analytics(self, queryset):
        """Get yearly attendance analytics"""
        yearly_stats = queryset.extra(
            select={'year': 'EXTRACT(year FROM timestamp)'}
        ).values('year').annotate(
            total=Count('id'),
            present=Count('id', filter=Q(status='present')),
            absent=Count('id', filter=Q(status='absent')),
            late=Count('id', filter=Q(status='late'))
        ).order_by('year')
        
        for stat in yearly_stats:
            stat['percentage'] = (stat['present'] / stat['total'] * 100) if stat['total'] > 0 else 0
        
        return {
            'period': 'yearly',
            'data': list(yearly_stats),
            'summary': {
                'total_years': len(yearly_stats),
                'avg_attendance': sum(stat['percentage'] for stat in yearly_stats) / len(yearly_stats) if yearly_stats else 0
            }
        }


class BulkAttendanceView(APIView):
    """Handle bulk attendance operations"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        # Only admins can perform bulk operations
        if not request.user.is_admin:
            return Response(
                {'error': 'Only admins can perform bulk operations'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = BulkAttendanceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        with transaction.atomic():
            result = serializer.save()
            
            # Update stats for all affected users
            user_ids = serializer.validated_data['user_ids']
            for user_id in user_ids:
                user = User.objects.get(id=user_id)
                stats, created = AttendanceStats.objects.get_or_create(user=user)
                stats.update_stats()
        
        return Response(result, status=status.HTTP_201_CREATED)


class AttendanceSessionListView(generics.ListCreateAPIView):
    """List and create attendance sessions"""
    serializer_class = AttendanceSessionSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'created_by__full_name']
    ordering_fields = ['start_time', 'end_time', 'created_at']
    ordering = ['-start_time']
    
    def get_queryset(self):
        queryset = AttendanceSession.objects.select_related('created_by')
        
        # Filter by active sessions if requested
        if self.request.query_params.get('active_only'):
            queryset = queryset.filter(is_active=True)
        
        return queryset
    
    def perform_create(self, serializer):
        # Only admins can create sessions
        if not self.request.user.is_admin:
            raise permissions.PermissionDenied("Only admins can create attendance sessions")
        
        serializer.save(created_by=self.request.user)


class AttendanceSessionDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update, or delete a specific attendance session"""
    serializer_class = AttendanceSessionSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        return AttendanceSession.objects.select_related('created_by')
    
    def perform_update(self, serializer):
        # Only admins can update sessions
        if not self.request.user.is_admin:
            raise permissions.PermissionDenied("Only admins can update attendance sessions")
        
        serializer.save()
    
    def perform_destroy(self, instance):
        # Only admins can delete sessions
        if not self.request.user.is_admin:
            raise permissions.PermissionDenied("Only admins can delete attendance sessions")
        
        instance.delete()


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def dashboard_stats(request):
    """Get dashboard statistics for attendance"""
    today = timezone.now().date()
    
    # Get basic stats
    total_users = User.objects.filter(role='student').count()
    
    # Today's attendance
    today_attendance = Attendance.objects.filter(timestamp__date=today)
    total_attendance_today = today_attendance.count()
    present_today = today_attendance.filter(status='present').count()
    absent_today = today_attendance.filter(status='absent').count()
    late_today = today_attendance.filter(status='late').count()
    
    # Calculate attendance percentage for today
    attendance_percentage_today = (present_today / total_users * 100) if total_users > 0 else 0
    
    # Session stats
    total_sessions = AttendanceSession.objects.count()
    active_sessions = AttendanceSession.objects.filter(is_active=True).count()
    
    # If user is not admin, only show their own stats
    if not request.user.is_admin:
        user_attendance_today = today_attendance.filter(user=request.user)
        present_today = user_attendance_today.filter(status='present').count()
        absent_today = user_attendance_today.filter(status='absent').count()
        late_today = user_attendance_today.filter(status='late').count()
        total_attendance_today = user_attendance_today.count()
        attendance_percentage_today = (present_today / 1 * 100) if total_attendance_today > 0 else 0
        total_users = 1
    
    data = {
        'total_users': total_users,
        'total_attendance_today': total_attendance_today,
        'present_today': present_today,
        'absent_today': absent_today,
        'late_today': late_today,
        'attendance_percentage_today': round(attendance_percentage_today, 2),
        'total_sessions': total_sessions,
        'active_sessions': active_sessions,
    }
    
    serializer = DashboardStatsSerializer(data)
    return Response(serializer.data) 