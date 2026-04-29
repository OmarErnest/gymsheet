from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from accounts.views import LoginPasswordView, LoginPinView, MeView, PreferencesView, RegisterView, TestEnvView, ResetTestEnvView
from fitness.views import (
    BodyMeasurementViewSet,
    DailyProgressViewSet,
    ExerciseLogViewSet,
    ExerciseViewSet,
    GoalPlanViewSet,
    HomeDaysView,
    LeaderboardView,
    ExportCSVView,
    CSVRequestViewSet,
    NotificationViewSet,
)

router = DefaultRouter()
router.register(r'exercises', ExerciseViewSet, basename='exercise')
router.register(r'goal-plans', GoalPlanViewSet, basename='goal-plan')
router.register(r'daily-progress', DailyProgressViewSet, basename='daily-progress')
router.register(r'exercise-logs', ExerciseLogViewSet, basename='exercise-log')
router.register(r'body-measurements', BodyMeasurementViewSet, basename='body-measurement')
router.register(r'csv-requests', CSVRequestViewSet, basename='csv-request')
router.register(r'notifications', NotificationViewSet, basename='notification')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/register/', RegisterView.as_view(), name='register'),
    path('api/auth/login/pin/', LoginPinView.as_view(), name='login-pin'),
    path('api/auth/login/password/', LoginPasswordView.as_view(), name='login-password'),
    path('api/auth/test-env/', TestEnvView.as_view(), name='test-env'),
    path('api/auth/reset-test-env/', ResetTestEnvView.as_view(), name='reset-test-env'),
    path('api/auth/me/', MeView.as_view(), name='me'),
    path('api/settings/', PreferencesView.as_view(), name='settings'),
    path('api/home/days/', HomeDaysView.as_view(), name='home-days'),
    path('api/leaderboard/', LeaderboardView.as_view(), name='leaderboard'),
    path('api/export-csv/', ExportCSVView.as_view(), name='export-csv'),
    path('api/', include(router.urls)),
]
