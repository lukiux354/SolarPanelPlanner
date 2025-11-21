import uuid

from django.conf import settings
from django.db.models import Q
from django.http import Http404, JsonResponse
from django.middleware.csrf import get_token
from django.shortcuts import render
from rest_framework import generics, viewsets
from rest_framework.decorators import api_view
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .guest_user import get_or_create_guest_user
from .models import PanelManufacturer, SolarPanel, SolarProject
from .serializers import PanelManufacturerSerializer, PolygonSerializer, SolarPanelSerializer, SolarProjectSerializer


def map_view(request):
    if request.user.is_authenticated and not hasattr(request.user, "profile"):
        from .models import UserProfile

        UserProfile.objects.create(user=request.user)

    # make sure the is_guest flag is set
    if (
        request.user.is_authenticated and hasattr(request.user, "profile") 
        and request.session.get("guest_user_id") == request.user.id
    ):
            request.user.profile.is_guest = True
            request.user.profile.save()

    context = {
        "google_maps_api_key": settings.GOOGLE_MAPS_API_KEY,
        "debug": settings.DEBUG,  
    }
    return render(request, "index.html", context)


class ProjectListView(generics.ListCreateAPIView):
    serializer_class = SolarProjectSerializer

    def get_queryset(self):
        if self.request.user.is_authenticated:
            # logged in normally
            if (
                hasattr(self.request.user, "profile")
                and not self.request.user.profile.is_guest
                or hasattr(self.request.user, "profile")
                and self.request.user.profile.is_guest
            ):
                return SolarProject.objects.filter(user=self.request.user)
        else:
            # anonymous user - create a guest user
            guest_user = get_or_create_guest_user(self.request)
            return SolarProject.objects.filter(user=guest_user)

        return SolarProject.objects.none()

    def perform_create(self, serializer):
        data = {
            'latitude': 0.0,
            'longitude': 0.0,
            'zoom': 15,
            'polygons': []
        }
        
        if 'data' in self.request.data and isinstance(self.request.data['data'], dict):
            data.update(self.request.data['data'])
        
        if self.request.user.is_authenticated:
            serializer.save(user=self.request.user, data=data)
        else:
            guest_user = get_or_create_guest_user(self.request)
            serializer.save(user=guest_user, data=data)


class ProjectDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, project_id):
        try:
            # user has access?
            if request.user.is_authenticated:
                project = SolarProject.objects.get(id=project_id, user=request.user)
            else:
                guest_user = get_or_create_guest_user(request)
                project = SolarProject.objects.get(id=project_id, user=guest_user)

            return Response({
            "id": project.id, 
            "name": project.name,
            "latitude": project.data.get("latitude"), 
            "longitude": project.data.get("longitude"),
            "zoom": project.data.get("zoom")
        })
        except SolarProject.DoesNotExist as e:
            raise Http404 from e

    def delete(self, request, project_id):
        try:
            # user has access?
            if request.user.is_authenticated:
                project = SolarProject.objects.get(id=project_id, user=request.user)
            else:
                guest_user = get_or_create_guest_user(request)
                project = SolarProject.objects.get(id=project_id, user=guest_user)

            project_name = project.name
            project.delete()
            return Response({"message": f"Project {project_name} deleted successfully"})
        except SolarProject.DoesNotExist as e:
            raise Http404 from e
        
    def patch(self, request, project_id):
        try:
            # user has access?
            if request.user.is_authenticated:
                project = SolarProject.objects.get(id=project_id, user=request.user)
            else:
                guest_user = get_or_create_guest_user(request)
                project = SolarProject.objects.get(id=project_id, user=guest_user)
            
            if 'name' in request.data:
                project.name = request.data['name']
                
            if 'data' in request.data:
                if not project.data:
                    project.data = {}
                    
                project.data.update(request.data['data'])
                
            project.save()
            
            return Response({
                "id": project.id, 
                "name": project.name,
                "latitude": project.data.get("latitude"), 
                "longitude": project.data.get("longitude"),
                "zoom": project.data.get("zoom")
            })
        except SolarProject.DoesNotExist as e:
            # return 404 both scenarios so its unclear if it exists or not
            raise Http404 from e


