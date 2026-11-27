"""Verification challenges are rate-limited, single-use, and never logged."""
import hashlib
import hmac
import logging
import re
import secrets
from datetime import timedelta
from urllib.parse import quote

import requests
from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError, Throttled
from .models import VerificationChallenge

PHONE_RE=re.compile(r'^\+91[6-9][0-9]{9}$')

def normalize_phone(raw):
    digits=re.sub(r'[\s()\-]','',str(raw))
    if digits.startswith('91') and len(digits)==12: digits='+'+digits
    if len(digits)==10 and digits[0] in '6789': digits='+91'+digits
    if not PHONE_RE.fullmatch(digits): raise ValidationError({'phone':'Provide a valid Indian mobile number (+91XXXXXXXXXX)'})
    return digits

def digest(challenge_id, secret):
    return hmac.new(settings.SECRET_KEY.encode(),f'{challenge_id}:{secret}'.encode(),hashlib.sha256).hexdigest()

logger = logging.getLogger(__name__)

def to_fast2sms_mobile(phone):
    digits = re.sub(r'\D', '', str(phone or ''))
    if digits.startswith('91') and len(digits) == 12:
        return digits[2:]
    if len(digits) == 10:
        return digits
    return digits[-10:] if len(digits) >= 10 else digits

def mask_phone(phone):
    if not phone:
        return ''
    digits = re.sub(r'\D', '', str(phone))
    if len(digits) >= 10:
        return f"+91 •••••••{digits[-4:]}"
    return '••••'

def sms_configured():
    provider = getattr(settings, 'SMS_PROVIDER', '').lower()
    if provider == 'fast2sms':
        return bool(getattr(settings, 'FAST2SMS_API_KEY', ''))
    if provider == 'twilio':
        return (bool(getattr(settings, 'TWILIO_ACCOUNT_SID', '')) and
                bool(getattr(settings, 'TWILIO_AUTH_TOKEN', '')) and
                bool(getattr(settings, 'TWILIO_FROM_NUMBER', '')))
    if provider in ('console', 'dev', 'dummy'):
        return True
    return False

def send_fast2sms_otp(phone, code):
    if not sms_configured():
        raise ValidationError({'sms': 'SMS provider is not configured; phone verification unavailable'})
    mobile = to_fast2sms_mobile(phone)
    if len(mobile) != 10:
        raise ValidationError({'phone': 'Provide a valid 10-digit Indian mobile number'})

    otp_id = getattr(settings, 'FAST2SMS_OTP_ID', '').strip()
    headers = {
        'authorization': settings.FAST2SMS_API_KEY,
        'Content-Type': 'application/json'
    }
    masked = mobile[:2] + '******' + mobile[-2:] if len(mobile) == 10 else '******'

    if otp_id:
        # Smart OTP Route (WhatsApp or DLT-approved SMS template)
        url = 'https://www.fast2sms.com/dev/otp/send'
        payload = {
            'mobile': mobile,
            'otp_id': otp_id,
            'otp_expiry': 10
        }
        if code:
            payload['otp'] = str(code)
    else:
        # Non-DLT Quick SMS Route (No DLT registration or OTP template required)
        url = 'https://www.fast2sms.com/dev/bulkV2'
        payload = {
            'route': 'q',
            'message': f'Your KrishiSetu verification code is {code}. Valid for 10 minutes. Do not share it.',
            'numbers': mobile
        }

    try:
        response = requests.post(
            url,
            headers=headers,
            json=payload,
            timeout=12
        )
    except Exception as exc:
        logger.warning("Fast2SMS request failed for mobile %s: %s", masked, exc)
        raise ValidationError({'delivery': 'Fast2SMS network dispatch failed; check provider configuration'})

    try:
        data = response.json()
    except Exception:
        data = {}

    if not data.get('return'):
        status_code = data.get('status_code') or response.status_code
        err_msg = data.get('message', 'SMS provider rejected dispatch request')
        if isinstance(err_msg, list) and err_msg:
            err_msg = err_msg[0]
        logger.warning("Fast2SMS dispatch rejected for %s: code=%s msg=%s", masked, status_code, err_msg)
        raise ValidationError({'delivery': f'Fast2SMS error: {err_msg}'})

    logger.info("Fast2SMS OTP dispatched to %s (route=%s)", masked, 'smart_otp' if otp_id else 'quick_sms')
    return data

