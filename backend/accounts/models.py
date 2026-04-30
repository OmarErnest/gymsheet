from django.contrib.auth.hashers import check_password, make_password
from django.contrib.auth.models import AbstractUser
from django.core.validators import RegexValidator
from django.db import models


class User(AbstractUser):
    class Gender(models.TextChoices):
        MALE = 'male', 'Male'
        FEMALE = 'female', 'Female'

    class AuthMode(models.TextChoices):
        PIN = 'pin', 'PIN'
        PASSWORD = 'password', 'Password'

    email = models.EmailField(unique=True)
    name = models.CharField(max_length=160)
    profile_pic_url = models.URLField(blank=True)
    profile_pic_url_pending = models.URLField(blank=True)
    gender = models.CharField(max_length=12, choices=Gender.choices, blank=True)
    is_approved = models.BooleanField(default=False)
    auth_mode = models.CharField(max_length=12, choices=AuthMode.choices, default=AuthMode.PIN)
    pin_hash = models.CharField(max_length=180, blank=True)
    leaderboard_message = models.CharField(max_length=255, blank=True)
    leaderboard_message_approved = models.BooleanField(default=False)
    leaderboard_message_week = models.DateField(null=True, blank=True)
    is_test_user = models.BooleanField(default=False)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username', 'name']

    def save(self, *args, **kwargs):
        if not self.username:
            self.username = self.email
        super().save(*args, **kwargs)

    def set_pin(self, raw_pin: str) -> None:
        if not raw_pin or not raw_pin.isdigit() or len(raw_pin) != 6:
            raise ValueError('PIN must be exactly 6 digits.')
        self.pin_hash = make_password(raw_pin)

    def check_pin(self, raw_pin: str) -> bool:
        return bool(self.pin_hash and check_password(raw_pin, self.pin_hash))

    def __str__(self):
        return self.name or self.email


class UserPreference(models.Model):
    class Theme(models.TextChoices):
        LIGHT = 'light', 'Light'
        DARK = 'dark', 'Dark'

    class Language(models.TextChoices):
        EN = 'en', 'English'
        ES = 'es', 'Spanish'
        
    class FontSize(models.TextChoices):
        SMALL = 'small', 'Small'
        MEDIUM = 'medium', 'Medium'
        BIG = 'big', 'Big'

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='preferences')
    theme = models.CharField(max_length=10, choices=Theme.choices, default=Theme.DARK)
    language = models.CharField(max_length=5, choices=Language.choices, default=Language.EN)
    goals_paused = models.BooleanField(default=False)
    font_size = models.CharField(max_length=10, choices=FontSize.choices, default=FontSize.MEDIUM)
    height_cm = models.PositiveIntegerField(null=True, blank=True)
    weight_kg = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    recommended_link = models.URLField(blank=True)

    def __str__(self):
        return f'{self.user.email} preferences'
