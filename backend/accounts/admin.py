from django import forms
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User, UserPreference


class UserAdminForm(forms.ModelForm):
    pin = forms.CharField(
        max_length=6,
        required=False,
        widget=forms.PasswordInput(render_value=True),
        help_text="Enter a 6-digit PIN to hash it automatically. Leave blank to keep current PIN."
    )

    class Meta:
        model = User
        fields = '__all__'

    def save(self, commit=True):
        user = super().save(commit=False)
        pin = self.cleaned_data.get('pin')
        if pin:
            user.set_pin(pin)
        if commit:
            user.save()
        return user


@admin.action(description='Approve selected users')
def approve_users(modeladmin, request, queryset):
    queryset.update(is_approved=True)


@admin.action(description='Reset Public Beta Environment data for selected users')
def reset_dummy_data(modeladmin, request, queryset):
    from fitness.models import ExerciseLog, GoalPlan, DailyProgress, BodyMeasurement
    for user in queryset:
        if user.is_test_user:
            ExerciseLog.objects.filter(user=user).delete()
            GoalPlan.objects.filter(user=user).delete()
            DailyProgress.objects.filter(user=user).delete()
            BodyMeasurement.objects.filter(user=user).delete()


@admin.action(description='Approve profile pics')
def approve_profile_pics(modeladmin, request, queryset):
    for user in queryset:
        if user.profile_pic_url_pending:
            user.profile_pic_url = user.profile_pic_url_pending
            user.profile_pic_url_pending = ''
            user.save()


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    form = UserAdminForm
    list_display = ('email', 'name', 'gender', 'auth_mode', 'is_approved', 'is_staff', 'date_joined')
    list_filter = ('is_approved', 'gender', 'auth_mode', 'is_staff', 'is_superuser')
    search_fields = ('email', 'name')
    ordering = ('email',)
    actions = [approve_users, reset_dummy_data, approve_profile_pics]
    fieldsets = BaseUserAdmin.fieldsets + (
        ('GymSheet profile', {'fields': (
            'name', 'profile_pic_url', 'profile_pic_url_pending', 'gender', 'is_approved', 'auth_mode', 'pin', 'pin_hash'
        )}),
    )
    readonly_fields = ('pin_hash',)


@admin.register(UserPreference)
class UserPreferenceAdmin(admin.ModelAdmin):
    list_display = ('user', 'theme', 'language', 'goals_paused')
    list_filter = ('theme', 'language', 'goals_paused')
