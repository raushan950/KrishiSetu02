import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Sprout,
  Leaf,
  Store,
  Truck,
  User,
  Mail,
  Lock,
  Phone,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { api, errorMessage } from './api';
import { getTranslation } from './i18n.js';

// Google Official 4-Color SVG Icon
function GoogleIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
      <path fill="none" d="M0 0h48v48H0z" />
    </svg>
  );
}

// Compact Password Strength Meter with Requirement Hints
function PasswordStrengthMeter({ password }) {
  const strength = useMemo(() => {
    if (!password) return { score: 0, label: '', color: '#e2e8f0', hasLength: false, hasComplexity: false };
    const hasLength = password.length >= 10;
    const hasComplexity = /[0-9]/.test(password) || /[A-Z]/.test(password) || /[^A-Za-z0-9]/.test(password);

    let score = 0;
    if (password.length >= 8) score += 1;
    if (hasLength) score += 1;
    if (hasComplexity) score += 1;

    if (score <= 1) return { score: 1, label: 'Weak (min 10 characters)', color: '#ef4444', hasLength, hasComplexity };
    if (score === 2) return { score: 2, label: 'Fair security', color: '#f59e0b', hasLength, hasComplexity };
    return { score: 3, label: 'Strong password', color: '#10b981', hasLength, hasComplexity };
  }, [password]);

  if (!password) {
    return (
      <div className="pwd-guidelines-hint">
        <span>Password must be at least 10 characters with numbers or uppercase.</span>
      </div>
    );
  }

  return (
    <div className="cinematic-pwd-strength">
      <div className="pwd-bars">
        <div className="pwd-bar" style={{ background: strength.score >= 1 ? strength.color : '#e2e8f0' }} />
        <div className="pwd-bar" style={{ background: strength.score >= 2 ? strength.color : '#e2e8f0' }} />
        <div className="pwd-bar" style={{ background: strength.score >= 3 ? strength.color : '#e2e8f0' }} />
      </div>
      <div className="pwd-meta-row">
        <span className="pwd-label" style={{ color: strength.color }}>{strength.label}</span>
        <span className="pwd-rules">
          {strength.hasLength ? '✓ 10+ chars' : '• min 10 chars'} · {strength.hasComplexity ? '✓ mixed' : '• add number/uppercase'}
        </span>
      </div>
    </div>
  );
}

