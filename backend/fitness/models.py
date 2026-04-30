from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone


class Exercise(models.Model):
    class Category(models.TextChoices):
        SHOULDER = 'shoulder', 'Shoulder'
        LEGS = 'legs', 'Legs'
        CHEST = 'chest', 'Chest'
        BACK = 'back', 'Back'
        ARMS = 'arms', 'Arms'
        OTHER = 'other', 'Other'

    name = models.CharField(max_length=120)
    youtube_url = models.URLField(blank=True)
    category = models.CharField(max_length=20, choices=Category.choices, default=Category.OTHER)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='created_exercises')
    is_public = models.BooleanField(default=True)
    is_time_based = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ('category', 'name')
        indexes = [models.Index(fields=['category', 'name'])]

    def __str__(self):
        return self.name


class GoalPlan(models.Model):
    class RepeatType(models.TextChoices):
        ONCE = 'once', 'Once'
        WEEKLY = 'weekly', 'Weekly'

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='goal_plans')
    title = models.CharField(max_length=140)
    start_date = models.DateField(default=timezone.localdate)
    end_date = models.DateField(blank=True, null=True)
    repeat_type = models.CharField(max_length=12, choices=RepeatType.choices, default=RepeatType.ONCE)
    weekdays = models.JSONField(default=list, blank=True, help_text='0=Monday ... 6=Sunday')
    calories_target = models.PositiveIntegerField(default=0)
    is_paused = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ('-start_date', '-created_at')
        indexes = [models.Index(fields=['user', 'start_date', 'end_date'])]

    def __str__(self):
        return f'{self.title} — {self.user}'

    def matches_date(self, day):
        if self.is_paused:
            return False
        if self.repeat_type == self.RepeatType.ONCE:
            return self.start_date == day
        if day < self.start_date:
            return False
        if self.end_date and day > self.end_date:
            return False
        weekdays = self.weekdays or [self.start_date.weekday()]
        return day.weekday() in weekdays

    @classmethod
    def end_date_from_weeks(cls, start_date, repeat_weeks):
        if not repeat_weeks:
            return None
        return start_date + timedelta(weeks=int(repeat_weeks)) - timedelta(days=1)


class GoalExercise(models.Model):
    goal_plan = models.ForeignKey(GoalPlan, on_delete=models.CASCADE, related_name='goal_exercises')
    exercise = models.ForeignKey(Exercise, on_delete=models.CASCADE, related_name='goal_items')
    sets = models.PositiveIntegerField(default=3)
    reps = models.PositiveIntegerField(default=10)
    duration = models.CharField(max_length=10, blank=True)
    order = models.PositiveIntegerField(default=0)
    notes = models.CharField(max_length=240, blank=True)

    class Meta:
        ordering = ('order', 'id')

    def __str__(self):
        return f'{self.goal_plan.title}: {self.exercise.name}'


class DailyProgress(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='daily_progress')
    date = models.DateField(default=timezone.localdate)
    calories_consumed = models.PositiveIntegerField(default=0)
    completed = models.BooleanField(default=False)
    notes = models.TextField(blank=True)

    class Meta:
        unique_together = ('user', 'date')
        ordering = ('-date',)

    def __str__(self):
        return f'{self.user} {self.date}'


class ExerciseLog(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='exercise_logs')
    exercise = models.ForeignKey(Exercise, on_delete=models.CASCADE, related_name='logs')
    date = models.DateField(default=timezone.localdate)
    weight_kg = models.DecimalField(max_digits=7, decimal_places=2, default=0)
    duration = models.CharField(max_length=10, blank=True)
    sets = models.PositiveIntegerField(default=0)
    reps = models.PositiveIntegerField(default=0)
    source_goal_plan = models.ForeignKey(GoalPlan, on_delete=models.SET_NULL, null=True, blank=True)
    notes = models.CharField(max_length=240, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ('-date', '-created_at')
        indexes = [models.Index(fields=['user', 'exercise', 'date'])]

    def __str__(self):
        return f'{self.user} {self.exercise} {self.weight_kg}kg'


class BodyMeasurement(models.Model):
    class BodyPart(models.TextChoices):
        BICEPS = 'biceps', 'Biceps'
        FOREARMS = 'forearms', 'Forearms'
        CHEST = 'chest', 'Chest'
        WAIST = 'waist', 'Waist'
        HIPS = 'hips', 'Hips'
        THIGH = 'thigh', 'Thigh'
        CALF = 'calf', 'Calf'
        SHOULDERS = 'shoulders', 'Shoulders'
        OTHER = 'other', 'Other'

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='body_measurements')
    body_part = models.CharField(max_length=24, choices=BodyPart.choices)
    custom_label = models.CharField(max_length=80, blank=True)
    value_cm = models.DecimalField(max_digits=6, decimal_places=2)
    date = models.DateField(default=timezone.localdate)
    notes = models.CharField(max_length=240, blank=True)

    class Meta:
        ordering = ('-date', '-id')
        indexes = [models.Index(fields=['user', 'body_part', 'date'])]

    def __str__(self):
        label = self.custom_label or self.get_body_part_display()
        return f'{self.user} {label}: {self.value_cm}cm'

class CSVRequest(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='csv_requests')
    is_approved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    approved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ('-created_at',)

    def __str__(self):
        return f'{self.user} - {"Approved" if self.is_approved else "Pending"}'

class Notification(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notifications')
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ('-created_at',)

    def __str__(self):
        return f'{self.user}: {self.message[:20]}'

class MaintenanceNotification(models.Model):
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    message_prefix = models.CharField(max_length=200, default="Maintenance Duty Notice: Scheduled from")
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        super().save(*args, **kwargs)
        if is_new:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            msg = f"{self.message_prefix} {self.start_time.strftime('%Y-%m-%d %H:%M')} to {self.end_time.strftime('%Y-%m-%d %H:%M')}"
            notifications = [
                Notification(user=user, message=msg)
                for user in User.objects.filter(is_approved=True)
            ]
            Notification.objects.bulk_create(notifications)

    def __str__(self):
        return f"Maintenance: {self.start_time} - {self.end_time}"


class ExerciseCSVUpload(models.Model):
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        APPROVED = 'approved', 'Approved'
        REJECTED = 'rejected', 'Rejected'

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='csv_uploads')
    file = models.FileField(upload_to='exercise_uploads/')
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.PENDING)
    admin_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ('-created_at',)

    def __str__(self):
        return f'{self.user} exercise upload — {self.status}'


class LogCSVUpload(models.Model):
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        APPROVED = 'approved', 'Approved'
        REJECTED = 'rejected', 'Rejected'

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='log_csv_uploads')
    file = models.FileField(upload_to='log_uploads/')
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.PENDING)
    admin_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ('-created_at',)

    def __str__(self):
        return f'{self.user} log upload — {self.status}'
