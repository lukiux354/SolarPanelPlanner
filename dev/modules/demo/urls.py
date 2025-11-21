from django.urls import path

from . import views

app_name = "modules.demo"

urlpatterns = [
    path("data", views.DataView.as_view(), name="data"),
    path("cad", views.CADView.as_view(), name="cad"),
]
