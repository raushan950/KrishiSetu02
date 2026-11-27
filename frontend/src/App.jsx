import React,{useEffect,useState}from'react';
import{Link,NavLink,Routes,Route,useNavigate,useSearchParams,useLocation}from'react-router-dom';
import{Sprout,Menu,MapPin,Search,TrendingUp,Calculator,Store,Truck,User,ShieldCheck,ArrowRight,LogOut,Bell,Landmark,Leaf,CheckCircle2,AlertCircle,AlertTriangle,Info,Sparkles,RefreshCw,Scale,Package,ClipboardList}from'lucide-react';
import{LineChart,Line,XAxis,YAxis,CartesianGrid,Tooltip,ResponsiveContainer}from'recharts';
import{api,entries,getSession,setSession,dropSession,errorMessage}from'./api.js';
import{getTranslation}from'./i18n.js';
import{supabaseAuth,isSupabaseConfigured}from'./supabaseClient.js';
import{GoogleAuth,PriceAlerts,ForecastView,OrdersWorkflow,FarmManager,OffersWorkflow,AccountSecurity,ShipmentTimeline}from'./Workspace.jsx';
import{TradeCasework,MyListings,AdminReview}from'./TradeResolution.jsx';
import{IntelligenceTools}from'./IntelligenceTools.jsx';
import{SearchableSelect}from'./SearchableSelect.jsx';
import{AccountDashboard}from'./AccountDashboard.jsx';
import{AuthPage}from'./AuthPage.jsx';
import{FindBestMarket}from'./FindBestMarket.jsx';
import{DemoWalkthroughModal}from'./DemoWalkthroughModal.jsx';
import{FarmerWorkspace}from'./FarmerWorkspace.jsx';
import{BuyerWorkspace}from'./BuyerWorkspace.jsx';
import{TransporterWorkspace}from'./TransporterWorkspace.jsx';

