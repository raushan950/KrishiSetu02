"""Public crop catalogue, not market pricing or trading sample data."""
from django.core.management.base import BaseCommand
from core.models import Crop

CROPS={
    'Wheat':'गेहूँ', 'Paddy':'धान', 'Maize':'मक्का', 'Mustard':'सरसों',
    'Cotton':'कपास', 'Potato':'आलू', 'Tomato':'टमाटर', 'Onion':'प्याज',
    'Sugarcane':'गन्ना', 'Chickpea':'चना', 'Soybean':'सोयाबीन',
    'Green Gram':'मूंग', 'Bajra':'बाजरा', 'Barley':'जौ', 'Groundnut':'मूंगफली',
}

class Command(BaseCommand):
    help='Create basic crop catalogue entries only. No prices or transactions are seeded.'
    def handle(self,*args,**options):
        created=0
        for name,hindi in CROPS.items():
            _,was_created=Crop.objects.get_or_create(name=name,defaults={'hindi_name':hindi})
            created+=was_created
        self.stdout.write(self.style.SUCCESS(f'Added {created} crop catalogue entries; no price records were generated'))
