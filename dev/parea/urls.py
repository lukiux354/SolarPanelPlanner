from django.contrib.auth import views as auth_views
from django.urls import path

app_name = "parea"

urlpatterns = [
    path(
        "",
        auth_views.LoginView.as_view(redirect_authenticated_user=True, template_name="parea/index.html"),
        name="index",
    ),
]
