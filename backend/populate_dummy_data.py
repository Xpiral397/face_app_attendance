#!/usr/bin/env python
import os
import django
import sys
from datetime import datetime, timedelta
from django.utils import timezone
from django.core.management.base import BaseCommand

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'attendance_system.settings')
django.setup()

from django.contrib.auth import get_user_model
from courses.models import College, Department, Course, CourseAssignment, Enrollment, ClassSession, Notification
from attendance.models import Attendance, AttendanceSession
from face_recognition_app.models import FaceEncoding, FaceRecognitionLog

User = get_user_model()

def create_dummy_users():
    """Create dummy users (lecturers and students)"""
    print("Creating dummy users...")
    
    # Create lecturers
    lecturers = [
        {"email": "john.doe@university.edu", "username": "john_doe", "full_name": "Dr. John Doe", "role": "lecturer", "lecturer_id": "LEC001"},
        {"email": "jane.smith@university.edu", "username": "jane_smith", "full_name": "Prof. Jane Smith", "role": "lecturer", "lecturer_id": "LEC002"},
        {"email": "mike.brown@university.edu", "username": "mike_brown", "full_name": "Dr. Mike Brown", "role": "lecturer", "lecturer_id": "LEC003"},
        {"email": "sarah.wilson@university.edu", "username": "sarah_wilson", "full_name": "Prof. Sarah Wilson", "role": "lecturer", "lecturer_id": "LEC004"},
        {"email": "david.jones@university.edu", "username": "david_jones", "full_name": "Dr. David Jones", "role": "lecturer", "lecturer_id": "LEC005"},
    ]
    
    # Create students
    students = [
        {"email": "alice.student@university.edu", "username": "alice_student", "full_name": "Alice Johnson", "role": "student", "student_id": "STU001", "level": "300"},
        {"email": "bob.student@university.edu", "username": "bob_student", "full_name": "Bob Williams", "role": "student", "student_id": "STU002", "level": "300"},
        {"email": "charlie.student@university.edu", "username": "charlie_student", "full_name": "Charlie Davis", "role": "student", "student_id": "STU003", "level": "300"},
        {"email": "diana.student@university.edu", "username": "diana_student", "full_name": "Diana Miller", "role": "student", "student_id": "STU004", "level": "300"},
        {"email": "eve.student@university.edu", "username": "eve_student", "full_name": "Eve Garcia", "role": "student", "student_id": "STU005", "level": "300"},
        {"email": "frank.student@university.edu", "username": "frank_student", "full_name": "Frank Rodriguez", "role": "student", "student_id": "STU006", "level": "300"},
        {"email": "grace.student@university.edu", "username": "grace_student", "full_name": "Grace Martinez", "role": "student", "student_id": "STU007", "level": "300"},
        {"email": "henry.student@university.edu", "username": "henry_student", "full_name": "Henry Anderson", "role": "student", "student_id": "STU008", "level": "300"},
    ]
    
    # Get Computer Science department
    cs_dept = Department.objects.get(code="CSC")
    
    created_lecturers = []
    for lecturer_data in lecturers:
        # Check if user already exists
        try:
            lecturer = User.objects.get(email=lecturer_data["email"])
            created_lecturers.append(lecturer)
        except User.DoesNotExist:
            # Check if lecturer_id is already taken
            if User.objects.filter(lecturer_id=lecturer_data["lecturer_id"]).exists():
                # Skip this lecturer or create with different ID
                continue
            
            lecturer = User.objects.create(
                email=lecturer_data["email"],
                username=lecturer_data["username"],
                full_name=lecturer_data["full_name"],
                role=lecturer_data["role"],
                lecturer_id=lecturer_data["lecturer_id"],
                department=cs_dept
            )
            lecturer.set_password("password123")
            lecturer.save()
            created_lecturers.append(lecturer)
    
    created_students = []
    for student_data in students:
        # Check if user already exists
        try:
            student = User.objects.get(email=student_data["email"])
            created_students.append(student)
        except User.DoesNotExist:
            # Check if student_id is already taken
            if User.objects.filter(student_id=student_data["student_id"]).exists():
                # Skip this student or create with different ID
                continue
            
            student = User.objects.create(
                email=student_data["email"],
                username=student_data["username"],
                full_name=student_data["full_name"],
                role=student_data["role"],
                student_id=student_data["student_id"],
                level=student_data["level"],
                department=cs_dept
            )
            student.set_password("password123")
            student.save()
            created_students.append(student)
    
    return created_lecturers, created_students

def create_dummy_courses():
    """Create dummy courses"""
    print("Creating dummy courses...")
    
    cs_dept = Department.objects.get(code="CSC")
    
    courses_data = [
        {"code": "CSC301", "title": "Data Structures and Algorithms", "credit_units": 3, "level": "300", "description": "Advanced data structures and algorithm design"},
        {"code": "CSC302", "title": "Database Systems", "credit_units": 3, "level": "300", "description": "Database design and management systems"},
        {"code": "CSC303", "title": "Software Engineering", "credit_units": 3, "level": "300", "description": "Software development methodologies and practices"},
        {"code": "CSC304", "title": "Computer Networks", "credit_units": 3, "level": "300", "description": "Network protocols and distributed systems"},
        {"code": "CSC305", "title": "Web Development", "credit_units": 3, "level": "300", "description": "Modern web development technologies"},
        {"code": "CSC306", "title": "Machine Learning", "credit_units": 3, "level": "300", "description": "Introduction to machine learning algorithms"},
        {"code": "CSC307", "title": "Cybersecurity", "credit_units": 3, "level": "300", "description": "Information security and cybersecurity principles"},
    ]
    
    admin_user = User.objects.filter(role="admin").first()
    if not admin_user:
        admin_user = User.objects.create_user(
            email="admin@university.edu",
            username="admin",
            full_name="System Admin",
            role="admin",
            password="admin123"
        )
    
    created_courses = []
    for course_data in courses_data:
        course, created = Course.objects.get_or_create(
            code=course_data["code"],
            defaults={
                "title": course_data["title"],
                "credit_units": course_data["credit_units"],
                "level": course_data["level"],
                "description": course_data["description"],
                "department": cs_dept,
                "created_by": admin_user
            }
        )
        created_courses.append(course)
    
    return created_courses

