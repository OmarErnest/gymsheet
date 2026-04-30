import csv
import io
from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.db.models import Avg, Count, Max, Q
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import (
    BodyMeasurementSerializer,
    DailyProgressSerializer,
    ExerciseLogSerializer,
    ExerciseSerializer,
    GoalPlanSerializer,
    CSVRequestSerializer,
    NotificationSerializer,
    ExerciseCSVUploadSerializer,
    LogCSVUploadSerializer,
)
from .models import BodyMeasurement, DailyProgress, Exercise, ExerciseLog, GoalPlan, CSVRequest, Notification, ExerciseCSVUpload, LogCSVUpload


class ExerciseViewSet(viewsets.ModelViewSet):
    serializer_class = ExerciseSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Exercise.objects.filter(Q(is_public=True) | Q(created_by=self.request.user))
        category = self.request.query_params.get('category')
        search = self.request.query_params.get('search')
        if category:
            qs = qs.filter(category=category)
        if search:
            qs = qs.filter(name__icontains=search)
        return qs.distinct()

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class GoalPlanViewSet(viewsets.ModelViewSet):
    serializer_class = GoalPlanSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        today = timezone.localdate()
        return GoalPlan.objects.filter(user=self.request.user).exclude(
            repeat_type=GoalPlan.RepeatType.ONCE, start_date__lt=today
        ).prefetch_related('goal_exercises__exercise')

    def check_constraints(self, serializer, instance=None):
        user = self.request.user
        today = timezone.localdate()

        qs = GoalPlan.objects.filter(user=user).exclude(repeat_type=GoalPlan.RepeatType.ONCE, start_date__lt=today)
        if instance:
            qs = qs.exclude(id=instance.id)

        if qs.count() >= 8:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("You cannot have more than 8 active goals at a time.")

        repeat_type = serializer.validated_data.get('repeat_type', instance.repeat_type if instance else GoalPlan.RepeatType.ONCE)
        weekdays = serializer.validated_data.get('weekdays', instance.weekdays if instance else [])

        if repeat_type == GoalPlan.RepeatType.ONCE:
            serializer.validated_data['start_date'] = today
        else:
            existing_repeating = qs.exclude(repeat_type=GoalPlan.RepeatType.ONCE)
            for g in existing_repeating:
                for day in weekdays:
                    if day in g.weekdays:
                        from rest_framework.exceptions import ValidationError
                        raise ValidationError("You already have a goal scheduled for this weekday.")

    def perform_create(self, serializer):
        self.check_constraints(serializer)
        serializer.save()

    def perform_update(self, serializer):
        self.check_constraints(serializer, instance=self.get_object())
        serializer.save()


class DailyProgressViewSet(viewsets.ModelViewSet):
    serializer_class = DailyProgressSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return DailyProgress.objects.filter(user=self.request.user)


class ExerciseLogViewSet(viewsets.ModelViewSet):
    serializer_class = ExerciseLogSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = ExerciseLog.objects.filter(user=self.request.user).select_related('exercise')
        exercise_id = self.request.query_params.get('exercise')
        category = self.request.query_params.get('category')
        start = self.request.query_params.get('start')
        end = self.request.query_params.get('end')
        if exercise_id:
            qs = qs.filter(exercise_id=exercise_id)
        if category:
            qs = qs.filter(exercise__category=category)
        if start:
            qs = qs.filter(date__gte=start)
        if end:
            qs = qs.filter(date__lte=end)
        return qs

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def partial_update(self, request, *args, **kwargs):
        kwargs['partial'] = True
        return self.update(request, *args, **kwargs)


class BodyMeasurementViewSet(viewsets.ModelViewSet):
    serializer_class = BodyMeasurementSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = BodyMeasurement.objects.filter(user=self.request.user)
        body_part = self.request.query_params.get('body_part')
        if body_part:
            qs = qs.filter(body_part=body_part)
        return qs


