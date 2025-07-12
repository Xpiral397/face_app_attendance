from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db import transaction

User = get_user_model()

class Command(BaseCommand):
    help = 'Create initial admin user and sample student'
    
    def handle(self, *args, **options):
        try:
            with transaction.atomic():
                # Check if admin user already exists
                if User.objects.filter(email='admin@example.com').exists():
                    self.stdout.write(
                        self.style.WARNING('Admin user already exists!')
                    )
                else:
                    # Create admin user
                    admin_user = User.objects.create_user(
                        email='admin@example.com',
                        username='admin',
                        full_name='System Administrator',
                        password='password123',
                        role='admin',
                        is_staff=True,
                        is_superuser=True
                    )
                    
                    self.stdout.write(
                        self.style.SUCCESS('Admin user created successfully!')
                    )
                    self.stdout.write(f'Email: {admin_user.email}')
                    self.stdout.write(f'Password: password123')
                    self.stdout.write(
                        self.style.WARNING('Please change the password after first login.')
                    )
                
                # Check if sample student exists
                if User.objects.filter(email='student@example.com').exists():
                    self.stdout.write(
                        self.style.WARNING('Sample student user already exists!')
                    )
                else:
                    # Create sample student user
                    student_user = User.objects.create_user(
                        email='student@example.com',
                        username='student',
                        full_name='Sample Student',
                        password='password123',
                        role='student',
                        student_id='STU001'
                    )
                    
                    self.stdout.write(
                        self.style.SUCCESS('Sample student user created successfully!')
                    )
                    self.stdout.write(f'Email: {student_user.email}')
                    self.stdout.write(f'Password: password123')
                    self.stdout.write(f'Student ID: {student_user.student_id}')
                
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Error creating users: {str(e)}')
            ) 