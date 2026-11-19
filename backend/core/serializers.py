from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Crop,Market,MandiPrice,Farm,Listing,Offer,Order,FreightRequest,FreightQuote,Shipment,Vehicle,Settlement,Notification,DeliveryAcceptance,OrderChangeRequest,TradeDispute,RefundRequest,ShipmentEvent
from .security import normalize_phone

User=get_user_model()
class UserSerializer(serializers.ModelSerializer):
    account_verified=serializers.BooleanField(read_only=True)
    class Meta:
        model=User
        fields=['id','email','phone','first_name','last_name','role','email_verified','phone_verified','account_verified','identity_verified','preferred_language','district','state']
        read_only_fields=['email','role','email_verified','phone_verified','account_verified','identity_verified']
    def validate_phone(self,value): return normalize_phone(value) if value else None
    def update(self,instance,validated):
        if 'phone' in validated and validated['phone'] != instance.phone: instance.phone_verified=False
        if 'email' in validated and validated['email'] != instance.email: instance.email_verified=False
        return super().update(instance,validated)

class RegisterSerializer(serializers.Serializer):
    email=serializers.EmailField(); password=serializers.CharField(write_only=True,min_length=10)
    phone=serializers.CharField(); role=serializers.ChoiceField(choices=['FARMER','BUYER','TRANSPORTER'])
    first_name=serializers.CharField(required=False,allow_blank=True,max_length=150)
    def validate_email(self,value):
        value=value.strip().lower()
        if User.objects.filter(email__iexact=value).exists(): raise serializers.ValidationError('Email is already registered')
        return value
    def validate_phone(self,value):
        value=normalize_phone(value)
        if User.objects.filter(phone=value).exists(): raise serializers.ValidationError('Phone is already registered')
        return value
    def validate_password(self,value):
        from django.contrib.auth.password_validation import validate_password
        validate_password(value)
        return value
    def create(self,data): return User.objects.create_user(**data)

class FarmSerializer(serializers.ModelSerializer):
    def validate_latitude(self,value):
        if value is not None and (value<-90 or value>90):
            raise serializers.ValidationError('Latitude must be between -90 and 90')
        return value
    def validate_longitude(self,value):
        if value is not None and (value<-180 or value>180):
            raise serializers.ValidationError('Longitude must be between -180 and 180')
        return value
    class Meta: model=Farm; fields=['id','name','village','district','state','latitude','longitude','created_at']; read_only_fields=['created_at']

class CropSerializer(serializers.ModelSerializer):
    class Meta: model=Crop; fields=['id','name','hindi_name']
class MarketSerializer(serializers.ModelSerializer):
    class Meta: model=Market; fields=['id','name','district','state','latitude','longitude']
class MandiPriceSerializer(serializers.ModelSerializer):
    market=MarketSerializer(read_only=True)
    crop=CropSerializer(read_only=True)
    freshness=serializers.SerializerMethodField()
    class Meta:
        model=MandiPrice
        fields=['id','market','crop','variety','grade','min_price','max_price','modal_price','arrival_qtl','unit','observed_on','source','imported_at','quality_status','quality_flags','freshness']
    def get_freshness(self,obj):
        from django.utils import timezone
        days=(timezone.localdate()-obj.observed_on).days
        return 'DATED' if days>2 else ('RECENT_OBSERVATION' if days>=0 else 'FUTURE_DATE_REVIEW')

class ListingSerializer(serializers.ModelSerializer):
    crop_name=serializers.CharField(source='crop.name',read_only=True)
    available_qtl=serializers.DecimalField(max_digits=14,decimal_places=3,read_only=True)
    class Meta:
        model=Listing
        fields=['id','farmer','farm','crop','crop_name','variety','grade','quantity_qtl','reserved_qtl','available_qtl','asking_per_qtl',
                'district','state','description','image','status','created_at']
        read_only_fields=['farmer','reserved_qtl','status','created_at']
    def validate(self,attrs):
        if attrs.get('quantity_qtl', self.instance.quantity_qtl if self.instance else 0) <= 0:
            raise serializers.ValidationError({'quantity_qtl':'Quantity must be positive'})
        if attrs.get('asking_per_qtl', self.instance.asking_per_qtl if self.instance else 0) <= 0:
            raise serializers.ValidationError({'asking_per_qtl':'Asking price must be positive'})
        farm=attrs.get('farm')
        if farm and farm.farmer_id!=self.context['request'].user.id: raise serializers.ValidationError('You do not own this farm')
        return attrs

