import uuid
from datetime import timedelta

from django.contrib.auth import login
from django.contrib.auth.models import User
from django.utils import timezone


def get_or_create_guest_user(request):
    """Get existing guest user or create a new one"""
    guest_user_id = request.session.get("guest_user_id")

    if guest_user_id:
        try:

            user = User.objects.get(id=guest_user_id)

            user.profile.last_activity = timezone.now()
            user.profile.save()

            if not request.user.is_authenticated:
                login(request, user)

            return user
        except User.DoesNotExist:
            pass

    #new guest user with a random username
    username = f"guest_{uuid.uuid4().hex[:8]}"
    random_password = uuid.uuid4().hex
    guest_user = User.objects.create_user(username=username, email="", password=random_password)

    # guest flag and expiry
    profile = guest_user.profile
    profile.is_guest = True
    profile.expiry_date = timezone.now() + timedelta(days=7)
    profile.save()

    # store in session and log in the user
    request.session["guest_user_id"] = guest_user.id
    login(request, guest_user)

    return guest_user


def convert_guest_to_registered(guest_user, username, email, password):
    """Convert a guest user to a registered user"""
    if not guest_user.profile.is_guest:
        return False

    guest_user.username = username
    guest_user.email = email
    guest_user.set_password(password)
    guest_user.save()

    profile = guest_user.profile
    profile.is_guest = False
    profile.expiry_date = None
    profile.save()

    return True
