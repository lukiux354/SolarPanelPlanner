# Create a migration file in migrations folder
from django.db import migrations, models
import uuid

def transfer_data_to_json(apps, schema_editor):
    # Get old models
    Project = apps.get_model('solar', 'Project')
    RoofPolygon = apps.get_model('solar', 'RoofPolygon')
    RoofEdge = apps.get_model('solar', 'RoofEdge')
    
    # Get new model
    SolarProject = apps.get_model('solar', 'SolarProject')
    
    # Transfer data
    for project in Project.objects.all():
        # Create new project
        solar_project = SolarProject(
            id=project.id,
            name=project.name,
            created_at=project.created_at if hasattr(project, 'created_at') else None,
            data={"polygons": []}
        )
        
        # Get all polygons for this project
        roof_polygons = RoofPolygon.objects.filter(project=project)
        
        # Process each polygon
        for polygon in roof_polygons:
            polygon_data = {
                "id": f"p-{uuid.uuid4()}",
                "coordinates": polygon.coordinates,
                "tilt_angle": polygon.tilt_angle,
                "bottom_edge_index": polygon.bottom_edge_index,
                "height_data": polygon.height_data or {"baseHeight": 0, "vertexHeights": {}},
                "edges": []
            }
            
            # Get all edges for this polygon
            edges = RoofEdge.objects.filter(polygon=polygon)
            
            # Process each edge
            for edge in edges:
                edge_data = {
                    "id": f"e-{uuid.uuid4()}",
                    "coordinates": edge.coordinates,
                    "is_bottom": edge.is_bottom
                }
                polygon_data["edges"].append(edge_data)
            
            # Add polygon to project data
            solar_project.data["polygons"].append(polygon_data)
        
        # Save new project
        solar_project.save()

class Migration(migrations.Migration):
    dependencies = [
        ('solar', '0006_roofpolygon_height_data'), 
    ]
    
    operations = [
        migrations.CreateModel(
            name='SolarProject',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=255, unique=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('data', models.JSONField(default=dict)),
            ],
        ),
        migrations.RunPython(transfer_data_to_json),
    ]