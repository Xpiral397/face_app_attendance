# 🤖 AI Face Recognition Attendance System

A modern, full-stack attendance management system using AI-powered face recognition technology built with Django (Backend) and Next.js (Frontend).

## ✨ Features

### 🎯 Core Features
- **AI Face Recognition** - Advanced face detection and recognition
- **Real-time Attendance** - Mark attendance using facial recognition or manual check-in
- **Role-based Access** - Separate interfaces for Students and Admins
- **Attendance Analytics** - Comprehensive reports and statistics
- **Responsive Design** - Works on desktop, tablet, and mobile devices

### 👨‍🎓 Student Features
- Face registration (one-time setup)
- Mark attendance with face recognition
- Manual attendance backup option
- View personal attendance history
- Real-time attendance statistics

### 👨‍💼 Admin Features
- Manage all users and attendance records
- Generate comprehensive reports
- System analytics and dashboard
- Bulk attendance operations
- Face recognition system settings

## 🚀 Quick Start

### Prerequisites
- Python 3.8+ with pip
- Node.js 18+ with npm
- Git

### 🔧 Backend Setup

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Create and activate virtual environment:**
   ```bash
   python -m venv venv
   
   # Windows
   venv\Scripts\activate
   
   # macOS/Linux  
   source venv/bin/activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Run migrations:**
   ```bash
   python manage.py makemigrations
   python manage.py migrate
   ```

5. **Create admin user:**
   ```bash
   python manage.py createsuperuser
   ```

6. **Start Django server:**
   ```bash
   python manage.py runserver
   ```

### 🎨 Frontend Setup

1. **Navigate to frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start Next.js development server:**
   ```bash
   npm run dev
   ```

## 🌐 Access the Application

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8000
- **Django Admin:** http://localhost:8000/admin

## 👥 Demo Accounts

After running migrations, you can use these demo accounts:

```
Admin Account:
Email: admin@example.com
Password: password123

Student Account:
Email: student@example.com  
Password: password123
```

## 📱 How to Use

### For Students:

1. **Register/Login** to your account
2. **Register Your Face** (one-time setup):
   - Go to Dashboard → "Register Face"
   - Position your face in the camera frame
   - Follow the on-screen instructions
3. **Mark Attendance**:
   - Go to Dashboard → "Mark Attendance"
   - Use face recognition or manual check-in
4. **View History**:
   - Go to Dashboard → "View History"
   - Check your attendance records and statistics

### For Admins:

1. **Login** with admin credentials
2. **Dashboard Overview**:
   - View system-wide statistics
   - Monitor today's attendance
3. **Manage Users** (via Django Admin):
   - Add/edit/remove users
   - Assign roles and permissions
4. **Generate Reports**:
   - Export attendance data
   - Analyze attendance patterns

## 🏗️ Project Structure

```
AIFaceRecognized/
├── backend/                 # Django REST API
│   ├── accounts/           # User management
│   ├── attendance/         # Attendance tracking
│   ├── face_recognition_app/ # Face recognition logic
│   ├── reports/            # Report generation
│   └── attendance_system/  # Main Django settings
│
└── frontend/               # Next.js React App
    ├── app/               # Next.js 13+ App Router
    │   ├── dashboard/     # Dashboard pages
    │   ├── login/         # Authentication
    │   ├── register/      # User registration
    │   ├── attendance/    # Attendance pages
    │   └── face-registration/ # Face setup
    ├── components/        # Reusable UI components
    ├── contexts/          # React Context (Auth)
    ├── utils/             # API utilities
    └── types/             # TypeScript definitions
```

## 🔑 API Endpoints

### Authentication
- `POST /api/auth/login/` - User login
- `POST /api/auth/register/` - User registration
- `POST /api/auth/logout/` - User logout

### Attendance
- `GET /api/attendance/` - List attendance records
- `POST /api/attendance/create/` - Mark manual attendance
- `GET /api/attendance/stats/` - Get attendance statistics
- `GET /api/attendance/dashboard-stats/` - Dashboard stats

### Face Recognition
- `POST /api/face/register/` - Register face encoding
- `POST /api/face/attendance/` - Mark attendance with face
- `POST /api/face/verify/` - Verify face match
- `GET /api/face/stats/` - Face recognition statistics

## 🛠️ Technologies Used

### Backend
- **Django 4.2** - Web framework
- **Django REST Framework** - API development
- **SQLite/PostgreSQL** - Database
- **OpenCV** - Computer vision
- **face_recognition** - Face recognition library
- **Pillow** - Image processing
- **JWT** - Authentication tokens

### Frontend
- **Next.js 14** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **React Webcam** - Camera access
- **React Context** - State management

## 🔧 Configuration

### Environment Variables

Create `.env` files in both backend and frontend directories:

**Backend (.env):**
```env
SECRET_KEY=your-secret-key-here
DEBUG=True
DATABASE_URL=postgresql://user:pass@localhost/dbname
ALLOWED_HOSTS=localhost,127.0.0.1
```

**Frontend (.env.local):**
```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

## 📊 Features in Detail

### Face Recognition
- Uses advanced facial recognition algorithms
- Quality assessment and recommendations
- Configurable tolerance and thresholds
- Image quality validation
- Security logging

### Attendance Management
- Real-time attendance marking
- Duplicate prevention (one entry per day)
- Late arrival detection
- Manual backup options
- Historical tracking

### Analytics & Reporting
- Personal attendance statistics
- System-wide analytics
- Exportable reports
- Graphical representations
- Trend analysis

## 🚨 Troubleshooting

### Common Issues

1. **Camera not working:**
   - Ensure browser permissions for camera access
   - Check if other applications are using the camera
   - Try refreshing the page

2. **Face recognition failing:**
   - Ensure good lighting conditions
   - Register face first before marking attendance
   - Check image quality recommendations

3. **API connection errors:**
   - Verify backend server is running on port 8000
   - Check CORS settings in Django
   - Ensure frontend is accessing correct API URL

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

For support and questions:
- Create an issue on GitHub
- Check the troubleshooting section
- Review the API documentation

## 🔄 Version History

- **v1.0.0** - Initial release with core features
  - Face registration and recognition
  - Attendance marking and tracking
  - User authentication and roles
  - Dashboard and analytics

---

**Made with ❤️ using Django + Next.js** 