def parse_date_param(raw, fallback):
    if not raw:
        return fallback
    return date.fromisoformat(raw)


class HomeDaysView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = timezone.localdate()
        start = parse_date_param(request.query_params.get('start'), today)
        end = parse_date_param(request.query_params.get('end'), today)
        if start > end:
            return Response({'detail': 'Start date cannot be after end date.'}, status=status.HTTP_400_BAD_REQUEST)

        plans = list(
            GoalPlan.objects.filter(user=request.user)
            .prefetch_related('goal_exercises__exercise')
        )
        progress_by_date = {p.date: p for p in DailyProgress.objects.filter(user=request.user, date__range=[start, end])}
        logs_by_date = {}
        for log in ExerciseLog.objects.filter(user=request.user, date__range=[start, end]).select_related('exercise'):
            logs_by_date.setdefault(log.date, []).append(log)

        # All-time personal bests (max weight) per exercise for this user
        pb_rows = (
            ExerciseLog.objects
            .filter(user=request.user, weight_kg__gt=0)
            .values('exercise_id')
            .annotate(best=Max('weight_kg'))
        )
        personal_bests = {row['exercise_id']: float(row['best']) for row in pb_rows}

        def enrich_goals(goals_data):
            """Inject personal_best into each goal_exercise dict."""
            for goal in goals_data:
                for ge in goal.get('goal_exercises', []):
                    ex_id = ge.get('exercise') or (ge.get('exercise_detail') or {}).get('id')
                    ge['personal_best'] = personal_bests.get(ex_id)
            return goals_data

        days = []
        current = start
        while current <= end:
            goals_paused_for_future = getattr(request.user.preferences, 'goals_paused', False) and current > today
            matching_plans = []
            if not goals_paused_for_future:
                matching_plans = [plan for plan in plans if plan.matches_date(current)]
                if any(p.repeat_type == GoalPlan.RepeatType.ONCE for p in matching_plans):
                    matching_plans = [p for p in matching_plans if p.repeat_type == GoalPlan.RepeatType.ONCE]
            goals_data = GoalPlanSerializer(matching_plans, many=True, context={'request': request}).data
            days.append({
                'date': current,
                'label': current.strftime('%A, %b %d'),
                'is_today': current == today,
                'is_future': current > today,
                'goals': enrich_goals(goals_data),
                'progress': DailyProgressSerializer(progress_by_date.get(current)).data if progress_by_date.get(current) else None,
                'logs': ExerciseLogSerializer(logs_by_date.get(current, []), many=True).data,
            })
            current += timedelta(days=1)
        return Response(days)


def get_champion_for_week(week_start, week_end):
    User = get_user_model()
    users = User.objects.filter(is_approved=True)
    best_user = None
    best_score = -999999

    from django.db.models import Avg, Sum
    for user in users:
        logs = ExerciseLog.objects.filter(user=user, date__range=[week_start, week_end])
        last_logs = ExerciseLog.objects.filter(user=user, date__range=[week_start - timedelta(days=7), week_end - timedelta(days=7)])

        avg_weight = logs.aggregate(val=Avg('weight_kg'))['val'] or 0
        last_avg_weight = last_logs.aggregate(val=Avg('weight_kg'))['val'] or 0

        reps_sum = logs.aggregate(val=Avg('reps'))['val'] or 0
        sets_sum = logs.aggregate(val=Avg('sets'))['val'] or 0

        diff = float(avg_weight) - float(last_avg_weight)
        score = (float(avg_weight) * reps_sum * sets_sum) + diff

        if score > best_score:
            best_score = score
            best_user = user

    return best_user


class LeaderboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
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

            from collections import defaultdict
            logs_by_date = defaultdict(list)
            for log in weekly_logs:
                logs_by_date[log.date].append(log)

            # Active day = a date with at least 2 different exercises logged
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

            recommended_link = getattr(getattr(user, 'preferences', None), 'recommended_link', '') or ''

            data.append({
                'id': user.id,
                'name': user.name,
                'profile_pic_url': user.profile_pic_url,
                'gender': user.gender,
                'active_days': active_days_count,
                'average_lift_kg_this_week': round(avg_weight, 1),
                'score': score,
                'is_test_user': getattr(user, 'is_test_user', False),
                'recommended_link': recommended_link,
            })

        # Sort: real users first by score desc, then test users by score desc
        data.sort(key=lambda item: (item['is_test_user'], -item['score']))
        for idx, item in enumerate(data, 1):
            item['rank'] = idx

        # Find current user's entry for self-rank injection
        current_user_entry = next((item for item in data if item['id'] == request.user.id), None)

        last_week_start = week_start - timedelta(days=7)
        last_week_end = week_end - timedelta(days=7)
        champion = get_champion_for_week(last_week_start, last_week_end)

        champion_data = None
        if champion and champion.leaderboard_message_approved:
            if champion.leaderboard_message_week == week_start:
                champion_data = {
                    'name': champion.name,
                    'message': champion.leaderboard_message,
                    'profile_pic_url': champion.profile_pic_url
                }

        return Response({
            'champion_id': champion.id if champion else None,
            'champion_message': champion_data,
            'leaderboard': data,
            'current_user_rank': current_user_entry,
        })


class ExportCSVView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        now = timezone.now()
        yesterday = now - timedelta(days=1)
        has_approved = CSVRequest.objects.filter(user=request.user, is_approved=True, approved_at__gte=yesterday).exists()
        if not has_approved:
            return Response({'detail': 'You do not have an approved CSV request within the last 24 hours.'}, status=403)

        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="gym_data.csv"'

        writer = csv.writer(response)
        writer.writerow(['Date', 'Exercise', 'Category', 'Weight (kg)', 'Duration', 'Sets', 'Reps', 'Notes'])

        logs = ExerciseLog.objects.filter(user=request.user).select_related('exercise').order_by('date', 'created_at')
        for log in logs:
            writer.writerow([
                log.date,
                log.exercise.name,
                log.exercise.category,
                log.weight_kg,
                log.duration,
                log.sets,
                log.reps,
                log.notes
            ])

        return response


class CSVRequestViewSet(viewsets.ModelViewSet):
    serializer_class = CSVRequestSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return CSVRequest.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        CSVRequest.objects.filter(user=self.request.user, is_approved=False).delete()
        serializer.save(user=self.request.user)


class NotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)


VALID_CATEGORIES = {'shoulder', 'legs', 'chest', 'back', 'arms', 'other'}


