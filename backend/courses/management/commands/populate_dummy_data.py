from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from courses.models import College, Department, Course, CourseAssignment, Enrollment
from django.utils import timezone
from datetime import datetime, timedelta
import random

User = get_user_model()

class Command(BaseCommand):
    help = 'Populate database with realistic dummy data for testing'

    def handle(self, *args, **options):
        self.stdout.write('Starting to populate dummy data...')
        
        # Create Colleges
        colleges_data = [
            {
                'name': 'RACONAS Mass Communication',
                'code': 'RMC',
                'description': 'College of Mass Communication, Journalism, and Media Studies'
            },
            {
                'name': 'School of Architecture',
                'code': 'ARCH',
                'description': 'School of Architecture and Environmental Design'
            },
            {
                'name': 'College of Engineering',
                'code': 'ENG',
                'description': 'College of Engineering and Technology'
            },
            {
                'name': 'College of Science',
                'code': 'SCI',
                'description': 'College of Natural and Applied Sciences'
            },
            {
                'name': 'College of Arts',
                'code': 'ARTS',
                'description': 'College of Liberal Arts and Humanities'
            },
            {
                'name': 'College of Business',
                'code': 'BUS',
                'description': 'College of Business Administration'
            }
        ]
        
        colleges = {}
        for college_data in colleges_data:
            college, created = College.objects.get_or_create(
                code=college_data['code'],
                defaults=college_data
            )
            colleges[college_data['code']] = college
            if created:
                self.stdout.write(f'Created college: {college.name}')
        
        # Create Departments
        departments_data = [
            # RACONAS Mass Communication
            {'name': 'Mass Communication', 'code': 'MCOM', 'college': 'RMC'},
            {'name': 'Journalism', 'code': 'JOUR', 'college': 'RMC'},
            {'name': 'Public Relations', 'code': 'PR', 'college': 'RMC'},
            {'name': 'Broadcasting', 'code': 'BCST', 'college': 'RMC'},
            
            # Architecture
            {'name': 'Architecture', 'code': 'ARC', 'college': 'ARCH'},
            {'name': 'Urban Planning', 'code': 'URP', 'college': 'ARCH'},
            {'name': 'Environmental Design', 'code': 'ENV', 'college': 'ARCH'},
            
            # Engineering
            {'name': 'Computer Engineering', 'code': 'CPE', 'college': 'ENG'},
            {'name': 'Electrical Engineering', 'code': 'EEE', 'college': 'ENG'},
            {'name': 'Mechanical Engineering', 'code': 'MEE', 'college': 'ENG'},
            {'name': 'Civil Engineering', 'code': 'CVE', 'college': 'ENG'},
            
            # Science
            {'name': 'Computer Science', 'code': 'CSC', 'college': 'SCI'},
            {'name': 'Mathematics', 'code': 'MTH', 'college': 'SCI'},
            {'name': 'Physics', 'code': 'PHY', 'college': 'SCI'},
            {'name': 'Chemistry', 'code': 'CHM', 'college': 'SCI'},
            {'name': 'Biology', 'code': 'BIO', 'college': 'SCI'},
            
            # Arts
            {'name': 'English', 'code': 'ENG', 'college': 'ARTS'},
            {'name': 'History', 'code': 'HIS', 'college': 'ARTS'},
            {'name': 'Philosophy', 'code': 'PHI', 'college': 'ARTS'},
            
            # Business
            {'name': 'Business Administration', 'code': 'BUS', 'college': 'BUS'},
            {'name': 'Accounting', 'code': 'ACC', 'college': 'BUS'},
            {'name': 'Economics', 'code': 'ECO', 'college': 'BUS'},
        ]
        
        departments = {}
        for dept_data in departments_data:
            dept, created = Department.objects.get_or_create(
                code=dept_data['code'],
                defaults={
                    'name': dept_data['name'],
                    'college': colleges[dept_data['college']],
                    'description': f'Department of {dept_data["name"]}'
                }
            )
            departments[dept_data['code']] = dept
            if created:
                self.stdout.write(f'Created department: {dept.name}')
        
        # Create Admin User
        admin_user, created = User.objects.get_or_create(
            username='admin',
            defaults={
                'email': 'admin@university.edu',
                'full_name': 'System Administrator',
                'role': 'admin',
                'is_staff': True,
                'is_superuser': True,
            }
        )
        if created:
            admin_user.set_password('admin123')
            admin_user.save()
            self.stdout.write('Created admin user: admin@university.edu (password: admin123)')
        
        # Create Lecturer Users
        lecturers_data = [
            {'name': 'Dr. Sarah Johnson', 'email': 'sarah.johnson@university.edu', 'dept': 'CSC', 'lecturer_id': 'LEC001'},
            {'name': 'Prof. Michael Chen', 'email': 'michael.chen@university.edu', 'dept': 'MCOM', 'lecturer_id': 'LEC002'},
            {'name': 'Dr. Emily Rodriguez', 'email': 'emily.rodriguez@university.edu', 'dept': 'ARC', 'lecturer_id': 'LEC003'},
            {'name': 'Prof. David Wilson', 'email': 'david.wilson@university.edu', 'dept': 'CPE', 'lecturer_id': 'LEC004'},
            {'name': 'Dr. Lisa Anderson', 'email': 'lisa.anderson@university.edu', 'dept': 'JOUR', 'lecturer_id': 'LEC005'},
            {'name': 'Prof. James Brown', 'email': 'james.brown@university.edu', 'dept': 'MTH', 'lecturer_id': 'LEC006'},
        ]
        
        lecturers = {}
        for lecturer_data in lecturers_data:
            lecturer, created = User.objects.get_or_create(
                email=lecturer_data['email'],
                defaults={
                    'username': lecturer_data['email'].split('@')[0],
                    'full_name': lecturer_data['name'],
                    'role': 'lecturer',
                    'lecturer_id': lecturer_data['lecturer_id'],
                    'department': departments[lecturer_data['dept']],
                }
            )
            if created:
                lecturer.set_password('lecturer123')
                lecturer.save()
                lecturers[lecturer_data['lecturer_id']] = lecturer
                self.stdout.write(f'Created lecturer: {lecturer.full_name}')
        
        # Create Student Users
        students_data = [
            {'name': 'John Smith', 'email': 'john.smith@student.edu', 'dept': 'CSC', 'level': '300', 'student_id': 'CSC/18/001'},
            {'name': 'Jane Doe', 'email': 'jane.doe@student.edu', 'dept': 'MCOM', 'level': '200', 'student_id': 'MCOM/19/002'},
            {'name': 'Bob Johnson', 'email': 'bob.johnson@student.edu', 'dept': 'ARC', 'level': '400', 'student_id': 'ARC/17/003'},
            {'name': 'Alice Brown', 'email': 'alice.brown@student.edu', 'dept': 'CSC', 'level': '300', 'student_id': 'CSC/18/004'},
            {'name': 'Charlie Wilson', 'email': 'charlie.wilson@student.edu', 'dept': 'CPE', 'level': '200', 'student_id': 'CPE/19/005'},
            {'name': 'Diana Davis', 'email': 'diana.davis@student.edu', 'dept': 'JOUR', 'level': '300', 'student_id': 'JOUR/18/006'},
            {'name': 'Eric Miller', 'email': 'eric.miller@student.edu', 'dept': 'MTH', 'level': '100', 'student_id': 'MTH/20/007'},
            {'name': 'Fiona Garcia', 'email': 'fiona.garcia@student.edu', 'dept': 'CSC', 'level': '400', 'student_id': 'CSC/17/008'},
        ]
        
        students = {}
        for student_data in students_data:
            student, created = User.objects.get_or_create(
                email=student_data['email'],
                defaults={
                    'username': student_data['email'].split('@')[0],
                    'full_name': student_data['name'],
                    'role': 'student',
                    'student_id': student_data['student_id'],
                    'department': departments[student_data['dept']],
                    'level': student_data['level'],
                }
            )
            if created:
                student.set_password('student123')
                student.save()
                students[student_data['student_id']] = student
                self.stdout.write(f'Created student: {student.full_name}')
        
        # Create Courses
        courses_data = [
            # Computer Science
            {'code': 'CSC-101', 'title': 'Introduction to Programming', 'dept': 'CSC', 'level': '100', 'credits': 3},
            {'code': 'CSC-201', 'title': 'Data Structures', 'dept': 'CSC', 'level': '200', 'credits': 3},
            {'code': 'CSC-301', 'title': 'Algorithms', 'dept': 'CSC', 'level': '300', 'credits': 3},
            {'code': 'CSC-401', 'title': 'Software Engineering', 'dept': 'CSC', 'level': '400', 'credits': 4},
            
            # Mass Communication
            {'code': 'MCOM-101', 'title': 'Introduction to Mass Communication', 'dept': 'MCOM', 'level': '100', 'credits': 2},
            {'code': 'MCOM-201', 'title': 'Media Ethics', 'dept': 'MCOM', 'level': '200', 'credits': 3},
            {'code': 'MCOM-301', 'title': 'Digital Media Production', 'dept': 'MCOM', 'level': '300', 'credits': 3},
            
            # Architecture
            {'code': 'ARC-101', 'title': 'Architectural Drawing', 'dept': 'ARC', 'level': '100', 'credits': 4},
            {'code': 'ARC-201', 'title': 'Building Construction', 'dept': 'ARC', 'level': '200', 'credits': 3},
            {'code': 'ARC-401', 'title': 'Architectural Design Studio', 'dept': 'ARC', 'level': '400', 'credits': 6},
            
            # Computer Engineering
            {'code': 'CPE-101', 'title': 'Digital Logic Design', 'dept': 'CPE', 'level': '100', 'credits': 3},
            {'code': 'CPE-201', 'title': 'Circuit Analysis', 'dept': 'CPE', 'level': '200', 'credits': 4},
            
            # Journalism
            {'code': 'JOUR-101', 'title': 'News Writing', 'dept': 'JOUR', 'level': '100', 'credits': 3},
            {'code': 'JOUR-301', 'title': 'Investigative Journalism', 'dept': 'JOUR', 'level': '300', 'credits': 3},
            
            # Mathematics
            {'code': 'MTH-101', 'title': 'Calculus I', 'dept': 'MTH', 'level': '100', 'credits': 4},
            {'code': 'MTH-201', 'title': 'Linear Algebra', 'dept': 'MTH', 'level': '200', 'credits': 3},
        ]
        
        courses = {}
        for course_data in courses_data:
            course, created = Course.objects.get_or_create(
                code=course_data['code'],
                defaults={
                    'title': course_data['title'],
                    'department': departments[course_data['dept']],
                    'level': course_data['level'],
                    'credit_units': course_data['credits'],
                    'created_by': admin_user,
                    'description': f'This course covers the fundamentals of {course_data["title"].lower()}.'
                }
            )
            if created:
                courses[course_data['code']] = course
                self.stdout.write(f'Created course: {course.code} - {course.title}')
        
        # Create Course Assignments
        assignments_data = [
            {'course': 'CSC-301', 'lecturer': 'LEC001', 'year': '2024/2025', 'semester': 'First'},
            {'course': 'MCOM-301', 'lecturer': 'LEC002', 'year': '2024/2025', 'semester': 'First'},
            {'course': 'ARC-401', 'lecturer': 'LEC003', 'year': '2024/2025', 'semester': 'First'},
            {'course': 'CPE-201', 'lecturer': 'LEC004', 'year': '2024/2025', 'semester': 'First'},
            {'course': 'JOUR-301', 'lecturer': 'LEC005', 'year': '2024/2025', 'semester': 'First'},
            {'course': 'MTH-101', 'lecturer': 'LEC006', 'year': '2024/2025', 'semester': 'First'},
        ]
        
        for assignment_data in assignments_data:
            if assignment_data['course'] in courses and assignment_data['lecturer'] in lecturers:
                assignment, created = CourseAssignment.objects.get_or_create(
                    course=courses[assignment_data['course']],
                    lecturer=lecturers[assignment_data['lecturer']],
                    academic_year=assignment_data['year'],
                    semester=assignment_data['semester'],
                    defaults={
                        'assigned_by': admin_user,
                    }
                )
                if created:
                    self.stdout.write(f'Created assignment: {assignment.course.code} -> {assignment.lecturer.full_name}')
        
        self.stdout.write(
            self.style.SUCCESS('Successfully populated dummy data!')
        )
        self.stdout.write('Test accounts created:')
        self.stdout.write('  Admin: admin@university.edu / admin123')
        self.stdout.write('  Lecturer: sarah.johnson@university.edu / lecturer123')
        self.stdout.write('  Student: john.smith@student.edu / student123') 