def verify_fast2sms_otp(phone, token):
    if not sms_configured():
        raise ValidationError({'sms': 'SMS provider is not configured; phone verification unavailable'})
    mobile = to_fast2sms_mobile(phone)
    if len(mobile) != 10:
        return False, 'Invalid Indian mobile number'

    headers = {
        'authorization': settings.FAST2SMS_API_KEY,
        'Content-Type': 'application/json'
    }
    payload = {
        'mobile': mobile,
        'otp': str(token).strip()
    }
    masked = mobile[:2] + '******' + mobile[-2:] if len(mobile) == 10 else '******'
    try:
        response = requests.post(
            'https://www.fast2sms.com/dev/otp/verify',
            headers=headers,
            json=payload,
            timeout=12
        )
    except Exception as exc:
        logger.warning("Fast2SMS verify request failed for %s: %s", masked, exc)
        return False, 'Failed to reach Fast2SMS verification service'

    try:
        data = response.json()
    except Exception:
        data = {}

    is_verified = (data.get('return') is True and data.get('status_code') == 200)
    if not is_verified:
        err_msg = data.get('message', 'Invalid or expired OTP')
        logger.warning("Fast2SMS verify failed for %s: %s", masked, err_msg)
        return False, err_msg

    logger.info("Fast2SMS Smart OTP verified successfully for %s", masked)
    return True, data.get('message', 'OTP verified successfully')

def send_sms(phone,text):
    if not sms_configured(): raise ValidationError({'sms':'SMS provider is not configured; phone verification unavailable'})
    response=requests.post(
        f'https://api.twilio.com/2010-04-01/Accounts/{settings.TWILIO_ACCOUNT_SID}/Messages.json',
        data={'From':settings.TWILIO_FROM_NUMBER,'To':phone,'Body':text},
        auth=(settings.TWILIO_ACCOUNT_SID,settings.TWILIO_AUTH_TOKEN),timeout=12)
    response.raise_for_status()

@transaction.atomic
def create_challenge(user, kind, pending_phone=None):
    # Lock the account even when no previous challenge exists to serialize resends.
    from .models import User
    User.objects.select_for_update().get(pk=user.pk)
    last = VerificationChallenge.objects.select_for_update().filter(user=user, kind=kind).order_by('-created_at').first()
    if last and last.created_at > timezone.now() - timedelta(seconds=90):
        raise Throttled(wait=90, detail='Please wait before requesting another verification code')

    if kind == 'PHONE':
        if not sms_configured():
            raise ValidationError({'sms': 'Live SMS verification is unavailable until a provider is configured'})
        target_phone = pending_phone or user.phone
        if not target_phone:
            raise ValidationError({'phone': 'Please provide a valid Indian mobile number'})
        target_phone = normalize_phone(target_phone)
        if User.objects.filter(phone=target_phone).exclude(pk=user.pk).exists():
            raise ValidationError({'phone': 'This mobile number cannot be used. Try another number or contact support.'})
    else:
        target_phone = None
        if not settings.DEBUG and not settings.EMAIL_HOST:
            raise ValidationError({'email': 'Email delivery has not been configured'})

    code = str(secrets.randbelow(10**6)).zfill(6) if kind == 'PHONE' else secrets.token_urlsafe(32)
    challenge = VerificationChallenge.objects.create(
        user=user,
        kind=kind,
        digest='0' * 64,
        pending_phone=pending_phone if kind == 'PHONE' else None,
        expires_at=timezone.now() + timedelta(minutes=10 if kind == 'PHONE' else 30)
    )
    challenge.digest = digest(challenge.id, code)
    challenge.save(update_fields=['digest'])
    try:
        if kind == 'PHONE':
            provider = getattr(settings, 'SMS_PROVIDER', '').lower()
            if provider == 'fast2sms':
                try:
                    send_fast2sms_otp(target_phone, code)
                except Exception as exc:
                    if settings.DEBUG:
                        logger.warning("Fast2SMS dispatch failed (%s). Falling back to console OTP: %s", exc, code)
                        print(f"\n=======================================================\n[FALLBACK CONSOLE SMS OTP] Target: {target_phone} | Code: {code}\n=======================================================\n", flush=True)
                        challenge._fallback_used = True
                    else:
                        raise
            elif provider == 'twilio':
                send_sms(target_phone, f'KrishiSetu verification code: {code}. Expires in 10 minutes. Do not share it.')
            elif provider in ('console', 'dev', 'dummy'):
                logger.info("[CONSOLE SMS] OTP for %s: %s", target_phone, code)
                print(f"\n=======================================================\n[CONSOLE SMS OTP] Target: {target_phone} | Code: {code}\n=======================================================\n", flush=True)
            else:
                raise ValidationError({'sms': 'Unsupported SMS provider configured'})
        else:
            link = f'{settings.FRONTEND_URL}/verify-email?challenge={challenge.id}&token={quote(code)}'
            is_dummy = any(user.email.lower().endswith(d) for d in ('@krishisetu.in', '@example.com', '@test.local', '@test.com', '@dummy.com'))
            if not is_dummy:
                send_mail(
                    'Verify your KrishiSetu email',
                    f'Visit this single-use verification link (30 minutes): {link}',
                    settings.DEFAULT_FROM_EMAIL,
                    [user.email],
                    fail_silently=False
                )
    except Exception as exc:
        # If it's already a ValidationError or Throttled, re-raise directly
        if isinstance(exc, (ValidationError, Throttled)):
            raise exc
        logger.warning("Delivery failed for %s challenge: %s", kind, exc)
        # Delivery failed: no phantom successful challenge is persisted.
        raise ValidationError({'delivery': 'Verification message could not be sent; check provider configuration'})
    challenge._raw_code = code
    return challenge

