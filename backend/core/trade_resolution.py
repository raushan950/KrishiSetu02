"""Audited two-party trade adjustment and dispute workflows.

All quantities are decimal quintals. Counterparty approval records an agreement;
it does not certify physical return, transfer of funds, or legal identity.
"""
from decimal import Decimal, InvalidOperation
from uuid import UUID

import requests
from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.decorators import api_view
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.response import Response

from .models import (Order, Listing, Shipment, Settlement, PaymentAttempt, Vehicle,
                     User, DeliveryAcceptance, OrderChangeRequest, TradeDispute, RefundRequest)
from .serializers import (OrderSerializer, DeliveryAcceptanceSerializer, OrderChangeSerializer,
                          TradeDisputeSerializer, RefundRequestSerializer, VehicleSerializer)
from .payment import payment_provider_configured
from .views import require_trade, require_role, notify, log


def positive_quantity(raw):
    try:
        value=Decimal(str(raw))
        if not value.is_finite() or value<=0 or value!=value.quantize(Decimal('0.001')):
            raise ValueError()
        return value
    except (InvalidOperation,ValueError,TypeError):
        raise ValidationError({'quantity_qtl':'Use a positive quantity of at most three decimal places'})


def valid_order_id(raw):
    try: return UUID(str(raw))
    except (ValueError,TypeError,AttributeError):
        raise ValidationError({'order':'A valid order UUID is required'})


def participant(order,user):
    if user.id not in (order.farmer_id,order.buyer_id):
        raise PermissionDenied('Not a participant in this order')


def counterparty(order,user):
    return order.buyer if user.id==order.farmer_id else order.farmer


@api_view(['GET'])
def delivery_acceptances(request):
    return Response(DeliveryAcceptanceSerializer(DeliveryAcceptance.objects.filter(
        Q(order__farmer=request.user)|Q(order__buyer=request.user)).order_by('-created_at')[:100],many=True).data)


@api_view(['POST'])
def accept_delivery(request,pk):
    """Only the buyer can confirm physical acceptance; stock is consumed atomically."""
    require_trade(request.user,'BUYER')
    quantity=positive_quantity(request.data.get('quantity_qtl'))
    evidence=str(request.data.get('evidence_note') or '').strip()[:1000]
    with transaction.atomic():
        order=Order.objects.select_for_update().select_related('farmer','buyer').filter(pk=pk).first()
        if not order: raise NotFound()
        if order.buyer_id!=request.user.id: raise PermissionDenied()
        if order.status not in ('CONFIRMED','DISPATCHED','DELIVERED','PARTIALLY_FULFILLED'):
            raise ValidationError({'order':'Order is not available for receipt acceptance'})
        if order.accepted_qtl+order.cancelled_qtl+quantity>order.quantity_qtl:
            raise ValidationError({'quantity_qtl':'Exceeds remaining ordered quantity'})
        shipment=Shipment.objects.filter(order=order).first()
        if shipment and shipment.status!='DELIVERED':
            raise ValidationError({'shipment':'Carrier has not reported delivery'})
        if not shipment and request.data.get('farmgate_handover_confirmed') is not True:
            raise ValidationError({'farmgate_handover_confirmed':'Buyer must explicitly confirm farmgate handover'})
        listing=Listing.objects.select_for_update().get(pk=order.listing_id)
        if listing.reserved_qtl<quantity or listing.quantity_qtl<quantity:
            raise ValidationError({'inventory':'Cannot safely finalize quantity; administrator review required'})
        listing.quantity_qtl-=quantity
        listing.reserved_qtl-=quantity
        # A listing with zero stock cannot remain publicly available.
        if listing.quantity_qtl==0:
            listing.status='CLOSED'
        listing.save(update_fields=['quantity_qtl','reserved_qtl','status'])
        order.accepted_qtl+=quantity
        full=order.accepted_qtl+order.cancelled_qtl==order.quantity_qtl
        order.status='DELIVERED' if full else 'PARTIALLY_FULFILLED'
        order.save(update_fields=['accepted_qtl','status','updated_at'])
        acceptance=DeliveryAcceptance.objects.create(order=order,quantity_qtl=quantity,
            accepted_by=request.user,evidence_note=evidence)
        notify(order.farmer,'DELIVERY_ACCEPTED',f'Buyer accepted {quantity} qtl of order {order.pk}; buyer declaration only')
        log(request.user,'BUYER_ACCEPTED_DELIVERY',acceptance.pk,order=str(order.pk),quantity_qtl=str(quantity))
    return Response({'acceptance':DeliveryAcceptanceSerializer(acceptance).data,
                     'order':OrderSerializer(order).data,
                     'notice':'Buyer-declared acceptance, not independently verified physical delivery.'},status=201)


