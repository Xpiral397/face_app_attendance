import os
from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from django.http import HttpResponse, Http404
from django.conf import settings
from django.contrib.auth import get_user_model
from .services import ReportService

User = get_user_model()

class GenerateReportView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        """Generate attendance report"""
        if request.user.role != 'admin':
            return Response(
                {'error': 'Only admins can generate reports'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Get parameters
        format_type = request.data.get('format', 'pdf')
        user_id = request.data.get('user_id')
        start_date = request.data.get('start_date')
        end_date = request.data.get('end_date')
        status_filter = request.data.get('status')
        
        # Validate format
        if format_type not in ['pdf', 'csv', 'xlsx']:
            return Response(
                {'error': 'Invalid format. Supported formats: pdf, csv, xlsx'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate user_id if provided
        if user_id:
            try:
                User.objects.get(id=user_id)
            except User.DoesNotExist:
                return Response(
                    {'error': 'User not found'}, 
                    status=status.HTTP_404_NOT_FOUND
                )
        
        try:
            report_service = ReportService()
            result = report_service.generate_attendance_report(
                format_type=format_type,
                user_id=user_id,
                start_date=start_date,
                end_date=end_date,
                status=status_filter
            )
            
            return Response({
                'success': True,
                'message': 'Report generated successfully',
                'report': result
            })
            
        except Exception as e:
            return Response(
                {'error': f'Failed to generate report: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class DownloadReportView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request, filename):
        """Download generated report"""
        if request.user.role != 'admin':
            return Response(
                {'error': 'Only admins can download reports'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        report_service = ReportService()
        filepath = os.path.join(report_service.reports_dir, filename)
        
        if not os.path.exists(filepath):
            raise Http404("Report not found")
        
        # Get file info
        report_info = report_service.get_report_info(filepath)
        
        # Read file
        with open(filepath, 'rb') as f:
            response = HttpResponse(f.read())
        
        # Set content type based on file extension
        extension = report_info['extension']
        if extension == '.pdf':
            response['Content-Type'] = 'application/pdf'
        elif extension == '.csv':
            response['Content-Type'] = 'text/csv'
        elif extension == '.xlsx':
            response['Content-Type'] = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        else:
            response['Content-Type'] = 'application/octet-stream'
        
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        response['Content-Length'] = report_info['size']
        
        return response

class UserAttendanceSummaryView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request, user_id=None):
        """Get user attendance summary"""
        # Determine target user
        if request.user.role == 'admin':
            if user_id:
                target_user_id = user_id
            else:
                return Response(
                    {'error': 'User ID is required for admin requests'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
        else:
            # Students can only view their own summary
            target_user_id = request.user.id
        
        try:
            report_service = ReportService()
            summary = report_service.generate_user_attendance_summary(target_user_id)
            
            if 'error' in summary:
                return Response(summary, status=status.HTTP_404_NOT_FOUND)
            
            return Response(summary)
            
        except Exception as e:
            return Response(
                {'error': f'Failed to generate summary: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class ReportListView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        """List available reports"""
        if request.user.role != 'admin':
            return Response(
                {'error': 'Only admins can view reports list'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            report_service = ReportService()
            reports = []
            
            # Get all report files
            for filename in os.listdir(report_service.reports_dir):
                filepath = os.path.join(report_service.reports_dir, filename)
                if os.path.isfile(filepath):
                    report_info = report_service.get_report_info(filepath)
                    reports.append(report_info)
            
            # Sort by creation date (newest first)
            reports.sort(key=lambda x: x['created'], reverse=True)
            
            return Response({
                'reports': reports,
                'total': len(reports)
            })
            
        except Exception as e:
            return Response(
                {'error': f'Failed to list reports: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class ReportStatsView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        """Get report statistics"""
        if request.user.role != 'admin':
            return Response(
                {'error': 'Only admins can view report stats'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            report_service = ReportService()
            
            # Count reports by format
            report_counts = {'pdf': 0, 'csv': 0, 'xlsx': 0, 'total': 0}
            total_size = 0
            
            for filename in os.listdir(report_service.reports_dir):
                filepath = os.path.join(report_service.reports_dir, filename)
                if os.path.isfile(filepath):
                    report_info = report_service.get_report_info(filepath)
                    extension = report_info['extension'].lstrip('.')
                    
                    if extension in report_counts:
                        report_counts[extension] += 1
                    
                    report_counts['total'] += 1
                    total_size += report_info['size']
            
            return Response({
                'counts': report_counts,
                'total_size': total_size,
                'total_size_mb': round(total_size / 1024 / 1024, 2)
            })
            
        except Exception as e:
            return Response(
                {'error': f'Failed to get report stats: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated])
def cleanup_old_reports(request):
    """Clean up old report files"""
    if request.user.role != 'admin':
        return Response(
            {'error': 'Only admins can cleanup reports'}, 
            status=status.HTTP_403_FORBIDDEN
        )
    
    days_to_keep = int(request.data.get('days_to_keep', 30))
    
    try:
        report_service = ReportService()
        
        # Count files before cleanup
        files_before = len([f for f in os.listdir(report_service.reports_dir) 
                          if os.path.isfile(os.path.join(report_service.reports_dir, f))])
        
        # Cleanup old files
        report_service.cleanup_old_reports(days_to_keep)
        
        # Count files after cleanup
        files_after = len([f for f in os.listdir(report_service.reports_dir) 
                          if os.path.isfile(os.path.join(report_service.reports_dir, f))])
        
        deleted_count = files_before - files_after
        
        return Response({
            'success': True,
            'message': f'Cleanup completed. Deleted {deleted_count} old report files.',
            'files_before': files_before,
            'files_after': files_after,
            'deleted_count': deleted_count
        })
        
    except Exception as e:
        return Response(
            {'error': f'Failed to cleanup reports: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated])
def delete_report(request, filename):
    """Delete a specific report file"""
    if request.user.role != 'admin':
        return Response(
            {'error': 'Only admins can delete reports'}, 
            status=status.HTTP_403_FORBIDDEN
        )
    
    try:
        report_service = ReportService()
        filepath = os.path.join(report_service.reports_dir, filename)
        
        if not os.path.exists(filepath):
            return Response(
                {'error': 'Report not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        os.remove(filepath)
        
        return Response({
            'success': True,
            'message': f'Report "{filename}" deleted successfully'
        })
        
    except Exception as e:
        return Response(
            {'error': f'Failed to delete report: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        ) 