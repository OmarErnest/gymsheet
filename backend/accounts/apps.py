from django.apps import AppConfig


class AccountsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'accounts'

    def ready(self):
        import accounts.signals  # noqa
        import os
        import sys

        # Only run this if we're actually running a server, not just a management command
        if 'runserver' in sys.argv or 'gunicorn' in sys.argv or 'config.wsgi' in sys.argv:
            email = os.environ.get('EMERGENCY_ADMIN_EMAIL')
            password = os.environ.get('EMERGENCY_ADMIN_PASSWORD')
            
            if email and password:
                from django.contrib.auth import get_user_model
                User = get_user_model()
                try:
                    user = User.objects.filter(email=email).first()
                    if user:
                        user.set_password(password)
                        user.is_superuser = True
                        user.is_staff = True
                        user.save()
                        print(f"EMERGENCY: Password reset successful for {email}")
                    else:
                        User.objects.create_superuser(
                            email=email,
                            username=email,
                            password=password,
                            name="Admin"
                        )
                        print(f"EMERGENCY: Created new superuser {email}")
                except Exception as e:
                    print(f"EMERGENCY error: {e}")
            else:
                print("EMERGENCY: Env variables missing. Skipping jailbreak.")
