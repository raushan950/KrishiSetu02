import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Sparkles,
  X,
  CheckCircle2,
  Scale,
  Landmark,
  Store,
  Truck,
  ShieldCheck,
  ArrowRight,
  UserCheck,
  Coins,
  FileCheck2,
  ExternalLink
} from 'lucide-react';
import { getTranslation } from './i18n.js';

export function DemoWalkthroughModal({ isOpen, onClose, onQuickLogin, t: propT, lang: propLang }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('workflow');

  const lang = propLang || localStorage.getItem('krishisetu_lang') || 'en';
  const t = propT || getTranslation(lang);

  if (!isOpen) return null;

  return (
    <div className="sih-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="sih-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sih-modal-head">
          <div className="sih-modal-title-group">
            <span className="sih-badge-pill">
              <Sparkles size={13} /> {t.sihTag || 'SMART INDIA HACKATHON · SIH26132'}
            </span>
            <h2>{t.walkthroughTitle || 'KrishiSetu (कृषिसेतु) — Platform Demonstration Guide'}</h2>
            <p className="sih-sub">
              {t.walkthroughSub || 'Strengthening Market Linkages and Price Discovery for Farmers · Complete Architectural Walkthrough'}
            </p>
          </div>
          <button type="button" className="sih-close-btn" onClick={onClose} aria-label={t.closeGuide || 'Close Guide'}>
            <X size={20} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="sih-modal-tabs">
          <button
            type="button"
            className={`sih-tab-btn ${activeTab === 'workflow' ? 'active' : ''}`}
            onClick={() => setActiveTab('workflow')}
          >
            {t.tabWorkflow || '1. Core 8-Stage Workflow'}
          </button>
          <button
            type="button"
            className={`sih-tab-btn ${activeTab === 'flagship' ? 'active' : ''}`}
            onClick={() => setActiveTab('flagship')}
          >
            {t.tabFlagship || '2. Flagship: Find My Best Market'}
          </button>
          <button
            type="button"
            className={`sih-tab-btn ${activeTab === 'personas' ? 'active' : ''}`}
            onClick={() => setActiveTab('personas')}
          >
            {t.tabPersonas || '3. Stakeholder Demo Personas'}
          </button>
          <button
            type="button"
            className={`sih-tab-btn ${activeTab === 'architecture' ? 'active' : ''}`}
            onClick={() => setActiveTab('architecture')}
          >
            {t.tabArch || '4. Architecture & Compliance'}
          </button>
        </div>

        {/* Modal Body */}
        <div className="sih-modal-body">
          {/* TAB 1: Core 8-Stage Workflow */}
          {activeTab === 'workflow' && (
            <div className="sih-workflow-journey">
              <div className="sih-journey-step">
                <div className="sih-step-circle">1</div>
                <div className="sih-step-content">
                  <h4>
                    {lang === 'hi' ? 'किसान खेत प्रोफ़ाइल एवं उपज दर्ज करता है' : lang === 'pa' ? 'ਕਿਸਾਨ ਖੇਤ ਪ੍ਰੋਫਾਈਲ ਅਤੇ ਫ਼ਸਲ ਦਰਜ ਕਰਦਾ ਹੈ' : 'Farmer Records Farm Profile & Harvest'}
                  </h4>
                  <p>
                    {lang === 'hi'
                      ? 'किसान अपनी प्रमाणित भूमि, फसल की किस्म और अनुमानित उत्पादन रकबा सीधे खेत पर बिना बिचौलिये के दर्ज करते हैं।'
                      : lang === 'pa'
                      ? 'ਕਿਸਾਨ ਆਪਣੀ ਜ਼ਮੀਨ, ਫ਼ਸਲ ਦੀ ਕਿਸਮ ਅਤੇ ਉਤਪਾਦਨ ਰਕਬਾ ਬਿਨਾਂ ਵਿਚੋਲੇ ਦੇ ਸਿੱਧੇ ਖੇਤ ਪੱਧਰ ਤੇ ਦਰਜ ਕਰਦੇ ਹਨ।'
                      : 'Farmer records verified land, crop variety, and estimated harvest acreage directly at the farmgate.'}
                  </p>
                </div>
              </div>

              <div className="sih-journey-step">
                <div className="sih-step-circle">2</div>
                <div className="sih-step-content">
                  <h4>
                    {lang === 'hi' ? 'सत्यापित मंडी भाव आसूचना' : lang === 'pa' ? 'ਪ੍ਰਮਾਣਿਤ ਮੰਡੀ ਭਾਅ ਸੂਚਨਾ' : 'Mandi Price Intelligence'}
                  </h4>
                  <p>
                    {lang === 'hi'
                      ? '107 एपीएमसी मंडियों के लाइव एगमार्कनेट आवक आंकड़े क्षेत्रीय बेंचमार्क मॉडल भाव स्थापित करते हैं।'
                      : lang === 'pa'
                      ? '107 ਏਪੀਐਮਸੀ ਮੰਡੀਆਂ ਤੋਂ ਲਾਈਵ ਐਗਮਾਰਕਨੈੱਟ ਆਮਦ ਅੰਕੜੇ ਖੇਤਰੀ ਮਾਡਲ ਭਾਅ ਤੈਅ ਕਰਦੇ ਹਨ।'
                      : 'Live Agmarknet arrivals across 107 APMC mandis establish regional modal benchmark prices.'}
                  </p>
                </div>
              </div>

              <div className="sih-journey-step">
                <div className="sih-step-circle">3</div>
                <div className="sih-step-content">
                  <h4>
                    {lang === 'hi' ? '"सर्वोत्तम मंडी खोज" शुद्ध लाभ निर्णय' : lang === 'pa' ? '"ਸਭ ਤੋਂ ਵਧੀਆ ਮੰਡੀ" ਸ਼ੁੱਧ ਮੁਨਾਫ਼ਾ ਫ਼ੈਸਲਾ' : '"Find My Best Market" Net Return Decision'}
                  </h4>
                  <p>
                    {lang === 'hi'
                      ? 'सटीक दशमलव अंकगणित वास्तविक परिवहन भाड़ा, लोडिंग, मंडी सेस और नमी नुकसान घटाकर अधिकतम असली कमाई बताता है।'
                      : lang === 'pa'
                      ? 'ਸਟੀਕ ਗਣਿਤ ਨਾਲ ਭਾੜਾ, ਲਦਾਈ, ਮੰਡੀ ਫੀਸ ਅਤੇ ਫਸਲੀ ਨੁਕਸਾਨ ਘਟਾ ਕੇ ਅਸਲ ਵੱਧ ਕਮਾਈ ਦਰਸਾਉਂਦਾ ਹੈ।'
                      : 'Exact Decimal arithmetic subtracts real transport freight, loading, APMC cess, and moisture loss to reveal highest true earnings.'}
                  </p>
                </div>
              </div>

              <div className="sih-journey-step">
                <div className="sih-step-circle">4</div>
                <div className="sih-step-content">
                  <h4>
                    {lang === 'hi' ? 'सीधे कृषि बाज़ार में फसल सूची' : lang === 'pa' ? 'ਸਿੱਧੇ ਖੇਤੀ ਬਾਜ਼ਾਰ ਵਿੱਚ ਫ਼ਸਲ ਸੂਚੀ' : 'Direct Produce Marketplace Listing'}
                  </h4>
                  <p>
                    {lang === 'hi'
                      ? 'किसान मांग भाव, तस्वीर और मात्रा के साथ उच्च गुणवत्ता वाली फसल सीधे थोक खरीदारों के समक्ष पेश करते हैं।'
                      : lang === 'pa'
                      ? 'ਕਿਸਾਨ ਮੰਗਿਆ ਭਾਅ, ਫੋਟੋ ਅਤੇ ਮਾਤਰਾ ਨਾਲ ਆਪਣੀ ਫ਼ਸਲ ਸਿੱਧੀ ਵੱਡੇ ਵਪਾਰੀਆਂ ਸਾਹਮਣੇ ਪੇਸ਼ ਕਰਦੇ ਹਨ।'
                      : 'Farmer publishes high-grade produce with asking price, photos, and quantity directly to commercial buyers.'}
                  </p>
                </div>
              </div>

              <div className="sih-journey-step">
                <div className="sih-step-circle">5</div>
                <div className="sih-step-content">
                  <h4>
                    {lang === 'hi' ? 'खरीदार प्रस्ताव एवं पारदर्शी मोलभाव' : lang === 'pa' ? 'ਖਰੀਦਦਾਰ ਪ੍ਰਸਤਾਵ ਤੇ ਪਾਰਦਰਸ਼ੀ ਸੌਦੇਬਾਜ਼ੀ' : 'Buyer Offer & Transparent Negotiation'}
                  </h4>
                  <p>
                    {lang === 'hi'
                      ? 'प्रमाणित वाणिज्यिक खरीदार खरीद प्रस्ताव देते हैं; किसान वास्तविक समय में स्वीकार, अस्वीकार या जवाबी बोली लगा सकते हैं।'
                      : lang === 'pa'
                      ? 'ਪ੍ਰਮਾਣਿਤ ਵਪਾਰੀ ਖਰੀਦ ਪ੍ਰਸਤਾਵ ਦਿੰਦੇ ਹਨ; ਕਿਸਾਨ ਤੁਰੰਤ ਮਨਜ਼ੂਰ, ਰੱਦ ਜਾਂ ਜਵਾਬੀ ਬੋਲੀ ਦੇ ਸਕਦੇ ਹਨ।'
                      : 'Verified commercial buyers place purchase offers; farmers can accept, counteroffer, or decline in real time.'}
                  </p>
                </div>
              </div>

              <div className="sih-journey-step">
                <div className="sih-step-circle">6</div>
                <div className="sih-step-content">
                  <h4>
                    {lang === 'hi' ? 'पुष्ट आदेश एवं डाटाबेस इन्वेंट्री लॉक' : lang === 'pa' ? 'ਪੱਕਾ ਆਰਡਰ ਅਤੇ ਸਟਾਕ ਲਾਕ' : 'Confirmed Order & Atomic Inventory Lock'}
                  </h4>
                  <p>
                    {lang === 'hi'
                      ? 'सौदे की स्वीकृति पर पोस्टग्रेएसक्यूएल रो-लॉकिंग द्वारा स्टॉक तुरंत आरक्षित हो जाता है, जिससे दोबारा बिक्री की संभावना खत्म हो जाती है।'
                      : lang === 'pa'
                      ? 'ਸੌਦਾ ਮਨਜ਼ੂਰ ਹੁੰਦਿਆਂ ਹੀ ਡਾਟਾਬੇਸ ਵਿੱਚ ਸਟਾਕ ਲਾਕ ਹੋ ਜਾਂਦਾ ਹੈ ਤਾਂ ਜੋ ਦੋਹਰੀ ਵਿਕਰੀ ਦੀ ਕੋਈ ਗੁੰਜਾਇਸ਼ ਨਾ ਰਹੇ।'
                      : 'Agreement atomically reserves inventory via database row-locking, preventing overselling or phantom stock.'}
                  </p>
                </div>
              </div>

              <div className="sih-journey-step">
                <div className="sih-step-circle">7</div>
                <div className="sih-step-content">
                  <h4>
                    {lang === 'hi' ? 'ट्रांसपोर्टर भाड़ा बोली एवं माइलस्टोन ट्रैकिंग' : lang === 'pa' ? 'ਟਰਾਂਸਪੋਰਟਰ ਭਾੜਾ ਬੋਲੀ ਤੇ ਟਰੈਕਿੰਗ' : 'Transporter Freight Bidding & Milestones'}
                  </h4>
                  <p>
                    {lang === 'hi'
                      ? 'लॉजिस्टिक्स ऑपरेटर दूरी आधारित प्रतिस्पर्धी भाड़ा बोली लगाते हैं और समयबद्ध डिलीवरी माइलस्टोन (रवाना, रास्ते में, सुपुرد) दर्ज करते हैं।'
                      : lang === 'pa'
                      ? 'ਟਰਾਂਸਪੋਰਟ ਆਪਰੇਟਰ ਪ੍ਰਤੀਯੋਗੀ ਭਾੜਾ ਦਰਾਂ ਪੇਸ਼ ਕਰਦੇ ਹਨ ਅਤੇ ਸਮਾਂਬੱਧ ਡਿਲੀਵਰੀ ਪੜਾਅ ਦਰਜ ਕਰਦੇ ਹਨ।'
                      : 'Logistics operators bid competitive distance-based rates; carriers record timestamped transit milestones (Dispatched, In-Transit, Delivered).'}
                  </p>
                </div>
              </div>

              <div className="sih-journey-step">
                <div className="sih-step-circle">8</div>
                <div className="sih-step-content">
                  <h4>
                    {lang === 'hi' ? 'निरीक्षण, डिलीवरी एवं निपटान ऑडिट' : lang === 'pa' ? 'ਜਾਂਚ, ਡਿਲੀਵਰੀ ਅਤੇ ਨਿਪਟਾਰਾ ਆਡਿਟ' : 'Inspection, Delivery & Settlement Reconciliation'}
                  </h4>
                  <p>
                    {lang === 'hi'
                      ? 'खरीदार भौतिक निरीक्षण की पुष्टि करता है; डिजिटल निपटान रिकॉर्ड एक अपरिवर्तनीय ऑडिट ट्रेल प्रदान करते हैं।'
                      : lang === 'pa'
                      ? 'ਖਰੀਦਦਾਰ ਮਾਲ ਦੀ ਜਾਂਚ ਦੀ ਪੁਸ਼ਟੀ ਕਰਦਾ ਹੈ; ਡਿਜੀਟਲ ਨਿਪਟਾਰਾ ਰਿਕਾਰਡ ਪੂਰਾ ਪਾਰਦਰਸ਼ੀ ਆਡਿਟ ਰਿਕਾਰਡ ਦਿੰਦੇ ਹਨ।'
                      : 'Buyer confirms physical inspection; digital settlement records provide an unalterable audit trail.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Flagship Feature */}
          {activeTab === 'flagship' && (
            <div className="sih-flagship-card">
              <div className="sih-flagship-hero">
                <Scale size={32} className="text-primary" />
                <div>
                  <h3>
                    {lang === 'hi'
                      ? '"मेरी सर्वोत्तम मंडी" (सर्वोत्तम मंडी एवं शुद्ध लाभ खोजक)'
                      : lang === 'pa'
                      ? '"ਮੇਰੀ ਸਭ ਤੋਂ ਵਧੀਆ ਮੰਡੀ" (ਸਭ ਤੋਂ ਵਧੀਆ ਮੰਡੀ ਅਤੇ ਸ਼ੁੱਧ ਮੁਨਾਫ਼ਾ ਖੋਜੀ)'
                      : '"Find My Best Market" (Net Return & Decision Navigator)'}
                  </h3>
                  <p>
                    {lang === 'hi'
                      ? 'कृषिसेतु का प्रमुख निर्णय इंजन भारतीय कृषि विपणन की सबसे बड़ी समस्या का समाधान करता है: केवल ऊँचा नाममात्र भाव भ्रामक होता है।'
                      : lang === 'pa'
                      ? 'ਕ੍ਰਿਸ਼ੀਸੇਤੂ ਦਾ ਮੁੱਖ ਫ਼ੈਸਲਾ ਇੰਜਣ ਖੇਤੀ ਵਪਾਰ ਦੀ ਵੱਡੀ ਕਮੀ ਨੂੰ ਦੂਰ ਕਰਦਾ ਹੈ: ਉੱਚਾ ਕਾਗਜ਼ੀ ਭਾਅ ਅਕਸਰ ਧੋਖਾ ਹੁੰਦਾ ਹੈ।'
                      : "KrishiSetu's signature decision engine addresses the core flaw in Indian agricultural marketing: nominal selling prices are misleading."}
                  </p>
                </div>
              </div>

              <div className="sih-flagship-example">
                <h4>
                  {lang === 'hi' ? 'तुलनात्मक आर्थिक विश्लेषण उदाहरण:' : lang === 'pa' ? 'ਤੁਲਨਾਤਮਕ ਆਰਥਿਕ ਵਿਸ਼ਲੇਸ਼ਣ ਉਦਾਹਰਨ:' : 'Empirical Comparison Example:'}
                </h4>
                <div className="sih-example-grid">
                  <div className="sih-ex-box mandi-a">
                    <span className="ex-title">
                      {lang === 'hi' ? 'मंडी A (सरहिंद एपीएमसी · 18 किमी)' : lang === 'pa' ? 'ਮੰਡੀ A (ਸਰਹਿੰਦ ਏਪੀਐਮਸੀ · 18 ਕਿ.ਮੀ)' : 'Mandi A (Sirhind APMC · 18 km)'}
                    </span>
                    <div className="ex-line"><span>{lang === 'hi' ? 'मॉडल भाव:' : lang === 'pa' ? 'ਮਾਡਲ ਭਾਅ:' : 'Benchmark Price:'}</span> <b>₹2,420 / qtl</b></div>
                    <div className="ex-line"><span>{lang === 'hi' ? 'सकल आय (50 क्विंटल):' : lang === 'pa' ? 'ਕੁੱਲ ਆਮਦਨ (50 ਕੁਇੰਟਲ):' : 'Gross (50 qtl):'}</span> <b>₹1,21,000</b></div>
                    <div className="ex-line text-danger"><span>{lang === 'hi' ? 'ढुलाई भाड़ा:' : lang === 'pa' ? 'ਢੋਆ-ਢੁਆਈ ਭਾੜਾ:' : 'Transport Freight:'}</span> <b>−₹1,260</b></div>
                    <div className="ex-line text-danger"><span>{lang === 'hi' ? 'मंडी शुल्क व पल्लेदारी:' : lang === 'pa' ? 'ਮੰਡੀ ਫੀਸ ਤੇ ਮਜ਼ਦੂਰੀ:' : 'APMC Fees & Labour:'}</span> <b>−₹1,815</b></div>
                    <div className="ex-net text-success"><span>{lang === 'hi' ? 'जेब में शुद्ध आय:' : lang === 'pa' ? 'ਅਸਲ ਸ਼ੁੱਧ ਕਮਾਈ:' : 'Net Cash Realized:'}</span> <b>₹1,17,925</b></div>
                  </div>

                  <div className="sih-ex-box mandi-b winner-box">
                    <span className="ex-title">
                      {lang === 'hi' ? '★ मंडी B (खन्ना एपीएमसी · 42 किमी) — #1 विजेता' : lang === 'pa' ? '★ ਮੰਡੀ B (ਖੰਨਾ ਏਪੀਐਮਸੀ · 42 ਕਿ.ਮੀ) — #1 ਜੇਤੂ' : '★ Mandi B (Khanna APMC · 42 km) — WINNER'}
                    </span>
                    <div className="ex-line"><span>{lang === 'hi' ? 'मॉडल भाव:' : lang === 'pa' ? 'ਮਾਡਲ ਭਾਅ:' : 'Benchmark Price:'}</span> <b>₹2,540 / qtl</b> (+₹120)</div>
                    <div className="ex-line"><span>{lang === 'hi' ? 'सकल आय (50 क्विंटल):' : lang === 'pa' ? 'ਕੁੱਲ ਆਮਦਨ (50 ਕੁਇੰਟਲ):' : 'Gross (50 qtl):'}</span> <b>₹1,27,000</b> (+₹6,000)</div>
                    <div className="ex-line text-danger"><span>{lang === 'hi' ? 'ढुलाई भाड़ा:' : lang === 'pa' ? 'ਢੋਆ-ਢੁਆਈ ਭਾੜਾ:' : 'Transport Freight:'}</span> <b>−₹2,940</b> (+₹1,680)</div>
                    <div className="ex-line text-danger"><span>{lang === 'hi' ? 'मंडी शुल्क व पल्लेदारी:' : lang === 'pa' ? 'ਮੰਡੀ ਫੀਸ ਤੇ ਮਜ਼ਦੂਰੀ:' : 'APMC Fees & Labour:'}</span> <b>−₹1,905</b></div>
                    <div className="ex-net text-success"><span>{lang === 'hi' ? 'जेब में शुद्ध आय:' : lang === 'pa' ? 'ਅਸਲ ਸ਼ੁੱਧ ਕਮਾਈ:' : 'Net Cash Realized:'}</span> <b>₹1,22,155 (+₹4,230)</b></div>
                  </div>
                </div>

                <div className="sih-ex-insight">
                  <b>{lang === 'hi' ? 'आर्थिक निष्कर्ष:' : lang === 'pa' ? 'ਆਰਥਿਕ ਸਿੱਟਾ:' : 'Economic Takeaway:'}</b>{' '}
                  {lang === 'hi'
                    ? 'यद्यपि खन्ना मंडी 24 किमी अधिक दूर है, फिर भी इसका ऊँचा भाव ₹6,000 का अतिरिक्त राजस्व देता है जबकि अतिरिक्त भाड़ा केवल ₹1,680 है — जिससे किसान की जेब में +₹4,230 अधिक नकद लाभ आता है!'
                    : lang === 'pa'
                    ? 'ਭਾਵੇਂ ਖੰਨਾ ਮੰਡੀ 24 ਕਿ.ਮੀ ਵੱਧ ਦੂਰ ਹੈ, ਪਰ ਇਸਦਾ ਵੱਧ ਭਾਅ ₹6,000 ਵਾਧੂ ਦਿੰਦਾ ਹੈ ਜਦਕਿ ਵਾਧੂ ਭਾੜਾ ਸਿਰਫ਼ ₹1,680 ਹੈ — ਜਿਸ ਨਾਲ ਕਿਸਾਨ ਨੂੰ +₹4,230 ਵੱਧ ਸ਼ੁੱਧ ਕਮਾਈ ਮਿਲਦੀ ਹੈ!'
                    : 'Although Khanna is 24 km farther, its price premium generates ₹6,000 extra revenue against only ₹1,680 additional freight, putting +₹4,230 more cash into the farmer’s pocket!'}
                </div>
              </div>

              <div className="sih-flagship-cta">
                <button
                  type="button"
                  className="button primary"
                  onClick={() => {
                    onClose();
                    navigate('/compare');
                  }}
                >
                  {lang === 'hi' ? '"सर्वोत्तम मंडी खोज" इंजन खोलें →' : lang === 'pa' ? '"ਸਭ ਤੋਂ ਵਧੀਆ ਮੰਡੀ" ਇੰਜਣ ਖੋਲ੍ਹੋ →' : 'Launch "Find My Best Market" Decision Engine →'}
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: Personas & Instant Navigation */}
          {activeTab === 'personas' && (
            <div className="sih-personas-list">
              <div className="sih-persona-item">
                <div className="sih-persona-icon farmer-bg">
                  <UserCheck size={22} />
                </div>
                <div className="sih-persona-info">
                  <h4>{lang === 'hi' ? 'किसान राम (किसान · Agricultural Producer)' : lang === 'pa' ? 'ਕਿਸਾਨ ਰਾਮ (ਕਿਸਾਨ · Farmer)' : 'Kisan Ram (Farmer · किसान)'}</h4>
                  <p>
                    {lang === 'hi'
                      ? 'पंजाब में खेत प्रबंधन, गेहूँ व सरसों की फसल सूचीबद्ध करना, खरीदार बोलियों की समीक्षा और शुद्ध मुनाफा गणना।'
                      : lang === 'pa'
                      ? 'ਪੰਜਾਬ ਵਿੱਚ ਖੇਤ ਪ੍ਰਬੰਧਨ, ਕਣਕ ਤੇ ਸਰ੍ਹੋਂ ਦੀ ਫ਼ਸਲ ਦਰਜ ਕਰਨਾ, ਵਪਾਰੀਆਂ ਦੇ ਸੌਦਿਆਂ ਦੀ ਸਮੀਖਿਆ ਅਤੇ ਸ਼ੁੱਧ ਕਮਾਈ ਹਿਸਾਬ।'
                      : 'Manages farms in Punjab, creates wheat & mustard listings, reviews buyer bids, and calculates net return.'}
                  </p>
                  <small className="muted">Email: kisan.ram@krishisetu.in · Role: FARMER</small>
                </div>
                <button
                  type="button"
                  className="button subtle small"
                  onClick={() => {
                    onClose();
                    navigate('/listings');
                  }}
                >
                  {lang === 'hi' ? 'किसान टूल देखें' : lang === 'pa' ? 'ਕਿਸਾਨ ਟੂਲ ਵੇਖੋ' : 'Explore Farmer Tools'}
                </button>
              </div>

              <div className="sih-persona-item">
                <div className="sih-persona-icon buyer-bg">
                  <Store size={22} />
                </div>
                <div className="sih-persona-info">
                  <h4>{lang === 'hi' ? 'एग्रोप्रोक्योर इंडिया (थोक खरीदार · Commercial Buyer)' : lang === 'pa' ? 'ਐਗਰੋਪ੍ਰੋਕਿਓਰ ਇੰਡੀਆ (ਵਪਾਰੀ · Commodity Buyer)' : 'AgroProcure India (Commercial Commodity Buyer · व्यापारी)'}</h4>
                  <p>
                    {lang === 'hi'
                      ? 'खेत से सीधे उच्च गुणवत्ता वाली फसलें खरीदना, खरीद प्रस्ताव प्रस्तुत करना और बिना आढ़त के सीधा व्यापार करना।'
                      : lang === 'pa'
                      ? 'ਖੇਤ ਤੋਂ ਸਿੱਧੀਆਂ ਫ਼ਸਲਾਂ ਖਰੀਦਣਾ, ਖਰੀਦ ਪ੍ਰਸਤਾਵ ਭੇਜਣਾ ਅਤੇ ਬਿਨਾਂ ਕਮੀਸ਼ਨ ਦੇ ਸਿੱਧਾ ਵਪਾਰ ਕਰਨਾ।'
                      : 'Sources farmgate commodities directly, submits purchase offers, and negotiates terms without commission agents.'}
                  </p>
                  <small className="muted">Email: buyer@krishisetu.in · Role: BUYER</small>
                </div>
                <button
                  type="button"
                  className="button subtle small"
                  onClick={() => {
                    onClose();
                    navigate('/listings');
                  }}
                >
                  {lang === 'hi' ? 'खरीदार टूल देखें' : lang === 'pa' ? 'ਖਰੀਦਦਾਰ ਟੂਲ ਵੇਖੋ' : 'Explore Buyer Tools'}
                </button>
              </div>

              <div className="sih-persona-item">
                <div className="sih-persona-icon transporter-bg">
                  <Truck size={22} />
                </div>
                <div className="sih-persona-info">
                  <h4>{lang === 'hi' ? 'पंजाब फ्लीट लॉजिस्टिक्स (परिवहन ऑपरेटर · Commercial Carrier)' : lang === 'pa' ? 'ਪੰਜਾਬ ਫਲੀਟ ਲੌਜਿਸਟਿਕਸ (ਟਰਾਂਸਪੋਰਟ ਆਪਰੇਟਰ · Commercial Carrier)' : 'Punjab Fleet Logistics (Commercial Carrier · परिवहनकर्ता)'}</h4>
                  <p>
                    {lang === 'hi'
                      ? 'वाणिज्यिक वाहनों का पंजीकरण, पुष्ट सौदों पर प्रतिस्पर्धी दूरी-आधारित भाड़ा उद्धरण और डिजिटल डिलीवरी साक्ष्य अपलोड।'
                      : lang === 'pa'
                      ? 'ਵਪਾਰਕ ਗੱਡੀਆਂ ਦੀ ਰਜਿਸਟ੍ਰੇਸ਼ਨ, ਪੱਕੇ ਸੌਦਿਆਂ ਤੇ ਭਾੜਾ ਬੋਲੀ ਅਤੇ ਡਿਲੀਵਰੀ ਦੇ ਡਿਜੀਟਲ ਸਬੂਤ ਅਪਲੋਡ ਕਰਨਾ।'
                      : 'Registers commercial pickups and trucks, quotes distance-based freight on confirmed trades, and uploads milestone delivery proofs.'}
                  </p>
                  <small className="muted">Email: logistics@krishisetu.in · Role: TRANSPORTER</small>
                </div>
                <button
                  type="button"
                  className="button subtle small"
                  onClick={() => {
                    onClose();
                    navigate('/transport');
                  }}
                >
                  {lang === 'hi' ? 'भाड़ा टूल देखें' : lang === 'pa' ? 'ਭਾੜਾ ਟੂਲ ਵੇਖੋ' : 'Explore Freight Tools'}
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: Architecture */}
          {activeTab === 'architecture' && (
            <div className="sih-arch-grid">
              <div className="sih-arch-card">
                <ShieldCheck size={24} className="text-primary" />
                <h4>
                  {lang === 'hi' ? 'सुरक्षा एवं रो लेवल सिक्योरिटी (RLS)' : lang === 'pa' ? 'ਸੁਰੱਖਿਆ ਅਤੇ ਰੋਅ ਲੈਵਲ ਸਿਕਿਓਰਿਟੀ (RLS)' : 'Security & RLS (Row Level Security)'}
                </h4>
                <p>
                  {lang === 'hi'
                    ? 'PostgreSQL RLS सुनिश्चित करता है कि किसान केवल अपनी सूची और प्रस्तावों तक ही पहुँचें। SimpleJWT और Supabase सख्त भूमिका-आधारित पहुँच नियंत्रण लागू करते हैं।'
                    : lang === 'pa'
                    ? 'PostgreSQL RLS ਯਕੀਨੀ ਬਣਾਉਂਦਾ ਹੈ ਕਿ ਕਿਸਾਨ ਸਿਰਫ਼ ਆਪਣੇ ਸੌਦਿਆਂ ਤੱਕ ਪਹੁੰਚਣ। ਸੁਰੱਖਿਅਤ SimpleJWT ਅਤੇ Supabase ਅਧਿਕਾਰ ਪ੍ਰਬੰਧਨ ਕਰਦੇ ਹਨ।'
                    : 'PostgreSQL RLS ensures farmers only access their listings and offers. SimpleJWT & Supabase authentication enforce strict role-based access control.'}
                </p>
              </div>

              <div className="sih-arch-card">
                <FileCheck2 size={24} className="text-primary" />
                <h4>
                  {lang === 'hi' ? 'परमाणु समवर्ती एवं इन्वेंट्री लॉक' : lang === 'pa' ? 'ਸੁਰੱਖਿਅਤ ਸਟਾਕ ਲਾਕਿੰਗ' : 'Atomic Concurrency & Inventory Lock'}
                </h4>
                <p>
                  {lang === 'hi'
                    ? 'डेटाबेस रो लॉक (select_for_update) इन्वेंट्री की पूर्ण स्थिरता सुनिश्चित करते हैं, जिससे दोहरी बिक्री और रेस कंडीशन पूरी तरह समाप्त हो जाती हैं।'
                    : lang === 'pa'
                    ? 'ਡਾਟਾਬੇਸ ਰੋਅ ਲਾਕ ਸਟਾਕ ਦੀ ਪੂਰੀ ਸੁਰੱਖਿਆ ਯਕੀਨੀ ਬਣਾਉਂਦੇ ਹਨ, ਜਿਸ ਨਾਲ ਦੋਹਰੀ ਵਿਕਰੀ ਦੀ ਸਮੱਸਿਆ ਖ਼ਤਮ ਹੁੰਦੀ ਹੈ।'
                    : 'Database row locks (select_for_update) guarantee inventory consistency, completely eliminating double-selling and race conditions.'}
                </p>
              </div>

              <div className="sih-arch-card">
                <Coins size={24} className="text-primary" />
                <h4>
                  {lang === 'hi' ? 'सटीक दशमलव अंकगणित' : lang === 'pa' ? 'ਸਟੀਕ ਦਸ਼ਮਲਵ ਗਣਿਤ' : 'Precise Decimal Arithmetic'}
                </h4>
                <p>
                  {lang === 'hi'
                    ? 'शून्य फ़्लोटिंग-पॉइंट राउंडिंग त्रुटि। सभी सकल, भाड़ा, सेस और शुद्ध प्राप्ति गणनाएँ पायथन Decimal परिशुद्धता के साथ की जाती हैं।'
                    : lang === 'pa'
                    ? 'ਕੋਈ ਗੋਲ-ਮੋਲ ਜਾਂ ਫਲੋਟਿੰਗ ਗਲਤੀ ਨਹੀਂ। ਸਾਰੇ ਖਰਚੇ ਅਤੇ ਸ਼ੁੱਧ ਕਮਾਈ ਪਾਈਥਨ Decimal ਸ਼ੁੱਧਤਾ ਨਾਲ ਗਿਣੇ ਜਾਂਦੇ ਹਨ।'
                    : 'Zero floating-point rounding errors. All gross, freight, cess, and net realization calculations are computed with Python Decimal precision.'}
                </p>
              </div>

              <div className="sih-arch-card">
                <Landmark size={24} className="text-primary" />
                <h4>
                  {lang === 'hi' ? 'सत्यापित एगमार्कनेट एकीकरण' : lang === 'pa' ? 'ਅਧਿਕਾਰਤ ਐਗਮਾਰਕਨੈੱਟ ਡਾਟਾ' : 'Grounded Agmarknet Ingestion'}
                </h4>
                <p>
                  {lang === 'hi'
                    ? 'भारत सरकार के ओपन डेटा (OGD) से वास्तविक मॉडल बेंचमार्क अवलोकनों का निरंतर तुल्यकालन, पूर्ण तिथि एवं स्रोत ऑडिट के साथ।'
                    : lang === 'pa'
                    ? 'ਭਾਰਤ ਸਰਕਾਰ ਦੇ ਓਪਨ ਡਾਟਾ ਪੋਰਟਲ ਤੋਂ ਰੋਜ਼ਾਨਾ ਅਸਲ ਮਾਡਲ ਭਾਅ ਆਡਿਟ ਸਹਿਤ ਸਿੰਕ ਹੁੰਦੇ ਹਨ।'
                    : 'Official Government of India open data (OGD) integration synchronizes real modal benchmark observations with full date and provenance auditing.'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sih-modal-foot">
          <span className="sih-foot-note">
            {lang === 'hi'
              ? 'कृषिसेतु SIH26132 के लिए एक स्वतंत्र मंच है। कोई बनावटी भाव या अनधिकृत सरकारी दावे नहीं।'
              : lang === 'pa'
              ? 'ਕ੍ਰਿਸ਼ੀਸੇਤੂ SIH26132 ਲਈ ਇੱਕ ਸੁਤੰਤਰ ਮੰਚ ਹੈ। ਕੋਈ ਫ਼ਰਜ਼ੀ ਭਾਅ ਜਾਂ ਅਣ-ਅਧਿਕਾਰਤ ਦਾਅਵੇ ਨਹੀਂ।'
              : 'KrishiSetu is an independent platform for SIH26132. No fabricated prices or unauthorized government claims.'}
          </span>
          <button type="button" className="button subtle small" onClick={onClose}>
            {t.close || 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