def create_dummy_assignments(courses, lecturers):
    """Create dummy course assignments"""
    print("Creating dummy course assignments...")
    
    admin_user = User.objects.filter(role="admin").first()
    current_year = "2024/2025"
    semester = "First"
    
    assignments = []
    for i, course in enumerate(courses):
        lecturer = lecturers[i % len(lecturers)]
        assignment, created = CourseAssignment.objects.get_or_create(
            course=course,
            lecturer=lecturer,
            academic_year=current_year,
            semester=semester,
            defaults={
                "assigned_by": admin_user
            }
        )
        assignments.append(assignment)
    
    return assignments

def create_dummy_enrollments(assignments, students):
    """Create dummy enrollments"""
    print("Creating dummy enrollments...")
    
    # Enroll students in multiple courses
    for student in students:
        # Each student enrolls in 4-5 courses
        student_assignments = assignments[:5] if student.student_id in ["STU001", "STU002"] else assignments[:4]
        
        for assignment in student_assignments:
            enrollment, created = Enrollment.objects.get_or_create(
                student=student,
                course_assignment=assignment,
                defaults={
                    "status": "approved",
                    "processed_at": timezone.now(),
                    "processed_by": assignment.lecturer
                }
            )

def create_dummy_sessions(assignments):
    """Create dummy class sessions"""
    print("Creating dummy class sessions...")
    
    # Create sessions for this week and next week
    today = timezone.now().date()
    
    # Time slots for different courses
    time_slots = [
        ("08:00", "10:00"),
        ("10:00", "12:00"),
        ("12:00", "14:00"),
        ("14:00", "16:00"),
        ("16:00", "18:00"),
    ]
    
    days_of_week = [0, 1, 2, 3, 4]  # Monday to Friday
    
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
                session = ClassSession.objects.create(
                    course_assignment=assignment,
                    title=f"{assignment.course.code} - Lecture",
                    description=f"Regular lecture for {assignment.course.title}",
                    scheduled_date=session_date,
                    start_time=time_slot[0],
                    end_time=time_slot[1],
                    class_type="physical",
                    location=f"Room {100 + assignment.id}",
                    max_capacity=50,
                    attendance_window_start=5,  # 5 minutes before
                    attendance_window_end=5,    # 5 minutes after
                    is_active=True
                )
                sessions.append(session)
    
    return sessions

def create_dummy_attendance(sessions, students):
    """Create dummy attendance records"""
    print("Creating dummy attendance records...")
    
    import random
    
    # Create attendance for past sessions
    past_sessions = [s for s in sessions if s.scheduled_date < timezone.now().date()]
    
    for session in past_sessions:
        # Get enrolled students for this course
        enrolled_students = User.objects.filter(
            enrollments__course_assignment=session.course_assignment,
            enrollments__status="approved"
        )
        
        for student in enrolled_students:
            # 80% chance of attending
            if random.random() < 0.8:
                # Random attendance time within the session
                session_start = datetime.combine(session.scheduled_date, datetime.strptime(session.start_time, "%H:%M").time())
                session_start = timezone.make_aware(session_start)
                
                # Mark attendance within 10 minutes of session start
                attendance_time = session_start + timedelta(minutes=random.randint(-5, 10))
                
                # Create old-style attendance record
                Attendance.objects.create(
                    user=student,
                    status="present",
                    timestamp=attendance_time,
                    location=session.location,
                    verified=True,
                    notes=f"Attended {session.course_assignment.course.code}"
                )
                
                # Create new-style class attendance
                from courses.models import ClassAttendance
                ClassAttendance.objects.create(
                    class_session=session,
                    student=student,
                    status="present",
                    marked_at=attendance_time,
                    face_verified=random.choice([True, False])
                )

def main():
    """Main function to populate all dummy data"""
    print("Starting dummy data population...")
    
    try:
        # Create users
        lecturers, students = create_dummy_users()
        print(f"Created {len(lecturers)} lecturers and {len(students)} students")
        
        # Create courses
        courses = create_dummy_courses()
        print(f"Created {len(courses)} courses")
        
        # Create assignments
        assignments = create_dummy_assignments(courses, lecturers)
        print(f"Created {len(assignments)} course assignments")
        
        # Create enrollments
        create_dummy_enrollments(assignments, students)
        print("Created enrollments")
        
        # Create sessions
        sessions = create_dummy_sessions(assignments)
        print(f"Created {len(sessions)} class sessions")
        
        # Create attendance
        create_dummy_attendance(sessions, students)
        print("Created attendance records")
        
        print("Dummy data population completed successfully!")
        
    except Exception as e:
        print(f"Error during data population: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main() 