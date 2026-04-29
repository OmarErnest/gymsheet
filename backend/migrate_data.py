import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from accounts.models import User
from fitness.models import GoalPlan, ExerciseLog

# 1. Update emails
count = 0
for user in User.objects.all():
    if '@gym.local' in user.email:
        new_email = user.email.replace('@gym.local', '@gym.sheet')
        user.email = new_email
        user.username = new_email
        user.save()
        count += 1
print(f"Updated {count} emails to @gym.sheet")

# 2. Transfer dummy goals to omar
try:
    dummy = User.objects.get(email='dummy@gym.sheet')
    omar = User.objects.get(email='omar@gym.sheet')
    goals_updated = GoalPlan.objects.filter(user=dummy).update(user=omar)
    logs_updated = ExerciseLog.objects.filter(user=dummy).update(user=omar)
    print(f"Transferred {goals_updated} goals and {logs_updated} logs from dummy to omar.")
except Exception as e:
    print(f"Transfer error: {e}")
