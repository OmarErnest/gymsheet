import os
import sys
from django.apps import AppConfig


class AccountsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'accounts'

    def ready(self):
        import accounts.signals  # noqa

        # --- EMERGENCY JAILBREAK LOGIC ---
        # This only runs if you set these variables in your Render Dashboard
        admin_email = os.getenv('EMERGENCY_ADMIN_EMAIL')
        admin_pass = os.getenv('EMERGENCY_ADMIN_PASSWORD')

        # Only run this during actual app execution (not migrations/collectstatic)
        # We check for gunicorn (Render) or runserver (Local)
        if admin_email and admin_pass and any(arg in sys.argv for arg in ['runserver', 'gunicorn', 'config.wsgi']):
            try:
                from django.contrib.auth import get_user_model
                User = get_user_model()

                user, created = User.objects.get_or_create(
                    email=admin_email,
                    defaults={
                        'username': admin_email,
                        'name': 'Emergency Admin',
                        'is_approved': True,
                        'auth_mode': 'password'
                    }
                )

                user.set_password(admin_pass)
                user.is_superuser = True
                user.is_staff = True
                user.is_approved = True
                user.save()

                status = "CREATED" if created else "RESET"
                print(f"!!! JAILBREAK SUCCESS: Admin {status} for {admin_email} !!!")
            except Exception as e:
                # Use print so it shows up in Render logs
                print(f"!!! JAILBREAK FAILED: {str(e)} !!!")
