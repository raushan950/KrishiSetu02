import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Sprout, Store, ArrowUpRight, Truck, ShieldCheck, Bell, Calculator,
  TrendingUp, MapPin, CheckCircle2, AlertTriangle, Plus, Scale,
  ChevronRight, RefreshCw, FileCheck2
} from 'lucide-react';
import { api, entries, errorMessage } from './api.js';
import { SearchableSelect } from './SearchableSelect.jsx';
import { FarmManager, OffersWorkflow, OrdersWorkflow, PriceAlerts, ForecastView } from './Workspace.jsx';
import { MyListings, TradeCasework } from './TradeResolution.jsx';

const money = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(v || 0));

function useDataset(url, enabled = true) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState('');

  async function refresh() {
    if (!enabled) return;
    setLoading(true);
    try {
      const res = await api.get(url);
      setData(entries(res));
      setError('');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (enabled) refresh();
  }, [url, enabled]);

  return { data, loading, error, refresh };
}

export function FarmerWorkspace({ session, t, lang = 'en' }) {
  const [params, setParams] = useSearchParams();
  const urlTab = params.get('tab') || (params.get('create') === '1' ? 'listings' : 'overview');
  const [activeTab, setActiveTab] = useState(urlTab);

  useEffect(() => {
    const nextTab = params.get('tab') || (params.get('create') === '1' ? 'listings' : null);
    if (nextTab && nextTab !== activeTab) {
      setActiveTab(nextTab);
    }
  }, [params]);

  function switchTab(tabId) {
    setActiveTab(tabId);
    setParams({ tab: tabId });
  }

  const farms = useDataset('farms/');
  const listings = useDataset('my-listings/');
  const offers = useDataset('offers/');
  const orders = useDataset('orders/');
  const crops = useDataset('crops/');
  const notifications = useDataset('notifications/');

  // New Listing creation form state (supports pre-fill from Find Best Market)
  const [listingForm, setListingForm] = useState({
    crop: params.get('crop') || '',
    farm: '',
    variety: params.get('variety') || '',
    grade: params.get('grade') || 'FAQ',
    quantity_qtl: params.get('quantity') || '',
    asking_per_qtl: params.get('asking_price') || '',
    district: session?.user?.district || '',
    state: session?.user?.state || '',
    description: ''
  });
  const [photo, setPhoto] = useState(null);
  const [createBusy, setCreateBusy] = useState(false);
  const [createMsg, setCreateMsg] = useState(null);

  async function publishListing(e) {
    e.preventDefault();
    setCreateBusy(true);
    setCreateMsg(null);
    try {
      const payload = new FormData();
      Object.entries(listingForm).forEach(([k, v]) => {
        if (v !== '' && v !== null && v !== undefined) payload.append(k, v);
      });
      if (photo) payload.append('image', photo);
      await api.post('listings/', payload);
      setCreateMsg({
        type: 'success',
        text: lang === 'hi'
          ? 'फसल सूची सफलतापूर्वक प्रकाशित हो गई। अब सत्यापित खरीदार प्रस्ताव भेज सकते हैं।'
          : lang === 'pa'
          ? 'ਫ਼ਸਲ ਸੂਚੀ ਸਫਲਤਾਪੂਰਵਕ ਪ੍ਰਕਾਸ਼ਿਤ ਹੋ ਗਈ। ਹੁਣ ਵਪਾਰੀ ਪ੍ਰਸਤਾਵ ਭੇਜ ਸਕਦੇ ਹਨ।'
          : 'Produce listing published successfully! Verified commercial buyers can now discover and bid on your harvest.'
      });
      setPhoto(null);
      setListingForm(f => ({ ...f, crop: '', variety: '', quantity_qtl: '', asking_per_qtl: '', description: '' }));
      listings.refresh();
    } catch (err) {
      setCreateMsg({ type: 'error', text: errorMessage(err) });
    } finally {
      setCreateBusy(false);
    }
  }

  const user = session.user;
  const pendingIncomingOffers = offers.data.filter(o => o.status === 'PENDING' && o.proposed_by !== user.id);
  const activeListings = listings.data.filter(l => l.status === 'ACTIVE');
  const totalAvailableQtl = activeListings.reduce((sum, l) => sum + Number(l.available_qtl || 0), 0);

  const tabs = [
    { id: 'overview', label: lang === 'hi' ? 'किसान अवलोकन' : lang === 'pa' ? 'ਕਿਸਾਨ ਸੰਖੇਪ' : 'Harvest Overview', icon: Sprout },
    { id: 'farms', label: lang === 'hi' ? 'मेरे खेत' : lang === 'pa' ? 'ਮੇਰੇ ਖੇਤ' : 'My Farms', icon: MapPin, count: farms.data.length },
    { id: 'listings', label: lang === 'hi' ? 'मेरी उपज एवं स्टॉक' : lang === 'pa' ? 'ਮੇਰੀ ਫ਼ਸਲ ਅਤੇ ਸਟਾਕ' : 'Produce & Inventory', icon: Store, count: activeListings.length },
    { id: 'offers', label: lang === 'hi' ? 'खरीद प्रस्ताव' : lang === 'pa' ? 'ਖਰੀਦ ਪ੍ਰਸਤਾਵ' : 'Incoming Offers', icon: ArrowUpRight, count: pendingIncomingOffers.length },
    { id: 'orders', label: lang === 'hi' ? 'आदेश व परिवहन' : lang === 'pa' ? 'ਆਰਡਰ ਅਤੇ ਢੁਆਈ' : 'Orders & Freight', icon: Truck, count: orders.data.length },
    { id: 'settlements', label: lang === 'hi' ? 'निपटान व विवाद' : lang === 'pa' ? 'ਨਿਪਟਾਰਾ ਤੇ ਵਿਵਾਦ' : 'Delivery & Settlements', icon: FileCheck2 },
    { id: 'intelligence', label: lang === 'hi' ? 'मूल्य अलर्ट व पूर्वानुमान' : lang === 'pa' ? 'ਭਾਅ ਅਲਰਟ ਅਤੇ ਅਨੁਮਾਨ' : 'Price Alerts & Forecast', icon: TrendingUp }
  ];

  return (
    <main className="container page">
      {/* Role Hub Header */}
      <div className="role-hub-banner farmer-hub">
        <div className="role-hub-identity">
          <div className="role-hub-icon"><Sprout size={26} /></div>
          <div>
            <div className="role-hub-eyebrow">
              <span className="role-hub-tag">{lang === 'hi' ? 'किसान कार्यक्षेत्र' : lang === 'pa' ? 'ਕਿਸਾਨ ਵਰਕਸਪੇਸ' : 'FARMER WORKSPACE'}</span>
              {user.identity_verified ? (
                <span className="status-pill verified"><ShieldCheck size={12} /> KYC Verified Grower</span>
              ) : user.account_verified ? (
                <span className="status-pill verified"><CheckCircle2 size={12} /> Phone & Email Verified</span>
              ) : (
                <span className="status-pill unverified"><AlertTriangle size={12} /> Verification Incomplete</span>
              )}
            </div>
            <h1>{user.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : 'Farmer'} — {lang === 'hi' ? 'फसल व बाज़ार प्रबंधन' : lang === 'pa' ? 'ਫ਼ਸਲ ਅਤੇ ਬਾਜ਼ਾਰ ਪ੍ਰਬੰਧਨ' : 'Harvest & Direct Sales Hub'}</h1>
            <p className="muted" style={{ margin: 0 }}>
              {[user.district, user.state].filter(Boolean).join(', ') || 'India'} · Direct farmgate sales, APMC net price intelligence, and carrier dispatch.
            </p>
          </div>
        </div>
        <div className="role-hub-actions">
          <Link to="/compare" className="button primary small">
            <Scale size={15} /> {t.findBestMarket || 'Find Best Market'}
          </Link>
          <button type="button" className="button subtle small" onClick={() => switchTab('listings')}>
            <Plus size={15} /> {lang === 'hi' ? 'नई फसल बेचें' : lang === 'pa' ? 'ਨਵੀਂ ਫ਼ਸਲ ਵੇਚੋ' : 'List Harvest'}
          </button>
        </div>
      </div>

      {/* Honest Verification Warning Banner */}
      {!user.account_verified && (
        <div className="notice warning" style={{ marginBottom: '20px', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle size={18} style={{ color: '#d97706', flexShrink: 0 }} />
            <span>
              <b>Action Required to Publish & Trade:</b> Verify both your email and mobile number before creating listings, accepting buyer offers, or assigning transporters.
            </span>
          </div>
          <Link to="/account?tab=verification" className="button primary small">Open Verification Center →</Link>
        </div>
      )}

      {/* Workspace Navigation Layout */}
      <div className="account-layout">
        <aside className="account-sidebar" aria-label="Farmer Workspace Sections">
          <div className="sidebar-group-label">{lang === 'hi' ? 'किसान मेनू' : lang === 'pa' ? 'ਕਿਸਾਨ ਮੀਨੂ' : 'FARMER MENU'}</div>
          <nav className="account-nav-list">
            {tabs.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`account-nav-item ${activeTab === item.id ? 'active' : ''}`}
                  onClick={() => switchTab(item.id)}
                >
                  <Icon size={18} className="nav-icon" />
                  <span className="nav-label">{item.label}</span>
                  {item.count > 0 && <span className="nav-count">{item.count}</span>}
                </button>
              );
            })}
          </nav>

          <div className="sidebar-footer-card">
            <div className="sidebar-footer-title">Smart Selling Tool</div>
            <p className="sidebar-footer-desc">Compare APMC mandi modal benchmarks vs transport freight before fixing your asking price.</p>
            <Link to="/compare" className="sidebar-footer-link">Open Find Best Market <ChevronRight size={14} /></Link>
          </div>
        </aside>

        <section className="account-content">
          {activeTab === 'overview' && (
            <div className="workspace-stack">
              {/* KPI Strip */}
              <div className="dashboard-metrics-grid">
                <div className="metric-card" onClick={() => switchTab('farms')}>
                  <div className="metric-icon" style={{ background: '#ecfdf5', color: '#059669' }}><MapPin size={22} /></div>
                  <div className="metric-data">
                    <span className="metric-num">{farms.data.length}</span>
                    <span className="metric-label">Registered Farms</span>
                  </div>
                  <ChevronRight size={18} className="metric-arrow" />
                </div>

                <div className="metric-card" onClick={() => switchTab('listings')}>
                  <div className="metric-icon" style={{ background: '#f0fdf4', color: '#15803d' }}><Store size={22} /></div>
                  <div className="metric-data">
                    <span className="metric-num">{totalAvailableQtl.toFixed(1)} qtl</span>
                    <span className="metric-label">{activeListings.length} Active Listings</span>
                  </div>
                  <ChevronRight size={18} className="metric-arrow" />
                </div>

                <div className="metric-card" onClick={() => switchTab('offers')}>
                  <div className="metric-icon" style={{ background: '#eff6ff', color: '#2563eb' }}><ArrowUpRight size={22} /></div>
                  <div className="metric-data">
                    <span className="metric-num">{pendingIncomingOffers.length}</span>
                    <span className="metric-label">Offers Awaiting Reply</span>
                  </div>
                  <ChevronRight size={18} className="metric-arrow" />
                </div>

                <div className="metric-card" onClick={() => switchTab('orders')}>
                  <div className="metric-icon" style={{ background: '#fef3c7', color: '#d97706' }}><Truck size={22} /></div>
                  <div className="metric-data">
                    <span className="metric-num">{orders.data.length}</span>
                    <span className="metric-label">Orders & Shipments</span>
                  </div>
                  <ChevronRight size={18} className="metric-arrow" />
                </div>
              </div>

              {/* Quick Actions */}
              <div className="dashboard-card">
                <div className="panel-head">
                  <h2>Recommended Farmer Actions</h2>
                </div>
                <div className="quick-actions-row">
                  <Link to="/compare" className="button primary">
                    <Scale size={16} /> Find My Best Market
                  </Link>
                  <button type="button" className="button subtle" onClick={() => switchTab('listings')}>
                    <Plus size={16} /> Publish Harvest Listing
                  </button>
                  <button type="button" className="button subtle" onClick={() => switchTab('farms')}>
                    <MapPin size={16} /> Add Farm Location
                  </button>
                  <Link to="/calculator" className="button subtle">
                    <Calculator size={16} /> Net Margin Calculator
                  </Link>
                  <Link to="/prices" className="button subtle">
                    <TrendingUp size={16} /> Check Mandi Prices
                  </Link>
                </div>
              </div>

              {/* Pending Offers Preview */}
              {pendingIncomingOffers.length > 0 && (
                <div className="dashboard-card">
                  <div className="panel-head">
                    <h2>Buyer Offers Requiring Action</h2>
                    <button type="button" className="button subtle small" onClick={() => switchTab('offers')}>Review All →</button>
                  </div>
                  <div className="workspace-stack">
                    {pendingIncomingOffers.slice(0, 3).map(o => (
                      <div key={o.id} className="result-line">
                        <div>
                          <b>{o.crop_name} · {o.quantity_qtl} qtl @ {money(o.price_per_qtl)}/qtl</b>
                          <small>From {o.buyer_name} · {o.buyer_verified ? 'Verified Buyer' : 'Unverified'}</small>
                        </div>
                        <button type="button" className="button primary small" onClick={() => switchTab('offers')}>Respond</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notifications */}
              <div className="dashboard-card">
                <div className="panel-head">
                  <h2>Recent Farm & Trade Alerts</h2>
                </div>
                <div className="notifications-preview-list">
                  {notifications.data.slice(0, 4).map(n => (
                    <div key={n.id} className="notification-item">
                      <div className="notif-bullet" />
                      <div className="notif-content">
                        <div className="notif-msg">{n.message}</div>
                        <div className="notif-date">{new Date(n.created_at).toLocaleString()}</div>
                      </div>
                    </div>
                  ))}
                  {notifications.data.length === 0 && (
                    <div className="empty-state-card">
                      <Bell size={26} className="empty-icon" />
                      <p>No recent notifications.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'farms' && <FarmManager />}

          {activeTab === 'listings' && (
            <div className="workspace-stack">
              <section className="panel">
                <div className="panel-head">
                  <h2>Publish New Produce Listing</h2>
                  <span className="chip">0% Brokerage</span>
                </div>
                {createMsg && (
                  <div className={`notice ${createMsg.type}`}>{createMsg.text}</div>
                )}
                <form onSubmit={publishListing}>
                  <div className="form-grid">
                    <label className="field">
                      <span>Crop *</span>
                      <SearchableSelect
                        options={crops.data}
                        value={listingForm.crop}
                        onChange={(val) => setListingForm({ ...listingForm, crop: val })}
                        placeholder="Search crop (e.g. Wheat, Mustard)..."
                        emptyOption="Select crop"
                        required
                      />
                    </label>
                    <label className="field">
                      <span>Farm Origin (Optional)</span>
                      <select
                        value={listingForm.farm}
                        onChange={(e) => {
                          const farmObj = farms.data.find(f => String(f.id) === e.target.value);
                          setListingForm({
                            ...listingForm,
                            farm: e.target.value,
                            district: farmObj?.district || listingForm.district,
                            state: farmObj?.state || listingForm.state
                          });
                        }}
                      >
                        <option value="">Not linked to specific farm</option>
                        {farms.data.map(f => (
                          <option key={f.id} value={f.id}>{f.name} ({f.district}, {f.state})</option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Variety (Optional)</span>
                      <input
                        placeholder="e.g. Kalyan Sona, Sharbati, RH-749"
                        value={listingForm.variety}
                        onChange={(e) => setListingForm({ ...listingForm, variety: e.target.value })}
                      />
                    </label>
                    <label className="field">
                      <span>Grade</span>
                      <input
                        placeholder="e.g. FAQ, Grade A, Bold"
                        value={listingForm.grade}
                        onChange={(e) => setListingForm({ ...listingForm, grade: e.target.value })}
                      />
                    </label>
                    <label className="field">
                      <span>Available Quantity (Quintals) *</span>
                      <input
                        type="number"
                        min="0.001"
                        step="0.001"
                        required
                        placeholder="e.g. 50"
                        value={listingForm.quantity_qtl}
                        onChange={(e) => setListingForm({ ...listingForm, quantity_qtl: e.target.value })}
                      />
                    </label>
                    <label className="field">
                      <span>Asking Price (₹ / Quintal) *</span>
                      <input
                        type="number"
                        min="1"
                        step="0.01"
                        required
                        placeholder="e.g. 2450"
                        value={listingForm.asking_per_qtl}
                        onChange={(e) => setListingForm({ ...listingForm, asking_per_qtl: e.target.value })}
                      />
                    </label>
                    <label className="field">
                      <span>District *</span>
                      <input
                        required
                        placeholder="e.g. Fatehgarh Sahib"
                        value={listingForm.district}
                        onChange={(e) => setListingForm({ ...listingForm, district: e.target.value })}
                      />
                    </label>
                    <label className="field">
                      <span>State *</span>
                      <input
                        required
                        placeholder="e.g. Punjab"
                        value={listingForm.state}
                        onChange={(e) => setListingForm({ ...listingForm, state: e.target.value })}
                      />
                    </label>
                  </div>
                  <label className="field" style={{ marginTop: '10px' }}>
                    <span>Quality & Harvest Notes</span>
                    <textarea
                      rows={2}
                      placeholder="Moisture content, harvest date, bagging type (e.g. 50kg jute bags)"
                      value={listingForm.description}
                      onChange={(e) => setListingForm({ ...listingForm, description: e.target.value })}
                    />
                  </label>
                  <label className="field" style={{ marginTop: '10px' }}>
                    <span>Produce Photo (JPEG, PNG, WebP; max 5 MB)</span>
                    <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setPhoto(e.target.files?.[0] || null)} />
                  </label>
                  <button className="button primary" disabled={createBusy || !user.account_verified} style={{ marginTop: '12px' }}>
                    {createBusy ? 'Publishing...' : 'Publish Listing to Marketplace'}
                  </button>
                </form>
              </section>

              <MyListings onRefresh={listings.refresh} />
            </div>
          )}

          {activeTab === 'offers' && <OffersWorkflow user={user} />}
          {activeTab === 'orders' && <OrdersWorkflow role="FARMER" />}
          {activeTab === 'settlements' && <TradeCasework user={user} />}
          {activeTab === 'intelligence' && (
            <div className="workspace-stack">
              <PriceAlerts />
              <ForecastView />
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

