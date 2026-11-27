from datetime import timedelta
from unittest.mock import patch, MagicMock
from django.test import TestCase, override_settings
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status
from rest_framework.exceptions import ValidationError, Throttled
from core.models import VerificationChallenge
from core.security import create_challenge, consume_challenge, normalize_phone

User = get_user_model()

@override_settings(
    SMS_PROVIDER='fast2sms',
    FAST2SMS_API_KEY='test_fast2sms_secret_key',
    FAST2SMS_OTP_ID=''  # Quick SMS route mode
)
class PhoneVerificationAndChangeTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user1 = User.objects.create_user(
            email='user1_farmer@example.com',
            password='Password123!',
            phone='+919876543210',
            role='FARMER',
            first_name='Ramesh Kumar'
        )
        self.user2 = User.objects.create_user(
            email='user2_buyer@example.com',
            password='Password123!',
            phone='+919876543299',
            role='BUYER',
            first_name='Suresh Traders'
        )

    # 1. New phone number registration
    def test_new_phone_registration_success(self):
        data = {
            'email': 'new_farmer@example.com',
            'password': 'StrongPassword2026!',
            'phone': '9876511111',
            'role': 'FARMER',
            'first_name': 'New Kisan'
        }
        res = self.client.post('/api/v1/auth/register/', data)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['user']['phone'], '+919876511111')
        self.assertFalse(res.data['user']['phone_verified'])

    # 2. Duplicate phone number rejection during registration & PATCH /me/
    def test_duplicate_phone_number_rejection(self):
        # Registration attempt with user1's phone
        reg_data = {
            'email': 'duplicate_attempt@example.com',
            'password': 'StrongPassword2026!',
            'phone': '9876543210',
            'role': 'FARMER'
        }
        res = self.client.post('/api/v1/auth/register/', reg_data)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('phone', res.data)
        self.assertIn('cannot be used', str(res.data['phone']))

        # Profile update PATCH attempt with user2's phone
        self.client.force_authenticate(user=self.user1)
        res_patch = self.client.patch('/api/v1/auth/me/', {'phone': '9876543299'})
        self.assertEqual(res_patch.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('phone', res_patch.data)
        self.assertIn('cannot be used', str(res_patch.data['phone']))

        # Ensure user1's phone was untouched
        self.user1.refresh_from_db()
        self.assertEqual(self.user1.phone, '+919876543210')

    # 3. Same-user phone update does not trigger duplicate error
    def test_same_user_phone_update_allowed(self):
        self.client.force_authenticate(user=self.user1)
        # Update first_name while sending existing phone
        res = self.client.patch('/api/v1/auth/me/', {
            'first_name': 'Ramesh Kumar Updated',
            'phone': '+919876543210'
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['first_name'], 'Ramesh Kumar Updated')
        self.assertEqual(res.data['phone'], '+919876543210')

    # 4. Changing a mistyped phone number via verification request
    @patch('requests.post')
    def test_changing_mistyped_phone_number_via_request(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {'return': True, 'request_id': 'req_123', 'message': ['Sent']}
        mock_post.return_value = mock_resp

        self.client.force_authenticate(user=self.user1)
        # Request verification for a new corrected number
        res = self.client.post('/api/v1/auth/verification/request/', {
            'kind': 'PHONE',
            'phone': '9876543215'
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('challenge_id', res.data)
        self.assertEqual(res.data['pending_phone'], '+919876543215')
        self.assertIn('•••••••3215', res.data['target'])

        # User's actual phone in DB must STILL be the original number
        self.user1.refresh_from_db()
        self.assertEqual(self.user1.phone, '+919876543210')

    # 5. Sending OTP to the new pending number
    @patch('requests.post')
    def test_otp_dispatched_to_pending_number(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {'return': True, 'request_id': 'req_456', 'message': ['Sent']}
        mock_post.return_value = mock_resp

        challenge = create_challenge(self.user1, 'PHONE', pending_phone='+919876543222')
        self.assertEqual(challenge.pending_phone, '+919876543222')

        # Verify Fast2SMS received the pending mobile number, not the old user.phone
        call_json = mock_post.call_args[1]['json']
        self.assertEqual(call_json['numbers'], '9876543222')

    # 6. Incorrect OTP rejected and attempts incremented
    @patch('requests.post')
    def test_incorrect_otp_rejected(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {'return': True, 'request_id': 'req_789'}
        mock_post.return_value = mock_resp

        challenge = create_challenge(self.user1, 'PHONE', pending_phone='+919876543233')

        with self.assertRaises(ValidationError) as ctx:
            consume_challenge(self.user1, challenge.id, '000000', 'PHONE')
        self.assertIn('invalid or expired', str(ctx.exception))

        challenge.refresh_from_db()
        self.assertEqual(challenge.attempts, 1)
        self.assertIsNone(challenge.used_at)

    # 7. Expired OTP rejected
    @patch('requests.post')
    def test_expired_otp_rejected(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {'return': True, 'request_id': 'req_exp'}
        mock_post.return_value = mock_resp

        challenge = create_challenge(self.user1, 'PHONE', pending_phone='+919876543244')
        # Simulate expiration
        challenge.expires_at = timezone.now() - timedelta(minutes=1)
        challenge.save(update_fields=['expires_at'])

        with self.assertRaises(ValidationError):
            consume_challenge(self.user1, challenge.id, '123456', 'PHONE')

    # 8. Resend cooldown enforced within 90s
    @patch('requests.post')
    def test_resend_cooldown_throttled(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {'return': True, 'request_id': 'req_cool'}
        mock_post.return_value = mock_resp

        create_challenge(self.user1, 'PHONE', pending_phone='+919876543255')

        # Second request within 90s must raise Throttled
        with self.assertRaises(Throttled):
            create_challenge(self.user1, 'PHONE', pending_phone='+919876543255')

    # 9. Successful phone verification atomically assigns pending number and marks verified
    @patch('requests.post')
    def test_successful_phone_verification_updates_user(self, mock_post):
        import re
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {'return': True, 'request_id': 'req_succ'}
        mock_post.return_value = mock_resp

        challenge = create_challenge(self.user1, 'PHONE', pending_phone='+919876543277')
        raw_msg = mock_post.call_args[1]['json']['message']
        sent_code = re.search(r'\b\d{6}\b', raw_msg).group(0)

        verified_user = consume_challenge(self.user1, challenge.id, sent_code, 'PHONE')
        self.assertEqual(verified_user.phone, '+919876543277')
        self.assertTrue(verified_user.phone_verified)

        self.user1.refresh_from_db()
        self.assertEqual(self.user1.phone, '+919876543277')
        self.assertTrue(self.user1.phone_verified)

    # 10. Changing a previously verified number leaves original verified until new number OTP confirmed
    @patch('requests.post')
    def test_original_verified_phone_preserved_until_confirmation(self, mock_post):
        import re
        # Mark user1 as verified with their original phone
        self.user1.phone_verified = True
        self.user1.save(update_fields=['phone_verified'])

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {'return': True, 'request_id': 'req_prev'}
        mock_post.return_value = mock_resp

        # Request verification for another number
        challenge = create_challenge(self.user1, 'PHONE', pending_phone='+919876543288')
        
        # User1's phone and verified status in DB must remain UNCHANGED
        self.user1.refresh_from_db()
        self.assertEqual(self.user1.phone, '+919876543210')
        self.assertTrue(self.user1.phone_verified)

        # Now confirm OTP for new number
        raw_msg = mock_post.call_args[1]['json']['message']
        sent_code = re.search(r'\b\d{6}\b', raw_msg).group(0)
        consume_challenge(self.user1, challenge.id, sent_code, 'PHONE')

        # Now and only now should the new number be assigned
        self.user1.refresh_from_db()
        self.assertEqual(self.user1.phone, '+919876543288')
        self.assertTrue(self.user1.phone_verified)

    # 11. Verification status persists after refresh
    def test_verification_status_persists_in_me_api(self):
        self.user1.phone_verified = True
        self.user1.save(update_fields=['phone_verified'])

        self.client.force_authenticate(user=self.user1)
        res = self.client.get('/api/v1/auth/me/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data['phone_verified'])
        self.assertEqual(res.data['phone'], '+919876543210')

    # 12. Duplicate pending phone number rejected safely
    def test_duplicate_pending_phone_rejected_safely(self):
        self.client.force_authenticate(user=self.user1)
        # Try requesting OTP for user2's phone
        res = self.client.post('/api/v1/auth/verification/request/', {
            'kind': 'PHONE',
            'phone': '9876543299'  # user2's phone
        })
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('phone', res.data)
        self.assertIn('cannot be used', str(res.data['phone']))

    # 13. Fast2SMS provider failure handled gracefully
    @patch('requests.post')
    def test_fast2sms_failure_handled_cleanly(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.status_code = 500
        mock_resp.side_effect = Exception("Fast2SMS gateway network timeout")
        mock_post.side_effect = Exception("Fast2SMS gateway network timeout")

        with self.assertRaises(ValidationError) as ctx:
            create_challenge(self.user1, 'PHONE', pending_phone='+919876543290')
        self.assertIn('delivery', str(ctx.exception))

    # 14. No HTTP 500 for ordinary validation errors
    def test_no_500_for_invalid_phone_format(self):
        self.client.force_authenticate(user=self.user1)
        res = self.client.post('/api/v1/auth/verification/request/', {
            'kind': 'PHONE',
            'phone': 'invalid_123'
        })
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertNotEqual(res.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)

    # 15. Sanitized error response (no credentials or tracebacks exposed)
    def test_sanitized_error_response_no_traceback(self):
        self.client.force_authenticate(user=self.user1)
        # Attempt PATCH with user2's phone
        res = self.client.patch('/api/v1/auth/me/', {'phone': '9876543299'})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        # Verify response is pure JSON without HTML or DB URL
        self.assertIsInstance(res.data, dict)
        self.assertNotIn('postgresql://', str(res.data))
        self.assertNotIn('Traceback', str(res.data))
        self.assertNotIn('PASSWORD', str(res.data))
