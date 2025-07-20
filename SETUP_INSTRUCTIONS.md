# Setup Instructions

This document provides instructions to set up dummy data for the application.

## Dummy Data Setup

To populate the database with dummy data, including departments, lecturers, courses, and an admin lecturer user, run the following command:

```bash
python manage.py setup_dummy_data
```

### Admin Lecturer User

- **Username:** admin_lecturer
- **Email:** admin@example.com
- **Password:** adminpass

This user has admin privileges and can log in to the admin panel.

Ensure you change the password after the initial setup for security purposes. 