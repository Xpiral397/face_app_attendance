import os
import django
from datetime import datetime, timedelta, time
from django.utils import timezone

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'attendance_system.settings')
django.setup()

from courses.models import CourseAssignment, ClassSession

def create_dummy_sessions():
    """Create dummy class sessions"""
    print("Creating dummy class sessions...")
    
    # Get all assignments
    assignments = CourseAssignment.objects.all()
    
    # Create sessions for this week and next week
    today = timezone.now().date()
    
    # Time slots for different courses
    time_slots = [
        (time(8, 0), time(10, 0)),
        (time(10, 0), time(12, 0)),
        (time(12, 0), time(14, 0)),
        (time(14, 0), time(16, 0)),
        (time(16, 0), time(18, 0)),
    ]
    
    sessions = []
    for assignment in assignments:
        # Create 2 sessions per week for each course
        for week_offset in range(2):  # This week and next week
            week_start = today + timedelta(days=(0 - today.weekday()) + (week_offset * 7))
            
            # Create sessions on different days
            session_days = [1, 3] if assignment.id % 2 == 0 else [0, 2]  # Mix up the days
            
            for day_offset in session_days:
                session_date = week_start + timedelta(days=day_offset)
                time_slot = time_slots[assignment.id % len(time_slots)]
                
                # Create session
                session, created = ClassSession.objects.get_or_create(
                    course_assignment=assignment,
                    scheduled_date=session_date,
                    start_time=time_slot[0],
                    defaults={
                        "title": f"{assignment.course.code} - Lecture",
                        "description": f"Regular lecture for {assignment.course.title}",
                        "end_time": time_slot[1],
                        "class_type": "physical",
                        "venue": f"Room {100 + assignment.id}",
                        "attendance_window_start": time(time_slot[0].hour, max(0, time_slot[0].minute - 5)),
                        "attendance_window_end": time(time_slot[0].hour, time_slot[0].minute + 5),
                        "is_active": True
                    }
                )
                sessions.append(session)
    
    print(f"Created {len(sessions)} sessions")
    return sessions

if __name__ == "__main__":
    create_dummy_sessions() 