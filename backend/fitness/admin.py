from django.contrib import admin

from .models import BodyMeasurement, DailyProgress, Exercise, ExerciseLog, GoalExercise, GoalPlan, Notification, MaintenanceNotification


class GoalExerciseInline(admin.TabularInline):
    model = GoalExercise
    extra = 1


@admin.register(GoalPlan)
class GoalPlanAdmin(admin.ModelAdmin):
    list_display = ('title', 'user', 'start_date', 'end_date', 'repeat_type', 'calories_target', 'is_paused')
    list_filter = ('repeat_type', 'is_paused')
    search_fields = ('title', 'user__email', 'user__name')
    inlines = [GoalExerciseInline]


@admin.register(Exercise)
class ExerciseAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'created_by', 'is_public', 'created_at')
    list_filter = ('category', 'is_public')
    search_fields = ('name', 'youtube_url')


@admin.register(DailyProgress)
class DailyProgressAdmin(admin.ModelAdmin):
    list_display = ('user', 'date', 'calories_consumed', 'completed')
    list_filter = ('completed',)
    search_fields = ('user__email', 'user__name')


@admin.register(ExerciseLog)
class ExerciseLogAdmin(admin.ModelAdmin):
    list_display = ('user', 'exercise', 'date', 'weight_kg', 'sets', 'reps')
    list_filter = ('exercise__category',)
    search_fields = ('user__email', 'exercise__name')


@admin.register(BodyMeasurement)
class BodyMeasurementAdmin(admin.ModelAdmin):
    list_display = ('user', 'body_part', 'custom_label', 'value_cm', 'date')
    list_filter = ('body_part',)
    search_fields = ('user__email', 'user__name', 'custom_label')


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('user', 'message', 'is_read', 'created_at')
    list_filter = ('is_read',)
    search_fields = ('user__email', 'message')


@admin.register(MaintenanceNotification)
class MaintenanceNotificationAdmin(admin.ModelAdmin):
    list_display = ('start_time', 'end_time', 'created_at')
    # This model broadcasts on save, so we just register it.