// Google Sign-In Button with Google Identity Services (GSI)
export function GoogleSignInButton({ role = 'FARMER', onLogin, returnTo = '', mode = 'login' }) {
  const [clientId, setClientId] = useState(
    import.meta.env.VITE_GOOGLE_CLIENT_ID || '419049300238-r2tqsp46q20ppfta5ngsfam9ro8p5268.apps.googleusercontent.com'
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [infoModal, setInfoModal] = useState(false);

  useEffect(() => {
    let alive = true;
    api.get('status/')
      .then(r => {
        if (alive && r.data?.google_client_id) {
          setClientId(r.data.google_client_id);
        }
      })
      .catch((err) => {
        console.warn('Status check warning:', err);
      });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!clientId) return;
    let alive = true;

    function initGsi() {
      if (!alive || !window.google?.accounts?.id) return;
      try {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async ({ credential }) => {
            setLoading(true);
            setError('');
            try {
              const res = await api.post('auth/google/', { credential, role });
              const { user, tokens } = res.data;
              onLogin({ user, ...tokens });

              let dest = '/account';
              if (returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')) {
                dest = returnTo;
              } else if (user?.role === 'FARMER' || user?.role === 'BUYER') {
                dest = '/listings';
              } else if (user?.role === 'TRANSPORTER') {
                dest = '/transport';
              } else if (user?.role === 'ADMIN') {
                dest = '/admin';
              }
              window.location.assign(dest);
            } catch (err) {
              setError(errorMessage(err));
            } finally {
              if (alive) setLoading(false);
            }
          }
        });
      } catch (err) {
        console.warn('GSI init warning:', err);
      }
    }

    if (window.google?.accounts?.id) {
      initGsi();
    } else {
      const existing = document.querySelector('script[data-krishisetu-google]');
      const script = existing || document.createElement('script');
      if (!existing) {
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.dataset.krishisetuGoogle = '1';
        document.head.appendChild(script);
      }
      script.addEventListener('load', initGsi);
      return () => {
        alive = false;
        script.removeEventListener('load', initGsi);
      };
    }
    return () => { alive = false; };
  }, [clientId, role, returnTo, onLogin]);

  function handleGoogleClick() {
    setError('');
    if (!clientId) {
      setInfoModal(true);
      return;
    }

    if (window.google?.accounts?.id) {
      try {
        window.google.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            const btnWrap = document.getElementById('gsi-hidden-trigger');
            if (btnWrap) {
              window.google.accounts.id.renderButton(btnWrap, {
                theme: 'outline',
                size: 'large',
                width: 320
              });
              const actualBtn = btnWrap.querySelector('div[role="button"]');
              if (actualBtn) actualBtn.click();
            }
          }
        });
      } catch (e) {
        setError('Google sign-in popup could not be opened. Please verify popup permissions.');
      }
    } else {
      setError('Google Sign-In is initializing. Please wait a moment or check your internet connection.');
    }
  }

  const roleText = role === 'FARMER' ? 'Farmer' : role === 'BUYER' ? 'Buyer' : 'Transporter';

  return (
    <div className="google-auth-wrapper">
      <button
        type="button"
        className="cinematic-google-btn"
        onClick={handleGoogleClick}
        disabled={loading}
      >
        <GoogleIcon size={19} />
        <span>
          {loading
            ? 'Connecting to Google...'
            : mode === 'register'
            ? `Continue with Google as ${roleText}`
            : 'Continue with Google'}
        </span>
      </button>

      <div id="gsi-hidden-trigger" style={{ display: 'none' }} />

      {error && (
        <div className="cinematic-auth-alert error">
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}

      {infoModal && (
        <div className="google-modal-overlay" onClick={() => setInfoModal(false)}>
          <div className="google-modal-card" onClick={e => e.stopPropagation()}>
            <div className="google-modal-header">
              <div className="google-modal-icon">
                <GoogleIcon size={26} />
              </div>
              <div>
                <h3>Google Cloud Configuration</h3>
                <p className="google-modal-sub">Fast & Secure Google Single Sign-On</p>
              </div>
            </div>
            <div className="google-modal-body">
              <p>To enable live Google Sign-In, add your Google Cloud OAuth 2.0 Web Client ID to your environment:</p>
              <div className="google-code-box">
                <code>GOOGLE_CLIENT_ID=your_id.apps.googleusercontent.com</code>
              </div>
              <p className="google-modal-note">You can also sign in or register instantly using standard email and password below.</p>
            </div>
            <div className="google-modal-footer">
              <button type="button" className="button primary small" onClick={() => setInfoModal(false)}>
                Got it, Continue with Email
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Main Unified Cinematic Authentication Component
export function AuthPage({ mode: initialMode = 'login', onLogin, t: propT, lang: propLang }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const cardRef = useRef(null);

  const lang = propLang || localStorage.getItem('krishisetu_lang') || 'en';
  const t = propT || getTranslation(lang);

  // Active Auth Tab: 'login' | 'register'
  const [activeTab, setActiveTab] = useState(initialMode);

  // Two-step signup state: 1 (Account details) | 2 (Security)
  const [signupStep, setSignupStep] = useState(1);

  // Sync with route or URL change
  useEffect(() => {
    setActiveTab(initialMode);
    if (initialMode === 'login') {
      setSignupStep(1);
    }
  }, [initialMode]);

  const roleQuery = (params.get('role') || '').toUpperCase();
  const initialRole = ['FARMER', 'BUYER', 'TRANSPORTER'].includes(roleQuery) ? roleQuery : 'FARMER';
  const returnTo = params.get('return_to') || params.get('next') || '';

  const [form, setForm] = useState({
    email: '',
    password: '',
    phone: '',
    role: initialRole,
    first_name: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [step1Errors, setStep1Errors] = useState({});
  const [busy, setBusy] = useState(false);

  // Synchronize role query from URL (e.g. from homepage cards)
  useEffect(() => {
    if (roleQuery && ['FARMER', 'BUYER', 'TRANSPORTER'].includes(roleQuery)) {
      setForm(prev => ({ ...prev, role: roleQuery }));
    }
  }, [roleQuery]);

  // Handle in-place tab switching with zero jump and smooth scroll restoration
  function handleTabSwitch(targetTab) {
    setActiveTab(targetTab);
    setError('');
    setStep1Errors({});
    if (targetTab === 'register') {
      setSignupStep(1);
    }
    const currentParams = params.toString() ? `?${params.toString()}` : '';
    navigate(targetTab === 'register' ? `/register${currentParams}` : `/login${currentParams}`, { replace: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Validate Step 1 before advancing
  function handleContinueStep1(e) {
    if (e) e.preventDefault();
    setError('');
    const errors = {};

    const name = form.first_name.trim();
    if (!name) {
      errors.first_name = 'Please enter your full name or business name';
    }

    const email = form.email.trim();
    if (!email) {
      errors.email = 'Please enter your email address';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Please enter a valid email address';
    }

    const phoneDigits = (form.phone || '').replace(/\D/g, '');
    if (!phoneDigits) {
      errors.phone = 'Please enter your mobile phone number';
    } else if (phoneDigits.length < 10) {
      errors.phone = 'Phone number must contain at least 10 digits';
    }

    if (Object.keys(errors).length > 0) {
      setStep1Errors(errors);
      return;
    }

    setStep1Errors({});
    setSignupStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Return to Step 1 while preserving all data
  function handleBackToStep1() {
    setError('');
    setSignupStep(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Quick fill helper for review demo accounts
  function fillDemoAccount(email, password) {
    setForm(f => ({ ...f, email, password }));
    setError('');
  }

  // Handle Final Submission (Sign In or Step 2 Registration)
  async function handleSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    setError('');

    const normalizedEmail = (form.email || '').trim().toLowerCase();
    if (!normalizedEmail) {
      setError(lang === 'hi' ? 'कृपया अपना ईमेल पता दर्ज करें।' : lang === 'pa' ? 'ਕਿਰਪਾ ਕਰਕੇ ਆਪਣਾ ਈਮੇਲ ਪਤਾ ਦਰਜ ਕਰੋ।' : 'Please enter your email address.');
      return;
    }
    if (!form.password) {
      setError(lang === 'hi' ? 'कृपया अपना पासवर्ड दर्ज करें।' : lang === 'pa' ? 'ਕਿਰਪਾ ਕਰਕੇ ਆਪਣਾ ਪਾਸਵਰਡ ਦਰਜ ਕਰੋ।' : 'Please enter your password.');
      return;
    }

    if (activeTab === 'register') {
      if (!agreeTerms) {
        setError('Please accept the Terms of Service to continue.');
        return;
      }
      if (!form.password || form.password.length < 10) {
        setError('Password must contain at least 10 characters.');
        return;
      }
    }

    setBusy(true);

    try {
      const data = activeTab === 'register'
        ? await api.post('auth/register/', { ...form, email: normalizedEmail })
        : await api.post('auth/login/', { email: normalizedEmail, password: form.password });

      let user = data.data?.user;
      if (!user && data.data?.access) {
        user = (await api.get('auth/me/', { headers: { Authorization: `Bearer ${data.data.access}` } })).data;
      }

      onLogin({ user, ...(data.data?.tokens || { access: data.data?.access, refresh: data.data?.refresh }) });

      let dest = '/account';
      if (returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')) {
        dest = returnTo;
      } else if (user?.role === 'FARMER') {
        dest = '/farmer';
      } else if (user?.role === 'BUYER') {
        dest = '/buyer';
      } else if (user?.role === 'TRANSPORTER') {
        dest = '/transport';
      } else if (user?.role === 'ADMIN') {
        dest = '/admin';
      } else if (user?.role === 'INSTITUTION') {
        dest = '/institution';
      }
      navigate(dest);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const roleText = form.role === 'FARMER' ? 'Farmer' : form.role === 'BUYER' ? 'Buyer' : 'Transporter';

  return (
    <div className="auth-split-viewport">
      {/* Static cool background decorations (ambient gradient orbs & grid) */}
      <div className="auth-ambient-glow auth-glow-1" aria-hidden="true" />
      <div className="auth-ambient-glow auth-glow-2" aria-hidden="true" />
      <div className="auth-mesh-grid" aria-hidden="true" />

      {/* Main Dual-Column Split Card (Left: Showcase, Right: Form) */}
      <div className="auth-split-container" ref={cardRef}>
        
        {/* ======================================================== */}
        {/* LEFT COLUMN: ATTRACTIVE SHOWCASE PANEL                   */}
        {/* ======================================================== */}
        <div className="auth-showcase-side">
          <div className="showcase-content">
            {/* Top Pill - Professional AgriTech Branding */}
            <div className="showcase-pill">
              <Sparkles size={13} />
              <span>DIRECT FARMGATE AGRI-MARKETPLACE</span>
            </div>

            {/* Headline */}
            <div>
              <h2 className="showcase-title">
                {lang === 'hi'
                  ? 'खेत से सही बाज़ार तक सीधी और पारदर्शी पहुँच'
                  : lang === 'pa'
                  ? 'ਖੇਤ ਤੋਂ ਸਹੀ ਮੰਡੀ ਤੱਕ ਸਿੱਧੀ ਅਤੇ ਪਾਰਦਰਸ਼ੀ ਪਹੁੰਚ'
                  : 'Bridging the Gap Between Farmgate & Fair Market Value'}
              </h2>
              <p className="showcase-subtitle">
                {lang === 'hi'
                  ? '107 एपीएमसी मंडियों के लाइव भाव, वास्तविक भाड़ा और बिना बिचौलियों के सीधा किसान-खरीददार व्यापार।'
                  : lang === 'pa'
                  ? '107 ਏਪੀਐਮਸੀ ਮੰਡੀਆਂ ਦੇ ਲਾਈਵ ਭਾਅ, ਅਸਲ ਭਾੜਾ ਅਤੇ ਬਿਨਾਂ ਦਲਾਲਾਂ ਦੇ ਸਿੱਧਾ ਕਿਸਾਨ-ਖਰੀਦਦਾਰ ਵਪਾਰ।'
                  : 'Direct farmgate trade with live Agmarknet benchmark intelligence, itemized freight deductions, and zero hidden brokerage.'}
              </p>
            </div>

            {/* Dynamic Role 3D Showcase Card */}
            <div className="showcase-role-preview">
              <div className="showcase-role-media">
                <img
                  src={
                    form.role === 'BUYER'
                      ? '/assets/buyer-3d.jpg'
                      : form.role === 'TRANSPORTER'
                      ? '/assets/transporter-3d.jpg'
                      : '/assets/farmer-3d.jpg'
                  }
                  alt={`${roleText} on KrishiSetu`}
                  className="showcase-role-img"
                />
                <div className="showcase-role-overlay" />
                <span className="showcase-role-tag">
                  {form.role === 'BUYER' ? (
                    <><Store size={13} /> Commercial Buyer · खरीददार</>
                  ) : form.role === 'TRANSPORTER' ? (
                    <><Truck size={13} /> Logistics Fleet · ढुलाई</>
                  ) : (
                    <><Leaf size={13} /> Agricultural Producer · किसान</>
                  )}
                </span>
              </div>
              <div className="showcase-role-desc">
                <strong>
                  {form.role === 'BUYER'
                    ? (lang === 'hi' ? 'सीधा स्रोत खरीद और गुणवत्ता परीक्षण' : lang === 'pa' ? 'ਸਿੱਧੀ ਖਰੀਦ ਅਤੇ ਮਿਆਰੀ ਗੁਣਵੱਤਾ' : 'Direct Sourcing & Verified Batches')
                    : form.role === 'TRANSPORTER'
                    ? (lang === 'hi' ? 'खेत से मंडी सीधी बुकिंग व डिजिटल पुष्टिकरण' : lang === 'pa' ? 'ਖੇਤ ਤੋਂ ਮੰਡੀ ਸਿੱਧੀ ਬੁਕਿੰਗ ਅਤੇ ਡਿਜੀਟਲ ਪੁਸ਼ਟੀ' : 'On-Demand Farmgate Haulage & Digital Tracking')
                    : (lang === 'hi' ? 'शून्य दलाली पर सीधी बिक्री व सही दाम' : lang === 'pa' ? 'ਬਿਨਾਂ ਦਲਾਲੀ ਸਿੱਧੀ ਵਿਕਰੀ ਅਤੇ ਸਹੀ ਮੁੱਲ' : 'Zero Brokerage Direct Sales & Fair Returns')}
                </strong>
                <p>
                  {form.role === 'BUYER'
                    ? (lang === 'hi' ? 'सीधे किसानों व एफपीओ से पारदर्शी मोलभाव के साथ थोक उपज खरीदें।' : lang === 'pa' ? 'ਕਿਸਾਨਾਂ ਅਤੇ ਐਫਪੀਓਜ਼ ਤੋਂ ਪਾਰਦਰਸ਼ੀ ਸੌਦੇਬਾਜ਼ੀ ਨਾਲ ਥੋਕ ਫ਼ਸਲ ਖਰੀਦੋ।' : 'Procure bulk lots directly with transparent price negotiations and clear logistics tracking.')
                    : form.role === 'TRANSPORTER'
                    ? (lang === 'hi' ? 'सत्यापित दूरी आधारित दरों पर तुरंत वाहन असाइन करें और डिजिटल डिलीवरी साक्ष्य जोड़ें।' : lang === 'pa' ? 'ਪ੍ਰਮਾਣਿਤ ਦੂਰੀ ਦਰਾਂ ਨਾਲ ਵਾਹਨ ਬੁੱਕ ਕਰੋ ਅਤੇ ਡਿਜੀਟਲ ਡਿਲੀਵਰੀ ਰਿਕਾਰਡ ਕਰੋ।' : 'Bid distance-based rates on active shipments and record digital delivery evidence.')
                    : (lang === 'hi' ? '107 मंडियों के भावों की तुलना करें और भाड़ा घटाकर अपना वास्तविक शुद्ध मुनाफा जानें।' : lang === 'pa' ? '107 ਮੰਡੀਆਂ ਦੇ ਭਾਵਾਂ ਦੀ ਤੁਲਨਾ ਕਰੋ ਅਤੇ ਅਸਲ ਸ਼ੁੱਧ ਮੁਨਾਫ਼ਾ ਜਾਣੋ।' : 'Compare 107 APMC mandi prices and know your exact net realized profit before shipping.')}
                </p>
              </div>
            </div>

            {/* Metrics Trio */}
            <div className="showcase-stats-grid">
              <div className="showcase-stat-item">
                <span className="stat-number">107+</span>
                <span className="stat-label">{lang === 'hi' ? 'एपीएमसी मंडियां' : lang === 'pa' ? 'ਏਪੀਐਮਸੀ ਮੰਡੀਆਂ' : 'APMC Mandis Live'}</span>
              </div>
              <div className="showcase-stat-item">
                <span className="stat-number">₹0</span>
                <span className="stat-label">{lang === 'hi' ? 'मध्यस्थ कमीशन' : lang === 'pa' ? 'ਵਿਚੋਲਗੀ ਕਮਿਸ਼ਨ' : 'Hidden Brokerage'}</span>
              </div>
              <div className="showcase-stat-item">
                <span className="stat-number">100%</span>
                <span className="stat-label">{lang === 'hi' ? 'पारदर्शी शुद्ध आय' : lang === 'pa' ? 'ਪਾਰਦਰਸ਼ੀ ਸ਼ੁੱਧ ਆਮਦਨ' : 'Net Margin Clarity'}</span>
              </div>
            </div>

            {/* Verified Farmer Testimonial Card */}
            <div className="showcase-quote-card">
              <div className="quote-stars">★★★★★</div>
              <p className="quote-text">
                {lang === 'hi'
                  ? '“कृषिसेतु से हमें माल भेजने से पहले ही भाड़े और मंडी शुल्क की सटीक जानकारी मिल जाती है। इससे हमारे सरसों की फसल पर प्रति क्विंटल ₹320 का शुद्ध अतिरिक्त लाभ हुआ।”'
                  : lang === 'pa'
                  ? '“ਕ੍ਰਿਸ਼ੀਸੇਤੂ ਨਾਲ ਸਾਨੂੰ ਮਾਲ ਭੇਜਣ ਤੋਂ ਪਹਿਲਾਂ ਹੀ ਭਾੜੇ ਅਤੇ ਮੰਡੀ ਖਰਚਿਆਂ ਦੀ ਸਪੱਸ਼ਟ ਜਾਣਕਾਰੀ ਮਿਲ ਜਾਂਦੀ ਹੈ। ਸਾਡੀ ਸਰ੍ਹੋਂ ਦੀ ਫ਼ਸਲ ਤੇ ਪ੍ਰਤੀ ਕੁਇੰਟਲ ₹320 ਦਾ ਵਾਧੂ ਸ਼ੁੱਧ ਮੁਨਾਫ਼ਾ ਹੋਇਆ।”'
                  : '“KrishiSetu calculates our real transportation deductions before we ship. That transparency alone increased our FPO’s net realized earnings by ₹320 per quintal.”'}
              </p>
              <div className="quote-author">
                <div className="quote-avatar">GS</div>
                <div className="quote-info">
                  <strong>Gurpreet Singh</strong>
                  <small>FPO President · Sangrur, Punjab</small>
                </div>
              </div>
            </div>

            {/* Bottom Trust & Security Row */}
            <div className="showcase-trust-row">
              <div className="trust-badge-item">
                <ShieldCheck size={14} />
                <span>256-Bit SSL Encrypted</span>
              </div>
              <span className="trust-sep">·</span>
              <div className="trust-badge-item">
                <CheckCircle2 size={14} />
                <span>Agmarknet Verified Benchmarks</span>
              </div>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* RIGHT COLUMN: AUTHENTICATION FORM                        */}
        {/* ======================================================== */}
        <div className="auth-form-side">
          {/* Brand Nav Header on Form Side */}
          <div className="auth-brand-bar">
            <Link to="/" className="auth-brand-link" title="KrishiSetu Home">
              <span className="auth-brand-icon">
                <Sprout size={18} />
              </span>
              <span className="auth-brand-title">
                KrishiSetu <small>कृषिसेतु</small>
              </span>
            </Link>
            <Link to="/" className="auth-return-link">
              <ArrowLeft size={13} />
              <span>{lang === 'hi' ? 'मुख्य पृष्ठ' : lang === 'pa' ? 'ਮੁੱਖ ਪੰਨਾ' : 'Home'}</span>
            </Link>
          </div>

          {/* Segmented Top Tabs: Sign In | Create Account */}
          <div className="cinematic-tabs-strip" role="tablist" aria-label="Authentication modes">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'login'}
              className={`cinematic-tab ${activeTab === 'login' ? 'active' : ''}`}
              onClick={() => handleTabSwitch('login')}
            >
              {t.authSignInTab || 'Sign In'}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'register'}
              className={`cinematic-tab ${activeTab === 'register' ? 'active' : ''}`}
              onClick={() => handleTabSwitch('register')}
            >
              {t.authRegisterTab || 'Create Account'}
            </button>
          </div>

          {/* Context Header */}
          <div className="cinematic-heading-block">
            <h2>
              {activeTab === 'login'
                ? (lang === 'hi' ? 'वापसी पर स्वागत है' : lang === 'pa' ? 'ਜੀ ਆਇਆਂ ਨੂੰ' : 'Welcome back')
                : signupStep === 1
                ? (lang === 'hi' ? 'नया खाता बनाएँ' : lang === 'pa' ? 'ਨਵਾਂ ਖਾਤਾ ਬਣਾਓ' : 'Create your account')
                : (lang === 'hi' ? 'खाता पासवर्ड सेट करें' : lang === 'pa' ? 'ਪਾਸਵਰਡ ਸੈੱਟ ਕਰੋ' : 'Secure your account')}
            </h2>
            <p>
              {activeTab === 'login'
                ? (lang === 'hi' ? 'अपने कृषिसेतु डैशबोर्ड और लाइव मंडी भावों तक पहुँचें' : lang === 'pa' ? 'ਆਪਣੇ ਕ੍ਰਿਸ਼ੀਸੇਤੂ ਖਾਤੇ ਅਤੇ ਲਾਈਵ ਮੰਡੀ ਭਾਵਾਂ ਤੱਕ ਪਹੁੰਚੋ' : 'Access your KrishiSetu dashboard and live mandi prices')
                : signupStep === 1
                ? (lang === 'hi' ? 'भारत के सीधे खेत व्यापार और मूल्य खोज मंच से जुड़ें' : lang === 'pa' ? 'ਭਾਰਤ ਦੇ ਸਿੱਧੇ ਖੇਤੀ ਵਪਾਰ ਅਤੇ ਮੰਡੀ ਭਾਅ ਪਲੇਟਫਾਰਮ ਨਾਲ ਜੁੜੋ' : 'Join India’s direct farmgate trading and price discovery platform')
                : (lang === 'hi' ? 'पंजीकरण पूरा करने के लिए एक सुरक्षित पासवर्ड दर्ज करें' : lang === 'pa' ? 'ਰਜਿਸਟ੍ਰੇਸ਼ਨ ਪੂਰੀ ਕਰਨ ਲਈ ਸੁਰੱਖਿਅਤ ਪਾਸਵਰਡ ਦਰਜ ਕਰੋ' : 'Set a password to complete your KrishiSetu profile')}
            </p>
          </div>

          {/* Multi-Step Indicator (Only on Create Account) */}
          {activeTab === 'register' && (
            <div className="cinematic-step-progress">
              <div className={`step-pill ${signupStep === 1 ? 'current' : 'completed'}`}>
                <span className="step-num">{signupStep > 1 ? '✓' : '1'}</span>
                <span className="step-title">{t.step1Title || 'Account details'}</span>
              </div>
              <div className="step-divider-line" />
              <div className={`step-pill ${signupStep === 2 ? 'current' : 'pending'}`}>
                <span className="step-num">2</span>
                <span className="step-title">{t.step2Title || 'Security'}</span>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* CASE A: SIGN IN TAB                                      */}
          {/* ======================================================== */}
          {activeTab === 'login' && (
            <form onSubmit={handleSubmit} className="cinematic-form" noValidate>
              {/* Google Fast SSO */}
              <div className="cinematic-google-section">
                <GoogleSignInButton
                  role={form.role}
                  onLogin={onLogin}
                  returnTo={returnTo}
                  mode="login"
                />
              </div>

              <div className="cinematic-divider">
                <span>{t.orEmail || 'or sign in with email'}</span>
              </div>

              {/* Email Address */}
              <div className="cinematic-input-group">
                <label htmlFor="login-email">{t.emailLabel || 'Email Address'}</label>
                <div className="cinematic-input-wrap">
                  <Mail size={17} className="input-prefix-icon" />
                  <input
                    id="login-email"
                    type="email"
                    required
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    placeholder="name@example.com"
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="cinematic-input-group">
                <label htmlFor="login-password">{t.passwordLabel || 'Password'}</label>
                <div className="cinematic-input-wrap">
                  <Lock size={17} className="input-prefix-icon" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    placeholder={lang === 'hi' ? 'अपना पासवर्ड दर्ज करें' : lang === 'pa' ? 'ਆਪਣਾ ਪਾਸਵਰਡ ਦਰਜ ਕਰੋ' : 'Enter your password'}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="cinematic-eye-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              {/* Remember Me & Forgot Password Row */}
              <div className="cinematic-options-row">
                <label className="cinematic-checkbox-label">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={e => setRememberMe(e.target.checked)}
                  />
                  <span>{t.rememberMe || 'Remember me'}</span>
                </label>
                <Link to="/forgot-password" className="cinematic-forgot-link">
                  {t.forgotPassword || 'Forgot password?'}
                </Link>
              </div>

              {/* Error Notice */}
              {error && (
                <div className="cinematic-auth-alert error" role="alert">
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={busy}
                className="cinematic-submit-btn"
              >
                {busy ? (t.signingIn || 'Signing in...') : (t.signInBtn || 'Sign In to KrishiSetu')}
                {!busy && <ArrowRight size={17} />}
              </button>

              {/* Quick 1-Click Demo Accounts for Fast Login */}
              <div className="demo-credentials-box">
                <div className="demo-credentials-header">
                  <span className="demo-credentials-label">
                    <Sparkles size={12} />
                    {lang === 'hi' ? 'त्वरित डेमो परीक्षण खाते:' : lang === 'pa' ? 'ਜਲਦੀ ਡੈਮੋ ਖਾਤੇ:' : 'Quick Demo Accounts:'}
                  </span>
                </div>
                <div className="demo-credentials-chips">
                  <button
                    type="button"
                    className="demo-chip farmer"
                    onClick={() => fillDemoAccount('farmer@krishisetu.in', 'Farmer123!')}
                    title="farmer@krishisetu.in / Farmer123!"
                  >
                    <Leaf size={12} />
                    <span>Farmer</span>
                  </button>
                  <button
                    type="button"
                    className="demo-chip buyer"
                    onClick={() => fillDemoAccount('buyer@krishisetu.in', 'Buyer123!')}
                    title="buyer@krishisetu.in / Buyer123!"
                  >
                    <Store size={12} />
                    <span>Buyer</span>
                  </button>
                  <button
                    type="button"
                    className="demo-chip transporter"
                    onClick={() => fillDemoAccount('transporter@krishisetu.in', 'Transporter123!')}
                    title="transporter@krishisetu.in / Transporter123!"
                  >
                    <Truck size={12} />
                    <span>Transporter</span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* ======================================================== */}
          {/* CASE B: CREATE ACCOUNT TAB — STEP 1 (Details)            */}
          {/* ======================================================== */}
          {activeTab === 'register' && signupStep === 1 && (
            <div className="cinematic-step1-wrap">
              {/* Role Selection Grid */}
              <div className="cinematic-role-selection">
                <span className="cinematic-section-label">
                  {lang === 'hi' ? 'अपनी प्लेटफ़ॉर्म भूमिका चुनें:' : lang === 'pa' ? 'ਆਪਣੀ ਭੂਮਿਕਾ ਚੁਣੋ:' : 'Select your platform role:'}
                </span>
                <div className="cinematic-role-grid">
                  <button
                    type="button"
                    className={`cinematic-role-item ${form.role === 'FARMER' ? 'active' : ''}`}
                    onClick={() => setForm(f => ({ ...f, role: 'FARMER' }))}
                  >
                    <div className="role-icon-box farmer">
                      <Leaf size={15} />
                    </div>
                    <div className="role-label-box">
                      <strong>{t.farmer || 'Farmer'}</strong>
                      <small>{lang === 'hi' ? 'फसल बिक्री' : lang === 'pa' ? 'ਫ਼ਸਲ ਵਿਕਰੀ' : 'Sell Crops'}</small>
                    </div>
                    {form.role === 'FARMER' && <Check size={13} className="role-selected-check" />}
                  </button>

                  <button
                    type="button"
                    className={`cinematic-role-item ${form.role === 'BUYER' ? 'active' : ''}`}
                    onClick={() => setForm(f => ({ ...f, role: 'BUYER' }))}
                  >
                    <div className="role-icon-box buyer">
                      <Store size={15} />
                    </div>
                    <div className="role-label-box">
                      <strong>{t.buyer || 'Buyer'}</strong>
                      <small>{lang === 'hi' ? 'खरीददार' : lang === 'pa' ? 'ਖਰੀਦਦਾਰ' : 'Procure'}</small>
                    </div>
                    {form.role === 'BUYER' && <Check size={13} className="role-selected-check" />}
                  </button>

                  <button
                    type="button"
                    className={`cinematic-role-item ${form.role === 'TRANSPORTER' ? 'active' : ''}`}
                    onClick={() => setForm(f => ({ ...f, role: 'TRANSPORTER' }))}
                  >
                    <div className="role-icon-box transporter">
                      <Truck size={15} />
                    </div>
                    <div className="role-label-box">
                      <strong>{t.transporter || 'Transporter'}</strong>
                      <small>{lang === 'hi' ? 'ढुलाई' : lang === 'pa' ? 'ਭਾੜਾ' : 'Logistics'}</small>
                    </div>
                    {form.role === 'TRANSPORTER' && <Check size={13} className="role-selected-check" />}
                  </button>
                </div>
              </div>

              {/* Google SSO with Selected Role */}
              <div className="cinematic-google-section">
                <GoogleSignInButton
                  role={form.role}
                  onLogin={onLogin}
                  returnTo={returnTo}
                  mode="register"
                />
              </div>

              <div className="cinematic-divider">
                <span>{lang === 'hi' ? 'या ईमेल से पंजीकरण करें' : lang === 'pa' ? 'ਜਾਂ ਈਮੇਲ ਨਾਲ ਰਜਿਸਟਰ ਕਰੋ' : 'or register with email'}</span>
              </div>

              {/* Step 1 Inputs Form */}
              <form onSubmit={handleContinueStep1} className="cinematic-form" noValidate>
                {/* Full Name / Business Name */}
                <div className="cinematic-input-group">
                  <label htmlFor="reg-name">{lang === 'hi' ? 'पूरा नाम / व्यापारिक नाम' : lang === 'pa' ? 'ਪੂਰਾ ਨਾਂ / ਵਪਾਰਕ ਨਾਂ' : 'Full Name / Business Name'}</label>
                  <div className={`cinematic-input-wrap ${step1Errors.first_name ? 'has-error' : ''}`}>
                    <User size={17} className="input-prefix-icon" />
                    <input
                      id="reg-name"
                      type="text"
                      required
                      value={form.first_name}
                      onChange={e => {
                        setForm({ ...form, first_name: e.target.value });
                        if (step1Errors.first_name) setStep1Errors({ ...step1Errors, first_name: '' });
                      }}
                      placeholder="e.g. Ramesh Kumar"
                      autoComplete="name"
                    />
                  </div>
                  {step1Errors.first_name && (
                    <span className="field-error-text">{step1Errors.first_name}</span>
                  )}
                </div>

                {/* Email Address */}
                <div className="cinematic-input-group">
                  <label htmlFor="reg-email">{t.emailLabel || 'Email Address'}</label>
                  <div className={`cinematic-input-wrap ${step1Errors.email ? 'has-error' : ''}`}>
                    <Mail size={17} className="input-prefix-icon" />
                    <input
                      id="reg-email"
                      type="email"
                      required
                      value={form.email}
                      onChange={e => {
                        setForm({ ...form, email: e.target.value });
                        if (step1Errors.email) setStep1Errors({ ...step1Errors, email: '' });
                      }}
                      placeholder="name@example.com"
                      autoComplete="email"
                    />
                  </div>
                  {step1Errors.email && (
                    <span className="field-error-text">{step1Errors.email}</span>
                  )}
                </div>

                {/* Phone Number */}
                <div className="cinematic-input-group">
                  <label htmlFor="reg-phone">{t.mobile || 'Mobile Number (+91)'}</label>
                  <div className={`cinematic-input-wrap ${step1Errors.phone ? 'has-error' : ''}`}>
                    <Phone size={17} className="input-prefix-icon" />
                    <input
                      id="reg-phone"
                      type="tel"
                      required
                      value={form.phone}
                      onChange={e => {
                        setForm({ ...form, phone: e.target.value });
                        if (step1Errors.phone) setStep1Errors({ ...step1Errors, phone: '' });
                      }}
                      placeholder="+91 98765 43210"
                      autoComplete="tel"
                    />
                  </div>
                  {step1Errors.phone && (
                    <span className="field-error-text">{step1Errors.phone}</span>
                  )}
                </div>

                {/* Continue CTA */}
                <button
                  type="submit"
                  className="cinematic-submit-btn"
                >
                  {t.nextStepBtn || 'Continue to Security →'}
                  <ArrowRight size={17} />
                </button>
              </form>
            </div>
          )}

          {/* ======================================================== */}
          {/* CASE C: CREATE ACCOUNT TAB — STEP 2 (Security)           */}
          {/* ======================================================== */}
          {activeTab === 'register' && signupStep === 2 && (
            <form onSubmit={handleSubmit} className="cinematic-form" noValidate>
              {/* Summary Pill with Back Action */}
              <div className="step2-summary-card">
                <div className="summary-info">
                  <span className="summary-badge">{roleText}</span>
                  <div className="summary-meta">
                    <strong>{form.first_name || 'Account'}</strong>
                    <small>{form.email} · {form.phone}</small>
                  </div>
                </div>
                <button
                  type="button"
                  className="summary-edit-btn"
                  onClick={handleBackToStep1}
                  title="Edit details"
                >
                  {lang === 'hi' ? 'बदलें' : lang === 'pa' ? 'ਬਦਲੋ' : 'Edit'}
                </button>
              </div>

              {/* Password */}
              <div className="cinematic-input-group">
                <label htmlFor="reg-password">{t.passwordLabel || 'Create Account Password'}</label>
                <div className="cinematic-input-wrap">
                  <Lock size={17} className="input-prefix-icon" />
                  <input
                    id="reg-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={10}
                    value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    placeholder={lang === 'hi' ? 'कम से कम 10 अक्षर' : lang === 'pa' ? 'ਘੱਟੋ-ਘੱਟ 10 ਅੱਖਰ' : 'Minimum 10 characters'}
                    autoComplete="new-password"
                    autoFocus
                  />
                  <button
                    type="button"
                    className="cinematic-eye-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
                <PasswordStrengthMeter password={form.password} />
              </div>

              {/* Terms of Service Consent */}
              <div className="cinematic-terms-row">
                <label className="cinematic-checkbox-label terms">
                  <input
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={e => setAgreeTerms(e.target.checked)}
                  />
                  <span>
                    {lang === 'hi'
                      ? 'मैं कृषि व्यापार के लिए कृषिसेतु की सेवा शर्तों और गोपनीयता नीति से सहमत हूँ।'
                      : lang === 'pa'
                      ? 'ਮੈਂ ਖੇਤੀਬਾੜੀ ਵਪਾਰ ਲਈ ਕ੍ਰਿਸ਼ੀਸੇਤੂ ਦੇ ਨਿਯਮਾਂ ਅਤੇ ਗੋਪਨੀਯਤਾ ਨੀਤੀ ਨਾਲ ਸਹਿਮਤ ਹਾਂ।'
                      : "I agree to KrishiSetu's Terms of Service and Privacy Policy for agricultural trading."}
                  </span>
                </label>
              </div>

              {/* Error Notice */}
              {error && (
                <div className="cinematic-auth-alert error" role="alert">
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}

              {/* Action Buttons: Back + Create Account */}
              <div className="step2-btn-group">
                <button
                  type="button"
                  className="step2-back-btn"
                  onClick={handleBackToStep1}
                  disabled={busy}
                >
                  <ArrowLeft size={16} />
                  {t.back || 'Back'}
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="cinematic-submit-btn step2-submit"
                >
                  {busy ? (t.submitting || 'Creating Account...') : (t.completeRegBtn || `Complete ${roleText} Registration`)}
                  {!busy && <ArrowRight size={17} />}
                </button>
              </div>
            </form>
          )}

          {/* Footer Card Switcher */}
          <div className="cinematic-card-footer">
            {activeTab === 'register' ? (
              <p>
                {t.alreadyAccount ? (
                  <button
                    type="button"
                    className="footer-switch-btn"
                    onClick={() => handleTabSwitch('login')}
                  >
                    {t.alreadyAccount} &rarr;
                  </button>
                ) : (
                  <>
                    Already have an account?{' '}
                    <button
                      type="button"
                      className="footer-switch-btn"
                      onClick={() => handleTabSwitch('login')}
                    >
                      Sign in &rarr;
                    </button>
                  </>
                )}
              </p>
            ) : (
              <p>
                {t.needAccount ? (
                  <button
                    type="button"
                    className="footer-switch-btn"
                    onClick={() => handleTabSwitch('register')}
                  >
                    {t.needAccount} &rarr;
                  </button>
                ) : (
                  <>
                    New to KrishiSetu?{' '}
                    <button
                      type="button"
                      className="footer-switch-btn"
                      onClick={() => handleTabSwitch('register')}
                    >
                      Create account &rarr;
                    </button>
                  </>
                )}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
