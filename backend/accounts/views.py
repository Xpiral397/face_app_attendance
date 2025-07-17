from rest_framework import generics, status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate, login
from django.db import transaction
from django.utils import timezone
from .models import User, ReferralCode
from .serializers import (
    UserSerializer, 
    UserCreateSerializer, 
    UserUpdateSerializer,
    LoginSerializer,
    ChangePasswordSerializer,
    ProfileSerializer,
    ReferralCodeSerializer,
    PendingUserSerializer,
    UserApprovalSerializer
)

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserCreateSerializer
    permission_classes = [permissions.AllowAny]
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        
        # For students, automatically approve and activate
        if user.role == 'student':
            user.is_approved = True
            user.is_active = True
            user.save()
            
            # Generate JWT tokens for students
            refresh = RefreshToken.for_user(user)
            
            return Response({
                'user': UserSerializer(user).data,
                'refresh': str(refresh),
                'access': str(refresh.access_token),
                'message': 'Student account created and activated successfully'
            }, status=status.HTTP_201_CREATED)
        else:
            # For admin/lecturer, account is pending approval
            return Response({
                'user': UserSerializer(user).data,
                'message': 'Account created successfully. Please wait for admin approval.'
            }, status=status.HTTP_201_CREATED)

class LoginView(APIView):
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        user = serializer.validated_data['user']
        refresh = RefreshToken.for_user(user)
        
        return Response({
            'user': UserSerializer(user).data,
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        })

class ProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = ProfileSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_object(self):
        return self.request.user

class ChangePasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        
        user = request.user
        user.set_password(serializer.validated_data['new_password'])
        user.save()
        
        return Response({'message': 'Password changed successfully'})

class UserListView(generics.ListAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        if self.request.user.is_admin:
            return User.objects.all()
        return User.objects.filter(id=self.request.user.id)

class UserCreateView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserCreateSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def perform_create(self, serializer):
        if not self.request.user.is_admin:
            raise permissions.PermissionDenied("Only admins can create users")
        serializer.save()

class UserDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = User.objects.all()
    serializer_class = UserUpdateSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_object(self):
        if self.request.user.is_admin:
            return super().get_object()
        elif self.kwargs.get('pk') == str(self.request.user.id):
            return self.request.user
        else:
            raise permissions.PermissionDenied("You can only access your own profile")
    
    def destroy(self, request, *args, **kwargs):
        if not request.user.is_admin:
            raise permissions.PermissionDenied("Only admins can delete users")
        return super().destroy(request, *args, **kwargs)

class UserStatsView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        if not request.user.is_admin:
            raise permissions.PermissionDenied("Only admins can view user stats")
        
        total_users = User.objects.count()
        active_users = User.objects.filter(is_active=True).count()
        admin_users = User.objects.filter(role='admin').count()
        student_users = User.objects.filter(role='student').count()
        lecturer_users = User.objects.filter(role='lecturer').count()
        pending_users = User.objects.filter(is_approved=False).count()
        
        return Response({
            'total_users': total_users,
            'active_users': active_users,
            'admin_users': admin_users,
            'student_users': student_users,
            'lecturer_users': lecturer_users,
            'pending_users': pending_users,
        })

# Referral Code Views
class ReferralCodeListView(generics.ListCreateAPIView):
    queryset = ReferralCode.objects.all()
    serializer_class = ReferralCodeSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        if not self.request.user.is_admin:
            raise permissions.PermissionDenied("Only admins can view referral codes")
        return ReferralCode.objects.all().order_by('-created_at')
    
    def perform_create(self, serializer):
        if not self.request.user.is_admin:
            raise permissions.PermissionDenied("Only admins can create referral codes")
        serializer.save(created_by=self.request.user)

class ReferralCodeDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = ReferralCode.objects.all()
    serializer_class = ReferralCodeSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_object(self):
        if not self.request.user.is_admin:
            raise permissions.PermissionDenied("Only admins can manage referral codes")
        return super().get_object()

# Pending User Management Views
class PendingUsersView(generics.ListAPIView):
    queryset = User.objects.filter(is_approved=False)
    serializer_class = PendingUserSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        if not self.request.user.is_admin:
            raise permissions.PermissionDenied("Only admins can view pending users")
        return User.objects.filter(is_approved=False).order_by('-created_at')

class UserApprovalView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        if not request.user.is_admin:
            raise permissions.PermissionDenied("Only admins can approve users")
        
        serializer = UserApprovalSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        user = serializer.validated_data['user_id']
        action = serializer.validated_data['action']
        
        if action == 'approve':
            user.approve(request.user)
            return Response({
                'message': f'User {user.full_name} has been approved and activated',
                'user': UserSerializer(user).data
            })
        elif action == 'reject':
            user.delete()
            return Response({
                'message': f'User {user.full_name} has been rejected and removed'
            })

class BulkUserApprovalView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        if not request.user.is_admin:
            raise permissions.PermissionDenied("Only admins can approve users")
        
        user_ids = request.data.get('user_ids', [])
        action = request.data.get('action', 'approve')
        
        if not user_ids:
            return Response({'error': 'No users selected'}, status=status.HTTP_400_BAD_REQUEST)
        
        users = User.objects.filter(id__in=user_ids, is_approved=False)
        
        if action == 'approve':
            updated_count = 0
            for user in users:
                user.approve(request.user)
                updated_count += 1
            
            return Response({
                'message': f'{updated_count} users have been approved and activated'
            })
        elif action == 'reject':
            deleted_count = users.count()
            users.delete()
            return Response({
                'message': f'{deleted_count} users have been rejected and removed'
            })

@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def logout_view(request):
    try:
        refresh_token = request.data.get('refresh_token')
        token = RefreshToken(refresh_token)
        token.blacklist()
        return Response({'message': 'Successfully logged out'}, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({'error': 'Invalid token'}, status=status.HTTP_400_BAD_REQUEST) 