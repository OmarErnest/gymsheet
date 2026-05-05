from django.db import migrations

def set_beta_tester(apps, schema_editor):
    User = apps.get_model('accounts', 'User')
    try:
        # Update Dummy
        dummy = User.objects.get(name='Dummy')
        dummy.is_test_user = True
        dummy.save()
        
        # Remove old test user
        User.objects.filter(name='bc909c').delete()
    except User.DoesNotExist:
        pass

class Migration(migrations.Migration):
    dependencies = [
        ('accounts', '0009_remove_user_leaderboard_message_and_more'),
    ]

    operations = [
        migrations.RunPython(set_beta_tester),
    ]
