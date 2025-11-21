from django.urls import path

from . import views

app_name = "rarea"


urlpatterns = [
    path("", views.RNotesView.as_view(module="rarea"), name="index"),
    path("ui-guidelines", views.UIGuidelinesView.as_view(), name="ui-guidelines"),
]