@api_view(['GET','POST'])
def order_changes(request):
    if request.method=='GET':
        rows=OrderChangeRequest.objects.filter(Q(order__farmer=request.user)|Q(order__buyer=request.user)).order_by('-created_at')[:100]
        return Response(OrderChangeSerializer(rows,many=True).data)
    require_trade(request.user,'FARMER','BUYER')
    quantity=positive_quantity(request.data.get('quantity_qtl'))
    kind=request.data.get('kind')
    if kind not in ('CANCEL_REMAINDER','RETURN'):
        raise ValidationError({'kind':'CANCEL_REMAINDER or RETURN required'})
    reason=str(request.data.get('reason') or '').strip()
    if not (10<=len(reason)<=1000):
        raise ValidationError({'reason':'Explain the reason (10–1000 characters)'})
    with transaction.atomic():
        order=Order.objects.select_for_update().filter(pk=valid_order_id(request.data.get('order'))).first()
        if not order: raise NotFound('Order not found')
        participant(order,request.user)
        if order.status in ('CANCELLED','DISPUTED','RETURNED'):
            raise ValidationError({'order':'Resolve the existing order state first'})
        if OrderChangeRequest.objects.filter(order=order,status='PROPOSED').exists():
            raise ValidationError({'order':'Existing change request needs a response first'})
        remainder=order.quantity_qtl-order.accepted_qtl-order.cancelled_qtl
        if kind=='CANCEL_REMAINDER':
            if remainder<=0 or quantity!=remainder:
                raise ValidationError({'quantity_qtl':'Cancellation must cover all remaining unaccepted quantity'})
            sh=Shipment.objects.filter(order=order).first()
            if sh and sh.status in ('PICKED_UP','IN_TRANSIT'):
                raise ValidationError({'shipment':'Active shipments require resolution before cancellation'})
        else:
            if quantity>order.accepted_qtl-order.returned_qtl:
                raise ValidationError({'quantity_qtl':'Cannot return more than previously accepted and not yet returned'})
        change=OrderChangeRequest.objects.create(order=order,kind=kind,quantity_qtl=quantity,
            reason=reason,proposed_by=request.user)
        notify(counterparty(order,request.user),'TRADE_CHANGE',f'Review proposed {kind} for order {order.pk}')
        log(request.user,'ORDER_CHANGE_REQUESTED',change.pk,kind=kind,quantity=str(quantity))
    return Response(OrderChangeSerializer(change).data,status=201)


@api_view(['POST'])
def order_change_respond(request,pk):
    require_trade(request.user,'FARMER','BUYER')
    decision=request.data.get('decision')
    if decision not in ('APPROVE','REJECT'): raise ValidationError({'decision':'APPROVE or REJECT required'})
    with transaction.atomic():
        change=OrderChangeRequest.objects.select_for_update().filter(pk=pk).first()
        if not change: raise NotFound()
        order=Order.objects.select_for_update().get(pk=change.order_id)
        participant(order,request.user)
        if change.proposed_by_id==request.user.pk:
            raise PermissionDenied('The other trading party must respond')
        if change.status!='PROPOSED' or order.status=='DISPUTED':
            raise ValidationError({'change':'Request is already processed or order is disputed'})
        if decision=='APPROVE':
            if change.kind=='CANCEL_REMAINDER':
                remain=order.quantity_qtl-order.accepted_qtl-order.cancelled_qtl
                if change.quantity_qtl!=remain: raise ValidationError({'quantity_qtl':'Order quantity has changed'})
                listing=Listing.objects.select_for_update().get(pk=order.listing_id)
                if listing.reserved_qtl<remain: raise ValidationError({'inventory':'Insufficient reserved stock'})
                listing.reserved_qtl-=remain
                listing.save(update_fields=['reserved_qtl'])
                order.cancelled_qtl+=remain
                order.status='PARTIALLY_FULFILLED' if order.accepted_qtl>0 else 'CANCELLED'
            else:
                if change.quantity_qtl>order.accepted_qtl-order.returned_qtl:
                    raise ValidationError({'quantity_qtl':'Return quantity no longer available'})
                order.returned_qtl+=change.quantity_qtl
                if order.returned_qtl==order.accepted_qtl and order.accepted_qtl>0:
                    order.status='RETURNED'
                # Returned goods are NOT automatically available for resale.
            order.save(update_fields=['cancelled_qtl','returned_qtl','status','updated_at'])
            change.status='APPROVED'
        else:
            change.status='REJECTED'
        change.responded_by=request.user
        change.responded_at=timezone.now()
        change.save(update_fields=['status','responded_by','responded_at'])
        notify(change.proposed_by,'TRADE_CHANGE',f'Order change {change.pk}: {change.status}. Financial refunds are separate.')
        log(request.user,'ORDER_CHANGE_'+change.status,change.pk,kind=change.kind)
    return Response({'change':OrderChangeSerializer(change).data,'order':OrderSerializer(order).data,
                     'notice':'Trade adjustment recorded; no payment or refund implied.'})