class PolygonListCreateView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        project_id = request.GET.get("project_id")
        if not project_id or not project_id.isdigit():
            return Response([])

        try:
            # user has access?
            if request.user.is_authenticated:
                project = SolarProject.objects.get(id=project_id, user=request.user)
            else:
                guest_user = get_or_create_guest_user(request)
                project = SolarProject.objects.get(id=project_id, user=guest_user)

            polygons = project.data.get("polygons", [])
            return Response(polygons)
        except SolarProject.DoesNotExist:
            return Response([])

    def post(self, request):
        project_id = request.data.get("project_id")
        if not project_id:
            return Response({"error": "project_id is required"}, status=400)

        try:
            # user has access?
            if request.user.is_authenticated:
                project = SolarProject.objects.get(id=project_id, user=request.user)
            else:
                guest_user = get_or_create_guest_user(request)
                project = SolarProject.objects.get(id=project_id, user=guest_user)

            #serializer
            polygon_data = {
                "id": f"p-{uuid.uuid4()}",
                "coordinates": request.data.get("coordinates", []),
                "tilt_angle": request.data.get("tilt_angle", 0),
                "bottom_edge_index": request.data.get("bottom_edge_index"),
                "height_data": {"baseHeight": 0, "vertexHeights": {}, "stableVertexHeights": {}},
                "edges": [],
            }

            # Get coordinates
            coordinates = request.data.get("coordinates", [])
    
            if coordinates is None:
                return Response({
                    "error": "Coordinates cannot be null"
                }, status=400)
            
            if len(coordinates) < 3:
                return Response({
                    "error": "Polygon must have at least 3 points"
                }, status=400)

            serializer = PolygonSerializer(data=polygon_data)
            if not serializer.is_valid():
                return Response(serializer.errors, status=400)

            # add polygon to project
            if "data" not in project.__dict__ or not project.data:
                project.data = {"polygons": []}

            if "polygons" not in project.data:
                project.data["polygons"] = []

            project.data["polygons"].append(polygon_data)
            project.save()

            return Response(polygon_data, status=201)
        except SolarProject.DoesNotExist:
            return Response({"error": "Project not found"}, status=404)


class PolygonDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, polygon_id):
        project_id = request.GET.get("project_id")
        if not project_id or not project_id.isdigit():
            return Response({"error": "project_id is required"}, status=400)

        try:
            # user has access?
            if request.user.is_authenticated:
                project = SolarProject.objects.get(id=project_id, user=request.user)
            else:
                guest_user = get_or_create_guest_user(request)
                project = SolarProject.objects.get(id=project_id, user=guest_user)

            polygon = next((p for p in project.data.get("polygons", []) if p.get("id") == polygon_id), None)

            if not polygon:
                return Response({"error": "Polygon not found"}, status=404)

            return Response(polygon)
        except SolarProject.DoesNotExist:
            return Response({"error": "Project not found"}, status=404)

    def delete(self, request, polygon_id):
        project_id = request.GET.get("project_id")
        if not project_id or not project_id.isdigit():
            return Response({"error": "project_id is required"}, status=400)

        try:
            #user has access ?
            if request.user.is_authenticated:
                project = SolarProject.objects.get(id=project_id, user=request.user)
            else:
                guest_user = get_or_create_guest_user(request)
                project = SolarProject.objects.get(id=project_id, user=guest_user)

            if "polygons" not in project.data:
                return Response({"error": "No polygons in project"}, status=404)

            # find and remove the polygon
            original_count = len(project.data["polygons"])
            project.data["polygons"] = [p for p in project.data["polygons"] if p.get("id") != polygon_id]

            if len(project.data["polygons"]) == original_count:
                return Response({"error": "Polygon not found"}, status=404)

            project.save()
            return Response(status=204)
        except SolarProject.DoesNotExist:
            return Response({"error": "Project not found"}, status=404)


