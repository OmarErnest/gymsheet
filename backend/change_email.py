import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from accounts.models import User

try:
    u = User.objects.get(email='omar@gym.sheet')
    u.email = 'omare@gym.sheet'
    u.username = 'omare@gym.sheet'
    u.save()
    print("Updated email successfully")
except User.DoesNotExist:
    print("User not found")
