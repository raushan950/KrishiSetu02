"""Shared transactional PostgreSQL schema; no real market or trade records are seeded."""
import uuid
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from django.db.models import F, Q
from django.utils import timezone
from .storage import PrivateEvidenceStorage

class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra):
        if not email: raise ValueError('Email required')
        email = self.normalize_email(email).strip().lower()
        user=self.model(email=email, **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user
    def create_superuser(self,email,password,**extra):
        extra.update(role='ADMIN',is_staff=True,is_superuser=True,is_active=True)
        return self.create_user(email,password,**extra)

class User(AbstractUser):
    username=None
    class Roles(models.TextChoices):
        FARMER='FARMER','Farmer'; BUYER='BUYER','Buyer'; TRANSPORTER='TRANSPORTER','Transporter'
        ADMIN='ADMIN','Administrator'; INSTITUTION='INSTITUTION','Institution'
    email=models.EmailField(unique=True)
    phone=models.CharField(max_length=16, blank=True, null=True, unique=True)
    role=models.CharField(max_length=20, choices=Roles.choices,default=Roles.FARMER)
    google_sub=models.CharField(max_length=150,unique=True,null=True,blank=True)
    email_verified=models.BooleanField(default=False)
    phone_verified=models.BooleanField(default=False)
    identity_verified=models.BooleanField(default=False)
    preferred_language=models.CharField(max_length=5,default='hi')
    district=models.CharField(max_length=100,blank=True)
    state=models.CharField(max_length=100,blank=True)
    created_at=models.DateTimeField(default=timezone.now)
    USERNAME_FIELD='email'; REQUIRED_FIELDS=[]
    objects=UserManager()
    @property
    def account_verified(self):
        return bool(self.email_verified and self.phone_verified)
    def __str__(self): return self.email

class VerificationChallenge(models.Model):
    class Kinds(models.TextChoices): EMAIL='EMAIL','Email'; PHONE='PHONE','Phone'
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False)
    user=models.ForeignKey(User,on_delete=models.CASCADE,related_name='challenges')
    kind=models.CharField(max_length=10,choices=Kinds.choices)
    digest=models.CharField(max_length=64)
    created_at=models.DateTimeField(default=timezone.now)
    expires_at=models.DateTimeField()
    used_at=models.DateTimeField(null=True,blank=True)
    attempts=models.PositiveSmallIntegerField(default=0)
    class Meta: indexes=[models.Index(fields=['user','kind','created_at'],name='core_verificati_509831_idx')]

class Farm(models.Model):
    farmer=models.ForeignKey(User,on_delete=models.PROTECT,related_name='farms')
    name=models.CharField(max_length=120); village=models.CharField(max_length=120,blank=True)
    district=models.CharField(max_length=120); state=models.CharField(max_length=120)
    latitude=models.DecimalField(max_digits=10,decimal_places=7,null=True,blank=True)
    longitude=models.DecimalField(max_digits=10,decimal_places=7,null=True,blank=True)
    created_at=models.DateTimeField(auto_now_add=True)

class Crop(models.Model):
    name=models.CharField(max_length=100,unique=True)
    hindi_name=models.CharField(max_length=100,blank=True)
    def __str__(self): return self.name

class Market(models.Model):
    name=models.CharField(max_length=140)
    district=models.CharField(max_length=120)
    state=models.CharField(max_length=120)
    latitude=models.DecimalField(max_digits=10,decimal_places=7,null=True,blank=True)
    longitude=models.DecimalField(max_digits=10,decimal_places=7,null=True,blank=True)
    class Meta: constraints=[models.UniqueConstraint(fields=['name','district','state'],name='unique_market_region')]
    def __str__(self): return f'{self.name}, {self.district}'

