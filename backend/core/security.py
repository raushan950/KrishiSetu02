"""Verification challenges are rate-limited, single-use, and never logged."""
import hashlib
import hmac
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

def sms_configured():
    return (settings.SMS_PROVIDER=='twilio' and bool(settings.TWILIO_ACCOUNT_SID) and
            bool(settings.TWILIO_AUTH_TOKEN) and bool(settings.TWILIO_FROM_NUMBER))

def send_sms(phone,text):
    if not sms_configured(): raise ValidationError({'sms':'SMS provider is not configured; phone verification unavailable'})
    response=requests.post(
        f'https://api.twilio.com/2010-04-01/Accounts/{settings.TWILIO_ACCOUNT_SID}/Messages.json',
        data={'From':settings.TWILIO_FROM_NUMBER,'To':phone,'Body':text},
        auth=(settings.TWILIO_ACCOUNT_SID,settings.TWILIO_AUTH_TOKEN),timeout=12)
    response.raise_for_status()

@transaction.atomic
def create_challenge(user,kind):
    # Lock the account even when no previous challenge exists to serialize resends.
    from .models import User
    User.objects.select_for_update().get(pk=user.pk)
    last=VerificationChallenge.objects.select_for_update().filter(user=user,kind=kind).order_by('-created_at').first()
    if last and last.created_at>timezone.now()-timedelta(seconds=90):
        raise Throttled(wait=90,detail='Please wait before requesting another verification code')
    if kind=='PHONE' and not sms_configured():
        raise ValidationError({'sms':'Live SMS verification is unavailable until a provider is configured'})
    if kind=='EMAIL' and not settings.DEBUG and not settings.EMAIL_HOST:
        raise ValidationError({'email':'Email delivery has not been configured'})
    code=str(secrets.randbelow(10**6)).zfill(6) if kind=='PHONE' else secrets.token_urlsafe(32)
    challenge=VerificationChallenge.objects.create(user=user,kind=kind,digest='0'*64,
                              expires_at=timezone.now()+timedelta(minutes=10 if kind=='PHONE' else 30))
    challenge.digest=digest(challenge.id,code)
    challenge.save(update_fields=['digest'])
    try:
        if kind=='PHONE':
            send_sms(user.phone,f'KrishiSetu verification code: {code}. Expires in 10 minutes. Do not share it.')
        else:
            link=f'{settings.FRONTEND_URL}/verify-email?challenge={challenge.id}&token={quote(code)}'
            send_mail('Verify your KrishiSetu email',f'Visit this single-use verification link (30 minutes): {link}',
                      settings.DEFAULT_FROM_EMAIL,[user.email],fail_silently=False)
    except Exception:
        # Delivery failed: no phantom successful challenge is persisted.
        raise ValidationError({'delivery':'Verification message could not be sent; check provider configuration'})
    return challenge

def consume_challenge(user,challenge_id,token,kind):
    """Persist incorrect attempts even when the caller receives a 400 response.

    Raising ValidationError inside an atomic block would roll back the increment.
    """
    confirmed=False
    with transaction.atomic():
        challenge=VerificationChallenge.objects.select_for_update().filter(
            pk=challenge_id,user=user,kind=kind).first()
        if challenge and not challenge.used_at and challenge.expires_at>timezone.now() and challenge.attempts<5:
            challenge.attempts+=1
            if hmac.compare_digest(challenge.digest,digest(challenge.id,str(token))):
                challenge.used_at=timezone.now()
                challenge.save(update_fields=['attempts','used_at'])
                if kind=='PHONE': user.phone_verified=True; fields=['phone_verified']
                else: user.email_verified=True; fields=['email_verified']
                user.save(update_fields=fields)
                confirmed=True
            else:
                challenge.save(update_fields=['attempts'])
    if not confirmed:
        raise ValidationError({'code':'Verification code is invalid or expired'})
    return True
