import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  TrendingUp,
  MapPin,
  Truck,
  CheckCircle2,
  AlertCircle,
  Award,
  ArrowRight,
  ShieldCheck,
  Store,
  Scale,
  RefreshCw,
  Sparkles,
  Sliders,
  Landmark,
  Sprout,
  Check,
  ChevronDown
} from 'lucide-react';
import { api, entries, errorMessage } from './api.js';
import { SearchableSelect } from './SearchableSelect.jsx';
import { getTranslation } from './i18n.js';

const currency = (v) =>
  v == null
    ? '—'
    : new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
      }).format(Number(v));

const currencyExact = (v) =>
  v == null
    ? '—'
    : new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(Number(v));

// Quick Preset Scenarios for Demonstration
const DEMO_PRESETS = [
  {
    key: 'wheat',
    cropName: 'Wheat',
    cropFallbackId: 46,
    qty: '50',
    state: 'Punjab',
    district: 'Fatehgarh Sahib',
    variety: 'Kalyan Sona',
    grade: 'FAQ',
    labelEn: 'Wheat (50 qtl · Punjab)',
    labelHi: 'गेहूँ (50 क्विंटल · पंजाब)',
    labelPa: 'ਕਣਕ (50 ਕੁਇੰਟਲ · ਪੰਜਾਬ)',
    descEn: 'Compares nearby Sirhind vs regional hub Khanna vs verified commercial buyer bids.',
    descHi: 'स्थानीय सरहिंद बनाम खन्ना क्षेत्रीय मंडी बनाम सीधे खरीदार के प्रस्तावों की तुलना।',
    descPa: 'ਸਥਾਨਕ ਸਰਹਿੰਦ ਬਨਾਮ ਖੰਨਾ ਖੇਤਰੀ ਮੰਡੀ ਬਨਾਮ ਖਰੀਦਦਾਰਾਂ ਦੇ ਸੌਦਿਆਂ ਦੀ ਤੁਲਨਾ।'
  },
  {
    key: 'mustard',
    cropName: 'Mustard',
    cropFallbackId: 49,
    qty: '30',
    state: 'Rajasthan',
    district: 'Kota',
    variety: 'Mustard',
    grade: 'FAQ',
    labelEn: 'Mustard (30 qtl · Rajasthan)',
    labelHi: 'सरसों (30 क्विंटल · राजस्थान)',
    labelPa: 'ਸਰ੍ਹੋਂ (30 ਕੁਇੰਟਲ · ਰਾਜਸਥਾਨ)',
    descEn: 'Analyzes oil mill procurement demand vs Kota APMC modal benchmark.',
    descHi: 'तेल मिलों की सीधी खरीद मांग बनाम कोटा एपीएमसी मॉडल भाव का विश्लेषण।',
    descPa: 'ਤੇਲ ਮਿੱਲ ਖਰੀਦ ਮੰਗ ਬਨਾਮ ਕੋਟਾ ਮੰਡੀ ਮਾਡਲ ਭਾਅ ਦਾ ਵਿਸ਼ਲੇਸ਼ਣ।'
  },
  {
    key: 'potato',
    cropName: 'Potato',
    cropFallbackId: 51,
    qty: '100',
    state: 'Uttar Pradesh',
    district: 'Agra',
    variety: 'Desi',
    grade: 'FAQ',
    labelEn: 'Potato (100 qtl · UP / Delhi)',
    labelHi: 'आलू (100 क्विंटल · यूपी / दिल्ली)',
    labelPa: 'ਆਲੂ (100 ਕੁਇੰਟਲ · ਯੂ.ਪੀ / ਦਿੱਲੀ)',
    descEn: 'Models long-distance refrigerated freight to Azadpur vs local farmgate cold storage.',
    descHi: 'आज़ादपुर दिल्ली लंबी दूरी भाड़ा बनाम स्थानीय कोल्ड स्टोरेज शुद्ध कमाई।',
    descPa: 'ਆਜ਼ਾਦਪੁਰ ਮੰਡੀ ਢੋਆ-ਢੁਆਈ ਬਨਾਮ ਸਥਾਨਕ ਕੋਲਡ ਸਟੋਰੇਜ ਸ਼ੁੱਧ ਮੁਨਾਫ਼ਾ।'
  }
];