class MandiPrice(models.Model):
    class Quality(models.TextChoices): VALID='VALID','Valid'; FLAGGED='FLAGGED','Flagged'
    market=models.ForeignKey(Market,on_delete=models.PROTECT,related_name='prices')
    crop=models.ForeignKey(Crop,on_delete=models.PROTECT)
    variety=models.CharField(max_length=100,blank=True)
    grade=models.CharField(max_length=80,blank=True)
    min_price=models.DecimalField(max_digits=13,decimal_places=2)
    max_price=models.DecimalField(max_digits=13,decimal_places=2)
    modal_price=models.DecimalField(max_digits=13,decimal_places=2)
    arrival_qtl=models.DecimalField(max_digits=15,decimal_places=3,null=True,blank=True)
    unit=models.CharField(max_length=20,default='INR/quintal')
    observed_on=models.DateField()
    source=models.CharField(max_length=100)
    source_record_id=models.CharField(max_length=200)
    imported_at=models.DateTimeField(auto_now=True)
    quality_status=models.CharField(max_length=10,choices=Quality.choices,default=Quality.VALID)
    quality_flags=models.JSONField(default=list,blank=True)
    class Meta:
        constraints=[models.UniqueConstraint(fields=['source','source_record_id'],name='unique_price_source_record'),
                     models.CheckConstraint(condition=Q(min_price__gte=0)&Q(max_price__gte=0)&Q(modal_price__gte=0),name='non_negative_prices')]
        indexes=[models.Index(fields=['crop','observed_on'],name='core_mandiprice_f8173f_idx'),models.Index(fields=['market','observed_on'],name='core_mandiprice_f0f2c8_idx')]

class Listing(models.Model):
    class Status(models.TextChoices): ACTIVE='ACTIVE','Active'; CLOSED='CLOSED','Closed'
    farmer=models.ForeignKey(User,on_delete=models.PROTECT,related_name='listings')
    farm=models.ForeignKey(Farm,on_delete=models.PROTECT,null=True,blank=True)
    crop=models.ForeignKey(Crop,on_delete=models.PROTECT)
    variety=models.CharField(max_length=100,blank=True)
    grade=models.CharField(max_length=100,blank=True)
    quantity_qtl=models.DecimalField(max_digits=14,decimal_places=3)
    reserved_qtl=models.DecimalField(max_digits=14,decimal_places=3,default=0)
    asking_per_qtl=models.DecimalField(max_digits=13,decimal_places=2)
    district=models.CharField(max_length=120); state=models.CharField(max_length=120)
    description=models.TextField(blank=True)
    image=models.ImageField(upload_to='crop_images/',blank=True)
    status=models.CharField(max_length=10,choices=Status.choices,default=Status.ACTIVE)
    created_at=models.DateTimeField(auto_now_add=True)
    class Meta: constraints=[models.CheckConstraint(condition=(
        (Q(quantity_qtl__gt=0)&Q(reserved_qtl__gte=0)&Q(reserved_qtl__lte=F('quantity_qtl'))) |
        (Q(quantity_qtl=0)&Q(reserved_qtl=0)&Q(status='CLOSED'))
    ),name='valid_inventory')]
    @property
    def available_qtl(self): return self.quantity_qtl-self.reserved_qtl

class Offer(models.Model):
    class Status(models.TextChoices): PENDING='PENDING','Pending'; ACCEPTED='ACCEPTED','Accepted'; REJECTED='REJECTED','Rejected'; EXPIRED='EXPIRED','Expired'; SUPERSEDED='SUPERSEDED','Superseded'; WITHDRAWN='WITHDRAWN','Withdrawn'
    listing=models.ForeignKey(Listing,on_delete=models.PROTECT,related_name='offers')
    buyer=models.ForeignKey(User,on_delete=models.PROTECT,related_name='offers')
    proposed_by=models.ForeignKey(User,on_delete=models.PROTECT,related_name='proposals')
    parent=models.ForeignKey('self',on_delete=models.PROTECT,blank=True,null=True)
    quantity_qtl=models.DecimalField(max_digits=14,decimal_places=3)
    price_per_qtl=models.DecimalField(max_digits=13,decimal_places=2)
    status=models.CharField(max_length=12,choices=Status.choices,default=Status.PENDING)
    expires_at=models.DateTimeField()
    created_at=models.DateTimeField(auto_now_add=True)
    class Meta:
        indexes=[models.Index(fields=['listing','status'],name='core_offer_99676d_idx')]
        constraints=[models.CheckConstraint(condition=Q(quantity_qtl__gt=0)&Q(price_per_qtl__gt=0),name='positive_offer_amounts')]

