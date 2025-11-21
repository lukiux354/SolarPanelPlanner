from django.contrib.auth.mixins import LoginRequiredMixin
from django.views.generic import TemplateView


class UIGuidelinesView(LoginRequiredMixin, TemplateView):
    template_name = "rarea/ui_guidelines.html"
