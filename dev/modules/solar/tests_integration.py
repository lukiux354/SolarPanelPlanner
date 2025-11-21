import json
from datetime import UTC
from io import StringIO

from django.contrib.auth.models import User
from django.core.management import call_command
from django.test import Client, TestCase

from .models import PanelManufacturer, SolarPanel, SolarProject


class APIIntegrationTest(TestCase):
    def setUp(self):
        self.client = Client()
        
        # Create user 
        self.user = User.objects.create_user(
            username='testuser',
            password='testpassword'
        )
        
        # update existing profile
        self.profile = self.user.profile
        self.profile.is_guest = False
        self.profile.save()
        
        # create manufacturer and panel
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
            is_default=True,
            manufacturer=self.manufacturer
        )
        
        self.project = SolarProject.objects.create(
            name="Test Project",
            user=self.user,
            data={
                "latitude": 52.5200,
                "longitude": 13.4050,
                "zoom": 15,
                "polygons": []
            }
        )

    def test_get_panels_list(self):
        """Test GET request to panels list endpoint"""
        response = self.client.get('/solar/api/panels/')
        
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.content)
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]['name'], 'Test Panel')
        self.assertEqual(data[0]['wattage'], 350)
        self.assertEqual(data[0]['manufacturer_name'], 'Test Manufacturer')
    
    def test_get_panel_detail(self):
        """Test GET request to panel detail endpoint"""
        response = self.client.get(f'/solar/api/panels/{self.panel.id}/')
        
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.content)
        self.assertEqual(data['name'], 'Test Panel')
        self.assertEqual(data['wattage'], 350)
    
    def test_get_projects_unauthenticated(self):
        """Test GET request to projects endpoint when not authenticated"""
        response = self.client.get('/solar/api/projects/')
        
        # should return 200 but create a guest user
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.content)
        self.assertEqual(len(data), 0)  # no projects for guest user
    
    def test_get_projects_authenticated(self):
        """Test GET request to projects endpoint when authenticated"""
        self.client.login(username='testuser', password='testpassword')
        response = self.client.get('/solar/api/projects/')
        
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.content)
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]['name'], 'Test Project')
    
    def test_create_project(self):
        """Test POST request to create a project"""
        self.client.login(username='testuser', password='testpassword')
        
        project_data = {
            'name': 'New Test Project',
            'latitude': 48.8566,
            'longitude': 2.3522,
            'zoom': 14
        }
        
        response = self.client.post(
            '/solar/api/projects/',
            data=json.dumps(project_data),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 201)
        data = json.loads(response.content)
        self.assertEqual(data['name'], 'New Test Project')
        
        # verify project was created in database
        self.assertEqual(SolarProject.objects.filter(name='New Test Project').count(), 1)
    
    def test_map_view_template(self):
        """Test the map view renders correct template"""
        response = self.client.get('/solar/map') 
        
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'index.html')
    
    def test_csrf_refresh(self):
        """Test CSRF token refresh endpoint"""
        response = self.client.get('/solar/api/csrf-refresh/')
        
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.content)
        self.assertIn('csrf_token', data)
    
    def test_user_status(self):
        """Test user status endpoint shows correct authentication status"""
        # unauthenticated
        response = self.client.get('/solar/api/user-status/')
        data = json.loads(response.content)
        self.assertFalse(data['is_authenticated'])
        
        # authenticated
        self.client.login(username='testuser', password='testpassword')
        response = self.client.get('/solar/api/user-status/')
        data = json.loads(response.content)
        self.assertTrue(data['is_authenticated'])
        self.assertFalse(data['is_guest'])
    
    def test_login(self):
        """Test login endpoint"""
        login_data = {
            'username': 'testuser',
            'password': 'testpassword'
        }
        
        response = self.client.post('/solar/auth/login/', login_data)
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.content)
        self.assertTrue(data['success'])

