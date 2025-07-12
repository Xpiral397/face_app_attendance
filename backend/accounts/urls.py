from django.urls import path
from .views import (
    RegisterView,
    LoginView,
    ProfileView,
    ChangePasswordView,
    UserListView,
    UserCreateView,
    UserDetailView,
    UserStatsView,
    logout_view,
)

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='login'),
    path('logout/', logout_view, name='logout'),
    path('profile/', ProfileView.as_view(), name='profile'),
    path('change-password/', ChangePasswordView.as_view(), name='change-password'),
    path('users/', UserListView.as_view(), name='user-list'),
    path('users/create/', UserCreateView.as_view(), name='user-create'),
    path('users/<int:pk>/', UserDetailView.as_view(), name='user-detail'),
    path('users/stats/', UserStatsView.as_view(), name='user-stats'),
] 