class Order(models.Model):
    class Status(models.TextChoices): CONFIRMED='CONFIRMED','Confirmed'; DISPATCHED='DISPATCHED','Dispatched'; DELIVERED='DELIVERED','Carrier reported delivered'; PARTIALLY_FULFILLED='PARTIALLY_FULFILLED','Partially buyer accepted'; CANCELLED='CANCELLED','Cancelled'; DISPUTED='DISPUTED','Disputed'; RETURNED='RETURNED','Returned'
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False)
    offer=models.OneToOneField(Offer,on_delete=models.PROTECT)
    listing=models.ForeignKey(Listing,on_delete=models.PROTECT,related_name='orders')
    farmer=models.ForeignKey(User,on_delete=models.PROTECT,related_name='sales')
    buyer=models.ForeignKey(User,on_delete=models.PROTECT,related_name='purchases')
    quantity_qtl=models.DecimalField(max_digits=14,decimal_places=3)
    price_per_qtl=models.DecimalField(max_digits=13,decimal_places=2)
    accepted_qtl=models.DecimalField(max_digits=14,decimal_places=3,default=0)
    cancelled_qtl=models.DecimalField(max_digits=14,decimal_places=3,default=0)
    returned_qtl=models.DecimalField(max_digits=14,decimal_places=3,default=0)
    status=models.CharField(max_length=24,choices=Status.choices,default=Status.CONFIRMED)
    created_at=models.DateTimeField(auto_now_add=True)
    updated_at=models.DateTimeField(auto_now=True)
    class Meta:
        constraints=[models.CheckConstraint(condition=(Q(quantity_qtl__gt=0)&Q(accepted_qtl__gte=0)&
            Q(cancelled_qtl__gte=0)&Q(returned_qtl__gte=0)&
            Q(accepted_qtl__lte=F('quantity_qtl')-F('cancelled_qtl'))&
            Q(returned_qtl__lte=F('accepted_qtl'))),name='valid_order_quantities')]

class Vehicle(models.Model):
    transporter=models.ForeignKey(User,on_delete=models.PROTECT,related_name='vehicles')
    registration=models.CharField(max_length=30,unique=True)
    vehicle_type=models.CharField(max_length=80)
    capacity_qtl=models.DecimalField(max_digits=12,decimal_places=2)
    verified=models.BooleanField(default=False)
    class Meta: constraints=[models.CheckConstraint(condition=Q(capacity_qtl__gt=0),name='positive_vehicle_capacity')]

class FreightRequest(models.Model):
    order=models.OneToOneField(Order,on_delete=models.PROTECT,related_name='freight_request')
    pickup_location=models.CharField(max_length=240)
    dropoff_location=models.CharField(max_length=240)
    pickup_date=models.DateField()
    created_at=models.DateTimeField(auto_now_add=True)

class FreightQuote(models.Model):
    freight_request=models.ForeignKey(FreightRequest,on_delete=models.PROTECT,related_name='quotes')
    transporter=models.ForeignKey(User,on_delete=models.PROTECT)
    vehicle=models.ForeignKey(Vehicle,on_delete=models.PROTECT)
    price_inr=models.DecimalField(max_digits=13,decimal_places=2)
    message=models.CharField(max_length=240,blank=True)
    created_at=models.DateTimeField(auto_now_add=True)
    class Meta: constraints=[models.UniqueConstraint(fields=['freight_request','transporter'],name='unique_transporter_freight_quote'),
                             models.CheckConstraint(condition=Q(price_inr__gt=0),name='positive_freight_price')]

