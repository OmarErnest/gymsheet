from django.db import migrations

def populate_badges(apps, schema_editor):
    Badge = apps.get_model('fitness', 'Badge')
    badges = [
        {
            'slug': 'first_step',
            'name': 'The First Step',
            'description': 'Completed and saved your first exercise.',
            'icon_name': 'first_step.png',
            'dbz_message': "Your journey of a thousand miles begins with a single rep! I can feel your power growing!"
        },
        {
            'slug': 'record_breaker',
            'name': 'Beyond the Limit',
            'description': 'Successfully beat 100 personal records.',
            'icon_name': 'record_breaker.png',
            'dbz_message': "You've surpassed the level of a Super Saiyan! Your limits are meant to be broken!"
        },
        {
            'slug': 'perfectionist',
            'name': 'Legendary Discipline',
            'description': 'Completed all scheduled exercises for a full week.',
            'icon_name': 'perfectionist.png',
            'dbz_message': "This focus... this intensity! You've mastered the art of training like a god!"
        },
        {
            'slug': 'champion',
            'name': 'Strongest Under the Heavens',
            'description': 'Reached the #1 spot on the community leaderboard.',
            'icon_name': 'champion.png',
            'dbz_message': "Behold! The new champion of the World Martial Arts Tournament has arrived!"
        },
        {
            'slug': 'messenger',
            'name': 'Galactic Communiqué',
            'description': 'Sent your first message to the administration.',
            'icon_name': 'messenger.png',
            'dbz_message': "Sending a message across the galaxy? Even King Kai is impressed by your initiative!"
        },
        {
            'slug': 'style_master',
            'name': 'New Form Unlocked',
            'description': 'Customized your profile with a new picture.',
            'icon_name': 'style_master.png',
            'dbz_message': "A new transformation? You're looking like a true warrior now!"
        },
        {
            'slug': 'gravity_defier',
            'name': 'High Gravity Training',
            'description': 'Mastered your own body weight with calisthenics.',
            'icon_name': 'gravity_defier.png',
            'dbz_message': "Training in 100x gravity? Your body is becoming a weapon of pure strength!"
        },
    ]
    for b_data in badges:
        Badge.objects.create(**b_data)

def rollback_badges(apps, schema_editor):
    Badge = apps.get_model('fitness', 'Badge')
    Badge.objects.filter(slug__in=[
        'first_step', 'record_breaker', 'perfectionist', 'champion', 
        'messenger', 'style_master', 'gravity_defier'
    ]).delete()

class Migration(migrations.Migration):
    dependencies = [
        ('fitness', '0017_badge_userbadge'),
    ]
    operations = [
        migrations.RunPython(populate_badges, rollback_badges),
    ]