@api_view(['GET','POST'])
def trade_disputes(request):
    if request.method=='GET':
        rows=TradeDispute.objects.all() if request.user.role=='ADMIN' and request.user.is_staff else TradeDispute.objects.filter(
            Q(order__farmer=request.user)|Q(order__buyer=request.user))
        return Response(TradeDisputeSerializer(rows.order_by('-created_at')[:100],many=True).data)
    require_trade(request.user,'FARMER','BUYER')
    category=str(request.data.get('category') or '').strip()[:60]
    description=str(request.data.get('description') or '').strip()
    if not category or len(description)<15 or len(description)>5000:
        raise ValidationError({'description':'Category and 15–5000 character description are required'})
    with transaction.atomic():
        order=Order.objects.select_for_update().filter(pk=valid_order_id(request.data.get('order'))).first()
        if not order: raise NotFound()
        participant(order,request.user)
        if order.status in ('CANCELLED','DISPUTED') or TradeDispute.objects.filter(
                order=order,status__in=['OPEN','IN_REVIEW']).exists():
            raise ValidationError({'order':'Cannot open duplicate or cancelled-order dispute'})
        dispute=TradeDispute.objects.create(order=order,opened_by=request.user,category=category,
            description=description,previous_order_status=order.status)
        order.status='DISPUTED';order.save(update_fields=['status','updated_at'])
        notify(counterparty(order,request.user),'DISPUTE',f'A dispute was opened for order {order.pk}')
        log(request.user,'TRADE_DISPUTE_OPENED',dispute.pk,order=str(order.pk),category=category)
    return Response(TradeDisputeSerializer(dispute).data,status=201)


@api_view(['POST'])
def trade_dispute_resolve(request,pk):
    require_role(request.user,'ADMIN')
    if not request.user.is_staff: raise PermissionDenied('Administrator review required')
    outcome=request.data.get('decision')
    if outcome not in ('RESOLVE','REJECT'):
        raise ValidationError({'decision':'RESOLVE or REJECT required'})
    note=str(request.data.get('resolution_note') or '').strip()
    if len(note)<15: raise ValidationError({'resolution_note':'Give an auditable resolution reason'})
    with transaction.atomic():
        dispute=TradeDispute.objects.select_for_update().filter(pk=pk).first()
        if not dispute: raise NotFound()
        if dispute.status not in ('OPEN','IN_REVIEW'):
            raise ValidationError({'dispute':'Dispute is already closed'})
        order=Order.objects.select_for_update().get(pk=dispute.order_id)
        dispute.status='RESOLVED' if outcome=='RESOLVE' else 'REJECTED'
        dispute.resolution_note=note[:5000];dispute.decided_by=request.user
        dispute.resolved_at=timezone.now()
        dispute.save(update_fields=['status','resolution_note','decided_by','resolved_at'])
        # Resolution unfreezes the previously recorded state; it does not move funds.
        order.status=dispute.previous_order_status
        order.save(update_fields=['status','updated_at'])
        for party in (order.farmer,order.buyer):
            notify(party,'DISPUTE',f'Dispute {dispute.pk} reviewed. Check resolution; no automatic refund.')
        log(request.user,'TRADE_DISPUTE_'+dispute.status,dispute.pk,order=str(order.pk))
    return Response(TradeDisputeSerializer(dispute).data)


