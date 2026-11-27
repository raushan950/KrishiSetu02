from unittest.mock import patch, MagicMock
from django.test import TestCase, override_settings
from django.contrib.auth import get_user_model
from rest_framework.exceptions import ValidationError, Throttled
from core.models import VerificationChallenge
from core.security import (
    sms_configured,
    to_fast2sms_mobile,
    send_fast2sms_otp,
    verify_fast2sms_otp,
    create_challenge,
    consume_challenge
)

User = get_user_model()

@override_settings(
    SMS_PROVIDER='fast2sms',
    FAST2SMS_API_KEY='fast2sms_mock_secret_key_123',
    FAST2SMS_OTP_ID='mock_otp_template_456'
)
class Fast2SMSTests(TestCase):
    def setUp(self):
        self.farmer = User.objects.create_user(
            email='farmer_fast2sms@example.com',
            phone='+919876543210',
            role='FARMER',
            first_name='Kisan Ram'
        )
        self.buyer = User.objects.create_user(
            email='buyer_fast2sms@example.com',
            phone='+919876543211',
            role='BUYER',
            first_name='Vyapari Traders'
        )
        self.transporter = User.objects.create_user(
            email='transporter_fast2sms@example.com',
            phone='+919876543212',
            role='TRANSPORTER',
            first_name='Logistics Operator'
        )

    def test_sms_configured_status(self):
        self.assertTrue(sms_configured())

        with override_settings(SMS_PROVIDER='console'):
            self.assertTrue(sms_configured())

        with override_settings(SMS_PROVIDER=''):
            self.assertFalse(sms_configured())

        with override_settings(SMS_PROVIDER=''):
            self.assertFalse(sms_configured())

        with override_settings(FAST2SMS_API_KEY=''):
            self.assertFalse(sms_configured())

        with override_settings(FAST2SMS_OTP_ID=''):
            # Quick SMS route operates with API key even without pre-configured OTP_ID
            self.assertTrue(sms_configured())

    def test_to_fast2sms_mobile_extraction(self):
        self.assertEqual(to_fast2sms_mobile('+919876543210'), '9876543210')
        self.assertEqual(to_fast2sms_mobile('919876543210'), '9876543210')
        self.assertEqual(to_fast2sms_mobile('9876543210'), '9876543210')

    @patch('requests.post')
    def test_send_fast2sms_otp_success(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            'return': True,
            'request_id': 'req_abc123456',
            'message': ['SMS sent successfully.']
        }
        mock_post.return_value = mock_resp

        res = send_fast2sms_otp('+919876543210', '123456')
        self.assertTrue(res['return'])
        self.assertEqual(res['request_id'], 'req_abc123456')

        # Check call arguments: authorization header must NOT contain 'Bearer'
        args, kwargs = mock_post.call_args
        self.assertEqual(args[0], 'https://www.fast2sms.com/dev/otp/send')
        self.assertEqual(kwargs['headers']['authorization'], 'fast2sms_mock_secret_key_123')
        self.assertEqual(kwargs['json']['mobile'], '9876543210')
        self.assertEqual(kwargs['json']['otp_id'], 'mock_otp_template_456')
        self.assertEqual(kwargs['json']['otp'], '123456')

    @patch('requests.post')
    def test_send_fast2sms_otp_provider_error(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.status_code = 400
        mock_resp.json.return_value = {
            'return': False,
            'status_code': 424,
            'message': 'Invalid OTP ID'
        }
        mock_post.return_value = mock_resp

        with self.assertRaises(ValidationError) as ctx:
            send_fast2sms_otp('+919876543210', '123456')
        self.assertIn('Invalid OTP ID', str(ctx.exception))

    @patch('requests.post')
    def test_verify_fast2sms_otp_success(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            'return': True,
            'status_code': 200,
            'message': 'OTP verified successfully'
        }
        mock_post.return_value = mock_resp

        ok, msg = verify_fast2sms_otp('+919876543210', '123456')
        self.assertTrue(ok)
        self.assertEqual(msg, 'OTP verified successfully')

        args, kwargs = mock_post.call_args
        self.assertEqual(args[0], 'https://www.fast2sms.com/dev/otp/verify')
        self.assertEqual(kwargs['headers']['authorization'], 'fast2sms_mock_secret_key_123')
        self.assertEqual(kwargs['json']['mobile'], '9876543210')
        self.assertEqual(kwargs['json']['otp'], '123456')

    @patch('requests.post')
    def test_verify_fast2sms_otp_rejection(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.status_code = 400
        mock_resp.json.return_value = {
            'return': False,
            'status_code': 400,
            'message': 'Invalid OTP'
        }
        mock_post.return_value = mock_resp

        ok, msg = verify_fast2sms_otp('+919876543210', '999999')
        self.assertFalse(ok)
        self.assertIn('Invalid OTP', msg)

    @patch('requests.post')
    def test_end_to_end_farmer_phone_verification(self, mock_post):
        # 1. Create challenge (Send OTP)
        mock_send = MagicMock()
        mock_send.status_code = 200
        mock_send.json.return_value = {'return': True, 'request_id': 'req_farmer_1', 'message': ['Sent']}
        mock_post.return_value = mock_send

        challenge = create_challenge(self.farmer, 'PHONE')
        self.assertIsNotNone(challenge)
        self.assertFalse(self.farmer.phone_verified)

        # Resend within 90s must be throttled
        with self.assertRaises(Throttled):
            create_challenge(self.farmer, 'PHONE')

        # 2. Failed verification attempt (provider rejects)
        mock_verify_fail = MagicMock()
        mock_verify_fail.status_code = 400
        mock_verify_fail.json.return_value = {'return': False, 'status_code': 400, 'message': 'Invalid OTP'}
        mock_post.return_value = mock_verify_fail

        with self.assertRaises(ValidationError):
            consume_challenge(self.farmer, challenge.id, '000000', 'PHONE')
        
        challenge.refresh_from_db()
        self.assertEqual(challenge.attempts, 1)
        self.farmer.refresh_from_db()
        self.assertFalse(self.farmer.phone_verified)

        # 3. Successful verification attempt (provider confirms)
        # To test success, we need the matching token that was generated for challenge
        # Let's inspect the code sent to Fast2SMS
        call_json = mock_post.call_args[1]['json']
        # The first call to mock_post was send_fast2sms_otp
        # Let's grab the generated code from mock_post's first call
        first_call = mock_post.call_args_list[0]
        actual_code = first_call[1]['json']['otp']

        mock_verify_success = MagicMock()
        mock_verify_success.status_code = 200
        mock_verify_success.json.return_value = {'return': True, 'status_code': 200, 'message': 'OTP verified successfully'}
        mock_post.return_value = mock_verify_success

        verified_user = consume_challenge(self.farmer, challenge.id, actual_code, 'PHONE')
        self.assertIsNotNone(verified_user)
        self.farmer.refresh_from_db()
        self.assertTrue(self.farmer.phone_verified)

    @patch('requests.post')
    def test_buyer_and_transporter_phone_verification(self, mock_post):
        for user in [self.buyer, self.transporter]:
            mock_send = MagicMock()
            mock_send.status_code = 200
            mock_send.json.return_value = {'return': True, 'request_id': f'req_{user.role}', 'message': ['Sent']}
            mock_post.return_value = mock_send

            challenge = create_challenge(user, 'PHONE')
            actual_code = mock_post.call_args[1]['json']['otp']

            mock_verify = MagicMock()
            mock_verify.status_code = 200
            mock_verify.json.return_value = {'return': True, 'status_code': 200, 'message': 'OTP verified successfully'}
            mock_post.return_value = mock_verify

            consume_challenge(user, challenge.id, actual_code, 'PHONE')
            user.refresh_from_db()
            self.assertTrue(user.phone_verified, f"{user.role} phone_verified should be True")
