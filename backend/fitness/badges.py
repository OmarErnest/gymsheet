from django.utils import timezone
from .models import Badge, UserBadge, ExerciseLog, AdminMessage, DailyProgress, GoalPlan
from datetime import timedelta

def award_badge(user, badge_slug):
    """
    Awards a badge to a user if they don't have it yet.
    Returns the UserBadge object if awarded, None otherwise.
    """
    try:
        badge = Badge.objects.get(slug=badge_slug)
        user_badge, created = UserBadge.objects.get_or_create(user=user, badge=badge)
        if created:
            # Create a notification as well for safety/history
            from .models import Notification
            Notification.objects.create(
                user=user,
                message=f"BADGE EARNED: {badge.name}! {badge.dbz_message}"
            )
            return user_badge
    except Badge.DoesNotExist:
        pass
    return None

def check_badge_first_exercise(user):
    if not UserBadge.objects.filter(user=user, badge__slug='first_step').exists():
        if ExerciseLog.objects.filter(user=user).exists():
            return award_badge(user, 'first_step')
    return None

def check_badge_record_breaker(user):
    if not UserBadge.objects.filter(user=user, badge__slug='record_breaker').exists():
        pr_count = ExerciseLog.objects.filter(user=user, is_pr_set=True).count()
        if pr_count >= 100:
            return award_badge(user, 'record_breaker')
    return None

def check_badge_perfect_week(user, reference_date=None):
    if not UserBadge.objects.filter(user=user, badge__slug='perfectionist').exists():
        if not reference_date:
            reference_date = timezone.localdate()
        elif isinstance(reference_date, str):
            from datetime import datetime
            reference_date = datetime.strptime(reference_date, '%Y-%m-%d').date()
        
        # Start of current week
        start = reference_date - timedelta(days=reference_date.weekday())
        end = start + timedelta(days=6)
        
        # Check if all goals for this week are completed
        # First, find which days in this week HAVE goals
        days_with_goals = 0
        days_completed = 0
        
        for i in range(7):
            day = start + timedelta(days=i)
            plans = GoalPlan.objects.filter(user=user)
            has_goal = False
            for p in plans:
                if p.matches_date(day):
                    has_goal = True
                    break
            
            if has_goal:
                days_with_goals += 1
                if DailyProgress.objects.filter(user=user, date=day, completed=True).exists():
                    days_completed += 1
        
        if days_with_goals > 0 and days_completed == days_with_goals:
            return award_badge(user, 'perfectionist')
    return None

def check_badge_champion(user):
    # This should be called when user views leaderboard or when a weekly calculation happens
    # For now, we can check if they are currently #1 in the leaderboard calculation
    if not UserBadge.objects.filter(user=user, badge__slug='champion').exists():
        from .leaderboard import get_leaderboard_data
        data = get_leaderboard_data()
        if data and len(data) > 0 and data[0]['id'] == user.id:
            return award_badge(user, 'champion')
    return None

def check_badge_messenger(user):
    if not UserBadge.objects.filter(user=user, badge__slug='messenger').exists():
        if AdminMessage.objects.filter(user=user).exists():
            return award_badge(user, 'messenger')
    return None

def check_badge_style(user):
    if not UserBadge.objects.filter(user=user, badge__slug='style_master').exists():
        if user.profile_pic_url:
            return award_badge(user, 'style_master')
    return None

def check_badge_calisthenics(user):
    if not UserBadge.objects.filter(user=user, badge__slug='gravity_defier').exists():
        if ExerciseLog.objects.filter(user=user, exercise__exercise_type='calisthenics').exists():
            return award_badge(user, 'gravity_defier')
    return None

def check_all_relevant_badges(user, action_type, **kwargs):
    """
    Helper to check all badges relevant to a specific action.
    Returns a list of UserBadge objects newly earned.
    """
    newly_earned = []
    
    if action_type == 'log':
        b = check_badge_first_exercise(user)
        if b: newly_earned.append(b)
        b = check_badge_record_breaker(user)
        if b: newly_earned.append(b)
        b = check_badge_perfect_week(user, kwargs.get('date'))
        if b: newly_earned.append(b)
        b = check_badge_calisthenics(user)
        if b: newly_earned.append(b)
    elif action_type == 'message':
        b = check_badge_messenger(user)
        if b: newly_earned.append(b)
    elif action_type == 'profile':
        b = check_badge_style(user)
        if b: newly_earned.append(b)
    elif action_type == 'leaderboard':
        b = check_badge_champion(user)
        if b: newly_earned.append(b)
        
    return newly_earned
