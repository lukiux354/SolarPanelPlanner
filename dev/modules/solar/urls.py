from django.urls import path

from . import auth_views, views

app_name = "modules.solar" 

urlpatterns = [
    # Map view
    path("map", views.map_view, name="map-view"),

    # project endpoints
    path("api/projects/", views.ProjectListView.as_view(), name="project-list"),
    path("api/projects/<int:project_id>/", views.ProjectDetailView.as_view(), name="project_detail"),

    # polygon endpoints
    path("api/roof-polygons/", views.PolygonListCreateView.as_view(), name="polygon-list-create"),
    path("api/roof-polygons/<str:polygon_id>/", views.PolygonDetailView.as_view(), name="polygon-detail"),
    path(
        "api/roof-polygons/<str:polygon_id>/update-height/",
        views.PolygonHeightUpdateView.as_view(),
        name="polygon-height-update",
    ),
    path("api/projects/<int:pk>/update-all-heights/", views.update_all_heights, name="update-all-heights"),

    # auth
    path("auth/login/", auth_views.ajax_login, name="ajax_login"),
    path("auth/register/", auth_views.ajax_register, name="ajax_register"),
    path("auth/logout/", auth_views.ajax_logout, name="ajax_logout"),
    path("auth/csrf/", auth_views.get_csrf_token, name="get_csrf_token"),
    path("api/user-status/", auth_views.user_status, name="user_status"),
    path("api/csrf-refresh/", views.csrf_refresh, name="csrf_refresh"),

    # solar panels
    path("api/panels/", views.SolarPanelViewSet.as_view({"get": "list", "post": "create"}), name="panel-list"),
    path(
        "api/panels/<int:pk>/",
        views.SolarPanelViewSet.as_view({"get": "retrieve", "put": "update", "delete": "destroy"}),
        name="panel-detail",
    ),
    path("api/manufacturers/", views.ManufacturerListView.as_view(), name="manufacturer-list"),
]
