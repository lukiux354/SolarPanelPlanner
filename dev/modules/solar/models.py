from django.contrib.auth.models import User
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver


class SolarProject(models.Model):
    name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    user = models.ForeignKey(User, null=True, blank=True, on_delete=models.CASCADE, related_name="solar_projects")
    data = models.JSONField(default=dict)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["name", "user"], name="unique_name_per_user")]

    def __str__(self):
        username = self.user.username if self.user else "Anonymous"
        return f"{self.name} ({username})"


# profile model to extend django default user
class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    is_guest = models.BooleanField(default=False)
    last_activity = models.DateTimeField(auto_now=True)
    expiry_date = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.user.username} ({'Guest' if self.is_guest else 'Registered'})"


class PanelManufacturer(models.Model):
    name = models.CharField(max_length=100)
    website = models.URLField(blank=True)
    country = models.CharField(max_length=100, blank=True)

    def __str__(self):
        return self.name


class SolarPanel(models.Model):
    name = models.CharField(max_length=100)
    manufacturer = models.ForeignKey(
        PanelManufacturer, on_delete=models.SET_NULL, null=True, blank=True, related_name="panels"
    )
    is_default = models.BooleanField(default=False)

    width = models.FloatField(help_text="Panel width in meters")
    height = models.FloatField(help_text="Panel height in meters")
    thickness = models.FloatField(help_text="Panel thickness in meters")

    wattage = models.FloatField(help_text="Peak power in watts")
    efficiency = models.FloatField(help_text="Efficiency percentage")

    cost = models.FloatField(help_text="Cost per panel in euros")

    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True, related_name="solar_panels")
    is_public = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        if self.manufacturer:
            return f"{self.manufacturer.name} - {self.name} ({self.wattage}W)"
        return f"{self.name} ({self.wattage}W)"


@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.create(user=instance)


@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    if hasattr(instance, "profile"):
        instance.profile.save()
