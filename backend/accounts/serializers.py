from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import User, UserPreference


class UserPublicSerializer(serializers.ModelSerializer):
    current_rank = serializers.SerializerMethodField()
    has_link = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ('id', 'email', 'name', 'profile_pic_url', 'profile_pic_url_pending', 'gender', 'auth_mode', 'is_approved', 'current_rank', 'has_link')
        read_only_fields = ('id', 'is_approved')

    def get_current_rank(self, obj):
        from fitness.leaderboard import get_leaderboard_data
        data = get_leaderboard_data()
        user_info = next((u for u in data if u['id'] == obj.id), None)
        return user_info['rank'] if user_info else None

    def get_has_link(self, obj):
        return bool(getattr(obj.preferences, 'recommended_link', ''))


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
    profile_pic_url_pending = serializers.CharField(source='user.profile_pic_url_pending', required=False, allow_blank=True)

    class Meta:
        model = UserPreference
        fields = ('theme', 'language', 'goals_paused', 'font_size', 'auth_mode', 'new_pin', 'new_password', 'leaderboard_message', 'height_cm', 'weight_kg', 'recommended_link', 'profile_pic_url_pending')

    def validate(self, attrs):
        import re
        user_data = attrs.get('user', {})
        auth_mode = user_data.get('auth_mode')
        new_pin = attrs.get('new_pin', '')
        new_password = attrs.get('new_password', '')
        recommended_link = attrs.get('recommended_link', '')
        if auth_mode == User.AuthMode.PIN and new_pin:
            if not new_pin.isdigit() or len(new_pin) != 6:
                raise serializers.ValidationError({'new_pin': 'PIN must be exactly 6 digits.'})
        if auth_mode == User.AuthMode.PASSWORD and new_password:
            validate_password(new_password)
        if recommended_link:
            allowed = re.compile(
                r'^https?://(www\.)?(youtube\.com|youtu\.be|music\.youtube\.com|open\.spotify\.com'
                r'|mercadolibre\.com(\.\w+)?|amazon\.com(\.\w+)?|amazon\.\w{2,3})'
            )
            if not allowed.match(recommended_link):
                raise serializers.ValidationError({'recommended_link': 'Only YouTube, Spotify, MercadoLibre, and Amazon links are allowed.'})
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
        if 'profile_pic_url_pending' in user_data:
            user.profile_pic_url_pending = user_data['profile_pic_url_pending']
        if new_pin:
            user.set_pin(new_pin)
        if new_password:
            user.set_password(new_password)
        user.save()
        return instance
