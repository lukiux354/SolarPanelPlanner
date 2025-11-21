from django.core.management.base import BaseCommand
from django.utils import timezone
from modules.solar.models import UserProfile


class Command(BaseCommand):
    help = "Deletes expired guest users and their data"

    def handle(self, *args, **options):
        # Find expired guest accounts
        expired_profiles = UserProfile.objects.filter(is_guest=True, expiry_date__lt=timezone.now())

        count = 0
        for profile in expired_profiles:
            user = profile.user
            self.stdout.write(f"Deleting guest user: {user.username}")
            # This will cascade delete the profile and all user's projects
            user.delete()
            count += 1

        # Also delete inactive guests (no activity for 14 days)
        inactive_date = timezone.now() - timezone.timedelta(days=14)
        inactive_profiles = UserProfile.objects.filter(is_guest=True, last_activity__lt=inactive_date)

        for profile in inactive_profiles:
            user = profile.user
            self.stdout.write(f"Deleting inactive guest user: {user.username}")
            user.delete()
            count += 1

        self.stdout.write(self.style.SUCCESS(f"Successfully deleted {count} expired guest users"))