class Shipment(models.Model):
    class Status(models.TextChoices): ASSIGNED='ASSIGNED','Assigned'; PICKED_UP='PICKED_UP','Picked up'; IN_TRANSIT='IN_TRANSIT','In transit'; DELIVERED='DELIVERED','Delivered'
    order=models.OneToOneField(Order,on_delete=models.PROTECT,related_name='shipment')
    quote=models.OneToOneField(FreightQuote,on_delete=models.PROTECT)
    status=models.CharField(max_length=14,choices=Status.choices,default=Status.ASSIGNED)
    evidence_note=models.TextField(blank=True)
    updated_at=models.DateTimeField(auto_now=True)

class Settlement(models.Model):
    class Status(models.TextChoices): DECLARED='DECLARED','Manual declaration'; RECONCILED='RECONCILED','Counterparty acknowledged manual declaration'
    order=models.OneToOneField(Order,on_delete=models.PROTECT,related_name='settlement')
    amount_inr=models.DecimalField(max_digits=16,decimal_places=2)
    reference=models.CharField(max_length=120,blank=True)
    status=models.CharField(max_length=12,choices=Status.choices,default=Status.DECLARED)
    declared_by=models.ForeignKey(User,on_delete=models.PROTECT)
    declared_at=models.DateTimeField(auto_now_add=True)
    acknowledged_by=models.ForeignKey(User,on_delete=models.PROTECT,null=True,blank=True,related_name='acknowledged_settlements')
    acknowledged_at=models.DateTimeField(null=True,blank=True)
    # No gateway/escrow confirmation: this table stores MANUAL DECLARATIONS ONLY.

class Notification(models.Model):
    recipient=models.ForeignKey(User,on_delete=models.CASCADE,related_name='notifications')
    category=models.CharField(max_length=50)
    message=models.CharField(max_length=300)
    read=models.BooleanField(default=False)
    created_at=models.DateTimeField(auto_now_add=True)

class AuditEvent(models.Model):
    actor=models.ForeignKey(User,on_delete=models.SET_NULL,null=True)
    event=models.CharField(max_length=100)
    object_id=models.CharField(max_length=100)
    details=models.JSONField(default=dict)
    occurred_at=models.DateTimeField(auto_now_add=True)


class PriceAlert(models.Model):
    class Direction(models.TextChoices): ABOVE='ABOVE','At or above'; BELOW='BELOW','At or below'
    owner=models.ForeignKey(User,on_delete=models.CASCADE,related_name='price_alerts')
    crop=models.ForeignKey(Crop,on_delete=models.CASCADE)
    market=models.ForeignKey(Market,on_delete=models.CASCADE,null=True,blank=True)
    threshold_per_qtl=models.DecimalField(max_digits=13,decimal_places=2)
    direction=models.CharField(max_length=5,choices=Direction.choices)
    enabled=models.BooleanField(default=True)
    last_notified_price=models.ForeignKey(MandiPrice,on_delete=models.SET_NULL,null=True,blank=True)
    created_at=models.DateTimeField(auto_now_add=True)
    class Meta:
        constraints=[models.CheckConstraint(condition=Q(threshold_per_qtl__gt=0),name='positive_alert_threshold')]

class PaymentAttempt(models.Model):
    class Status(models.TextChoices):
        INITIATED='INITIATED','Created with gateway'
        CALLBACK='CALLBACK','Signed callback received, awaiting gateway confirmation'
        CAPTURED='CAPTURED','Gateway-confirmed captured payment'
        FAILED='FAILED','Gateway-reported failure'
    order=models.ForeignKey(Order,on_delete=models.PROTECT,related_name='payment_attempts')
    gateway_order_id=models.CharField(max_length=100,unique=True)
    gateway_payment_id=models.CharField(max_length=100,blank=True)
    amount_paise=models.PositiveBigIntegerField()
    currency=models.CharField(max_length=3,default='INR')
    status=models.CharField(max_length=10,choices=Status.choices,default=Status.INITIATED)
    initiated_at=models.DateTimeField(auto_now_add=True)
    updated_at=models.DateTimeField(auto_now=True)
    confirmed_at=models.DateTimeField(null=True,blank=True)
    class Meta:
        constraints=[models.CheckConstraint(condition=Q(amount_paise__gt=0),name='positive_payment_amount')]

