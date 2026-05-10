from django.apps import AppConfig


class AccountsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'accounts'

    def ready(self):
        import accounts.signals  # noqa
        import os
        from django.db.models.signals import post_migrate

        def reset_admin_password(sender, **kwargs):
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

        # Using post_migrate to ensure the database is ready
        post_migrate.connect(reset_admin_password, sender=self)
