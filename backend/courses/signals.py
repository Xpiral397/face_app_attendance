from django.db.models.signals import post_migrate
from django.dispatch import receiver
from django.core.management import call_command
from courses.models import Department

@receiver(post_migrate)
def setup_dummy_data(sender, **kwargs):
    if sender.name == 'courses':
        # Check if dummy data already exists
        if not Department.objects.exists():
            call_command('setup_dummy_data') 