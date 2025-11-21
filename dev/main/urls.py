from django.conf import settings
from django.conf.urls import include
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path
from django.utils.translation import gettext_lazy as _

urlpatterns = [
    # Main.
    path("admin/", admin.site.urls),
    path("", include("parea.urls", namespace="parea")),
    path("rarea/", include("rarea.urls", namespace="rarea")),
    # Core.
    path("auth/", include("core.uauth.urls", namespace="core/uauth")),
    # Modules.
    path("demo/", include("modules.demo.urls", namespace="modules/demo")),
    # Solar
    path("solar/", include("modules.solar.urls", namespace="modules/solar")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

admin.site.site_header = _("ADMIN_AREA_TITLE")
