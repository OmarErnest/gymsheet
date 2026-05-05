import os
import django

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from accounts.models import User

def update_test_user():
    try:
        # Update Dummy
        dummy = User.objects.get(name='Dummy')
        dummy.is_test_user = True
        dummy.save()
        print("SUCCESS: 'Dummy' user updated to Beta Tester.")
        
        # Ensure bc909c is removed (just in case it still exists in prod)
        User.objects.filter(name='bc909c').delete()
        print("SUCCESS: Old test user 'bc909c' removed if it existed.")
        
    except User.DoesNotExist:
        print("ERROR: User 'Dummy' not found. Please check the name in your production database.")
    except Exception as e:
        print(f"ERROR: {str(e)}")

if __name__ == "__main__":
    update_test_user()
