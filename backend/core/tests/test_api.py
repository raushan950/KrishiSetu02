from datetime import timedelta
from decimal import Decimal
from django.test import TestCase,override_settings
from django.utils import timezone
from django.core import mail
from rest_framework.test import APIClient
from core.models import User,Crop,Market,MandiPrice,Listing,Offer,Order,VerificationChallenge

@override_settings(DEBUG=True,EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
class ApiTests(TestCase):
    def setUp(self):
        self.client=APIClient()
        self.farmer=User.objects.create_user(email='farmer@example.org',password='Strong#Farmer99',phone='+919876543210',role='FARMER',email_verified=True,phone_verified=True)
        self.buyer=User.objects.create_user(email='buyer@example.org',password='Strong#Buyer99',phone='+919876543211',role='BUYER',email_verified=True,phone_verified=True)
        self.other=User.objects.create_user(email='other@example.org',password='Strong#Other99',phone='+919876543212',role='BUYER',email_verified=True,phone_verified=True)
        self.crop=Crop.objects.create(name='Wheat')
        self.market=Market.objects.create(name='Example Mandi',district='Example District',state='Punjab')
        self.price=MandiPrice.objects.create(market=self.market,crop=self.crop,min_price=2200,max_price=2600,modal_price=2400,
            observed_on=timezone.localdate()-timedelta(days=3),source='TEST_FIXTURE_NOT_LIVE',source_record_id='test-001')
        self.listing=Listing.objects.create(farmer=self.farmer,crop=self.crop,quantity_qtl='10',asking_per_qtl='2400',district='Example District',state='Punjab')

    def auth(self,user):self.client.force_authenticate(user=user)

    def test_market_observation_has_provenance_and_age(self):
        r=self.client.get('/api/v1/prices/')
        self.assertEqual(r.status_code,200)
        item=r.data['results'][0]
        self.assertEqual(item['source'],'TEST_FIXTURE_NOT_LIVE')
        self.assertEqual(item['freshness'],'DATED')

    def test_registration_rejects_privileged_role(self):
        r=self.client.post('/api/v1/auth/register/',{'email':'admin@example.org','phone':'+919876543213','password':'Strong#Admin99','role':'ADMIN'})
        self.assertEqual(r.status_code,400)
        self.assertFalse(User.objects.filter(email='admin@example.org').exists())

    def test_registration_requires_real_email_challenge(self):
        r=self.client.post('/api/v1/auth/register/',{'email':'new@example.org','phone':'+919876543213','password':'Strong#Enough99','role':'FARMER'})
        self.assertEqual(r.status_code,201)
        person=User.objects.get(email='new@example.org')
        self.assertFalse(person.account_verified)
        self.assertEqual(VerificationChallenge.objects.filter(user=person,kind='EMAIL').count(),1)
        self.assertEqual(len(mail.outbox),1)

    def test_profile_blocks_privileged_role_edit(self):
        self.auth(self.farmer)
        r=self.client.patch('/api/v1/auth/me/',{'role':'ADMIN'},format='json')
        self.assertEqual(r.status_code,200)
        self.farmer.refresh_from_db()
        self.assertEqual(self.farmer.role,'FARMER')

    def test_offers_restrict_unverified_buyers(self):
        self.buyer.phone_verified=False
        self.buyer.save(update_fields=['phone_verified'])
        self.auth(self.buyer)
        r=self.client.post('/api/v1/offers/',{'listing':self.listing.pk,'quantity_qtl':'3','price_per_qtl':'2500','expires_at':(timezone.now()+timedelta(days=2)).isoformat()})
        self.assertEqual(r.status_code,403)

    def test_offer_confirmation_reserves_stock_and_cannot_repeat(self):
        offer=Offer.objects.create(listing=self.listing,buyer=self.buyer,proposed_by=self.buyer,quantity_qtl='4',price_per_qtl='2450',expires_at=timezone.now()+timedelta(days=2))
        self.auth(self.other)
        self.assertEqual(self.client.post(f'/api/v1/offers/{offer.pk}/accept/').status_code,403)
        self.auth(self.farmer)
        response=self.client.post(f'/api/v1/offers/{offer.pk}/accept/')
        self.assertEqual(response.status_code,201)
        self.assertEqual(self.client.post(f'/api/v1/offers/{offer.pk}/accept/').status_code,400)
        self.listing.refresh_from_db()
        self.assertEqual(self.listing.reserved_qtl,Decimal('4'))
        self.assertEqual(Order.objects.count(),1)

    def test_buyer_accepts_farmer_counteroffer(self):
        original=Offer.objects.create(listing=self.listing,buyer=self.buyer,proposed_by=self.buyer,quantity_qtl='3',price_per_qtl='2400',expires_at=timezone.now()+timedelta(days=2))
        self.auth(self.farmer)
        counter=self.client.post(f'/api/v1/offers/{original.pk}/counter/',{'quantity_qtl':'3','price_per_qtl':'2500'},format='json')
        self.assertEqual(counter.status_code,201)
        self.auth(self.buyer)
        acceptance=self.client.post(f"/api/v1/offers/{counter.data['id']}/accept/")
        self.assertEqual(acceptance.status_code,201)
        order=Order.objects.get()
        self.assertEqual(order.farmer_id,self.farmer.pk)
        self.assertEqual(order.buyer_id,self.buyer.pk)

    def test_cancellation_returns_reserved_inventory(self):
        offer=Offer.objects.create(listing=self.listing,buyer=self.buyer,proposed_by=self.buyer,quantity_qtl='4',price_per_qtl='2450',expires_at=timezone.now()+timedelta(days=2))
        self.auth(self.farmer)
        order_id=self.client.post(f'/api/v1/offers/{offer.pk}/accept/').data['id']
        r=self.client.post(f'/api/v1/orders/{order_id}/cancel/')
        self.assertEqual(r.status_code,400)  # Legacy one-sided cancellation blocked.
        proposed=self.client.post('/api/v1/order-changes/',{
            'order':order_id,'kind':'CANCEL_REMAINDER','quantity_qtl':'4',
            'reason':'Remaining quantity will not be required by buyer'},format='json')
        self.assertEqual(proposed.status_code,201,proposed.data)
        self.auth(self.buyer)
        approved=self.client.post(f"/api/v1/order-changes/{proposed.data['id']}/respond/",{
            'decision':'APPROVE'},format='json')
        self.assertEqual(approved.status_code,200,approved.data)
        self.listing.refresh_from_db()
        self.assertEqual(self.listing.reserved_qtl,Decimal('0'))

    def test_missing_costs_do_not_produce_fabricated_recommendation(self):
        self.auth(self.farmer)
        r=self.client.post('/api/v1/recommendations/',{'crop_id':self.crop.pk,'quantity_qtl':'1','costs_by_destination':{}},format='json')
        self.assertEqual(r.status_code,200)
        self.assertEqual(r.data['ranked'],[])
        self.assertEqual(r.data['missing_cost_inputs'],[f'market:{self.market.pk}'])
