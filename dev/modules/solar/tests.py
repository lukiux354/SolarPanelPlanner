from django.contrib.auth.models import User
from django.contrib.sessions.middleware import SessionMiddleware
from django.test import RequestFactory, TestCase

from .guest_user import get_or_create_guest_user
from .models import PanelManufacturer, SolarPanel, SolarProject, UserProfile
from .views import ProjectListView, map_view


class SolarPanelModelTest(TestCase):
    def setUp(self):
        self.manufacturer = PanelManufacturer.objects.create(
            name="Test Manufacturer",
            country="Test Country"
        )
        self.panel = SolarPanel.objects.create(
            name="Test Panel",
            width=1.7,
            height=1.0,
            thickness=0.04,
            wattage=350,
            efficiency=20.1,
            cost=200.0,
            is_public=True,
            is_default=False,
            manufacturer=self.manufacturer
        )

    def test_panel_creation(self):
        """Test solar panel is created correctly"""
        self.assertEqual(self.panel.name, "Test Panel")
        self.assertEqual(self.panel.width, 1.7)
        self.assertEqual(self.panel.height, 1.0)
        self.assertEqual(self.panel.wattage, 350)
        self.assertEqual(self.panel.manufacturer.name, "Test Manufacturer")
    
    def test_panel_str_representation(self):
        """Test string representation of panel"""
        expected = "Test Panel (350W) by Test Manufacturer"
        self.assertEqual(str(self.panel), expected)


class SolarProjectModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            password='testpassword'
        )
        self.project = SolarProject.objects.create(
            name="Test Project",
            user=self.user,
            latitude=52.5200,
            longitude=13.4050,
            zoom=15
        )

    def test_project_creation(self):
        """Test solar project is created correctly"""
        self.assertEqual(self.project.name, "Test Project")
        self.assertEqual(self.project.user, self.user)
        self.assertEqual(self.project.latitude, 52.5200)
        self.assertEqual(self.project.longitude, 13.4050)
        self.assertEqual(self.project.zoom, 15)
    
    def test_project_str_representation(self):
        """Test string representation of project"""
        self.assertEqual(str(self.project), "Test Project")


class UserProfileModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            password='testpassword'
        )
        self.profile = UserProfile.objects.create(
            user=self.user,
            is_guest=False
        )

    def test_profile_creation(self):
        """Test user profile is created correctly"""
        self.assertEqual(self.profile.user, self.user)
        self.assertFalse(self.profile.is_guest)
    
    def test_profile_str_representation(self):
        """Test string representation of user profile"""
        expected = "Profile for testuser"
        self.assertEqual(str(self.profile), expected)


class GuestUserHelperTest(TestCase):
    def setUp(self):
        self.factory = RequestFactory()
    
    def test_get_or_create_guest_user_creates_new_user(self):
        """Test guest user is created if not exists in session"""
        request = self.factory.get('/')
        middleware = SessionMiddleware(lambda req: None)
        middleware.process_request(request)
        request.session.save()
        
        guest_user = get_or_create_guest_user(request)
        
        # Verify the user was created
        self.assertIsNotNone(guest_user)
        self.assertTrue(guest_user.is_authenticated)
        self.assertTrue(hasattr(guest_user, 'profile'))
        self.assertTrue(guest_user.profile.is_guest)
        
        # Verify session was updated
        self.assertIsNotNone(request.session.get('guest_user_id'))
        self.assertEqual(request.session.get('guest_user_id'), guest_user.id)
    
    def test_get_or_create_guest_user_returns_existing_user(self):
        """Test existing guest user is retrieved from session"""
        request = self.factory.get('/')
        middleware = SessionMiddleware(lambda req: None)
        middleware.process_request(request)
        
        # First call creates a new user
        guest_user1 = get_or_create_guest_user(request)
        request.session.save()
        
        # Second call should retrieve the same user
        guest_user2 = get_or_create_guest_user(request)
        
        self.assertEqual(guest_user1.id, guest_user2.id)


class URLTest(TestCase):
    def test_map_view_url(self):
        """Test map view URL is accessible"""
        response = self.client.get('/solar/')
        self.assertEqual(response.status_code, 200)
    
    def test_api_panels_url(self):
        """Test panels API URL is accessible"""
        response = self.client.get('/solar/api/panels/')
        self.assertEqual(response.status_code, 200)


class MapViewTest(TestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.user = User.objects.create_user(
            username='testuser',
            password='testpassword'
        )
    
    def test_map_view_creates_profile(self):
        """Test map view creates profile if it doesn't exist"""
        request = self.factory.get('/solar/')
        request.user = self.user
        
        # Check if profile was created
        user = User.objects.get(username='testuser')
        self.assertTrue(hasattr(user, 'profile'))
    
    def test_map_view_context(self):
        """Test map view provides correct context"""
        request = self.factory.get('/solar/')
        request.user = self.user
        
        response = map_view(request)
        
        # Check context contains API key
        self.assertIn('google_maps_api_key', response.context)
        self.assertIn('debug', response.context)


class ProjectViewTest(TestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.user = User.objects.create_user(
            username='testuser',
            password='testpassword'
        )
        self.profile = UserProfile.objects.create(
            user=self.user,
            is_guest=False
        )
        self.project = SolarProject.objects.create(
            name="Test Project",
            user=self.user,
            latitude=52.5200,
            longitude=13.4050,
            zoom=15
        )
    
    def test_project_list_view_queryset(self):
        """Test project list view returns user's projects"""
        view = ProjectListView()
        
        # Setup request with user
        request = self.factory.get('/solar/api/projects/')
        request.user = self.user
        view.request = request
        
        queryset = view.get_queryset()
        
        self.assertEqual(queryset.count(), 1)
        self.assertEqual(queryset.first(), self.project)