from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from accounts.models import UserPreference
from fitness.models import BodyMeasurement, DailyProgress, Exercise, ExerciseLog


class Command(BaseCommand):
    help = 'Seed demo admin, mock users, exercises, goals, logs, and measurements.'

    def handle(self, *args, **options):
        User = get_user_model()

        admin, created = User.objects.get_or_create(
            email='admin@gym.sheet',
            defaults={
                'username': 'admin@gym.sheet',
                'name': 'Admin',
                'gender': User.Gender.FEMALE,
                'is_approved': True,
                'is_staff': True,
                'is_superuser': True,
                'auth_mode': User.AuthMode.PASSWORD,
            },
        )
        if created or not admin.has_usable_password():
            admin.set_password('Admin123456!')
            admin.save()
        UserPreference.objects.get_or_create(user=admin)

        demo_specs = [
            ('dummy@gym.sheet', 'Dummy', User.Gender.FEMALE, 'https://api.dicebear.com/8.x/thumbs/svg?seed=Dummy'),
            ('omare@gym.sheet', 'Omar E', User.Gender.MALE, 'https://api.dicebear.com/8.x/thumbs/svg?seed=Omar'),
            ('copito@gym.sheet', 'Copito', User.Gender.MALE, 'https://api.dicebear.com/8.x/thumbs/svg?seed=Copito'),
            ('josema@gym.sheet', 'Josema', User.Gender.MALE, 'https://api.dicebear.com/8.x/thumbs/svg?seed=Josema'),
        ]
        users = []
        for email, name, gender, avatar in demo_specs:
            user, _ = User.objects.get_or_create(
                email=email,
                defaults={
                    'username': email,
                    'name': name,
                    'gender': gender,
                    'profile_pic_url': avatar,
                    'is_approved': True,
                    'auth_mode': User.AuthMode.PIN,
                },
            )
            user.name = name
            user.gender = gender
            user.profile_pic_url = avatar
            user.is_approved = True
            user.auth_mode = User.AuthMode.PIN
            user.set_pin('123456')
            user.save()
            users.append(user)

        exercises = [
            ('Dumbbell Shoulder Press', 'shoulder', 'https://www.youtube.com/watch?v=qEwKCR5JCog'),
            ('Back Squat', 'legs', 'https://www.youtube.com/watch?v=ultWZbUMPL8'),
            ('Bench Press', 'chest', 'https://www.youtube.com/watch?v=gRVjAtPip0Y'),
            ('Lat Pulldown', 'back', 'https://www.youtube.com/watch?v=CAwf7n6Luuc'),
            ('Biceps Curl', 'arms', 'https://www.youtube.com/watch?v=ykJmrZ5v0Oo'),
            ('Plank', 'other', 'https://www.youtube.com/watch?v=pSHjTRCQxIw'),
        ]
        exercise_objs = []
        for name, category, url in exercises:
            exercise, _ = Exercise.objects.get_or_create(
                name=name,
                defaults={'category': category, 'youtube_url': url, 'created_by': admin, 'is_public': True},
            )
            exercise.category = category
            exercise.youtube_url = url
            exercise.created_by = admin
            exercise.is_public = True
            exercise.save()
            exercise_objs.append(exercise)

        today = timezone.localdate()
        for user_index, user in enumerate(users):
            for offset in range(21, -1, -3):
                day = today - timedelta(days=offset)
                ExerciseLog.objects.get_or_create(
                    user=user,
                    exercise=exercise_objs[(user_index + offset) % len(exercise_objs)],
                    date=day,
                    defaults={
                        'weight_kg': Decimal(20 + user_index * 4 + (21 - offset) * 0.8),
                        'sets': 3,
                        'reps': 10,
                    },
                )
                DailyProgress.objects.update_or_create(
                    user=user,
                    date=day,
                    defaults={
                        'calories_consumed': 1900 + user_index * 120 + offset,
                        'completed': offset % 2 == 0,
                        'notes': 'Demo progress entry',
                    },
                )
            BodyMeasurement.objects.get_or_create(
                user=user,
                body_part=BodyMeasurement.BodyPart.BICEPS,
                date=today - timedelta(days=14),
                defaults={'value_cm': Decimal(30 + user_index), 'notes': 'Starting measurement'},
            )
            BodyMeasurement.objects.get_or_create(
                user=user,
                body_part=BodyMeasurement.BodyPart.BICEPS,
                date=today,
                defaults={'value_cm': Decimal(31 + user_index), 'notes': 'Current measurement'},
            )

        self.stdout.write(self.style.SUCCESS('Demo data ready.'))
        self.stdout.write('Admin: admin@gym.sheet / Admin123456!')
        self.stdout.write('Demo users PIN: 123456')
