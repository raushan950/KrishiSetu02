"""Comprehensive Indian agricultural crop and commodity catalogue.

Covers all major agricultural commodities reported across APMC Mandis
and Agmarknet (Cereals, Pulses, Oilseeds, Commercial, Vegetables, Fruits, Spices, Plantation).
"""
from django.core.management.base import BaseCommand
from core.models import Crop

# Comprehensive Indian Agricultural Commodities Catalog (English: Hindi)
CROPS = {
    # Cereals and Millets (अनाज और मोटे अनाज)
    'Wheat': 'गेहूँ',
    'Paddy (Dhan)': 'धान',
    'Paddy': 'धान',
    'Rice': 'चावल',
    'Basmati Rice': 'बासमती चावल',
    'Maize': 'मक्का',
    'Bajra': 'बाजरा',
    'Bajra(Pearl Millet/Cumbu)': 'बाजरा',
    'Jowar (Sorghum)': 'ज्वार',
    'Jowar': 'ज्वार',
    'Barley': 'जौ',
    'Barley (Jau)': 'जौ',
    'Ragi (Finger Millet)': 'रागी (मडुआ)',
    'Ragi': 'रागी',
    'Foxtail Millet (Kangni)': 'कंगनी (काकुन)',
    'Kodo Millet': 'कोदो',
    'Little Millet (Kutki)': 'कुटकी',
    'Barnyard Millet (Sanwa)': 'सांवा',
    'Proso Millet (Cheena)': 'चीना',

    # Pulses (दालें एवं दलहन)
    'Chickpea': 'चना',
    'Bengal Gram (Gram)(Whole)': 'चना (काला चना)',
    'Bengal Gram (Dal)': 'चना दाल',
    'Kabuli Chana (Chickpeas-White)': 'काबुली चना',
    'Green Gram (Moong)(Whole)': 'मूंग (साबुत)',
    'Green Gram': 'मूंग',
    'Moong Dal': 'मूंग दाल',
    'Black Gram (Urd Beans)(Whole)': 'उड़द (साबुत)',
    'Black Gram': 'उड़द',
    'Urad Dal': 'उड़द दाल',
    'Pigeon Pea (Arhar/Tur)': 'अरहर (तुअर)',
    'Arhar Dal (Tur Dal)': 'अरहर दाल',
    'Lentil (Masur)(Whole)': 'मसूर (साबुत)',
    'Lentil (Masur)': 'मसूर',
    'Masoor Dal': 'मसूर दाल',
    'Field Pea (Dry Peas/Matar)': 'मटर (सूखी)',
    'Rajma (Kidney Beans)': 'राजमा',
    'Cowpea (Lobia/Chowli)': 'लोबिया',
    'Moth Dal (Matki)': 'मोठ दाल',
    'Horse Gram (Kulthi)': 'कुलथी',
    'Khesari (Lakh/Teora)': 'खेसारी',
    'Soyabean': 'सोयाबीन',
    'Soybean': 'सोयाबीन',

    # Oilseeds (तिलहन)
    'Mustard': 'सरसों',
    'Mustard Seed': 'सरसों के बीज',
    'Rapeseed & Mustard': 'तोरिया एवं सरसों',
    'Taramira': 'तारामीरा',
    'Groundnut': 'मूंगफली',
    'Groundnut (Peanut)': 'मूंगफली',
    'Groundnut Pods': 'मूंगफली फली',
    'Sunflower': 'सूरजमुखी',
    'Sesame (Gingelly/Til)': 'तिल',
    'Sesamum (Sesame/Til)': 'तिल',
    'Castor Seed': 'अरंडी',
    'Linseed (Alsi)': 'अलसी',
    'Safflower (Kardi)': 'कुसुम (करडी)',
    'Niger Seed (Ramtil)': 'रामतिल',
    'Cotton Seed': 'बिनौला',

    # Commercial & Fiber Crops (वाणिज्यिक एवं नकदी फसलें)
    'Cotton': 'कपास',
    'Raw Cotton (Kapas)': 'कपास (नरमा)',
    'Cotton (Lint)': 'रुई (लिंट)',
    'Sugarcane': 'गन्ना',
    'Jaggery (Gur)': 'गुड़',
    'Jute': 'जूट / पटसन',
    'Mesta': 'मेस्टा',
    'Tobacco': 'तंबाकू',
    'Guar Seed (Cluster Beans)': 'ग्वार बीज',
    'Guar': 'ग्वार',
    'Sunnhemp': 'सनई',

    # Vegetables (सब्जियां)
    'Potato': 'आलू',
    'Onion': 'प्याज',
    'Tomato': 'टमाटर',
    'Garlic': 'लहसुन',
    'Ginger (Green)': 'अदरक (हरी)',
    'Ginger (Dry)': 'सोंठ (सूखी अदरक)',
    'Green Chilli': 'हरी मिर्च',
    'Cabbage': 'पत्तागोभी',
    'Cauliflower': 'फूलगोभी',
    'Brinjal': 'बैंगन',
    'Brinjal (Eggplant)': 'बैंगन',
    'Bhindi (Ladies Finger)': 'भिंडी',
    'Okra': 'भिंडी',
    'Carrot': 'गाजर',
    'Radish': 'मूली',
    'Beetroot': 'चुकंदर',
    'Spinach': 'पालक',
    'Fenugreek Leaves (Methi)': 'मेथी पत्ता',
    'Bitter gourd': 'करेला',
    'Bottle gourd': 'लौकी',
    'Ridge gourd (Tori)': 'तोरई',
    'Sponge gourd': 'नेनुआ / घिया तोरी',
    'Snake gourd': 'चिचिंडा',
    'Pointed gourd (Parwal)': 'परवल',
    'Ivy gourd (Kundru)': 'कुंदरू',
    'Pumpkin': 'कद्दू',
    'Ash gourd (Petha)': 'पेठा',
    'Cucumber': 'खीरा',
    'Kakdi (Long Cucumber)': 'ककड़ी',
    'Capsicum': 'शिमला मिर्च',
    'French Beans (Frasbean)': 'फ्रांस बीन',
    'Cluster Beans (Guar Phali)': 'ग्वार फली',
    'Drumstick (Moringa)': 'सहजन',
    'Colocasia (Arbi)': 'अरबी',
    'Elephant Foot Yam (Jimikand)': 'जिमीकंद (सूरन)',
    'Sweet Potato': 'शकरकंद',
    'Turnip (Shalgam)': 'शलजम',
    'Peas (Green/Matar)': 'हरी मटर',
    'Green Peas': 'हरी मटर',

    # Fruits (फल)
    'Mango': 'आम',
    'Banana': 'केला',
    'Apple': 'सेब',
    'Orange': 'संतरा',
    'Mandarins (Kinnow)': 'किन्नू',
    'Sweet Lime (Mosambi)': 'मौसमी',
    'Guava': 'अमरूद',
    'Papaya': 'पपीता',
    'Pomegranate': 'अनार',
    'Grapes': 'अंगूर',
    'Watermelon': 'तरबूज',
    'Muskmelon': 'खरबूजा',
    'Pineapple': 'अनानास',
    'Lemon (Lime)': 'नींबू',
    'Litchi': 'लीची',
    'Custard Apple (Sitaphal)': 'सीताफल / शरीफा',
    'Sapota (Chiku)': 'चीकू',
    'Fig (Anjeer)': 'अंजीर',
    'Jackfruit': 'कटहल',
    'Ber (Indian Jujube)': 'बेर',
    'Strawberry': 'स्ट्रॉबेरी',
    'Amla (Indian Gooseberry)': 'आंवला',
    'Pear (Nashpati)': 'नाशपाती',
    'Peach (Aadu)': 'आड़ू',
    'Plum (Alubukhara)': 'आलूबुखारा',
    'Apricot (Khubani)': 'खुबानी',
    'Coconut': 'नारियल',
    'Tender Coconut': 'कच्चा नारियल (डाभ)',
    'Dry Coconut (Copra)': 'सूखा नारियल (गोला)',

    # Spices & Condiments (मसाले)
    'Turmeric': 'हल्दी',
    'Turmeric (Raw)': 'कच्ची हल्दी',
    'Red Chilli': 'लाल मिर्च',
    'Dry Chillies': 'सूखी लाल मिर्च',
    'Coriander (Dhaniya)': 'धनिया',
    'Coriander Seed': 'धनिया बीज',
    'Cumin (Jeera)': 'जीरा',
    'Fennel (Saunf)': 'सौंफ',
    'Fenugreek (Methi)': 'मेथी दाना',
    'Cardamom (Small/Chhoti Elaichi)': 'छोटी इलायची',
    'Cardamom (Large/Badi Elaichi)': 'बड़ी इलायची',
    'Black Pepper': 'काली मिर्च',
    'Cloves (Laung)': 'लौंग',
    'Cinnamon (Dalchini)': 'दालचीनी',
    'Nutmeg (Jaiphal)': 'जायफल',
    'Mace (Javitri)': 'जावित्री',
    'Ajwain (Carom Seeds)': 'अजवाइन',
    'Aniseed': 'अनीस (सौंफ जैसी)',
    'Tamarind': 'इमली',
    'Asafoetida (Hing)': 'हींग',
    'Curry Leaves': 'कढ़ी पत्ता',
    'Bay Leaf (Tejpatta)': 'तेजपत्ता',
    'Celery Seeds (Ajmud)': 'अजमुद',
    'Dill Seed (Suwa)': 'सोया बीज',

    # Plantation, Beverage & Nut Crops (बागवानी, पेय एवं मेवे)
    'Tea': 'चाय',
    'Coffee': 'कॉफ़ी',
    'Rubber': 'रबड़',
    'Arecanut (Betelnut/Supari)': 'सुपारी',
    'Cashewnuts': 'काजू',
    'Cashewnut Raw': 'कच्चा काजू',
    'Cocoa': 'कोको',
    'Betel Leaves (Paan)': 'पान पत्ता',
    'Walnut': 'अखरोट',
    'Almond': 'बादाम',

    # Flowers & Medicinal/Aromatic (फूल एवं औषधीय फसलें)
    'Marigold': 'गेंदा',
    'Rose': 'गुलाब',
    'Jasmine': 'चमेली',
    'Tuberose (Rajnigandha)': 'रजनीगंधा',
    'Gladiolus': 'ग्लैडियोलस',
    'Ashwagandha': 'अश्वगंधा',
    'Isabgol (Psyllium Husk)': 'इसबगोल',
    'Safed Musli': 'सफेद मूसली',
    'Lemongrass': 'लेमनग्रास',
    'Mentha (Mint)': 'मेंथा / पुदीना',
    'Chia Seeds': 'चिया बीज',
}


class Command(BaseCommand):
    help = 'Create comprehensive all-India crop catalogue entries.'

    def handle(self, *args, **options):
        existing = set(Crop.objects.values_list('name', flat=True))
        to_create = [
            Crop(name=name, hindi_name=hindi)
            for name, hindi in CROPS.items()
            if name not in existing
        ]
        if to_create:
            Crop.objects.bulk_create(to_create, ignore_conflicts=True)

        total = Crop.objects.count()
        self.stdout.write(self.style.SUCCESS(
            f'Crop catalogue synchronized: added {len(to_create)} new crops. Total crops in system: {total}'
        ))

