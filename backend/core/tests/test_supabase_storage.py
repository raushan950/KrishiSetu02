"""Unit tests for Supabase Storage adapter, signed URLs, and local storage fallback."""
import io
from unittest.mock import Mock, patch
from django.test import TestCase, override_settings
from django.core.files.base import ContentFile

from core.supabase_storage import SupabaseStorage


class SupabaseStorageTests(TestCase):
    @override_settings(SUPABASE_URL='', SUPABASE_SERVICE_ROLE_KEY='')
    def test_unconfigured_storage_uses_local_fallback(self):
        storage = SupabaseStorage(bucket_name='crop-images', is_private=False)
        self.assertFalse(storage.is_configured)
        file_content = ContentFile(b'test-image-data-payload')
        name = storage.save('test_crop.jpg', file_content)
        self.assertTrue(storage.exists(name))
        url = storage.url(name)
        self.assertIn('/media/', url)
        # Cleanup
        storage.delete(name)
        self.assertFalse(storage.exists(name))

    @override_settings(SUPABASE_URL='', SUPABASE_SERVICE_ROLE_KEY='')
    def test_private_unconfigured_storage_uses_private_media(self):
        storage = SupabaseStorage(bucket_name='shipment-evidence', is_private=True)
        file_content = ContentFile(b'test-delivery-receipt')
        name = storage.save('receipt.pdf', file_content)
        self.assertTrue(storage.exists(name))
        url = storage.url(name)
        self.assertIn('/private_media/', url)
        storage.delete(name)

    @override_settings(
        SUPABASE_URL='https://example-project.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY='test-service-role-key-12345'
    )
    @patch('core.supabase_storage.requests.post')
    def test_configured_public_storage_saves_and_returns_public_url(self, mock_post):
        mock_post.return_value = Mock(status_code=201, json=lambda: {'Key': 'crop-images/sample.png'})
        storage = SupabaseStorage(bucket_name='crop-images', is_private=False)
        self.assertTrue(storage.is_configured)
        
        file_content = ContentFile(b'fake-image-bytes')
        saved_name = storage._save('sample.png', file_content)
        self.assertEqual(saved_name, 'sample.png')
        self.assertEqual(
            storage.url('sample.png'),
            'https://example-project.supabase.co/storage/v1/object/public/crop-images/sample.png'
        )

    @override_settings(
        SUPABASE_URL='https://example-project.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY='test-service-role-key-12345'
    )
    @patch('core.supabase_storage.requests.post')
    def test_configured_private_storage_returns_signed_url(self, mock_post):
        mock_post.return_value = Mock(
            status_code=200,
            json=lambda: {'signedURL': '/object/sign/shipment-evidence/proof.jpg?token=abc123signed'}
        )
        storage = SupabaseStorage(bucket_name='shipment-evidence', is_private=True)
        url = storage.url('proof.jpg', expires_in=1800)
        self.assertIn('token=abc123signed', url)
        self.assertTrue(mock_post.called)