@api_view(['GET','POST'])
def refunds(request):
    if request.method=='GET':
        qs=RefundRequest.objects.all() if request.user.role=='ADMIN' and request.user.is_staff else RefundRequest.objects.filter(
            Q(order__buyer=request.user)|Q(order__farmer=request.user))
        return Response(RefundRequestSerializer(qs.order_by('-created_at')[:100],many=True).data)
    require_trade(request.user,'FARMER','BUYER')
    try:
        amount=int(str(request.data.get('amount_paise')))
        if amount<1: raise ValueError()
    except (ValueError,TypeError): raise ValidationError({'amount_paise':'Positive integer amount in paise required'})
    reason=str(request.data.get('reason') or '').strip()
    if len(reason)<15 or len(reason)>1000:
        raise ValidationError({'reason':'Explain the refund reason (15–1000 characters)'})
    try:
        payment_id=int(str(request.data.get('payment')))
        if payment_id<=0: raise ValueError()
    except (ValueError,TypeError): raise ValidationError({'payment':'A valid captured payment ID is required'})
    with transaction.atomic():
        payment=PaymentAttempt.objects.select_for_update().filter(pk=payment_id).first()
        if not payment: raise NotFound('Payment attempt not found')
        order=Order.objects.select_for_update().get(pk=payment.order_id)
        participant(order,request.user)
        if payment.status!='CAPTURED' or not payment.gateway_payment_id:
            raise ValidationError({'payment':'Only gateway-confirmed captured payments may be refunded'})
        reserved=sum(r.amount_paise for r in RefundRequest.objects.filter(payment=payment).exclude(status__in=['REJECTED','FAILED']))
        if amount+reserved>payment.amount_paise:
            raise ValidationError({'amount_paise':'Exceeds amount available to refund'})
        refund=RefundRequest.objects.create(order=order,payment=payment,requested_by=request.user,
            amount_paise=amount,reason=reason)
        log(request.user,'REFUND_REQUESTED',refund.pk,amount_paise=amount)
    return Response(RefundRequestSerializer(refund).data,status=201)


@api_view(['POST'])
def refund_review(request,pk):
    """Admin sends one refund request to Razorpay; webhook is sole success confirmation."""
    require_role(request.user,'ADMIN')
    if not request.user.is_staff: raise PermissionDenied('Administrator review required')
    decision=request.data.get('decision')
    if decision not in ('REJECT','SUBMIT'): raise ValidationError({'decision':'REJECT or SUBMIT required'})
    if decision=='SUBMIT' and not payment_provider_configured():
        return Response({'detail':'Merchant refund provider is unconfigured'},status=503)
    with transaction.atomic():
        refund=RefundRequest.objects.select_for_update().select_related('payment').filter(pk=pk).first()
        if not refund: raise NotFound()
        if refund.status!='REQUESTED':
            raise ValidationError({'refund':'Already reviewed. Do not resubmit a provider request blindly.'})
        refund.decided_by=request.user
        refund.status='REJECTED' if decision=='REJECT' else 'PROVIDER_PENDING'
        refund.save(update_fields=['decided_by','status','updated_at'])
        log(request.user,'REFUND_'+refund.status,refund.pk,amount_paise=refund.amount_paise)
        if decision=='REJECT': return Response(RefundRequestSerializer(refund).data)
    # A request that timed out may have reached the provider: retain PENDING
    # and reconcile externally instead of issuing potentially duplicate refunds.
    try:
        response=requests.post(f'https://api.razorpay.com/v1/payments/{refund.payment.gateway_payment_id}/refund',
            json={'amount':refund.amount_paise,'speed':'normal','receipt':f'krishi-{refund.pk}',
                  'notes':{'krishisetu_refund':str(refund.pk)}},
            auth=(settings.RAZORPAY_KEY_ID,settings.RAZORPAY_KEY_SECRET),timeout=20)
        response.raise_for_status()
        data=response.json()
        if (data.get('payment_id')!=refund.payment.gateway_payment_id or
            data.get('amount')!=refund.amount_paise or not data.get('id') or
            data.get('status') not in ('pending','processed','created','processing')):
            raise ValueError('Unexpected refund provider response')
    except (requests.RequestException,ValueError,TypeError):
        log(request.user,'REFUND_PROVIDER_RESULT_UNKNOWN',refund.pk)
        return Response({'status':'PROVIDER_PENDING','detail':'Provider result unknown; reconcile in merchant dashboard. Do not retry automatically.'},status=502)
    refund.gateway_refund_id=data['id']
    refund.save(update_fields=['gateway_refund_id','updated_at'])
    return Response(RefundRequestSerializer(refund).data)


