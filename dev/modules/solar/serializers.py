from rest_framework import serializers

from .models import PanelManufacturer, SolarPanel, SolarProject


class SolarProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = SolarProject
        fields = ["id", "name", "created_at", "data"]


class PolygonSerializer(serializers.Serializer):
    """Serializer for individual polygon operations within a project"""

    id = serializers.CharField(required=False)
    coordinates = serializers.JSONField()
    tilt_angle = serializers.FloatField(default=0)
    bottom_edge_index = serializers.IntegerField(required=False, allow_null=True)
    height_data = serializers.JSONField(required=False, allow_null=True)
    edges = serializers.JSONField(required=False, default=list)


class PanelManufacturerSerializer(serializers.ModelSerializer):
    class Meta:
        model = PanelManufacturer
        fields = ["id", "name", "website", "country"]


class SolarPanelSerializer(serializers.ModelSerializer):
    manufacturer_name = serializers.CharField(source="manufacturer.name", read_only=True)

    class Meta:
        model = SolarPanel
        fields = [
            "id",
            "name",
            "manufacturer",
            "manufacturer_name",
            "width",
            "height",
            "thickness",
            "wattage",
            "efficiency",
            "cost",
            "is_default",
            "is_public",
        ]
