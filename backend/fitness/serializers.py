from datetime import datetime

from rest_framework import serializers

from .models import BodyMeasurement, DailyProgress, Exercise, ExerciseLog, GoalExercise, GoalPlan, CSVRequest, Notification

class CSVRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = CSVRequest
        fields = ('id', 'user', 'is_approved', 'created_at', 'approved_at')
        read_only_fields = ('id', 'user', 'created_at', 'approved_at')

class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ('id', 'user', 'message', 'is_read', 'created_at')
        read_only_fields = ('id', 'user', 'created_at')



class ExerciseSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.name', read_only=True)

    class Meta:
        model = Exercise
        fields = ('id', 'name', 'youtube_url', 'category', 'is_public', 'is_time_based', 'created_by', 'created_by_name', 'created_at')
        read_only_fields = ('id', 'created_by', 'created_by_name', 'created_at')


class GoalExerciseSerializer(serializers.ModelSerializer):
    exercise_detail = ExerciseSerializer(source='exercise', read_only=True)

    class Meta:
        model = GoalExercise
        fields = ('id', 'exercise', 'exercise_detail', 'sets', 'reps', 'duration', 'order', 'notes')
        read_only_fields = ('id',)


class GoalPlanSerializer(serializers.ModelSerializer):
    goal_exercises = GoalExerciseSerializer(many=True, required=False)
    repeat_weeks = serializers.IntegerField(write_only=True, required=False, allow_null=True, min_value=1)

    class Meta:
        model = GoalPlan
        fields = (
            'id', 'title', 'start_date', 'end_date', 'repeat_type', 'weekdays',
            'repeat_weeks', 'calories_target', 'is_paused', 'goal_exercises', 'created_at'
        )
        read_only_fields = ('id', 'created_at')

    def validate_goal_exercises(self, value):
        if len(value) > 10:
            raise serializers.ValidationError("A goal can store a maximum of 10 exercises.")
        return value

    def validate_weekdays(self, value):
        if value in (None, ''):
            return []
        if not isinstance(value, list):
            raise serializers.ValidationError('Weekdays must be a list of numbers from 0 to 6.')
        for item in value:
            if int(item) < 0 or int(item) > 6:
                raise serializers.ValidationError('Weekdays must be between 0 and 6.')
        return [int(item) for item in value]

    def create(self, validated_data):
        exercises_data = validated_data.pop('goal_exercises', [])
        repeat_weeks = validated_data.pop('repeat_weeks', None)
        if repeat_weeks and not validated_data.get('end_date'):
            validated_data['end_date'] = GoalPlan.end_date_from_weeks(validated_data['start_date'], repeat_weeks)
        plan = GoalPlan.objects.create(user=self.context['request'].user, **validated_data)
        for idx, item in enumerate(exercises_data):
            item.setdefault('order', idx)
            GoalExercise.objects.create(goal_plan=plan, **item)
        return plan

    def update(self, instance, validated_data):
        exercises_data = validated_data.pop('goal_exercises', None)
        repeat_weeks = validated_data.pop('repeat_weeks', None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        if repeat_weeks and not instance.end_date:
            instance.end_date = GoalPlan.end_date_from_weeks(instance.start_date, repeat_weeks)
        instance.save()
        if exercises_data is not None:
            instance.goal_exercises.all().delete()
            for idx, item in enumerate(exercises_data):
                item.setdefault('order', idx)
                GoalExercise.objects.create(goal_plan=instance, **item)
        return instance


class DailyProgressSerializer(serializers.ModelSerializer):
    class Meta:
        model = DailyProgress
        fields = ('id', 'date', 'calories_consumed', 'completed', 'notes')
        read_only_fields = ('id',)

    def create(self, validated_data):
        obj, _ = DailyProgress.objects.update_or_create(
            user=self.context['request'].user,
            date=validated_data['date'],
            defaults=validated_data,
        )
        return obj


class ExerciseLogSerializer(serializers.ModelSerializer):
    exercise_detail = ExerciseSerializer(source='exercise', read_only=True)

    class Meta:
        model = ExerciseLog
        fields = ('id', 'exercise', 'exercise_detail', 'date', 'weight_kg', 'duration', 'sets', 'reps', 'source_goal_plan', 'notes', 'created_at')
        read_only_fields = ('id', 'created_at')

    def validate_date(self, value):
        from django.utils import timezone
        if value > timezone.localdate():
            raise serializers.ValidationError("You cannot log exercises for future dates.")
        return value

    def validate_weight_kg(self, value):
        """Accept empty string or None — coerce to 0 for time-based exercises."""
        if value is None or value == '':
            return 0
        return value

    def validate_duration(self, value):
        """Accept None or empty string."""
        if value is None:
            return ''
        return value

    def create(self, validated_data):
        return ExerciseLog.objects.create(**validated_data)


class BodyMeasurementSerializer(serializers.ModelSerializer):
    class Meta:
        model = BodyMeasurement
        fields = ('id', 'body_part', 'custom_label', 'value_cm', 'date', 'notes')
        read_only_fields = ('id',)

    def create(self, validated_data):
        return BodyMeasurement.objects.create(user=self.context['request'].user, **validated_data)


class HomeGoalPlanSerializer(GoalPlanSerializer):
    class Meta(GoalPlanSerializer.Meta):
        fields = GoalPlanSerializer.Meta.fields


class HomeDaySerializer(serializers.Serializer):
    date = serializers.DateField()
    label = serializers.CharField()
    is_today = serializers.BooleanField()
    is_future = serializers.BooleanField()
    goals = HomeGoalPlanSerializer(many=True)
    progress = DailyProgressSerializer(allow_null=True)
    logs = ExerciseLogSerializer(many=True)
