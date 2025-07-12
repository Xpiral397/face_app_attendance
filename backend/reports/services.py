import os
import csv
from datetime import datetime
from io import BytesIO
from typing import List, Dict, Optional

import pandas as pd
from django.conf import settings
from django.http import HttpResponse
from django.contrib.auth import get_user_model
from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors

from attendance.models import Attendance

User = get_user_model()

class ReportService:
    def __init__(self):
        self.reports_dir = getattr(settings, 'REPORTS_DIR', settings.BASE_DIR / 'reports')
        if not os.path.exists(self.reports_dir):
            os.makedirs(self.reports_dir)
    
    def generate_attendance_report(self, 
                                 format_type: str = 'pdf',
                                 user_id: Optional[int] = None,
                                 start_date: Optional[str] = None,
                                 end_date: Optional[str] = None,
                                 status: Optional[str] = None) -> Dict[str, str]:
        """
        Generate attendance report in specified format
        
        Args:
            format_type: Report format ('pdf', 'csv', 'xlsx')
            user_id: Filter by specific user
            start_date: Start date filter
            end_date: End date filter
            status: Status filter
            
        Returns:
            Dictionary with file path and metadata
        """
        
        # Build queryset
        queryset = Attendance.objects.select_related('user')
        
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        
        if start_date:
            queryset = queryset.filter(timestamp__date__gte=start_date)
        
        if end_date:
            queryset = queryset.filter(timestamp__date__lte=end_date)
        
        if status:
            queryset = queryset.filter(status=status)
        
        attendances = queryset.order_by('-timestamp')
        
        # Generate report based on format
        if format_type == 'pdf':
            return self._generate_pdf_report(attendances)
        elif format_type == 'csv':
            return self._generate_csv_report(attendances)
        elif format_type == 'xlsx':
            return self._generate_excel_report(attendances)
        else:
            raise ValueError(f"Unsupported format: {format_type}")
    
    def _generate_pdf_report(self, attendances: List[Attendance]) -> Dict[str, str]:
        """Generate PDF attendance report"""
        
        # Create filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"attendance_report_{timestamp}.pdf"
        filepath = os.path.join(self.reports_dir, filename)
        
        # Create PDF document
        doc = SimpleDocTemplate(filepath, pagesize=A4)
        story = []
        
        # Get styles
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=18,
            spaceAfter=30,
            alignment=1  # Center alignment
        )
        
        # Add title
        title = Paragraph("Attendance Report", title_style)
        story.append(title)
        story.append(Spacer(1, 20))
        
        # Add generation info
        info_style = ParagraphStyle(
            'Info',
            parent=styles['Normal'],
            fontSize=12,
            spaceAfter=20
        )
        
        generation_info = Paragraph(
            f"Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}<br/>"
            f"Total Records: {len(attendances)}",
            info_style
        )
        story.append(generation_info)
        story.append(Spacer(1, 20))
        
        if not attendances:
            no_data = Paragraph("No attendance records found.", styles['Normal'])
            story.append(no_data)
        else:
            # Prepare table data
            table_data = [
                ['Student Name', 'Student ID', 'Email', 'Date', 'Time', 'Status']
            ]
            
            for attendance in attendances:
                user = attendance.user
                date_str = attendance.timestamp.strftime('%Y-%m-%d')
                time_str = attendance.timestamp.strftime('%H:%M:%S')
                
                table_data.append([
                    user.full_name,
                    user.student_id or 'N/A',
                    user.email,
                    date_str,
                    time_str,
                    attendance.status.title()
                ])
            
            # Create table
            table = Table(table_data, colWidths=[2*inch, 1*inch, 2*inch, 1*inch, 1*inch, 1*inch])
            
            # Apply table style
            table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 12),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 1), (-1, -1), 10),
                ('GRID', (0, 0), (-1, -1), 1, colors.black),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ]))
            
            story.append(table)
        
        # Add summary statistics
        if attendances:
            story.append(Spacer(1, 30))
            
            # Calculate statistics
            total_records = len(attendances)
            present_count = sum(1 for att in attendances if att.status == 'present')
            absent_count = sum(1 for att in attendances if att.status == 'absent')
            late_count = sum(1 for att in attendances if att.status == 'late')
            
            # Get unique students
            unique_students = set(att.user_id for att in attendances)
            
            stats_data = [
                ['Statistic', 'Value'],
                ['Total Records', str(total_records)],
                ['Present', str(present_count)],
                ['Absent', str(absent_count)],
                ['Late', str(late_count)],
                ['Unique Students', str(len(unique_students))]
            ]
            
            stats_table = Table(stats_data, colWidths=[3*inch, 2*inch])
            stats_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.darkblue),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 12),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.lightblue),
                ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 1), (-1, -1), 10),
                ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ]))
            
            story.append(Paragraph("Summary Statistics", styles['Heading2']))
            story.append(Spacer(1, 10))
            story.append(stats_table)
        
        # Build PDF
        doc.build(story)
        
        return {
            'file_path': filepath,
            'filename': filename,
            'format': 'pdf',
            'size': os.path.getsize(filepath),
            'records_count': len(attendances)
        }
    
    def _generate_csv_report(self, attendances: List[Attendance]) -> Dict[str, str]:
        """Generate CSV attendance report"""
        
        # Create filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"attendance_report_{timestamp}.csv"
        filepath = os.path.join(self.reports_dir, filename)
        
        # Prepare data
        with open(filepath, 'w', newline='', encoding='utf-8') as csvfile:
            writer = csv.writer(csvfile)
            
            # Write header
            writer.writerow([
                'Student Name', 'Student ID', 'Email', 'Date', 'Time', 'Status', 'Timestamp'
            ])
            
            # Write data
            for attendance in attendances:
                user = attendance.user
                writer.writerow([
                    user.full_name,
                    user.student_id or 'N/A',
                    user.email,
                    attendance.timestamp.strftime('%Y-%m-%d'),
                    attendance.timestamp.strftime('%H:%M:%S'),
                    attendance.status.title(),
                    attendance.timestamp.isoformat()
                ])
        
        return {
            'file_path': filepath,
            'filename': filename,
            'format': 'csv',
            'size': os.path.getsize(filepath),
            'records_count': len(attendances)
        }
    
    def _generate_excel_report(self, attendances: List[Attendance]) -> Dict[str, str]:
        """Generate Excel attendance report with multiple sheets"""
        
        # Create filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"attendance_report_{timestamp}.xlsx"
        filepath = os.path.join(self.reports_dir, filename)
        
        # Prepare main data
        data = []
        for attendance in attendances:
            user = attendance.user
            data.append({
                'Student Name': user.full_name,
                'Student ID': user.student_id or 'N/A',
                'Email': user.email,
                'Date': attendance.timestamp.strftime('%Y-%m-%d'),
                'Time': attendance.timestamp.strftime('%H:%M:%S'),
                'Status': attendance.status.title(),
                'Timestamp': attendance.timestamp
            })
        
        # Create Excel writer
        with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
            # Main attendance sheet
            df_main = pd.DataFrame(data)
            df_main.to_excel(writer, sheet_name='Attendance Records', index=False)
            
            # Summary statistics sheet
            if attendances:
                summary_data = {
                    'Metric': ['Total Records', 'Present', 'Absent', 'Late', 'Unique Students'],
                    'Value': [
                        len(attendances),
                        sum(1 for att in attendances if att.status == 'present'),
                        sum(1 for att in attendances if att.status == 'absent'),
                        sum(1 for att in attendances if att.status == 'late'),
                        len(set(att.user_id for att in attendances))
                    ]
                }
                df_summary = pd.DataFrame(summary_data)
                df_summary.to_excel(writer, sheet_name='Summary', index=False)
                
                # Daily attendance sheet
                daily_data = {}
                for attendance in attendances:
                    date_str = attendance.timestamp.strftime('%Y-%m-%d')
                    if date_str not in daily_data:
                        daily_data[date_str] = {'Present': 0, 'Absent': 0, 'Late': 0}
                    
                    if attendance.status == 'present':
                        daily_data[date_str]['Present'] += 1
                    elif attendance.status == 'late':
                        daily_data[date_str]['Late'] += 1
                    else:
                        daily_data[date_str]['Absent'] += 1
                
                daily_df_data = []
                for date, stats in daily_data.items():
                    daily_df_data.append({
                        'Date': date,
                        'Present': stats['Present'],
                        'Late': stats['Late'],
                        'Absent': stats['Absent'],
                        'Total': stats['Present'] + stats['Late'] + stats['Absent']
                    })
                
                df_daily = pd.DataFrame(daily_df_data)
                df_daily.to_excel(writer, sheet_name='Daily Summary', index=False)
        
        return {
            'file_path': filepath,
            'filename': filename,
            'format': 'xlsx',
            'size': os.path.getsize(filepath),
            'records_count': len(attendances)
        }
    
    def get_report_info(self, filepath: str) -> Dict[str, any]:
        """Get information about a generated report"""
        
        if not os.path.exists(filepath):
            return {"error": "File not found"}
        
        file_stat = os.stat(filepath)
        return {
            "filename": os.path.basename(filepath),
            "size": file_stat.st_size,
            "created": datetime.fromtimestamp(file_stat.st_ctime).isoformat(),
            "modified": datetime.fromtimestamp(file_stat.st_mtime).isoformat(),
            "extension": os.path.splitext(filepath)[1].lower()
        }
    
    def cleanup_old_reports(self, days_to_keep: int = 30):
        """Clean up old report files"""
        
        cutoff_time = datetime.now().timestamp() - (days_to_keep * 24 * 60 * 60)
        
        for filename in os.listdir(self.reports_dir):
            filepath = os.path.join(self.reports_dir, filename)
            if os.path.isfile(filepath):
                file_time = os.path.getmtime(filepath)
                if file_time < cutoff_time:
                    try:
                        os.remove(filepath)
                        print(f"Deleted old report: {filename}")
                    except Exception as e:
                        print(f"Error deleting file {filename}: {str(e)}")
    
    def generate_user_attendance_summary(self, user_id: int) -> Dict[str, any]:
        """Generate attendance summary for a specific user"""
        
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return {"error": "User not found"}
        
        attendances = Attendance.objects.filter(user=user).order_by('-timestamp')
        
        total_records = attendances.count()
        present_count = attendances.filter(status='present').count()
        absent_count = attendances.filter(status='absent').count()
        late_count = attendances.filter(status='late').count()
        
        attendance_rate = (present_count / total_records * 100) if total_records > 0 else 0
        
        return {
            'user': {
                'id': user.id,
                'name': user.full_name,
                'email': user.email,
                'student_id': user.student_id
            },
            'summary': {
                'total_records': total_records,
                'present_count': present_count,
                'absent_count': absent_count,
                'late_count': late_count,
                'attendance_rate': round(attendance_rate, 2)
            },
            'recent_attendance': [
                {
                    'date': att.timestamp.strftime('%Y-%m-%d'),
                    'time': att.timestamp.strftime('%H:%M:%S'),
                    'status': att.status
                }
                for att in attendances[:10]
            ]
        } 