from django.contrib import admin

from .models import PanelManufacturer, SolarPanel


@admin.register(PanelManufacturer)
class PanelManufacturerAdmin(admin.ModelAdmin):
    list_display = ("name", "country")
    search_fields = ("name",)


@admin.register(SolarPanel)
class SolarPanelAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "manufacturer",
        "width",
        "height",
        "wattage",
        "efficiency",
        "cost",
        "is_default",
        "is_public",
    )
    list_filter = ("is_default", "is_public", "manufacturer")
    search_fields = ("name",)
