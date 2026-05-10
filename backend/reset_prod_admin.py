import os
import django
import sys

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import get_user_model

User = get_user_model()

def reset_password(username, new_password):
    try:
        user = User.objects.get(username=username)
        user.set_password(new_password)
        user.save()
        print(f"SUCCESS: Password for user '{username}' has been reset.")
        
        # Ensure they are superuser if they forgot admin password
        if not user.is_superuser or not user.is_staff:
            user.is_superuser = True
            user.is_staff = True
            user.save()
            print(f"INFO: User '{username}' promoted to Superuser/Staff.")
            
    except User.DoesNotExist:
        print(f"ERROR: User '{username}' not found.")
    except Exception as e:
        print(f"ERROR: {str(e)}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python reset_prod_admin.py <username> <new_password>")
    else:
        reset_password(sys.argv[1], sys.argv[2])
