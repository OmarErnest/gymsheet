from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User, UserPreference


@admin.action(description='Approve selected users')
def approve_users(modeladmin, request, queryset):
    queryset.update(is_approved=True)


@admin.action(description='Reset Public Beta Environment data for selected users')
def reset_dummy_data(modeladmin, request, queryset):
    from fitness.models import ExerciseLog, GoalPlan, DailyProgress, BodyMeasurement
    for user in queryset:
        if user.email == "dummy@gym.sheet":
            ExerciseLog.objects.filter(user=user).delete()
            GoalPlan.objects.filter(user=user).delete()
            DailyProgress.objects.filter(user=user).delete()
            BodyMeasurement.objects.filter(user=user).delete()


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ('email', 'name', 'gender', 'auth_mode', 'is_approved', 'is_staff', 'date_joined')
    list_filter = ('is_approved', 'gender', 'auth_mode', 'is_staff', 'is_superuser')
    search_fields = ('email', 'name')
    ordering = ('email',)
    actions = [approve_users, reset_dummy_data]
    fieldsets = BaseUserAdmin.fieldsets + (
        ('GymSheet profile', {'fields': ('name', 'profile_pic_url', 'gender', 'is_approved', 'auth_mode', 'pin_hash')}),
    )


@admin.register(UserPreference)
class UserPreferenceAdmin(admin.ModelAdmin):
    list_display = ('user', 'theme', 'language', 'goals_paused')
    list_filter = ('theme', 'language', 'goals_paused')
