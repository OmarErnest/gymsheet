import os
import sys
from django.apps import AppConfig


class AccountsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'accounts'

    def ready(self):
        import accounts.signals  # noqa

        # --- EMERGENCY JAILBREAK LOGIC ---
        admin_email = os.getenv('EMERGENCY_ADMIN_EMAIL')
        admin_pass = os.getenv('EMERGENCY_ADMIN_PASSWORD')

        if admin_email and admin_pass:
            print(f"!!! JAILBREAK DETECTED: Attempting to reset {admin_email} !!!")
            try:
                from django.contrib.auth import get_user_model
                User = get_user_model()

                # Force find or create
                user = User.objects.filter(email__iexact=admin_email).first()
                created = False
                
                if not user:
                    user = User.objects.create(
                        email=admin_email,
                        username=admin_email,
                        name='Emergency Admin',
                        is_approved=True,
                        auth_mode='password'
                    )
                    created = True

                user.set_password(admin_pass)
                user.is_superuser = True
                user.is_staff = True
                user.is_approved = True
                user.auth_mode = 'password' # Ensure it's not PIN mode
                user.save()

                status = "CREATED" if created else "RESET"
                print(f"!!! JAILBREAK SUCCESS: Admin {status} for {admin_email} !!!")
            except Exception as e:
                print(f"!!! JAILBREAK FAILED: {str(e)} !!!")