const currency=(v)=>v==null?'—':new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(Number(v));
const T = (lang) => getTranslation(lang);
function useRequest(url,params){const[data,setData]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState('');useEffect(()=>{let active=true;setLoading(true);setError('');api.get(url,{params}).then(r=>{if(active)setData(r.data)}).catch(e=>{if(active)setError(errorMessage(e))}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[url,JSON.stringify(params||{})]);return{data,loading,error,refresh:()=>api.get(url,{params}).then(r=>setData(r.data))}}
function Notice({children,type='info'}){
  const iconMap = {
    error: <AlertCircle size={18} style={{color: '#dc2626', flexShrink: 0}}/>,
    warning: <AlertTriangle size={18} style={{color: '#d97706', flexShrink: 0}}/>,
    success: <CheckCircle2 size={18} style={{color: '#16a34a', flexShrink: 0}}/>,
    info: <Info size={18} style={{color: '#2563eb', flexShrink: 0}}/>
  };
  return <div role={type==='error'?'alert':'status'} className={`notice ${type}`}>{iconMap[type]||iconMap.info}<span>{children}</span></div>;
}
function Panel({title,children,aside}){return <section className="panel"><div className="panel-head"><h2>{title}</h2>{aside}</div>{children}</section>}
function Empty({message='No records yet.'}){return <div className="empty"><Sprout size={32}/><p>{message}</p></div>}
function FormField({label,children}){return <label className="field"><span>{label}</span>{children}</label>}
function Page({title,desc,children}){return <main className="container page"><header className="page-head"><p className="eyebrow">KRISHISETU / कृषिसेतु</p><h1>{title}</h1>{desc&&<p>{desc}</p>}</header>{children}</main>}

const WORKFLOW_STEPS = [
  {
    step: 1,
    title: 'Farmer Registration',
    hindi: 'किसान एवं फसल',
    icon: Leaf,
    tag: '1. Production',
    desc: 'Farmer records farm profile, harvested crop variety, and verified acreage directly at the farmgate without middlemen.',
    action: { label: 'Explore Farmgate Tools', link: '/listings' }
  },
  {
    step: 2,
    title: 'Mandi Price Intelligence',
    hindi: 'मंडी भाव सूचना',
    icon: Landmark,
    tag: '2. Intelligence',
    desc: 'Live and historical modal price benchmarks from official APMC mandis guide farmers on prevailing market rates.',
    action: { label: 'Explore Mandi Prices', link: '/prices' }
  },
  {
    step: 3,
    title: 'Net Return Decision',
    hindi: 'शुद्ध लाभ निर्णय',
    icon: Calculator,
    tag: '3. Decision',
    desc: 'Accurate deduction of transport freight, loading, cess, and transit moisture loss determines the highest true profit destination.',
    action: { label: 'Open Net Calculator', link: '/calculator' }
  },
  {
    step: 4,
    title: 'Marketplace Listing',
    hindi: 'सीधा मंडी बाजार',
    icon: Store,
    tag: '4. Direct Listing',
    desc: 'Farmer publishes produce with variety, grade, photos, available quintals, and asking price directly to commercial buyers.',
    action: { label: 'Browse Marketplace', link: '/listings' }
  },
  {
    step: 5,
    title: 'Buyer Offer & Negotiation',
    hindi: 'सौदा एवं मोलभाव',
    icon: TrendingUp,
    tag: '5. Negotiation',
    desc: 'Commercial buyers review farmgate listings and submit purchase offers; farmers can accept, decline, or counteroffer in real time.',
    action: { label: 'View Marketplace Offers', link: '/listings' }
  },
  {
    step: 6,
    title: 'Confirmed Order & Inventory Lock',
    hindi: 'पुष्ट आदेश एवं लॉक',
    icon: ShieldCheck,
    tag: '6. Atomic Order',
    desc: 'Accepting an offer creates a confirmed order and atomically locks reserved inventory to prevent double-selling.',
    action: { label: 'Manage Orders', link: '/account' }
  },
  {
    step: 7,
    title: 'Transporter Freight Quotation',
    hindi: 'परिवहन दर प्रस्ताव',
    icon: Truck,
    tag: '7. Freight Bidding',
    desc: 'Confirmed orders generate freight requests; verified fleet operators bid competitive distance-based rates for farmgate pickup.',
    action: { label: 'Logistics Workspace', link: '/transport' }
  },
  {
    step: 8,
    title: 'Milestone Tracking & Delivery',
    hindi: 'ट्रैकिंग एवं सुपुर्दगी',
    icon: MapPin,
    tag: '8. In-Transit Delivery',
    desc: 'Carriers record timestamped transit milestones (Dispatched, In-Transit, Delivered) followed by buyer physical inspection and digital acceptance.',
    action: { label: 'Track Shipments', link: '/transport' }
  },
  {
    step: 9,
    title: 'Settlement Records & Reconciliation',
    hindi: 'भुगतान रिकॉर्ड',
    icon: CheckCircle2,
    tag: '9. Settlement Records',
    desc: 'Both parties confirm physical delivery acceptance and reconcile payment transactions with timestamped audit records.',
    action: { label: 'View Settlement Records', link: '/account' }
  }
];

function getLocalizedWorkflowSteps(lang) {
  if (lang === 'hi') {
    return [
      {
        step: 1,
        title: 'किसान एवं खेत प्रोफ़ाइल',
        hindi: 'किसान एवं फसल',
        icon: Leaf,
        tag: '1. उत्पादन',
        desc: 'किसान अपनी जमीन, फसल की किस्म और प्रमाणित रकबा बिना किसी बिचौलिये के सीधे खेत पर दर्ज करते हैं।',
        action: { label: 'खेत उपकरण देखें', link: '/listings' }
      },
      {
        step: 2,
        title: 'मंडी भाव सूचना',
        hindi: 'मंडी भाव सूचना',
        icon: Landmark,
        tag: '2. आसूचना',
        desc: '107 आधिकारिक एपीएमसी मंडियों से लाइव और ऐतिहासिक मॉडल भाव किसानों को बाज़ार दरों की सटीक जानकारी देते हैं।',
        action: { label: 'मंडी भाव देखें', link: '/prices' }
      },
      {
        step: 3,
        title: 'शुद्ध लाभ निर्णय',
        hindi: 'शुद्ध लाभ निर्णय',
        icon: Calculator,
        tag: '3. निर्णय',
        desc: 'भाड़ा, लोडिंग, मंडी टैक्स और रास्ते में फसल सूखने का नुकसान घटाकर सर्वोत्तम मुनाफा देने वाली मंडी चुनें।',
        action: { label: 'कैलकुलेटर खोलें', link: '/calculator' }
      },
      {
        step: 4,
        title: 'सीधी फसल सूची',
        hindi: 'सीधा मंडी बाजार',
        icon: Store,
        tag: '4. बाज़ार सूची',
        desc: 'किसान फसल की किस्म, ग्रेड, तस्वीर, उपलब्ध मात्रा और मांग भाव सीधे थोक खरीदारों के समक्ष प्रकाशित करते हैं।',
        action: { label: 'बाज़ार में फसलें देखें', link: '/listings' }
      },
      {
        step: 5,
        title: 'खरीद प्रस्ताव एवं मोलभाव',
        hindi: 'सौदा एवं मोलभाव',
        icon: TrendingUp,
        tag: '5. मोलभाव',
        desc: 'थोक खरीदार खेत की सूची देखकर खरीद प्रस्ताव भेजते हैं; किसान रीयल-टाइम में स्वीकार, अस्वीकार या जवाबी प्रस्ताव दे सकते हैं।',
        action: { label: 'खरीद प्रस्ताव देखें', link: '/listings' }
      },
      {
        step: 6,
        title: 'पुष्ट आदेश एवं स्टॉक लॉक',
        hindi: 'पुष्ट आदेश एवं लॉक',
        icon: ShieldCheck,
        tag: '6. सुरक्षित आदेश',
        desc: 'प्रस्ताव स्वीकार होते ही पुष्ट आदेश बनता है और डाटाबेस में स्टॉक लॉक हो जाता है ताकि दोबारा बिक्री न हो।',
        action: { label: 'आदेश प्रबंधित करें', link: '/account' }
      },
      {
        step: 7,
        title: 'ट्रांसपोर्टर भाड़ा बोली',
        hindi: 'परिवहन दर प्रस्ताव',
        icon: Truck,
        tag: '7. भाड़ा बोली',
        desc: 'पुष्ट आदेश के लिए प्रमाणित ट्रांसपोर्टर खेत से मंडी तक दूरी अनुसार प्रतिस्पर्धी भाड़ा दरें प्रस्तुत करते हैं।',
        action: { label: 'लॉजिस्टिक्स कार्यक्षेत्र', link: '/transport' }
      },
      {
        step: 8,
        title: 'माइलस्टोन ट्रैकिंग एवं डिलीवरी',
        hindi: 'ट्रैकिंग एवं सुपुर्दगी',
        icon: MapPin,
        tag: '8. सुपुर्दगी',
        desc: 'वाहन चालक लदाई, रास्ते और डिलीवरी का समयबद्ध प्रमाण दर्ज करते हैं; खरीदार भौतिक निरीक्षण कर स्वीकृति देता है।',
        action: { label: 'खेप ट्रैक करें', link: '/transport' }
      },
      {
        step: 9,
        title: 'भुगतान रिकॉर्ड एवं निपटान',
        hindi: 'भुगतान रिकॉर्ड',
        icon: CheckCircle2,
        tag: '9. निपटान',
        desc: 'दोनों पक्ष माल प्राप्ति की पुष्टि करते हैं और डिजिटल ऑडिट रिकॉर्ड के साथ भुगतान का समाधान पूरा होता है।',
        action: { label: 'निपटान रिकॉर्ड देखें', link: '/account' }
      }
    ];
  }
  if (lang === 'pa') {
    return [
      {
        step: 1,
        title: 'ਕਿਸਾਨ ਅਤੇ ਫ਼ਸਲ ਪ੍ਰੋਫਾਈਲ',
        hindi: 'ਕਿਸਾਨ ਤੇ ਫ਼ਸਲ',
        icon: Leaf,
        tag: '1. ਉਤਪਾਦਨ',
        desc: 'ਕਿਸਾਨ ਆਪਣੀ ਜ਼ਮੀਨ, ਫ਼ਸਲ ਦੀ ਕਿਸਮ ਅਤੇ ਰਕਬਾ ਬਿਨਾਂ ਕਿਸੇ ਵਿਚੋਲੇ ਦੇ ਸਿੱਧੇ ਖੇਤ ਪੱਧਰ ਤੇ ਦਰਜ ਕਰਦੇ ਹਨ।',
        action: { label: 'ਖੇਤ ਟੂਲ ਵੇਖੋ', link: '/listings' }
      },
      {
        step: 2,
        title: 'ਮੰਡੀ ਭਾਅ ਸੂਚਨਾ',
        hindi: 'ਮੰਡੀ ਭਾਅ ਸੂਚਨਾ',
        icon: Landmark,
        tag: '2. ਮੰਡੀ ਸੂਚਨਾ',
        desc: '107 ਸਰਕਾਰੀ ਏਪੀਐਮਸੀ ਮੰਡੀਆਂ ਤੋਂ ਲਾਈਵ ਅਤੇ ਇਤਿਹਾਸਕ ਮਾਡਲ ਭਾਅ ਕਿਸਾਨਾਂ ਨੂੰ ਸਹੀ ਮੰਡੀ ਰੇਟਾਂ ਦੀ ਅਗਵਾਈ ਕਰਦੇ ਹਨ।',
        action: { label: 'ਮੰਡੀ ਭਾਅ ਵੇਖੋ', link: '/prices' }
      },
      {
        step: 3,
        title: 'ਸ਼ੁੱਧ ਮੁਨਾਫ਼ਾ ਫ਼ੈਸਲਾ',
        hindi: 'ਸ਼ੁੱਧ ਮੁਨਾਫ਼ਾ',
        icon: Calculator,
        tag: '3. ਫ਼ੈਸਲਾ',
        desc: 'ਭਾੜਾ, ਲਦਾਈ, ਮੰਡੀ ਫੀਸ ਅਤੇ ਫਸਲੀ ਨੁਕਸਾਨ ਘਟਾ ਕੇ ਸਭ ਤੋਂ ਵੱਧ ਕਮਾਈ ਦੇਣ ਵਾਲੀ ਮੰਡੀ ਦੀ ਚੋਣ ਕਰੋ।',
        action: { label: 'ਕੈਲਕੁਲੇਟਰ ਖੋਲ੍ਹੋ', link: '/calculator' }
      },
      {
        step: 4,
        title: 'ਸਿੱਧੀ ਫ਼ਸਲ ਸੂਚੀ',
        hindi: 'ਸਿੱਧਾ ਬਾਜ਼ਾਰ',
        icon: Store,
        tag: '4. ਬਾਜ਼ਾਰ ਸੂਚੀ',
        desc: 'ਕਿਸਾਨ ਫ਼ਸਲ ਦੀ ਕਿਸਮ, ਗ੍ਰੇਡ, ਫੋਟੋ, ਉਪਲਬਧ ਮਾਤਰਾ ਅਤੇ ਮੰਗਿਆ ਭਾਅ ਸਿੱਧੇ ਵਪਾਰੀਆਂ ਸਾਹਮਣੇ ਦਰਜ ਕਰਦੇ ਹਨ।',
        action: { label: 'ਬਾਜ਼ਾਰ ਵਿੱਚ ਫ਼ਸਲਾਂ ਵੇਖੋ', link: '/listings' }
      },
      {
        step: 5,
        title: 'ਖਰੀਦ ਪ੍ਰਸਤਾਵ ਤੇ ਗੱਲਬਾਤ',
        hindi: 'ਸੌਦਾ ਤੇ ਗੱਲਬਾਤ',
        icon: TrendingUp,
        tag: '5. ਸੌਦੇਬਾਜ਼ੀ',
        desc: 'ਵਪਾਰੀ ਖੇਤ ਦੀ ਸੂਚੀ ਵੇਖ ਕੇ ਖਰੀਦ ਪ੍ਰਸਤਾਵ ਭੇਜਦੇ ਹਨ; ਕਿਸਾਨ ਤੁਰੰਤ ਮਨਜ਼ੂਰ, ਰੱਦ ਜਾਂ ਜਵਾਬੀ ਬੋਲੀ ਦੇ ਸਕਦੇ ਹਨ।',
        action: { label: 'ਖਰੀਦ ਪ੍ਰਸਤਾਵ ਵੇਖੋ', link: '/listings' }
      },
      {
        step: 6,
        title: 'ਪੱਕਾ ਆਰਡਰ ਅਤੇ ਸਟਾਕ ਲਾਕ',
        hindi: 'ਪੱਕਾ ਆਰਡਰ',
        icon: ShieldCheck,
        tag: '6. ਸੁਰੱਖਿਅਤ ਆਰਡਰ',
        desc: 'ਸੌਦਾ ਤੈਅ ਹੁੰਦਿਆਂ ਹੀ ਪੱਕਾ ਆਰਡਰ ਬਣਦਾ ਹੈ ਅਤੇ ਡਾਟਾਬੇਸ ਵਿੱਚ ਸਟਾਕ ਲਾਕ ਹੋ ਜਾਂਦਾ ਹੈ ਤਾਂ ਜੋ ਦੋਹਰੀ ਵਿਕਰੀ ਨਾ ਹੋਵੇ।',
        action: { label: 'ਆਰਡਰ ਪ੍ਰਬੰਧਨ', link: '/account' }
      },
      {
        step: 7,
        title: 'ਟਰਾਂਸਪੋਰਟਰ ਭਾੜਾ ਬੋਲੀ',
        hindi: 'ਭਾੜਾ ਬੋਲੀ',
        icon: Truck,
        tag: '7. ਭਾੜਾ ਬੋਲੀ',
        desc: 'ਪੱਕੇ ਆਰਡਰ ਲਈ ਪ੍ਰਮਾਣਿਤ ਟਰਾਂਸਪੋਰਟਰ ਖੇਤ ਤੋਂ ਮੰਡੀ ਤੱਕ ਦੂਰੀ ਮੁਤਾਬਕ ਵਾਜਬ ਭਾੜਾ ਦਰਾਂ ਪੇਸ਼ ਕਰਦੇ ਹਨ।',
        action: { label: 'ਟਰਾਂਸਪੋਰਟ ਵਰਕਸਪੇਸ', link: '/transport' }
      },
      {
        step: 8,
        title: 'ਮਾਈਲਸਟੋਨ ਟਰੈਕਿੰਗ ਤੇ ਡਿਲੀਵਰੀ',
        hindi: 'ਸਪੁਰਦਗੀ',
        icon: MapPin,
        tag: '8. ਸਪੁਰਦਗੀ',
        desc: 'ਡਰਾਈਵਰ ਲਦਾਈ, ਰਸਤੇ ਅਤੇ ਡਿਲੀਵਰੀ ਦਾ ਸਮਾਂਬੱਧ ਸਬੂਤ ਦਰਜ ਕਰਦੇ ਹਨ; ਖਰੀਦਦਾਰ ਮਾਲ ਦੀ ਜਾਂਚ ਕਰਕੇ ਪ੍ਰਵਾਨਗੀ ਦਿੰਦਾ ਹੈ।',
        action: { label: 'ਮਾਲ ਟਰੈਕ ਕਰੋ', link: '/transport' }
      },
      {
        step: 9,
        title: 'ਭੁਗਤਾਨ ਰਿਕਾਰਡ ਤੇ ਨਿਪਟਾਰਾ',
        hindi: 'ਨਿਪਟਾਰਾ',
        icon: CheckCircle2,
        tag: '9. ਨਿਪਟਾਰਾ',
        desc: 'ਦੋਵੇਂ ਧਿਰਾਂ ਮਾਲ ਪ੍ਰਾਪਤੀ ਦੀ ਪੁਸ਼ਟੀ ਕਰਦੀਆਂ ਹਨ ਅਤੇ ਡਿਜੀਟਲ ਆਡਿਟ ਰਿਕਾਰਡ ਨਾਲ ਹਿਸਾਬ-ਕਿਤਾਬ ਪੂਰਾ ਹੁੰਦਾ ਹੈ।',
        action: { label: 'ਨਿਪਟਾਰਾ ਰਿਕਾਰਡ ਵੇਖੋ', link: '/account' }
      }
    ];
  }
  return WORKFLOW_STEPS;
}

function RoleHomeCenter({ session, t, lang, prices }) {
  const user = session.user;
  const role = user.role;
  const name = user.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user.email;

  const roleMeta = {
    FARMER: {
      eyebrow: lang === 'hi' ? 'किसान कमांड सेंटर' : lang === 'pa' ? 'ਕਿਸਾਨ ਕਮਾਂਡ ਸੈਂਟਰ' : 'FARMER COMMAND CENTER',
      title: lang === 'hi' ? `नमस्ते ${name}, अपनी फसल व मुनाफा प्रबंधित करें` : lang === 'pa' ? `ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ ${name}, ਆਪਣੀ ਫ਼ਸਲ ਅਤੇ ਮੁਨਾਫ਼ਾ ਪ੍ਰਬੰਧਿਤ ਕਰੋ` : `Welcome back, ${name} — Harvest & Market Command Center`,
      subtitle: lang === 'hi' ? 'अपनी उपज के लिए सर्वोत्तम मंडी खोजें, फसल सूची प्रकाशित करें और सीधे खरीद प्रस्ताव देखें।' : lang === 'pa' ? 'ਆਪਣੀ ਫ਼ਸਲ ਲਈ ਸਭ ਤੋਂ ਵਧੀਆ ਮੰਡੀ ਲੱਭੋ, ਫ਼ਸਲ ਦਰਜ ਕਰੋ ਅਤੇ ਖਰੀਦਦਾਰਾਂ ਦੇ ਪ੍ਰਸਤਾਵ ਵੇਖੋ।' : 'Compare APMC mandi returns net of freight, publish verified produce lots, and manage incoming buyer offers.',
      primaryCta: { label: lang === 'hi' ? 'किसान कार्यक्षेत्र खोलें' : lang === 'pa' ? 'ਕਿਸਾਨ ਵਰਕਸਪੇਸ ਖੋਲ੍ਹੋ' : 'Open Farmer Hub', to: '/farmer', icon: Sprout },
      cards: [
        { title: 'Find My Best Market', desc: 'Rank nearby mandis and direct bids by true net cash in pocket after freight & cess.', to: '/compare', icon: Scale },
        { title: 'My Farms & Crop Inventory', desc: 'Publish harvest listings, track reserved quintals, and update asking prices.', to: '/farmer?tab=listings', icon: Store },
        { title: 'Incoming Buyer Offers', desc: 'Accept, counteroffer, or decline commercial bids directly without middleman cuts.', to: '/farmer?tab=offers', icon: TrendingUp },
      ]
    },
    BUYER: {
      eyebrow: lang === 'hi' ? 'वाणिज्यिक खरीदार केंद्र' : lang === 'pa' ? 'ਵਪਾਰਕ ਖਰੀਦਦਾਰ ਕੇਂਦਰ' : 'COMMERCIAL BUYER PROCUREMENT CENTER',
      title: lang === 'hi' ? `स्वागत है ${name} — प्रत्यक्ष फसल क्रय पोर्टल` : lang === 'pa' ? `ਜੀ ਆਇਆਂ ਨੂੰ ${name} — ਸਿੱਧੀ ਫ਼ਸਲ ਖਰੀਦ ਪੋਰਟਲ` : `Welcome back, ${name} — Direct Procurement Center`,
      subtitle: lang === 'hi' ? 'सत्यापित किसानों से सीधे फसल खरीदें, मोलभाव करें और डिलीवरी ट्रैक करें।' : lang === 'pa' ? 'ਪ੍ਰਮਾਣਿਤ ਕਿਸਾਨਾਂ ਤੋਂ ਸਿੱਧੀ ਫ਼ਸਲ ਖਰੀਦੋ, ਸੌਦੇਬਾਜ਼ੀ ਕਰੋ ਅਤੇ ਡਿਲੀਵਰੀ ਟਰੈਕ ਕਰੋ।' : 'Browse verified farmgate harvest lots, negotiate direct purchase offers, and inspect carrier delivery milestones.',
      primaryCta: { label: lang === 'hi' ? 'खरीदार कार्यक्षेत्र खोलें' : lang === 'pa' ? 'ਖਰੀਦਦਾਰ ਵਰਕਸਪੇਸ ਖੋਲ੍ਹੋ' : 'Open Buyer Hub', to: '/buyer', icon: Store },
      cards: [
        { title: 'Browse Crop Marketplace', desc: 'Filter live harvest listings by crop, grade, state, and asking rate to place offers.', to: '/listings', icon: Search },
        { title: 'My Offers & Negotiations', desc: 'Track submitted purchase bids and respond to farmer counteroffers in real time.', to: '/buyer?tab=offers', icon: TrendingUp },
        { title: 'Mandi Rate Benchmarks', desc: 'Verify official Agmarknet daily arrivals before locking bilateral contract rates.', to: '/prices', icon: Landmark },
      ]
    },
    TRANSPORTER: {
      eyebrow: lang === 'hi' ? 'ट्रांसपोर्टर लॉजिस्टिक्स हब' : lang === 'pa' ? 'ਟਰਾਂਸਪੋਰਟਰ ਲੌਜਿਸਟਿਕਸ ਹੱਬ' : 'TRANSPORTER FLEET & FREIGHT HUB',
      title: lang === 'hi' ? `स्वागत है ${name} — माल ढुलाई संचालन` : lang === 'pa' ? `ਜੀ ਆਇਆਂ ਨੂੰ ${name} — ਢੋਆ-ਢੁਆਈ ਸੰਚਾਲਨ` : `Welcome back, ${name} — Fleet & Freight Operations`,
      subtitle: lang === 'hi' ? 'उपलब्ध कृषि भाड़ा अनुरोध देखें, प्रतिस्पर्धी बोली लगाएँ और डिलीवरी साक्ष्य अपलोड करें।' : lang === 'pa' ? 'ਖੇਤੀ ਭਾੜਾ ਲੋਡ ਵੇਖੋ, ਬੋਲੀ ਲਗਾਓ ਅਤੇ ਡਿਲੀਵਰੀ ਸਬੂਤ ਅਪਲੋਡ ਕਰੋ।' : 'Discover open farmgate freight loads matched to your fleet capacity, submit quotes, and record shipment milestones.',
      primaryCta: { label: lang === 'hi' ? 'लॉजिस्टिक्स हब खोलें' : lang === 'pa' ? 'ਲੌਜਿਸਟਿਕਸ ਹੱਬ ਖੋਲ੍ਹੋ' : 'Open Logistics Hub', to: '/transport', icon: Truck },
      cards: [
        { title: 'Available Freight Board', desc: 'Inspect confirmed farmer-buyer orders needing farmgate pickup and submit freight quotes.', to: '/transport?tab=freight-board', icon: Package },
        { title: 'My Fleet & Verification', desc: 'Register trucks, tractors, or pickups and track administrator verification approval.', to: '/transport?tab=vehicles', icon: ShieldCheck },
        { title: 'Assigned Shipments', desc: 'Record pickup, in-transit, and delivery evidence timestamps on active hauls.', to: '/transport?tab=shipments', icon: MapPin },
      ]
    },
    ADMIN: {
      eyebrow: 'ADMINISTRATOR GOVERNANCE CONSOLE',
      title: `Platform Governance — ${name}`,
      subtitle: 'Audit KYC document verification, fleet approvals, trade disputes, refunds, and Agmarknet ingestion runs.',
      primaryCta: { label: 'Open Review Queue', to: '/admin', icon: ShieldCheck },
      cards: [
        { title: 'KYC & Vehicle Approvals', desc: 'Review pending farmer, buyer, and carrier identity and vehicle documents.', to: '/admin', icon: ShieldCheck },
        { title: 'Disputes & Gateway Refunds', desc: 'Adjudicate frozen order disputes and authorize payment provider refunds.', to: '/admin', icon: ClipboardList },
        { title: 'Institutional Analytics', desc: 'Inspect aggregate regional pricing trends and run privacy-safe CSV exports.', to: '/institution', icon: Landmark },
      ]
    },
    INSTITUTION: {
      eyebrow: 'INSTITUTIONAL POLICY & ANALYTICS',
      title: `Market Intelligence Workspace — ${name}`,
      subtitle: 'Monitor privacy-protected aggregate commodity trends across verified APMC mandis.',
      primaryCta: { label: 'Open Institutional Analytics', to: '/institution', icon: Landmark },
      cards: [
        { title: 'Regional Price Aggregates', desc: 'Explore suppressed, disclosure-safe state and crop price averages.', to: '/institution', icon: Landmark },
        { title: 'Live Mandi Directory', desc: 'Inspect recorded daily Agmarknet benchmarks across 107 mandis.', to: '/prices', icon: TrendingUp },
        { title: 'Account Security', desc: 'Manage profile credentials and single sign-on links.', to: '/account', icon: User },
      ]
    }
  };

  const cfg = roleMeta[role] || roleMeta.FARMER;
  const PrimaryIcon = cfg.primaryCta.icon;

  return (
    <>
      <section className="role-command-hero">
        <div className="container">
          <div className="role-command-box">
            <div>
              <span className="role-command-pill">
                <PrimaryIcon size={13} /> {cfg.eyebrow}
              </span>
              <h1>{cfg.title}</h1>
              <p>{cfg.subtitle}</p>
              <div className="role-command-actions">
                <Link to={cfg.primaryCta.to} className="button primary">
                  <PrimaryIcon size={18} /> {cfg.primaryCta.label} <ArrowRight size={17} />
                </Link>
                {!user.account_verified && (
                  <Link to="/account?tab=verification" className="button subtle">
                    <AlertTriangle size={16} style={{ color: '#d97706' }} /> Complete Account Verification →
                  </Link>
                )}
              </div>
            </div>
            <div className="role-status-summary">
              <div className="role-status-row">
                <span>Role</span>
                <b>{role}</b>
              </div>
              <div className="role-status-row">
                <span>Account Trading Status</span>
                <span className={`status-pill ${user.account_verified ? 'verified' : 'unverified'}`}>
                  {user.account_verified ? 'Verified ✓' : 'Verification Needed'}
                </span>
              </div>
              <div className="role-status-row">
                <span>Identity / KYC</span>
                <span className={`status-pill ${user.identity_verified ? 'verified' : 'pending'}`}>
                  {user.identity_verified ? 'KYC Approved ✓' : 'Pending / Unsubmitted'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="container feature-grid" style={{ marginTop: '28px' }}>
        {cfg.cards.map((c) => {
          const Icon = c.icon;
          return (
            <Link key={c.title} to={c.to} className="feature">
              <div className="feature-icon-box"><Icon size={22} /></div>
              <h3>{c.title}</h3>
              <p>{c.desc}</p>
            </Link>
          );
        })}
      </div>

      {role !== 'TRANSPORTER' && (
        <div className="container mandi-verified-section">
          <div className="section-head-bar">
            <div>
              <p className="eyebrow">{t.mandiPreviewEyebrow || 'VERIFIED MANDI BENCHMARKS'}</p>
              <h2>{t.mandiPreviewTitle || 'Latest Recorded APMC Arrivals'}</h2>
            </div>
            <div className="section-head-actions">
              <Link to="/prices" className="button subtle small">{t.viewAllMandisBtn || 'View All Mandis'} <ArrowRight size={15} /></Link>
            </div>
          </div>
          {prices.length > 0 && (
            <div className="mandi-verified-grid">
              {prices.slice(0, 4).map(x => (
                <div key={x.id} className="mandi-verified-card">
                  <div className="mandi-card-top">
                    <span className="crop-pill"><Sprout size={15}/> {x.crop?.name || 'Crop'}</span>
                    <span className="source-tag">{x.source || 'Agmarknet'}</span>
                  </div>
                  <div className="mandi-card-price">
                    <span className="price-val">{currency(x.modal_price)}</span>
                    <span className="price-unit">/ quintal</span>
                  </div>
                  <div className="mandi-card-meta">
                    <div><b>Mandi:</b> {x.market?.name}, {x.market?.district}</div>
                    <div><b>Recorded:</b> {x.observed_on}</div>
                  </div>
                  <Link
                    to={role === 'BUYER' ? `/listings?crop=${x.crop?.id || ''}` : `/compare?crop=${x.crop?.id || ''}`}
                    className="mandi-card-action"
                  >
                    {role === 'BUYER' ? 'Source Crop in Marketplace →' : (t.btnCalcNet || 'Compare Net Return →')}
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

function Home({t, session, lang}){
  const{data}=useRequest('prices/',{page_size:4});
  const prices=entries({data});
  const [activeStep, setActiveStep] = useState(0);

  if (session?.user) {
    return <RoleHomeCenter session={session} t={t} lang={lang} prices={prices} />;
  }

  const workflowSteps = getLocalizedWorkflowSteps(lang);
  const cur = workflowSteps[activeStep] || workflowSteps[0];
  const StepIcon = cur.icon;

  return <>
    {/* Section 1: Cinematic 3D Agricultural Video Hero Section */}
    <section className="hero">
      <video
        className="hero-background"
        autoPlay
        muted
        loop
        playsInline
        poster="/assets/farm-poster.webp"
        aria-hidden="true"
      >
        <source src="/assets/farm-wind.webm" type="video/webm" />
        <source src="/assets/farm-wind.mp4" type="video/mp4" />
      </video>
      <div className="hero-overlay" />

      <div className="container hero-inner">
        <div className="hero-text-content">
          <p className="hero-label"><Leaf size={15}/> {t.heroTag || 'TRANSPARENT AGRICULTURAL MARKETS'}</p>
          <h1>{t.sell}</h1>
          <p>{t.subtitle}</p>
          <div className="hero-actions">
            <Link className="button light" to="/prices">{t.explore} <ArrowRight size={18}/></Link>
            <Link className="button ghost-light" to="/calculator">{t.calculatorBtn || 'Net return calculator'}</Link>
            <Link className="button ghost-light" to="/listings">{t.heroMarketBtn || 'Browse marketplace'}</Link>
          </div>
          <div className="hero-trust-bar">
            <span><CheckCircle2 size={16}/> {t.heroTrustMandis || '107 APMC Mandis'}</span>
            <span><CheckCircle2 size={16}/> {t.heroTrustCrops || '282 Verified Crops'}</span>
            <span><CheckCircle2 size={16}/> {t.heroTrustTrading || 'Direct Farmgate Trading'}</span>
          </div>
        </div>
      </div>
    </section>

    {/* Section 2: Compact Explanation of KrishiSetu's Three Main Benefits */}
    <div className="container feature-grid">
      <Link to="/prices" className="feature">
        <div className="feature-icon-box"><MapPin size={22}/></div>
        <h3>{t.featPrices || 'Verified-source prices'}</h3>
        <p>{t.featPricesDesc || 'Live Agmarknet modal benchmarks from 107 mandis with complete date and provenance transparency.'}</p>
      </Link>
      <Link to="/calculator" className="feature">
        <div className="feature-icon-box"><Calculator size={22}/></div>
        <h3>{t.featCalc || 'Know your net return'}</h3>
        <p>{t.featCalcDesc || 'Accurate Decimal arithmetic subtracting freight, labor, handling, mandi fees and transit crop loss.'}</p>
      </Link>
      <Link to="/listings" className="feature">
        <div className="feature-icon-box"><Store size={22}/></div>
        <h3>{t.featMarket || 'Direct buyer marketplace'}</h3>
        <p>{t.featMarketDesc || 'Published produce listings, transparent offer negotiations, atomic orders and zero middleman cuts.'}</p>
      </Link>
    </div>

    {/* Section 3: Interactive "How KrishiSetu Works" 9-Step Process */}
    <div className="container workflow-section">
      <div className="section-head-center">
        <p className="eyebrow">{t.workflowEyebrow || 'HOW KRISHISETU WORKS / संपूर्ण कार्यप्रणाली'}</p>
        <h2>{t.workflowTitle || 'Farmer → Mandi Intelligence → Decision → Market → Order → Logistics → Settlement'}</h2>
        <p className="section-subtitle">
          {t.workflowSubtitle || 'An interactive walkthrough of the unified 9-stage agricultural trading journey.'}
        </p>
      </div>

      <div className="interactive-workflow">
        {/* Step Navigation Track */}
        <div className="workflow-nav-track" role="tablist" aria-label="Workflow Steps">
          {workflowSteps.map((s, idx) => {
            const Icon = s.icon;
            const isActive = activeStep === idx;
            return (
              <button
                key={s.step}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`workflow-nav-node ${isActive ? 'active' : ''} ${idx < activeStep ? 'completed' : ''}`}
                onClick={() => setActiveStep(idx)}
              >
                <span className="node-num">{s.step}</span>
                <Icon size={16} className="node-icon" />
                <span className="node-title">{s.title.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>

        {/* Active Step Showcase Card */}
        <div className="workflow-showcase-card">
          <div className="showcase-header">
            <div className="showcase-icon-wrap">
              <StepIcon size={32} />
            </div>
            <div>
              <div className="showcase-badges">
                <span className="showcase-tag">{cur.tag}</span>
                <span className="showcase-hindi">{cur.hindi}</span>
              </div>
              <h3 className="showcase-title">{t.stageLabel || 'Stage'} {cur.step}: {cur.title}</h3>
            </div>
          </div>

          <p className="showcase-desc">{cur.desc}</p>
          <div className="showcase-divider" />

          <div className="showcase-footer">
            <div className="showcase-step-controls">
              <button
                type="button"
                className="button subtle small"
                disabled={activeStep === 0}
                onClick={() => setActiveStep(prev => Math.max(0, prev - 1))}
              >
                {t.prevStage || '← Previous Stage'}
              </button>
              <span className="showcase-step-count">{activeStep + 1} of {workflowSteps.length}</span>
              <button
                type="button"
                className="button subtle small"
                disabled={activeStep === workflowSteps.length - 1}
                onClick={() => setActiveStep(prev => Math.min(workflowSteps.length - 1, prev + 1))}
              >
                {t.nextStage || 'Next Stage →'}
              </button>
            </div>
            <Link to={cur.action.link} className="button primary small">
              {cur.action.label} <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    </div>

    {/* Section 4: Premium Animated Stakeholder Cards */}
    <div className="container roles-section">
      <div className="section-head-center">
        <p className="eyebrow">{t.rolesEyebrow || 'BUILT FOR ALL AGRICULTURAL STAKEHOLDERS'}</p>
        <h2>{t.rolesTitle || 'Tailored Agritech Capabilities for Every Role'}</h2>
        <p className="section-subtitle">{t.rolesSubtitle || 'Dedicated workspaces designed for agricultural producers, commercial commodity buyers, and verified logistics operators.'}</p>
      </div>

      <div className="roles-grid">
        {/* Farmer Card */}
        <div className={`role-card role-farmer ${session?.user?.role === 'FARMER' ? 'active-role-card' : ''}`}>
          <div className="role-3d-visual">
            <img src="/assets/farmer-3d.jpg" alt="Indian Farmer in Wheat Field" className="role-3d-img" loading="lazy" />
            <span className="role-3d-badge farmer-badge"><Leaf size={14}/> {t.farmerRoleTag || 'Agricultural Producer'}</span>
            {session?.user?.role === 'FARMER' && (
              <span className="active-role-pill"><CheckCircle2 size={13}/> {t.activeRoleBadge || 'Your Active Role'}</span>
            )}
            <div className="role-ambient-glow" />
          </div>
          <div className="role-body">
            <h3>{t.farmerRoleTitle || 'For Farmers (किसान)'}</h3>
            <p className="role-summary">{t.farmerRoleDesc || 'Take full control of your harvest with source-backed price benchmarks, net margin calculators, and direct sales from your farmgate.'}</p>
            <ul className="role-features">
              <li><CheckCircle2 size={16}/> {t.farmerFeature1 || 'Compare modal benchmarks across 107 APMC mandis'}</li>
              <li><CheckCircle2 size={16}/> {t.farmerFeature2 || 'Calculate true net earnings after transport and fees'}</li>
              <li><CheckCircle2 size={16}/> {t.farmerFeature3 || 'Direct buyer negotiations with zero commission deductions'}</li>
            </ul>
          </div>
          {session?.user?.role === 'FARMER' ? (
            <Link to="/account?tab=listings" className="button primary full-width">{t.farmerCtaActive || 'Farmer Listing Workspace →'}</Link>
          ) : session ? (
            <Link to="/listings" className="button subtle full-width">{t.farmerCtaBrowse || 'Browse Farmer Produce →'}</Link>
          ) : (
            <Link to="/register?role=FARMER&return_to=/listings" className="button primary full-width">{t.farmerCtaGuest || 'Start Selling Produce →'}</Link>
          )}
        </div>

        {/* Buyer Card */}
        <div className={`role-card role-buyer ${session?.user?.role === 'BUYER' ? 'active-role-card' : ''}`}>
          <div className="role-3d-visual">
            <img src="/assets/buyer-3d.jpg" alt="Agricultural Buyer with Digital Tablet" className="role-3d-img" loading="lazy" />
            <span className="role-3d-badge buyer-badge"><Store size={14}/> {t.buyerRoleTag || 'Commercial Buyer'}</span>
            {session?.user?.role === 'BUYER' && (
              <span className="active-role-pill"><CheckCircle2 size={13}/> {t.activeRoleBadge || 'Your Active Role'}</span>
            )}
            <div className="role-ambient-glow" />
          </div>
          <div className="role-body">
            <h3>{t.buyerRoleTitle || 'For Buyers (व्यापारी / खरीदार)'}</h3>
            <p className="role-summary">{t.buyerRoleDesc || 'Source high-grade farm commodities directly from registered growers with transparent negotiations and real-time shipment visibility.'}</p>
            <ul className="role-features">
              <li><CheckCircle2 size={16}/> {t.buyerFeature1 || 'Direct farmgate access to 282 verified crop varieties'}</li>
              <li><CheckCircle2 size={16}/> {t.buyerFeature2 || 'Submit purchase offers with real-time counter-bidding'}</li>
              <li><CheckCircle2 size={16}/> {t.buyerFeature3 || 'Milestone cargo tracking from farmgate to warehouse'}</li>
            </ul>
          </div>
          {session?.user?.role === 'BUYER' ? (
            <Link to="/listings" className="button primary full-width">{t.buyerCtaActive || 'Go to Buyer Marketplace →'}</Link>
          ) : session ? (
            <Link to="/listings" className="button subtle full-width">{t.buyerCtaBrowse || 'Browse Farmgate Produce →'}</Link>
          ) : (
            <Link to="/register?role=BUYER&return_to=/listings" className="button primary full-width">{t.buyerCtaGuest || 'Register as Buyer →'}</Link>
          )}
        </div>

        {/* Transporter Card */}
        <div className={`role-card role-transporter ${session?.user?.role === 'TRANSPORTER' ? 'active-role-card' : ''}`}>
          <div className="role-3d-visual">
            <img src="/assets/transporter-3d.jpg" alt="Agricultural Transport Logistics Truck" className="role-3d-img" loading="lazy" />
            <span className="role-3d-badge transporter-badge"><Truck size={14}/> {t.transporterRoleTag || 'Freight Logistics'}</span>
            {session?.user?.role === 'TRANSPORTER' && (
              <span className="active-role-pill"><CheckCircle2 size={13}/> {t.activeRoleBadge || 'Your Active Role'}</span>
            )}
            <div className="role-ambient-glow" />
          </div>
          <div className="role-body">
            <h3>{t.transporterRoleTitle || 'For Transporters (परिवहनकर्ता)'}</h3>
            <p className="role-summary">{t.transporterRoleDesc || 'Monetize your commercial fleet with verified agricultural freight demand and direct bidding on farmgate-to-mandi routes.'}</p>
            <ul className="role-features">
              <li><CheckCircle2 size={16}/> {t.transporterFeature1 || 'Register pickups, tractors, and commercial trucks'}</li>
              <li><CheckCircle2 size={16}/> {t.transporterFeature2 || 'Bid competitive distance-based rates on active orders'}</li>
              <li><CheckCircle2 size={16}/> {t.transporterFeature3 || 'Upload milestone notes and digital delivery evidence'}</li>
            </ul>
          </div>
          {session?.user?.role === 'TRANSPORTER' ? (
            <Link to="/transport" className="button primary full-width">{t.transporterCtaActive || 'Go to Freight Workspace →'}</Link>
          ) : session ? (
            <Link to="/transport" className="button subtle full-width">{t.transporterCtaBrowse || 'Explore Freight Network →'}</Link>
          ) : (
            <Link to="/register?role=TRANSPORTER&return_to=/transport" className="button primary full-width">{t.transporterCtaGuest || 'Join Freight Network →'}</Link>
          )}
        </div>
      </div>
    </div>

    {/* Section 5: Latest Verified Mandi Prices Preview */}
    <div className="container mandi-verified-section">
      <div className="section-head-bar">
        <div>
          <p className="eyebrow">{t.mandiPreviewEyebrow || 'VERIFIED MANDI BENCHMARKS / ताज़ा मंडी भाव'}</p>
          <h2>{t.mandiPreviewTitle || 'Latest Recorded APMC Arrivals'}</h2>
          <p className="section-subtitle">{t.mandiPreviewDesc || 'Modal price benchmarks fetched directly from official Agmarknet records. Strictly verified observations.'}</p>
        </div>
        <div className="section-head-actions">
          <Link to="/prices" className="button primary">{t.viewAllMandisBtn || 'Explore All Mandi Prices'} <ArrowRight size={18}/></Link>
        </div>
      </div>

      {prices.length ? (
        <div className="mandi-verified-grid">
          {prices.slice(0, 4).map(x => (
            <div key={x.id} className="mandi-verified-card">
              <div className="mandi-card-top">
                <span className="crop-pill"><Sprout size={15}/> {x.crop?.name || 'Crop'}</span>
                <span className="source-tag">{x.source || 'Agmarknet'}</span>
              </div>
              <div className="mandi-card-price">
                <span className="price-val">{currency(x.modal_price)}</span>
                <span className="price-unit">/ quintal</span>
              </div>
              <div className="mandi-card-meta">
                <div><b>{lang === 'hi' ? 'मंडी:' : lang === 'pa' ? 'ਮੰਡੀ:' : 'Mandi:'}</b> {x.market?.name}, {x.market?.district}</div>
                <div><b>{t.date || 'Recorded'}:</b> {x.observed_on || 'Current'}</div>
              </div>
              <Link to="/calculator" className="mandi-card-action">
                {t.btnCalcNet || 'Compare Net Return →'}
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <Empty message={t.noData}/>
      )}

      <div className="mandi-provenance-bar">
        <span><b>Data Provenance:</b> Official Agmarknet OGD Source</span>
        <span>•</span>
        <span><b>Benchmark:</b> APMC Modal Arrival Price (₹/Quintal)</span>
        <span>•</span>
        <span><b>Update Cycle:</b> Daily Verified Bulletin</span>
      </div>
    </div>

    {/* Section 6: Strong Final Call to Action */}
    <section className="home-cta-section">
      <div className="container">
        <div className="home-cta-card">
          <span className="cta-eyebrow">STRENGTHENING AGRICULTURAL MARKET LINKAGES</span>
          <h2>{lang === 'hi' ? 'क्या आप अधिक मुनाफा कमाने के लिए तैयार हैं?' : lang === 'pa' ? 'ਕੀ ਤੁਸੀਂ ਆਪਣੀ ਫ਼ਸਲ ਦੀ ਵੱਧ ਕਮਾਈ ਲਈ ਤਿਆਰ ਹੋ?' : 'Ready to Trade Smarter and Maximize Your Harvest Value?'}</h2>
          <p>{lang === 'hi' ? '107 मंडियों के भाव, सटीक शुद्ध मुनाफा कैलकुलेटर और सीधे खरीदारों के साथ हजारों किसान और व्यापारी जुड़े हैं।' : lang === 'pa' ? '107 ਮੰਡੀਆਂ ਦੇ ਭਾਅ, ਸ਼ੁੱਧ ਕਮਾਈ ਕੈਲਕੁਲੇਟਰ ਅਤੇ ਸਿੱਧੇ ਵਪਾਰੀਆਂ ਨਾਲ ਹਜ਼ਾਰਾਂ ਕਿਸਾਨ ਜੁੜੇ ਹਨ।' : 'Join thousands of farmers, buyers, and transporters using verified Agmarknet intelligence, accurate net return calculators, and direct farmgate linkages.'}</p>
          <div className="cta-actions">
            <Link to="/prices" className="button light">{t.explore || 'Explore Mandi Prices'} <ArrowRight size={18}/></Link>
            <Link to="/calculator" className="button ghost-light">{t.calculatorBtn || 'Calculate Net Return'}</Link>
            <Link to="/register" className="button ghost-light">{t.register || 'Register Free Today'}</Link>
          </div>
          <div className="cta-trust-items">
            <div><CheckCircle2 size={16}/> {t.heroTrustMandis || '107 APMC Mandis'}</div>
            <div><CheckCircle2 size={16}/> {t.heroTrustTrading || 'Direct Farmgate Trading Linkages'}</div>
            <div><CheckCircle2 size={16}/> {t.heroTrustCrops || 'Verified Logistics Network'}</div>
          </div>
        </div>
      </div>
    </section>
  </>;
}
function Prices({t, lang, session}){
  const[crop,setCrop]=useState(''),[state,setState]=useState(''),[debouncedState,setDebouncedState]=useState(''),[district,setDistrict]=useState(''),[market,setMarket]=useState('');
  const[variety,setVariety]=useState(''),[grade,setGrade]=useState('');
  const[profile,setProfile]=useState(''),[history,setHistory]=useState(null),[historyError,setHistoryError]=useState('');
  const[syncing,setSyncing]=useState(false),[syncNotice,setSyncNotice]=useState(null);

  // Debounce free-form state text input to avoid excessive rapid API requests
  useEffect(()=>{
    const timer = setTimeout(() => setDebouncedState(state), 350);
    return () => clearTimeout(timer);
  },[state]);

  const crops=useRequest('crops/'), markets=useRequest('markets/');
  const prices=useRequest('prices/',{...(crop?{crop}:{}),...(debouncedState?{state:debouncedState}:{}),...(district?{district}:{}),...(market?{market}:{}),...(variety?{variety}:{}),...(grade?{grade}:{}),page_size:100});
  const rows=entries(prices);
  const cropList=entries(crops);
  const marketList=entries(markets);
  const role = session?.user?.role;

  // Resolve popular crops dynamically from loaded crops, with verified database fallback IDs
  const popularCrops = React.useMemo(() => {
    const findId = (name, fallbackId) => {
      const found = cropList.find(c => c.name?.toLowerCase() === name.toLowerCase());
      return found ? String(found.id) : String(fallbackId);
    };
    return [
      {id:'', name: t.allCrops || 'All Crops'},
      {id:findId('Wheat', 46), name: lang === 'hi' ? 'गेहूँ (Wheat)' : lang === 'pa' ? 'ਕਣਕ (Wheat)' : 'Wheat (गेहूँ)'},
      {id:findId('Mustard', 49), name: lang === 'hi' ? 'सरसों (Mustard)' : lang === 'pa' ? 'ਸਰ੍ਹੋਂ (Mustard)' : 'Mustard (सरसों)'},
      {id:findId('Potato', 51), name: lang === 'hi' ? 'आलू (Potato)' : lang === 'pa' ? 'ਆਲੂ (Potato)' : 'Potato (आलू)'},
      {id:findId('Onion', 53), name: lang === 'hi' ? 'प्याज (Onion)' : lang === 'pa' ? 'ਪਿਆਜ਼ (Onion)' : 'Onion (प्याज)'},
      {id:findId('Paddy', 47), name: lang === 'hi' ? 'धान (Paddy)' : lang === 'pa' ? 'ਝੋਨਾ (Paddy)' : 'Paddy (धान)'},
      {id:findId('Cotton', 50), name: lang === 'hi' ? 'कपास (Cotton)' : lang === 'pa' ? 'ਨਰਮਾ (Cotton)' : 'Cotton (कपास)'}
    ];
  }, [cropList, lang, t]);

  async function triggerSync(){
    setSyncing(true); setSyncNotice(null);
    try {
      const res = await api.post('market/sync/');
      setSyncNotice({ type: 'info', text: res.data?.message || 'Mandi data synchronization initiated in background.' });
      setTimeout(()=>{ prices.refresh(); setSyncing(false); }, 3000);
    } catch(e) {
      setSyncNotice({ type: 'error', text: errorMessage(e) });
      setSyncing(false);
    }
  }

  useEffect(()=>{
    if(!crop||!market){setHistory(null);setHistoryError('');return;}
    let active=true;
    const params={crop,market,...(profile?JSON.parse(profile):{})};
    setHistory(null);setHistoryError('');
    api.get('analytics/history/',{params}).then(({data})=>{if(active)setHistory(data)})
      .catch(e=>{if(active)setHistoryError(errorMessage(e))});
    return()=>{active=false};
  },[crop,market,profile]);

  const historyPoints=(history?.status==='HISTORICAL_DATA'?history.observations:[])
    .slice(0,70).reverse().map(o=>({date:o.date,price:Number(o.modal_inr_per_qtl)}));

  return <Page title={t.markets} desc={t.pricesPageDesc || "Verified agricultural market intelligence: compare Agmarknet modal benchmarks, minimum and maximum arrivals across 107 APMC mandis."}>
    <div style={{display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap',marginBottom:'18px'}}>
      <span style={{fontSize:'0.82rem',fontWeight:700,color:'var(--c-text-muted)'}}>{t.quickFilters || 'Quick Filters:'}</span>
      {popularCrops.map(c=>(
        <button key={c.id || 'all'} type="button" 
          className={`button small ${String(crop)===String(c.id) ? 'primary' : 'subtle'}`}
          onClick={()=>{ setCrop(c.id); setMarket(''); setProfile(''); }}>
          {c.name}
        </button>
      ))}
      {(crop || state || district || market || variety || grade) && (
        <button type="button" className="button subtle small" style={{marginLeft:'auto',color:'#b91c1c'}}
          onClick={()=>{ setCrop(''); setState(''); setDebouncedState(''); setDistrict(''); setMarket(''); setVariety(''); setGrade(''); setProfile(''); }}>
          {t.clearFilters || 'Clear all filters ✕'}
        </button>
      )}
    </div>

    <div className="filter-bar">
      <FormField label={t.crop || "Crop"}>
        <SearchableSelect 
          options={cropList} 
          value={crop} 
          onChange={val=>{setCrop(val);setMarket('');setProfile('');}} 
          placeholder={t?.fbm?.targetCropPlaceholder || "Type crop name (e.g. Wheat, Mustard)..."} 
          emptyOption={t.allCrops || "All crops"}
          loading={crops.loading}
          error={crops.error}
        />
      </FormField>
      <FormField label={t.state || "State"}>
        <input value={state} onChange={e=>setState(e.target.value)} placeholder="e.g. Punjab, Rajasthan"/>
      </FormField>
      <FormField label={t.district || "District"}>
        <input value={district} onChange={e=>setDistrict(e.target.value)} placeholder="e.g. Fatehgarh Sahib"/>
      </FormField>
      <FormField label={t.mandi || "Mandi (for historical trend)"}>
        <SearchableSelect 
          options={marketList.filter(m=>(!debouncedState||m.state?.toLowerCase().includes(debouncedState.toLowerCase())) && (!district||m.district?.toLowerCase().includes(district.toLowerCase())))} 
          value={market} 
          onChange={val=>{setMarket(val);setProfile('');}} 
          placeholder="Type mandi name..." 
          emptyOption={t.selectMandi || "Select a mandi"}
          loading={markets.loading}
          error={markets.error}
        />
      </FormField>
      <FormField label="Variety (Optional)">
        <input value={variety} onChange={e=>setVariety(e.target.value)} placeholder="e.g. Kalyan Sona"/>
      </FormField>
      <FormField label="Grade (Optional)">
        <input value={grade} onChange={e=>setGrade(e.target.value)} placeholder="e.g. FAQ"/>
      </FormField>
    </div>

    {prices.error && <Notice type="error">{prices.error}</Notice>}
    {syncNotice && syncNotice.text !== prices.error && (
      <Notice type={syncNotice.type}>{syncNotice.text}</Notice>
    )}

    <Panel title={t.recordedMandiHead || "Source-backed mandi observations"} aside={
      <div style={{display:'flex',gap:'0.75rem',alignItems:'center'}}>
        <span className="chip">{prices.data?.count ?? rows.length} {lang === 'hi' ? 'दर्ज' : lang === 'pa' ? 'ਦਰਜ' : 'recorded'}</span>
        {role === 'ADMIN' && (
          <button className="button subtle small" disabled={syncing} onClick={triggerSync}>
            {syncing ? (t.syncing || 'Syncing...') : (t.syncLiveBtn || '↻ Sync Live Mandi Data')}
          </button>
        )}
      </div>
    }>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>{t.colCrop || 'Crop / Variety'}</th>
              <th>{t.colMandi || 'Mandi / Location'}</th>
              <th>{t.colModal || 'Modal Benchmark'}</th>
              <th>{t.colRange || 'Min – Max Range'}</th>
              <th>{t.colTrend || 'Price Trend'}</th>
              <th>{t.colDate || 'Observed Date'}</th>
              <th>{t.colProvenance || 'Provenance'}</th>
              <th style={{textAlign:'right'}}>{t.colAction || 'Decision Action'}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(p => {
              const minP = Number(p.min_price || 0);
              const modP = Number(p.modal_price || 0);
              const spreadPct = minP > 0 ? (((modP - minP) / minP) * 100).toFixed(1) : null;
              return (
                <tr key={p.id}>
                  <td>
                    <b>{p.crop?.name}</b>
                    <small>{p.variety && `${p.variety}`}{p.grade && ` · ${p.grade}`}</small>
                  </td>
                  <td>
                    <b>{p.market?.name}</b>
                    <small>{p.market?.district}, {p.market?.state}</small>
                  </td>
                  <td>
                    <b style={{color:'var(--c-primary)',fontSize:'1.05rem'}}>{currency(p.modal_price)}</b>
                    <small>/ quintal</small>
                  </td>
                  <td>
                    <span>{currency(p.min_price)} – {currency(p.max_price)}</span>
                  </td>
                  <td>
                    {spreadPct && Number(spreadPct) > 0 ? (
                      <span className="trend-pill positive">
                        <TrendingUp size={11}/> +{spreadPct}% vs Min
                      </span>
                    ) : (
                      <span className="trend-pill neutral">Stable</span>
                    )}
                  </td>
                  <td>
                    <span style={{fontSize:'0.84rem'}}>{p.observed_on}</span>
                  </td>
                  <td>
                    <span className="chip" style={{fontSize:'0.72rem',padding:'2px 7px'}}>{p.freshness || (t.verified || 'Verified')}</span>
                    <small>{p.source || 'Agmarknet'}</small>
                  </td>
                  <td style={{textAlign:'right'}}>
                    {role === 'BUYER' ? (
                      <Link
                        to={`/listings?crop=${p.crop?.id || ''}`}
                        className="mandi-quick-action"
                        title="Find farmer listings for this crop"
                      >
                        <Store size={13}/>
                        <span>{lang === 'hi' ? 'फसल खरीदें' : lang === 'pa' ? 'ਫ਼ਸਲ ਖਰੀਦੋ' : 'Source'}</span>
                      </Link>
                    ) : role === 'TRANSPORTER' ? (
                      <span className="chip-muted" style={{fontSize:'0.72rem'}}>Benchmark</span>
                    ) : (
                      <Link
                        to={`/compare?crop=${p.crop?.id || ''}&state=${encodeURIComponent(p.market?.state || '')}&district=${encodeURIComponent(p.market?.district || '')}`}
                        className="mandi-quick-action"
                        title="Calculate net realized return"
                      >
                        <Calculator size={13}/>
                        <span>{lang === 'hi' ? 'शुद्ध आय' : lang === 'pa' ? 'ਸ਼ੁੱਧ ਕਮਾਈ' : 'Find Net'}</span>
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rows.length && !prices.loading && <Empty message={t.noData}/>}
      </div>
    </Panel>
    {crop&&market&&<Panel title="Comparable historical price trend">
      {historyError&&<Notice type="error">{historyError}</Notice>}
      {history?.status==='PROFILE_SELECTION_REQUIRED'&&<>
        <Notice>{history.reason}</Notice>
        <FormField label="Choose one variety · grade · source"><select value={profile} onChange={e=>setProfile(e.target.value)}><option value="">Select a comparable profile</option>{history.available_profiles.map((p,i)=><option key={i} value={JSON.stringify(p)}>{p.variety||'Unspecified variety'} · {p.grade||'Unspecified grade'} · {p.source}</option>)}</select></FormField>
      </>}
      {historyPoints.length>1&&<><p className="muted">Historical observations from {history.profile?.source} · Variety: {history.profile?.variety||'Unspecified'} · Grade: {history.profile?.grade||'Unspecified'}. Not a forecast.</p><div className="chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={historyPoints}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="date"/><YAxis/><Tooltip formatter={v=>currency(v)}/><Line type="monotone" dataKey="price" stroke="#1d7956" strokeWidth={2} dot={false}/></LineChart></ResponsiveContainer></div></>}
      {history?.status==='UNAVAILABLE_DATA'&&<Empty message="No comparable history for this crop and mandi."/>}
      {history?.status==='HISTORICAL_DATA'&&historyPoints.length===1&&<p className="muted">Only one observation exists for this exact profile; a trend cannot be shown.</p>}
    </Panel>}
  </Page>;
}
const costFields=[['transport','Transportation'],['loading','Loading'],['unloading','Unloading'],['labour','Labour'],['market_fees','Market fees'],['commission','Commission'],['taxes','Taxes / cess'],['packaging','Packaging'],['handling','Handling'],['other','Other']];
function CalculatorPage({ t = getTranslation(), lang = 'en', session }){
  const [searchParams] = useSearchParams();
  const [quantity,setQuantity]=useState(searchParams.get('quantity')||'50'),[price,setPrice]=useState(searchParams.get('price')||'2400'),[loss,setLoss]=useState('1.0'),[costs,setCosts]=useState({transport:searchParams.get('transport')||'2500',labour:'1000',market_fees:'500'}),[result,setResult]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);

  if (session?.user?.role === 'TRANSPORTER') {
    return (
      <Page title="Logistics Hub Required" desc="Dedicated role-specific tools for commercial transport carriers.">
        <div className="role-boundary-card">
          <div className="role-boundary-icon transporter"><Truck size={32} /></div>
          <h2>Farmer Sale Proceeds Calculator</h2>
          <p className="muted">
            The Net Realised Price Calculator models farmer crop deductions before selling. To quote freight prices and manage your trucks, use the Transporter Logistics Hub.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '16px' }}>
            <Link to="/transport" className="button primary">Open Transporter Logistics Hub →</Link>
          </div>
        </div>
      </Page>
    );
  }
  
  function applyPreset(q, p, tVal, l, fees){
    setQuantity(q); setPrice(p); setCosts({transport:tVal, labour:l, market_fees:fees}); setLoss('1.0');
  }

  async function calculate(e){
    if(e) e.preventDefault();
    setBusy(true); setError('');
    try {
      const r = await api.post('calculator/',{quantity_qtl:quantity,price_per_qtl:price,loss_percent:loss,costs});
      setResult(r.data);
    } catch(err){
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  // Calculate automatically on mount with initial default
  useEffect(()=>{ calculate(); }, []);

  const grossVal = result ? Number(result.gross_inr || 0) : 0;
  const netVal = result ? Number(result.net_inr || 0) : 0;
  const deductionsVal = result ? Number(result.total_deductions_inr || 0) : 0;
  const netPercent = grossVal > 0 ? Math.max(0, Math.min(100, (netVal / grossVal) * 100)) : 0;
  const dedPercent = 100 - netPercent;

  const costLabels = t?.costs || {};

  return <Page title={t?.calcTitle || "Net realised price calculator"} desc={t?.calcDesc || "Real farmgate economics: calculate true cash in pocket by subtracting transportation freight, handling, mandi fees and transit crop loss from gross nominal value."}>
    <div style={{display:'flex',gap:'10px',alignItems:'center',flexWrap:'wrap',marginBottom:'20px'}}>
      <span style={{fontSize:'0.82rem',fontWeight:700,color:'var(--c-text-muted)'}}>{t?.fbm?.presets || 'Quick Presets:'}</span>
      <button type="button" className="button subtle small" onClick={()=>applyPreset('50','2400','2500','1000','500')}>{t?.fbm?.presetWheat || 'Wheat (50 qtl @ Khanna)'}</button>
      <button type="button" className="button subtle small" onClick={()=>applyPreset('30','5400','2000','800','450')}>{t?.fbm?.presetMustard || 'Mustard (30 qtl @ Kota)'}</button>
      <button type="button" className="button subtle small" onClick={()=>applyPreset('100','1100','4500','1500','1200')}>{t?.fbm?.presetPotato || 'Potato (100 qtl @ Azadpur)'}</button>
    </div>

    <div className="two-col">
      <Panel title={lang === 'hi' ? 'फसल एवं ढुलाई विवरण' : lang === 'pa' ? 'ਫ਼ਸਲ ਅਤੇ ਢੋਆ-ਢੁਆਈ ਵੇਰਵੇ' : 'Sale & Logistics Inputs'}>
        <form onSubmit={calculate}>
          <div style={{fontSize:'0.78rem',fontWeight:700,color:'var(--c-primary)',textTransform:'uppercase',letterSpacing:'0.04em',marginBottom:'10px'}}>
            1. {t?.quantityQtl ? (lang === 'hi' ? 'बिक्री पैरामीटर' : lang === 'pa' ? 'ਵਿਕਰੀ ਪੈਰਾਮੀਟਰ' : 'Sale Parameters') : 'Sale Parameters'}
          </div>
          <div className="form-grid">
            <FormField label={t?.quantityQtl || 'Harvest Quantity (quintals)'}><input type="number" min="0.001" step="0.001" value={quantity} onChange={e=>setQuantity(e.target.value)} required/></FormField>
            <FormField label={t?.sellingPrice || 'Selling Price (₹/quintal)'}><input type="number" min="0" step="0.01" value={price} onChange={e=>setPrice(e.target.value)} required/></FormField>
            <FormField label={t?.cropLossPercent || 'Transit/Shrinkage Loss (%)'}><input type="number" min="0" max="100" step="0.1" value={loss} onChange={e=>setLoss(e.target.value)} required/></FormField>
          </div>
          <div style={{fontSize:'0.78rem',fontWeight:700,color:'var(--c-primary)',textTransform:'uppercase',letterSpacing:'0.04em',margin:'20px 0 10px',borderTop:'1px solid var(--c-border)',paddingTop:'16px'}}>
            2. {t?.expenseBreakdown || 'Itemized Deductions & Mandi Expenses (₹)'}
          </div>
          <div className="form-grid">
            {costFields.map(([key,fallbackLabel])=>(
              <FormField key={key} label={costLabels[key] || fallbackLabel}>
                <input type="number" min="0" step="0.01" placeholder="0" value={costs[key]??''} onChange={e=>setCosts({...costs,[key]:e.target.value||'0'})}/>
              </FormField>
            ))}
          </div>
          <button className="button primary full" disabled={busy} style={{marginTop:'16px'}}>
            {busy ? (t?.calculating || 'Calculating…') : (t?.calcSubmit || 'Calculate Real Net Return')}
          </button>
        </form>
        {error && <Notice type="error">{error}</Notice>}
      </Panel>

      <div className="sticky-calc-column">
        <div className="receipt-financial-card">
          <span className="receipt-badge"><ShieldCheck size={13}/> {lang === 'hi' ? 'पारदर्शी शुद्ध आय' : lang === 'pa' ? 'ਪਾਰਦਰਸ਼ੀ ਸ਼ੁੱਧ ਕਮਾਈ' : 'Transparent Proceeds'}</span>
          <div className="receipt-highlight-num">{result ? currency(result.net_inr) : '—'}</div>
          <div className="receipt-highlight-sub">{t?.netProceeds || 'Net Realized Cash in Pocket'}</div>

          {result ? (
            <>
              {/* Stacked Visual Bar */}
              <div className="receipt-stacked-bar-wrap">
                <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.76rem',fontWeight:700}}>
                  <span style={{color:'#059669'}}>{lang === 'hi' ? 'शुद्ध लाभ' : lang === 'pa' ? 'ਸ਼ੁੱਧ ਮੁਨਾਫ਼ਾ' : 'Net Profit'}: {netPercent.toFixed(1)}%</span>
                  <span style={{color:'#dc2626'}}>{lang === 'hi' ? 'कुल कटौतियां' : lang === 'pa' ? 'ਕੁੱਲ ਕਟੌਤੀਆਂ' : 'Deductions'}: {dedPercent.toFixed(1)}%</span>
                </div>
                <div className="receipt-bar-track">
                  <div className="receipt-bar-net" style={{width: `${netPercent}%`}} />
                  <div className="receipt-bar-deductions" style={{width: `${dedPercent}%`}} />
                </div>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.72rem',color:'#64748b'}}>
                  <span>₹{Number(result.net_per_qtl_inr).toFixed(0)}/qtl net</span>
                  <span>₹{Number(result.net_per_kg_inr).toFixed(1)}/kg</span>
                </div>
              </div>

              {/* Itemized Receipt Rows */}
              <div className="receipt-item-row">
                <span style={{color:'#475569'}}>{t?.grossProceeds || 'Gross Nominal Revenue'}</span>
                <b style={{color:'#0f172a'}}>{currency(result.gross_inr)}</b>
              </div>
              {Number(costs.transport || 0) > 0 && (
                <div className="receipt-item-row">
                  <span style={{color:'#64748b'}}>{costLabels.transport ? `− ${costLabels.transport}` : '− Freight & Logistics'}</span>
                  <span style={{color:'#dc2626',fontWeight:600}}>−{currency(costs.transport)}</span>
                </div>
              )}
              {Number(costs.market_fees || 0) > 0 && (
                <div className="receipt-item-row">
                  <span style={{color:'#64748b'}}>{costLabels.market_fees ? `− ${costLabels.market_fees}` : '− APMC Market Fees / Mandi Tax'}</span>
                  <span style={{color:'#dc2626',fontWeight:600}}>−{currency(costs.market_fees)}</span>
                </div>
              )}
              {Number(costs.labour || 0) > 0 && (
                <div className="receipt-item-row">
                  <span style={{color:'#64748b'}}>{costLabels.labour ? `− ${costLabels.labour}` : '− Loading & Labour'}</span>
                  <span style={{color:'#dc2626',fontWeight:600}}>−{currency(costs.labour)}</span>
                </div>
              )}
              {Number(result.transit_loss_inr || 0) > 0 && (
                <div className="receipt-item-row">
                  <span style={{color:'#64748b'}}>{lang === 'hi' ? '− फसल सूखने / परिवहन नुकसान' : lang === 'pa' ? '− ਫ਼ਸਲੀ ਨੁਕਸਾਨ' : '− Transit Crop Shrinkage'}</span>
                  <span style={{color:'#dc2626',fontWeight:600}}>−{currency(result.transit_loss_inr)}</span>
                </div>
              )}
              <div className="receipt-item-row">
                <span style={{color:'#475569',fontWeight:600}}>{t?.totalDeductions || 'Total Deductions'}</span>
                <b style={{color:'#dc2626'}}>−{currency(result.total_deductions_inr)}</b>
              </div>
              <div className="receipt-item-row total">
                <span style={{color:'#064e3b'}}>{t?.netProceeds || 'Actual Cash in Pocket'}</span>
                <b style={{color:'#059669',fontSize:'1.15rem'}}>{currency(result.net_inr)}</b>
              </div>

              <div style={{marginTop:'16px',padding:'12px',background:'#f0fdf4',borderRadius:'8px',fontSize:'0.8rem',color:'#064e3b',borderLeft:'3px solid #059669',lineHeight:1.5}}>
                <b>{lang === 'hi' ? 'आर्थिक निष्कर्ष:' : lang === 'pa' ? 'ਆਰਥਿਕ ਸਿੱਟਾ:' : 'Takeaway:'}</b> {result.basis}. {lang === 'hi' ? 'दूर की मंडी का केवल ऊँचा भाव देखकर न जाएँ, भाड़ा और नुकसान कटने के बाद का शुद्ध लाभ ही असली कमाई है।' : lang === 'pa' ? 'ਦੂਰ ਦੀ ਮੰਡੀ ਦਾ ਉੱਚਾ ਭਾਅ ਵੇਖ ਕੇ ਨਾ ਜਾਓ, ਭਾੜਾ ਅਤੇ ਨੁਕਸਾਨ ਕੱਢਣ ਤੋਂ ਬਾਅਦ ਅਸਲ ਮੁਨਾਫ਼ਾ ਹੀ ਸਹੀ ਕਮਾਈ ਹੈ।' : 'Higher nominal prices at distant mandis often deliver lower realized profit once transport and transit loss are deducted!'}
              </div>
            </>
          ) : (
            <Empty message={t?.noData || "Complete the form to see a transparent receipt breakdown."}/>
          )}
        </div>
      </div>
    </div>
  </Page>;
}
function Compare({session}){
  const crops=useRequest('crops/');
  const [crop,setCrop]=useState(''),[qty,setQty]=useState('20');
  const [state,setState]=useState(''),[district,setDistrict]=useState('');
  const [variety,setVariety]=useState(''),[grade,setGrade]=useState('');
  const [costs,setCosts]=useState({}),[result,setResult]=useState(null);
  const [error,setError]=useState(''),[opportunities,setOpportunities]=useState([]),[truncated,setTruncated]=useState(false);
  useEffect(()=>{
    let active=true;
    if(!crop){setOpportunities([]);return;}
    const params={crop};
    if(state)params.state=state;if(district)params.district=district;
    if(variety)params.variety=variety;if(grade)params.grade=grade;
    api.get('market/opportunities/',{params}).then(({data})=>{
      if(active){setOpportunities(data.opportunities||[]);setTruncated(!!data.truncated);setError('');}
    }).catch(e=>{if(active){setOpportunities([]);setError(errorMessage(e));}});
    return()=>{active=false};
  },[crop,state,district,variety,grade,session?.user?.account_verified]);
  function change(key,field,value){setCosts(previous=>({...previous,[key]:{...previous[key],[field]:value}}));}
  async function submit(e){e.preventDefault();setError('');
    try{
      const costMap={};
      for(const destination of opportunities){
        const inputs=costs[destination.key];
        if(!inputs||inputs.transport===''||inputs.transport===undefined||
          inputs.other===''||inputs.other===undefined)continue;
        costMap[destination.key]={costs:{transport:inputs.transport,other:inputs.other},
          loss_percent:inputs.loss||'0'};
      }
      const payload={crop_id:Number(crop),quantity_qtl:qty,costs_by_destination:costMap};
      if(state)payload.state=state;if(district)payload.district=district;
      if(variety)payload.variety=variety;if(grade)payload.grade=grade;
      const {data}=await api.post('recommendations/',payload);
      setResult(data);
    }catch(e){setError(errorMessage(e));}
  }
  return <Page title="Compare selling destinations" desc="Rank net income using verified-source observations (seven days or newer) and actual pending offers; no invented distance or charges.">
    <Panel title="Crop and sale quantity"><form onSubmit={submit}>
      <div className="form-grid">
        <FormField label="Crop"><SearchableSelect options={entries(crops)} value={crop} onChange={val=>{setCrop(val);setCosts({});setResult(null)}} placeholder="Type crop name..." emptyOption="Select crop" required /></FormField>
        <FormField label="Quantity (quintals)"><input type="number" value={qty} min="0.001" step="0.001" required onChange={e=>setQty(e.target.value)}/></FormField>
        <FormField label="State (optional)"><input value={state} placeholder="Punjab" onChange={e=>setState(e.target.value)}/></FormField>
        <FormField label="District (optional)"><input value={district} placeholder="Bathinda" onChange={e=>setDistrict(e.target.value)}/></FormField>
        <FormField label="Variety (optional exact match)"><input value={variety} onChange={e=>setVariety(e.target.value)}/></FormField>
        <FormField label="Grade (optional exact match)"><input value={grade} onChange={e=>setGrade(e.target.value)}/></FormField>
      </div>
      {truncated&&<Notice>Only the first 250 markets are shown. Narrow the state, district or grade to see the relevant ones.</Notice>}
      {crop&&opportunities.map(c=><div className="comparison-input" key={c.key}>
        <h3>{c.kind==='BUYER_OFFER'?'Pending buyer offer':'Mandi'}: {c.name}</h3>
        <p className="muted">Reference {currency(c.price_per_qtl)}/qtl · {c.source} · {c.observed_on} · {c.variety||'Variety unspecified'} / {c.grade||'Grade unspecified'}</p>
        {c.quantity_qtl&&<p className="muted">Offer quantity: {c.quantity_qtl} qtl (not guaranteed until accepted)</p>}
        <div className="form-grid">
          <FormField label="Transport cost (INR)"><input type="number" min="0" step="0.01" placeholder="Enter estimate" value={costs[c.key]?.transport??''} onChange={e=>change(c.key,'transport',e.target.value)}/></FormField>
          <FormField label="Other deductions (INR)"><input type="number" min="0" step="0.01" placeholder="Fees, labour, packaging etc." value={costs[c.key]?.other??''} onChange={e=>change(c.key,'other',e.target.value)}/></FormField>
          <FormField label="Estimated crop loss (%)"><input type="number" min="0" max="100" step="0.1" value={costs[c.key]?.loss??'0'} onChange={e=>change(c.key,'loss',e.target.value)}/></FormField>
        </div>
      </div>)}
      {crop&&!opportunities.length&&<Notice>No recent eligible mandi observations or matching pending direct offers. Check your filters or configure the official data source.</Notice>}
      <button className="button primary" disabled={!crop}>Compare entered cost estimates</button>
      <p className="muted">A zero cost is a deliberate user assumption. Add every applicable charge; observations are not executable bids.</p>
    </form></Panel>
    {error&&<Notice type="error">{error}</Notice>}
    {result&&<Panel title="Ranked by estimated net proceeds">
      {result.ranked?.length?<div className="result-list">{result.ranked.map((item,i)=><div key={item.destination} className="rank-item">
        <span className="rank">{i+1}</span><div><b>{item.name}</b><small>{item.kind==='BUYER_OFFER'?'Pending buyer offer':'Mandi observation'} · {item.source} · {item.observed_on}</small>
          <small>Gross {currency(item.calculation.gross_inr)} · Deductions {currency(item.calculation.total_deductions_inr)}</small></div>
          <strong>{currency(item.calculation.net_inr)}</strong>
      </div>)}</div>:<Empty message="Enter transport and other costs for at least one eligible destination."/>}
      {result.missing_cost_inputs?.length>0&&<Notice>{result.missing_cost_inputs.length} destinations omitted because their costs are missing.</Notice>}
      <p className="muted">{result.disclaimer}</p>
    </Panel>}
  </Page>;
}
function Listings({session, t, lang}){
  const [searchParams] = useSearchParams();
  const crops=useRequest('crops/'),{data,error,refresh}=useRequest('listings/');
  const rows=entries({data}),[filter,setFilter]=useState(''),[cropIdFilter,setCropIdFilter]=useState(searchParams.get('crop')||''),[stateFilter,setStateFilter]=useState(''),[gradeFilter,setGradeFilter]=useState(''),[sortBy,setSortBy]=useState('newest');
  const[form,setForm]=useState({crop:searchParams.get('crop')||'',variety:'',grade:'FAQ',quantity_qtl:searchParams.get('quantity')||'',asking_per_qtl:searchParams.get('asking_price')||'',district:session?.user?.district||'',state:session?.user?.state||'',description:''}),[message,setMessage]=useState(''),[photo,setPhoto]=useState(null);

  useEffect(()=>{
    const cid = searchParams.get('crop') || '';
    setCropIdFilter(cid);
  },[searchParams]);

  const role = session?.user?.role;

  // Role Isolation: Transporters operate in Logistics Hub, not crop buying/selling
  if (role === 'TRANSPORTER') {
    return (
      <Page title="Transporter Logistics Access" desc="Commercial carriers manage freight quotations and shipments in the Logistics Hub.">
        <div className="role-boundary-card">
          <div className="role-boundary-icon transporter"><Truck size={32} /></div>
          <h2>{lang === 'hi' ? 'यह कृषि खरीद-बिक्री बाज़ार है' : lang === 'pa' ? 'ਇਹ ਫ਼ਸਲ ਖਰੀਦ-ਵੇਚ ਬਾਜ਼ਾਰ ਹੈ' : 'Crop Trading Marketplace (Farmers & Buyers Only)'}</h2>
          <p className="muted">
            Direct crop publishing and purchase negotiations are restricted to registered Farmers and Commercial Buyers. View confirmed order pickup demand and submit freight bids in your Transporter Workspace.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '16px' }}>
            <Link to="/transport?tab=freight-board" className="button primary">Browse Available Freight Loads →</Link>
            <Link to="/transport" className="button subtle">Open Logistics Hub</Link>
          </div>
        </div>
      </Page>
    );
  }

  async function create(e){
    e.preventDefault();setMessage('');
    try {
      const payload=new FormData();
      Object.entries(form).forEach(([k,v])=>payload.append(k,v));
      if(photo)payload.append('image',photo);
      await api.post('listings/',payload);
      setPhoto(null);
      setMessage(lang === 'hi' ? 'फसल सफलतापूर्वक प्रकाशित हो गई। अब थोक खरीदार इसे देख सकते हैं।' : lang === 'pa' ? 'ਫ਼ਸਲ ਸਫਲਤਾਪੂਰਵਕ ਦਰਜ ਹੋ ਗਈ। ਹੁਣ ਵਪਾਰੀ ਇਸਨੂੰ ਵੇਖ ਸਕਦੇ ਹਨ।' : 'Listing published successfully. It is now discoverable by commercial buyers.');
      setForm({crop:'',variety:'',grade:'FAQ',quantity_qtl:'',asking_per_qtl:'',district:'',state:'',description:''});
      refresh();
    } catch(err){
      setMessage(errorMessage(err));
    }
  }

  const filteredRows = rows
    .filter(x => !cropIdFilter || String(x.crop) === String(cropIdFilter))
    .filter(x => !filter || x.crop_name?.toLowerCase().includes(filter.toLowerCase()))
    .filter(x => !stateFilter || x.state?.toLowerCase().includes(stateFilter.toLowerCase()) || x.district?.toLowerCase().includes(stateFilter.toLowerCase()))
    .filter(x => !gradeFilter || x.grade?.toLowerCase().includes(gradeFilter.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'price_asc') return Number(a.asking_per_qtl) - Number(b.asking_per_qtl);
      if (sortBy === 'price_desc') return Number(b.asking_per_qtl) - Number(a.asking_per_qtl);
      return 0;
    });

  const pageTitle = role === 'BUYER'
    ? (lang === 'hi' ? 'प्रत्यक्ष कृषि क्रय बाज़ार' : lang === 'pa' ? 'ਸਿੱਧਾ ਫ਼ਸਲ ਖਰੀਦ ਬਾਜ਼ਾਰ' : 'Direct Farmgate Procurement Marketplace')
    : role === 'FARMER'
    ? (lang === 'hi' ? 'कृषि बाज़ार एवं मेरी फसल सूची' : lang === 'pa' ? 'ਖੇਤੀ ਬਾਜ਼ਾਰ ਅਤੇ ਮੇਰੀ ਫ਼ਸਲ ਸੂਚੀ' : 'Farmgate Marketplace & Publish Crop')
    : (t.marketplaceTitle || "Farmer–buyer marketplace");

  return <Page title={pageTitle} desc={t.marketplaceDesc || "Direct farmgate trade: farmers publish verified produce listings with variety and asking price; commercial buyers submit direct purchase offers without middleman commissions."}>
    <div className="two-col marketplace-layout">
      <div>
        <Panel title={t.availableProduce || "Available produce listings"} aside={<span className="chip">{filteredRows.length} {lang === 'hi' ? 'उपलब्ध' : lang === 'pa' ? 'ਉਪਲਬਧ' : 'available'}</span>}>
          <div style={{display:'flex',gap:'8px',marginBottom:'14px',flexWrap:'wrap'}}>
            {['', 'Wheat', 'Mustard', 'Potato', 'Onion', 'Paddy'].map(cropName=>(
              <button key={cropName} type="button" 
                className={`button small ${!cropIdFilter && filter===cropName?'primary':'subtle'}`}
                onClick={()=>{setCropIdFilter('');setFilter(cropName);}}>
                {cropName || (t.allProduce || 'All produce')}
              </button>
            ))}
          </div>

          <div className="form-grid" style={{marginBottom:'14px'}}>
            <FormField label={t.filterCrop || "Filter by crop name"}>
              <input value={filter} onChange={e=>{setCropIdFilter('');setFilter(e.target.value);}} placeholder="Type crop (e.g. Wheat, Potato)..."/>
            </FormField>
            <FormField label="State / District">
              <input value={stateFilter} onChange={e=>setStateFilter(e.target.value)} placeholder="e.g. Punjab, Bathinda"/>
            </FormField>
            <FormField label="Sort Listings">
              <select value={sortBy} onChange={e=>setSortBy(e.target.value)}>
                <option value="newest">Newest Arrivals</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
              </select>
            </FormField>
          </div>
          
          {error && <Notice type="error">{error}</Notice>}
          
          <div className="listing-grid">
            {filteredRows.map(x=>(
              <article className="listing-card" key={x.id}>
                <div className="listing-icon">
                  {x.image ? (
                    <img src={x.image} alt={`Crop listing for ${x.crop_name}`} loading="lazy"/>
                  ) : <Sprout size={36}/>}
                </div>
                <div>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:'8px'}}>
                    <div>
                      <h3 style={{margin:0,fontSize:'1.2rem',color:'var(--c-forest-900)'}}>
                        {x.crop_name} {x.variety ? `(${x.variety})` : ''}
                      </h3>
                      <p style={{margin:'4px 0 6px',fontSize:'0.84rem',color:'var(--c-text-muted)'}}>
                        <MapPin size={14}/> {x.district}, {x.state} · {x.farmer_name || 'Registered Grower'}
                      </p>
                    </div>
                    <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>
                      {x.farmer_verified ? (
                        <span className="status-pill verified" style={{fontSize:'0.72rem'}}>
                          <CheckCircle2 size={11}/> Verified Grower
                        </span>
                      ) : (
                        <span className="status-pill unverified" style={{fontSize:'0.72rem'}}>Grower Unverified</span>
                      )}
                      <span className="chip" style={{background:'#e0f2e7',color:'var(--c-primary)',fontWeight:700}}>
                        {x.grade ? `Grade ${x.grade}` : (t.standardGrade || 'Standard Grade')}
                      </span>
                    </div>
                  </div>

                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',margin:'10px 0 6px',flexWrap:'wrap'}}>
                    <strong style={{fontSize:'1.3rem',color:'var(--c-primary)',margin:0}}>
                      {currency(x.asking_per_qtl)} <small style={{fontSize:'0.8rem',fontWeight:600}}>/ qtl</small>
                    </strong>
                    <span style={{fontSize:'0.88rem',fontWeight:700,color:'var(--c-forest-800)'}}>
                      {t.availableQtl || 'Available:'} {x.available_qtl} qtl
                    </span>
                  </div>

                  {x.description && (
                    <p style={{fontSize:'0.85rem',color:'var(--c-text-muted)',margin:'6px 0 10px',fontStyle:'italic'}}>
                      "{x.description}"
                    </p>
                  )}

                  {role==='BUYER' ? (
                    <OfferForm listing={x}/>
                  ) : role==='FARMER' ? (
                    <small className="muted" style={{display:'block',marginTop:'6px'}}>
                      Market benchmark reference · Manage your own produce in the <Link to="/farmer?tab=listings" style={{color:'var(--c-primary)',fontWeight:600}}>Farmer Hub</Link>.
                    </small>
                  ) : !session ? (
                    <div className="offer-box" style={{marginTop:'10px'}}>
                      <Link 
                        to={`/login?role=BUYER&return_to=/listings`} 
                        className="button subtle small"
                        style={{display:'inline-flex',alignItems:'center',gap:'6px'}}
                      >
                        <Store size={14}/> {lang === 'hi' ? 'खरीदार के रूप में लॉगिन कर प्रस्ताव दें' : lang === 'pa' ? 'ਵਪਾਰੀ ਵਜੋਂ ਲਾਗਇਨ ਕਰਕੇ ਸੌਦਾ ਦਿਓ' : 'Sign in as Buyer to Make Offer'}
                      </Link>
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
            {!filteredRows.length && <Empty message={t.emptyRecords || "No active crop listings match your filter. Check back soon or register as a farmer to list produce."}/>}
          </div>
        </Panel>
      </div>

      <div>
        {role==='FARMER' ? (
          <Panel title={t.createListingPanel || "Create produce listing"} aside={<Link to="/farmer?tab=listings" className="button subtle small">Manage My Lots →</Link>}>
            {!session.user.account_verified && (
              <Notice type="warning">{lang === 'hi' ? 'फसल प्रकाशित करने से पहले खाते में ईमेल और मोबाइल सत्यापित करें।' : lang === 'pa' ? 'ਫ਼ਸਲ ਦਰਜ ਕਰਨ ਤੋਂ ਪਹਿਲਾਂ ਖਾਤੇ ਵਿੱਚ ਈਮੇਲ ਅਤੇ ਮੋਬਾਈਲ ਪ੍ਰਮਾਣਿਤ ਕਰੋ।' : 'Verify your email and mobile number under Account Verification before publishing listings.'}</Notice>
            )}
            <form onSubmit={create}>
              <FormField label={t.crop || "Crop"}>
                <SearchableSelect options={entries(crops)} value={form.crop} onChange={val=>setForm({...form,crop:val})} placeholder={t?.fbm?.targetCropPlaceholder || "Type to search crop (e.g. Wheat, Potato)..."} emptyOption={t.allCrops || "Choose a crop"} required />
              </FormField>
              {[
                ['variety', 'Crop variety (optional)', false],
                ['grade', 'Grade (e.g. FAQ, Grade A)', false],
                ['quantity_qtl', t.quantityQtl || 'Quantity available (quintals)', true],
                ['asking_per_qtl', t.askingPrice || 'Asking price (₹/quintal)', true],
                ['district', t.district || 'Farm district', true],
                ['state', t.state || 'State', true],
                ['description', lang === 'hi' ? 'फसल विवरण एवं गुणवत्ता' : lang === 'pa' ? 'ਫ਼ਸਲ ਦਾ ਵੇਰਵਾ ਤੇ ਗੁਣਵੱਤਾ' : 'Produce description & harvest quality', false]
              ].map(([key,label,req])=>(
                <FormField key={key} label={label}>
                  <input required={req} 
                    type={key==='quantity_qtl'||key==='asking_per_qtl'?'number':'text'} 
                    step="any" value={form[key]} 
                    onChange={e=>setForm({...form,[key]:e.target.value})}/>
                </FormField>
              ))}
              <FormField label={`${t.cropPhoto || 'Crop photograph'} (JPEG, PNG, WebP; max 5 MB)`}>
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setPhoto(e.target.files?.[0]||null)}/>
              </FormField>
              <button className="button primary full" disabled={!session.user.account_verified} style={{marginTop:'10px'}}>{t.publishListing || 'Publish to Marketplace'}</button>
            </form>
            {message && <Notice>{message}</Notice>}
          </Panel>
        ) : role==='BUYER' ? (
          <Panel title={lang === 'hi' ? 'थोक खरीदार कार्यक्षेत्र' : lang === 'pa' ? 'ਵਪਾਰਕ ਖਰੀਦਦਾਰ ਵਰਕਸਪੇਸ' : 'Commercial Buyer Workspace'}>
            {session.user.identity_verified && session.user.account_verified ? (
              <span className="status-pill verified" style={{marginBottom:'12px',display:'inline-flex'}}>
                <ShieldCheck size={14}/> KYC Verified Buyer Account
              </span>
            ) : session.user.account_verified ? (
              <span className="status-pill verified" style={{marginBottom:'12px',display:'inline-flex'}}>
                <CheckCircle2 size={14}/> Email & Phone Verified (Trading Enabled)
              </span>
            ) : (
              <div className="notice warning" style={{marginBottom:'12px'}}>
                <AlertTriangle size={16}/>
                <span>Verification required (Email & Mobile OTP) before placing purchase offers. <Link to="/account?tab=verification" style={{fontWeight:700}}>Verify Now →</Link></span>
              </div>
            )}
            <p style={{fontSize:'0.9rem',color:'var(--c-text-muted)',lineHeight:1.6}}>
              Browse active farmgate produce on the left and click <b>Make a purchase offer</b> on any listing to submit direct quantity and price bids with zero middleman cuts.
            </p>
            <div style={{display:'flex',flexDirection:'column',gap:'10px',marginTop:'18px'}}>
              <Link className="button primary full" to="/buyer">Open Full Buyer Hub →</Link>
              <Link className="button subtle full" to="/buyer?tab=offers">Track My Offers & Counteroffers</Link>
              <Link className="button subtle full" to="/prices">Check APMC Mandi Benchmarks</Link>
            </div>
          </Panel>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:'20px'}}>
            <Panel title="Commercial Commodity Buyers">
              <p style={{fontSize:'0.9rem',color:'var(--c-text-muted)',lineHeight:1.55}}>
                Are you sourcing bulk agricultural commodities? Register or sign in as a commercial buyer to place direct purchase offers and contract farmgate shipments.
              </p>
              <div style={{display:'flex',flexDirection:'column',gap:'8px',marginTop:'14px'}}>
                <Link className="button primary full" to="/register?role=BUYER&return_to=/listings">Register as Buyer</Link>
                <Link className="button subtle full" to="/login?role=BUYER&return_to=/listings">Sign In as Buyer</Link>
              </div>
            </Panel>

            <Panel title="Farmers: Sell Your Harvest">
              <p style={{fontSize:'0.9rem',color:'var(--c-text-muted)',lineHeight:1.55}}>
                Publish your crop varieties, asking prices, and available quintals directly to verified commodity buyers across India.
              </p>
              <div style={{display:'flex',flexDirection:'column',gap:'8px',marginTop:'14px'}}>
                <Link className="button primary full" to="/register?role=FARMER&return_to=/listings">Register as Farmer</Link>
                <Link className="button subtle full" to="/prices">Compare Mandi Modal Rates</Link>
              </div>
            </Panel>
          </div>
        )}
      </div>
    </div>
  </Page>;
}
function OfferForm({listing}){
  const[open,setOpen]=useState(false),[qty,setQty]=useState(''),[price,setPrice]=useState(''),[message,setMessage]=useState('');
  async function submit(e){
    e.preventDefault();
    try {
      const expires=new Date(Date.now()+48*3600000).toISOString();
      await api.post('offers/',{listing:listing.id,quantity_qtl:qty,price_per_qtl:price,expires_at:expires});
      setMessage('Offer submitted successfully! The farmer will review your offer.');
      setOpen(false);
    } catch(err){
      setMessage(errorMessage(err));
    }
  }

  const totalOfferVal = (Number(qty||0) * Number(price||0));

  return <div className="offer-box">
    <button className="button subtle small" type="button" onClick={()=>setOpen(!open)}>
      {open ? '✕ Close negotiation' : '🤝 Make a purchase offer'}
    </button>
    {open && (
      <form onSubmit={submit} style={{marginTop:'12px',padding:'14px',background:'var(--c-bg-subtle)',borderRadius:'var(--radius-sm)',border:'1px solid var(--c-border)'}}>
        <div className="form-grid">
          <FormField label={`Offer quantity (max ${listing.available_qtl} qtl)`}>
            <input type="number" min="0.001" max={listing.available_qtl} step="0.001" required value={qty} onChange={e=>setQty(e.target.value)} placeholder="e.g. 40"/>
          </FormField>
          <FormField label="Offered price (₹/qtl)">
            <input type="number" min="0.01" step="0.01" required value={price} onChange={e=>setPrice(e.target.value)} placeholder={`Asking: ₹${listing.asking_per_qtl}`}/>
          </FormField>
        </div>
        {totalOfferVal > 0 && (
          <div style={{fontSize:'0.88rem',fontWeight:700,color:'var(--c-primary)',margin:'8px 0'}}>
            Total gross transaction: {currency(totalOfferVal)}
          </div>
        )}
        <button className="button primary small" style={{marginTop:'6px'}}>Submit formal offer</button>
      </form>
    )}
    {message && <small style={{marginTop:'6px',color:'var(--c-primary)',fontWeight:600}}>{message}</small>}
  </div>;
}
function Auth({mode,onLogin,t,lang}){
  return <AuthPage mode={mode} onLogin={onLogin} t={t} lang={lang}/>;
}
function VerifyEmail({session,setUser}){const[params]=useSearchParams();const[msg,setMsg]=useState('');const[busy,setBusy]=useState(false);const challenge=params.get('challenge');const token=params.get('token');async function verify(){if(!challenge||!token)return;setBusy(true);try{const r=await api.post('auth/verification/confirm/',{kind:'EMAIL',challenge_id:challenge,token:token});if(r.data?.user)setUser(r.data.user);setMsg('Email verified successfully! You can verify your phone in My account.');}catch(e){setMsg(errorMessage(e));}finally{setBusy(false);}}useEffect(()=>{if(challenge&&token){verify();}},[challenge,token]);return <Page title="Verify email"><Panel title="Confirm your email">{busy&&<p>Verifying your email address…</p>}{!busy&&!msg&&<form onSubmit={e=>{e.preventDefault();verify();}}><p>Confirm the single-use verification link sent to your inbox.</p><button className="button primary">Verify my email</button></form>}{msg&&<><Notice type={msg.includes('successfully')?'success':'info'}>{msg}</Notice><p style={{marginTop:'1rem'}}><Link to="/account" className="button primary">Go to My account</Link></p></>}</Panel></Page>}
function Password({reset=false}){const[params]=useSearchParams(),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[msg,setMsg]=useState('');async function submit(e){e.preventDefault();try{const r=await api.post(reset?'auth/password-reset/confirm/':'auth/password-reset/request/',reset?{uid:params.get('uid'),token:params.get('token'),password}:{email});setMsg(r.data.message)}catch(e){setMsg(errorMessage(e))}}return <Page title={reset?'Set a new password':'Reset your password'}><div className="auth-card"><form onSubmit={submit}>{reset?<FormField label="New password"><input type="password" minLength="10" required value={password} onChange={e=>setPassword(e.target.value)}/></FormField>:<FormField label="Account email"><input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></FormField>}<button className="button primary">{reset?'Update password':'Send reset link'}</button>{msg&&<Notice>{msg}</Notice>}</form></div></Page>}
function Account({session,setUser}){
  return (
    <Page title="My Account Workspace" desc="Role-based dashboard, multi-tier verification center, profile governance, and trade operations.">
      <AccountDashboard session={session} setUser={setUser} />
    </Page>
  );
}
function Institution(){const{data,error}=useRequest('institutional/analytics/');async function download(){try{const res=await api.get('institutional/analytics.csv',{responseType:'blob'});const url=URL.createObjectURL(res.data);const a=document.createElement('a');a.href=url;a.download='krishisetu_aggregate_market_prices.csv';a.click();URL.revokeObjectURL(url);}catch(e){alert(errorMessage(e));}}return <Page title="Institutional analytics" desc="Permission-restricted, aggregated-only reporting. Small sample groups are suppressed; no farmer personal details are published.">{error&&<Notice type="error">{error}</Notice>}{data&&<Panel title="Agricultural market overview"><button className="button subtle small" onClick={download}>Export aggregated CSV</button><div className="metrics"><div><b>{data.observations_total??'—'}</b><span>Source-backed observations</span></div><div><b>{data.orders_total??'—'}</b><span>Orders recorded</span></div><div><b>{data.users_total??'—'}</b><span>Registered users</span></div></div><div className="table-scroll"><table><thead><tr><th>Crop</th><th>State</th><th>Observations</th><th>Average modal</th><th>Latest date</th></tr></thead><tbody>{data.aggregated_market_prices?.map((x,i)=><tr key={i}><td>{x.crop__name}</td><td>{x.market__state}</td><td>{x.observations}</td><td>{currency(x.average_modal)}</td><td>{x.latest}</td></tr>)}</tbody></table></div></Panel>}</Page>}
function getRoleNav(role, t, lang) {
  if (role === 'FARMER') {
    return [
      ['/farmer', lang === 'hi' ? 'किसान हब' : lang === 'pa' ? 'ਕਿਸਾਨ ਹੱਬ' : 'Farmer Hub'],
      ['/compare', t.findBestMarket || t.compare],
      ['/prices', t.markets],
      ['/calculator', t.netCalculator || t.calculatorBtn],
      ['/listings', lang === 'hi' ? 'फसल बेचें' : lang === 'pa' ? 'ਫ਼ਸਲ ਵੇਚੋ' : 'Publish Crop'],
    ];
  }
  if (role === 'BUYER') {
    return [
      ['/buyer', lang === 'hi' ? 'खरीदार हब' : lang === 'pa' ? 'ਖਰੀਦਦਾਰ ਹੱਬ' : 'Buyer Hub'],
      ['/listings', lang === 'hi' ? 'फसल बाज़ार' : lang === 'pa' ? 'ਫ਼ਸਲ ਬਾਜ਼ਾਰ' : 'Crop Marketplace'],
      ['/prices', t.markets],
    ];
  }
  if (role === 'TRANSPORTER') {
    return [
      ['/transport', lang === 'hi' ? 'लॉजिस्टिक्स हब' : lang === 'pa' ? 'ਲੌਜਿਸਟਿਕਸ ਹੱਬ' : 'Logistics Hub'],
      ['/transport?tab=freight-board', lang === 'hi' ? 'भाड़ा लोड' : lang === 'pa' ? 'ਭਾੜਾ ਲੋਡ' : 'Freight Board'],
      ['/transport?tab=vehicles', lang === 'hi' ? 'मेरे वाहन' : lang === 'pa' ? 'ਮੇਰੇ ਵਾਹਨ' : 'My Fleet'],
      ['/transport?tab=shipments', lang === 'hi' ? 'सक्रिय खेप' : lang === 'pa' ? 'ਸਰਗਰਮ ਖੇਪ' : 'Shipments'],
    ];
  }
  if (role === 'ADMIN') {
    return [
      ['/admin', t.admin || 'Review Queue'],
      ['/institution', t.institution || 'Analytics'],
      ['/prices', t.markets],
    ];
  }
  if (role === 'INSTITUTION') {
    return [
      ['/institution', t.institution || 'Institutional'],
      ['/prices', t.markets],
    ];
  }
  return [
    ['/', t.home],
    ['/prices', t.markets],
    ['/compare', t.findBestMarket || t.compare],
    ['/calculator', t.netCalculator || t.calculatorBtn],
    ['/listings', t.marketplace],
  ];
}

function getRoleHomePath(role) {
  if (role === 'FARMER') return '/farmer';
  if (role === 'BUYER') return '/buyer';
  if (role === 'TRANSPORTER') return '/transport';
  if (role === 'ADMIN') return '/admin';
  if (role === 'INSTITUTION') return '/institution';
  return '/';
}

function RoleGuard({ session, allowedRoles, title, desc, children, onLogin, t, lang }) {
  if (!session) {
    return <Auth mode="login" onLogin={onLogin} t={t} lang={lang} />;
  }
  if (!allowedRoles.includes(session.user?.role)) {
    const homePath = getRoleHomePath(session.user?.role);
    return (
      <Page title={title || 'Access restricted'} desc={desc || 'Role-separated operational workspace.'}>
        <div className="role-boundary-card">
          <div className="role-boundary-icon"><ShieldCheck size={32} /></div>
          <h2>Role-Specific Workspace Boundary</h2>
          <p className="muted">
            You are currently signed in as <b>{session.user?.role}</b>. This route is restricted to <b>{allowedRoles.join(' / ')}</b> accounts so each participant sees only relevant tools and data.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '16px' }}>
            <Link to={homePath} className="button primary">Return to Your {session.user?.role} Hub →</Link>
            <Link to="/account" className="button subtle">Account Settings</Link>
          </div>
        </div>
      </Page>
    );
  }
  return children;
}

function App(){
  const[session,setSessionState]=useState(getSession()),[lang,setLang]=useState(localStorage.getItem('krishisetu_lang')||'en'),[open,setOpen]=useState(false),[showDemoModal,setShowDemoModal]=useState(false),[loggingOut,setLoggingOut]=useState(false);
  const navigate=useNavigate();const location=useLocation();
  const isAuthPage=location.pathname==='/login'||location.pathname==='/register';
  const t=getTranslation(lang);
  function login(s){setSession(s);setSessionState(s)}
  function setUser(user){const s={...getSession(),user};setSession(s);setSessionState(s)}
  async function logout(){setLoggingOut(true);try{await api.post('auth/logout/',{refresh:session?.refresh})}catch{}dropSession();setSessionState(null);setLoggingOut(false);navigate('/')}
  useEffect(()=>{function expired(){setSessionState(null)}window.addEventListener('krishisetu-session-expired',expired);return()=>window.removeEventListener('krishisetu-session-expired',expired)},[]);
  useEffect(()=>{if(session?.access)api.get('auth/me/').then(r=>setUser(r.data)).catch(()=>{});},[]);

  const role = session?.user?.role || null;
  const nav = getRoleNav(role, t, lang);
  const roleBadgeLabel = role ? role.charAt(0) + role.slice(1).toLowerCase() : null;

  return <div className="site"><header className="site-header"><div className="container nav"><Link to={getRoleHomePath(role)} className="brand"><span className="brand-mark"><Sprout size={23}/></span><span>KrishiSetu<small>कृषिसेतु</small></span></Link><button className="menu-toggle" onClick={()=>setOpen(!open)} aria-label="Toggle navigation"><Menu/></button><nav className={open?'nav-links open':'nav-links'} aria-label="Primary">{nav.map(([url,label])=><NavLink key={url} to={url} onClick={()=>setOpen(false)} end={url==='/'||url==='/farmer'||url==='/buyer'||url==='/transport'} className={({isActive})=>{
    const [basePath, queryStr] = url.split('?');
    if (queryStr) {
      return (location.pathname + location.search === url) ? 'active' : '';
    }
    if (url === '/transport' && location.pathname === '/transport' && location.search.includes('tab=')) {
      return location.search === '?tab=overview' ? 'active' : '';
    }
    return isActive ? 'active' : '';
  }}>{label}</NavLink>)}</nav><div className="nav-right">{!session && <button type="button" className="sih-demo-pill" onClick={()=>setShowDemoModal(true)} title="Platform Walkthrough"><Sparkles size={13}/> {t.sihWalkthrough||'Platform Guide'}</button>}<select aria-label="Language" value={lang} onChange={e=>{setLang(e.target.value);localStorage.setItem('krishisetu_lang',e.target.value)}}><option value="en">EN</option><option value="hi">हिंदी</option><option value="pa">ਪੰਜਾਬੀ</option></select>{session?<><span className={`nav-role-badge role-${role?.toLowerCase()}`}>{roleBadgeLabel}</span><Link className="account-link" to="/account"><User size={16}/>{session.user?.first_name||t.account}</Link><button className="icon-btn" title={t.signOut||"Sign out"} aria-label={t.signOut||"Sign out"} onClick={logout} disabled={loggingOut}>{loggingOut?<RefreshCw size={16} className="spinning"/>:<LogOut size={18}/>}</button></>:<Link to="/login" className="button primary small">{t.signIn}</Link>}</div></div></header><DemoWalkthroughModal isOpen={showDemoModal} onClose={()=>setShowDemoModal(false)} t={t} lang={lang}/><Routes>
        <Route path="/" element={<Home t={t} session={session} lang={lang}/>}/>
        <Route path="/prices" element={<Prices t={t} lang={lang} session={session}/>}/>
        <Route path="/calculator" element={<CalculatorPage t={t} lang={lang} session={session}/>}/>
        <Route path="/compare" element={<FindBestMarket session={session} t={t} lang={lang}/>}/>
        <Route path="/listings" element={<Listings session={session} t={t} lang={lang}/>}/>
        <Route path="/farmer" element={
          <RoleGuard session={session} allowedRoles={['FARMER']} onLogin={login} t={t} lang={lang}>
            <FarmerWorkspace session={session} t={t} lang={lang}/>
          </RoleGuard>
        }/>
        <Route path="/buyer" element={
          <RoleGuard session={session} allowedRoles={['BUYER']} onLogin={login} t={t} lang={lang}>
            <BuyerWorkspace session={session} t={t} lang={lang}/>
          </RoleGuard>
        }/>
        <Route path="/login" element={<Auth mode="login" onLogin={login} t={t} lang={lang}/>}/>
        <Route path="/register" element={<Auth mode="register" onLogin={login} t={t} lang={lang}/>}/>
        <Route path="/verify-email" element={<VerifyEmail session={session} setUser={setUser}/>}/>
        <Route path="/forgot-password" element={<Password/>}/>
        <Route path="/reset-password" element={<Password reset/>}/>
        <Route path="/account" element={session?<Account session={session} setUser={setUser} t={t} lang={lang}/>:<Auth mode="login" onLogin={login} t={t} lang={lang}/>}/>
        <Route path="/transport" element={
          session?.user?.role==='TRANSPORTER' ? (
            <TransporterWorkspace session={session} t={t} lang={lang}/>
          ) : !session ? (
            <Page title={lang === 'hi' ? 'परिवहन लॉजिस्टिक्स नेटवर्क' : lang === 'pa' ? 'ਟਰਾਂਸਪੋਰਟ ਨੈੱਟਵਰਕ' : 'Transporter Logistics Network'} desc={lang === 'hi' ? 'खेत से मंडी तक माल ढुलाई मांग से जुड़ें।' : lang === 'pa' ? 'ਖੇਤ ਤੋਂ ਮੰਡੀ ਢੋਆ-ਢੁਆਈ ਮੰਗ ਨਾਲ ਜੁੜੋ।' : 'Commercial transport operators, fleet owners, and drivers connect with farmgate-to-market shipping demand.'}>
              <div className="auth-card" style={{maxWidth:'580px',margin:'0 auto',textAlign:'center'}}>
                <div style={{width:'64px',height:'64px',borderRadius:'50%',background:'#fef3c7',color:'#d97706',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px'}}>
                  <Truck size={32}/>
                </div>
                <h2 style={{fontSize:'1.5rem',marginBottom:'10px',color:'var(--c-forest-900)'}}>{lang === 'hi' ? 'ट्रांसपोर्टर खाता आवश्यक' : lang === 'pa' ? 'ਟਰਾਂਸਪੋਰਟਰ ਖਾਤਾ ਲੋੜੀਂਦਾ' : 'Transporter Account Required'}</h2>
                <p style={{color:'var(--c-text-muted)',marginBottom:'24px',lineHeight:1.6}}>
                  {lang === 'hi'
                    ? 'वाणिज्यिक वाहनों का पंजीकरण, सक्रिय भाड़ा अनुरोध देखने और माइलस्टोन ट्रैकिंग के लिए कृपया ट्रांसपोर्टर खाते से लॉग इन करें।'
                    : lang === 'pa'
                    ? 'ਵਪਾਰਕ ਗੱਡੀਆਂ ਰਜਿਸਟਰ ਕਰਨ ਅਤੇ ਭਾੜਾ ਪ੍ਰਸਤਾਵ ਭੇਜਣ ਲਈ ਕਿਰਪਾ ਕਰਕੇ ਟਰਾਂਸਪੋਰਟਰ ਖਾਤੇ ਨਾਲ ਲਾਗਇਨ ਕਰੋ।'
                    : 'To register commercial vehicles (pickups, tractors, heavy trucks), view active freight requests, submit shipping quotes, and record milestone tracking, please sign in with your transporter account or register below.'}
                </p>
                <div style={{display:'flex',gap:'12px',justifyContent:'center',flexWrap:'wrap'}}>
                  <Link to="/register?role=TRANSPORTER&return_to=/transport" className="button primary">{lang === 'hi' ? 'ट्रांसपोर्टर के रूप में पंजीकरण करें' : lang === 'pa' ? 'ਟਰਾਂਸਪੋਰਟਰ ਵਜੋਂ ਰਜਿਸਟਰ ਕਰੋ' : 'Register as Transporter'}</Link>
                  <Link to="/login?role=TRANSPORTER&return_to=/transport" className="button subtle">{lang === 'hi' ? 'ट्रांसपोर्टर लॉग इन' : lang === 'pa' ? 'ਟਰਾਂਸਪੋਰਟਰ ਲਾਗਇਨ' : 'Sign In as Transporter'}</Link>
                </div>
              </div>
            </Page>
          ) : (
            <RoleGuard session={session} allowedRoles={['TRANSPORTER']} title="Transporter Logistics Only" onLogin={login} t={t} lang={lang} />
          )
        }/>
        <Route path="/admin" element={
          <RoleGuard session={session} allowedRoles={['ADMIN']} title="Administrator Review Queue" onLogin={login} t={t} lang={lang}>
            <Page title="Administrator review"><AdminReview/></Page>
          </RoleGuard>
        }/>
        <Route path="/institution" element={
          <RoleGuard session={session} allowedRoles={['ADMIN','INSTITUTION']} title="Institutional Analytics" onLogin={login} t={t} lang={lang}>
            <Institution/>
          </RoleGuard>
        }/>
        <Route path="*" element={<Page title={lang === 'hi' ? 'पृष्ठ नहीं मिला' : lang === 'pa' ? 'ਪੰਨਾ ਨਹੀਂ ਮਿਲਿਆ' : 'Page not found'}><Link to={getRoleHomePath(role)}>{t.home || 'Return home'}</Link></Page>}/>
      </Routes>
      {!isAuthPage && <footer>
        <div className="container footer-inner" style={{flexDirection:'column',alignItems:'flex-start',gap:'28px',paddingTop:'45px',paddingBottom:'35px'}}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))',gap:'36px',width:'100%'}}>
            <div>
              <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'12px'}}>
                <span className="brand-mark" style={{background:'#165839',color:'#84e1ad',padding:'8px'}}><Sprout size={20}/></span>
                <span style={{fontFamily:'var(--font-heading)',fontWeight:800,fontSize:'1.3rem',color:'#ffffff'}}>KrishiSetu <small style={{fontSize:'0.75rem',color:'#84e1ad'}}>कृषिसेतु</small></span>
              </div>
              <p style={{fontSize:'0.86rem',color:'#b2d4c1',lineHeight:1.6,margin:'0 0 10px'}}>
                {t.footerMission || 'Smart India Hackathon (SIH26132) — Strengthening agricultural market linkages and price discovery for Indian farmers.'}
              </p>
              <div style={{display:'inline-flex',gap:'6px',fontSize:'0.75rem',background:'rgba(255,255,255,0.08)',padding:'4px 10px',borderRadius:'9999px',color:'#a5d9be'}}>
                <span>{t.footerStats || '249 Crops · 107 APMC Mandis · Zero Brokerage'}</span>
              </div>
            </div>

            <div>
              <b style={{display:'block',color:'#ffffff',fontSize:'0.95rem',marginBottom:'14px',textTransform:'uppercase',letterSpacing:'0.05em'}}>{t.footerColIntelligence || 'Market Intelligence'}</b>
              <div style={{display:'flex',flexDirection:'column',gap:'8px',fontSize:'0.86rem'}}>
                <Link to="/prices" style={{color:'#b2d4c1'}}>{t.markets || 'Agmarknet Live Mandi Prices'}</Link>
                <Link to="/calculator" style={{color:'#b2d4c1'}}>{t.netCalculator || 'Net Realized Price Calculator'}</Link>
                <Link to="/compare" style={{color:'#b2d4c1'}}>{t.findBestMarket || 'Compare Selling Destinations'}</Link>
              </div>
            </div>

            <div>
              <b style={{display:'block',color:'#ffffff',fontSize:'0.95rem',marginBottom:'14px',textTransform:'uppercase',letterSpacing:'0.05em'}}>{t.footerColTrading || 'Direct Trading & Logistics'}</b>
              <div style={{display:'flex',flexDirection:'column',gap:'8px',fontSize:'0.86rem'}}>
                <Link to="/listings" style={{color:'#b2d4c1'}}>{t.marketplace || 'Farmer–Buyer Marketplace'}</Link>
                <Link to="/transport" style={{color:'#b2d4c1'}}>{t.transport || 'Transporter Freight Quotations'}</Link>
                <Link to="/account" style={{color:'#b2d4c1'}}>{t.account || 'My Account & Orders Workflow'}</Link>
              </div>
            </div>

            <div>
              <b style={{display:'block',color:'#ffffff',fontSize:'0.95rem',marginBottom:'14px',textTransform:'uppercase',letterSpacing:'0.05em'}}>{t.footerColSecurity || 'Security & Transparency'}</b>
              <p style={{fontSize:'0.82rem',color:'#9bbda9',lineHeight:1.55,margin:0}}>
                {t.footerSecurityDesc || 'Source-backed market intelligence derived from Government of India OGD Agmarknet data. Trading declarations and delivery acceptances are auditable platform records.'}
              </p>
            </div>
          </div>

          <div style={{width:'100%',borderTop:'1px solid rgba(255,255,255,0.12)',paddingTop:'20px',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:'12px',fontSize:'0.8rem',color:'#84aa94'}}>
            <span>{t.footerCopyright || '© 2026 KrishiSetu (कृषिसेतु). Built for Smart India Hackathon.'}</span>
            <span>{t.footerDisclaimer || 'Independent Agritech Platform · No Government Endorsement Claimed'}</span>
          </div>
        </div>
      </footer>}</div>}
export default App;