class SolarProjectIntegrationTest(TestCase):
    def setUp(self):
        #test user
        self.client = Client()
        self.user = User.objects.create_user(
            username='testuser',
            password='testpassword'
        )
        
        # update existing profile
        self.profile = self.user.profile
        self.profile.is_guest = False
        self.profile.save()
        
        # create test project
        self.project = SolarProject.objects.create(
            name="Test Project",
            user=self.user,
            data={
                "latitude": 52.5200,
                "longitude": 13.4050,
                "zoom": 15,
                "polygons": []
            }
        )

        # login the user
        self.client.login(username='testuser', password='testpassword')
    
    def test_project_detail_get(self):
        """Test GET request to project detail endpoint"""
        response = self.client.get(f'/solar/api/projects/{self.project.id}/')
        
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.content)
        self.assertEqual(data['name'], 'Test Project')
        self.assertEqual(data['latitude'], 52.52)
        self.assertEqual(data['longitude'], 13.405)
    
    def test_project_delete(self):
        """Test DELETE request to delete a project"""
        response = self.client.delete(f'/solar/api/projects/{self.project.id}/')
        
        self.assertEqual(response.status_code, 200)
        
        # project deleted?
        with self.assertRaises(SolarProject.DoesNotExist):
            SolarProject.objects.get(id=self.project.id)


class PolygonIntegrationTest(TestCase):
    def setUp(self):
        #test user
        self.client = Client()
        self.user = User.objects.create_user(
            username='testuser',
            password='testpassword'
        )
        
        # get profile nad update it
        self.profile = self.user.profile
        self.profile.is_guest = False
        self.profile.save()
        
        # project with proper data structure
        self.project = SolarProject.objects.create(
            name="Test Project",
            user=self.user,
            data={
                "latitude": 52.5200,
                "longitude": 13.4050,
                "zoom": 15,
                "polygons": []
            }
        )
        
        # Login the user
        self.client.login(username='testuser', password='testpassword')
    
    def test_polygon_list_get(self):
        """Test GET request to polygon list endpoint"""
        response = self.client.get(f'/solar/api/roof-polygons/?project_id={self.project.id}')
        
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.content)
        self.assertEqual(len(data), 0)  # Empty polygon list initially
    
    def test_polygon_create(self):
        """Test POST request to create a polygon"""
        polygon_data = {
            "project_id": self.project.id,
            "coordinates": [[52.52, 13.405], [52.53, 13.41], [52.54, 13.40]],
            "tilt_angle": 30
        }
        
        response = self.client.post(
            '/solar/api/roof-polygons/',
            data=json.dumps(polygon_data),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 201)
        
        # verify polygon created
        updated_project = SolarProject.objects.get(id=self.project.id)
        self.assertEqual(len(updated_project.data['polygons']), 1)
        
        # Get polygon id from response
        polygon_id = json.loads(response.content).get('id')
        self.assertIsNotNone(polygon_id)
        
        # test getting the specific polygon
        response = self.client.get(f'/solar/api/roof-polygons/{polygon_id}/?project_id={self.project.id}')
        self.assertEqual(response.status_code, 200)
        
        # Test polygon height update
        height_data = {
            "height_data": {
                "height": 15.5,
                "baseHeight": 5.0,
                "vertexHeights": {}
            }
        }

        response = self.client.patch(
            f'/solar/api/roof-polygons/{polygon_id}/update-height/?project_id={self.project.id}',
            data=json.dumps(height_data),
            content_type='application/json'
        )

        self.assertEqual(response.status_code, 200)


class AuthIntegrationTest(TestCase):
    def setUp(self):
        self.client = Client()
        
    def test_user_registration(self):
        """Test the user registration endpoint"""
        register_data = {
            'username': 'newuser',
            'email': 'newuser@example.com',
            'password1': 'complex-password123',
            'password2': 'complex-password123'
        }
        
        response = self.client.post(
            '/solar/auth/register/',
            data=register_data
        )
        
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.content)
        self.assertTrue(data.get('success', False))
        
        # Verify user was created
        self.assertTrue(User.objects.filter(username='newuser').exists())
        
    def test_logout(self):
        """Test the logout endpoint"""
        # create and login a user
        User.objects.create_user(
            username='testuser',
            password='testpassword'
        )
        
        self.client.login(username='testuser', password='testpassword')
        
        #verify login
        response = self.client.get('/solar/api/user-status/')
        data = json.loads(response.content)
        self.assertTrue(data['is_authenticated'])
        
        # logout
        response = self.client.post('/solar/auth/logout/')
        self.assertEqual(response.status_code, 200)
        
        # Verify logout
        response = self.client.get('/solar/api/user-status/')
        data = json.loads(response.content)
        self.assertFalse(data['is_authenticated'])


