"""Comprehensive tests for Google Authentication in KrishiSetu.

Tests:
- Rejection when GOOGLE_CLIENT_ID is unconfigured
- Verification of genuine/mocked Google token claims
- Role-preserving registration (Farmer, Buyer, Transporter)
- Immunity against privilege escalation (ADMIN/INSTITUTION self-registration blocked)
- Account merging safety (prevents silent takeover of password accounts)
- Returning user session issuance
- Google account linking for verified accounts
"""
import pytest
from unittest.mock import patch
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

User = get_user_model()

@pytest.fixture
def api_client():
    return APIClient()

@pytest.fixture
def mock_google_claims():
    return {
        'iss': 'https://accounts.google.com',
        'sub': 'google-uid-test-123456789',
        'email': 'krishitestuser@gmail.com',
        'email_verified': True,
        'given_name': 'Ramesh',
        'family_name': 'Kumar',
        'name': 'Ramesh Kumar',
        'picture': 'https://lh3.googleusercontent.com/test-pic'
    }

@pytest.mark.django_db
class TestGoogleAuthentication:

    def test_google_login_unconfigured_fails(self, api_client, settings):
        """When GOOGLE_CLIENT_ID is blank, request fails gracefully with clear error."""
        settings.GOOGLE_CLIENT_ID = ''
        response = api_client.post('/api/v1/auth/google/', {'credential': 'dummy-token'})
        assert response.status_code == 400
        assert 'google' in response.data
        assert 'not configured' in str(response.data['google']).lower()

    @patch('core.views.id_token.verify_oauth2_token')
    def test_google_login_new_user_success(self, mock_verify, api_client, settings, mock_google_claims):
        """New user registering via Google gets created with requested role and tokens."""
        settings.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com'
        mock_verify.return_value = mock_google_claims

        response = api_client.post('/api/v1/auth/google/', {
            'credential': 'valid-google-id-token',
            'role': 'FARMER'
        })
        assert response.status_code == 200
        assert response.data['is_new_user'] is True
        assert response.data['user']['email'] == 'krishitestuser@gmail.com'
        assert response.data['user']['role'] == 'FARMER'
        assert response.data['user']['email_verified'] is True
        assert 'access' in response.data['tokens']
        assert 'refresh' in response.data['tokens']

        user = User.objects.get(email='krishitestuser@gmail.com')
        assert user.google_sub == 'google-uid-test-123456789'
        assert user.first_name == 'Ramesh'
        assert user.last_name == 'Kumar'

    @patch('core.views.id_token.verify_oauth2_token')
    def test_google_login_role_privilege_escalation_blocked(self, mock_verify, api_client, settings, mock_google_claims):
        """Attempting to register as ADMIN via Google defaults to FARMER role."""
        settings.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com'
        mock_verify.return_value = mock_google_claims

        response = api_client.post('/api/v1/auth/google/', {
            'credential': 'valid-google-id-token',
            'role': 'ADMIN'
        })
        assert response.status_code == 200
        # ADMIN role must NOT be granted to public Google signup
        assert response.data['user']['role'] == 'FARMER'
        user = User.objects.get(email='krishitestuser@gmail.com')
        assert user.role == 'FARMER'
        assert not user.is_staff
        assert not user.is_superuser

    @patch('core.views.id_token.verify_oauth2_token')
    def test_google_login_buyer_role_preserved(self, mock_verify, api_client, settings, mock_google_claims):
        """Buyer role selection during Google signup is strictly preserved."""
        settings.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com'
        mock_verify.return_value = mock_google_claims

        response = api_client.post('/api/v1/auth/google/', {
            'credential': 'valid-google-id-token',
            'role': 'BUYER'
        })
        assert response.status_code == 200
        assert response.data['user']['role'] == 'BUYER'

    @patch('core.views.id_token.verify_oauth2_token')
    def test_google_login_returning_user(self, mock_verify, api_client, settings, mock_google_claims):
        """Returning user with existing google_sub authenticates and is not treated as new."""
        settings.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com'
        mock_verify.return_value = mock_google_claims

        # Create existing user
        existing_user = User.objects.create_user(
            email='krishitestuser@gmail.com',
            role='TRANSPORTER',
            first_name='Ramesh',
            email_verified=True
        )
        existing_user.google_sub = mock_google_claims['sub']
        existing_user.save()

        response = api_client.post('/api/v1/auth/google/', {
            'credential': 'valid-google-id-token'
        })
        assert response.status_code == 200
        assert response.data['is_new_user'] is False
        assert response.data['user']['role'] == 'TRANSPORTER'
        assert 'access' in response.data['tokens']

    @patch('core.views.id_token.verify_oauth2_token')
    def test_google_login_existing_email_password_account_blocks_takeover(self, mock_verify, api_client, settings, mock_google_claims):
        """If an email exists with password login and no google_sub, reject silent takeover."""
        settings.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com'
        mock_verify.return_value = mock_google_claims

        # Pre-existing password account
        User.objects.create_user(
            email='krishitestuser@gmail.com',
            password='StrongPassword123!',
            role='FARMER'
        )

        response = api_client.post('/api/v1/auth/google/', {
            'credential': 'valid-google-id-token'
        })
        assert response.status_code == 400
        assert 'google' in response.data
        assert 'account with this email already exists' in response.data['google'].lower()

    @patch('core.views.id_token.verify_oauth2_token')
    def test_google_link_authenticated_user(self, mock_verify, api_client, settings, mock_google_claims):
        """Authenticated user can link their Google account when emails match."""
        settings.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com'
        mock_verify.return_value = mock_google_claims

        user = User.objects.create_user(
            email='krishitestuser@gmail.com',
            password='StrongPassword123!',
            email_verified=True,
            role='FARMER'
        )
        api_client.force_authenticate(user=user)

        response = api_client.post('/api/v1/auth/google/link/', {
            'credential': 'valid-google-id-token'
        })
        assert response.status_code == 200
        assert 'linked' in response.data['message'].lower()
        user.refresh_from_db()
        assert user.google_sub == mock_google_claims['sub']
