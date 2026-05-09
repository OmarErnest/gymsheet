from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User
from .serializers import (
    LoginPasswordSerializer,
    LoginPinSerializer,
    RegisterSerializer,
    UserPreferenceSerializer,
    UserPublicSerializer,
)
import uuid
from fitness.badges import check_all_relevant_badges
from fitness.serializers import UserBadgeSerializer


def token_payload(user):
    refresh = RefreshToken.for_user(user)
    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
        'user': UserPublicSerializer(user).data,
    }


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(
            {
                'message': 'Account created. An admin must approve it before login.',
                'user': UserPublicSerializer(user).data,
            },
            status=status.HTTP_201_CREATED,
        )


class TestEnvView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = "dummy@gym.sheet"
        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                'username': email,
                'name': 'Dummy Tester',
                'is_approved': True,
                'is_test_user': True,
                'auth_mode': User.AuthMode.PIN
            }
        )
        if created:
            user.set_unusable_password()
            user.save()
            
            from .models import UserPreference
            UserPreference.objects.get_or_create(user=user)

        return Response(token_payload(user))


class ResetTestEnvView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not request.user.is_superuser:
            return Response({'detail': 'Not admin'}, status=status.HTTP_403_FORBIDDEN)
        
        try:
            dummy = User.objects.get(email="dummy@gym.sheet")
            # Delete data
            from fitness.models import ExerciseLog, GoalPlan, DailyProgress, BodyMeasurement
            ExerciseLog.objects.filter(user=dummy).delete()
            GoalPlan.objects.filter(user=dummy).delete()
            DailyProgress.objects.filter(user=dummy).delete()
            BodyMeasurement.objects.filter(user=dummy).delete()
            return Response({'message': 'Public Beta Environment reset successfully.'})
        except User.DoesNotExist:
            return Response({'detail': 'Test user does not exist yet.'}, status=status.HTTP_404_NOT_FOUND)


class LoginPinView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginPinSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email'].lower()
        pin = serializer.validated_data['pin']
        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            return Response({'detail': 'Invalid credentials.'}, status=status.HTTP_400_BAD_REQUEST)
        
        if not user.is_approved:
            return Response({'detail': 'Account is waiting for admin approval.'}, status=status.HTTP_403_FORBIDDEN)
        
        # Bypass for dummy user
        if email == "dummy@gym.sheet":
            return Response(token_payload(user))
            
        if not user.check_pin(pin):
            return Response({'detail': 'Invalid credentials.'}, status=status.HTTP_400_BAD_REQUEST)
        return Response(token_payload(user))


class LoginPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email'].lower()
        password = serializer.validated_data['password']
        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            return Response({'detail': 'Invalid credentials.'}, status=status.HTTP_400_BAD_REQUEST)
        
        if not user.is_approved:
            return Response({'detail': 'Account is waiting for admin approval.'}, status=status.HTTP_403_FORBIDDEN)
        
        # Bypass for dummy user
        if email == "dummy@gym.sheet":
            return Response(token_payload(user))

        if not user.check_password(password):
            return Response({'detail': 'Invalid credentials.'}, status=status.HTTP_400_BAD_REQUEST)
        return Response(token_payload(user))


class MeView(APIView):
    def get(self, request):
        return Response(UserPublicSerializer(request.user).data)

    def patch(self, request):
        serializer = UserPublicSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        
        # Badge check for profile picture
        newly_earned = check_all_relevant_badges(request.user, 'profile')
        data = serializer.data
        if newly_earned:
            data['new_badges'] = UserBadgeSerializer(newly_earned, many=True).data
            
        return Response(data)


class PreferencesView(APIView):
    def get(self, request):
        return Response(UserPreferenceSerializer(request.user.preferences).data)

    def patch(self, request):
        serializer = UserPreferenceSerializer(request.user.preferences, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(UserPreferenceSerializer(request.user.preferences).data)


class UserListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not request.user.is_staff:
            return Response({'detail': 'Admin only.'}, status=status.HTTP_403_FORBIDDEN)
        users = User.objects.all().order_by('name')
        return Response(UserPublicSerializer(users, many=True).data)
class TakenIconsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Get all non-empty icons currently in use
        icons = User.objects.exclude(profile_pic_url='').values_list('profile_pic_url', flat=True).distinct()
        return Response(list(icons))
