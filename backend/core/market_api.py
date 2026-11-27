"""Read-only source coverage and operational import reporting."""
from datetime import timedelta
from django.db.models import Count, Max
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


class MarketSyncRateThrottle(AnonRateThrottle):
    scope = 'market_sync'

from .models import MandiPrice, MarketImportRun, Offer


def freshness(day):
    if day is None:
        return 'UNAVAILABLE_DATA'
    age = (timezone.localdate() - day).days
    return 'RECENT_OBSERVATION' if 0 <= age <= 2 else 'DELAYED_DATA' if 3 <= age <= 7 else 'HISTORICAL_DATA'


@api_view(['GET'])
@permission_classes([AllowAny])
def market_coverage(request):
    qs=MandiPrice.objects.filter(quality_status='VALID',observed_on__lte=timezone.localdate())
    crop=request.query_params.get('crop')
    if crop:
        if not crop.isdecimal():
            raise ValidationError({'crop':'Numeric crop ID required'})
        qs=qs.filter(crop_id=int(crop))
    latest=list(qs.values('crop_id','crop__name','market_id','market__name',
        'market__district','market__state').annotate(latest_observed_on=Max('observed_on'),
        observation_count=Count('id')).order_by('-latest_observed_on','market__name')[:250])
    for item in latest:
        item['freshness']=freshness(item['latest_observed_on'])
    return Response({'status':'OBSERVED_DATA' if latest else 'UNAVAILABLE_DATA',
        'coverage':latest, 'rows':len(latest),
        'note':'Valid stored observations only, not guaranteed current market bids. Showing up to 250 crop–market pairs.'})


@api_view(['GET'])
def import_monitor(request):
    if request.user.role!='ADMIN' or not request.user.is_staff:
        raise PermissionDenied('Administrator access required')
    latest=list(MarketImportRun.objects.order_by('-started_at')[:30].values(
        'id','source','resource_id','status','started_at','finished_at',
        'pages_count','received_count','created_count','updated_count',
        'unchanged_count','invalid_count','flagged_count','error'))
    flagged=list(MandiPrice.objects.filter(quality_status='FLAGGED').order_by('-imported_at')
        .values('id','source','observed_on','source_record_id','quality_flags','modal_price')[:30])
    return Response({'runs':latest,'flagged_samples':flagged,
        'note':'Flagged observations cannot appear in recommendations or forecasts.'})


@api_view(['POST'])
@throttle_classes([UserRateThrottle])
def trigger_sync(request):
    """Trigger background mandi data sync immediately (Administrator only)."""
    if not request.user.is_authenticated or request.user.role != 'ADMIN' or not request.user.is_staff:
        raise PermissionDenied('Administrator access required to synchronize live market feeds.')
    from .scheduler import sync_now_in_background
    started = sync_now_in_background()
    return Response({
        'status': 'SCHEDULED' if started else 'ALREADY_RUNNING',
        'message': 'Mandi synchronization started in background.' if started else 'Mandi synchronization is already running.'
    })



MAX_MARKET_OPTIONS = 250


def eligible_market_prices(crop_id, *, state='', district='', variety=None, grade=None):
    """A recent observation per market; never include flagged or old data.

    The selection is not a confirmed buyer bid and should not be interpreted as
    universal price for varieties/grades not selected by the farmer.
    """
    today=timezone.localdate()
    qs=MandiPrice.objects.filter(crop_id=crop_id,quality_status='VALID',
        observed_on__gte=today-timedelta(days=7),observed_on__lte=today).select_related('market')
    if state:qs=qs.filter(market__state__iexact=state.strip())
    if district:qs=qs.filter(market__district__iexact=district.strip())
    if variety is not None:qs=qs.filter(variety__iexact=variety.strip())
    if grade is not None:qs=qs.filter(grade__iexact=grade.strip())
    found=[];seen=set();truncated=False
    for price in qs.order_by('-observed_on','-id').iterator(chunk_size=500):
        if price.market_id in seen:continue
        if len(found)==MAX_MARKET_OPTIONS:
            truncated=True
            break
        seen.add(price.market_id);found.append(price)
    return found,truncated


@api_view(['GET'])
@permission_classes([AllowAny])
def selling_opportunities(request):
    crop=request.query_params.get('crop')
    if not crop or not crop.isdecimal():
        raise ValidationError({'crop':'Numeric crop ID required'})
    prices,truncated=eligible_market_prices(int(crop),
        state=str(request.query_params.get('state',''))[:120],
        district=str(request.query_params.get('district',''))[:120],
        variety=request.query_params.get('variety'),grade=request.query_params.get('grade'))
    today=timezone.localdate()
    opportunities=[{'key':f'market:{p.market_id}','name':str(p.market),
        'kind':'MANDI','price_per_qtl':str(p.modal_price),'market_id':p.market_id,
        'state':p.market.state,'district':p.market.district,
        'source':p.source,'source_record_id':p.source_record_id,
        'observed_on':p.observed_on.isoformat(),
        'freshness_days':(today-p.observed_on).days,
        'variety':p.variety,'grade':p.grade} for p in prices]
    if (request.user.is_authenticated and request.user.role=='FARMER'
        and request.user.account_verified):
        offers=Offer.objects.filter(listing__farmer=request.user,
            listing__crop_id=int(crop),status='PENDING',expires_at__gt=timezone.now(),
            buyer__email_verified=True,buyer__phone_verified=True).select_related('listing')
        if request.query_params.get('variety') is not None:
            offers=offers.filter(listing__variety__iexact=request.query_params['variety'])
        if request.query_params.get('grade') is not None:
            offers=offers.filter(listing__grade__iexact=request.query_params['grade'])
        if request.query_params.get('state'):
            offers=offers.filter(listing__state__iexact=request.query_params['state'])
        if request.query_params.get('district'):
            offers=offers.filter(listing__district__iexact=request.query_params['district'])
        for offer in offers[:250]:
            opportunities.append({'key':f'offer:{offer.pk}',
                'name':f'Direct verified-account offer #{offer.pk}',
                'kind':'BUYER_OFFER','price_per_qtl':str(offer.price_per_qtl),
                'quantity_qtl':str(offer.quantity_qtl),
                'source':'Recorded pending buyer offer',
                'observed_on':offer.created_at.date().isoformat(),
                'freshness_days':(timezone.now().date()-offer.created_at.date()).days,
                'variety':offer.listing.variety,'grade':offer.listing.grade})
    return Response({'status':'OBSERVED_OPPORTUNITIES' if opportunities else 'UNAVAILABLE_DATA',
        'opportunities':opportunities,'truncated':truncated,
        'notes':'Mandi prices are observations, not executable bids. Costs required for net-return ranking. Buyer offers are pending, not guaranteed.'})
