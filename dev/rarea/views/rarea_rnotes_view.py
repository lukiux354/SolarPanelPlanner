from django.contrib.auth.mixins import LoginRequiredMixin
from django.views.generic import TemplateView


class RNotesView(LoginRequiredMixin, TemplateView):
    template_name = "rarea/rnotes.html"
    module = "rarea"
