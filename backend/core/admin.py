from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import (User,VerificationChallenge,Farm,Crop,Market,MandiPrice,Listing,Offer,
                     Order,Vehicle,FreightRequest,FreightQuote,Shipment,Settlement,Notification,AuditEvent,PriceAlert,PaymentAttempt,PaymentWebhookEvent,DeliveryAcceptance,OrderChangeRequest,TradeDispute,RefundRequest,EmailChangeChallenge,MarketImportRun,ShipmentEvent)

@admin.register(User)
class UserAdmin(BaseUserAdmin):
    ordering=['email']; list_display=['email','role','email_verified','phone_verified','identity_verified','is_staff']
    fieldsets=((None,{'fields':('email','password')}),('Profile',{'fields':('first_name','last_name','phone','role','district','state','preferred_language')}),
              ('Verification',{'fields':('email_verified','phone_verified','identity_verified','google_sub')}),
              ('Permissions',{'fields':('is_active','is_staff','is_superuser','groups','user_permissions')}),
              ('Important dates',{'fields':('last_login','date_joined')}))
    add_fieldsets=((None,{'classes':('wide',),'fields':('email','password1','password2','role','is_staff','is_superuser')}),)
    search_fields=['email','phone']

for model in [Farm,Crop,Market,MandiPrice,Listing,Offer,Order,Vehicle,FreightRequest,FreightQuote,Shipment,Settlement,Notification,AuditEvent,VerificationChallenge,PriceAlert,PaymentAttempt,PaymentWebhookEvent,DeliveryAcceptance,OrderChangeRequest,TradeDispute,RefundRequest,EmailChangeChallenge,MarketImportRun,ShipmentEvent]:
    admin.site.register(model)
