from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db import transaction
from courses.models import Faculty, Department, Course, CourseAssignment
from datetime import datetime

User = get_user_model()

class Command(BaseCommand):
    help = 'Populate the database with sample course data'
    
    def handle(self, *args, **options):
        try:
            with transaction.atomic():
                self.stdout.write('Creating sample course data...')
                
                # Create Faculties
                science_faculty, _ = Faculty.objects.get_or_create(
                    code='SCI',
                    defaults={
                        'name': 'Faculty of Science',
                        'description': 'Faculty of Physical and Applied Sciences'
                    }
                )
                
                engineering_faculty, _ = Faculty.objects.get_or_create(
                    code='ENG',
                    defaults={
                        'name': 'Faculty of Engineering',
                        'description': 'Faculty of Engineering and Technology'
                    }
                )
                
                # Create Departments
                csc_dept, _ = Department.objects.get_or_create(
                    code='CSC',
                    defaults={
                        'name': 'Computer Science',
                        'faculty': science_faculty,
                        'description': 'Department of Computer Science'
                    }
                )
                
                mth_dept, _ = Department.objects.get_or_create(
                    code='MTH',
                    defaults={
                        'name': 'Mathematics',
                        'faculty': science_faculty,
                        'description': 'Department of Mathematics'
                    }
                )
                
                phy_dept, _ = Department.objects.get_or_create(
                    code='PHY',
                    defaults={
                        'name': 'Physics',
                        'faculty': science_faculty,
                        'description': 'Department of Physics'
                    }
                )
                
                # Create admin user if not exists
                admin_user, _ = User.objects.get_or_create(
                    email='admin@university.edu',
                    defaults={
                        'username': 'admin',
                        'full_name': 'System Administrator',
                        'role': 'admin',
                        'is_staff': True,
                        'is_superuser': True
                    }
                )
                
                if _:  # If user was created
                    admin_user.set_password('admin123')
                    admin_user.save()
                
                # Create sample lecturers
                lecturer1, _ = User.objects.get_or_create(
                    email='prof.smith@university.edu',
                    defaults={
                        'username': 'profsmith',
                        'full_name': 'Prof. John Smith',
                        'role': 'lecturer',
                        'lecturer_id': 'LEC001',
                        'department': csc_dept
                    }
                )
                
                if _:
                    lecturer1.set_password('lecturer123')
                    lecturer1.save()
                
                lecturer2, _ = User.objects.get_or_create(
                    email='dr.johnson@university.edu',
                    defaults={
                        'username': 'drjohnson',
                        'full_name': 'Dr. Sarah Johnson',
                        'role': 'lecturer',
                        'lecturer_id': 'LEC002',
                        'department': mth_dept
                    }
                )
                
                if _:
                    lecturer2.set_password('lecturer123')
                    lecturer2.save()
                
                # Create sample students
                student1, _ = User.objects.get_or_create(
                    email='john.doe@student.edu',
                    defaults={
                        'username': 'johndoe',
                        'full_name': 'John Doe',
                        'role': 'student',
                        'student_id': 'CSC/19/001',
                        'department': csc_dept,
                        'level': '300'
                    }
                )
                
                if _:
                    student1.set_password('student123')
                    student1.save()
                
                student2, _ = User.objects.get_or_create(
                    email='jane.smith@student.edu',
                    defaults={
                        'username': 'janesmith',
                        'full_name': 'Jane Smith',
                        'role': 'student',
                        'student_id': 'CSC/19/002',
                        'department': csc_dept,
                        'level': '300'
                    }
                )
                
                if _:
                    student2.set_password('student123')
                    student2.save()
                
                # Create sample courses
                courses_data = [
                    {
                        'code': 'CSC-301',
                        'title': 'Data Structures and Algorithms',
                        'department': csc_dept,
                        'level': '300',
                        'credit_units': 3,
                        'description': 'Advanced data structures and algorithm analysis'
                    },
                    {
                        'code': 'CSC-302',
                        'title': 'Database Management Systems',
                        'department': csc_dept,
                        'level': '300',
                        'credit_units': 3,
                        'description': 'Database design, implementation, and management'
                    },
                    {
                        'code': 'CSC-303',
                        'title': 'Software Engineering',
                        'department': csc_dept,
                        'level': '300',
                        'credit_units': 3,
                        'description': 'Software development lifecycle and methodologies'
                    },
                    {
                        'code': 'MTH-301',
                        'title': 'Linear Algebra',
                        'department': mth_dept,
                        'level': '300',
                        'credit_units': 3,
                        'description': 'Vector spaces, matrices, and linear transformations'
                    }
                ]
                
                created_courses = []
                for course_data in courses_data:
                    course, created = Course.objects.get_or_create(
                        code=course_data['code'],
                        defaults={
                            **course_data,
                            'created_by': admin_user
                        }
                    )
                    created_courses.append(course)
                    if created:
                        self.stdout.write(f'Created course: {course.code} - {course.title}')
                
                # Create course assignments
                current_year = datetime.now().year
                academic_year = f"{current_year}/{current_year + 1}"
                
                assignments = [
                    {
                        'course': created_courses[0],  # CSC-301
                        'lecturer': lecturer1,
                        'academic_year': academic_year,
                        'semester': 'First'
                    },
                    {
                        'course': created_courses[1],  # CSC-302
                        'lecturer': lecturer1,
                        'academic_year': academic_year,
                        'semester': 'First'
                    },
                    {
                        'course': created_courses[3],  # MTH-301
                        'lecturer': lecturer2,
                        'academic_year': academic_year,
                        'semester': 'First'
                    }
                ]
                
                for assignment_data in assignments:
                    assignment, created = CourseAssignment.objects.get_or_create(
                        course=assignment_data['course'],
                        lecturer=assignment_data['lecturer'],
                        academic_year=assignment_data['academic_year'],
                        semester=assignment_data['semester'],
                        defaults={
                            'assigned_by': admin_user
                        }
                    )
                    if created:
                        self.stdout.write(f'Created assignment: {assignment.lecturer.full_name} -> {assignment.course.code}')
                
                self.stdout.write(
                    self.style.SUCCESS('Sample data created successfully!')
                )
                
                self.stdout.write('\n' + '='*50)
                self.stdout.write('SAMPLE ACCOUNTS CREATED:')
                self.stdout.write('='*50)
                self.stdout.write('Admin: admin@university.edu / admin123')
                self.stdout.write('Lecturer 1: prof.smith@university.edu / lecturer123')
                self.stdout.write('Lecturer 2: dr.johnson@university.edu / lecturer123')
                self.stdout.write('Student 1: john.doe@student.edu / student123')
                self.stdout.write('Student 2: jane.smith@student.edu / student123')
                self.stdout.write('='*50)
                
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Error creating sample data: {str(e)}')
            ) 