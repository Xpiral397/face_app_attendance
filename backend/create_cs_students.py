#!/usr/bin/env python
"""
Create Computer Science Students
"""

import os
import sys
import django

# Setup Django
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'attendance_system.settings')
django.setup()

from django.contrib.auth import get_user_model
from courses.models import Department

User = get_user_model()

def create_cs_students():
    """Create 3 Computer Science students"""
    print("👨‍🎓 Creating Computer Science students...")
    
    # Get CS department
    try:
        cs_dept = Department.objects.get(code='CSC')
        print(f"✅ Found CS Department: {cs_dept.name}")
    except Department.DoesNotExist:
        print("❌ Computer Science department not found!")
        return
    
    # Student data
    students = [
        {
            'username': 'csstudent1',
            'email': 'cs.student1@university.edu',
            'full_name': 'Alice Johnson',
            'student_id': 'CSC2024001'
        },
        {
            'username': 'csstudent2',
            'email': 'cs.student2@university.edu',
            'full_name': 'Bob Wilson',
            'student_id': 'CSC2024002'
        },
        {
            'username': 'csstudent3',
            'email': 'cs.student3@university.edu',
            'full_name': 'Carol Davis',
            'student_id': 'CSC2024003'
        }
    ]
    
    created_students = []
    password = 'testuser1234'
    
    for student_data in students:
        username = student_data['username']
        
        # Check if already exists
        if User.objects.filter(username=username).exists():
            print(f"⚠️ Student {username} already exists")
            continue
        
        # Create student
        try:
            student = User.objects.create_user(
                username=username,
                email=student_data['email'],
                password=password,
                full_name=student_data['full_name'],
                student_id=student_data['student_id'],
                role='student',
                department=cs_dept,
                level='200',
                is_active=True,
                is_approved=True
            )
            created_students.append(student)
            print(f"✅ Created: {student.full_name} ({username})")
            
        except Exception as e:
            print(f"❌ Error creating {username}: {str(e)}")
    
    print(f"\n🎉 Successfully created {len(created_students)} CS students!")
    return created_students

def save_credentials():
    """Save credentials to file"""
    print("💾 Saving credentials to file...")
    
    credentials_content = """# Computer Science Student Credentials

## Created CS Students:

### Student 1
- **Username:** csstudent1
- **Email:** cs.student1@university.edu
- **Password:** testuser1234
- **Full Name:** Alice Johnson
- **Student ID:** CSC2024001
- **Department:** Computer Science (CSC)
- **Level:** 200

### Student 2
- **Username:** csstudent2
- **Email:** cs.student2@university.edu
- **Password:** testuser1234
- **Full Name:** Bob Wilson
- **Student ID:** CSC2024002
- **Department:** Computer Science (CSC)
- **Level:** 200

### Student 3
- **Username:** csstudent3
- **Email:** cs.student3@university.edu
- **Password:** testuser1234
- **Full Name:** Carol Davis
- **Student ID:** CSC2024003
- **Department:** Computer Science (CSC)
- **Level:** 200

## Usage:
Students can login with their username and password to:
- ✅ Access their courses via 'My Courses' (student-courses page)
- ✅ Mark attendance via 'Mark Attendance' 
- ✅ View attendance history via 'Student Attendance'
- ✅ Register face for face recognition
- ✅ View notifications

## Note:
- Students do NOT have dashboard access (removed as requested)
- All students are automatically approved and active
- All use the same password: testuser1234
"""
    
    try:
        with open('../credentials.md', 'w') as f:
            f.write(credentials_content)
        print("✅ Credentials saved to credentials.md")
    except Exception as e:
        print(f"❌ Error saving credentials: {str(e)}")

if __name__ == "__main__":
    print("🚀 Creating CS Students and Saving Credentials...")
    print("=" * 50)
    
    create_cs_students()
    save_credentials()
    
    print("=" * 50)
    print("🎉 Task completed successfully!") 