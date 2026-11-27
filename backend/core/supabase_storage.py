"""Supabase Storage adapter for Django.

Supports:
- Private buckets for KYC documents, delivery evidence, and transaction attachments
- Public or authenticated bucket for crop photographs
- Controlled time-limited signed URLs (expires_in default 3600s)
- Automatic fallback to FileSystemStorage when Supabase Storage credentials are not configured.
"""
import io
import os
import requests
from urllib.parse import urljoin
from django.conf import settings
from django.core.files.storage import Storage, FileSystemStorage
from django.utils.deconstruct import deconstructible


@deconstructible
class SupabaseStorage(Storage):
    def __init__(self, bucket_name='crop-images', is_private=False, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.bucket_name = bucket_name
        self.is_private = is_private
        self.supabase_url = getattr(settings, 'SUPABASE_URL', '') or ''
        self.service_role_key = (
            getattr(settings, 'SUPABASE_SERVICE_ROLE_KEY', '') or
            getattr(settings, 'SUPABASE_ANON_KEY', '') or
            ''
        )
        self.local_fallback = FileSystemStorage(
            location=settings.PRIVATE_MEDIA_ROOT if is_private else settings.MEDIA_ROOT,
            base_url='/private_media/' if is_private else settings.MEDIA_URL,
        )

    @property
    def is_configured(self):
        return bool(self.supabase_url and self.service_role_key)

    def _headers(self, content_type=None):
        headers = {
            'Authorization': f'Bearer {self.service_role_key}',
            'apikey': self.service_role_key,
        }
        if content_type:
            headers['Content-Type'] = content_type
        return headers

    def _clean_name(self, name):
        return str(name).replace('\\', '/').lstrip('/')

    def _save(self, name, content):
        clean_name = self._clean_name(name)
        if not self.is_configured:
            return self.local_fallback._save(clean_name, content)

        url = f"{self.supabase_url.rstrip('/')}/storage/v1/object/{self.bucket_name}/{clean_name}"
        
        # Read content bytes
        if hasattr(content, 'chunks'):
            data = b''.join(chunk for chunk in content.chunks())
        else:
            data = content.read()

        content_type = getattr(content, 'content_type', 'application/octet-stream')
        headers = self._headers(content_type)
        headers['x-upsert'] = 'true'

        try:
            resp = requests.post(url, data=data, headers=headers, timeout=15)
            if resp.status_code in (200, 201):
                return clean_name
            elif resp.status_code == 404:
                # Bucket might need creation; fallback locally
                from django.core.files.base import ContentFile
                return self.local_fallback._save(clean_name, ContentFile(data))
            else:
                # Log or fallback
                from django.core.files.base import ContentFile
                return self.local_fallback._save(clean_name, ContentFile(data))
        except Exception:
            # Resilient fallback to local storage
            from django.core.files.base import ContentFile
            return self.local_fallback._save(clean_name, ContentFile(data))

    def _open(self, name, mode='rb'):
        clean_name = self._clean_name(name)
        if not self.is_configured:
            return self.local_fallback._open(clean_name, mode)
        
        url = f"{self.supabase_url.rstrip('/')}/storage/v1/object/{self.bucket_name}/{clean_name}"
        try:
            resp = requests.get(url, headers=self._headers(), timeout=15)
            if resp.status_code == 200:
                from django.core.files.base import ContentFile
                return ContentFile(resp.content, name=clean_name)
        except Exception:
            pass
        return self.local_fallback._open(clean_name, mode)

    def url(self, name, expires_in=3600):
        clean_name = self._clean_name(name)
        if not self.is_configured:
            return self.local_fallback.url(clean_name)

        if self.is_private:
            # Time-limited signed URL
            sign_url = f"{self.supabase_url.rstrip('/')}/storage/v1/object/sign/{self.bucket_name}/{clean_name}"
            try:
                resp = requests.post(sign_url, json={'expiresIn': expires_in}, headers=self._headers(), timeout=10)
                if resp.status_code == 200:
                    signed_path = resp.json().get('signedURL')
                    if signed_path:
                        return urljoin(f"{self.supabase_url.rstrip('/')}/storage/v1/", signed_path.lstrip('/'))
            except Exception:
                pass
            return self.local_fallback.url(clean_name)
        else:
            # Public URL
            return f"{self.supabase_url.rstrip('/')}/storage/v1/object/public/{self.bucket_name}/{clean_name}"

    def exists(self, name):
        clean_name = self._clean_name(name)
        if not self.is_configured:
            return self.local_fallback.exists(clean_name)
        
        url = f"{self.supabase_url.rstrip('/')}/storage/v1/object/info/{self.bucket_name}/{clean_name}"
        try:
            resp = requests.get(url, headers=self._headers(), timeout=5)
            return resp.status_code == 200
        except Exception:
            return self.local_fallback.exists(clean_name)

    def delete(self, name):
        clean_name = self._clean_name(name)
        if not self.is_configured:
            return self.local_fallback.delete(clean_name)
        
        url = f"{self.supabase_url.rstrip('/')}/storage/v1/object/{self.bucket_name}/{clean_name}"
        try:
            requests.delete(url, headers=self._headers(), timeout=5)
        except Exception:
            pass
        self.local_fallback.delete(clean_name)