class OfferSerializer(serializers.ModelSerializer):
    def validate(self,attrs):
        if attrs.get('quantity_qtl',0) <= 0 or attrs.get('price_per_qtl',0) <= 0:
            raise serializers.ValidationError('Offer quantity and price must be positive')
        return attrs
    class Meta:
        model=Offer
        fields=['id','listing','buyer','proposed_by','parent','quantity_qtl','price_per_qtl','status','expires_at','created_at']
        read_only_fields=['buyer','proposed_by','status','created_at']

class OrderSerializer(serializers.ModelSerializer):
    class Meta: model=Order; fields=['id','offer','listing','farmer','buyer','quantity_qtl','price_per_qtl','accepted_qtl','cancelled_qtl','returned_qtl','status','created_at','updated_at']
class FreightRequestSerializer(serializers.ModelSerializer):
    class Meta: model=FreightRequest; fields=['id','order','pickup_location','dropoff_location','pickup_date','created_at']; read_only_fields=['created_at']
class VehicleSerializer(serializers.ModelSerializer):
    class Meta: model=Vehicle; fields=['id','transporter','registration','vehicle_type','capacity_qtl','verified']; read_only_fields=['transporter','verified']
class FreightQuoteSerializer(serializers.ModelSerializer):
    class Meta: model=FreightQuote; fields=['id','freight_request','transporter','vehicle','price_inr','message','created_at']; read_only_fields=['transporter','created_at']
class ShipmentSerializer(serializers.ModelSerializer):
    class Meta:
        model=Shipment
        fields=['id','order','quote','status','evidence_note','updated_at']
        read_only_fields=['status','evidence_note','updated_at']

class ShipmentEventSerializer(serializers.ModelSerializer):
    has_evidence=serializers.SerializerMethodField()
    def get_has_evidence(self,obj):return bool(obj.evidence)
    class Meta:
        model=ShipmentEvent
        fields=['id','shipment','status','actor','note','recorded_at','has_evidence']
        read_only_fields=fields

class SettlementSerializer(serializers.ModelSerializer):
    class Meta:
        model=Settlement
        fields=['id','order','amount_inr','reference','status','declared_by','declared_at','acknowledged_by','acknowledged_at']
        read_only_fields=['status','declared_by','declared_at','acknowledged_by','acknowledged_at']
class NotificationSerializer(serializers.ModelSerializer):
    class Meta: model=Notification; fields=['id','category','message','read','created_at']


class DeliveryAcceptanceSerializer(serializers.ModelSerializer):
    class Meta:
        model=DeliveryAcceptance
        fields=['id','order','quantity_qtl','accepted_by','evidence_note','created_at']
        read_only_fields=['accepted_by','created_at']

class OrderChangeSerializer(serializers.ModelSerializer):
    class Meta:
        model=OrderChangeRequest
        fields=['id','order','kind','quantity_qtl','proposed_by','responded_by','reason','status','created_at','responded_at']
        read_only_fields=['proposed_by','responded_by','status','created_at','responded_at']

class TradeDisputeSerializer(serializers.ModelSerializer):
    class Meta:
        model=TradeDispute
        fields=['id','order','opened_by','category','description','status','previous_order_status','resolution_note','decided_by','created_at','resolved_at']
        read_only_fields=['opened_by','status','previous_order_status','resolution_note','decided_by','created_at','resolved_at']

class RefundRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model=RefundRequest
        fields=['id','order','payment','requested_by','decided_by','amount_paise','reason','status','gateway_refund_id','created_at','updated_at']
        read_only_fields=['requested_by','decided_by','status','gateway_refund_id','created_at','updated_at']
