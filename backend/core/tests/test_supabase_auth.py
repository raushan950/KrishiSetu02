"""Unit tests for Supabase Auth token verification, account linking, and privilege escalation guards."""
import time
import uuid
import jwt
from django.test import TestCase, override_settings
from django.contrib.auth import get_user_model
from rest_framework.test import APIRequestFactory
from rest_framework.exceptions import AuthenticationFailed

from core.supabase_auth import SupabaseAuthentication

User = get_user_model()
TEST_JWT_SECRET = 'test-supabase-secret-key-32-chars-long!!'


class SupabaseAuthTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.auth = SupabaseAuthentication()
        self.user = User.objects.create_user(
            email='farmer-supabase@example.org',
            password='Password123#Valid',
            role='FARMER',
            email_verified=True,
        )

    def _create_token(self, sub=None, email='farmer-supabase@example.org', role='FARMER',
                      secret=TEST_JWT_SECRET, exp_delta=3600, aud='authenticated'):
        payload = {
            'sub': str(sub or uuid.uuid4()),
            'email': email,
            'aud': aud,
            'role': 'authenticated',
            'iat': int(time.time()),
            'exp': int(time.time() + exp_delta),
            'email_confirmed_at': int(time.time()),
            'user_metadata': {'role': role, 'first_name': 'Ramesh'},
        }
        return jwt.encode(payload, secret, algorithm='HS256')

    @override_settings(SUPABASE_JWT_SECRET=TEST_JWT_SECRET)
    def test_valid_supabase_token_links_existing_user(self):
        token = self._create_token(email=self.user.email)
        request = self.factory.get('/api/v1/auth/me/', HTTP_AUTHORIZATION=f'Bearer {token}')
        user, payload = self.auth.authenticate(request)
        self.assertEqual(user.pk, self.user.pk)
        self.user.refresh_from_db()
        self.assertIsNotNone(self.user.supabase_uid)

    @override_settings(SUPABASE_JWT_SECRET=TEST_JWT_SECRET)
    def test_auto_provisions_new_user_safely(self):
        new_email = 'newbuyer@example.org'
        token = self._create_token(email=new_email, role='BUYER')
        request = self.factory.get('/api/v1/auth/me/', HTTP_AUTHORIZATION=f'Bearer {token}')
        user, payload = self.auth.authenticate(request)
        self.assertEqual(user.email, new_email)
        self.assertEqual(user.role, 'BUYER')
        self.assertTrue(user.email_verified)

    @override_settings(SUPABASE_JWT_SECRET=TEST_JWT_SECRET)
    def test_privilege_escalation_blocked_on_provisioning(self):
        # A public Supabase token claiming role ADMIN must be downgraded to FARMER
        hacker_email = 'hacker@example.org'
        token = self._create_token(email=hacker_email, role='ADMIN')
        request = self.factory.get('/api/v1/auth/me/', HTTP_AUTHORIZATION=f'Bearer {token}')
        user, payload = self.auth.authenticate(request)
        self.assertEqual(user.role, 'FARMER')
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)

    @override_settings(SUPABASE_JWT_SECRET=TEST_JWT_SECRET)
    def test_expired_token_raises_authentication_failed(self):
        token = self._create_token(exp_delta=-60)
        request = self.factory.get('/api/v1/auth/me/', HTTP_AUTHORIZATION=f'Bearer {token}')
        with self.assertRaises(AuthenticationFailed):
            self.auth.authenticate(request)

    @override_settings(SUPABASE_JWT_SECRET=TEST_JWT_SECRET)
    def test_invalid_signature_raises_authentication_failed(self):
        token = self._create_token(secret='wrong-secret-key-32-chars-long!!')
        request = self.factory.get('/api/v1/auth/me/', HTTP_AUTHORIZATION=f'Bearer {token}')
        with self.assertRaises(AuthenticationFailed):
            self.auth.authenticate(request)

    @override_settings(SUPABASE_JWT_SECRET='')
    def test_unconfigured_supabase_falls_through_to_simple_jwt(self):
        token = self._create_token()
        request = self.factory.get('/api/v1/auth/me/', HTTP_AUTHORIZATION=f'Bearer {token}')
        res = self.auth.authenticate(request)
        # Returns None so DRF passes to the next authenticator in DEFAULT_AUTHENTICATION_CLASSES
        self.assertIsNone(res)
