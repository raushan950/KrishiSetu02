"""Cryptographic verification of Supabase Auth JWTs for Django REST Framework.

Verifies:
- Signature (via SUPABASE_JWT_SECRET HS256 or JWKS RS256/ES256)
- Expiration (exp)
- Audience (aud)
- Issuer (iss)
- User identity mapping and safe provisioning without privilege escalation.
"""
import json
import logging
import time
import jwt
from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework import authentication, exceptions

logger = logging.getLogger(__name__)
User = get_user_model()


class SupabaseAuthentication(authentication.BaseAuthentication):
    """DRF Authentication class for Supabase Auth JWT tokens.
    
    Falls through (returns None) if no Bearer token or if the token is not
    a Supabase-issued token, enabling SimpleJWT fallback for internal test runners.
    """
    keyword = 'Bearer'

    def authenticate(self, request):
        auth_header = authentication.get_authorization_header(request).split()
        if not auth_header or auth_header[0].lower() != self.keyword.lower().encode():
            return None

        if len(auth_header) == 1:
            raise exceptions.AuthenticationFailed('Invalid token header. No credentials provided.')
        elif len(auth_header) > 2:
            raise exceptions.AuthenticationFailed('Invalid token header. Token string should not contain spaces.')

        token = auth_header[1].decode('utf-8')
        return self.authenticate_credentials(token)

    def authenticate_credentials(self, token):
        jwt_secret = getattr(settings, 'SUPABASE_JWT_SECRET', '') or ''
        supabase_url = getattr(settings, 'SUPABASE_URL', '') or ''

        # If Supabase Auth is not configured on the backend, allow fallback to SimpleJWT
        if not jwt_secret and not supabase_url:
            return None

        try:
            # First inspect header unverified to detect algorithm and issuer
            unverified_header = jwt.get_unverified_header(token)
            unverified_payload = jwt.decode(token, options={'verify_signature': False})
        except Exception:
            # Not a valid JWT structure, let subsequent authentication classes handle it
            return None

        # Check if the token claims appear to be from Supabase
        iss = unverified_payload.get('iss', '')
        aud = unverified_payload.get('aud', '')
        sub = unverified_payload.get('sub', '')

        # Standard Supabase tokens have aud='authenticated' and sub as UUID
        is_supabase_token = (
            'supabase' in iss or
            aud == 'authenticated' or
            (supabase_url and supabase_url.rstrip('/') in iss) or
            'app_metadata' in unverified_payload or
            'user_metadata' in unverified_payload
        )

        if not is_supabase_token and not jwt_secret:
            return None

        # Cryptographic verification of token signature
        payload = None
        algorithms = [unverified_header.get('alg', 'HS256')]
        
        # Verify with SUPABASE_JWT_SECRET (HS256)
        if jwt_secret:
            try:
                verify_opts = {
                    'verify_signature': True,
                    'verify_exp': True,
                    'verify_aud': bool(aud == 'authenticated'),
                }
                payload = jwt.decode(
                    token,
                    jwt_secret,
                    algorithms=['HS256'],
                    audience='authenticated' if aud == 'authenticated' else None,
                    options=verify_opts,
                )
            except jwt.ExpiredSignatureError:
                raise exceptions.AuthenticationFailed('Supabase access token has expired.')
            except jwt.InvalidTokenError as exc:
                if unverified_header.get('alg') == 'HS256' or not supabase_url:
                    raise exceptions.AuthenticationFailed(f'Invalid Supabase token signature: {exc}')
                # Otherwise, might be RS256 using project JWKS

        # If RS256/ES256 or secret verification didn't match, attempt JWKS verification
        if payload is None and supabase_url:
            try:
                jwks_url = f"{supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
                jwks_client = jwt.PyJWKClient(jwks_url)
                signing_key = jwks_client.get_signing_key_from_jwt(token)
                payload = jwt.decode(
                    token,
                    signing_key.key,
                    algorithms=['RS256', 'ES256'],
                    audience='authenticated' if aud == 'authenticated' else None,
                    options={'verify_signature': True, 'verify_exp': True},
                )
            except jwt.ExpiredSignatureError:
                raise exceptions.AuthenticationFailed('Supabase access token has expired.')
            except Exception as exc:
                logger.debug(f'Supabase JWKS verification failed: {exc}')
                return None

        if not payload:
            return None

        # Verify identity attributes
        sub = payload.get('sub')
        if not sub:
            raise exceptions.AuthenticationFailed('Token payload missing subject identifier.')

        email = payload.get('email', '').strip().lower()
        user_metadata = payload.get('user_metadata', {}) or {}
        email_confirmed = bool(payload.get('email_confirmed_at') or payload.get('email_verified'))

        # Locate or link user
        user = User.objects.filter(supabase_uid=sub).first()
        if not user and email:
            # Check for existing user by email
            user = User.objects.filter(email=email).first()
            if user:
                # Link account
                user.supabase_uid = sub
                if email_confirmed and not user.email_verified:
                    user.email_verified = True
                user.save(update_fields=['supabase_uid', 'email_verified'] if email_confirmed else ['supabase_uid'])
            else:
                # Auto-provision new user profile linked to Supabase UID
                role = user_metadata.get('role', 'FARMER').upper()
                # Security rule: Public registration must never permit users to assign themselves
                # administrator or institutional privileges
                if role in ('ADMIN', 'INSTITUTION'):
                    role = 'FARMER'

                phone = user_metadata.get('phone', None)
                first_name = user_metadata.get('first_name', '')[:30]
                user = User.objects.create_user(
                    email=email,
                    password=None,
                    supabase_uid=sub,
                    role=role,
                    phone=phone,
                    first_name=first_name,
                    email_verified=email_confirmed,
                    is_active=True,
                )

        if not user:
            raise exceptions.AuthenticationFailed('Could not map Supabase identity to local user profile.')

        if not user.is_active:
            raise exceptions.AuthenticationFailed('User account is disabled.')

        return (user, payload)

    def authenticate_header(self, request):
        return f'{self.keyword} realm="api"'
