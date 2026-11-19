"""Razorpay gateway boundary. No merchant credentials are bundled.

A checkout callback alone never proves a payment has settled; a verified gateway
webhook with matching order, amount and status is required to mark CAPTURED.
"""
import hashlib
import hmac
from decimal import Decimal, ROUND_HALF_UP

import requests
from django.conf import settings


def payment_provider_configured():
    return bool(settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET and settings.RAZORPAY_WEBHOOK_SECRET)


def amount_in_paise(quantity_qtl, price_per_qtl):
    gross = (Decimal(quantity_qtl) * Decimal(price_per_qtl) * 100).quantize(Decimal('1'), rounding=ROUND_HALF_UP)
    if gross <= 0 or gross > 1000000000000:
        raise ValueError('Invalid gross payment amount')
    return int(gross)


def checkout_signature_ok(gateway_order_id, payment_id, supplied_signature):
    if not settings.RAZORPAY_KEY_SECRET or not all(isinstance(s, str) and s for s in (gateway_order_id, payment_id, supplied_signature)):
        return False
    message=f'{gateway_order_id}|{payment_id}'.encode()
    expected=hmac.new(settings.RAZORPAY_KEY_SECRET.encode(),message,hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, supplied_signature)


def webhook_signature_ok(raw, supplied_signature):
    if not settings.RAZORPAY_WEBHOOK_SECRET or not isinstance(supplied_signature,str) or not supplied_signature:
        return False
    expected=hmac.new(settings.RAZORPAY_WEBHOOK_SECRET.encode(),raw,hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected,supplied_signature)


def create_gateway_order(order_id, amount_paise):
    """Call the authenticated Orders API. API errors never imply payment success."""
    if not payment_provider_configured():
        raise RuntimeError('Gateway unavailable: merchant credentials and webhook secret required')
    response=requests.post('https://api.razorpay.com/v1/orders',
        json={'amount':amount_paise,'currency':'INR','receipt':str(order_id),
              'notes':{'krishisetu_order':str(order_id)}},
        auth=(settings.RAZORPAY_KEY_ID,settings.RAZORPAY_KEY_SECRET),timeout=15)
    response.raise_for_status()
    data=response.json()
    if (not isinstance(data,dict) or not isinstance(data.get('id'),str) or
        data.get('amount')!=amount_paise or data.get('currency')!='INR' or
        not data['id'].startswith('order_')):
        raise RuntimeError('Gateway returned an inconsistent order')
    return data['id']