@api_view(['POST'])
def acknowledge_manual_settlement(request,pk):
    require_trade(request.user,'FARMER','BUYER')
    with transaction.atomic():
        settlement=Settlement.objects.select_for_update().select_related('order').filter(pk=pk).first()
        if not settlement: raise NotFound()
        participant(settlement.order,request.user)
        if settlement.declared_by_id==request.user.id:
            raise PermissionDenied('Only the other trading party may acknowledge this declaration')
        if settlement.status!='DECLARED':
            raise ValidationError({'settlement':'Already acknowledged'})
        if request.data.get('acknowledge') is not True:
            raise ValidationError({'acknowledge':'Explicit acknowledgement is required'})
        settlement.status='RECONCILED'  # two-party claim ONLY, not bank confirmation
        settlement.acknowledged_by=request.user
        settlement.acknowledged_at=timezone.now()
        settlement.save(update_fields=['status','acknowledged_by','acknowledged_at'])
        log(request.user,'MANUAL_SETTLEMENT_ACKNOWLEDGED',settlement.pk)
    return Response({'settlement_id':settlement.pk,'status':settlement.status,
                     'notice':'Counterparty acknowledged the manual declaration; bank settlement not independently verified.'})


@api_view(['PATCH','DELETE'])
def listing_detail(request,pk):
    require_trade(request.user,'FARMER')
    with transaction.atomic():
        listing=Listing.objects.select_for_update().filter(pk=pk,farmer=request.user).first()
        if not listing: raise NotFound()
        if request.method=='DELETE':
            listing.status='CLOSED'
            listing.save(update_fields=['status'])
        else:
            from .serializers import ListingSerializer
            from .views import validate_image
            s=ListingSerializer(listing,data=request.data,partial=True,context={'request':request})
            s.is_valid(raise_exception=True)
            if 'quantity_qtl' in s.validated_data and s.validated_data['quantity_qtl']<listing.reserved_qtl:
                raise ValidationError({'quantity_qtl':'Cannot reduce stock below reserved quantity'})
            validate_image(s.validated_data.get('image'))
            listing=s.save()
        log(request.user,'LISTING_EDITED' if request.method=='PATCH' else 'LISTING_CLOSED',listing.pk)
    from .serializers import ListingSerializer
    return Response(ListingSerializer(listing,context={'request':request}).data)


@api_view(['GET'])
def admin_queue(request):
    require_role(request.user,'ADMIN')
    if not request.user.is_staff: raise PermissionDenied()
    return Response({
        'unverified_vehicles':VehicleSerializer(Vehicle.objects.filter(verified=False).order_by('id')[:100],many=True).data,
        'open_disputes':TradeDisputeSerializer(TradeDispute.objects.filter(status__in=['OPEN','IN_REVIEW']).order_by('id')[:100],many=True).data,
        'pending_refunds':RefundRequestSerializer(RefundRequest.objects.filter(status='REQUESTED').order_by('id')[:100],many=True).data,
    })


@api_view(['POST'])
def admin_verify_vehicle(request,pk):
    require_role(request.user,'ADMIN')
    if not request.user.is_staff: raise PermissionDenied()
    if request.data.get('verified') is not True or len(str(request.data.get('evidence_note') or ''))<15:
        raise ValidationError({'evidence_note':'Explicit administrator approval and evidence-review note required'})
    vehicle=Vehicle.objects.filter(pk=pk).first()
    if not vehicle: raise NotFound()
    vehicle.verified=True;vehicle.save(update_fields=['verified'])
    log(request.user,'ADMIN_VEHICLE_VERIFIED',vehicle.pk,registration=vehicle.registration)
    notify(vehicle.transporter,'VERIFICATION',f'Vehicle {vehicle.registration} approved by administrator')
    return Response(VehicleSerializer(vehicle).data)


@api_view(['POST'])
def admin_verify_identity(request,pk):
    require_role(request.user,'ADMIN')
    if not request.user.is_staff: raise PermissionDenied()
    if request.data.get('verified') is not True or len(str(request.data.get('evidence_note') or ''))<15:
        raise ValidationError({'evidence_note':'Explicit approval and review evidence are required'})
    user=User.objects.filter(pk=pk,role__in=['FARMER','BUYER','TRANSPORTER']).first()
    if not user: raise NotFound()
    user.identity_verified=True;user.save(update_fields=['identity_verified'])
    # Minimal audit metadata: do not put government ID number into audit logs.
    log(request.user,'ADMIN_IDENTITY_REVIEW_APPROVED',user.pk,review_recorded=True)
    notify(user,'VERIFICATION','Your submitted identity review was approved; contact support for questions')
    return Response({'user_id':user.pk,'identity_verified':True})
