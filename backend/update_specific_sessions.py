import os
import django

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'attendance_system.settings')
django.setup()

from courses.models import ClassSession
from django.utils import timezone

# Get current time
now = timezone.now()

# Update specific sessions by ID that are showing in the API
session_ids = [41, 42, 43, 44]  # The IDs from your API response

for session_id in session_ids:
    try:
        session = ClassSession.objects.get(id=session_id)
        session.scheduled_date = now.date()
        session.start_time = now.time()
        session.end_time = (now + timezone.timedelta(hours=3)).time()
        session.attendance_window_start = now.time()
        session.attendance_window_end = (now + timezone.timedelta(hours=3)).time()
        session.save()
        print(f"Updated session {session_id}: {session.title} - Start: {session.start_time}, End: {session.end_time}")
    except ClassSession.DoesNotExist:
        print(f"Session {session_id} not found")

print("All sessions updated to start now and end in 3 hours") 