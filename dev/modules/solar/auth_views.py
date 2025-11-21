from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.http import JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_POST

from .guest_user import convert_guest_to_registered


@require_POST
def ajax_login(request):
    """Handle AJAX login requests"""
    username = request.POST.get("username", "")
    password = request.POST.get("password", "")

    user = authenticate(request, username=username, password=password)

    if user is not None:
        login(request, user)
        return JsonResponse({"success": True, "username": user.username})
    else:
        return JsonResponse({"success": False, "error": "Invalid username or password."}, status=400)


@require_POST
def ajax_register(request):
    """Handle AJAX registration requests"""
    username = request.POST.get("username", "")
    email = request.POST.get("email", "")
    password1 = request.POST.get("password1", "")
    password2 = request.POST.get("password2", "")

    # basic validation
    if not username or not email or not password1:
        return JsonResponse({"success": False, "error": "All fields are required."}, status=400)

    if password1 != password2:
        return JsonResponse({"success": False, "error": "Passwords do not match."}, status=400)

    # Check if user exists 
    if User.objects.filter(username=username, profile__is_guest=False).exists():
        return JsonResponse({"success": False, "error": "Username already taken."}, status=400)

    if User.objects.filter(email=email, profile__is_guest=False).exists():
        return JsonResponse({"success": False, "error": "Email already in use."}, status=400)

    try:
        # check if theres a guest user in this session to turn into registered
        guest_user_id = request.session.get("guest_user_id")
        if guest_user_id:
            try:
                guest_user = User.objects.get(id=guest_user_id, profile__is_guest=True)
                # Convert guest to registered user
                convert_guest_to_registered(guest_user, username, email, password1)
                # Log them in
                login(request, guest_user)
                return JsonResponse({"success": True, "username": guest_user.username, "converted": True})
            except User.DoesNotExist:
                pass 

        #new user if no guest
        user = User.objects.create_user(username, email, password1)
        login(request, user)
        return JsonResponse({"success": True, "username": user.username})
    except Exception as e:
        return JsonResponse({"success": False, "error": str(e)}, status=400)


@require_POST
def ajax_logout(request):
    """Handle AJAX logout requests"""
    logout(request)
    return JsonResponse({"success": True})


@ensure_csrf_cookie
def get_csrf_token(request):
    """Return a view that does nothing but ensure CSRF cookie is set"""
    return JsonResponse({"success": True})


def user_status(request):
    """Return user authentication status and type"""
    data = {"is_authenticated": request.user.is_authenticated, "is_guest": False}

    if request.user.is_authenticated and hasattr(request.user, "profile"):
        data["is_guest"] = request.user.profile.is_guest
        data["username"] = request.user.username

    return JsonResponse(data)
