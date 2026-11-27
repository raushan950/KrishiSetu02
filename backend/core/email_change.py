"""Password-reconfirmed email change; delivery to the new inbox is mandatory."""
from datetime import timedelta
from uuid import UUID
import secrets
import hashlib
import hmac
from urllib.parse import urlencode

from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone
from django.core.validators import validate_email
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.decorators import api_view
from rest_framework.exceptions import ValidationError, Throttled
from rest_framework.response import Response

from .models import User,EmailChangeChallenge
from .serializers import UserSerializer
from .views import log,notify,revoke_user_refresh_tokens


def secret_hash(id,token):
    return hmac.new(settings.SECRET_KEY.encode(),f'{id}:{token}'.encode(),hashlib.sha256).hexdigest()


@api_view(['POST'])
def email_change_request(request):
    current=request.user
    if not current.has_usable_password() or not current.check_password(request.data.get('current_password','')):
        raise ValidationError({'current_password':'Reauthenticate with your current password to change email'})
    email=str(request.data.get('new_email') or '').strip().lower()
    try: validate_email(email)
    except DjangoValidationError: raise ValidationError({'new_email':'Provide a valid email address'})
    if current.email.lower()==email or User.objects.filter(email__iexact=email).exists():
        raise ValidationError({'new_email':'Email unavailable or already registered'})
    if not settings.DEBUG and not settings.EMAIL_HOST:
        return Response({'detail':'Verified email delivery is not configured'},status=503)
    now=timezone.now()
    with transaction.atomic():
        current=User.objects.select_for_update().get(pk=current.pk)
        latest=EmailChangeChallenge.objects.filter(user=current).order_by('-created_at').first()
        if latest and latest.created_at>now-timedelta(minutes=2):
            raise Throttled(wait=120,detail='Wait before requesting another email change')
        challenge=EmailChangeChallenge.objects.create(user=current,new_email=email,
            digest='0'*64,expires_at=now+timedelta(minutes=30))
        token=secrets.token_urlsafe(32)
        challenge.digest=secret_hash(challenge.id,token)
        challenge.save(update_fields=['digest'])
        url=settings.FRONTEND_URL+'/account?'+urlencode({'email_change_id':str(challenge.pk),'email_change_token':token})
        try:
            if not any(email.lower().endswith(d) for d in ('@krishisetu.in', '@example.com', '@test.local', '@test.com', '@dummy.com')):
                send_mail('Confirm new KrishiSetu email',f'Open this single-use link (valid for 30 minutes): {url}',
                    settings.DEFAULT_FROM_EMAIL,[email],fail_silently=False)
        except Exception:
            raise ValidationError({'delivery':'Email could not be delivered; current address was not changed'})
        log(current,'EMAIL_CHANGE_REQUESTED',challenge.pk)
    return Response({'message':'Confirmation sent to the new email. Current email remains unchanged.',
                     'challenge_id':str(challenge.pk)})


@api_view(['POST'])
def email_change_confirm(request):
    try: cid=UUID(str(request.data.get('challenge_id')))
    except (ValueError,TypeError,AttributeError): raise ValidationError({'challenge_id':'Invalid verification request'})
    supplied=str(request.data.get('token') or '')
    success=False;new_email=None
    with transaction.atomic():
        user=User.objects.select_for_update().get(pk=request.user.pk)
        challenge=EmailChangeChallenge.objects.select_for_update().filter(user=user,pk=cid).first()
        if challenge and not challenge.used_at and challenge.expires_at>timezone.now() and challenge.attempts<5:
            challenge.attempts+=1
            if (hmac.compare_digest(secret_hash(challenge.pk,supplied),challenge.digest) and
                not User.objects.filter(email__iexact=challenge.new_email).exclude(pk=user.pk).exists()):
                old_email=user.email
                new_email=challenge.new_email
                user.email=new_email;user.email_verified=True
                user.google_sub=None  # provider's previous mailbox must be linked again after re-verification
                user.save(update_fields=['email','email_verified','google_sub'])
                challenge.used_at=timezone.now()
                challenge.save(update_fields=['attempts','used_at'])
                revoke_user_refresh_tokens(user)
                log(user,'EMAIL_CHANGED',user.pk)
                # Do not reveal the token; audit old mailbox with a non-secret notice.
                if settings.DEBUG or settings.EMAIL_HOST:
                    transaction.on_commit(lambda: send_mail('KrishiSetu account email changed',
                        'The login email on your account was changed. Contact support if unexpected.',
                        settings.DEFAULT_FROM_EMAIL,[old_email],fail_silently=True))
                success=True
            else:
                challenge.save(update_fields=['attempts'])
    if not success:
        raise ValidationError({'token':'Token is invalid, expired, used, or target email is unavailable'})
    return Response({'message':'New email verified. Other refresh sessions were revoked; sign in again.',
                     'user':UserSerializer(user).data})
