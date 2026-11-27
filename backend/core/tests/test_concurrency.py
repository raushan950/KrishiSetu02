"""Concurrency and race-condition tests for trading inventory reservation.

Proves that competing acceptances of the same inventory cannot oversell stock.
Verifies:
1. Sequential race condition: Second competing offer is rejected when remaining inventory is insufficient.
2. Database check constraint enforcement: Database rejects any transaction setting reserved_qtl > quantity_qtl.
3. Multi-threaded row locking when executed against PostgreSQL.
"""
from decimal import Decimal
from concurrent.futures import ThreadPoolExecutor
from django.db import connection, IntegrityError
from django.test import TransactionTestCase
from django.utils import timezone
from rest_framework.test import APIClient

from core.models import User, Crop, Listing, Offer, Order


class ConcurrencyTradingTests(TransactionTestCase):
    def setUp(self):
        self.farmer = User.objects.create_user(
            email='concurrency-farmer@example.org',
            password='Password123#Valid',
            role='FARMER',
            email_verified=True,
            phone_verified=True,
        )
        self.buyer1 = User.objects.create_user(
            email='buyer1@example.org',
            password='Password123#Valid',
            role='BUYER',
            email_verified=True,
            phone_verified=True,
        )
        self.buyer2 = User.objects.create_user(
            email='buyer2@example.org',
            password='Password123#Valid',
            role='BUYER',
            email_verified=True,
            phone_verified=True,
        )
        self.crop = Crop.objects.create(name='Concurrency Wheat', hindi_name='गेहूं')
        self.listing = Listing.objects.create(
            farmer=self.farmer,
            crop=self.crop,
            quantity_qtl=Decimal('10.000'),
            reserved_qtl=Decimal('0.000'),
            asking_per_qtl=Decimal('2200.00'),
            district='Bathinda',
            state='Punjab',
        )

    def test_competing_offers_cannot_oversell_available_inventory(self):
        # Two offers of 6 quintals each against 10 quintals total available
        offer1 = Offer.objects.create(
            listing=self.listing,
            buyer=self.buyer1,
            proposed_by=self.buyer1,
            quantity_qtl=Decimal('6.000'),
            price_per_qtl=Decimal('2200.00'),
            status='PENDING',
            expires_at=timezone.now() + timezone.timedelta(hours=24),
        )
        offer2 = Offer.objects.create(
            listing=self.listing,
            buyer=self.buyer2,
            proposed_by=self.buyer2,
            quantity_qtl=Decimal('6.000'),
            price_per_qtl=Decimal('2200.00'),
            status='PENDING',
            expires_at=timezone.now() + timezone.timedelta(hours=24),
        )

        def accept(offer_id):
            client = APIClient()
            client.force_authenticate(user=self.farmer)
            return client.post(f'/api/v1/offers/{offer_id}/accept/', {}, format='json')

        if connection.vendor == 'postgresql':
            # PostgreSQL supports concurrent row-level locking (select_for_update)
            with ThreadPoolExecutor(max_workers=2) as executor:
                future1 = executor.submit(accept, offer1.id)
                future2 = executor.submit(accept, offer2.id)
                res1 = future1.result()
                res2 = future2.result()

            statuses = [res1.status_code, res2.status_code]
            self.assertIn(201, statuses)
            self.assertIn(400, statuses)
        else:
            # Under SQLite (table-level file lock), execute sequentially to prove inventory boundary
            res1 = accept(offer1.id)
            res2 = accept(offer2.id)
            self.assertEqual(res1.status_code, 201)
            self.assertEqual(res2.status_code, 400)
            self.assertIn('Insufficient available quantity', str(res2.data))

        self.listing.refresh_from_db()
        # Reserved stock must be exactly 6.000, NEVER 12.000
        self.assertEqual(self.listing.reserved_qtl, Decimal('6.000'))
        self.assertLessEqual(self.listing.reserved_qtl, self.listing.quantity_qtl)

        # Exactly 1 order must exist
        self.assertEqual(Order.objects.filter(listing=self.listing).count(), 1)

    def test_database_check_constraint_rejects_oversold_inventory(self):
        # Direct attempt to set reserved > quantity must be blocked by PostgreSQL/SQLite check constraint
        self.listing.reserved_qtl = Decimal('11.000')
        with self.assertRaises(IntegrityError):
            self.listing.save(update_fields=['reserved_qtl'])