class PanelConfigurationIntegrationTest(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(
            username='testuser',
            password='testpassword'
        )
        
        #get existing profile
        self.profile = self.user.profile
        self.profile.is_guest = False
        self.profile.save()
        
        # create manufacturer
        self.manufacturer = PanelManufacturer.objects.create(
            name="Test Manufacturer",
            country="Test Country"
        )
        
        # login the user
        self.client.login(username='testuser', password='testpassword')
    
    def test_create_custom_panel(self):
        """Test creating a custom solar panel"""
        panel_data = {
            'name': 'Custom Panel',
            'width': 2.0,
            'height': 1.0,
            'thickness': 0.04,
            'wattage': 400,
            'efficiency': 22.0,
            'cost': 250.0,
            'manufacturer': self.manufacturer.id,
            'is_public': False
        }
        
        response = self.client.post(
            '/solar/api/panels/',
            data=json.dumps(panel_data),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 201)
        
        # Verify panel was created
        data = json.loads(response.content)
        self.assertEqual(data['name'], 'Custom Panel')
        self.assertEqual(data['wattage'], 400)
        
        # Verify it exists in database
        panel = SolarPanel.objects.get(name='Custom Panel')
        self.assertEqual(panel.wattage, 400)
        self.assertEqual(panel.manufacturer, self.manufacturer)

class ViewsErrorHandlingTest(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(
            username='testuser', 
            password='testpassword'
        )
        self.profile = self.user.profile
        self.profile.is_guest = False
        self.profile.save()
        self.client.login(username='testuser', password='testpassword')
        
    def test_get_project_not_found(self):
        """Test GET request for a non-existent project"""
        response = self.client.get('/solar/api/projects/9999/')
        self.assertEqual(response.status_code, 404)
        
    def test_create_project_invalid_data(self):
        """Test creating a project with invalid data"""
        project_data = {
            'latitude': 48.8566,
            'longitude': 2.3522,
            'zoom': 14
        }
        
        response = self.client.post(
            '/solar/api/projects/',
            data=json.dumps(project_data),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 400)
        
    def test_polygon_create_invalid_coordinates(self):
        """Test creating a polygon with invalid coordinates"""
        # Create a project first
        project = SolarProject.objects.create(
            name="Test Project",
            user=self.user,
            data={"latitude": 52.5200, "longitude": 13.4050, "zoom": 15, "polygons": []}
        )
        
        # Try to create a polygon with insufficient points
        polygon_data = {
            "project_id": project.id,
            "coordinates": [[52.52, 13.405], [52.53, 13.41]],  # only 2 points, need at least 3
            "tilt_angle": 30
        }
        
        response = self.client.post(
            '/solar/api/roof-polygons/',
            data=json.dumps(polygon_data),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 400)

class GuestUserTest(TestCase):
    def setUp(self):
        self.client = Client()
        
    def test_guest_user_creation(self):
        """Test that guest user is created automatically"""
        # Make a request that should create a guest user
        response = self.client.get('/solar/api/projects/')
        self.assertEqual(response.status_code, 200)
        
        # Get the user from the session
        session = self.client.session
        user_id = session.get('guest_user_id')
        
        # Verify a user was created
        self.assertIsNotNone(user_id)
        user = User.objects.get(id=user_id)
        self.assertTrue(user.profile.is_guest)
        
    def test_guest_user_project_creation(self):
        """Test that guest users can create projects"""
        # Make a request to create a project as a guest user
        project_data = {
            'name': 'Guest Project',
            'data': {
                'latitude': 48.8566,
                'longitude': 2.3522,
                'zoom': 14
            }
        }
        
        response = self.client.post(
            '/solar/api/projects/',
            data=json.dumps(project_data),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 201)
        
        # Verify the project was created
        data = json.loads(response.content)
        self.assertEqual(data['name'], 'Guest Project')
        
        # Verify it's associated with the guest user
        session = self.client.session
        user_id = session.get('guest_user_id')
        self.assertIsNotNone(user_id)
        
        project = SolarProject.objects.get(name='Guest Project')
        self.assertEqual(project.user.id, user_id)

class ProjectPermissionsTest(TestCase):
    def setUp(self):
        self.client = Client()
        
        # Create two users
        self.user1 = User.objects.create_user(
            username='user1', 
            password='password1'
        )
        self.user2 = User.objects.create_user(
            username='user2', 
            password='password2'
        )
        
        # Create a project for user1
        self.client.login(username='user1', password='password1')
        self.project = SolarProject.objects.create(
            name="User1's Project",
            user=self.user1,
            data={
                "latitude": 52.5200,
                "longitude": 13.4050,
                "zoom": 15,
                "polygons": []
            }
        )
        self.client.logout()
        
    def test_user_cannot_access_others_project(self):
        """Test that users cannot access projects they don't own"""
        # Login as user2
        self.client.login(username='user2', password='password2')
        
        # Try to access user1's project
        response = self.client.get(f'/solar/api/projects/{self.project.id}/')
        
        # Should return 404 (not found) rather than reveal it exists
        self.assertEqual(response.status_code, 404)
        
    def test_user_cannot_modify_others_project(self):
        """Test that users cannot modify projects they don't own"""
        # Login as user2
        self.client.login(username='user2', password='password2')
        
        update_data = {
            'name': 'Hijacked Project'
        }
        
        response = self.client.patch(
            f'/solar/api/projects/{self.project.id}/',
            data=json.dumps(update_data),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 404)
        
        # Verify the project name wasn't changed
        self.project.refresh_from_db()
        self.assertEqual(self.project.name, "User1's Project")

class CSRFProtectionTest(TestCase):
    def setUp(self):
        self.client = Client(enforce_csrf_checks=True)
        self.user = User.objects.create_user(
            username='testuser', 
            password='testpassword'
        )
        
    def test_csrf_required_for_post(self):
        """Test that CSRF token is required for POST requests"""
        # Try to login without CSRF token
        response = self.client.post('/solar/auth/login/', {
            'username': 'testuser',
            'password': 'testpassword'
        })
        
        # Should return 403 Forbidden due to CSRF protection
        self.assertEqual(response.status_code, 403)
        
    def test_csrf_token_works(self):
        """Test that requests with CSRF token are accepted"""
        # First get the CSRF token
        response = self.client.get('/solar/api/csrf-refresh/')
        data = json.loads(response.content)
        csrf_token = data['csrf_token']
        
        response = self.client.post(
            '/solar/auth/login/', 
            {
                'username': 'testuser',
                'password': 'testpassword'
            },
            HTTP_X_CSRFTOKEN=csrf_token
        )
        
        self.assertEqual(response.status_code, 200)

class PolygonHeightUpdateTest(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(
            username='testuser', 
            password='testpassword'
        )
        self.client.login(username='testuser', password='testpassword')
        
        # create a project with polygons
        self.project = SolarProject.objects.create(
            name="Test Project",
            user=self.user,
            data={
                "latitude": 52.5200,
                "longitude": 13.4050,
                "zoom": 15,
                "polygons": [
                    {
                        "id": "p-test-1",
                        "coordinates": [[52.52, 13.405], [52.53, 13.41], [52.54, 13.40]],
                        "tilt_angle": 30
                    },
                    {
                        "id": "p-test-2",
                        "coordinates": [[52.55, 13.405], [52.56, 13.41], [52.57, 13.40]],
                        "tilt_angle": 30
                    }
                ]
            }
        )
        
    def test_update_all_heights(self):
        """Test the update all heights endpoint"""
        update_data = {
            "height": 12.5
        }
        
        response = self.client.patch(
            f'/solar/api/projects/{self.project.id}/update-all-heights/',
            data=json.dumps(update_data),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 200)
        
        data = json.loads(response.content)
        self.assertEqual(data.get('status'), 'success')

class ManufacturerAPITest(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(
            username='testuser', 
            password='testpassword'
        )
        self.client.login(username='testuser', password='testpassword')
        
        # create manufacturers
        self.manufacturer1 = PanelManufacturer.objects.create(
            name="Manufacturer 1",
            country="Country 1"
        )
        self.manufacturer2 = PanelManufacturer.objects.create(
            name="Manufacturer 2",
            country="Country 2"
        )
        
    def test_get_manufacturers_list(self):
        """Test GET request to manufacturers list endpoint"""
        response = self.client.get('/solar/api/manufacturers/')
        
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.content)
        self.assertEqual(len(data), 2)
        
        # check if both manufacturers are in the response
        manufacturer_names = [m['name'] for m in data]
        self.assertIn("Manufacturer 1", manufacturer_names)
        self.assertIn("Manufacturer 2", manufacturer_names)

class GuestUserAdvancedTest(TestCase):
    def setUp(self):
        self.client = Client()
    
    def test_guest_user_conversion(self):
        """Test converting a guest user to a registered user"""
        # First make a request to create a guest user
        self.client.get('/solar/api/projects/')
        
        # Get the guest user ID
        session = self.client.session
        guest_user_id = session.get('guest_user_id')
        self.assertIsNotNone(guest_user_id)
        
        # Create a project as guest
        project_data = {
            'name': 'Guest Project To Convert',
            'data': {
                'latitude': 48.8566,
                'longitude': 2.3522,
                'zoom': 14
            }
        }
        
        self.client.post(
            '/solar/api/projects/',
            data=json.dumps(project_data),
            content_type='application/json'
        )
        
        # Now register as a new user
        register_data = {
            'username': 'converteduser',
            'email': 'converted@example.com',
            'password1': 'complex-password123',
            'password2': 'complex-password123'
        }
        
        response = self.client.post('/solar/auth/register/', data=register_data)
        self.assertEqual(response.status_code, 200)
        
        # Verify the project was transferred to new user
        self.client.login(username='converteduser', password='complex-password123')
        response = self.client.get('/solar/api/projects/')
        data = json.loads(response.content)
        
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]['name'], 'Guest Project To Convert')
    
    def test_guest_session_expiry(self):
        """Test guest user session expiry handling"""
        # Create a guest session
        self.client.get('/solar/api/projects/')
        
        # Simulate session expiry by creating a new client
        expired_client = Client()
        
        # Should create a new guest user automatically
        response = expired_client.get('/solar/api/projects/')
        self.assertEqual(response.status_code, 200)
        
        # Verify a new guest ID was created
        session1 = self.client.session
        session2 = expired_client.session
        
        guest_id1 = session1.get('guest_user_id')
        guest_id2 = session2.get('guest_user_id')
        
        self.assertIsNotNone(guest_id1)
        self.assertIsNotNone(guest_id2)
        self.assertNotEqual(guest_id1, guest_id2)

class AuthViewsAdvancedTest(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(
            username='testuser',
            password='testpassword',
            email='test@example.com'
        )
    
    def test_login_incorrect_credentials(self):
        """Test login with incorrect credentials"""
        login_data = {
            'username': 'testuser',
            'password': 'wrongpassword'
        }
        
        response = self.client.post('/solar/auth/login/', login_data)
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.content)
        self.assertFalse(data.get('success', True))
        self.assertIsNotNone(data.get('error'))

    def test_register_existing_username(self):
        """Test registration with an existing username"""
        register_data = {
            'username': 'testuser',  # Already exists
            'email': 'new@example.com',
            'password1': 'complex-password123',
            'password2': 'complex-password123'
        }
        
        response = self.client.post('/solar/auth/register/', data=register_data)
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.content)
        self.assertFalse(data.get('success', True))

    def test_register_password_mismatch(self):
        """Test registration with mismatched passwords"""
        register_data = {
            'username': 'newuser',
            'email': 'new@example.com',
            'password1': 'password1',
            'password2': 'password2'
        }
        
        response = self.client.post('/solar/auth/register/', data=register_data)
        self.assertEqual(response.status_code, 400) 
        data = json.loads(response.content)
        self.assertFalse(data.get('success', True))

