"""Versioned REST endpoints, object permissions and atomic trade transitions."""
from datetime import timedelta
import hashlib
import hmac
import json
import requests
from django.http import FileResponse
from decimal import ROUND_HALF_UP
from decimal import Decimal
from io import BytesIO
from types import SimpleNamespace

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.db import IntegrityError, transaction
from django.db.models import Count, Avg, Sum, F, Q
from django.http import JsonResponse
from django.utils import timezone
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from django.utils.encoding import force_bytes
from django.core.mail import send_mail
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.generics import ListAPIView
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework.exceptions import PermissionDenied, ValidationError, NotFound, Throttled
from rest_framework_simplejwt.tokens import RefreshToken
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from PIL import Image

from .calculations import net_return, dec
from .models import (User, Farm, Crop, Market, MandiPrice, Listing, Offer, Order,
                     Vehicle, FreightRequest, FreightQuote, Shipment, Settlement,
                     Notification, AuditEvent, PriceAlert, PaymentAttempt, PaymentWebhookEvent, RefundRequest, ShipmentEvent)
from .security import create_challenge, consume_challenge, normalize_phone
from .serializers import (UserSerializer,RegisterSerializer,FarmSerializer,CropSerializer,MarketSerializer,
    MandiPriceSerializer,ListingSerializer,OfferSerializer,OrderSerializer,VehicleSerializer,
    FreightRequestSerializer,FreightQuoteSerializer,ShipmentSerializer,SettlementSerializer,NotificationSerializer,ShipmentEventSerializer)


class ThrottledTokenObtainPairView(TokenObtainPairView):
    throttle_classes=[ScopedRateThrottle]
    throttle_scope='login'


def health(request):
    from django.db import connection
    try:
        connection.ensure_connection()
        return JsonResponse({'status':'ok','database':'connected'})
    except Exception:
        return JsonResponse({'status':'unhealthy','database':'unavailable'},status=503)

def require_role(user,*roles):
    if not user.is_authenticated or user.role not in roles: raise PermissionDenied('Your role is not permitted')

def require_trade(user,*roles):
    require_role(user,*roles)
    if not user.account_verified: raise PermissionDenied('Verify both your email and mobile number first')

def log(user,event,obj,**details):
    AuditEvent.objects.create(actor=user,event=event,object_id=str(obj),details=details)

def notify(user,category,message):
    Notification.objects.create(recipient=user,category=category,message=message[:300])

def token_pair(user):
    refresh=RefreshToken.for_user(user)
    return {'access':str(refresh.access_token),'refresh':str(refresh)}

@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    serializer=RegisterSerializer(data=request.data); serializer.is_valid(raise_exception=True)
    with transaction.atomic():
        user=serializer.save()
        create_challenge(user,'EMAIL')
        log(user,'REGISTER',user.pk)
    return Response({'user':UserSerializer(user).data,'tokens':token_pair(user),
        'message':'Check your email for a single-use verification link. Verify phone separately.'},status=201)

