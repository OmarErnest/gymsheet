from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import User, UserPreference


class UserPublicSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'email', 'name', 'profile_pic_url', 'gender', 'auth_mode', 'is_approved')
        read_only_fields = ('id', 'is_approved')


class RegisterSerializer(serializers.ModelSerializer):
    pin = serializers.CharField(write_only=True, required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ('email', 'name', 'profile_pic_url', 'gender', 'auth_mode', 'pin', 'password')

    def validate(self, attrs):
        auth_mode = attrs.get('auth_mode', User.AuthMode.PIN)
        pin = attrs.get('pin', '')
        password = attrs.get('password', '')
        if auth_mode == User.AuthMode.PIN:
            if not pin or not pin.isdigit() or len(pin) != 6:
                raise serializers.ValidationError({'pin': 'PIN must be exactly 6 digits.'})
        if auth_mode == User.AuthMode.PASSWORD:
            if not password:
                raise serializers.ValidationError({'password': 'Password is required.'})
            validate_password(password)
        return attrs

    def create(self, validated_data):
        pin = validated_data.pop('pin', '')
        password = validated_data.pop('password', '')
        user = User(**validated_data)
        user.username = user.email
        user.is_approved = False
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        if pin:
            user.set_pin(pin)
        user.save()
        return user


class LoginPinSerializer(serializers.Serializer):
    email = serializers.EmailField()
    pin = serializers.CharField(min_length=6, max_length=6)


class LoginPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField()


class UserPreferenceSerializer(serializers.ModelSerializer):
    auth_mode = serializers.ChoiceField(choices=User.AuthMode.choices, source='user.auth_mode', required=False)
    leaderboard_message = serializers.CharField(source='user.leaderboard_message', required=False, allow_blank=True)
    new_pin = serializers.CharField(write_only=True, required=False, allow_blank=True)
    new_password = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = UserPreference
        fields = ('theme', 'language', 'goals_paused', 'font_size', 'auth_mode', 'new_pin', 'new_password', 'leaderboard_message', 'height_cm', 'weight_kg')

    def validate(self, attrs):
        user_data = attrs.get('user', {})
        auth_mode = user_data.get('auth_mode')
        new_pin = attrs.get('new_pin', '')
        new_password = attrs.get('new_password', '')
        if auth_mode == User.AuthMode.PIN and new_pin:
            if not new_pin.isdigit() or len(new_pin) != 6:
                raise serializers.ValidationError({'new_pin': 'PIN must be exactly 6 digits.'})
        if auth_mode == User.AuthMode.PASSWORD and new_password:
            validate_password(new_password)
        return attrs

    def update(self, instance, validated_data):
        user_data = validated_data.pop('user', {})
        new_pin = validated_data.pop('new_pin', '')
        new_password = validated_data.pop('new_password', '')
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()

        user = instance.user
        if 'auth_mode' in user_data:
            user.auth_mode = user_data['auth_mode']
        if 'leaderboard_message' in user_data:
            user.leaderboard_message = user_data['leaderboard_message']
        if new_pin:
            user.set_pin(new_pin)
        if new_password:
            user.set_password(new_password)
        user.save()
        return instance
