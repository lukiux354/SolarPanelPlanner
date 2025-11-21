from django.contrib.auth.mixins import LoginRequiredMixin
from django.views.generic import TemplateView


class CADView(LoginRequiredMixin, TemplateView):
    template_name = "modules/demo/cad.html"

    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)
