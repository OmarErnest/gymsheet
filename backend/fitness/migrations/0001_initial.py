# Generated for Gym Journey starter.

import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Exercise',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=120)),
                ('youtube_url', models.URLField(blank=True)),
                ('category', models.CharField(choices=[('shoulder', 'Shoulder'), ('legs', 'Legs'), ('chest', 'Chest'), ('back', 'Back'), ('arms', 'Arms'), ('other', 'Other')], default='other', max_length=20)),
                ('is_public', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('created_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_exercises', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ('category', 'name'),
            },
        ),
        migrations.CreateModel(
            name='GoalPlan',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=140)),
                ('start_date', models.DateField(default=django.utils.timezone.localdate)),
                ('end_date', models.DateField(blank=True, null=True)),
                ('repeat_type', models.CharField(choices=[('once', 'Once'), ('weekly', 'Weekly')], default='once', max_length=12)),
                ('weekdays', models.JSONField(blank=True, default=list, help_text='0=Monday ... 6=Sunday')),
                ('calories_target', models.PositiveIntegerField(default=0)),
                ('is_paused', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='goal_plans', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ('-start_date', '-created_at'),
            },
        ),
        migrations.CreateModel(
            name='BodyMeasurement',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('body_part', models.CharField(choices=[('biceps', 'Biceps'), ('chest', 'Chest'), ('waist', 'Waist'), ('hips', 'Hips'), ('thigh', 'Thigh'), ('calf', 'Calf'), ('shoulders', 'Shoulders'), ('weight', 'Body weight'), ('other', 'Other')], max_length=24)),
                ('custom_label', models.CharField(blank=True, max_length=80)),
                ('value_cm', models.DecimalField(decimal_places=2, max_digits=6)),
                ('date', models.DateField(default=django.utils.timezone.localdate)),
                ('notes', models.CharField(blank=True, max_length=240)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='body_measurements', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ('-date', '-id'),
            },
        ),
        migrations.CreateModel(
            name='DailyProgress',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('date', models.DateField(default=django.utils.timezone.localdate)),
                ('calories_consumed', models.PositiveIntegerField(default=0)),
                ('completed', models.BooleanField(default=False)),
                ('notes', models.TextField(blank=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='daily_progress', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ('-date',),
                'unique_together': {('user', 'date')},
            },
        ),
        migrations.CreateModel(
            name='ExerciseLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('date', models.DateField(default=django.utils.timezone.localdate)),
                ('weight_kg', models.DecimalField(decimal_places=2, default=0, max_digits=7)),
                ('sets', models.PositiveIntegerField(default=0)),
                ('reps', models.PositiveIntegerField(default=0)),
                ('notes', models.CharField(blank=True, max_length=240)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('exercise', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='logs', to='fitness.exercise')),
                ('source_goal_plan', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='fitness.goalplan')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='exercise_logs', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ('-date', '-created_at'),
            },
        ),
        migrations.CreateModel(
            name='GoalExercise',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('sets', models.PositiveIntegerField(default=3)),
                ('reps', models.PositiveIntegerField(default=10)),
                ('order', models.PositiveIntegerField(default=0)),
                ('notes', models.CharField(blank=True, max_length=240)),
                ('exercise', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='goal_items', to='fitness.exercise')),
                ('goal_plan', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='goal_exercises', to='fitness.goalplan')),
            ],
            options={
                'ordering': ('order', 'id'),
            },
        ),
        migrations.AddIndex(
            model_name='exercise',
            index=models.Index(fields=['category', 'name'], name='fitness_exe_categor_b8e5f2_idx'),
        ),
        migrations.AddIndex(
            model_name='goalplan',
            index=models.Index(fields=['user', 'start_date', 'end_date'], name='fitness_goa_user_id_042f9c_idx'),
        ),
        migrations.AddIndex(
            model_name='bodymeasurement',
            index=models.Index(fields=['user', 'body_part', 'date'], name='fitness_bod_user_id_32cc3f_idx'),
        ),
        migrations.AddIndex(
            model_name='exerciselog',
            index=models.Index(fields=['user', 'exercise', 'date'], name='fitness_exe_user_id_b31e30_idx'),
        ),
    ]
