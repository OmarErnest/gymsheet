from datetime import timedelta
from django.utils import timezone
from django.contrib.auth import get_user_model
from fitness.models import ExerciseLog
from collections import defaultdict

def get_leaderboard_data():
    today = timezone.localdate()
    week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=6)

    User = get_user_model()
    users = User.objects.filter(is_approved=True).select_related('preferences')
    data = []

    for user in users:
        weekly_logs = list(
            ExerciseLog.objects.filter(user=user, date__range=[week_start, week_end])
        )

        logs_by_date = defaultdict(list)
        for log in weekly_logs:
            logs_by_date[log.date].append(log)

        qualified_days = [
            d for d, dlogs in logs_by_date.items() if len(dlogs) >= 2
        ]
        active_days_count = len(qualified_days)

        score = 0
        for d in qualified_days:
            for log in logs_by_date[d]:
                score += float(log.weight_kg or 0) * (log.sets or 0) * (log.reps or 0)
        score = int(score)

        qualified_logs = [log for d in qualified_days for log in logs_by_date[d]]
        avg_weight = (
            sum(float(l.weight_kg or 0) for l in qualified_logs) / len(qualified_logs)
        ) if qualified_logs else 0

        data.append({
            'id': user.id,
            'name': user.name,
            'profile_pic_url': user.profile_pic_url,
            'gender': user.gender,
            'active_days': active_days_count,
            'average_lift_kg_this_week': round(avg_weight, 1),
            'score': score,
            'is_test_user': user.is_test_user,
            'recommended_link': getattr(user.preferences, 'recommended_link', '')
        })

    # Separate and sort
    real_users = sorted([u for u in data if not u['is_test_user']], key=lambda x: x['score'], reverse=True)
    beta_users = sorted([u for u in data if u['is_test_user']], key=lambda x: x['score'], reverse=True)

    for i, u in enumerate(real_users):
        u['rank'] = i + 1
    for i, u in enumerate(beta_users):
        u['rank'] = i + 1

    return real_users + beta_users
