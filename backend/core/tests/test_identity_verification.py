from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from core.models import AuditEvent

User = get_user_model()

class IdentityVerificationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.farmer = User.objects.create_user(
            email='farmer.identity@example.com',
            password='TestPassword123!',
            role='FARMER',
            first_name='Harpreet',
            last_name='Singh',
            phone='+919876543210'
        )
        self.admin = User.objects.create_superuser(
            email='admin.identity@example.com',
            password='AdminPassword123!',
        )

    def test_unverified_initial_state(self):
        self.client.force_authenticate(user=self.farmer)
        res = self.client.get('/api/v1/auth/identity/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['status'], 'UNVERIFIED')
        self.assertFalse(res.data['verified'])

    def test_submit_invalid_document_type(self):
        self.client.force_authenticate(user=self.farmer)
        res = self.client.post('/api/v1/auth/identity/', {
            'document_type': 'INVALID_TYPE',
            'document_number': '1234567890',
            'full_name': 'Harpreet Singh'
        })
        self.assertEqual(res.status_code, 400)
        self.assertIn('document_type', res.data)

    def test_submit_valid_aadhaar_kyc(self):
        self.client.force_authenticate(user=self.farmer)
        res = self.client.post('/api/v1/auth/identity/', {
            'document_type': 'AADHAAR',
            'document_number': '987654321098',
            'full_name': 'Harpreet Singh',
            'notes': 'Punjab farmer registration'
        })
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['status'], 'PENDING_REVIEW')
        self.assertEqual(res.data['masked_number'], '********1098')
        self.assertFalse(res.data['verified'])

        # Check that GET now returns PENDING_REVIEW
        get_res = self.client.get('/api/v1/auth/identity/')
        self.assertEqual(get_res.status_code, 200)
        self.assertEqual(get_res.data['status'], 'PENDING_REVIEW')
        self.assertEqual(get_res.data['document_type'], 'AADHAAR')
        self.assertEqual(get_res.data['masked_number'], '********1098')

        # Check AuditEvent was created with masked number
        event = AuditEvent.objects.filter(object_id=str(self.farmer.pk), event='IDENTITY_VERIFICATION_SUBMITTED').first()
        self.assertIsNotNone(event)
        self.assertEqual(event.details.get('masked_number'), '********1098')

    def test_admin_queue_and_approval(self):
        # Farmer submits identity
        self.client.force_authenticate(user=self.farmer)
        self.client.post('/api/v1/auth/identity/', {
            'document_type': 'PAN',
            'document_number': 'ABCDE1234F',
            'full_name': 'Harpreet Singh'
        })

        # Admin checks review queue
        self.client.force_authenticate(user=self.admin)
        queue_res = self.client.get('/api/v1/admin/review-queue/')
        self.assertEqual(queue_res.status_code, 200)
        pending = queue_res.data.get('pending_identity_reviews', [])
        self.assertTrue(any(item['user_id'] == self.farmer.pk for item in pending))

        # Admin approves
        approve_res = self.client.post(f'/api/v1/admin/users/{self.farmer.pk}/verify-identity/', {
            'verified': True,
            'evidence_note': 'UIDAI verification and land record cross-checked successfully'
        })
        self.assertEqual(approve_res.status_code, 200)
        self.assertTrue(approve_res.data['identity_verified'])

        # Farmer re-checks status
        self.client.force_authenticate(user=self.farmer)
        self.farmer.refresh_from_db()
        self.assertTrue(self.farmer.identity_verified)
        final_res = self.client.get('/api/v1/auth/identity/')
        self.assertEqual(final_res.data['status'], 'VERIFIED')
        self.assertTrue(final_res.data['verified'])

    def test_admin_rejection_workflow(self):
        # Farmer submits
        self.client.force_authenticate(user=self.farmer)
        self.client.post('/api/v1/auth/identity/', {
            'document_type': 'KISAN_CREDIT_CARD',
            'document_number': 'KCC12345678',
            'full_name': 'Harpreet Singh'
        })

        # Admin rejects with evidence note
        self.client.force_authenticate(user=self.admin)
        reject_res = self.client.post(f'/api/v1/admin/users/{self.farmer.pk}/verify-identity/', {
            'verified': False,
            'evidence_note': 'Document expired. Please upload valid current year passbook.'
        })
        self.assertEqual(reject_res.status_code, 200)
        self.assertFalse(reject_res.data['identity_verified'])
        self.assertEqual(reject_res.data['status'], 'REJECTED')

        # Farmer checks status and sees rejection reason
        self.client.force_authenticate(user=self.farmer)
        status_res = self.client.get('/api/v1/auth/identity/')
        self.assertEqual(status_res.status_code, 200)
        self.assertEqual(status_res.data['status'], 'REJECTED')
        self.assertIn('Document expired', status_res.data['reason'])

    def test_non_admin_cannot_verify_identity(self):
        self.client.force_authenticate(user=self.farmer)
        res = self.client.post(f'/api/v1/admin/users/{self.farmer.pk}/verify-identity/', {
            'verified': True,
            'evidence_note': 'Self-approval attempt'
        })
        self.assertEqual(res.status_code, 403)