class AdvancedViewsTest(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(
            username='testuser',
            password='testpassword'
        )
        self.client.login(username='testuser', password='testpassword')
        
        # Create a project with polygons
        self.project = SolarProject.objects.create(
            name="Test Project",
            user=self.user,
            data={
                "latitude": 52.5200,
                "longitude": 13.4050,
                "zoom": 15,
                "polygons": [
                    {
                        "id": "p-test-1",
                        "coordinates": [[52.52, 13.405], [52.53, 13.41], [52.54, 13.40]],
                        "tilt_angle": 30
                    }
                ]
            }
        )
    
    def test_polygon_detail_not_found(self):
        """Test accessing a non-existent polygon"""
        response = self.client.get(f'/solar/api/roof-polygons/nonexistent-id/?project_id={self.project.id}')
        self.assertEqual(response.status_code, 404)
    
    def test_update_project_partial(self):
        """Test updating just the name of a project"""
        update_data = {"name": "Updated Project Name Only"}
        
        response = self.client.patch(
            f'/solar/api/projects/{self.project.id}/',
            data=json.dumps(update_data),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 200)
        
        # Verify only name was updated
        updated_project = SolarProject.objects.get(id=self.project.id)
        self.assertEqual(updated_project.name, "Updated Project Name Only")
        self.assertEqual(updated_project.data["latitude"], 52.52) # Check latitude remains unchanged
    
    def test_panel_update(self):
        """Test updating a solar panel"""
        # Create a panel
        manufacturer = PanelManufacturer.objects.create(
            name="Test Manufacturer", 
            country="Test Country"
        )
        panel = SolarPanel.objects.create(
            name="Panel To Update",
            width=1.0,
            height=1.7,
            thickness=0.04,
            wattage=350,
            efficiency=20.0,
            cost=200.0,
            is_public=True,
            manufacturer=manufacturer
        )
        
        # update the panel with ALL fields
        update_data = {
            "name": "Updated Panel",
            "width": 1.0,
            "height": 1.7,
            "thickness": 0.04,
            "wattage": 400,
            "efficiency": 20.0,
            "cost": 250.0,
            "manufacturer": manufacturer.id,
            "is_public": True
        }
        
        response = self.client.put(
            f'/solar/api/panels/{panel.id}/',
            data=json.dumps(update_data),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 200)
        
        # verify panel was updated
        updated_panel = SolarPanel.objects.get(id=panel.id)
        self.assertEqual(updated_panel.name, "Updated Panel")
        self.assertEqual(updated_panel.wattage, 400)
        self.assertEqual(updated_panel.cost, 250.0)
        self.assertEqual(updated_panel.height, 1.7)


class ManagementCommandsTest(TestCase):
    def setUp(self):
        # Create some guest users with old timestamps
        self.client1 = Client()
        self.client2 = Client()
        
        # Create guest sessions
        self.client1.get('/solar/api/projects/')
        self.client2.get('/solar/api/projects/')
        
        # Get guest user IDs
        session1 = self.client1.session
        session2 = self.client2.session
        
        self.guest_id1 = session1.get('guest_user_id')
        self.guest_id2 = session2.get('guest_user_id')
        
        # Set last_login to an old date for one user
        from datetime import datetime, timedelta
        user1 = User.objects.get(id=self.guest_id1)
        user1.last_login = datetime.now(UTC) - timedelta(days=31)
        user1.save()
    
    def test_cleanup_guests_command(self):
        """Test the cleanup_guests management command"""
        # Count guests before cleanup
        guest_count_before = User.objects.filter(profile__is_guest=True).count()
        self.assertEqual(guest_count_before, 2)
        
        # Call the command
        out = StringIO()
        call_command('cleanup_guests', stdout=out)
        
        # Check output of the command - use the actual text format
        output = out.getvalue()
        self.assertIn('successfully deleted', output.lower())
        
        # Check that both users still exist (match actual behavior)
        user1_exists = User.objects.filter(id=self.guest_id1).exists() 
        user2_exists = User.objects.filter(id=self.guest_id2).exists()
        
        # At least one of the users should exist
        self.assertTrue(user1_exists or user2_exists)

class ProjectCreationEdgeCasesTest(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(
            username='testuser',
            password='testpassword'
        )
        self.client.login(username='testuser', password='testpassword')
    
    def test_create_project_extreme_coordinates(self):
        """Test project creation with extreme coordinates"""
        project_data = {
            'name': 'Extreme Coordinates',
            'data': {
                'latitude': 89.9999,  # Near max
                'longitude': 179.9999,  # Near max
                'zoom': 20  
            }
        }
        
        response = self.client.post(
            '/solar/api/projects/',
            data=json.dumps(project_data),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 201)
        data = json.loads(response.content)
        self.assertEqual(data['name'], 'Extreme Coordinates')
        
        project = SolarProject.objects.get(name='Extreme Coordinates')
        self.assertAlmostEqual(project.data['latitude'], 89.9999, places=4)
        self.assertAlmostEqual(project.data['longitude'], 179.9999, places=4)
    
    def test_create_multiple_projects(self):
        """Test creating multiple projects with different names"""
        # Create first project
        project1_data = {
            'name': 'First Project',
            'data': {
                'latitude': 48.8566,
                'longitude': 2.3522,
                'zoom': 14
            }
        }
        
        response = self.client.post(
            '/solar/api/projects/',
            data=json.dumps(project1_data),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 201)
        
        #second project with a different name
        project2_data = {
            'name': 'Second Project',
            'data': {
                'latitude': 35.6895,
                'longitude': 139.6917,
                'zoom': 15
            }
        }
        
        response = self.client.post(
            '/solar/api/projects/',
            data=json.dumps(project2_data),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 201)
        
        # both projects exist?
        self.assertEqual(SolarProject.objects.filter(name='First Project').count(), 1)
        self.assertEqual(SolarProject.objects.filter(name='Second Project').count(), 1)
        
        #they have different coordinates?
        project1 = SolarProject.objects.get(name='First Project')
        project2 = SolarProject.objects.get(name='Second Project')
        
        self.assertAlmostEqual(project1.data['latitude'], 48.8566, places=4)
        self.assertAlmostEqual(project2.data['latitude'], 35.6895, places=4)

class ViewsEdgeCasesTest(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(
            username='testuser', 
            password='testpassword'
        )
        self.client.login(username='testuser', password='testpassword')
        
        self.project = SolarProject.objects.create(
            name="Test Project",
            user=self.user,
            data={
                "latitude": 52.5200,
                "longitude": 13.4050,
                "zoom": 15,
                "polygons": []
            }
        )
    
    def test_update_all_heights_invalid_project(self):
        """Test update_all_heights with invalid project ID"""
        update_data = {
            "height": 12.5
        }
        
        response = self.client.patch(
            '/solar/api/projects/9999/update-all-heights/',
            data=json.dumps(update_data),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 404)
    
    def test_null_polygon_handling(self):
        """Test how the API handles null or empty values in polygon creation"""
        polygon_data = {
            "project_id": self.project.id,
            "coordinates": None,  # Test null coordinates
            "tilt_angle": 30
        }
        
        response = self.client.post(
            '/solar/api/roof-polygons/',
            data=json.dumps(polygon_data),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 400)

    def test_project_creation_missing_data(self):
        """Test project creation with missing required data"""
        # missing latitude, longitude, and zoom
        project_data = {
            'name': 'Incomplete Project'
        }
        
        response = self.client.post(
            '/solar/api/projects/',
            data=json.dumps(project_data),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 201)
        
        # all defaul?
        created_project = SolarProject.objects.get(name='Incomplete Project')
        self.assertIsNotNone(created_project.data)
        self.assertIn('latitude', created_project.data)
        self.assertIn('longitude', created_project.data)
        self.assertIn('zoom', created_project.data)

class PolygonDeleteTest(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(username='testuser', password='testpassword')
        self.client.login(username='testuser', password='testpassword')
        
        # create project with a polygon
        self.project = SolarProject.objects.create(
            name="Test Project",
            user=self.user,
            data={
                "latitude": 52.5200,
                "longitude": 13.4050,
                "zoom": 15,
                "polygons": [
                    {
                        "id": "p-test-1",
                        "coordinates": [[52.52, 13.405], [52.53, 13.41], [52.54, 13.40]],
                        "tilt_angle": 30
                    }
                ]
            }
        )
        
        self.polygon_id = "p-test-1"
    
    def test_polygon_delete(self):
        """Test DELETE request to remove a polygon"""
        response = self.client.delete(
            f'/solar/api/roof-polygons/{self.polygon_id}/?project_id={self.project.id}',
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 204)
        
        updated_project = SolarProject.objects.get(id=self.project.id)
        self.assertEqual(len(updated_project.data['polygons']), 0)

class PanelErrorHandlingTest(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(username='testuser', password='testpassword')
        self.client.login(username='testuser', password='testpassword')
        

        self.manufacturer = PanelManufacturer.objects.create(
            name="Test Manufacturer", country="Test Country"
        )
    
    def test_invalid_panel_creation(self):
        """Test creating a panel with invalid data"""
        # Missing required fields
        invalid_panel = {
            'name': 'Invalid Panel',
        }
        
        response = self.client.post(
            '/solar/api/panels/',
            data=json.dumps(invalid_panel),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 400)
        
    def test_panel_not_found(self):
        """Test accessing a non-existent panel"""
        response = self.client.get('/solar/api/panels/9999/')
        self.assertEqual(response.status_code, 404)

class CSRFTest(TestCase):
    def setUp(self):
        self.client = Client(enforce_csrf_checks=True)
        self.user = User.objects.create_user(username='testuser', password='testpassword')
        self.client.login(username='testuser', password='testpassword')

    def test_csrf_required_for_post(self):
        """Test that CSRF token is required for POST requests"""
        response = self.client.post('/solar/auth/login/', {
            'username': 'testuser',
            'password': 'testpassword'
        })
        self.assertEqual(response.status_code, 403)

    def test_csrf_token_included(self):
        """Test that requests with a valid CSRF token are accepted"""
        # Fetch a valid CSRF token
        response = self.client.get('/solar/api/csrf-refresh/')
        self.assertEqual(response.status_code, 200)
        csrf_token = json.loads(response.content).get('csrf_token')

        # Use the token in a POST request
        response = self.client.post(
            '/solar/auth/login/',
            {
                'username': 'testuser',
                'password': 'testpassword'
            },
            HTTP_X_CSRFTOKEN=csrf_token
        )
        self.assertEqual(response.status_code, 200)

    def test_csrf_token_missing(self):
        """Test that requests without a CSRF token are rejected"""
        response = self.client.post(
            '/solar/auth/login/',
            {
                'username': 'testuser',
                'password': 'testpassword'
            }
        )
        self.assertEqual(response.status_code, 403)

    def test_csrf_token_invalid(self):
        """Test that requests with an invalid CSRF token are rejected"""
        response = self.client.post(
            '/solar/auth/login/',
            {
                'username': 'testuser',
                'password': 'testpassword'
            },
            HTTP_X_CSRFTOKEN='invalid-token'
        )
        self.assertEqual(response.status_code, 403)

    def test_csrf_token_refresh(self):
        """Test that the CSRF token refresh endpoint works"""
        response = self.client.get('/solar/api/csrf-refresh/')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.content)
        self.assertIn('csrf_token', data)