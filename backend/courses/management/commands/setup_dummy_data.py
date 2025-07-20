from django.core.management.base import BaseCommand
from courses.models import Course, Department, Lecturer
from django.contrib.auth.models import User

class Command(BaseCommand):
    help = 'Set up dummy data for courses, departments, and lecturers'

    def handle(self, *args, **kwargs):
        # Create dummy departments
        department1 = Department.objects.create(name='Computer Science', code='CS')
        department2 = Department.objects.create(name='Mathematics', code='MATH')

        # Create dummy lecturers
        lecturer1 = Lecturer.objects.create(full_name='John Doe', email='john.doe@example.com', lecturer_id='L001', department=department1)
        lecturer2 = Lecturer.objects.create(full_name='Jane Smith', email='jane.smith@example.com', lecturer_id='L002', department=department2)

        # Create dummy courses
        Course.objects.create(code='CS101', title='Introduction to Computer Science', department=department1, lecturer=lecturer1)
        Course.objects.create(code='MATH101', title='Calculus I', department=department2, lecturer=lecturer2)

        # Create admin lecturer user
        admin_user = User.objects.create_superuser(username='admin_lecturer', email='admin@example.com', password='adminpass')
        admin_user.save()

        self.stdout.write(self.style.SUCCESS('Dummy data set up successfully!'))
        self.stdout.write(self.style.SUCCESS('Admin lecturer user created successfully!')) 