class PaymentWebhookEvent(models.Model):
    gateway_event_id=models.CharField(max_length=128,unique=True)
    event_name=models.CharField(max_length=80)
    body_sha256=models.CharField(max_length=64)
    processed_at=models.DateTimeField(auto_now_add=True)


class DeliveryAcceptance(models.Model):
    """Buyer-confirmed receipt, not proof of external physical verification."""
    order=models.ForeignKey(Order,on_delete=models.PROTECT,related_name='acceptances')
    quantity_qtl=models.DecimalField(max_digits=14,decimal_places=3)
    accepted_by=models.ForeignKey(User,on_delete=models.PROTECT)
    evidence_note=models.CharField(max_length=1000,blank=True)
    created_at=models.DateTimeField(auto_now_add=True)
    class Meta:
        constraints=[models.CheckConstraint(condition=Q(quantity_qtl__gt=0),name='positive_delivery_acceptance')]

class OrderChangeRequest(models.Model):
    class Kind(models.TextChoices):
        CANCEL_REMAINDER='CANCEL_REMAINDER','Cancel remaining quantity'
        RETURN='RETURN','Return accepted produce'
    class Status(models.TextChoices):
        PROPOSED='PROPOSED','Awaiting counterparty'
        APPROVED='APPROVED','Counterparty accepted'
        REJECTED='REJECTED','Counterparty rejected'
    order=models.ForeignKey(Order,on_delete=models.PROTECT,related_name='change_requests')
    kind=models.CharField(max_length=20,choices=Kind.choices)
    quantity_qtl=models.DecimalField(max_digits=14,decimal_places=3)
    proposed_by=models.ForeignKey(User,on_delete=models.PROTECT,related_name='proposed_changes')
    responded_by=models.ForeignKey(User,on_delete=models.PROTECT,null=True,blank=True,related_name='reviewed_changes')
    reason=models.CharField(max_length=1000)
    status=models.CharField(max_length=10,choices=Status.choices,default=Status.PROPOSED)
    created_at=models.DateTimeField(auto_now_add=True)
    responded_at=models.DateTimeField(null=True,blank=True)
    class Meta:
        constraints=[models.CheckConstraint(condition=Q(quantity_qtl__gt=0),name='positive_order_change_quantity')]

class TradeDispute(models.Model):
    class Status(models.TextChoices):
        OPEN='OPEN','Open'; IN_REVIEW='IN_REVIEW','In review'; RESOLVED='RESOLVED','Resolved'; REJECTED='REJECTED','Rejected'
    order=models.ForeignKey(Order,on_delete=models.PROTECT,related_name='disputes')
    opened_by=models.ForeignKey(User,on_delete=models.PROTECT,related_name='opened_disputes')
    category=models.CharField(max_length=60)
    description=models.TextField()
    status=models.CharField(max_length=12,choices=Status.choices,default=Status.OPEN)
    previous_order_status=models.CharField(max_length=24)
    resolution_note=models.TextField(blank=True)
    decided_by=models.ForeignKey(User,on_delete=models.PROTECT,null=True,blank=True,related_name='decided_disputes')
    created_at=models.DateTimeField(auto_now_add=True)
    resolved_at=models.DateTimeField(null=True,blank=True)