@api_view(['GET','PATCH'])
def me(request):
    if request.method=='GET': return Response(UserSerializer(request.user).data)
    serializer=UserSerializer(request.user,data=request.data,partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    log(request.user,'PROFILE_UPDATED',request.user.pk)
    return Response(serializer.data)

@api_view(['POST'])
def verification_request(request):
    kind=request.data.get('kind')
    if kind not in ('EMAIL','PHONE'): raise ValidationError({'kind':'EMAIL or PHONE required'})
    if kind=='PHONE' and not request.user.phone: raise ValidationError({'phone':'Set phone number in your profile first'})
    if kind=='EMAIL' and request.user.email_verified or kind=='PHONE' and request.user.phone_verified:
        return Response({'message':'Already verified'})
    challenge=create_challenge(request.user,kind)
    return Response({'message':'Verification sent through configured provider','kind':kind, 'challenge_id':str(challenge.id)})

@api_view(['POST'])
def verification_confirm(request):
    kind=request.data.get('kind')
    if kind not in ('EMAIL','PHONE'): raise ValidationError({'kind':'EMAIL or PHONE required'})
    consume_challenge(request.user,request.data.get('challenge_id'),request.data.get('token'),kind)
    log(request.user,'VERIFIED_'+kind,request.user.pk)
    return Response({'user':UserSerializer(request.user).data})

@api_view(['POST'])
@permission_classes([AllowAny])
def password_reset_request(request):
    throttle=ScopedRateThrottle();throttle.scope='password_reset'
    if not throttle.allow_request(request,SimpleNamespace(throttle_scope='password_reset')): raise Throttled(wait=throttle.wait())
    email=str(request.data.get('email','')).strip().lower()
    user=User.objects.filter(email=email,is_active=True).first()
    if user:
        uid=urlsafe_base64_encode(force_bytes(user.pk))
        token=default_token_generator.make_token(user)
        url=f'{settings.FRONTEND_URL}/reset-password?uid={uid}&token={token}'
        if settings.DEBUG or settings.EMAIL_HOST:
            send_mail('Reset your KrishiSetu password',f'Reset link: {url}',settings.DEFAULT_FROM_EMAIL,[user.email],fail_silently=False)
    return Response({'message':'If the email is registered and delivery is configured, a reset link has been sent'})

@api_view(['POST'])
@permission_classes([AllowAny])
def password_reset_confirm(request):
    try:
        uid=force_str(urlsafe_base64_decode(request.data.get('uid','')))
        user=User.objects.get(pk=uid)
    except (ValueError, TypeError, OverflowError, User.DoesNotExist):
        raise ValidationError({'token':'Invalid or expired reset link'})
    if not default_token_generator.check_token(user,request.data.get('token','')):
        raise ValidationError({'token':'Invalid or expired reset link'})
    password=request.data.get('password','')
    validate_password(password,user)
    user.set_password(password); user.save(update_fields=['password'])
    revoke_user_refresh_tokens(user)
    log(user,'PASSWORD_RESET',user.pk)
    return Response({'message':'Password updated. Sign in again.'})

def revoke_user_refresh_tokens(user):
    # Requires simplejwt.token_blacklist in INSTALLED_APPS; access JWTs remain
    # valid until their short (15-minute) expiration.
    from rest_framework_simplejwt.token_blacklist.models import OutstandingToken,BlacklistedToken
    for token in OutstandingToken.objects.filter(user=user):
        BlacklistedToken.objects.get_or_create(token=token)


@api_view(['POST'])
def change_password(request):
    current=request.data.get('current_password','')
    if not request.user.check_password(current):
        raise ValidationError({'current_password':'Current password is incorrect'})
    password=request.data.get('new_password','')
    validate_password(password,request.user)
    if current==password:
        raise ValidationError({'new_password':'New password must differ from the current password'})
    request.user.set_password(password)
    request.user.save(update_fields=['password'])
    revoke_user_refresh_tokens(request.user)
    log(request.user,'PASSWORD_CHANGED',request.user.pk)
    return Response({'message':'Password changed; existing refresh tokens have been revoked. Sign in again on other devices.'})


@api_view(['POST'])
def logout(request):
    from rest_framework_simplejwt.tokens import RefreshToken
    try: RefreshToken(request.data['refresh']).blacklist()
    except Exception: raise ValidationError({'refresh':'Invalid refresh token'})
    return Response({'message':'Refresh token revoked. Discard access token locally.'})

def verified_google_claim(credential):
    if not settings.GOOGLE_CLIENT_ID: raise ValidationError({'google':'Google login is not configured'})
    try:
        data=id_token.verify_oauth2_token(credential,google_requests.Request(),settings.GOOGLE_CLIENT_ID)
    except Exception: raise ValidationError({'google':'Google credential could not be validated'})
    if data.get('iss') not in ('accounts.google.com','https://accounts.google.com') or not data.get('email_verified'):
        raise ValidationError({'google':'The Google email must be verified'})
    if not data.get('sub') or not data.get('email'): raise ValidationError({'google':'Missing verified Google identity'})
    return data

@api_view(['POST'])
@permission_classes([AllowAny])
def google_login(request):
    claim=verified_google_claim(request.data.get('credential',''))
    user=User.objects.filter(google_sub=claim['sub']).first()
    if not user:
        email=claim['email'].strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise ValidationError({'google':'Account exists. Sign in with your password, then link Google in account settings.'})
        user=User.objects.create_user(email=email,role='FARMER',email_verified=True,first_name=claim.get('given_name','')[:150])
        user.set_unusable_password(); user.save(update_fields=['password'])
        user.google_sub=claim['sub']; user.save(update_fields=['google_sub'])
        log(user,'GOOGLE_ACCOUNT_CREATED',user.pk)
    if not user.is_active: raise PermissionDenied('Account disabled')
    return Response({'user':UserSerializer(user).data,'tokens':token_pair(user)})

@api_view(['POST'])
def google_link(request):
    claim=verified_google_claim(request.data.get('credential',''))
    user=request.user
    if not user.email_verified or user.email.lower()!=claim['email'].strip().lower():
        raise ValidationError({'google':'Verify your account email and use the same verified Google email'})
    if User.objects.filter(google_sub=claim['sub']).exclude(pk=user.pk).exists():
        raise ValidationError({'google':'Google account already belongs to another user'})
    if user.google_sub and user.google_sub!=claim['sub']:
        raise ValidationError({'google':'Another Google account is already linked'})
    user.google_sub=claim['sub']; user.save(update_fields=['google_sub'])
    log(user,'GOOGLE_LINKED',user.pk)
    return Response({'message':'Google account linked'})

class Crops(ListAPIView):
    permission_classes=[AllowAny]; queryset=Crop.objects.all().order_by('name'); serializer_class=CropSerializer
class Markets(ListAPIView):
    permission_classes=[AllowAny]; serializer_class=MarketSerializer
    def get_queryset(self):
        qs=Market.objects.order_by('state','district','name')
        if self.request.query_params.get('district'): qs=qs.filter(district__icontains=self.request.query_params['district'])
        if self.request.query_params.get('state'): qs=qs.filter(state__icontains=self.request.query_params['state'])
        return qs
class Prices(ListAPIView):
    permission_classes=[AllowAny]; serializer_class=MandiPriceSerializer
    def get_queryset(self):
        qs=MandiPrice.objects.select_related('crop','market').filter(quality_status='VALID',observed_on__lte=timezone.localdate()).order_by('-observed_on','-id')
        for key,look in [('crop','crop_id'),('market','market_id')]:
            value=self.request.query_params.get(key)
            if value:
                if not value.isdecimal(): raise ValidationError({key:'Numeric id required'})
                qs=qs.filter(**{look:value})
        if self.request.query_params.get('state'): qs=qs.filter(market__state__icontains=self.request.query_params['state'])
        if self.request.query_params.get('date_from'): qs=qs.filter(observed_on__gte=self.request.query_params['date_from'])
        return qs

@api_view(['POST'])
@permission_classes([AllowAny])
def calculator(request):
    try:
        return Response(net_return(request.data.get('quantity_qtl'),request.data.get('price_per_qtl'),
                    request.data.get('costs',{}),request.data.get('loss_percent','0')))
    except ValueError as e: raise ValidationError({'calculation':str(e)})

@api_view(['POST'])
@permission_classes([AllowAny])
def compare_destinations(request):
    """Rank only source-backed destinations with caller-provided cost assumptions."""
    try:
        crop_id=int(request.data['crop_id']); qty=request.data['quantity_qtl']
        dec(qty,'quantity_qtl',positive=True)
    except (KeyError, ValueError, TypeError) as e:
        raise ValidationError({'input':'crop_id and positive quantity_qtl are required'})
    cost_map=request.data.get('costs_by_destination',{})
    if not isinstance(cost_map,dict): raise ValidationError({'costs_by_destination':'Expected map'})
    from .market_api import eligible_market_prices
    prices,truncated=eligible_market_prices(crop_id,
        state=str(request.data.get('state',''))[:120],
        district=str(request.data.get('district',''))[:120],
        variety=request.data.get('variety'),grade=request.data.get('grade'))
    options=[]; missing=[]; stale=[]
    for price in prices:
        key=f'market:{price.market_id}'
        if key not in cost_map:
            missing.append(key); continue
        try: result=net_return(qty,price.modal_price,cost_map[key].get('costs',{}),cost_map[key].get('loss_percent','0'))
        except (ValueError,AttributeError) as e: raise ValidationError({key:str(e)})
        options.append({'destination':key,'name':str(price.market),'kind':'MANDI',
            'variety':price.variety,'grade':price.grade,
            'source':price.source,'source_record_id':price.source_record_id,
            'observed_on':price.observed_on.isoformat(),
            'freshness_days':(timezone.localdate()-price.observed_on).days,
            'confidence':'OBSERVED_PRICE_ESTIMATED_COSTS','calculation':result})
    # Buyers are shown only to their listing's farmer, and only after account verification.
    if request.user.is_authenticated and request.user.role=='FARMER' and request.user.account_verified:
        offers=Offer.objects.filter(listing__farmer=request.user,listing__crop_id=crop_id,
            status='PENDING',expires_at__gt=timezone.now(),buyer__email_verified=True,buyer__phone_verified=True)
        if request.data.get('variety') is not None: offers=offers.filter(listing__variety__iexact=request.data['variety'])
        if request.data.get('grade') is not None: offers=offers.filter(listing__grade__iexact=request.data['grade'])
        if request.data.get('state'): offers=offers.filter(listing__state__iexact=request.data['state'])
        if request.data.get('district'): offers=offers.filter(listing__district__iexact=request.data['district'])
        for offer in offers.select_related('buyer')[:250]:
            key=f'offer:{offer.id}'
            if key not in cost_map: missing.append(key); continue
            if Decimal(str(qty))>offer.quantity_qtl: continue
            try: result=net_return(qty,offer.price_per_qtl,cost_map[key].get('costs',{}),cost_map[key].get('loss_percent','0'))
            except (ValueError,AttributeError) as e: raise ValidationError({key:str(e)})
            options.append({'destination':key,'name':'Direct offer '+str(offer.pk),'kind':'BUYER_OFFER',
                'source':'Account-verified buyer offer','observed_on':offer.created_at.date().isoformat(),
                'confidence':'OFFER_PENDING_NOT_GUARANTEED','calculation':result})
    options.sort(key=lambda o:Decimal(o['calculation']['net_inr']),reverse=True)
    return Response({'ranked':options,'recommended':options[0] if options else None,
        'missing_cost_inputs':missing,'excluded_stale_destinations':stale,
        'market_options_truncated':truncated,
        'disclaimer':'Prices older than seven days are excluded from ranking. Unquoted costs not inferred. Mandi observations are not executable bids. No route distance assumed.'})

@api_view(['GET','POST'])
def farms(request):
    require_role(request.user,'FARMER')
    if request.method=='GET': return Response(FarmSerializer(Farm.objects.filter(farmer=request.user),many=True).data)
    require_trade(request.user,'FARMER')
    s=FarmSerializer(data=request.data); s.is_valid(raise_exception=True)
    farm=s.save(farmer=request.user); log(request.user,'FARM_CREATED',farm.id)
    return Response(s.data,status=201)

def validate_image(file):
    if not file:return
    if file.size>5*1024*1024: raise ValidationError({'image':'Maximum image size is 5MB'})
    try:
        image=Image.open(file); image.verify()
        if image.format not in ('JPEG','PNG','WEBP'): raise ValueError('Unsupported image type')
    except Exception: raise ValidationError({'image':'A valid JPEG, PNG or WebP is required'})
    finally: file.seek(0)

@api_view(['GET','POST'])
@permission_classes([AllowAny])
def listings(request):
    if request.method=='GET':
        qs=Listing.objects.select_related('crop').filter(status='ACTIVE',quantity_qtl__gt=F('reserved_qtl')).order_by('-created_at')
        if request.query_params.get('crop'): qs=qs.filter(crop_id=request.query_params['crop'])
        if request.query_params.get('district'): qs=qs.filter(district__icontains=request.query_params['district'])
        from rest_framework.pagination import PageNumberPagination
        pg=PageNumberPagination(); page=pg.paginate_queryset(qs,request)
        return pg.get_paginated_response(ListingSerializer(page,many=True,context={'request':request}).data)
    require_trade(request.user,'FARMER')
    s=ListingSerializer(data=request.data,context={'request':request}); s.is_valid(raise_exception=True)
    validate_image(s.validated_data.get('image'))
    listing=s.save(farmer=request.user); log(request.user,'LISTING_CREATED',listing.id)
    return Response(ListingSerializer(listing,context={'request':request}).data,status=201)

@api_view(['GET'])
def my_listings(request):
    require_role(request.user,'FARMER')
    return Response(ListingSerializer(Listing.objects.filter(farmer=request.user).order_by('-created_at'),many=True,context={'request':request}).data)

@api_view(['GET','POST'])
def offers(request):
    if request.method=='GET':
        qs=Offer.objects.select_related('listing').filter(Q(buyer=request.user)|Q(listing__farmer=request.user)).distinct().order_by('-created_at')
        return Response(OfferSerializer(qs,many=True).data)
    require_trade(request.user,'BUYER')
    s=OfferSerializer(data=request.data); s.is_valid(raise_exception=True)
    listing=s.validated_data['listing']
    if listing.status!='ACTIVE' or listing.farmer_id==request.user.id: raise ValidationError({'listing':'Listing unavailable'})
    if s.validated_data['quantity_qtl']>listing.available_qtl: raise ValidationError({'quantity_qtl':'Exceeds currently available stock'})
    if s.validated_data['expires_at']<=timezone.now(): raise ValidationError({'expires_at':'Expiry must be in the future'})
    if s.validated_data.get('parent'): raise ValidationError({'parent':'Use the counter endpoint'})
    offer=s.save(buyer=request.user,proposed_by=request.user)
    notify(listing.farmer,'OFFER',f'New offer on listing #{listing.pk}')
    log(request.user,'OFFER_CREATED',offer.pk)
    return Response(OfferSerializer(offer).data,status=201)

@api_view(['POST'])
def counter_offer(request,pk):
    try: offer=Offer.objects.select_related('listing').get(pk=pk)
    except Offer.DoesNotExist: raise NotFound()
    require_trade(request.user,'BUYER','FARMER')
    if request.user.id not in (offer.buyer_id,offer.listing.farmer_id): raise PermissionDenied()
    if offer.status!='PENDING' or offer.expires_at<=timezone.now(): raise ValidationError({'offer':'Offer is no longer negotiable'})
    if offer.proposed_by_id==request.user.id: raise ValidationError({'offer':'Wait for the other party to respond'})
    try:
        qty=dec(request.data['quantity_qtl'],'quantity_qtl',positive=True)
        price=dec(request.data['price_per_qtl'],'price_per_qtl',positive=True)
    except (KeyError,ValueError) as e: raise ValidationError({'offer':str(e)})
    with transaction.atomic():
        offer=Offer.objects.select_for_update().get(pk=pk)
        listing=Listing.objects.select_for_update().get(pk=offer.listing_id)
        if offer.status!='PENDING' or offer.expires_at<=timezone.now():
            raise ValidationError({'offer':'Offer is expired or already updated'})
        if qty>listing.available_qtl: raise ValidationError({'quantity_qtl':'Exceeds available stock'})
        offer.status='SUPERSEDED';offer.save(update_fields=['status'])
        next_offer=Offer.objects.create(listing=offer.listing,buyer=offer.buyer,proposed_by=request.user,
            parent=offer,quantity_qtl=qty,price_per_qtl=price,expires_at=timezone.now()+timedelta(days=2))
        recipient=offer.buyer if request.user.id==offer.listing.farmer_id else offer.listing.farmer
        notify(recipient,'COUNTEROFFER',f'Counteroffer on listing #{offer.listing_id}')
        log(request.user,'OFFER_COUNTERED',next_offer.pk,parent=offer.pk)
    return Response(OfferSerializer(next_offer).data,status=201)

@api_view(['POST'])
def accept_offer(request,pk):
    require_trade(request.user,'FARMER','BUYER')
    with transaction.atomic():
        try: offer=Offer.objects.select_related('listing').get(pk=pk)
        except Offer.DoesNotExist: raise NotFound()
        listing=Listing.objects.select_for_update().get(pk=offer.listing_id)
        offer=Offer.objects.select_for_update().get(pk=pk)
        if request.user.id not in (listing.farmer_id,offer.buyer_id): raise PermissionDenied()
        if not listing.farmer.account_verified or not offer.buyer.account_verified:
            raise PermissionDenied('Both trading parties must have verified accounts')
        if offer.proposed_by_id==request.user.id: raise ValidationError({'offer':'Cannot accept your own proposed offer'})
        if offer.status!='PENDING' or offer.expires_at<=timezone.now(): raise ValidationError({'offer':'Offer is expired or not pending'})
        if listing.status!='ACTIVE' or offer.quantity_qtl>listing.available_qtl: raise ValidationError({'inventory':'Insufficient available quantity'})
        listing.reserved_qtl+=offer.quantity_qtl
        listing.save(update_fields=['reserved_qtl'])
        offer.status='ACCEPTED';offer.save(update_fields=['status'])
        order=Order.objects.create(offer=offer,listing=listing,farmer=listing.farmer,buyer=offer.buyer,
            quantity_qtl=offer.quantity_qtl,price_per_qtl=offer.price_per_qtl)
        notify(offer.buyer if request.user.id==listing.farmer_id else listing.farmer,'ORDER',f'Offer accepted. Order {order.pk}')
        log(request.user,'ORDER_CONFIRMED',order.pk,offer=offer.pk)
    return Response(OrderSerializer(order).data,status=201)

@api_view(['GET'])
def orders(request):
    qs=Order.objects.filter(Q(farmer=request.user)|Q(buyer=request.user)).order_by('-created_at')
    return Response(OrderSerializer(qs,many=True).data)

@api_view(['POST'])
def cancel_order(request,pk):
    """Retired unilateral cancellation route; use audited two-party change requests."""
    order=Order.objects.filter(pk=pk).first()
    if not order: raise NotFound()
    if request.user.pk not in (order.farmer_id,order.buyer_id): raise PermissionDenied()
    raise ValidationError({'order':'One-sided cancellation is not permitted. Create a CANCEL_REMAINDER proposal at /api/v1/order-changes/; the other participant must approve it.'})

@api_view(['GET','POST'])
def vehicles(request):
    require_role(request.user,'TRANSPORTER')
    if request.method=='GET': return Response(VehicleSerializer(Vehicle.objects.filter(transporter=request.user),many=True).data)
    require_trade(request.user,'TRANSPORTER')
    s=VehicleSerializer(data=request.data);s.is_valid(raise_exception=True)
    obj=s.save(transporter=request.user);log(request.user,'VEHICLE_SUBMITTED',obj.pk)
    return Response(VehicleSerializer(obj).data,status=201)

@api_view(['GET','POST'])
def freight_requests(request):
    if request.method=='GET':
        if request.user.role=='TRANSPORTER': qs=FreightRequest.objects.all()
        else: qs=FreightRequest.objects.filter(Q(order__farmer=request.user)|Q(order__buyer=request.user))
        return Response(FreightRequestSerializer(qs,many=True).data)
    require_trade(request.user,'FARMER','BUYER')
    s=FreightRequestSerializer(data=request.data);s.is_valid(raise_exception=True)
    order=s.validated_data['order']
    if request.user.pk not in (order.farmer_id,order.buyer_id) or order.status!='CONFIRMED': raise PermissionDenied()
    if s.validated_data['pickup_date']<timezone.localdate():
        raise ValidationError({'pickup_date':'Pickup date cannot be in the past'})
    try:
        with transaction.atomic():
            fr=s.save();log(request.user,'FREIGHT_REQUESTED',fr.pk)
    except IntegrityError as exc:
        raise ValidationError({'order':'Freight request already exists for this order'}) from exc
    return Response(FreightRequestSerializer(fr).data,status=201)

@api_view(['GET','POST'])
def freight_quotes(request):
    if request.method=='GET':
        qs=FreightQuote.objects.all() if request.user.role=='TRANSPORTER' else FreightQuote.objects.filter(
            Q(freight_request__order__farmer=request.user)|Q(freight_request__order__buyer=request.user))
        if request.user.role=='TRANSPORTER': qs=qs.filter(transporter=request.user)
        return Response(FreightQuoteSerializer(qs,many=True).data)
    require_trade(request.user,'TRANSPORTER')
    s=FreightQuoteSerializer(data=request.data);s.is_valid(raise_exception=True)
    vehicle=s.validated_data['vehicle']; fr=s.validated_data['freight_request']
    if vehicle.transporter_id!=request.user.id or not vehicle.verified: raise PermissionDenied('Only your administrator-verified vehicle can be quoted')
    if s.validated_data['price_inr']<=0: raise ValidationError({'price_inr':'Freight quote must be positive'})
    if vehicle.capacity_qtl<fr.order.quantity_qtl: raise ValidationError({'vehicle':'Insufficient vehicle capacity'})
    if fr.order.status!='CONFIRMED': raise ValidationError({'order':'Order unavailable'})
    quote=s.save(transporter=request.user)
    notify(fr.order.farmer,'FREIGHT_QUOTE',f'Freight quote received for order {fr.order_id}')
    log(request.user,'FREIGHT_QUOTED',quote.pk)
    return Response(FreightQuoteSerializer(quote).data,status=201)

@api_view(['POST'])
def assign_quote(request,pk):
    require_trade(request.user,'FARMER','BUYER')
    with transaction.atomic():
        quote=FreightQuote.objects.select_related('freight_request','vehicle','transporter').filter(pk=pk).first()
        if not quote: raise NotFound()
        order=Order.objects.select_for_update().get(pk=quote.freight_request.order_id)
        if request.user.pk not in (order.farmer_id,order.buyer_id): raise PermissionDenied()
        if order.status!='CONFIRMED': raise ValidationError({'order':'Order not assignable'})
        vehicle=Vehicle.objects.select_for_update().get(pk=quote.vehicle_id)
        if not vehicle.verified or not quote.transporter.account_verified:
            raise ValidationError({'vehicle':'Transporter and vehicle must be verified'})
        if vehicle.transporter_id!=quote.transporter_id or vehicle.capacity_qtl<order.quantity_qtl:
            raise ValidationError({'vehicle':'Vehicle ownership or capacity has changed'})
        if Shipment.objects.filter(order=order).exists():
            raise ValidationError({'shipment':'Carrier already assigned'})
        # Serialize assignments competing for the same truck/day using a row lock.
        conflict=Shipment.objects.filter(quote__vehicle=vehicle,
            quote__freight_request__pickup_date=quote.freight_request.pickup_date,
            status__in=['ASSIGNED','PICKED_UP','IN_TRANSIT']).exists()
        if conflict:
            raise ValidationError({'vehicle':'Vehicle already assigned to another active pickup on that date'})
        sh=Shipment.objects.create(order=order,quote=quote)
        ShipmentEvent.objects.create(shipment=sh,status='ASSIGNED',actor=request.user,
            note='Carrier assigned by trading participant')
        notify(quote.transporter,'SHIPMENT',f'Assigned to order {order.pk}')
        log(request.user,'CARRIER_ASSIGNED',sh.pk,quote=quote.pk)
    return Response(ShipmentSerializer(sh).data,status=201)

@api_view(['GET'])
def shipments(request):
    qs=Shipment.objects.filter(Q(order__farmer=request.user)|Q(order__buyer=request.user)|Q(quote__transporter=request.user)).distinct()
    return Response(ShipmentSerializer(qs,many=True).data)


@api_view(['GET'])
def shipment_events(request,pk):
    sh=Shipment.objects.select_related('order','quote').filter(pk=pk).first()
    if not sh: raise NotFound()
    if request.user.pk not in (sh.order.farmer_id,sh.order.buyer_id,sh.quote.transporter_id):
        raise PermissionDenied()
    events=ShipmentEvent.objects.filter(shipment=sh).order_by('recorded_at','pk')
    return Response(ShipmentEventSerializer(events,many=True).data)


@api_view(['GET'])
def shipment_evidence(request,event_id):
    event=ShipmentEvent.objects.select_related('shipment__order','shipment__quote').filter(pk=event_id).first()
    if not event or not event.evidence: raise NotFound()
    sh=event.shipment
    if request.user.pk not in (sh.order.farmer_id,sh.order.buyer_id,sh.quote.transporter_id):
        raise PermissionDenied()
    file=event.evidence.open('rb')
    return FileResponse(file,as_attachment=True,filename=f'shipment-evidence-{event.pk}.img',
        content_type='application/octet-stream')


@api_view(['POST'])
def shipment_update(request,pk):
    require_trade(request.user,'TRANSPORTER')
    transitions={'ASSIGNED':'PICKED_UP','PICKED_UP':'IN_TRANSIT','IN_TRANSIT':'DELIVERED'}
    requested=request.data.get('status')
    note=str(request.data.get('evidence_note') or '').strip()
    upload=request.FILES.get('evidence_image')
    if len(note)>1000:raise ValidationError({'evidence_note':'Maximum 1000 characters'})
    if upload: validate_image(upload)
    if requested=='DELIVERED' and not upload and len(note)<12:
        raise ValidationError({'evidence_note':'Delivery requires a descriptive note (at least 12 characters) or an image'})
    with transaction.atomic():
        sh=Shipment.objects.select_for_update().select_related('order','quote').filter(pk=pk).first()
        if not sh: raise NotFound()
        if sh.quote.transporter_id!=request.user.pk: raise PermissionDenied()
        order=Order.objects.select_for_update().get(pk=sh.order_id)
        if order.status in ('DISPUTED','CANCELLED','RETURNED'):
            raise ValidationError({'order':'Order is not eligible for shipment updates'})
        if transitions.get(sh.status)!=requested:
            raise ValidationError({'status':'Invalid milestone transition'})
        sh.status=requested
        if requested=='DELIVERED':
            sh.evidence_note=note
            if order.accepted_qtl==0:
                order.status='DELIVERED'
                order.save(update_fields=['status','updated_at'])
        elif requested=='PICKED_UP':
            order.status='DISPATCHED'
            order.save(update_fields=['status','updated_at'])
        sh.save(update_fields=['status','evidence_note','updated_at'])
        event=ShipmentEvent.objects.create(shipment=sh,status=requested,actor=request.user,
            note=note,**({'evidence':upload} if upload else {}))
        for person in (order.farmer,order.buyer):
            notify(person,'SHIPMENT',f'Order {sh.order_id}: {requested}')
        log(request.user,'SHIPMENT_'+requested,sh.pk,event_id=event.pk,
            attachment=bool(upload))
    return Response({'shipment':ShipmentSerializer(sh).data,'event':ShipmentEventSerializer(event).data,
        'notice':'Carrier-reported milestone, not independent confirmation of physical receipt.'})

@api_view(['GET','POST'])
def settlements(request):
    if request.method=='GET':
        qs=Settlement.objects.filter(Q(order__farmer=request.user)|Q(order__buyer=request.user))
        return Response(SettlementSerializer(qs,many=True).data)
    require_trade(request.user,'FARMER','BUYER')
    s=SettlementSerializer(data=request.data);s.is_valid(raise_exception=True)
    order=s.validated_data['order']
    if request.user.id not in (order.farmer_id,order.buyer_id): raise PermissionDenied()
    if (order.status not in ('DELIVERED','PARTIALLY_FULFILLED') or
        order.accepted_qtl<=0 or order.accepted_qtl+order.cancelled_qtl!=order.quantity_qtl):
        raise ValidationError({'order':'Buyer acceptance and completion of all ordered quantities required'})
    declared=s.validated_data['amount_inr']
    if declared<=0: raise ValidationError({'amount_inr':'Amount must be positive'})
    with transaction.atomic():
        order=Order.objects.select_for_update().get(pk=order.pk)
        if PaymentAttempt.objects.filter(order=order).exclude(status='FAILED').exists():
            raise ValidationError({'order':'Gateway payment exists; manual declarations require reconciliation before proceeding'})
        if Settlement.objects.filter(order=order).exists():
            raise ValidationError({'order':'Manual settlement already declared; counterparty acknowledgement is required'})
        settlement=s.save(declared_by=request.user,status='DECLARED')
    log(request.user,'MANUAL_SETTLEMENT_DECLARED',settlement.pk)
    return Response(SettlementSerializer(settlement).data,status=201)

@api_view(['GET','POST'])
def notifications(request):
    if request.method=='GET': return Response(NotificationSerializer(Notification.objects.filter(recipient=request.user).order_by('-created_at')[:100],many=True).data)
    Notification.objects.filter(recipient=request.user,pk=request.data.get('id')).update(read=True)
    return Response({'message':'Marked read'})

@api_view(['GET'])
def institutional_analytics(request):
    require_role(request.user,'INSTITUTION','ADMIN')
    qs=MandiPrice.objects.filter(quality_status='VALID')
    if request.query_params.get('state'): qs=qs.filter(market__state__iexact=request.query_params['state'])
    if request.query_params.get('district'): qs=qs.filter(market__district__iexact=request.query_params['district'])
    # Aggregated only. Never return user location, email, or raw farmer records.
    from .export_safety import publishable_count
    data=list(qs.values('crop__name','market__state').annotate(
        observations=Count('id'),average_modal=Avg('modal_price'),
        latest=__import__('django.db.models',fromlist=['Max']).Max('observed_on'))
        .filter(observations__gte=5).order_by('crop__name')[:250])
    return Response({'aggregated_market_prices':data,
        'users_total':publishable_count(User.objects.count()),
        'orders_total':publishable_count(Order.objects.count()),
        'observations_total':publishable_count(qs.count()),
        'privacy':'Groups with fewer than five observations and platform counts below five are suppressed. This is not a full disclosure-risk assessment.'})


@api_view(['POST'])
def assistant(request):
    """Deterministic grounded assistant, not a fabricated LLM or forecast."""
    crop_id=request.data.get('crop_id')
    if not crop_id: return Response({'answer':'Select a crop to see source-backed market observations.','status':'MISSING_CROP'})
    prices=MandiPrice.objects.filter(crop_id=crop_id,quality_status='VALID',observed_on__lte=timezone.localdate()).select_related('market').order_by('-observed_on')[:5]
    if not prices:return Response({'answer':'No verified market observations are available for this crop.','status':'UNAVAILABLE_DATA','sources':[]})
    observations=[{'market':str(p.market),'modal_per_qtl':str(p.modal_price),'observed_on':str(p.observed_on),'source':p.source} for p in prices]
    return Response({'answer':'These are recorded mandi observations, not guaranteed selling offers. Supply quantity and costs to compare realistic net returns.',
        'status':'HISTORICAL_OBSERVATION','sources':observations})

@api_view(['GET'])
@permission_classes([AllowAny])
def operational_status(request):
    from .security import sms_configured
    return Response({'market_data':'AVAILABLE_IF_IMPORTED','google_oauth':'CONFIGURED' if settings.GOOGLE_CLIENT_ID else 'UNAVAILABLE',
        'email_delivery':'DEVELOPMENT_CONSOLE' if settings.DEBUG and 'console' in settings.EMAIL_BACKEND else ('CONFIGURED' if settings.EMAIL_HOST else 'UNAVAILABLE'),
        'sms_otp':'CONFIGURED' if sms_configured() else 'UNAVAILABLE', 'gateway_payments':'CONFIGURED_NOT_VERIFIED' if payment_provider_configured() else 'UNAVAILABLE',
        'forecasting':'BASELINE_MODEL_REQUIRES_HISTORY','road_routing':'CONFIGURED_UNVERIFIED' if settings.ORS_API_KEY else 'UNAVAILABLE','llm':'CONFIGURED_UNVERIFIED' if settings.MARKET_LLM_PROVIDER=='openai' and settings.OPENAI_API_KEY else 'DETERMINISTIC_FALLBACK',
        'google_client_id':settings.GOOGLE_CLIENT_ID, 'razorpay_key_id':settings.RAZORPAY_KEY_ID if payment_provider_configured() else '', 'legal_approval':'NOT_ASSESSED','government_affiliation':'NONE'})

# --- Price alerts and conservative price forecast ---
from .payment import (payment_provider_configured, amount_in_paise, create_gateway_order,
                      checkout_signature_ok, webhook_signature_ok)
from .forecasting import forecast_modal


@api_view(['GET','POST'])
def price_alerts(request):
    if request.method=='GET':
        return Response([{'id':a.id,'crop':a.crop_id,'market':a.market_id,
                          'direction':a.direction,'threshold_per_qtl':str(a.threshold_per_qtl),
                          'enabled':a.enabled,'last_notified_price':a.last_notified_price_id}
                         for a in PriceAlert.objects.filter(owner=request.user).order_by('-created_at')[:100]])
    require_role(request.user,'FARMER','BUYER')
    try:
        crop=Crop.objects.get(pk=request.data.get('crop'))
    except (Crop.DoesNotExist,TypeError,ValueError):
        raise ValidationError({'crop':'Choose an existing crop'})
    market_id=request.data.get('market') or None
    if market_id:
        if not str(market_id).isdecimal(): raise ValidationError({'market':'Numeric market ID required'})
        if not Market.objects.filter(pk=market_id).exists(): raise ValidationError({'market':'Unknown market'})
    direction=request.data.get('direction')
    if direction not in ('ABOVE','BELOW'): raise ValidationError({'direction':'ABOVE or BELOW required'})
    try:
        threshold=dec(request.data.get('threshold_per_qtl'),'threshold_per_qtl',positive=True)
    except ValueError as e: raise ValidationError({'threshold_per_qtl':str(e)})
    if threshold>=Decimal('10000000000'): raise ValidationError({'threshold_per_qtl':'Too large'})
    if PriceAlert.objects.filter(owner=request.user,enabled=True).count()>=30:
        raise ValidationError({'alerts':'Maximum 30 active price alerts per account'})
    alert=PriceAlert.objects.create(owner=request.user,crop=crop,market_id=market_id,
                                    direction=direction,threshold_per_qtl=threshold)
    log(request.user,'PRICE_ALERT_CREATED',alert.pk)
    return Response({'id':alert.pk,'message':'Price alert saved. Notifications require scheduled ingestion and alert evaluation.'},status=201)


@api_view(['DELETE'])
def price_alert_delete(request,pk):
    alert=PriceAlert.objects.filter(owner=request.user,pk=pk).first()
    if not alert: raise NotFound()
    alert.delete()
    return Response(status=204)


@api_view(['GET'])
@permission_classes([AllowAny])
def forecast(request):
    crop=request.query_params.get('crop')
    market=request.query_params.get('market')
    if not crop or not market or not crop.isdecimal() or not market.isdecimal():
        raise ValidationError({'input':'Numeric crop and market IDs are required'})
    qs=MandiPrice.objects.filter(crop_id=int(crop),market_id=int(market),quality_status='VALID',
        observed_on__lte=timezone.localdate())
    for field in ('variety','grade','source'):
        if field in request.query_params:
            value=request.query_params[field]
            if len(value)>100: raise ValidationError({field:'Filter too long'})
            qs=qs.filter(**{field:value})
    profiles=list(qs.values('variety','grade','source').distinct()[:51])
    if len(profiles)>1:
        result={'status':'UNAVAILABLE_DATA',
                'reason':'Multiple crop varieties, grades or sources in history. Narrow all three filters to one source-specific profile.',
                'available_profiles':profiles[:50]}
    else:
        history=list(qs.order_by('-observed_on','-id').values_list('observed_on','modal_price')[:1000])
        result=forecast_modal(history,today=timezone.localdate())
        if profiles: result['profile']=profiles[0]
    result['source']='Recorded mandi observations only; inspect provenance, freshness and grade'
    result['crop_id']=int(crop)
    result['market_id']=int(market)
    return Response(result)


# --- Merchant-backed payment preparation, signed callback and webhook ---
# A customer-side success callback is never treated as captured funds.
@api_view(['GET'])
def payment_attempts(request):
    qs=PaymentAttempt.objects.filter(Q(order__farmer=request.user)|Q(order__buyer=request.user))\
        .order_by('-initiated_at')[:100]
    return Response([{'id':p.pk,'order':str(p.order_id),'status':p.status,
                      'amount_inr':str((Decimal(p.amount_paise)/100).quantize(Decimal('0.01'))),
                      'currency':p.currency,'initiated_at':p.initiated_at}
                     for p in qs])


@api_view(['POST'])
def payment_initiate(request):
    require_trade(request.user,'BUYER')
    if not payment_provider_configured():
        return Response({'message':'Payment gateway unavailable: merchant approval and credentials required'},status=503)
    try: oid=request.data['order']
    except KeyError: raise ValidationError({'order':'Order ID required'})
    try:
        with transaction.atomic():
            order=Order.objects.select_for_update().get(pk=oid)
            if order.buyer_id!=request.user.pk: raise PermissionDenied()
            if order.status not in ('CONFIRMED','DISPATCHED','DELIVERED','PARTIALLY_FULFILLED'):
                raise ValidationError({'order':'Order is not payable'})
            if Settlement.objects.filter(order=order).exists():
                raise ValidationError({'order':'A manual settlement already exists; reconcile before gateway payment'})
            existing=PaymentAttempt.objects.filter(order=order).exclude(status='FAILED').order_by('-initiated_at').first()
            if existing:
                return Response({'gateway_order_id':existing.gateway_order_id,'key_id':settings.RAZORPAY_KEY_ID,
                                 'amount_paise':existing.amount_paise,'currency':'INR',
                                 'status':existing.status,'message':'Reused existing gateway order'})
            amount=amount_in_paise(order.quantity_qtl-order.cancelled_qtl,order.price_per_qtl)
            gateway_order_id=create_gateway_order(order.id,amount)
            attempt=PaymentAttempt.objects.create(order=order,gateway_order_id=gateway_order_id,amount_paise=amount)
            log(request.user,'PAYMENT_ORDER_INITIATED',attempt.pk,order=str(order.id))
    except Order.DoesNotExist:
        raise NotFound('Order not found')
    except (requests.RequestException,RuntimeError,ValueError):
        return Response({'message':'Payment provider unavailable or returned an invalid response'},status=502)
    return Response({'gateway_order_id':attempt.gateway_order_id,'key_id':settings.RAZORPAY_KEY_ID,
                     'amount_paise':attempt.amount_paise,'currency':'INR','status':attempt.status},status=201)


@api_view(['POST'])
def payment_callback_confirm(request):
    require_role(request.user,'BUYER')
    gateway_order_id=request.data.get('razorpay_order_id','')
    gateway_payment_id=request.data.get('razorpay_payment_id','')
    signature=request.data.get('razorpay_signature','')
    if not checkout_signature_ok(gateway_order_id,gateway_payment_id,signature):
        raise ValidationError({'signature':'Invalid payment callback signature'})
    with transaction.atomic():
        attempt=PaymentAttempt.objects.select_for_update().filter(gateway_order_id=gateway_order_id,order__buyer=request.user).first()
        if not attempt: raise NotFound('Payment order not found')
        if attempt.order.status=='CANCELLED': raise ValidationError({'order':'Cancelled order requires payment reconciliation'})
        if attempt.status!='CAPTURED':
            attempt.gateway_payment_id=gateway_payment_id
            attempt.status='CALLBACK'
            attempt.save(update_fields=['gateway_payment_id','status','updated_at'])
    return Response({'status':attempt.status,'message':'Callback verified. Await a gateway-confirmed capture webhook.'})


@api_view(['POST'])
@permission_classes([AllowAny])
def payment_webhook(request):
    """A public endpoint which MUST validate the gateway HMAC before any DB writes."""
    raw=request.body
    signature=request.headers.get('X-Razorpay-Signature','')
    event_id=request.headers.get('X-Razorpay-Event-Id','')
    if not webhook_signature_ok(raw,signature):
        return Response({'detail':'Invalid webhook signature'},status=403)
    if not event_id or len(event_id)>128:
        return Response({'detail':'Missing webhook event ID'},status=400)
    try:
        payload=json.loads(raw)
        event_name=payload['event']
        if not isinstance(event_name,str): raise ValueError()
    except (ValueError,KeyError,TypeError):
        return Response({'detail':'Malformed webhook event'},status=400)
    try:
        with transaction.atomic():
            event,created=PaymentWebhookEvent.objects.get_or_create(gateway_event_id=event_id,
                defaults={'event_name':event_name,'body_sha256':hashlib.sha256(raw).hexdigest()})
            if not created:
                if event.body_sha256!=hashlib.sha256(raw).hexdigest():
                    return Response({'detail':'Duplicate event ID has conflicting content'},status=409)
                return Response({'status':'ALREADY_PROCESSED'})
            if event_name=='payment.captured':
                payment=payload['payload']['payment']['entity']
                gateway_order_id=payment['order_id']
                attempt=PaymentAttempt.objects.select_for_update().get(gateway_order_id=gateway_order_id)
                if (payment.get('status')!='captured' or payment.get('currency')!='INR' or
                    payment.get('amount')!=attempt.amount_paise or not payment.get('id')):
                    raise ValueError('Captured payment does not match the expected order, currency or amount')
                if attempt.gateway_payment_id and attempt.gateway_payment_id != payment['id']:
                    raise ValueError('Gateway payment ID conflicts with confirmed attempt')
                if attempt.order.status=='CANCELLED':
                    # Do not silently mark a cancelled order as successfully paid.
                    raise ValueError('Captured funds for a cancelled order; manual reconciliation required')
                if attempt.status!='CAPTURED':
                    attempt.status='CAPTURED'
                    attempt.gateway_payment_id=payment['id']
                    attempt.confirmed_at=timezone.now()
                    attempt.save(update_fields=['status','gateway_payment_id','confirmed_at','updated_at'])
                    notify(attempt.order.farmer,'PAYMENT',f'Gateway payment captured for order {attempt.order_id}; bank settlement is not confirmed')
                    notify(attempt.order.buyer,'PAYMENT',f'Gateway payment captured for order {attempt.order_id}; bank settlement is not confirmed')
                    log(None,'PAYMENT_CAPTURED',attempt.pk,order=str(attempt.order_id),provider='razorpay')
            elif event_name in ('refund.processed','refund.failed'):
                refund_payload=payload['payload']['refund']['entity']
                refund=RefundRequest.objects.select_for_update().select_related('payment').get(
                    gateway_refund_id=refund_payload['id'])
                if (refund_payload.get('payment_id')!=refund.payment.gateway_payment_id or
                    refund_payload.get('amount')!=refund.amount_paise or
                    refund.status not in ('PROVIDER_PENDING','PROCESSED','FAILED')):
                    raise ValueError('Refund webhook does not match a pending request')
                if event_name=='refund.processed' and refund_payload.get('status')=='processed':
                    refund.status='PROCESSED'
                    refund.save(update_fields=['status','updated_at'])
                    for participant in (refund.order.farmer,refund.order.buyer):
                        notify(participant,'REFUND',f'Payment provider reported refund processed for order {refund.order_id}')
                    log(None,'GATEWAY_REFUND_PROCESSED',refund.pk)
                elif event_name=='refund.failed' and refund_payload.get('status') in ('failed','reversed'):
                    refund.status='FAILED'
                    refund.save(update_fields=['status','updated_at'])
                    log(None,'GATEWAY_REFUND_FAILED',refund.pk)
                else:
                    raise ValueError('Refund status does not match the signed event')
            elif event_name=='payment.failed':
                payment=payload['payload']['payment']['entity']
                attempt=PaymentAttempt.objects.select_for_update().filter(gateway_order_id=payment.get('order_id')).first()
                if attempt and attempt.status not in ('CAPTURED','FAILED'):
                    attempt.status='FAILED'
                    attempt.save(update_fields=['status','updated_at'])
    except (PaymentAttempt.DoesNotExist,RefundRequest.DoesNotExist,KeyError,TypeError,ValueError):
        # Returning a failure allows provider redelivery; do not acknowledge false confirmation.
        return Response({'detail':'Webhook event could not be reconciled'},status=409)
    return Response({'status':'PROCESSED'})


@api_view(['GET'])
def auth_sessions(request):
    """List refresh sessions, excluding token payloads and secrets."""
    from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken
    now=timezone.now()
    sessions=OutstandingToken.objects.filter(user=request.user,expires_at__gt=now).order_by('-created_at')[:100]
    blacklisted=set(BlacklistedToken.objects.filter(token__in=sessions).values_list('token_id',flat=True))
    return Response([{'jti':s.jti,'created_at':s.created_at,'expires_at':s.expires_at,
                      'revoked':s.pk in blacklisted} for s in sessions])


@api_view(['POST'])
def revoke_auth_session(request,jti):
    from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken
    token=OutstandingToken.objects.filter(user=request.user,jti=jti).first()
    if not token: raise NotFound('Session not found')
    BlacklistedToken.objects.get_or_create(token=token)
    log(request.user,'REFRESH_SESSION_REVOKED',token.pk)
    return Response({'message':'Refresh token revoked; existing short-lived access tokens expire normally'})


@api_view(['GET'])
def institutional_export(request):
    """Server-generated aggregate export; never includes individual user information."""
    require_role(request.user,'ADMIN','INSTITUTION')
    import csv
    from django.http import HttpResponse
    from django.db.models import Max
    qs=MandiPrice.objects.filter(quality_status='VALID')
    if request.query_params.get('state'):
        qs=qs.filter(market__state__iexact=request.query_params['state'])
    if request.query_params.get('district'):
        qs=qs.filter(market__district__iexact=request.query_params['district'])
    from .export_safety import spreadsheet_safe
    rows=qs.values('crop__name','market__state','market__district').annotate(
        observations=Count('id'),average_modal=Avg('modal_price'),latest=Max('observed_on'))\
        .filter(observations__gte=5).order_by('crop__name','market__state','market__district')[:1000]
    response=HttpResponse(content_type='text/csv; charset=utf-8')
    response['Content-Disposition']='attachment; filename="krishisetu_aggregate_market_prices.csv"'
    writer=csv.writer(response)
    writer.writerow(['Crop','State','District','Price observations','Average modal INR/qtl','Latest date'])
    for row in rows:
        writer.writerow([spreadsheet_safe(row['crop__name']),spreadsheet_safe(row['market__state']),
            spreadsheet_safe(row['market__district']),row['observations'],row['average_modal'],row['latest']])
    log(request.user,'INSTITUTIONAL_AGGREGATE_EXPORTED',request.user.pk)
    return response


@api_view(['POST'])
def reject_offer(request,pk):
    """Counterparty rejects, not the proposer; state remains auditable."""
    require_trade(request.user,'FARMER','BUYER')
    with transaction.atomic():
        offer=Offer.objects.select_for_update().select_related('listing').filter(pk=pk).first()
        if not offer: raise NotFound()
        if request.user.id not in (offer.buyer_id,offer.listing.farmer_id): raise PermissionDenied()
        if offer.proposed_by_id==request.user.id:
            raise PermissionDenied('Proposers may withdraw; only counterparties may reject')
        if offer.status!='PENDING' or offer.expires_at<=timezone.now():
            raise ValidationError({'offer':'Offer is no longer pending'})
        offer.status='REJECTED';offer.save(update_fields=['status'])
        notify(offer.proposed_by,'OFFER_REJECTED',f'Offer {offer.pk} was rejected by counterparty')
        log(request.user,'OFFER_REJECTED',offer.pk)
    return Response(OfferSerializer(offer).data)


@api_view(['POST'])
def withdraw_offer(request,pk):
    """Proposers may withdraw a pending unaccepted offer or counteroffer."""
    require_trade(request.user,'FARMER','BUYER')
    with transaction.atomic():
        offer=Offer.objects.select_for_update().select_related('listing').filter(pk=pk).first()
        if not offer: raise NotFound()
        if offer.proposed_by_id!=request.user.id:
            raise PermissionDenied('Only the current proposer may withdraw')
        if offer.status!='PENDING': raise ValidationError({'offer':'Offer is no longer pending'})
        offer.status='WITHDRAWN';offer.save(update_fields=['status'])
        recipient=offer.listing.farmer if offer.buyer_id==request.user.id else offer.buyer
        notify(recipient,'OFFER_WITHDRAWN',f'Offer {offer.pk} was withdrawn')
        log(request.user,'OFFER_WITHDRAWN',offer.pk)
    return Response(OfferSerializer(offer).data)