class ExerciseCSVUploadView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request):
        uploads = ExerciseCSVUpload.objects.filter(user=request.user)
        serializer = ExerciseCSVUploadSerializer(uploads, many=True)
        return Response(serializer.data)

    def post(self, request):
        file = request.FILES.get('file')
        if not file:
            return Response({'detail': 'No file provided.'}, status=status.HTTP_400_BAD_REQUEST)
        if not file.name.endswith('.csv'):
            return Response({'detail': 'Only .csv files are allowed.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            content = file.read().decode('utf-8-sig')
            reader = csv.DictReader(io.StringIO(content))
            rows = list(reader)
        except Exception:
            return Response({'detail': 'Could not parse CSV file.'}, status=status.HTTP_400_BAD_REQUEST)

        errors = []
        for i, row in enumerate(rows, 1):
            name = (row.get('name') or '').strip()
            category = (row.get('category') or '').strip().lower()
            if not name:
                errors.append(f'Row {i}: exercise name is required.')
            elif len(name) > 120:
                errors.append(f'Row {i}: name too long (max 120 chars).')
            if category and category not in VALID_CATEGORIES:
                errors.append(f'Row {i}: invalid category "{category}". Must be one of: {", ".join(VALID_CATEGORIES)}.')

        if errors:
            return Response({'detail': 'Validation errors in CSV.', 'errors': errors}, status=status.HTTP_400_BAD_REQUEST)

        upload = ExerciseCSVUpload.objects.create(user=request.user, file=file)
        return Response(ExerciseCSVUploadSerializer(upload).data, status=status.HTTP_201_CREATED)


class ExerciseCSVUploadApproveView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if not request.user.is_staff:
            return Response({'detail': 'Admin only.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            upload = ExerciseCSVUpload.objects.get(pk=pk)
        except ExerciseCSVUpload.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        action = request.data.get('action')
        if action == 'reject':
            upload.status = ExerciseCSVUpload.Status.REJECTED
            upload.admin_notes = request.data.get('notes', '')
            upload.save()
            return Response({'detail': 'Upload rejected.'})

        try:
            content = upload.file.read().decode('utf-8-sig')
            reader = csv.DictReader(io.StringIO(content))
            created = 0
            for row in reader:
                name = (row.get('name') or '').strip()
                category = (row.get('category') or 'other').strip().lower()
                youtube_url = (row.get('youtube_url') or '').strip()
                if not name:
                    continue
                if category not in VALID_CATEGORIES:
                    category = 'other'
                Exercise.objects.get_or_create(
                    name__iexact=name,
                    defaults={
                        'name': name,
                        'category': category,
                        'youtube_url': youtube_url,
                        'is_public': True,
                        'created_by': upload.user,
                    }
                )
                created += 1
            upload.status = ExerciseCSVUpload.Status.APPROVED
            upload.admin_notes = f'Approved: {created} exercise(s) processed.'
            upload.save()
            return Response({'detail': f'Approved. {created} exercise(s) added.'})
        except Exception as e:
            return Response({'detail': f'Error processing file: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ExerciseViewSet(viewsets.ModelViewSet):
    serializer_class = ExerciseSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Exercise.objects.filter(Q(is_public=True) | Q(created_by=self.request.user))
        category = self.request.query_params.get('category')
        search = self.request.query_params.get('search')
        if category:
            qs = qs.filter(category=category)
        if search:
            qs = qs.filter(name__icontains=search)
        return qs.distinct()

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class GoalPlanViewSet(viewsets.ModelViewSet):
    serializer_class = GoalPlanSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        today = timezone.localdate()
        return GoalPlan.objects.filter(user=self.request.user).exclude(
            repeat_type=GoalPlan.RepeatType.ONCE, start_date__lt=today
        ).prefetch_related('goal_exercises__exercise')

    def check_constraints(self, serializer, instance=None):
        user = self.request.user
        today = timezone.localdate()
        
        qs = GoalPlan.objects.filter(user=user).exclude(repeat_type=GoalPlan.RepeatType.ONCE, start_date__lt=today)
        if instance:
            qs = qs.exclude(id=instance.id)
            
        if qs.count() >= 8:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("You cannot have more than 8 active goals at a time.")
            
        repeat_type = serializer.validated_data.get('repeat_type', instance.repeat_type if instance else GoalPlan.RepeatType.ONCE)
        weekdays = serializer.validated_data.get('weekdays', instance.weekdays if instance else [])
        
        if repeat_type == GoalPlan.RepeatType.ONCE:
            serializer.validated_data['start_date'] = today
        else:
            existing_repeating = qs.exclude(repeat_type=GoalPlan.RepeatType.ONCE)
            for g in existing_repeating:
                for day in weekdays:
                    if day in g.weekdays:
                        from rest_framework.exceptions import ValidationError
                        raise ValidationError("You already have a goal scheduled for this weekday.")

    def perform_create(self, serializer):
        self.check_constraints(serializer)
        serializer.save()

    def perform_update(self, serializer):
        self.check_constraints(serializer, instance=self.get_object())
        serializer.save()


class DailyProgressViewSet(viewsets.ModelViewSet):
    serializer_class = DailyProgressSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return DailyProgress.objects.filter(user=self.request.user)


class ExerciseLogViewSet(viewsets.ModelViewSet):
    serializer_class = ExerciseLogSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = ExerciseLog.objects.filter(user=self.request.user).select_related('exercise')
        exercise_id = self.request.query_params.get('exercise')
        category = self.request.query_params.get('category')
        start = self.request.query_params.get('start')
        end = self.request.query_params.get('end')
        if exercise_id:
            qs = qs.filter(exercise_id=exercise_id)
        if category:
            qs = qs.filter(exercise__category=category)
        if start:
            qs = qs.filter(date__gte=start)
        if end:
            qs = qs.filter(date__lte=end)
        return qs

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def partial_update(self, request, *args, **kwargs):
        kwargs['partial'] = True
        return self.update(request, *args, **kwargs)


class BodyMeasurementViewSet(viewsets.ModelViewSet):
    serializer_class = BodyMeasurementSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = BodyMeasurement.objects.filter(user=self.request.user)
        body_part = self.request.query_params.get('body_part')
        if body_part:
            qs = qs.filter(body_part=body_part)
        return qs


def parse_date_param(raw, fallback):
    if not raw:
        return fallback
    return date.fromisoformat(raw)


class HomeDaysView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = timezone.localdate()
        start = parse_date_param(request.query_params.get('start'), today)
        end = parse_date_param(request.query_params.get('end'), today)
        if start > end:
            return Response({'detail': 'Start date cannot be after end date.'}, status=status.HTTP_400_BAD_REQUEST)

        plans = list(
            GoalPlan.objects.filter(user=request.user)
            .prefetch_related('goal_exercises__exercise')
        )
        progress_by_date = {p.date: p for p in DailyProgress.objects.filter(user=request.user, date__range=[start, end])}
        logs_by_date = {}
        for log in ExerciseLog.objects.filter(user=request.user, date__range=[start, end]).select_related('exercise'):
            logs_by_date.setdefault(log.date, []).append(log)

        # All-time personal bests (max weight) per exercise for this user
        pb_rows = (
            ExerciseLog.objects
            .filter(user=request.user, weight_kg__gt=0)
            .values('exercise_id')
            .annotate(best=Max('weight_kg'))
        )
        personal_bests = {row['exercise_id']: float(row['best']) for row in pb_rows}

        def enrich_goals(goals_data):
            """Inject personal_best into each goal_exercise dict."""
            for goal in goals_data:
                for ge in goal.get('goal_exercises', []):
                    ex_id = ge.get('exercise') or (ge.get('exercise_detail') or {}).get('id')
                    ge['personal_best'] = personal_bests.get(ex_id)
            return goals_data

        days = []
        current = start
        while current <= end:
            goals_paused_for_future = getattr(request.user.preferences, 'goals_paused', False) and current > today
            matching_plans = []
            if not goals_paused_for_future:
                matching_plans = [plan for plan in plans if plan.matches_date(current)]
                if any(p.repeat_type == GoalPlan.RepeatType.ONCE for p in matching_plans):
                    matching_plans = [p for p in matching_plans if p.repeat_type == GoalPlan.RepeatType.ONCE]
            goals_data = GoalPlanSerializer(matching_plans, many=True, context={'request': request}).data
            days.append({
                'date': current,
                'label': current.strftime('%A, %b %d'),
                'is_today': current == today,
                'is_future': current > today,
                'goals': enrich_goals(goals_data),
                'progress': DailyProgressSerializer(progress_by_date.get(current)).data if progress_by_date.get(current) else None,
                'logs': ExerciseLogSerializer(logs_by_date.get(current, []), many=True).data,
            })
            current += timedelta(days=1)
        return Response(days)


def get_champion_for_week(week_start, week_end):
    User = get_user_model()
    users = User.objects.filter(is_approved=True)
    best_user = None
    best_score = -999999
    
    from django.db.models import Avg, Sum
    for user in users:
        logs = ExerciseLog.objects.filter(user=user, date__range=[week_start, week_end])
        last_logs = ExerciseLog.objects.filter(user=user, date__range=[week_start - timedelta(days=7), week_end - timedelta(days=7)])
        
        avg_weight = logs.aggregate(val=Avg('weight_kg'))['val'] or 0
        last_avg_weight = last_logs.aggregate(val=Avg('weight_kg'))['val'] or 0
        
        reps_sum = logs.aggregate(val=Sum('reps'))['val'] or 0
        sets_sum = logs.aggregate(val=Sum('sets'))['val'] or 0
        
        diff = float(avg_weight) - float(last_avg_weight)
        score = (float(avg_weight) * reps_sum * sets_sum) + diff
        
        if score > best_score:
            best_score = score
            best_user = user
            
    return best_user


class IsNotTestUser(IsAuthenticated):
    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        if getattr(request.user, 'is_test_user', False):
            return False
        return True

class LogCSVTemplateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="exercise_logs_template.csv"'
        
        writer = csv.writer(response)
        writer.writerow(['Date (YYYY-MM-DD)', 'Exercise Name', 'Weight (kg)', 'Sets', 'Reps', 'Notes'])
        
        # Add one row of example
        writer.writerow([timezone.localdate().isoformat(), 'Bench Press', '60', '3', '10', 'Good form'])
        
        return response

class LogCSVUploadViewSet(viewsets.ModelViewSet):
    serializer_class = LogCSVUploadSerializer
    permission_classes = [IsNotTestUser]
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        return LogCSVUpload.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class ExerciseCSVUploadViewSet(viewsets.ModelViewSet):
    serializer_class = ExerciseCSVUploadSerializer
    permission_classes = [IsNotTestUser]
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        return ExerciseCSVUpload.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class ExportCSVView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        now = timezone.now()
        yesterday = now - timedelta(days=1)
        has_approved = CSVRequest.objects.filter(user=request.user, is_approved=True, approved_at__gte=yesterday).exists()
        if not has_approved:
            return Response({'detail': 'You do not have an approved CSV request within the last 24 hours.'}, status=403)

        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="gym_data.csv"'
        
        writer = csv.writer(response)
        writer.writerow(['Date', 'Exercise', 'Category', 'Weight (kg)', 'Duration', 'Sets', 'Reps', 'Notes'])
        
        logs = ExerciseLog.objects.filter(user=request.user).select_related('exercise').order_by('date', 'created_at')
        for log in logs:
            writer.writerow([
                log.date,
                log.exercise.name,
                log.exercise.category,
                log.weight_kg,
                log.duration,
                log.sets,
                log.reps,
                log.notes
            ])
            
        return response

class CSVRequestViewSet(viewsets.ModelViewSet):
    serializer_class = CSVRequestSerializer
    permission_classes = [IsNotTestUser]
    
    def get_queryset(self):
        return CSVRequest.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        CSVRequest.objects.filter(user=self.request.user, is_approved=False).delete()
        serializer.save(user=self.request.user)

class NotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)

class LeaderboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = timezone.localdate()
        week_start = today - timedelta(days=today.weekday())
        week_end = week_start + timedelta(days=6)

        from .leaderboard import get_leaderboard_data
        data = get_leaderboard_data()

        last_week_start = week_start - timedelta(days=7)
        last_week_end = week_end - timedelta(days=7)
        champion = get_champion_for_week(last_week_start, last_week_end)

        champion_data = None
        if champion and champion.leaderboard_message_approved:
            if champion.leaderboard_message_week == week_start:
                champion_data = {
                    'name': champion.name,
                    'message': champion.leaderboard_message,
                    'profile_pic_url': champion.profile_pic_url
                }

        return Response({
            'champion_id': champion.id if champion else None,
            'champion_name': champion.name if champion else None,
            'champion_link': getattr(champion.preferences, 'recommended_link', '') if champion else '',
            'champion_message': champion_data,
            'leaderboard': data
        })
