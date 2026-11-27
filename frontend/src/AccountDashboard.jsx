import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  User, ShieldCheck, CheckCircle2, AlertCircle, AlertTriangle, Info,
  Clock, Phone, Mail, FileText, ChevronRight, RefreshCw, Lock,
  Sprout, Store, Truck, LayoutDashboard, Bell, Shield, Key,
  ExternalLink, ArrowRight, Check, X, Building, ArrowUpRight
} from 'lucide-react';
import { api, entries, errorMessage } from './api.js';
import {
  GoogleAuth, PriceAlerts, ForecastView, OrdersWorkflow,
  FarmManager, OffersWorkflow, AccountSecurity, ShipmentTimeline
} from './Workspace.jsx';
import { TradeCasework, MyListings, AdminReview } from './TradeResolution.jsx';
import { IntelligenceTools } from './IntelligenceTools.jsx';

// Masking helper for mobile numbers and documents
function maskPhone(phone) {
  if (!phone) return '';
  const clean = String(phone).replace(/\s+/g, '');
  if (clean.length < 8) return '******';
  return clean.slice(0, 3) + '******' + clean.slice(-2);
}

function maskDoc(num) {
  if (!num) return '****';
  const s = String(num).trim();
  if (s.length <= 4) return '****';
  return '*'.repeat(s.length - 4) + s.slice(-4);
}

