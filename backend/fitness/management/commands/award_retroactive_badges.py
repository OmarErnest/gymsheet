from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from fitness.badges import (
    check_badge_first_exercise,
    check_badge_record_breaker,
    check_badge_perfect_week,
    check_badge_champion,
    check_badge_messenger,
    check_badge_style,
    check_badge_calisthenics
)

User = get_user_model()

class Command(BaseCommand):
    help = "Retroactively awards badges to all users based on their existing history."

    def handle(self, *args, **options):
        users = User.objects.all()
        total_awarded = 0
        
        self.stdout.write(self.style.NOTICE(f"Starting retroactive badge check for {users.count()} users..."))

        for user in users:
            newly_earned = []
            
            b = check_badge_first_exercise(user)
            if b: newly_earned.append(b)

            b = check_badge_record_breaker(user)
            if b: newly_earned.append(b)

            b = check_badge_perfect_week(user)
            if b: newly_earned.append(b)

            b = check_badge_champion(user)
            if b: newly_earned.append(b)

            b = check_badge_messenger(user)
            if b: newly_earned.append(b)

            b = check_badge_style(user)
            if b: newly_earned.append(b)

            b = check_badge_calisthenics(user)
            if b: newly_earned.append(b)

            if newly_earned:
                total_awarded += len(newly_earned)
                self.stdout.write(self.style.SUCCESS(f"User {user.email} earned {len(newly_earned)} new badges: {[b.badge.name for b in newly_earned]}"))

        self.stdout.write(self.style.SUCCESS(f"Finished! Total badges retroactively awarded: {total_awarded}"))
