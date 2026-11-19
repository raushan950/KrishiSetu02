"""API tests for courier capacity, booking conflicts and private milestone timeline."""
from datetime import timedelta
from decimal import Decimal
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from core.models import (User,Crop,Listing,Offer,Order,Vehicle,FreightRequest,
                         FreightQuote,Shipment,ShipmentEvent)


class LogisticsTests(TestCase):
    def setUp(self):
        self.client=APIClient()
        self.farmer=User.objects.create_user('log-farmer@example.org','Good#Password619',role='FARMER',
            phone='+919876543621',email_verified=True,phone_verified=True)
        self.buyer=User.objects.create_user('log-buyer@example.org','Good#Password619',role='BUYER',
            phone='+919876543622',email_verified=True,phone_verified=True)
        self.transporter=User.objects.create_user('log-carrier@example.org','Good#Password619',role='TRANSPORTER',
            phone='+919876543623',email_verified=True,phone_verified=True)
        self.other=User.objects.create_user('log-other@example.org','Good#Password619',role='FARMER',
            phone='+919876543624',email_verified=True,phone_verified=True)
        self.vehicle=Vehicle.objects.create(transporter=self.transporter,registration='PB10TEST6677',
            vehicle_type='TRUCK',capacity_qtl=Decimal('15'),verified=True)
        crop=Crop.objects.create(name='Freight sample crop')
        self.orders=[]
        for i in range(2):
            listing=Listing.objects.create(farmer=self.farmer,crop=crop,quantity_qtl='20',
                reserved_qtl='5',asking_per_qtl='1500',district='Test',state='Punjab')
            offer=Offer.objects.create(listing=listing,buyer=self.buyer,proposed_by=self.buyer,
                quantity_qtl='5',price_per_qtl='1500',status='ACCEPTED',
                expires_at=timezone.now()+timedelta(days=2))
            self.orders.append(Order.objects.create(offer=offer,listing=listing,farmer=self.farmer,
                buyer=self.buyer,quantity_qtl='5',price_per_qtl='1500'))
        self.day=timezone.localdate()+timedelta(days=1)
        self.client.force_authenticate(user=self.farmer)
        self.requests=[]
        for i,order in enumerate(self.orders):
            response=self.client.post('/api/v1/freight/requests/',{'order':str(order.id),
                'pickup_location':'Farm Gate','dropoff_location':'Fixture warehouse',
                'pickup_date':self.day.isoformat()},format='json')
            self.assertEqual(response.status_code,201,response.data)
            self.requests.append(response.data['id'])
        self.client.force_authenticate(user=self.transporter)
        self.quotes=[]
        for request_id in self.requests:
            response=self.client.post('/api/v1/freight/quotes/',{'freight_request':request_id,
                'vehicle':self.vehicle.id,'price_inr':'650'},format='json')
            self.assertEqual(response.status_code,201,response.data)
            self.quotes.append(response.data['id'])

    def test_active_vehicle_cannot_be_assigned_twice_on_same_day(self):
        self.client.force_authenticate(user=self.farmer)
        first=self.client.post(f'/api/v1/freight/quotes/{self.quotes[0]}/assign/')
        self.assertEqual(first.status_code,201,first.data)
        second=self.client.post(f'/api/v1/freight/quotes/{self.quotes[1]}/assign/')
        self.assertEqual(second.status_code,400,second.data)
        self.assertEqual(Shipment.objects.count(),1)
        self.assertEqual(ShipmentEvent.objects.count(),1)

    def test_transporter_milestones_have_history_and_permission_checks(self):
        self.client.force_authenticate(user=self.farmer)
        assign=self.client.post(f'/api/v1/freight/quotes/{self.quotes[0]}/assign/')
        shipment=assign.data['id']
        self.client.force_authenticate(user=self.transporter)
        invalid=self.client.post(f'/api/v1/shipments/{shipment}/update/',{'status':'DELIVERED'},format='json')
        self.assertEqual(invalid.status_code,400)
        for milestone in ('PICKED_UP','IN_TRANSIT','DELIVERED'):
            response=self.client.post(f'/api/v1/shipments/{shipment}/update/',{
                'status':milestone,'evidence_note':'Carrier observed produce handover at destination'},format='json')
            self.assertEqual(response.status_code,200,response.data)
        timeline=self.client.get(f'/api/v1/shipments/{shipment}/events/')
        self.assertEqual([e['status'] for e in timeline.data],
            ['ASSIGNED','PICKED_UP','IN_TRANSIT','DELIVERED'])
        self.assertEqual(ShipmentEvent.objects.count(),4)
        self.client.force_authenticate(user=self.other)
        self.assertEqual(self.client.get(f'/api/v1/shipments/{shipment}/events/').status_code,403)

    def test_unverified_vehicle_or_negative_quote_is_rejected(self):
        self.client.force_authenticate(user=self.transporter)
        bad=self.client.post('/api/v1/freight/quotes/',{
            'freight_request':self.requests[0],'vehicle':self.vehicle.pk,'price_inr':'-1'},format='json')
        self.assertEqual(bad.status_code,400)


class SoldOutInventoryTest(TestCase):
    """Prevent the zero-remaining-stock/check-constraint regression."""
    def test_entire_listing_can_be_fulfilled_and_closed(self):
        farmer=User.objects.create_user('complete-farmer@example.org','Good#Password619',role='FARMER',
            phone='+919876543625',email_verified=True,phone_verified=True)
        buyer=User.objects.create_user('complete-buyer@example.org','Good#Password619',role='BUYER',
            phone='+919876543626',email_verified=True,phone_verified=True)
        crop=Crop.objects.create(name='Full fulfillment fixture')
        listing=Listing.objects.create(farmer=farmer,crop=crop,quantity_qtl=Decimal('2'),
            reserved_qtl=Decimal('2'),asking_per_qtl=Decimal('2000'),district='Test',state='Punjab')
        offer=Offer.objects.create(listing=listing,buyer=buyer,proposed_by=buyer,
            quantity_qtl=Decimal('2'),price_per_qtl=Decimal('2000'),status='ACCEPTED',
            expires_at=timezone.now()+timedelta(days=2))
        order=Order.objects.create(offer=offer,listing=listing,farmer=farmer,buyer=buyer,
            quantity_qtl=Decimal('2'),price_per_qtl=Decimal('2000'))
        c=APIClient();c.force_authenticate(user=buyer)
        response=c.post(f'/api/v1/orders/{order.pk}/accept-delivery/',
            {'quantity_qtl':'2','farmgate_handover_confirmed':True},format='json')
        self.assertEqual(response.status_code,201,response.data)
        listing.refresh_from_db();order.refresh_from_db()
        self.assertEqual(listing.quantity_qtl,0)
        self.assertEqual(listing.reserved_qtl,0)
        self.assertEqual(listing.status,'CLOSED')
        self.assertEqual(order.status,'DELIVERED')
