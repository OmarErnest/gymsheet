import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from fitness.models import Exercise
from django.contrib.auth import get_user_model

User = get_user_model()
admin = User.objects.filter(is_superuser=True).first()

exercises_to_add = [
    # Legs
    ('Calf raises', 'legs', False),
    ('Leg press', 'legs', False),
    ('Leg extensions', 'legs', False),
    ('Abductors (open)', 'legs', False),
    ('Abductors (closed)', 'legs', False),
    ('Lying Leg curls', 'legs', False),
    ('Deadlift', 'legs', False),
    ('Hip thrusts', 'legs', False),
    ('Squats', 'legs', False),
    # Chest
    ('Flat benchpress', 'chest', False),
    ('Inclined benchpress', 'chest', False),
    ('Seated chestpress', 'chest', False),
    ('Seated butterflies', 'chest', False),
    ('Dumbbell butterflies', 'chest', False),
    ('Dumbbell benchpress', 'chest', False),
    # Shoulders
    ('Shrugs', 'shoulder', False),
    ('Upright barbell row', 'shoulder', False),
    ('Lateral raise', 'shoulder', False),
    ('Arnold press', 'shoulder', False),
    ('Shoulder press', 'shoulder', False),
    # Back
    ('Pull ups', 'back', False),
    ('Machine row', 'back', False),
    ('Grip pull (closed)', 'back', False),
    ('Chin ups', 'back', False),
    ('Grip pull (wide)', 'back', False),
    ('Cable row', 'back', False),
    ('Barbell rows', 'back', False),
    ('Hyper extensions', 'back', False),
    # Arms
    ('Wrist curls', 'arms', False),
    ('Reverse grip curl', 'arms', False),
    ('Bicep curls', 'arms', False),
    ('Preacher curls', 'arms', False),
    ('Dumbbell hammer', 'arms', False),
    ('Skull crusher', 'arms', False),
    ('Incline curl', 'arms', False),
    ('Cable pushdown', 'arms', False),
    # Others
    ('Jogging', 'other', True),
    ('Plank', 'other', True),
    ('Situps', 'other', False),
]

for name, category, is_time_based in exercises_to_add:
    ex, created = Exercise.objects.get_or_create(name=name, defaults={
        'category': category,
        'is_time_based': is_time_based,
        'created_by': admin,
        'is_public': True
    })
    if not created:
        ex.category = category
        ex.is_time_based = is_time_based
        ex.save()

print("Exercises added successfully.")