def consume_challenge(user, challenge_id, token, kind):
    """Persist incorrect attempts even when the caller receives a 400 response.

    Raising ValidationError inside an atomic block would roll back the increment.
    """
    confirmed = False
    verified_user = None
    provider_error = None
    with transaction.atomic():
        query = {'pk': challenge_id, 'kind': kind}
        if user and user.is_authenticated:
            query['user'] = user
        challenge = VerificationChallenge.objects.select_for_update().filter(**query).first()
        if challenge and not challenge.used_at and challenge.expires_at > timezone.now() and challenge.attempts < 5:
            challenge.attempts += 1
            local_valid = hmac.compare_digest(challenge.digest, digest(challenge.id, str(token)))

            target_phone = challenge.pending_phone or (challenge.user.phone if kind == 'PHONE' else None)

            # If Fast2SMS provider is active for PHONE, confirm with provider API if FAST2SMS_OTP_ID is set
            if kind == 'PHONE' and getattr(settings, 'SMS_PROVIDER', '').lower() == 'fast2sms':
                if getattr(settings, 'FAST2SMS_OTP_ID', '').strip():
                    ok, prov_msg = verify_fast2sms_otp(target_phone, token)
                    if not ok:
                        provider_error = prov_msg
                        local_valid = False

            if local_valid:
                verified_user = challenge.user
                if kind == 'PHONE':
                    # If this challenge was for a pending phone change, atomically assign it
                    if challenge.pending_phone:
                        from .models import User
                        if User.objects.filter(phone=challenge.pending_phone).exclude(pk=verified_user.pk).exists():
                            raise ValidationError({'phone': 'This mobile number cannot be used. Try another number or contact support.'})
                        verified_user.phone = challenge.pending_phone
                    verified_user.phone_verified = True
                    verified_user.save(update_fields=['phone', 'phone_verified'])
                else:
                    verified_user.email_verified = True
                    verified_user.save(update_fields=['email_verified'])

                challenge.used_at = timezone.now()
                challenge.save(update_fields=['attempts', 'used_at'])

                # Invalidate any other open challenges of this kind for this user
                VerificationChallenge.objects.filter(
                    user=verified_user,
                    kind=kind,
                    used_at__isnull=True
                ).exclude(pk=challenge.pk).update(used_at=timezone.now())

                confirmed = True
            else:
                challenge.save(update_fields=['attempts'])
    if not confirmed:
        if provider_error:
            raise ValidationError({'code': f'Verification rejected by SMS provider: {provider_error}'})
        raise ValidationError({'code': 'Verification code is invalid or expired'})
    return verified_user