export function AccountDashboard({ session, setUser, initialTab = 'overview' }) {
  const [params, setParams] = useSearchParams();
  const urlTab = params.get('tab') || initialTab;
  const [activeTab, setActiveTab] = useState(urlTab);
  const [notice, setNotice] = useState(null); // { type: 'success' | 'error' | 'warning' | 'info', text: '' }
  const [showOnboardingBanner, setShowOnboardingBanner] = useState(true);

  // Core status data
  const [opStatus, setOpStatus] = useState(null);
  const [kycStatus, setKycStatus] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Phone OTP Flow State
  const [phoneInput, setPhoneInput] = useState(session.user?.phone || '');
  const [phoneCode, setPhoneCode] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [smsCooldown, setSmsCooldown] = useState(0);
  const [smsMaskedDest, setSmsMaskedDest] = useState('');
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [phoneFieldError, setPhoneFieldError] = useState('');

  // Email verification cooldown
  const [emailCooldown, setEmailCooldown] = useState(0);
  const [emailBusy, setEmailBusy] = useState(false);

  // Profile Form State
  const [profileForm, setProfileForm] = useState({
    first_name: session.user?.first_name || '',
    last_name: session.user?.last_name || '',
    phone: session.user?.phone || '',
    district: session.user?.district || '',
    state: session.user?.state || '',
    preferred_language: session.user?.preferred_language || 'hi',
  });
  const [profileSaving, setProfileSaving] = useState(false);

  // KYC Form State
  const [kycForm, setKycForm] = useState({
    document_type: 'AADHAAR',
    document_number: '',
    full_name: `${session.user?.first_name || ''} ${session.user?.last_name || ''}`.trim(),
    notes: '',
  });
  const [kycSubmitting, setKycSubmitting] = useState(false);

  // Role summaries
  const farms = useDataIf('farms/', session.user.role === 'FARMER');
  const myListings = useDataIf('my-listings/', session.user.role === 'FARMER');
  const offers = useDataIf('offers/', true);
  const orders = useDataIf('orders/', true);
  const vehicles = useDataIf('vehicles/', session.user.role === 'TRANSPORTER');
  const notifications = useDataIf('notifications/', true);

  // Keep active tab in sync with URL
  useEffect(() => {
    if (params.get('tab') && params.get('tab') !== activeTab) {
      setActiveTab(params.get('tab'));
    }
  }, [params]);

  function switchTab(tabId) {
    setActiveTab(tabId);
    setParams({ tab: tabId });
    setNotice(null);
  }

  // Load operational status & KYC status on mount
  useEffect(() => {
    loadStatus();
    loadKyc();
  }, []);

  async function loadStatus() {
    try {
      const res = await api.get('status/');
      setOpStatus(res.data);
    } catch { }
  }

  async function loadKyc() {
    try {
      const res = await api.get('auth/identity/');
      setKycStatus(res.data);
    } catch { }
  }

  // Cooldown timers
  useEffect(() => {
    if (smsCooldown > 0) {
      const t = setTimeout(() => setSmsCooldown(smsCooldown - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [smsCooldown]);

  useEffect(() => {
    if (emailCooldown > 0) {
      const t = setTimeout(() => setEmailCooldown(emailCooldown - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [emailCooldown]);

  // Refresh profile & session from backend
  async function refreshAccount() {
    setRefreshing(true);
    try {
      const r = await api.get('auth/me/');
      setUser(r.data);
      setProfileForm({
        first_name: r.data.first_name || '',
        last_name: r.data.last_name || '',
        phone: r.data.phone || '',
        district: r.data.district || '',
        state: r.data.state || '',
        preferred_language: r.data.preferred_language || 'hi',
      });
      await Promise.all([loadStatus(), loadKyc()]);
      setNotice({ type: 'success', text: 'Account status refreshed successfully.' });
    } catch (e) {
      setNotice({ type: 'error', text: errorMessage(e) });
    } finally {
      setRefreshing(false);
    }
  }

  // Email Verification Request
  async function requestEmailVerification() {
    setEmailBusy(true);
    setNotice(null);
    try {
      await api.post('auth/verification/request/', { kind: 'EMAIL' });
      setEmailCooldown(60);
      setNotice({
        type: 'info',
        text: `Verification link sent to ${session.user.email}. Please check your inbox and spam folder.`
      });
    } catch (e) {
      setNotice({ type: 'error', text: errorMessage(e) });
    } finally {
      setEmailBusy(false);
    }
  }

  // Phone editing handlers
  function startChangePhone() {
    setIsEditingPhone(true);
    setChallengeId('');
    setPhoneCode('');
    setPhoneInput(session.user?.phone || '');
    setPhoneFieldError('');
    setNotice(null);
  }

  function cancelChangePhone() {
    setIsEditingPhone(false);
    setChallengeId('');
    setPhoneCode('');
    setPhoneInput(session.user?.phone || '');
    setPhoneFieldError('');
  }

  // Phone OTP Request (for existing or pending number)
  async function requestPhoneOtp() {
    const target = isEditingPhone ? phoneInput.trim() : (session.user?.phone || phoneInput.trim());
    if (!target) {
      setPhoneFieldError('Please enter a valid 10-digit Indian mobile number.');
      return;
    }
    setPhoneBusy(true);
    setPhoneFieldError('');
    setNotice(null);
    try {
      const payload = { kind: 'PHONE' };
      if (isEditingPhone && target !== session.user?.phone) {
        payload.phone = target;
      }
      const r = await api.post('auth/verification/request/', payload);
      setChallengeId(r.data.challenge_id);
      setSmsCooldown(90);
      setSmsMaskedDest(r.data.target || maskPhone(target));
      if (r.data.dev_code) {
        setPhoneCode(r.data.dev_code);
        setNotice({
          type: 'info',
          text: `[Demo Mode] OTP Code: ${r.data.dev_code} (Auto-filled into verification box)`
        });
      } else {
        setNotice({
          type: 'info',
          text: `SMS OTP dispatched to ${r.data.target || maskPhone(target)}. Valid for 10 minutes.`
        });
      }
    } catch (e) {
      const msg = errorMessage(e);
      setPhoneFieldError(msg);
      setNotice({ type: 'error', text: msg });
    } finally {
      setPhoneBusy(false);
    }
  }

  // Phone OTP Confirmation
  async function confirmPhoneOtp(e) {
    if (e) e.preventDefault();
    if (!phoneCode || phoneCode.trim().length < 4) {
      setPhoneFieldError('Please enter the 6-digit verification code.');
      return;
    }
    setPhoneBusy(true);
    setPhoneFieldError('');
    setNotice(null);
    try {
      const r = await api.post('auth/verification/confirm/', {
        kind: 'PHONE',
        challenge_id: challengeId,
        token: phoneCode.trim()
      });
      setUser(r.data.user);
      setPhoneCode('');
      setChallengeId('');
      setIsEditingPhone(false);
      setPhoneInput(r.data.user?.phone || '');
      setNotice({
        type: 'success',
        text: 'Phone number verified successfully! Mobile verification badge is now active.'
      });
    } catch (e) {
      const msg = errorMessage(e);
      setPhoneFieldError(msg);
      setNotice({ type: 'error', text: msg });
    } finally {
      setPhoneBusy(false);
    }
  }

  // Save Profile Form
  async function handleProfileSave(e) {
    e.preventDefault();
    setProfileSaving(true);
    setNotice(null);
    try {
      const r = await api.patch('auth/me/', profileForm);
      setUser(r.data);
      setNotice({ type: 'success', text: 'Profile updated successfully.' });
    } catch (e) {
      setNotice({ type: 'error', text: errorMessage(e) });
    } finally {
      setProfileSaving(false);
    }
  }

  // Submit KYC Document
  async function handleKycSubmit(e) {
    e.preventDefault();
    setKycSubmitting(true);
    setNotice(null);
    try {
      const r = await api.post('auth/identity/', kycForm);
      setKycStatus(r.data);
      setNotice({
        type: 'success',
        text: 'Identity verification submitted. Administrator review has been queued.'
      });
    } catch (e) {
      setNotice({ type: 'error', text: errorMessage(e) });
    } finally {
      setKycSubmitting(false);
    }
  }

  // Role Configuration Info
  const roleConfig = {
    FARMER: {
      label: 'Farmer',
      hindi: 'किसान',
      icon: Sprout,
      color: '#167449',
      bgColor: '#ecfdf5',
      desc: 'Agricultural Producer · Farmgate Seller · APMC Participant'
    },
    BUYER: {
      label: 'Buyer',
      hindi: 'खरीदार',
      icon: Store,
      color: '#0284c7',
      bgColor: '#f0f9ff',
      desc: 'Commercial Purchaser · Bulk Commodity Trader · Processing Mill'
    },
    TRANSPORTER: {
      label: 'Freight Transporter',
      hindi: 'माल ढुलाई ऑपरेटर',
      icon: Truck,
      color: '#d97706',
      bgColor: '#fffbeb',
      desc: 'Commercial Fleet Carrier · Logistics Operator · Truck Driver'
    },
    ADMIN: {
      label: 'Platform Administrator',
      hindi: 'प्रशासक',
      icon: ShieldCheck,
      color: '#7c3aed',
      bgColor: '#f5f3ff',
      desc: 'Governance Reviewer · Verification & Dispute Officer'
    },
    INSTITUTION: {
      label: 'Institutional Analyst',
      hindi: 'संस्थागत शोधकर्ता',
      icon: Building,
      color: '#475569',
      bgColor: '#f8fafc',
      desc: 'Market Policy Researcher · APMC Data Aggregator'
    }
  }[session.user.role] || {
    label: session.user.role,
    hindi: '',
    icon: User,
    color: '#167449',
    bgColor: '#ecfdf5',
    desc: 'Registered KrishiSetu Participant'
  };

  const RoleIcon = roleConfig.icon;

  // Calculate Onboarding Progress
  const onboardingSteps = getOnboardingSteps(session.user, {
    farms: farms?.data || [],
    listings: myListings?.data || [],
    offers: offers?.data || [],
    vehicles: vehicles?.data || []
  });

  const completedSteps = onboardingSteps.filter(s => s.completed).length;
  const progressPercent = Math.round((completedSteps / onboardingSteps.length) * 100);

  // Navigation Items
  const navItems = [
    { id: 'overview', label: 'Dashboard Overview', icon: LayoutDashboard },
    { id: 'verification', label: 'Verification Center', icon: ShieldCheck, badge: !session.user.account_verified ? 'Action needed' : 'Verified' },
    { id: 'profile', label: 'Profile Settings', icon: User },
    { id: 'security', label: 'Account Security', icon: Lock },
    // Farmer modules
    ...(session.user.role === 'FARMER' ? [
      { id: 'farms', label: 'My Farms', icon: Sprout, count: farms?.data?.length },
      { id: 'listings', label: 'Produce Listings', icon: Store, count: myListings?.data?.length },
      { id: 'offers', label: 'Incoming Offers', icon: ArrowUpRight, count: offers?.data?.length },
      { id: 'orders', label: 'Orders & Shipments', icon: Truck, count: orders?.data?.length },
      { id: 'trade-resolution', label: 'Trade Casework', icon: Shield },
      { id: 'intelligence', label: 'Mandi Intelligence', icon: ExternalLink },
    ] : []),
    // Buyer modules
    ...(session.user.role === 'BUYER' ? [
      { id: 'offers', label: 'My Submitted Offers', icon: ArrowUpRight, count: offers?.data?.length },
      { id: 'orders', label: 'Purchases & Deliveries', icon: Truck, count: orders?.data?.length },
      { id: 'trade-resolution', label: 'Trade Casework', icon: Shield },
      { id: 'intelligence', label: 'Mandi Benchmark', icon: ExternalLink },
    ] : []),
    // Transporter modules
    ...(session.user.role === 'TRANSPORTER' ? [
      { id: 'transport-vehicles', label: 'Fleet & Vehicles', icon: Truck, count: vehicles?.data?.length },
      { id: 'transport-shipments', label: 'Freight Shipments', icon: Store },
    ] : []),
    // Admin modules
    ...(session.user.role === 'ADMIN' ? [
      { id: 'admin-queue', label: 'Admin Review Queue', icon: ShieldCheck },
    ] : []),
    { id: 'alerts', label: 'Notifications', icon: Bell, count: notifications?.data?.filter(n => !n.read)?.length || undefined },
  ];

  return (
    <div className="account-workspace">
      {/* 1. Header Banner */}
      <div className="account-hero-card">
        <div className="account-hero-main">
          <div className="account-avatar-wrap" style={{ background: roleConfig.bgColor, borderColor: roleConfig.color }}>
            <RoleIcon size={32} style={{ color: roleConfig.color }} />
          </div>
          <div>
            <div className="account-hero-eyebrow">
              <span className="account-role-badge" style={{ color: roleConfig.color, background: roleConfig.bgColor }}>
                <RoleIcon size={14} /> {roleConfig.label} {roleConfig.hindi && `(${roleConfig.hindi})`}
              </span>
              <span className="account-id-badge">ID: #{session.user.id}</span>
            </div>
            <h1 className="account-hero-name">
              {session.user.first_name ? `${session.user.first_name} ${session.user.last_name || ''}`.trim() : session.user.email}
            </h1>
            <p className="account-hero-sub">
              {roleConfig.desc} · {session.user.state || session.user.district ? [session.user.district, session.user.state].filter(Boolean).join(', ') : 'India'}
            </p>
          </div>
        </div>

        <div className="account-hero-badges">
          <div className={`status-pill ${session.user.email_verified ? 'verified' : 'unverified'}`}>
            <Mail size={14} />
            <span>Email {session.user.email_verified ? 'Verified' : 'Pending'}</span>
          </div>
          <div className={`status-pill ${session.user.phone_verified ? 'verified' : 'unverified'}`}>
            <Phone size={14} />
            <span>Mobile {session.user.phone_verified ? 'Verified' : 'Pending'}</span>
          </div>
          <div className={`status-pill ${session.user.identity_verified ? 'verified' : kycStatus?.status === 'PENDING_REVIEW' ? 'pending' : 'unverified'}`}>
            <ShieldCheck size={14} />
            <span>KYC {session.user.identity_verified ? 'Verified' : kycStatus?.status === 'PENDING_REVIEW' ? 'In Review' : 'Not Done'}</span>
          </div>
          <button
            type="button"
            className="button subtle small refresh-btn"
            onClick={refreshAccount}
            disabled={refreshing}
            title="Sync latest account status"
          >
            <RefreshCw size={14} className={refreshing ? 'spinning' : ''} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
          <Link
            to={
              session.user.role === 'FARMER' ? '/farmer'
              : session.user.role === 'BUYER' ? '/buyer'
              : session.user.role === 'TRANSPORTER' ? '/transport'
              : session.user.role === 'ADMIN' ? '/admin'
              : '/institution'
            }
            className="button primary small"
          >
            Open {roleConfig.label} Hub →
          </Link>
        </div>
      </div>

      {/* Global Alert Notice */}
      {notice && (
        <div className={`dashboard-notice notice ${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}>
          {notice.type === 'error' && <AlertCircle size={18} style={{ color: '#dc2626' }} />}
          {notice.type === 'warning' && <AlertTriangle size={18} style={{ color: '#d97706' }} />}
          {notice.type === 'success' && <CheckCircle2 size={18} style={{ color: '#16a34a' }} />}
          {notice.type === 'info' && <Info size={18} style={{ color: '#2563eb' }} />}
          <span>{notice.text}</span>
          <button type="button" className="notice-close" onClick={() => setNotice(null)}>✕</button>
        </div>
      )}

      {/* 2. Main Two-Column Workspace Layout */}
      <div className="account-layout">
        {/* Responsive Sidebar Navigation */}
        <aside className="account-sidebar" aria-label="Dashboard Navigation">
          <div className="sidebar-group-label">WORKSPACE MENU</div>
          <nav className="account-nav-list">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`account-nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => switchTab(item.id)}
                >
                  <Icon size={18} className="nav-icon" />
                  <span className="nav-label">{item.label}</span>
                  {item.badge && (
                    <span className={`nav-badge ${item.badge === 'Verified' ? 'badge-success' : 'badge-warn'}`}>
                      {item.badge}
                    </span>
                  )}
                  {item.count != null && item.count > 0 && (
                    <span className="nav-count">{item.count}</span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="sidebar-footer-card">
            <div className="sidebar-footer-title">Need Assistance?</div>
            <p className="sidebar-footer-desc">Direct farmgate trading support & APMC mandi advisory available.</p>
            <Link to="/prices" className="sidebar-footer-link">
              Explore Mandi Prices <ChevronRight size={14} />
            </Link>
          </div>
        </aside>

        {/* Dynamic Main Workspace Content */}
        <main className="account-content">
          {/* TAB: DASHBOARD OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="workspace-stack">
              {/* Sleek Dismissible Horizontal Onboarding Journey Banner */}
              {showOnboardingBanner && (
                <div className="onboarding-banner">
                  <div className="onboarding-banner-left">
                    <div className="onboarding-banner-icon">
                      <ShieldCheck size={20} />
                    </div>
                    <div className="onboarding-banner-content">
                      <div className="onboarding-banner-title">
                        <span>{roleConfig.label} Onboarding Journey</span>
                        <span className="onboarding-banner-percent">{progressPercent}% Completed</span>
                      </div>
                      <div className="onboarding-banner-bar">
                        <div className="onboarding-banner-fill" style={{ width: `${progressPercent}%` }} />
                      </div>
                    </div>
                  </div>
                  <div className="onboarding-banner-right">
                    {onboardingSteps.find(s => !s.completed)?.action && (
                      <button
                        type="button"
                        className="button primary small"
                        style={{ fontSize: '0.78rem', padding: '5px 12px' }}
                        onClick={() => {
                          const nextStep = onboardingSteps.find(s => !s.completed);
                          if (nextStep?.action?.tab) switchTab(nextStep.action.tab);
                          if (nextStep?.action?.url) window.location.href = nextStep.action.url;
                        }}
                      >
                        Next: {onboardingSteps.find(s => !s.completed)?.action.label} →
                      </button>
                    )}
                    <button
                      type="button"
                      className="onboarding-banner-dismiss"
                      title="Dismiss onboarding banner"
                      onClick={() => setShowOnboardingBanner(false)}
                      aria-label="Dismiss banner"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* Role-Specific Key Metrics */}
              <div className="dashboard-metrics-grid">
                {session.user.role === 'FARMER' && (
                  <>
                    <div className="metric-card" onClick={() => switchTab('farms')}>
                      <div className="metric-icon" style={{ background: '#ecfdf5', color: '#167449' }}><Sprout size={22} /></div>
                      <div className="metric-data">
                        <span className="metric-num">{farms?.data?.length || 0}</span>
                        <span className="metric-label">Registered Farms</span>
                      </div>
                      <ChevronRight size={18} className="metric-arrow" />
                    </div>
                    <div className="metric-card" onClick={() => switchTab('listings')}>
                      <div className="metric-icon" style={{ background: '#f0fdf4', color: '#15803d' }}><Store size={22} /></div>
                      <div className="metric-data">
                        <span className="metric-num">{myListings?.data?.length || 0}</span>
                        <span className="metric-label">Produce Listings</span>
                      </div>
                      <ChevronRight size={18} className="metric-arrow" />
                    </div>
                    <div className="metric-card" onClick={() => switchTab('offers')}>
                      <div className="metric-icon" style={{ background: '#eff6ff', color: '#2563eb' }}><ArrowUpRight size={22} /></div>
                      <div className="metric-data">
                        <span className="metric-num">{offers?.data?.length || 0}</span>
                        <span className="metric-label">Buyer Offers</span>
                      </div>
                      <ChevronRight size={18} className="metric-arrow" />
                    </div>
                    <div className="metric-card" onClick={() => switchTab('orders')}>
                      <div className="metric-icon" style={{ background: '#fef3c7', color: '#d97706' }}><Truck size={22} /></div>
                      <div className="metric-data">
                        <span className="metric-num">{orders?.data?.length || 0}</span>
                        <span className="metric-label">Active Orders</span>
                      </div>
                      <ChevronRight size={18} className="metric-arrow" />
                    </div>
                  </>
                )}

                {session.user.role === 'BUYER' && (
                  <>
                    <div className="metric-card" onClick={() => switchTab('offers')}>
                      <div className="metric-icon" style={{ background: '#eff6ff', color: '#0284c7' }}><ArrowUpRight size={22} /></div>
                      <div className="metric-data">
                        <span className="metric-num">{offers?.data?.length || 0}</span>
                        <span className="metric-label">Submitted Offers</span>
                      </div>
                      <ChevronRight size={18} className="metric-arrow" />
                    </div>
                    <div className="metric-card" onClick={() => switchTab('orders')}>
                      <div className="metric-icon" style={{ background: '#ecfdf5', color: '#167449' }}><Truck size={22} /></div>
                      <div className="metric-data">
                        <span className="metric-num">{orders?.data?.length || 0}</span>
                        <span className="metric-label">Active Orders</span>
                      </div>
                      <ChevronRight size={18} className="metric-arrow" />
                    </div>
                    <div className="metric-card" onClick={() => window.location.href = '/listings'}>
                      <div className="metric-icon" style={{ background: '#f5f3ff', color: '#7c3aed' }}><Store size={22} /></div>
                      <div className="metric-data">
                        <span className="metric-num">Browse</span>
                        <span className="metric-label">Farmgate Produce</span>
                      </div>
                      <ChevronRight size={18} className="metric-arrow" />
                    </div>
                  </>
                )}

                {session.user.role === 'TRANSPORTER' && (
                  <>
                    <div className="metric-card" onClick={() => switchTab('transport-vehicles')}>
                      <div className="metric-icon" style={{ background: '#fffbeb', color: '#d97706' }}><Truck size={22} /></div>
                      <div className="metric-data">
                        <span className="metric-num">{vehicles?.data?.length || 0}</span>
                        <span className="metric-label">Fleet Vehicles</span>
                      </div>
                      <ChevronRight size={18} className="metric-arrow" />
                    </div>
                    <div className="metric-card" onClick={() => switchTab('transport-shipments')}>
                      <div className="metric-icon" style={{ background: '#eff6ff', color: '#2563eb' }}><Store size={22} /></div>
                      <div className="metric-data">
                        <span className="metric-num">Shipments</span>
                        <span className="metric-label">Assigned Freight</span>
                      </div>
                      <ChevronRight size={18} className="metric-arrow" />
                    </div>
                  </>
                )}
              </div>

              {/* Quick Actions Card */}
              <div className="dashboard-card">
                <div className="panel-head">
                  <h2>Direct Actions & Shortcuts</h2>
                </div>
                <div className="quick-actions-row">
                  {session.user.role === 'FARMER' && (
                    <>
                      <button type="button" className="button primary" onClick={() => switchTab('farms')}>
                        <Sprout size={16} /> Add Farm Location
                      </button>
                      <button type="button" className="button subtle" onClick={() => switchTab('listings')}>
                        <Store size={16} /> Create Produce Listing
                      </button>
                      <Link to="/prices" className="button subtle">
                        <ExternalLink size={16} /> Agmarknet Mandi Prices
                      </Link>
                      <Link to="/calculator" className="button subtle">
                        Net Return Calculator
                      </Link>
                    </>
                  )}
                  {session.user.role === 'BUYER' && (
                    <>
                      <Link to="/listings" className="button primary">
                        <Store size={16} /> Browse Live Marketplace
                      </Link>
                      <button type="button" className="button subtle" onClick={() => switchTab('offers')}>
                        View My Offers
                      </button>
                      <Link to="/prices" className="button subtle">
                        Mandi Price Discovery
                      </Link>
                    </>
                  )}
                  {session.user.role === 'TRANSPORTER' && (
                    <>
                      <button type="button" className="button primary" onClick={() => switchTab('transport-vehicles')}>
                        <Truck size={16} /> Register New Vehicle
                      </button>
                      <button type="button" className="button subtle" onClick={() => switchTab('transport-shipments')}>
                        View Freight Loads
                      </button>
                    </>
                  )}
                  <button type="button" className="button subtle" onClick={() => switchTab('verification')}>
                    <ShieldCheck size={16} /> Open Verification Center
                  </button>
                </div>
              </div>

              {/* Recent Notifications / Alerts Box */}
              <div className="dashboard-card">
                <div className="panel-head">
                  <h2>Recent Notifications & Activity</h2>
                  <button type="button" className="button subtle small" onClick={() => switchTab('alerts')}>
                    View All
                  </button>
                </div>
                <div className="notifications-preview-list">
                  {(notifications?.data || []).slice(0, 4).map((n) => (
                    <div key={n.id} className="notification-item">
                      <div className="notif-bullet" />
                      <div className="notif-content">
                        <div className="notif-msg">{n.message}</div>
                        <div className="notif-date">{new Date(n.created_at).toLocaleString()}</div>
                      </div>
                    </div>
                  ))}
                  {(!notifications?.data || notifications.data.length === 0) && (
                    <div className="empty-state-card">
                      <Bell size={28} className="empty-icon" />
                      <p>No new notifications at this time.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB: VERIFICATION CENTER */}
          {activeTab === 'verification' && (
            <div className="workspace-stack">
              <div className="dashboard-intro">
                <h2>Account Verification Center</h2>
                <p className="muted">
                  KrishiSetu employs multi-tier verification to protect agricultural transactions, prevent phantom mandi offers, and ensure legally binding settlements.
                </p>
              </div>

              {/* Verification Overview Strip */}
              <div className="verification-strip">
                <div className={`v-metric-item ${session.user.email_verified ? 'passed' : 'pending'}`}>
                  <div className="v-metric-icon"><Mail size={20} /></div>
                  <div className="v-metric-info">
                    <span className="v-title">Email Verification</span>
                    <span className="v-status">{session.user.email_verified ? 'Verified ✓' : 'Pending Verification'}</span>
                  </div>
                </div>

                <div className={`v-metric-item ${session.user.phone_verified ? 'passed' : 'pending'}`}>
                  <div className="v-metric-icon"><Phone size={20} /></div>
                  <div className="v-metric-info">
                    <span className="v-title">Fast2SMS Mobile OTP</span>
                    <span className="v-status">{session.user.phone_verified ? 'Verified ✓' : 'Pending OTP'}</span>
                  </div>
                </div>

                <div className={`v-metric-item ${session.user.identity_verified ? 'passed' : kycStatus?.status === 'PENDING_REVIEW' ? 'review' : 'pending'}`}>
                  <div className="v-metric-icon"><ShieldCheck size={20} /></div>
                  <div className="v-metric-info">
                    <span className="v-title">Government Identity (KYC)</span>
                    <span className="v-status">
                      {session.user.identity_verified ? 'Verified ✓' : kycStatus?.status === 'PENDING_REVIEW' ? 'Under Review ⏳' : 'Not Submitted'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Verification Cards */}
              <div className="verification-cards-stack">
                {/* 1. EMAIL VERIFICATION CARD */}
                <div className="verification-card">
                  <div className="v-card-head">
                    <div className="v-card-title-group">
                      <div className="v-card-icon" style={{ background: '#eff6ff', color: '#2563eb' }}><Mail size={22} /></div>
                      <div>
                        <h3>Primary Email Verification</h3>
                        <p className="muted">Signed verification link sent to your registered email address.</p>
                      </div>
                    </div>
                    <span className={`status-pill ${session.user.email_verified ? 'verified' : 'unverified'}`}>
                      {session.user.email_verified ? 'Verified ✓' : 'Unverified'}
                    </span>
                  </div>

                  <div className="v-card-body">
                    <div className="info-row">
                      <span className="info-label">Registered Email:</span>
                      <span className="info-value"><b>{session.user.email}</b></span>
                    </div>

                    {session.user.email_verified ? (
                      <div className="verified-callout">
                        <CheckCircle2 size={18} style={{ color: '#16a34a' }} />
                        <span>Your email address is verified and active for contract notices and digital invoices.</span>
                      </div>
                    ) : (
                      <div className="unverified-action-box">
                        <p className="muted">
                          Click below to receive a secure, single-use 30-minute verification link in your inbox.
                        </p>
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="button primary"
                            disabled={emailBusy || emailCooldown > 0}
                            onClick={requestEmailVerification}
                          >
                            {emailBusy ? 'Sending...' : emailCooldown > 0 ? `Resend link in ${emailCooldown}s` : 'Send Verification Email'}
                          </button>
                          <button type="button" className="button subtle" onClick={refreshAccount} disabled={refreshing}>
                            Check Status
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. PHONE OTP CARD */}
                <div className="verification-card">
                  <div className="v-card-head">
                    <div className="v-card-title-group">
                      <div className="v-card-icon" style={{ background: '#ecfdf5', color: '#167449' }}>
                        <Phone size={22} />
                      </div>
                      <div>
                        <h3>Mobile Phone Verification</h3>
                        <p className="muted">Authorized SMS OTP verification to safeguard agricultural agreements and carrier dispatches.</p>
                      </div>
                    </div>
                    <span className={`status-pill ${session.user.phone_verified ? 'verified' : challengeId ? 'pending' : 'unverified'}`}>
                      {session.user.phone_verified ? 'Verified ✓' : challengeId ? 'OTP Pending' : 'Unverified'}
                    </span>
                  </div>

                  <div className="v-card-body">
                    {/* Honest SMS Gateway Operational Status */}
                    {opStatus && opStatus.sms_otp === 'UNAVAILABLE' ? (
                      <div className="notice warning" role="status">
                        <AlertTriangle size={18} style={{ color: '#d97706', flexShrink: 0 }} />
                        <div>
                          <b>SMS Gateway Not Configured:</b>
                          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem' }}>
                            Add <code>FAST2SMS_API_KEY</code> in <code>KrishiSetu/.env</code> to enable live phone OTP delivery.
                            Phone verification is honestly disabled until credentials are provided.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="phone-verification-workflow">
                        {/* Active Registered Phone Details */}
                        <div className="info-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <span className="info-label">Active Registered Mobile:</span>
                            <span className="info-value">
                              <b>{session.user.phone ? maskPhone(session.user.phone) : 'No phone number registered'}</b>
                              {session.user.phone_verified && (
                                <span className="verified-badge-inline" style={{ marginLeft: '8px', color: '#16a34a', fontSize: '0.82rem', fontWeight: 700 }}>
                                  ✓ Verified
                                </span>
                              )}
                            </span>
                          </div>

                          {!isEditingPhone && !challengeId && (
                            <button
                              type="button"
                              className="button subtle small"
                              onClick={startChangePhone}
                            >
                              {session.user.phone ? 'Change Number' : '+ Add Number'}
                            </button>
                          )}
                        </div>

                        {/* View Mode: Phone is verified and not currently editing */}
                        {!isEditingPhone && !challengeId && session.user.phone_verified && (
                          <div className="verified-callout" style={{ marginTop: '12px' }}>
                            <CheckCircle2 size={18} style={{ color: '#16a34a' }} />
                            <span>Your mobile number is verified and authorized for direct farmgate trading.</span>
                          </div>
                        )}

                        {/* View Mode: Phone registered but unverified */}
                        {!isEditingPhone && !challengeId && session.user.phone && !session.user.phone_verified && (
                          <div className="phone-unverified-prompt" style={{ marginTop: '12px' }}>
                            <div className="notice warning" style={{ margin: '0 0 12px 0' }}>
                              <AlertCircle size={16} />
                              <span>This number has not been verified yet. Request an SMS code to verify it.</span>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                type="button"
                                className="button primary small"
                                disabled={phoneBusy || smsCooldown > 0}
                                onClick={requestPhoneOtp}
                              >
                                {phoneBusy ? 'Sending...' : smsCooldown > 0 ? `Resend in ${smsCooldown}s` : 'Verify This Number'}
                              </button>
                              <button
                                type="button"
                                className="button subtle small"
                                onClick={startChangePhone}
                              >
                                Change Number
                              </button>
                            </div>
                          </div>
                        )}

                        {/* View Mode: No phone registered */}
                        {!isEditingPhone && !challengeId && !session.user.phone && (
                          <div className="phone-empty-prompt" style={{ marginTop: '12px' }}>
                            <p className="muted" style={{ margin: '0 0 10px 0', fontSize: '0.88rem' }}>
                              Add your mobile number to receive instant SMS updates for mandi orders, transport bids, and buyer agreements.
                            </p>
                            <button
                              type="button"
                              className="button primary small"
                              onClick={startChangePhone}
                            >
                              + Add Mobile Number
                            </button>
                          </div>
                        )}

                        {/* Edit / Change Phone Form */}
                        {isEditingPhone && !challengeId && (
                          <div className="phone-edit-box" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', marginTop: '14px' }}>
                            <h4 style={{ margin: '0 0 6px 0', fontSize: '0.92rem', color: '#0f172a' }}>
                              {session.user.phone ? 'Change Mobile Number' : 'Enter Your Mobile Number'}
                            </h4>
                            <p className="muted" style={{ fontSize: '0.82rem', margin: '0 0 12px 0' }}>
                              A 6-digit SMS code will be sent to confirm ownership before updating your account.
                            </p>

                            {phoneFieldError && (
                              <div className="notice error" style={{ margin: '0 0 12px 0' }}>
                                <AlertCircle size={16} />
                                <span>{phoneFieldError}</span>
                              </div>
                            )}

                            <div className="field" style={{ maxWidth: '340px' }}>
                              <span>10-Digit Indian Mobile Number</span>
                              <input
                                type="tel"
                                placeholder="e.g. 9876543210"
                                value={phoneInput}
                                onChange={(e) => {
                                  setPhoneInput(e.target.value);
                                  if (phoneFieldError) setPhoneFieldError('');
                                }}
                                maxLength={15}
                                autoFocus
                              />
                            </div>

                            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                              <button
                                type="button"
                                className="button primary"
                                disabled={phoneBusy}
                                onClick={requestPhoneOtp}
                              >
                                {phoneBusy ? 'Requesting OTP...' : 'Request SMS OTP'}
                              </button>
                              <button
                                type="button"
                                className="button subtle"
                                disabled={phoneBusy}
                                onClick={cancelChangePhone}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}

                        {/* OTP Entry Form (when challengeId is active) */}
                        {challengeId && (
                          <form onSubmit={confirmPhoneOtp} className="otp-confirm-form" style={{ marginTop: '14px' }}>
                            <div className="notice info" style={{ margin: '0 0 14px 0' }}>
                              <Info size={16} />
                              <div>
                                <span>OTP dispatched to <b>{smsMaskedDest}</b>. Valid for 10 minutes.</span>
                                <div style={{ marginTop: '4px' }}>
                                  <button
                                    type="button"
                                    style={{ background: 'none', border: 'none', color: '#059669', fontSize: '0.82rem', fontWeight: 600, padding: 0, cursor: 'pointer', textDecoration: 'underline' }}
                                    onClick={startChangePhone}
                                  >
                                    Mistyped number? Change number
                                  </button>
                                </div>
                              </div>
                            </div>

                            {phoneFieldError && (
                              <div className="notice error" style={{ margin: '0 0 12px 0' }}>
                                <AlertCircle size={16} />
                                <span>{phoneFieldError}</span>
                              </div>
                            )}

                            <div className="field" style={{ maxWidth: '280px' }}>
                              <span>6-Digit Verification Code</span>
                              <input
                                type="text"
                                required
                                maxLength={6}
                                placeholder="Enter 6-digit OTP"
                                value={phoneCode}
                                onChange={(e) => {
                                  setPhoneCode(e.target.value);
                                  if (phoneFieldError) setPhoneFieldError('');
                                }}
                                autoComplete="one-time-code"
                                style={{ letterSpacing: '0.25em', fontSize: '1.2rem', fontWeight: 700, textAlign: 'center' }}
                                autoFocus
                              />
                            </div>

                            <div style={{ display: 'flex', gap: '10px', marginTop: '14px', alignItems: 'center' }}>
                              <button type="submit" className="button primary" disabled={phoneBusy}>
                                {phoneBusy ? 'Verifying...' : 'Confirm Phone Number'}
                              </button>
                              <button
                                type="button"
                                className="button subtle"
                                disabled={phoneBusy || smsCooldown > 0}
                                onClick={requestPhoneOtp}
                              >
                                {smsCooldown > 0 ? `Resend OTP (${smsCooldown}s)` : 'Resend OTP'}
                              </button>
                              <button
                                type="button"
                                className="button subtle"
                                disabled={phoneBusy}
                                onClick={cancelChangePhone}
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. GOVERNMENT IDENTITY / KYC VERIFICATION CARD */}
                <div className="verification-card">
                  <div className="v-card-head">
                    <div className="v-card-title-group">
                      <div className="v-card-icon" style={{ background: '#f5f3ff', color: '#7c3aed' }}><ShieldCheck size={22} /></div>
                      <div>
                        <h3>Legal Identity & KYC Verification</h3>
                        <p className="muted">Government-aligned verification for formal direct APMC trades, institutional contracts, and freight carriage.</p>
                      </div>
                    </div>
                    <span className={`status-pill ${session.user.identity_verified ? 'verified' : kycStatus?.status === 'PENDING_REVIEW' ? 'pending' : 'unverified'}`}>
                      {session.user.identity_verified ? 'Verified ✓' : kycStatus?.status === 'PENDING_REVIEW' ? 'Under Review ⏳' : 'Unverified'}
                    </span>
                  </div>

                  <div className="v-card-body">
                    {session.user.identity_verified ? (
                      <div className="verified-callout">
                        <CheckCircle2 size={18} style={{ color: '#16a34a' }} />
                        <span>Government identity officially verified by platform administrators. Full marketplace privileges unlocked.</span>
                      </div>
                    ) : kycStatus?.status === 'PENDING_REVIEW' ? (
                      <div className="notice warning" style={{ background: '#fffbeb', borderLeftColor: '#f59e0b' }}>
                        <Clock size={18} style={{ color: '#d97706', flexShrink: 0 }} />
                        <div>
                          <b>Identity Documents Under Review:</b>
                          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem' }}>
                            Your <b>{kycStatus.document_type}</b> (ending in <code>{kycStatus.masked_number}</code>) was submitted on{' '}
                            {kycStatus.submitted_at ? new Date(kycStatus.submitted_at).toLocaleDateString() : 'recently'}.
                            Administrator verification is in progress.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <>
                        {kycStatus?.status === 'REJECTED' && (
                          <div className="notice error">
                            <AlertCircle size={18} style={{ color: '#dc2626', flexShrink: 0 }} />
                            <div>
                              <b>Previous Submission Rejected:</b>
                              <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem' }}>
                                Reason from reviewer: <i>"{kycStatus.reason}"</i>. Please provide corrected details below.
                              </p>
                            </div>
                          </div>
                        )}

                        <p className="muted" style={{ marginBottom: '14px' }}>
                          Submit your government-recognized agricultural or personal identity document for review.
                          Raw numbers are masked and never exposed to other traders.
                        </p>

                        <form onSubmit={handleKycSubmit} className="kyc-submit-form">
                          <div className="form-grid">
                            <label className="field">
                              <span>Document Type</span>
                              <select
                                required
                                value={kycForm.document_type}
                                onChange={(e) => setKycForm({ ...kycForm, document_type: e.target.value })}
                              >
                                <option value="AADHAAR">Aadhaar Card (UIDAI)</option>
                                <option value="PAN">PAN Card (Income Tax Dept)</option>
                                <option value="KISAN_CREDIT_CARD">Kisan Credit Card (KCC)</option>
                                <option value="DRIVING_LICENSE">Commercial Driving License (DL)</option>
                                <option value="TRADE_LICENSE">APMC Mandi Commission Agent / Trader License</option>
                              </select>
                            </label>

                            <label className="field">
                              <span>Document Number</span>
                              <input
                                type="text"
                                required
                                placeholder="e.g. 1234 5678 9012 or ABCDE1234F"
                                value={kycForm.document_number}
                                onChange={(e) => setKycForm({ ...kycForm, document_number: e.target.value })}
                                minLength={6}
                                maxLength={25}
                              />
                            </label>
                          </div>

                          <div className="form-grid">
                            <label className="field">
                              <span>Full Name as on Document</span>
                              <input
                                type="text"
                                required
                                placeholder="Legal name matching document"
                                value={kycForm.full_name}
                                onChange={(e) => setKycForm({ ...kycForm, full_name: e.target.value })}
                              />
                            </label>

                            <label className="field">
                              <span>Notes / Additional Evidence (Optional)</span>
                              <input
                                type="text"
                                placeholder="e.g. Registered with Abohar Mandi Board"
                                value={kycForm.notes}
                                onChange={(e) => setKycForm({ ...kycForm, notes: e.target.value })}
                              />
                            </label>
                          </div>

                          <div style={{ marginTop: '12px' }}>
                            <button type="submit" className="button primary" disabled={kycSubmitting}>
                              {kycSubmitting ? 'Submitting for Review...' : 'Submit Identity for Review'}
                            </button>
                          </div>
                        </form>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: PROFILE SETTINGS */}
          {activeTab === 'profile' && (
            <div className="workspace-stack">
              <div className="dashboard-card">
                <div className="panel-head">
                  <h2>Profile & Contact Details</h2>
                  <span className="chip">Role: {session.user.role}</span>
                </div>

                <form onSubmit={handleProfileSave}>
                  <div className="form-grid">
                    <label className="field">
                      <span>First Name</span>
                      <input
                        type="text"
                        value={profileForm.first_name}
                        onChange={(e) => setProfileForm({ ...profileForm, first_name: e.target.value })}
                      />
                    </label>

                    <label className="field">
                      <span>Last Name</span>
                      <input
                        type="text"
                        value={profileForm.last_name}
                        onChange={(e) => setProfileForm({ ...profileForm, last_name: e.target.value })}
                      />
                    </label>
                  </div>

                  <div className="form-grid">
                    <label className="field">
                      <span>Registered Email (Read-Only)</span>
                      <div className="read-only-input-wrap">
                        <input type="email" value={session.user.email} disabled readOnly />
                        <Lock size={15} className="lock-icon" />
                      </div>
                      <small className="muted">To change email, use Account Security tab.</small>
                    </label>

                    <label className="field">
                      <span>Phone Number</span>
                      <input
                        type="tel"
                        value={profileForm.phone}
                        onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                        placeholder="+91..."
                      />
                      <small className="muted">Changing your phone number requires re-verification via SMS OTP.</small>
                    </label>
                  </div>

                  <div className="form-grid">
                    <label className="field">
                      <span>District / मंडी क्षेत्र</span>
                      <input
                        type="text"
                        placeholder="e.g. Fazilka, Bathinda, Kota"
                        value={profileForm.district}
                        onChange={(e) => setProfileForm({ ...profileForm, district: e.target.value })}
                      />
                    </label>

                    <label className="field">
                      <span>State / राज्य</span>
                      <input
                        type="text"
                        placeholder="e.g. Punjab, Rajasthan, Haryana"
                        value={profileForm.state}
                        onChange={(e) => setProfileForm({ ...profileForm, state: e.target.value })}
                      />
                    </label>
                  </div>

                  <div className="form-grid">
                    <label className="field">
                      <span>Preferred Platform Language</span>
                      <select
                        value={profileForm.preferred_language}
                        onChange={(e) => setProfileForm({ ...profileForm, preferred_language: e.target.value })}
                      >
                        <option value="hi">हिंदी (Hindi)</option>
                        <option value="en">English</option>
                        <option value="pa">ਪੰਜਾਬੀ (Punjabi)</option>
                      </select>
                    </label>
                  </div>

                  <div style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
                    <button type="submit" className="button primary" disabled={profileSaving}>
                      {profileSaving ? 'Saving Changes...' : 'Save Profile Changes'}
                    </button>
                    <button type="button" className="button subtle" onClick={refreshAccount} disabled={refreshing}>
                      Reset
                    </button>
                  </div>
                </form>

                <div style={{ marginTop: '28px', paddingTop: '20px', borderTop: '1px solid var(--c-border)' }}>
                  <h3>External Single Sign-On</h3>
                  <p className="muted" style={{ marginBottom: '12px' }}>Link an official Google account for quick access.</p>
                  <GoogleAuth linkAccount />
                </div>
              </div>
            </div>
          )}

          {/* TAB: SECURITY SETTINGS */}
          {activeTab === 'security' && (
            <div className="workspace-stack">
              <AccountSecurity onUserUpdate={setUser} />
            </div>
          )}

          {/* TAB: FARMS (FARMER) */}
          {activeTab === 'farms' && session.user.role === 'FARMER' && (
            <div className="workspace-stack">
              <FarmManager />
            </div>
          )}

          {/* TAB: PRODUCE LISTINGS (FARMER) */}
          {activeTab === 'listings' && session.user.role === 'FARMER' && (
            <div className="workspace-stack">
              <MyListings />
            </div>
          )}

          {/* TAB: OFFERS (FARMER / BUYER) */}
          {activeTab === 'offers' && (
            <div className="workspace-stack">
              <OffersWorkflow user={session.user} />
            </div>
          )}

          {/* TAB: ORDERS & SHIPMENTS (FARMER / BUYER) */}
          {activeTab === 'orders' && (
            <div className="workspace-stack">
              <OrdersWorkflow role={session.user.role} />
            </div>
          )}

          {/* TAB: TRADE CASEWORK & RESOLUTIONS */}
          {activeTab === 'trade-resolution' && (
            <div className="workspace-stack">
              <TradeCasework user={session.user} />
            </div>
          )}

          {/* TAB: MANDI INTELLIGENCE */}
          {activeTab === 'intelligence' && (
            <div className="workspace-stack">
              <IntelligenceTools role={session.user.role} />
            </div>
          )}

          {/* TAB: FLEET & VEHICLES (TRANSPORTER) */}
          {activeTab === 'transport-vehicles' && session.user.role === 'TRANSPORTER' && (
            <div className="workspace-stack">
              <TransportVehiclesSection />
            </div>
          )}

          {/* TAB: FREIGHT SHIPMENTS (TRANSPORTER) */}
          {activeTab === 'transport-shipments' && session.user.role === 'TRANSPORTER' && (
            <div className="workspace-stack">
              <TransportShipmentsSection />
            </div>
          )}

          {/* TAB: ADMIN REVIEW QUEUE (ADMIN) */}
          {activeTab === 'admin-queue' && session.user.role === 'ADMIN' && (
            <div className="workspace-stack">
              <AdminReview />
            </div>
          )}

          {/* TAB: NOTIFICATIONS */}
          {activeTab === 'alerts' && (
            <div className="workspace-stack">
              <div className="dashboard-card">
                <div className="panel-head">
                  <h2>In-App Notifications</h2>
                  <span className="chip">{notifications?.data?.length || 0} Total</span>
                </div>
                <div className="notifications-full-list">
                  {(notifications?.data || []).map((n) => (
                    <div key={n.id} className="notification-full-item">
                      <div className="notif-full-icon">
                        <Bell size={18} />
                      </div>
                      <div className="notif-full-body">
                        <p className="notif-full-text">{n.message}</p>
                        <small className="notif-full-date">{new Date(n.created_at).toLocaleString()}</small>
                      </div>
                    </div>
                  ))}
                  {(!notifications?.data || notifications.data.length === 0) && (
                    <div className="empty-state-card">
                      <Bell size={36} className="empty-icon" />
                      <p>No notifications on record.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// Onboarding Steps Calculator
function getOnboardingSteps(user, data) {
  const common = [
    {
      title: '1. Create Account',
      desc: `Registered as ${user.role} (${user.email})`,
      completed: true,
    },
    {
      title: '2. Verify Email & Mobile OTP',
      desc: user.account_verified ? 'Both email and mobile numbers verified' : 'Verify email and phone via Fast2SMS',
      completed: !!user.account_verified,
      action: !user.account_verified ? { label: 'Verify Now', tab: 'verification' } : null,
    },
  ];

  if (user.role === 'FARMER') {
    const hasFarm = (data.farms || []).length > 0;
    const hasListing = (data.listings || []).length > 0;
    return [
      ...common,
      {
        title: '3. Add Farm Location',
        desc: hasFarm ? `${data.farms.length} farm location(s) recorded` : 'Add village, district & coordinates',
        completed: hasFarm,
        action: !hasFarm ? { label: 'Add Farm', tab: 'farms' } : null,
      },
      {
        title: '4. Create Produce Listing',
        desc: hasListing ? `${data.listings.length} active produce listing(s)` : 'List wheat, mustard or other harvested crop',
        completed: hasListing,
        action: !hasListing ? { label: 'Create Listing', tab: 'listings' } : null,
      },
    ];
  }

  if (user.role === 'BUYER') {
    const hasOffers = (data.offers || []).length > 0;
    return [
      ...common,
      {
        title: '3. Browse Farmgate Produce',
        desc: 'Explore source-verified crops across Punjab, Haryana & Rajasthan',
        completed: hasOffers,
        action: { label: 'Browse Marketplace', url: '/listings' },
      },
      {
        title: '4. Submit Purchase Offer',
        desc: hasOffers ? `${data.offers.length} offer(s) submitted to farmers` : 'Negotiate price and delivery terms directly',
        completed: hasOffers,
        action: !hasOffers ? { label: 'Browse & Offer', url: '/listings' } : null,
      },
    ];
  }

  if (user.role === 'TRANSPORTER') {
    const hasVehicles = (data.vehicles || []).length > 0;
    return [
      ...common,
      {
        title: '3. Register Commercial Vehicle',
        desc: hasVehicles ? `${data.vehicles.length} vehicle(s) registered` : 'Add truck, pickup or tractor with capacity',
        completed: hasVehicles,
        action: !hasVehicles ? { label: 'Add Vehicle', tab: 'transport-vehicles' } : null,
      },
      {
        title: '4. Submit Freight Quotations',
        desc: 'Quote on farmer-buyer shipping requests along major mandi corridors',
        completed: false,
        action: { label: 'View Freight', tab: 'transport-shipments' },
      },
    ];
  }

  return common;
}

// Data fetching helper
function useDataIf(url, condition) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(condition);
  useEffect(() => {
    if (!condition) return;
    let live = true;
    setLoading(true);
    api.get(url)
      .then((r) => { if (live) setData(entries(r)); })
      .catch(() => { })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [url, condition]);
  return { data, loading };
}

// Transporter Subcomponents
function TransportVehiclesSection() {
  const vehicles = useDataIf('vehicles/', true);
  const [form, setForm] = useState({ registration: '', vehicle_type: 'TRUCK', capacity_qtl: '' });
  const [msg, setMsg] = useState('');

  async function addVehicle(e) {
    e.preventDefault();
    try {
      await api.post('vehicles/', form);
      setMsg('Vehicle submitted for administrator review.');
      setForm({ registration: '', vehicle_type: 'TRUCK', capacity_qtl: '' });
      vehicles.data = [...(vehicles.data || []), { ...form, verified: false, id: Date.now() }];
    } catch (e) {
      setMsg(errorMessage(e));
    }
  }

  return (
    <div className="dashboard-card">
      <div className="panel-head">
        <h2>Fleet & Commercial Vehicles</h2>
      </div>
      {msg && <div className="notice info">{msg}</div>}
      <form onSubmit={addVehicle} style={{ marginBottom: '24px' }}>
        <div className="form-grid">
          <label className="field">
            <span>Vehicle Registration Number</span>
            <input
              required
              placeholder="e.g. PB-08-AB-1234"
              value={form.registration}
              onChange={(e) => setForm({ ...form, registration: e.target.value })}
            />
          </label>
          <label className="field">
            <span>Vehicle Type</span>
            <input
              required
              placeholder="e.g. TRUCK, PICKUP, TRACTOR_TROLLEY"
              value={form.vehicle_type}
              onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })}
            />
          </label>
          <label className="field">
            <span>Payload Capacity (Quintals)</span>
            <input
              type="number"
              min="0.1"
              step="0.1"
              required
              placeholder="e.g. 100"
              value={form.capacity_qtl}
              onChange={(e) => setForm({ ...form, capacity_qtl: e.target.value })}
            />
          </label>
        </div>
        <button className="button primary" style={{ marginTop: '12px' }}>Register Vehicle</button>
      </form>

      <h3>Registered Fleet</h3>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Registration</th>
              <th>Type</th>
              <th>Capacity</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {(vehicles.data || []).map((v) => (
              <tr key={v.id}>
                <td><b>{v.registration}</b></td>
                <td>{v.vehicle_type}</td>
                <td>{v.capacity_qtl} qtl</td>
                <td>
                  <span className={`status-pill ${v.verified ? 'verified' : 'unverified'}`}>
                    {v.verified ? 'Approved ✓' : 'Pending Review'}
                  </span>
                </td>
              </tr>
            ))}
            {(!vehicles.data || vehicles.data.length === 0) && (
              <tr><td colSpan={4} style={{ textAlign: 'center', color: '#688273' }}>No vehicles registered yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TransportShipmentsSection() {
  const requests = useDataIf('freight/requests/', true);
  const quotes = useDataIf('freight/quotes/', true);
  const shipments = useDataIf('shipments/', true);
  const vehicles = useDataIf('vehicles/', true);

  const [quoteForm, setQuoteForm] = useState({ freight_request: '', vehicle: '', price_inr: '' });
  const [msg, setMsg] = useState('');

  async function submitQuote(e) {
    e.preventDefault();
    try {
      await api.post('freight/quotes/', quoteForm);
      setMsg('Freight quote submitted successfully.');
      setQuoteForm({ freight_request: '', vehicle: '', price_inr: '' });
    } catch (e) {
      setMsg(errorMessage(e));
    }
  }

  return (
    <div className="workspace-stack">
      <div className="dashboard-card">
        <div className="panel-head">
          <h2>Available Freight Requests & Quotations</h2>
        </div>
        {msg && <div className="notice info">{msg}</div>}
        <form onSubmit={submitQuote} style={{ marginBottom: '24px' }}>
          <div className="form-grid">
            <label className="field">
              <span>Select Freight Request</span>
              <select
                required
                value={quoteForm.freight_request}
                onChange={(e) => setQuoteForm({ ...quoteForm, freight_request: e.target.value })}
              >
                <option value="">Choose freight load</option>
                {(requests.data || []).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.pickup_location} → {r.dropoff_location} (Pickup: {r.pickup_date})
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Assigned Vehicle</span>
              <select
                required
                value={quoteForm.vehicle}
                onChange={(e) => setQuoteForm({ ...quoteForm, vehicle: e.target.value })}
              >
                <option value="">Choose vehicle</option>
                {(vehicles.data || []).map((v) => (
                  <option key={v.id} value={v.id}>{v.registration} ({v.capacity_qtl} qtl)</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Freight Quote (₹ INR)</span>
              <input
                type="number"
                min="1"
                step="1"
                required
                placeholder="Total transport cost in ₹"
                value={quoteForm.price_inr}
                onChange={(e) => setQuoteForm({ ...quoteForm, price_inr: e.target.value })}
              />
            </label>
          </div>
          <button className="button primary" style={{ marginTop: '12px' }}>Submit Freight Quote</button>
        </form>
      </div>

      <div className="dashboard-card">
        <div className="panel-head">
          <h2>Active Freight Shipments</h2>
        </div>
        <div className="shipments-list">
          {(shipments.data || []).map((sh) => (
            <div key={sh.id} className="order-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <b>Order #{String(sh.order).slice(0, 8)}</b>
                <span className="status-pill verified">{sh.status}</span>
              </div>
              <ShipmentTimeline id={sh.id} />
            </div>
          ))}
          {(!shipments.data || shipments.data.length === 0) && (
            <p className="muted" style={{ textAlign: 'center', padding: '24px' }}>No active freight shipments assigned.</p>
          )}
        </div>
      </div>
    </div>
  );
}
