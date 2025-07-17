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
    ReferralCodeListView,
    ReferralCodeDetailView,
    PendingUsersView,
    UserApprovalView,
    BulkUserApprovalView,
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
    
    # Referral Code URLs
    path('referral-codes/', ReferralCodeListView.as_view(), name='referral-code-list'),
    path('referral-codes/<int:pk>/', ReferralCodeDetailView.as_view(), name='referral-code-detail'),
    
    # Pending User Management URLs
    path('pending-users/', PendingUsersView.as_view(), name='pending-users'),
    path('user-approval/', UserApprovalView.as_view(), name='user-approval'),
    path('bulk-user-approval/', BulkUserApprovalView.as_view(), name='bulk-user-approval'),
] 