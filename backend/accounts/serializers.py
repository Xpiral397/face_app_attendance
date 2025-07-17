from rest_framework import serializers
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from .models import User, ReferralCode

class ReferralCodeSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True)
    
    class Meta:
        model = ReferralCode
        fields = ['id', 'code', 'role', 'created_by', 'created_by_name', 'is_active', 'usage_count', 'max_usage', 'expires_at', 'created_at']
        read_only_fields = ['id', 'created_at', 'usage_count']

class UserSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True)
    referral_code_info = ReferralCodeSerializer(source='referral_code', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.full_name', read_only=True)
    
    class Meta:
        model = User
        fields = ['id', 'email', 'username', 'full_name', 'role', 'student_id', 'lecturer_id', 'department', 'department_name', 'level', 'is_active', 'is_approved', 'approved_by_name', 'approved_at', 'referral_code_info', 'created_at']
        read_only_fields = ['id', 'created_at']

class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    confirm_password = serializers.CharField(write_only=True)
    referral_code = serializers.CharField(write_only=True, required=False)
    
    class Meta:
        model = User
        fields = ['email', 'username', 'full_name', 'password', 'confirm_password', 'role', 'student_id', 'lecturer_id', 'department', 'level', 'referral_code']
    
    def validate(self, attrs):
        if attrs['password'] != attrs['confirm_password']:
            raise serializers.ValidationError("Passwords don't match")
        
        role = attrs.get('role', 'student')
        referral_code = attrs.get('referral_code')
        
        # Require referral code for admin and lecturer roles
        if role in ['admin', 'lecturer']:
            if not referral_code:
                raise serializers.ValidationError(f"Referral code is required for {role} registration")
            
            # Validate referral code
            try:
                code_obj = ReferralCode.objects.get(code=referral_code)
                if not code_obj.is_available:
                    raise serializers.ValidationError("Referral code is not available or expired")
                if code_obj.role != role:
                    raise serializers.ValidationError(f"Referral code is not valid for {role} role")
                attrs['referral_code_obj'] = code_obj
            except ReferralCode.DoesNotExist:
                raise serializers.ValidationError("Invalid referral code")
        
        return attrs
    
    def create(self, validated_data):
        validated_data.pop('confirm_password')
        referral_code = validated_data.pop('referral_code', None)
        referral_code_obj = validated_data.pop('referral_code_obj', None)
        
        user = User.objects.create_user(**validated_data)
        
        # If referral code was used, associate it with the user and increment usage
        if referral_code_obj:
            user.referral_code = referral_code_obj
            user.save()
            referral_code_obj.use()
        
        return user

class UserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['full_name', 'role', 'student_id', 'lecturer_id', 'is_active', 'is_approved']

class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField()
    
    def validate(self, attrs):
        email = attrs.get('email')
        password = attrs.get('password')
        
        if email and password:
            user = authenticate(username=email, password=password)
            if not user:
                raise serializers.ValidationError('Invalid credentials')
            if not user.is_active:
                raise serializers.ValidationError('Your account is not yet activated. Please wait for admin approval.')
            if not user.is_approved:
                raise serializers.ValidationError('Your account is pending approval. Please wait for admin approval.')
            attrs['user'] = user
        else:
            raise serializers.ValidationError('Must include email and password')
        
        return attrs

class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField()
    new_password = serializers.CharField(validators=[validate_password])
    confirm_password = serializers.CharField()
    
    def validate(self, attrs):
        if attrs['new_password'] != attrs['confirm_password']:
            raise serializers.ValidationError("New passwords don't match")
        return attrs
    
    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("Old password is incorrect")
        return value

class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'email', 'username', 'full_name', 'role', 'student_id', 'lecturer_id', 'is_active', 'created_at']
        read_only_fields = ['id', 'email', 'role', 'created_at']

class PendingUserSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True)
    referral_code_info = ReferralCodeSerializer(source='referral_code', read_only=True)
    
    class Meta:
        model = User
        fields = ['id', 'email', 'username', 'full_name', 'role', 'student_id', 'lecturer_id', 'department', 'department_name', 'level', 'referral_code_info', 'created_at']
        read_only_fields = ['id', 'created_at']

class UserApprovalSerializer(serializers.Serializer):
    user_id = serializers.IntegerField()
    action = serializers.ChoiceField(choices=['approve', 'reject'])
    
    def validate_user_id(self, value):
        try:
            user = User.objects.get(id=value, is_approved=False)
            return user
        except User.DoesNotExist:
            raise serializers.ValidationError("User not found or already processed") 