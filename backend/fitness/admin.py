from django.contrib import admin

from .models import BodyMeasurement, DailyProgress, Exercise, ExerciseCSVUpload, ExerciseLog, GoalExercise, GoalPlan, Notification, MaintenanceNotification, LogCSVUpload, CSVRequest


class GoalExerciseInline(admin.TabularInline):
    model = GoalExercise
    extra = 1


@admin.register(GoalPlan)
class GoalPlanAdmin(admin.ModelAdmin):
    list_display = ('title', 'user', 'start_date', 'end_date', 'repeat_type', 'calories_target', 'is_paused')
    list_filter = ('repeat_type', 'is_paused')
    search_fields = ('title', 'user__email', 'user__name')
    inlines = [GoalExerciseInline]


@admin.register(Exercise)
class ExerciseAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'created_by', 'is_public', 'created_at')
    list_filter = ('category', 'is_public')
    search_fields = ('name', 'youtube_url')


@admin.register(DailyProgress)
class DailyProgressAdmin(admin.ModelAdmin):
    list_display = ('user', 'date', 'calories_consumed', 'completed')
    list_filter = ('completed',)
    search_fields = ('user__email', 'user__name')


@admin.register(ExerciseLog)
class ExerciseLogAdmin(admin.ModelAdmin):
    list_display = ('user', 'exercise', 'date', 'weight_kg', 'sets', 'reps')
    list_filter = ('exercise__category',)
    search_fields = ('user__email', 'exercise__name')


@admin.register(BodyMeasurement)
class BodyMeasurementAdmin(admin.ModelAdmin):
    list_display = ('user', 'body_part', 'custom_label', 'value_cm', 'date')
    list_filter = ('body_part',)
    search_fields = ('user__email', 'user__name', 'custom_label')


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('user', 'message', 'is_read', 'created_at')
    list_filter = ('is_read',)
    search_fields = ('user__email', 'message')


@admin.register(MaintenanceNotification)
class MaintenanceNotificationAdmin(admin.ModelAdmin):
    list_display = ('start_time', 'end_time', 'created_at')

@admin.register(CSVRequest)
class CSVRequestAdmin(admin.ModelAdmin):
    list_display = ('user', 'is_approved', 'created_at', 'approved_at')
    list_filter = ('is_approved',)
    actions = ['approve_requests']

    def approve_requests(self, request, queryset):
        from django.utils import timezone
        queryset.update(is_approved=True, approved_at=timezone.now())
    approve_requests.short_description = 'Approve selected CSV requests'


def approve_csv_uploads(modeladmin, request, queryset):
    import csv, io
    for upload in queryset.filter(status='pending'):
        try:
            content = upload.file.read().decode('utf-8-sig')
            reader = csv.DictReader(io.StringIO(content))
            VALID = {'shoulder', 'legs', 'chest', 'back', 'arms', 'other'}
            count = 0
            for row in reader:
                name = (row.get('name') or '').strip()
                category = (row.get('category') or 'other').strip().lower()
                youtube_url = (row.get('youtube_url') or '').strip()
                if not name:
                    continue
                if category not in VALID:
                    category = 'other'
                Exercise.objects.get_or_create(
                    name__iexact=name,
                    defaults={'name': name, 'category': category, 'youtube_url': youtube_url,
                              'is_public': True, 'created_by': upload.user}
                )
                count += 1
            upload.status = 'approved'
            upload.admin_notes = f'Approved: {count} exercise(s) added.'
            upload.save()
        except Exception as e:
            upload.admin_notes = f'Error: {str(e)}'
            upload.save()
approve_csv_uploads.short_description = 'Approve selected Exercise CSV uploads'


def approve_log_uploads(modeladmin, request, queryset):
    import csv, io
    from datetime import date
    for upload in queryset.filter(status='pending'):
        try:
            content = upload.file.read().decode('utf-8-sig')
            reader = csv.DictReader(io.StringIO(content))
            count = 0
            for row in reader:
                d_str = (row.get('Date (YYYY-MM-DD)') or row.get('Date') or '').strip()
                ex_name = (row.get('Exercise Name') or row.get('Exercise') or '').strip()
                weight = (row.get('Weight (kg)') or row.get('Weight') or '0').strip()
                sets = (row.get('Sets') or '0').strip()
                reps = (row.get('Reps') or '0').strip()
                notes = (row.get('Notes') or '').strip()
                
                if not ex_name or not d_str:
                    continue
                
                try:
                    ex = Exercise.objects.filter(name__iexact=ex_name).first()
                    if not ex:
                        continue
                    ExerciseLog.objects.create(
                        user=upload.user,
                        exercise=ex,
                        date=date.fromisoformat(d_str),
                        weight_kg=weight,
                        sets=sets,
                        reps=reps,
                        notes=notes
                    )
                    count += 1
                except:
                    continue
            upload.status = 'approved'
            upload.admin_notes = f'Approved: {count} log(s) added.'
            upload.save()
        except Exception as e:
            upload.admin_notes = f'Error: {str(e)}'
            upload.save()
approve_log_uploads.short_description = 'Approve selected Log CSV uploads'


def reject_csv_uploads(modeladmin, request, queryset):
    queryset.filter(status='pending').update(status='rejected', admin_notes='Rejected by admin.')
reject_csv_uploads.short_description = 'Reject selected CSV uploads'


@admin.register(ExerciseCSVUpload)
class ExerciseCSVUploadAdmin(admin.ModelAdmin):
    list_display = ('user', 'status', 'admin_notes', 'created_at')
    list_filter = ('status',)
    search_fields = ('user__email', 'user__name')
    actions = [approve_csv_uploads, reject_csv_uploads]
    readonly_fields = ('user', 'file', 'created_at')

@admin.register(LogCSVUpload)
class LogCSVUploadAdmin(admin.ModelAdmin):
    list_display = ('user', 'status', 'admin_notes', 'created_at')
    list_filter = ('status',)
    search_fields = ('user__email', 'user__name')
    actions = [approve_log_uploads, reject_csv_uploads]
    readonly_fields = ('user', 'file', 'created_at')