export function FindBestMarket({ session, t: propT, lang: propLang }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Resolved active language & dictionary
  const lang = propLang || localStorage.getItem('krishisetu_lang') || 'en';
  const t = propT || getTranslation(lang);
  const fbmT = t.fbm || {};

  // Load master crops & markets
  const [crops, setCrops] = useState([]);
  const [cropsLoading, setCropsLoading] = useState(true);
  const [cropsError, setCropsError] = useState('');

  // Primary Farmer Inputs
  const [crop, setCrop] = useState(searchParams.get('crop') || '');
  const [qty, setQty] = useState(searchParams.get('qty') || '50');
  const [state, setState] = useState(searchParams.get('state') || 'Punjab');
  const [district, setDistrict] = useState(searchParams.get('district') || '');
  const [variety, setVariety] = useState(searchParams.get('variety') || '');
  const [grade, setGrade] = useState(searchParams.get('grade') || '');

  // Deduction Assumptions & Estimates Map: { [destinationKey]: { transport, other, loss } }
  const [costs, setCosts] = useState({});
  const [freightRatePerKm, setFreightRatePerKm] = useState('35'); // ₹35/km standard LCV/Tractor
  const [standardMandiCessPct, setStandardMandiCessPct] = useState('1.5'); // 1.5% APMC market cess
  const [showAdvancedDeductions, setShowAdvancedDeductions] = useState(false);

  // Results & Intelligence State
  const [opportunities, setOpportunities] = useState([]);
  const [oppsLoading, setOppsLoading] = useState(false);
  const [oppsError, setOppsError] = useState('');
  const [truncated, setTruncated] = useState(false);

  const [rankingResult, setRankingResult] = useState(null);
  const [rankingBusy, setRankingBusy] = useState(false);
  const [rankingError, setRankingError] = useState('');

  // Load crops on mount
  useEffect(() => {
    let active = true;
    setCropsLoading(true);
    api
      .get('crops/')
      .then((r) => {
        if (active) {
          setCrops(entries(r));
          setCropsError('');
        }
      })
      .catch((e) => {
        if (active) setCropsError(errorMessage(e));
      })
      .finally(() => {
        if (active) setCropsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Fetch verified opportunities whenever crop or geo filters change
  useEffect(() => {
    let active = true;
    if (!crop) {
      setOpportunities([]);
      setRankingResult(null);
      return;
    }

    setOppsLoading(true);
    setOppsError('');
    const params = { crop };
    if (state) params.state = state;
    if (district) params.district = district;
    if (variety) params.variety = variety;
    if (grade) params.grade = grade;

    api
      .get('market/opportunities/', { params })
      .then(({ data }) => {
        if (active) {
          const list = data.opportunities || [];
          setOpportunities(list);
          setTruncated(!!data.truncated);

          // Seed default sensible deductions for discovered destinations
          setCosts((prev) => {
            const next = { ...prev };
            list.forEach((item, index) => {
              if (!next[item.key]) {
                const approxDistKm = (index + 1) * 20;
                const approxFreight = Math.round(approxDistKm * Number(freightRatePerKm || 35));
                const estPrice = Number(item.price_per_qtl || 2000);
                const estGross = estPrice * Number(qty || 50);
                const approxMandiFees = Math.round((estGross * Number(standardMandiCessPct || 1.5)) / 100);

                next[item.key] = {
                  distance_km: String(approxDistKm),
                  transport: String(approxFreight),
                  other: String(approxMandiFees),
                  loss: '0.8'
                };
              }
            });
            return next;
          });
        }
      })
      .catch((e) => {
        if (active) {
          setOpportunities([]);
          setOppsError(errorMessage(e));
        }
      })
      .finally(() => {
        if (active) setOppsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [crop, state, district, variety, grade]);

  // Handle individual destination cost adjustments
  function updateCost(key, field, val) {
    setCosts((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] || {}),
        [field]: val
      }
    }));
  }

  // Quick auto-estimator helper: re-calculate transport based on distance
  function applyDistanceEstimator(key, km) {
    const freight = Math.round(Number(km || 0) * Number(freightRatePerKm || 35));
    updateCost(key, 'distance_km', String(km));
    updateCost(key, 'transport', String(freight));
  }

  // Execute precise recommendation ranking
  async function computeRankings(e) {
    if (e) e.preventDefault();
    if (!crop || !qty || Number(qty) <= 0) {
      setRankingError(
        lang === 'hi'
          ? 'कृपया फसल चुनें और सकारात्मक मात्रा (क्विंटल) दर्ज करें।'
          : lang === 'pa'
          ? 'ਕਿਰਪਾ ਕਰਕੇ ਫ਼ਸਲ ਚੁਣੋ ਅਤੇ ਸਹੀ ਮਾਤਰਾ ਦਰਜ ਕਰੋ।'
          : 'Please select a crop and enter a positive quantity in quintals.'
      );
      return;
    }

    setRankingBusy(true);
    setRankingError('');
    try {
      const costMap = {};
      for (const dest of opportunities) {
        const c = costs[dest.key];
        if (!c || c.transport === '' || c.transport === undefined) continue;
        costMap[dest.key] = {
          costs: {
            transport: c.transport || '0',
            other: c.other || '0'
          },
          loss_percent: c.loss || '0'
        };
      }

      const payload = {
        crop_id: Number(crop),
        quantity_qtl: qty,
        costs_by_destination: costMap
      };
      if (state) payload.state = state;
      if (district) payload.district = district;
      if (variety) payload.variety = variety;
      if (grade) payload.grade = grade;

      const { data } = await api.post('recommendations/', payload);
      setRankingResult(data);
    } catch (err) {
      setRankingError(errorMessage(err));
    } finally {
      setRankingBusy(false);
    }
  }

  // Automatically trigger ranking when opportunities first load
  useEffect(() => {
    if (opportunities.length > 0 && Object.keys(costs).length >= opportunities.length && !rankingResult) {
      computeRankings();
    }
  }, [opportunities, costs]);

  // Apply a demo preset scenario
  function applyDemoPreset(preset) {
    const matched = crops.find(
      (c) => c.name?.toLowerCase() === preset.cropName.toLowerCase()
    );
    const chosenCropId = matched ? String(matched.id) : String(preset.cropFallbackId);

    setCrop(chosenCropId);
    setQty(preset.qty);
    setState(preset.state);
    setDistrict(preset.district);
    setVariety(preset.variety);
    setGrade(preset.grade);
    setCosts({});
    setRankingResult(null);
  }

  // Explainability Generator: Compares top destination vs runners up
  const explanation = useMemo(() => {
    if (!rankingResult || !rankingResult.ranked || rankingResult.ranked.length < 2) {
      if (rankingResult?.ranked?.length === 1) {
        const top = rankingResult.ranked[0];
        return {
          title: lang === 'hi' ? `सर्वोच्च प्रमाणित आय: ${top.name}` : lang === 'pa' ? `ਸਭ ਤੋਂ ਵੱਧ ਪ੍ਰਮਾਣਿਤ ਆਮਦਨ: ${top.name}` : `Highest Verified Return: ${top.name}`,
          text: lang === 'hi'
            ? `इस गंतव्य से अनुमानित शुद्ध लाभ ${currency(top.calculation.net_inr)} (${currencyExact(top.calculation.net_per_qtl_inr)}/क्विंटल) प्राप्त होता है, परिवहन एवं मंडी शुल्क के ${currency(top.calculation.total_deductions_inr)} घटाने के बाद।`
            : lang === 'pa'
            ? `ਇਸ ਮੰਡੀ ਤੋਂ ਅਨੁਮਾਨਿਤ ਸ਼ੁੱਧ ਕਮਾਈ ${currency(top.calculation.net_inr)} (${currencyExact(top.calculation.net_per_qtl_inr)}/ਕੁਇੰਟਲ) ਬਣਦੀ ਹੈ, ਭਾੜਾ ਅਤੇ ਮੰਡੀ ਫੀਸ ਕੱਢਣ ਤੋਂ ਬਾਅਦ।`
            : `This destination yields an estimated net return of ${currency(top.calculation.net_inr)} (${currencyExact(top.calculation.net_per_qtl_inr)}/qtl) after deducting ${currency(top.calculation.total_deductions_inr)} in transport and market fees.`
        };
      }
      return null;
    }

    const top = rankingResult.ranked[0];
    const second = rankingResult.ranked[1];

    const topNet = Number(top.calculation.net_inr);
    const secondNet = Number(second.calculation.net_inr);
    const netDiff = Math.abs(topNet - secondNet);

    const topGross = Number(top.calculation.gross_inr);
    const secondGross = Number(second.calculation.gross_inr);

    const topDeductions = Number(top.calculation.total_deductions_inr);
    const secondDeductions = Number(second.calculation.total_deductions_inr);

    let reason = '';
    if (topGross > secondGross && topDeductions <= secondDeductions) {
      reason = lang === 'hi'
        ? `${top.name} अधिक सकल भाव (+${currency(topGross - secondGross)}) और कम अथवा बराबर ढुलाई शुल्क के साथ स्पष्ट रूप से प्रथम स्थान पर है।`
        : lang === 'pa'
        ? `${top.name} ਵੱਧ ਵਿਕਰੀ ਭਾਅ (+${currency(topGross - secondGross)}) ਅਤੇ ਘੱਟ ਖਰਚਿਆਂ ਨਾਲ ਪਹਿਲੇ ਨੰਬਰ ਤੇ ਹੈ।`
        : `${top.name} wins decisively with both higher gross pricing (+${currency(topGross - secondGross)}) and lower or equal logistics deductions.`;
    } else if (topGross > secondGross && topDeductions > secondDeductions) {
      const grossAdvantage = topGross - secondGross;
      const deductionDisadvantage = topDeductions - secondDeductions;
      reason = lang === 'hi'
        ? `हालाँकि ${top.name} पर परिवहन व शुल्क में ${currency(deductionDisadvantage)} अधिक लगते हैं, पर इसका ऊँचा बिक्री भाव ${currency(grossAdvantage)} अतिरिक्त राजस्व देता है, जिससे आपकी जेब में +${currency(netDiff)} अधिक शुद्ध नकदी आती है।`
        : lang === 'pa'
        ? `ਭਾਵੇਂ ${top.name} ਤੇ ਭਾੜਾ ${currency(deductionDisadvantage)} ਵੱਧ ਲੱਗਦਾ ਹੈ, ਪਰ ਇਸਦਾ ਉੱਚਾ ਭਾਅ ${currency(grossAdvantage)} ਵੱਧ ਆਮਦਨ ਦਿੰਦਾ ਹੈ, ਜਿਸ ਨਾਲ ਤੁਹਾਡੀ ਜੇਬ ਵਿੱਚ +${currency(netDiff)} ਵੱਧ ਮੁਨਾਫ਼ਾ ਆਉਂਦਾ ਹੈ।`
        : `Although ${top.name} incurs ${currency(deductionDisadvantage)} more in transport and fees, its higher selling benchmark generates ${currency(grossAdvantage)} in extra gross revenue, delivering +${currency(netDiff)} more net cash into your pocket.`;
    } else {
      const deductionSavings = secondDeductions - topDeductions;
      reason = lang === 'hi'
        ? `भले ही ${second.name} का नाममात्र भाव ऊँचा दिखता हो, पर अत्यधिक परिवहन भाड़ा और मंडी टैक्स आपके लाभ को घटा देते हैं। ${top.name} आपके ${currency(deductionSavings)} खर्च बचाता है, जिससे +${currency(netDiff)} अधिक वास्तविक लाभ मिलता है!`
        : lang === 'pa'
        ? `ਭਾਵੇਂ ${second.name} ਦਾ ਕਾਗਜ਼ੀ ਭਾਅ ਵੱਧ ਦਿਖਦਾ ਹੋਵੇ, ਪਰ ਦੂਰੀ ਅਤੇ ਭਾੜਾ ਕਮਾਈ ਘਟਾ ਦਿੰਦੇ ਹਨ। ${top.name} ਤੁਹਾਡੇ ${currency(deductionSavings)} ਖਰਚੇ ਬਚਾ ਕੇ +${currency(netDiff)} ਵੱਧ ਅਸਲ ਕਮਾਈ ਦਿੰਦਾ ਹੈ!`
        : `Even though ${second.name} boasts a higher nominal benchmark, excessive transport freight and market fees eat into your revenue. ${top.name} saves you ${currency(deductionSavings)} in deductions, resulting in +${currency(netDiff)} higher true profit!`;
    }

    return {
      title: lang === 'hi' ? `${top.name} क्यों है #1 (निर्णय विश्लेषण)` : lang === 'pa' ? `${top.name} ਕਿਉਂ ਹੈ #1 (ਫ਼ੈਸਲਾ ਵਿਸ਼ਲੇਸ਼ਣ)` : `Why ${top.name} Ranks #1 (Decision Analysis)`,
      text: reason,
      gain: netDiff,
      topDest: top,
      secondDest: second
    };
  }, [rankingResult, lang]);

  // Role Isolation: Transporters operate in the Freight & Fleet Logistics Hub
  if (session?.user?.role === 'TRANSPORTER') {
    return (
      <main className="container page">
        <div className="role-boundary-card">
          <div className="role-boundary-icon transporter"><Truck size={32} /></div>
          <h2>{lang === 'hi' ? 'ट्रांसपोर्टर लॉजिस्टिक्स कार्यक्षेत्र' : lang === 'pa' ? 'ਟਰਾਂਸਪੋਰਟਰ ਲੌਜਿਸਟਿਕਸ ਵਰਕਸਪੇਸ' : 'Transporter Workspace Boundary'}</h2>
          <p className="muted">
            "Find My Best Market" is a crop-selling net return tool built for Farmers. As a registered Freight Transporter, manage your vehicles, view open agricultural freight loads, and submit delivery quotations from your Logistics Hub.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '16px' }}>
            <Link to="/transport" className="button primary">Open Transporter Logistics Hub →</Link>
            <Link to="/account" className="button subtle">Account & KYC Settings</Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="container page find-best-market-page">
      {/* Flagship Header */}
      <header className="page-head fbm-header">
        <div className="fbm-title-group">
          <p className="eyebrow fbm-eyebrow">
            <Sparkles size={14} className="sparkle-icon" /> {fbmT.flagshipTag || 'FLAGSHIP DECISION ENGINE · BEST MARKET & NET RETURN NAVIGATOR'}
          </p>
          <h1>{fbmT.title || 'Find My Best Market: Net Return & Decision Navigator'}</h1>
        </div>

        {/* Demo Presets Bar */}
        <div className="fbm-presets-bar">
          <span className="presets-label">
            <Sliders size={14} /> {fbmT.presets || 'Quick Demo Presets:'}
          </span>
          {DEMO_PRESETS.map((p) => {
            const label = lang === 'hi' ? p.labelHi : lang === 'pa' ? p.labelPa : p.labelEn;
            const desc = lang === 'hi' ? p.descHi : lang === 'pa' ? p.descPa : p.descEn;
            return (
              <button
                key={p.key}
                type="button"
                className="button subtle small preset-btn"
                onClick={() => applyDemoPreset(p)}
                title={desc}
              >
                <Sprout size={13} className="text-primary" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Layout Grid */}
      <div className="fbm-layout-grid">
        {/* LEFT COLUMN: Decision Parameters Form & Destination Cost Tuning */}
        <div className="fbm-left-col">
          <section className="panel fbm-input-panel">
            <div className="panel-head">
              <h2>
                <Scale size={20} className="panel-icon text-primary" /> {fbmT.step1Title || '1. Harvest & Farmgate Details'}
              </h2>
              <span className="chip">{lang === 'hi' ? 'चरण 1 / 3' : lang === 'pa' ? 'ਪੜਾਅ 1 / 3' : 'Step 1 of 3'}</span>
            </div>

            <form onSubmit={computeRankings} className="fbm-form">
              <div className="form-grid">
                <label className="field full-width">
                  <span>{fbmT.targetCrop || 'Target Crop *'}</span>
                  <SearchableSelect
                    options={crops}
                    value={crop}
                    onChange={(val) => {
                      setCrop(val);
                      setCosts({});
                      setRankingResult(null);
                    }}
                    placeholder={fbmT.targetCropPlaceholder || 'Search 282 verified Indian crops...'}
                    emptyOption={t.allCrops || 'Choose crop'}
                    loading={cropsLoading}
                    error={cropsError}
                    required
                  />
                </label>

                <label className="field">
                  <span>{fbmT.harvestQty || 'Harvest Quantity (Quintals) *'}</span>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={qty}
                    onChange={(e) => {
                      setQty(e.target.value);
                      setRankingResult(null);
                    }}
                    placeholder="e.g. 50"
                    required
                  />
                </label>

                <label className="field">
                  <span>{fbmT.farmgateState || 'Farmgate State'}</span>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="e.g. Punjab, Rajasthan"
                  />
                </label>

                <label className="field">
                  <span>{fbmT.district || 'District / Tehsil (Optional)'}</span>
                  <input
                    type="text"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    placeholder="e.g. Fatehgarh Sahib"
                  />
                </label>

                <label className="field">
                  <span>{fbmT.variety || 'Crop Variety (Optional)'}</span>
                  <input
                    type="text"
                    value={variety}
                    onChange={(e) => setVariety(e.target.value)}
                    placeholder="e.g. Kalyan Sona, Sharbati"
                  />
                </label>
              </div>

              {/* Smart Logistics Rate Helper Box */}
              <div className="fbm-logistics-config">
                <div className="fbm-logistics-header">
                  <div>
                    <h4>{fbmT.logisticsTitle || 'Logistics Rate Assumptions'}</h4>
                    <p className="muted small">
                      {fbmT.logisticsDesc || 'Used to seed realistic freight and APMC fees. Can be fine-tuned per destination below.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="button subtle small"
                    onClick={() => setShowAdvancedDeductions(!showAdvancedDeductions)}
                  >
                    {showAdvancedDeductions
                      ? (lang === 'hi' ? 'सेटिंग्स छुपाएँ' : lang === 'pa' ? 'ਸੈਟਿੰਗਾਂ ਛੁਪਾਓ' : 'Hide Settings')
                      : (fbmT.configureRates || 'Configure Rates ⚙')}
                  </button>
                </div>

                {showAdvancedDeductions && (
                  <div className="form-grid fbm-rate-grid" style={{ marginTop: '12px' }}>
                    <label className="field">
                      <span>{lang === 'hi' ? 'वाहन भाड़ा दर (₹/किमी)' : lang === 'pa' ? 'ਵਾਹਨ ਭਾੜਾ ਦਰ (₹/ਕਿ.ਮੀ)' : 'Vehicle Freight Rate (₹/km)'}</span>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={freightRatePerKm}
                        onChange={(e) => setFreightRatePerKm(e.target.value)}
                        placeholder="35"
                      />
                    </label>

                    <label className="field">
                      <span>{lang === 'hi' ? 'मंडी शुल्क / सेस (%)' : lang === 'pa' ? 'ਮੰਡੀ ਫੀਸ / ਸੈੱਸ (%)' : 'APMC Mandi Cess / Fees (%)'}</span>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        step="0.1"
                        value={standardMandiCessPct}
                        onChange={(e) => setStandardMandiCessPct(e.target.value)}
                        placeholder="1.5"
                      />
                    </label>
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="fbm-calculate-btn"
                disabled={!crop || rankingBusy || oppsLoading}
              >
                {rankingBusy ? (
                  <>
                    <RefreshCw size={17} className="spinning" />
                    <span>{fbmT.rankingInProgress || 'Computing Optimal Net Realization…'}</span>
                  </>
                ) : (
                  <>
                    <TrendingUp size={18} />
                    <span>{fbmT.rankDestinationsBtn || 'Rank Best Selling Destinations'}</span>
                  </>
                )}
              </button>
            </form>
          </section>

          {/* DESTINATION COST ESTIMATES LIST */}
          <section className="panel fbm-destinations-panel">
            <div className="panel-head">
              <h2>
                <Truck size={20} className="panel-icon text-primary" /> {fbmT.step2Title || '2. Market Options & Route Freight'}
              </h2>
              <span className="chip">
                {opportunities.length} {lang === 'hi' ? 'उपलब्ध विकल्प' : lang === 'pa' ? 'ਉਪਲਬਧ ਵਿਕਲਪ' : 'Eligible Options'}
              </span>
            </div>

            {oppsLoading && (
              <div className="fbm-empty-box">
                <RefreshCw size={24} className="spinning text-primary" />
                <p>{lang === 'hi' ? 'प्रमाणित एगमार्कनेट भाव और खरीदार मांग लोड हो रही है…' : lang === 'pa' ? 'ਮੰਡੀ ਭਾਅ ਅਤੇ ਖਰੀਦਦਾਰ ਮੰਗ ਲੋਡ ਹੋ ਰਹੀ ਹੈ…' : 'Retrieving verified Agmarknet observations and active buyer demand…'}</p>
              </div>
            )}

            {oppsError && <div className="notice error">{oppsError}</div>}

            {!crop && (
              <div className="fbm-empty-box">
                <Sprout size={36} className="empty-icon text-primary" />
                <p>{fbmT.step2Empty || 'Select a crop above to discover active mandi benchmarks and commercial buyer offers.'}</p>
              </div>
            )}

            {crop && !oppsLoading && opportunities.length === 0 && (
              <div className="fbm-empty-box">
                <AlertCircle size={32} className="text-warn" />
                <p>
                  {lang === 'hi'
                    ? `इस फसल के लिए ${state || 'चयनित राज्य'} में कोई हालिया भाव उपलब्ध नहीं है।`
                    : lang === 'pa'
                    ? `ਇਸ ਫ਼ਸਲ ਲਈ ${state || 'ਚੁਣੇ ਸੂਬੇ'} ਵਿੱਚ ਕੋਈ ਭਾਅ ਨਹੀਂ ਮਿਲਿਆ।`
                    : `No recent mandi benchmarks found for this crop in ${state || 'the specified state'}.`}
                </p>
                <small className="muted">
                  {lang === 'hi'
                    ? 'ज़िला फ़िल्टर हटाएँ या गेहूँ, सरसों, अथवा आलू जैसे प्रमुख विकल्प चुनें।'
                    : lang === 'pa'
                    ? 'ਜ਼ਿਲ੍ਹਾ ਫਿਲਟਰ ਹਟਾਓ ਜਾਂ ਕਣਕ, ਸਰ੍ਹੋਂ, ਜਾਂ ਆਲੂ ਚੁਣੋ।'
                    : 'Try clearing the district filter or selecting a major crop like Wheat, Mustard, or Potato.'}
                </small>
              </div>
            )}

            {truncated && (
              <div className="notice info">
                {lang === 'hi'
                  ? 'शीर्ष 250 बाज़ार विकल्प दिखाए जा रहे हैं। विकल्पों को सीमित करने के लिए राज्य या ज़िला चुनें।'
                  : lang === 'pa'
                  ? 'ਸਿਖਰਲੇ 250 ਮੰਡੀ ਵਿਕਲਪ ਦਿਖਾਏ ਜਾ ਰਹੇ ਹਨ।'
                  : 'Displaying top 250 market destinations. Filter by State or District to narrow options.'}
              </div>
            )}

            <div className="fbm-dest-cards-stack">
              {opportunities.map((dest) => {
                const c = costs[dest.key] || {};
                const isBuyer = dest.kind === 'BUYER_OFFER';

                return (
                  <div key={dest.key} className={`fbm-dest-card ${isBuyer ? 'buyer-dest' : 'mandi-dest'}`}>
                    <div className="fbm-dest-card-head">
                      <div>
                        <div className="fbm-dest-badges">
                          <span className={`fbm-type-badge ${isBuyer ? 'badge-buyer' : 'badge-mandi'}`}>
                            {isBuyer ? <Store size={12} /> : <Landmark size={12} />}
                            {isBuyer
                              ? (lang === 'hi' ? 'सीधे खरीदार की मांग' : lang === 'pa' ? 'ਸਿੱਧੇ ਖਰੀਦਦਾਰ ਪ੍ਰਸਤਾਵ' : 'Direct Buyer Demand')
                              : (lang === 'hi' ? 'एपीएमसी मंडी भाव' : lang === 'pa' ? 'ਏਪੀਐਮਸੀ ਮੰਡੀ ਭਾਅ' : 'APMC Mandi Benchmark')}
                          </span>
                          <span className="chip-muted">{dest.source}</span>
                          {dest.freshness_days != null && (
                            <span className="chip-fresh">
                              {dest.freshness_days === 0
                                ? (lang === 'hi' ? 'आज दर्ज' : lang === 'pa' ? 'ਅੱਜ ਦਰਜ' : 'Observed Today')
                                : (lang === 'hi' ? `${dest.freshness_days} दिन पहले` : lang === 'pa' ? `${dest.freshness_days} ਦਿਨ ਪਹਿਲਾਂ` : `${dest.freshness_days}d ago`)}
                            </span>
                          )}
                        </div>
                        <h3 className="fbm-dest-name">{dest.name}</h3>
                        <p className="fbm-dest-meta">
                          {dest.district ? `${dest.district}, ` : ''}
                          {dest.state} · {lang === 'hi' ? 'मॉडल भाव:' : lang === 'pa' ? 'ਮਾਡਲ ਭਾਅ:' : 'Benchmark:'}{' '}
                          <b className="fbm-highlight-price">{currency(dest.price_per_qtl)}/qtl</b>
                        </p>
                      </div>

                      <div className="fbm-quick-dist">
                        <label className="fbm-dist-label">{lang === 'hi' ? 'अनुमानित दूरी' : lang === 'pa' ? 'ਅਨੁਮਾਨਿਤ ਦੂਰੀ' : 'Est. Distance'}</label>
                        <div className="fbm-dist-input-wrap">
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={c.distance_km || ''}
                            onChange={(e) => applyDistanceEstimator(dest.key, e.target.value)}
                            placeholder="km"
                            className="fbm-dist-field"
                          />
                          <span className="fbm-dist-unit">km</span>
                        </div>
                      </div>
                    </div>

                    {/* Cost inputs line */}
                    <div className="fbm-dest-costs-row">
                      <div className="fbm-cost-input-item">
                        <span className="fbm-input-sublabel">{lang === 'hi' ? 'ढुलाई भाड़ा (₹)' : lang === 'pa' ? 'ਭਾੜਾ (₹)' : 'Transport Freight (₹)'}</span>
                        <input
                          type="number"
                          min="0"
                          step="10"
                          value={c.transport ?? ''}
                          onChange={(e) => updateCost(dest.key, 'transport', e.target.value)}
                          placeholder="e.g. 2500"
                          className="fbm-small-input"
                        />
                      </div>

                      <div className="fbm-cost-input-item">
                        <span className="fbm-input-sublabel">{lang === 'hi' ? 'मंडी टैक्स व मजदूरी (₹)' : lang === 'pa' ? 'ਮੰਡੀ ਫੀਸ ਤੇ ਮਜ਼ਦੂਰੀ (₹)' : 'Fees & Labour (₹)'}</span>
                        <input
                          type="number"
                          min="0"
                          step="10"
                          value={c.other ?? ''}
                          onChange={(e) => updateCost(dest.key, 'other', e.target.value)}
                          placeholder="e.g. 800"
                          className="fbm-small-input"
                        />
                      </div>

                      <div className="fbm-cost-input-item">
                        <span className="fbm-input-sublabel">{lang === 'hi' ? 'उपज नुकसान (%)' : lang === 'pa' ? 'ਨੁਕਸਾਨ (%)' : 'Transit Loss (%)'}</span>
                        <input
                          type="number"
                          min="0"
                          max="20"
                          step="0.1"
                          value={c.loss ?? '0'}
                          onChange={(e) => updateCost(dest.key, 'loss', e.target.value)}
                          placeholder="0.8"
                          className="fbm-small-input"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN: Decision Analytics & Ranked Outcomes */}
        <div className="fbm-right-col">
          {rankingError && <div className="notice error">{rankingError}</div>}

          {/* Explainability Card */}
          {explanation && (
            <div className="fbm-explain-card">
              <div className="fbm-explain-header">
                <div className="fbm-trophy-icon">
                  <Award size={24} />
                </div>
                <div>
                  <span className="fbm-explain-tag">
                    {lang === 'hi' ? 'आर्थिक निर्णय अंतर्दृष्टि' : lang === 'pa' ? 'ਆਰਥਿਕ ਫ਼ੈਸਲਾ ਵਿਸ਼ਲੇਸ਼ਣ' : 'ECONOMIC DECISION INSIGHT'}
                  </span>
                  <h3>{explanation.title}</h3>
                </div>
              </div>
              <p className="fbm-explain-body">{explanation.text}</p>
              {explanation.gain > 0 && (
                <div className="fbm-explain-gain-pill">
                  <TrendingUp size={16} />{' '}
                  {lang === 'hi' ? 'अतिरिक्त शुद्ध लाभ:' : lang === 'pa' ? 'ਵਾਧੂ ਸ਼ੁੱਧ ਕਮਾਈ:' : 'Additional Profit:'}{' '}
                  <b>+{currency(explanation.gain)}</b> {lang === 'hi' ? 'अन्य विकल्पों की तुलना में' : lang === 'pa' ? 'ਦੂਜੇ ਵਿਕਲਪਾਂ ਦੇ ਮੁਕਾਬਲੇ' : 'vs Runner-Up'}
                </div>
              )}
            </div>
          )}

          {/* Ranked Results Stack */}
          <section className="panel fbm-results-panel">
            <div className="panel-head">
              <h2>
                <TrendingUp size={20} className="panel-icon text-primary" /> {fbmT.step3Title || '3. Ranked Net Earnings Comparison'}
              </h2>
              {rankingResult?.ranked && (
                <span className="chip-success">
                  {rankingResult.ranked.length} {lang === 'hi' ? 'मंडियाँ जाँची गईं' : lang === 'pa' ? 'ਮੰਡੀਆਂ ਦੀ ਜਾਂਚ' : 'Ranked'}
                </span>
              )}
            </div>

            {/* Empty State / Preview Card */}
            {(!rankingResult || !rankingResult.ranked || rankingResult.ranked.length === 0) && (
              <div className="fbm-empty-box fbm-preview-empty">
                <div className="fbm-preview-icon-wrap">
                  <Scale size={32} />
                </div>
                <h3>{fbmT.readyToCompare || 'Ready to Calculate Net Proceeds'}</h3>
                <p>
                  {fbmT.readyToCompareDesc || 'Click "Rank Best Selling Destinations" to calculate exact net cash proceeds for all options after freight and mandi taxes.'}
                </p>

                <div className="fbm-preview-features-grid">
                  <div className="fbm-preview-feat">
                    <Check size={14} className="text-primary" />
                    <span>{lang === 'hi' ? '107 एपीएमसी मंडियों का विश्लेषण' : lang === 'pa' ? '107 ਮੰਡੀਆਂ ਦਾ ਤੁਲਨਾਤਮਕ ਵਿਸ਼ਲੇਸ਼ਣ' : '107 APMC Mandis Analyzed'}</span>
                  </div>
                  <div className="fbm-preview-feat">
                    <Check size={14} className="text-primary" />
                    <span>{lang === 'hi' ? 'शून्य दलाली सीधे खरीदार सौदे' : lang === 'pa' ? 'ਜ਼ੀਰੋ ਕਮੀਸ਼ਨ ਸਿੱਧੇ ਖਰੀਦਦਾਰ ਸੌਦੇ' : 'Direct Buyer Linkages (0% Brokerage)'}</span>
                  </div>
                  <div className="fbm-preview-feat">
                    <Check size={14} className="text-primary" />
                    <span>{lang === 'hi' ? 'सटीक दशमलव शुद्ध लाभ हिसाब' : lang === 'pa' ? 'ਸਟੀਕ ਗਣਿਤ ਨਾਲ ਸ਼ੁੱਧ ਆਮਦਨ' : 'Exact Decimal Net Realization'}</span>
                  </div>
                </div>
              </div>
            )}

            {rankingResult?.ranked?.map((item, idx) => {
              const isFirst = idx === 0;
              const calc = item.calculation || {};
              const gross = Number(calc.gross_inr || 0);
              const net = Number(calc.net_inr || 0);
              const deductions = Number(calc.total_deductions_inr || 0);
              const netPercent = gross > 0 ? Math.max(0, Math.min(100, (net / gross) * 100)) : 0;
              const isBuyer = item.kind === 'BUYER_OFFER';

              return (
                <div
                  key={item.destination}
                  className={`fbm-rank-card ${isFirst ? 'fbm-rank-winner' : 'fbm-rank-runner'}`}
                >
                  {isFirst && (
                    <div className="fbm-winner-ribbon">
                      <Award size={14} /> ★ {fbmT.bestRankTag || 'Rank #1 Best Net Return'}
                    </div>
                  )}

                  <div className="fbm-rank-card-top">
                    <div className="fbm-rank-badge-col">
                      <span className={`fbm-rank-number ${isFirst ? 'rank-1' : ''}`}>#{idx + 1}</span>
                    </div>

                    <div className="fbm-rank-info-col">
                      <div className="fbm-card-title-row">
                        <h3 className="fbm-rank-title">{item.name}</h3>
                        <span className={`fbm-type-badge ${isBuyer ? 'badge-buyer' : 'badge-mandi'}`}>
                          {isBuyer
                            ? (lang === 'hi' ? 'सीधा खरीदार' : lang === 'pa' ? 'ਸਿੱਧਾ ਖਰੀਦਦਾਰ' : 'Direct Buyer')
                            : (lang === 'hi' ? 'एपीएमसी मंडी' : lang === 'pa' ? 'ਏਪੀਐਮਸੀ ਮੰਡੀ' : 'APMC Mandi')}
                        </span>
                      </div>

                      <p className="fbm-rank-sub">
                        {item.source} · {lang === 'hi' ? 'दर्ज तारीख:' : lang === 'pa' ? 'ਦਰਜ ਮਿਤੀ:' : 'Recorded:'} {item.observed_on}
                        {item.freshness_days != null && ` (${item.freshness_days}d ago)`}
                      </p>
                    </div>

                    <div className="fbm-rank-net-col">
                      <span className="fbm-net-label">{fbmT.netCashInPocket || 'Expected Net Cash'}</span>
                      <span className={`fbm-net-value ${isFirst ? 'winner-val' : ''}`}>
                        {currency(net)}
                      </span>
                      <span className="fbm-net-rate">
                        {currencyExact(calc.net_per_qtl_inr)} / quintal
                      </span>
                    </div>
                  </div>

                  {/* Financial Breakdown Bar */}
                  <div className="fbm-breakdown-bar-wrap">
                    <div className="fbm-bar-labels">
                      <span className="text-success font-semibold">
                        {lang === 'hi' ? 'शुद्ध लाभ' : lang === 'pa' ? 'ਸ਼ੁੱਧ ਮੁਨਾਫ਼ਾ' : 'Net in Pocket'}: {netPercent.toFixed(1)}%
                      </span>
                      <span className="text-danger font-semibold">
                        {lang === 'hi' ? 'कुल कटौतियां' : lang === 'pa' ? 'ਕੁੱਲ ਕਟੌਤੀਆਂ' : 'Total Deductions'}: {(100 - netPercent).toFixed(1)}% ({currency(deductions)})
                      </span>
                    </div>
                    <div className="fbm-progress-track">
                      <div
                        className="fbm-progress-fill-net"
                        style={{ width: `${netPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Itemized Deductions Line */}
                  <div className="fbm-metrics-grid">
                    <div className="fbm-metric-box">
                      <span className="fbm-metric-label">{fbmT.grossProceeds || 'Gross Value'}</span>
                      <b className="fbm-metric-val">{currency(gross)}</b>
                    </div>
                    <div className="fbm-metric-box">
                      <span className="fbm-metric-label">{fbmT.freightDeduction || '− Freight Deducted'}</span>
                      <b className="fbm-metric-val text-danger">
                        −{currency(calc.itemized_deductions?.transport_inr || 0)}
                      </b>
                    </div>
                    <div className="fbm-metric-box">
                      <span className="fbm-metric-label">{fbmT.mandiFeeDeduction || '− Fees & Cess'}</span>
                      <b className="fbm-metric-val text-danger">
                        −{currency(calc.itemized_deductions?.other_inr || 0)}
                      </b>
                    </div>
                    <div className="fbm-metric-box">
                      <span className="fbm-metric-label">{fbmT.shrinkageDeduction || '− Transit Loss'}</span>
                      <b className="fbm-metric-val text-danger">
                        {calc.crop_loss_quantity_qtl || 0} qtl
                      </b>
                    </div>
                  </div>

                  {/* Next Action Bridges (Role-Adaptive) */}
                  <div className="fbm-action-bridges">
                    {session?.user?.role === 'BUYER' ? (
                      <button
                        type="button"
                        className="button primary small"
                        onClick={() => navigate(`/listings?crop=${crop}`)}
                      >
                        <Store size={14} /> {lang === 'hi' ? 'बाज़ार में यह फसल खरीदें →' : lang === 'pa' ? 'ਬਾਜ਼ਾਰ ਵਿੱਚ ਇਹ ਫ਼ਸਲ ਖਰੀਦੋ →' : 'Source This Crop in Marketplace →'}
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="button primary small"
                          onClick={() =>
                            navigate(
                              session?.user?.role === 'FARMER'
                                ? `/farmer?tab=listings&crop=${crop}&quantity=${qty}&asking_price=${Math.round(Number(calc.net_per_qtl_inr || 2000))}`
                                : `/listings?create=1&crop=${crop}&quantity=${qty}&asking_price=${Math.round(Number(calc.net_per_qtl_inr || 2000))}`
                            )
                          }
                        >
                          <Store size={14} /> {lang === 'hi' ? 'इस भाव पर बिक्री सूची बनाएँ →' : lang === 'pa' ? 'ਇਸ ਭਾਅ ਤੇ ਫ਼ਸਲ ਦਰਜ ਕਰੋ →' : 'Create Listing at this Price →'}
                        </button>

                        <button
                          type="button"
                          className="button subtle small"
                          onClick={() =>
                            navigate(
                              session?.user?.role === 'FARMER'
                                ? `/farmer?tab=orders`
                                : `/login?role=FARMER`
                            )
                          }
                        >
                          <Truck size={14} /> {lang === 'hi' ? 'ट्रांसपोर्टर भाड़ा मँगवाएँ' : lang === 'pa' ? 'ਟਰਾਂਸਪੋਰਟ ਭਾੜਾ ਮੰਗਵਾਓ' : 'Arrange Order Freight'}
                        </button>
                      </>
                    )}

                    <button
                      type="button"
                      className="button subtle small"
                      onClick={() =>
                        navigate(
                          `/calculator?quantity=${qty}&price=${Math.round(
                            gross / Number(qty || 1)
                          )}&transport=${calc.itemized_deductions?.transport_inr || 0}`
                        )
                      }
                    >
                      {lang === 'hi' ? 'कैलकुलेटर में देखें' : lang === 'pa' ? 'ਕੈਲਕੁਲੇਟਰ ਵਿੱਚ ਵੇਖੋ' : 'Inspect in Calculator'}
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Disclaimer & Transparency Footer */}
            <div className="fbm-disclaimer-card">
              <div className="fbm-disclaimer-icon">
                <ShieldCheck size={20} />
              </div>
              <div>
                <b>{lang === 'hi' ? 'डेटा सत्यनिष्ठा एवं पारदर्शिता (SIH26132 अनुपालन):' : lang === 'pa' ? 'ਡਾਟਾ ਪਾਰਦਰਸ਼ਤਾ (SIH26132 ਅਨੁਸਾਰ):' : 'Data Integrity & Trust Transparency (SIH26132 Compliance):'}</b>
                <p>
                  {fbmT.complianceNotice ||
                    'Mandi observations are historical benchmark arrivals recorded by official APMC Agmarknet daily bulletins; they serve as intelligence benchmarks rather than legally binding execution guarantees. Unquoted transport charges are treated as explicit user assumptions. Direct buyer offers represent pending bilateral commitments upon mutual acceptance.'}
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