class PolygonHeightUpdateView(APIView):
    permission_classes = [AllowAny]

    def patch(self, request, polygon_id):
        project_id = request.GET.get("project_id") or request.data.get("project_id")

        if not project_id:
            return Response({"error": "project_id is required"}, status=400)

        try:
            # user has access?
            if request.user.is_authenticated:
                project = SolarProject.objects.get(id=project_id, user=request.user)
            else:
                guest_user = get_or_create_guest_user(request)
                project = SolarProject.objects.get(id=project_id, user=guest_user)

            # Find the polygon
            polygon_found = False
            for i, polygon in enumerate(project.data.get("polygons", [])):
                if polygon.get("id") == polygon_id and "height_data" in request.data:
                        project.data["polygons"][i]["height_data"] = request.data["height_data"]
                        polygon_found = True
                        break

            if not polygon_found:
                return Response({"error": "Polygon not found"}, status=404)

            project.save()
            return Response({"status": "success"})
        except SolarProject.DoesNotExist:
            return Response({"error": "Project not found"}, status=404)
        except Exception as e:
            return Response({"error": str(e)}, status=500)


# view for updating all heights in one request
@api_view(["PATCH"])
def update_all_heights(request, pk):
    """Update heights for all polygons in a project"""
    try:
        # user has access?
        if request.user.is_authenticated:
            project = SolarProject.objects.get(id=pk, user=request.user)
        else:
            guest_user = get_or_create_guest_user(request)
            project = SolarProject.objects.get(id=pk, user=guest_user)

        if "polygons" in request.data:
            polygons_data = request.data.get("polygons", {})

            for polygon_id, data in polygons_data.items():
                for i, polygon in enumerate(project.data.get("polygons", [])):
                    if str(polygon.get("id")) == str(polygon_id):
                        if "height_data" not in project.data["polygons"][i]:
                            project.data["polygons"][i]["height_data"] = {}

                        # Update height data
                        if "baseHeight" in data:
                            project.data["polygons"][i]["height_data"]["baseHeight"] = data["baseHeight"]

                        if "vertexHeights" in data:
                            project.data["polygons"][i]["height_data"]["vertexHeights"] = data["vertexHeights"]

                        if "stableVertexHeights" in data:
                            project.data["polygons"][i]["height_data"]["stableVertexHeights"] = data[
                                "stableVertexHeights"
                            ]

                        break
        else:
            # Old format for backward compatibility
            height_data = request.data.get("height_data", {})
            for polygon_id, data in height_data.items():
                for i, polygon in enumerate(project.data.get("polygons", [])):
                    if str(polygon.get("id")) == str(polygon_id):
                        if "height_data" not in project.data["polygons"][i]:
                            project.data["polygons"][i]["height_data"] = {}

                        # Update height data
                        if "baseHeight" in data:
                            project.data["polygons"][i]["height_data"]["baseHeight"] = data["baseHeight"]

                        if "vertexHeights" in data:
                            project.data["polygons"][i]["height_data"]["vertexHeights"] = data["vertexHeights"]

                        if "stableVertexHeights" in data:
                            project.data["polygons"][i]["height_data"]["stableVertexHeights"] = data[
                                "stableVertexHeights"
                            ]

                        break

        # Save the project with updated height data
        project.save()
        return Response({"status": "success", "message": "Heights updated successfully"})

    except SolarProject.DoesNotExist:
        return Response({"error": "Project not found"}, status=404)
    except Exception as e:
        print(f"Error updating heights: {str(e)}")
        return Response({"error": str(e)}, status=500)


def csrf_refresh(request):
    """Return the current CSRF token"""
    return JsonResponse({"csrf_token": get_token(request)})


class SolarPanelViewSet(viewsets.ModelViewSet):
    serializer_class = SolarPanelSerializer

    def get_queryset(self):
        user = self.request.user
        if user.is_authenticated:
            return SolarPanel.objects.filter(Q(is_public=True) | Q(user=user)).order_by("-is_default", "name")
        else:
            return SolarPanel.objects.filter(is_public=True).order_by("-is_default", "name")

    def perform_create(self, serializer):
        if self.request.user.is_authenticated:
            serializer.save(user=self.request.user)
        else:
            # For guest users
            serializer.save()


class ManufacturerListView(generics.ListAPIView):
    serializer_class = PanelManufacturerSerializer
    queryset = PanelManufacturer.objects.all().order_by("name")
