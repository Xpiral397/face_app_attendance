from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.translation import gettext_lazy as _
from django.utils.html import format_html
from .models import User, ReferralCode

@admin.register(ReferralCode)
class ReferralCodeAdmin(admin.ModelAdmin):
    list_display = ['code', 'role', 'created_by', 'usage_count', 'max_usage', 'is_active', 'expires_at', 'created_at']
    list_filter = ['role', 'is_active', 'created_at']
    search_fields = ['code', 'created_by__full_name', 'created_by__email']
    readonly_fields = ['code', 'usage_count', 'created_at', 'updated_at']
    ordering = ['-created_at']
    
    fieldsets = (
        (None, {'fields': ('code', 'role', 'created_by')}),
        (_('Usage'), {'fields': ('usage_count', 'max_usage', 'is_active')}),
        (_('Dates'), {'fields': ('expires_at', 'created_at', 'updated_at')}),
    )
    
    def get_readonly_fields(self, request, obj=None):
        if obj:  # editing an existing object
            return self.readonly_fields + ['created_by', 'role']
        return self.readonly_fields

@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ['email', 'full_name', 'role', 'student_id', 'lecturer_id', 'is_active', 'is_approved', 'approval_status', 'created_at']
    list_filter = ['role', 'is_active', 'is_approved', 'created_at', 'department']
    search_fields = ['email', 'full_name', 'student_id', 'lecturer_id']
    ordering = ['-created_at']
    
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        (_('Personal info'), {'fields': ('full_name', 'username')}),
        (_('Role & Permissions'), {
            'fields': ('role', 'student_id', 'lecturer_id', 'department', 'level'),
        }),
        (_('Activation & Approval'), {
            'fields': ('is_active', 'is_approved', 'approved_by', 'approved_at'),
        }),
        (_('Referral'), {'fields': ('referral_code',)}),
        (_('System Permissions'), {
            'fields': ('is_staff', 'is_superuser', 'groups', 'user_permissions'),
            'classes': ('collapse',),
        }),
        (_('Important dates'), {'fields': ('last_login', 'created_at', 'updated_at')}),
    )
    
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'full_name', 'password1', 'password2', 'role', 'student_id', 'lecturer_id', 'department', 'level'),
        }),
    )
    
    readonly_fields = ['created_at', 'updated_at', 'last_login', 'approved_at']
    
    actions = ['approve_users', 'deactivate_users', 'activate_users']
    
    def approval_status(self, obj):
        if obj.is_approved:
            return format_html('<span style="color: green;">✓ Approved</span>')
        else:
            return format_html('<span style="color: red;">✗ Pending</span>')
    approval_status.short_description = 'Approval Status'
    
    def approve_users(self, request, queryset):
        updated = 0
        for user in queryset.filter(is_approved=False):
            user.approve(request.user)
            updated += 1
        self.message_user(request, f'{updated} users were successfully approved.')
    approve_users.short_description = 'Approve selected users'
    
    def activate_users(self, request, queryset):
        updated = queryset.update(is_active=True)
        self.message_user(request, f'{updated} users were successfully activated.')
    activate_users.short_description = 'Activate selected users'
    
    def deactivate_users(self, request, queryset):
        updated = queryset.update(is_active=False)
        self.message_user(request, f'{updated} users were successfully deactivated.')
    deactivate_users.short_description = 'Deactivate selected users'
    
    def get_readonly_fields(self, request, obj=None):
        if obj:  # editing an existing object
            return self.readonly_fields + ['email']
        return self.readonly_fields 