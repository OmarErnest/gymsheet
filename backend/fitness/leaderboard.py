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
    users = User.objects.filter(is_approved=True).select_related('preferences').prefetch_related('badges__badge').exclude(preferences__hide_from_leaderboard=True)
    data = []

    last_week_start = week_start - timedelta(days=7)
    last_week_end = week_end - timedelta(days=7)

    for user in users:
        # Current Week Score
        weekly_logs = list(
            ExerciseLog.objects.filter(user=user, date__range=[week_start, week_end]).select_related('exercise')
        )
        logs_by_date = defaultdict(list)
        for log in weekly_logs:
            logs_by_date[log.date].append(log)
        qualified_days = [d for d, dlogs in logs_by_date.items() if len(dlogs) >= 2]
        active_days_count = len(qualified_days)
        score = 0
        for d in qualified_days:
            for log in logs_by_date[d]:
                if log.is_pr_set:
                    continue
                eff_w = float(log.weight_kg or 0)
                if log.exercise.exercise_type == 'calisthenics':
                    pref = getattr(user, 'preferences', None)
                    user_weight = float(getattr(pref, 'weight_kg', 70) or 70)
                    eff_w += user_weight * 0.5
                score += eff_w * (log.sets or 0) * (log.reps or 0)
        score = int(score)

        # Last Week Score
        last_weekly_logs = list(
            ExerciseLog.objects.filter(user=user, date__range=[last_week_start, last_week_end]).select_related('exercise')
        )
        last_logs_by_date = defaultdict(list)
        for log in last_weekly_logs:
            last_logs_by_date[log.date].append(log)
        last_qualified_days = [d for d, dlogs in last_logs_by_date.items() if len(dlogs) >= 2]
        last_score = 0
        for d in last_qualified_days:
            for log in last_logs_by_date[d]:
                if log.is_pr_set:
                    continue
                eff_w = float(log.weight_kg or 0)
                if log.exercise.exercise_type == 'calisthenics':
                    pref = getattr(user, 'preferences', None)
                    user_weight = float(getattr(pref, 'weight_kg', 70) or 70)
                    eff_w += user_weight * 0.5
                last_score += eff_w * (log.sets or 0) * (log.reps or 0)
        last_score = int(last_score)

        qualified_logs = [log for d in qualified_days for log in logs_by_date[d] if not log.is_pr_set]
        def get_eff(l):
            w = float(l.weight_kg or 0)
            if l.exercise.exercise_type == 'calisthenics':
                pref = getattr(user, 'preferences', None)
                user_weight = float(getattr(pref, 'weight_kg', 70) or 70)
                w += user_weight * 0.5
            return w

        avg_weight = (
            sum(get_eff(l) for l in qualified_logs) / len(qualified_logs)
        ) if qualified_logs else 0

        data.append({
            'id': user.id,
            'name': user.name,
            'profile_pic_url': user.profile_pic_url,
            'gender': user.gender,
            'active_days': active_days_count,
            'average_lift_kg_this_week': round(avg_weight, 1),
            'score': score,
            'last_week_score': last_score,
            'is_test_user': user.is_test_user,
            'recommended_link': getattr(user.preferences, 'recommended_link', ''),
            'badges': [
                {
                    'name': ub.badge.name,
                    'icon_url': f"badges/{ub.badge.icon_name}",
                } for ub in user.badges.all()
            ]
        })

    # Separate and sort
    real_users = sorted([u for u in data if not u['is_test_user']], key=lambda x: x['score'], reverse=True)
    beta_users = sorted([u for u in data if u['is_test_user']], key=lambda x: x['score'], reverse=True)

    for i, u in enumerate(real_users):
        u['rank'] = i + 1
    for i, u in enumerate(beta_users):
        u['rank'] = i + 1

    return real_users + beta_users
