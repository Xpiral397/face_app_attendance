from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import TemplateView
from django.http import HttpResponse
from django.shortcuts import render
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
import os

def serve_react_app(request):
    """Serve the React app's index.html for any non-API route"""
    try:
        # Path to the Next.js build index.html
        index_path = os.path.join(settings.BASE_DIR, '../frontend/dist/index.html')
        with open(index_path, 'r', encoding='utf-8') as f:
            return HttpResponse(f.read(), content_type='text/html')
    except FileNotFoundError:
        return HttpResponse(
            '<h1>Frontend not built</h1><p>Please run <code>npm run build</code> in the frontend directory.</p>',
            content_type='text/html'
        )

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # Authentication endpoints
    path('api/auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/auth/', include('accounts.urls')),
    
    # App endpoints
    path('api/attendance/', include('attendance.urls')),
    path('api/face/', include('face_recognition_app.urls')),
    path('api/reports/', include('reports.urls')),
    path('api/courses/', include('courses.urls')),
    
    # Catch-all route for Next.js frontend (must be last)
    re_path(r'^(?!api|admin|media|static).*$', serve_react_app, name='frontend'),
]

# Serve media files in development and production
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

# Serve static files in development
if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT) 