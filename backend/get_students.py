import os
import django

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'attendance_system.settings')
django.setup()

from accounts.models import User
from django.utils import timezone
from courses.models import ClassSession, Enrollment

# Get current time
now = timezone.now()

# Find ongoing classes
ongoing_classes = ClassSession.objects.filter(
    scheduled_date=now.date(),
    start_time__lte=now.time(),
    end_time__gte=now.time(),
    is_active=True
)

print("Ongoing Classes:")
for session in ongoing_classes:
    print(f"ID: {session.id}, Title: {session.title}, Start: {session.start_time}, End: {session.end_time}")

# List all scheduled classes for today
scheduled_classes = ClassSession.objects.filter(scheduled_date=now.date())

print("Scheduled Classes for Today:")
for session in scheduled_classes:
    print(f"ID: {session.id}, Title: {session.title}, Start: {session.start_time}, End: {session.end_time}")

# List all classes in the database
all_classes = ClassSession.objects.all()

print("All Classes:")
for session in all_classes:
    print(f"ID: {session.id}, Title: {session.title}, Date: {session.scheduled_date}, Start: {session.start_time}, End: {session.end_time}")

# Find students in ongoing sessions
students_in_ongoing_sessions = Enrollment.objects.filter(
    course_assignment__class_sessions__in=ongoing_classes,
    status='enrolled'
).select_related('student').distinct()

print("\nStudents in Ongoing Sessions:")
# Print student details
for enrollment in students_in_ongoing_sessions:
    student = enrollment.student
    print(f"ID: {student.id}, Name: {student.full_name}, Email: {student.email}")

# Update and save MTH-301 schedule to start now and end in 3 hours
mth_class = ClassSession.objects.filter(title__icontains='MTH-301').first()
if mth_class:
    mth_class.scheduled_date = now.date()
    mth_class.start_time = now.time()
    mth_class.end_time = (now + timezone.timedelta(hours=3)).time()
    mth_class.save(update_fields=['scheduled_date', 'start_time', 'end_time'])
    print(f"Updated MTH-301: Start: {mth_class.start_time}, End: {mth_class.end_time}")
else:
    print("MTH-301 class not found.")

# Ensure the query targets the correct course assignment ID
mth_course_assignments = Enrollment.objects.filter(
    course_assignment_id=11,  # Use the correct course assignment ID
    status='enrolled'
).select_related('student').distinct()

print("\nUsers Enrolled in MTH-301:")
for enrollment in mth_course_assignments:
    student = enrollment.student
    print(f"ID: {student.id}, Name: {student.full_name}, Email: {student.email}") 