class RefundRequest(models.Model):
    class Status(models.TextChoices):
        REQUESTED='REQUESTED','Awaiting administrator approval'
        PROVIDER_PENDING='PROVIDER_PENDING','Sent to payment provider'
        PROCESSED='PROCESSED','Confirmed by signed provider webhook'
        REJECTED='REJECTED','Rejected by administrator'
        FAILED='FAILED','Provider reported failure'
    order=models.ForeignKey(Order,on_delete=models.PROTECT,related_name='refunds')
    payment=models.ForeignKey(PaymentAttempt,on_delete=models.PROTECT,related_name='refunds')
    requested_by=models.ForeignKey(User,on_delete=models.PROTECT,related_name='requested_refunds')
    decided_by=models.ForeignKey(User,on_delete=models.PROTECT,related_name='reviewed_refunds',null=True,blank=True)
    amount_paise=models.PositiveBigIntegerField()
    reason=models.CharField(max_length=1000)
    status=models.CharField(max_length=20,choices=Status.choices,default=Status.REQUESTED)
    gateway_refund_id=models.CharField(max_length=100,unique=True,null=True,blank=True)
    created_at=models.DateTimeField(auto_now_add=True)
    updated_at=models.DateTimeField(auto_now=True)
    class Meta:
        constraints=[models.CheckConstraint(condition=Q(amount_paise__gt=0),name='positive_refund_amount')]


class EmailChangeChallenge(models.Model):
    """Single-use proof of ownership of a NEW mailbox, distinct from login email."""
    id=models.UUIDField(primary_key=True,default=uuid.uuid4,editable=False)
    user=models.ForeignKey(User,on_delete=models.CASCADE,related_name='email_changes')
    new_email=models.EmailField()
    digest=models.CharField(max_length=64)
    expires_at=models.DateTimeField()
    created_at=models.DateTimeField(auto_now_add=True)
    used_at=models.DateTimeField(null=True,blank=True)
    attempts=models.PositiveSmallIntegerField(default=0)
    class Meta: indexes=[models.Index(fields=['user','created_at'],name='core_emchg_user_created_idx')]


class MarketImportRun(models.Model):
    """Operational evidence of ingestion, including partial/failed runs."""
    class Status(models.TextChoices):
        RUNNING='RUNNING','Running'; SUCCESS='SUCCESS','Success'; FAILED='FAILED','Failed'
    source=models.CharField(max_length=60)
    resource_id=models.CharField(max_length=140)
    status=models.CharField(max_length=10,choices=Status.choices,default=Status.RUNNING)
    started_at=models.DateTimeField(auto_now_add=True)
    finished_at=models.DateTimeField(null=True,blank=True)
    pages_count=models.PositiveIntegerField(default=0)
    received_count=models.PositiveIntegerField(default=0)
    created_count=models.PositiveIntegerField(default=0)
    updated_count=models.PositiveIntegerField(default=0)
    unchanged_count=models.PositiveIntegerField(default=0)
    invalid_count=models.PositiveIntegerField(default=0)
    flagged_count=models.PositiveIntegerField(default=0)
    error=models.CharField(max_length=400,blank=True)
    class Meta:
        indexes=[models.Index(fields=['-started_at'],name='market_import_started_idx')]


class ShipmentEvent(models.Model):
    """Append-only shipment milestone evidence, actor attribution and timestamp."""
    shipment=models.ForeignKey(Shipment,on_delete=models.PROTECT,related_name='events')
    status=models.CharField(max_length=14,choices=Shipment.Status.choices)
    actor=models.ForeignKey(User,on_delete=models.PROTECT)
    note=models.CharField(max_length=1000,blank=True)
    evidence=models.ImageField(storage=PrivateEvidenceStorage(),upload_to='shipment_evidence/%Y/%m/%d/',blank=True)
    recorded_at=models.DateTimeField(auto_now_add=True)
    class Meta:
        constraints=[models.UniqueConstraint(fields=['shipment','status'],name='unique_shipment_milestone')]
        indexes=[models.Index(fields=['shipment','recorded_at'],name='shipment_event_timeline_idx')]
