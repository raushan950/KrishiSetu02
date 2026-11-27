import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Store, ArrowUpRight, Truck, ShieldCheck, Bell, TrendingUp,
  CheckCircle2, AlertTriangle, Search, ChevronRight, FileCheck2
} from 'lucide-react';
import { api, entries, errorMessage } from './api.js';
import { OffersWorkflow, OrdersWorkflow, PriceAlerts } from './Workspace.jsx';
import { TradeCasework } from './TradeResolution.jsx';

const money = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(v || 0));

function useDataset(url) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      const res = await api.get(url);
      setData(entries(res));
    } catch {
      // handled cleanly inside sub-views
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, [url]);

  return { data, loading, refresh };
}

export function BuyerWorkspace({ session, t, lang = 'en' }) {
  const [params, setParams] = useSearchParams();
  const urlTab = params.get('tab') || 'overview';
  const [activeTab, setActiveTab] = useState(urlTab);

  useEffect(() => {
    if (params.get('tab') && params.get('tab') !== activeTab) {
      setActiveTab(params.get('tab'));
    }
  }, [params]);

  function switchTab(tabId) {
    setActiveTab(tabId);
    setParams({ tab: tabId });
  }

  const offers = useDataset('offers/');
  const orders = useDataset('orders/');
  const notifications = useDataset('notifications/');
  const user = session.user;

  const pendingOffers = offers.data.filter(o => o.status === 'PENDING');
  const waitingBuyerReply = pendingOffers.filter(o => o.proposed_by !== user.id);
  const activeOrders = orders.data.filter(o => ['CONFIRMED', 'DISPATCHED', 'DELIVERED', 'PARTIALLY_FULFILLED'].includes(o.status));

  const tabs = [
    { id: 'overview', label: lang === 'hi' ? 'खरीदार अवलोकन' : lang === 'pa' ? 'ਖਰੀਦਦਾਰ ਸੰਖੇਪ' : 'Procurement Overview', icon: Store },
    { id: 'offers', label: lang === 'hi' ? 'मेरे प्रस्ताव व मोलभाव' : lang === 'pa' ? 'ਮੇਰੇ ਪ੍ਰਸਤਾਵ ਤੇ ਗੱਲਬਾਤ' : 'Offers & Negotiations', icon: ArrowUpRight, count: pendingOffers.length },
    { id: 'orders', label: lang === 'hi' ? 'आदेश, भुगतान व ढुलाई' : lang === 'pa' ? 'ਆਰਡਰ, ਭੁਗਤਾਨ ਤੇ ਢੁਆਈ' : 'Orders & Logistics', icon: Truck, count: activeOrders.length },
    { id: 'deliveries', label: lang === 'hi' ? 'डिलीवरी स्वीकृति व निपटान' : lang === 'pa' ? 'ਡਿਲੀਵਰੀ ਪ੍ਰਵਾਨਗੀ ਤੇ ਨਿਪਟਾਰਾ' : 'Delivery & Settlements', icon: FileCheck2 },
    { id: 'alerts', label: lang === 'hi' ? 'मंडी मूल्य अलर्ट' : lang === 'pa' ? 'ਮੰਡੀ ਭਾਅ ਅਲਰਟ' : 'Price Alerts', icon: Bell }
  ];

  return (
    <main className="container page">
      {/* Buyer Role Banner */}
      <div className="role-hub-banner buyer-hub">
        <div className="role-hub-identity">
          <div className="role-hub-icon buyer"><Store size={26} /></div>
          <div>
            <div className="role-hub-eyebrow">
              <span className="role-hub-tag buyer">{lang === 'hi' ? 'व्यावसायिक खरीदार कार्यक्षेत्र' : lang === 'pa' ? 'ਵਪਾਰਕ ਖਰੀਦਦਾਰ ਵਰਕਸਪੇਸ' : 'COMMERCIAL BUYER WORKSPACE'}</span>
              {user.identity_verified && user.account_verified ? (
                <span className="status-pill verified"><ShieldCheck size={12} /> KYC Verified Buyer</span>
              ) : user.account_verified ? (
                <span className="status-pill verified"><CheckCircle2 size={12} /> Email & Phone Verified</span>
              ) : (
                <span className="status-pill unverified"><AlertTriangle size={12} /> Unverified Buyer Account</span>
              )}
            </div>
            <h1>{user.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : 'Buyer'} — {lang === 'hi' ? 'सीधा फसल क्रय केंद्र' : lang === 'pa' ? 'ਸਿੱਧੀ ਫ਼ਸਲ ਖਰੀਦ ਕੇਂਦਰ' : 'Direct Procurement & Sourcing Hub'}</h1>
            <p className="muted" style={{ margin: 0 }}>
              {[user.district, user.state].filter(Boolean).join(', ') || 'India'} · Source directly from farmers with atomic stock locks and transparent logistics.
            </p>
          </div>
        </div>
        <div className="role-hub-actions">
          <Link to="/listings" className="button primary small">
            <Search size={15} /> {lang === 'hi' ? 'फसल बाज़ार ब्राउज़ करें' : lang === 'pa' ? 'ਫ਼ਸਲ ਬਾਜ਼ਾਰ ਵੇਖੋ' : 'Source Crops'}
          </Link>
          <Link to="/prices" className="button subtle small">
            <TrendingUp size={15} /> {lang === 'hi' ? 'मंडी भाव संदर्भ' : lang === 'pa' ? 'ਮੰਡੀ ਭਾਅ ਵੇਖੋ' : 'Mandi Benchmarks'}
          </Link>
        </div>
      </div>

      {/* Honest Verification Warning */}
      {!user.account_verified && (
        <div className="notice warning" style={{ marginBottom: '20px', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle size={18} style={{ color: '#d97706', flexShrink: 0 }} />
            <span>
              <b>Verification Required to Submit Offers:</b> Complete email and mobile OTP verification before submitting binding purchase offers or accepting deliveries.
            </span>
          </div>
          <Link to="/account?tab=verification" className="button primary small">Verify Account Now →</Link>
        </div>
      )}

      <div className="account-layout">
        <aside className="account-sidebar" aria-label="Buyer Workspace Sections">
          <div className="sidebar-group-label">{lang === 'hi' ? 'खरीदार मेनू' : lang === 'pa' ? 'ਖਰੀਦਦਾਰ ਮੀਨੂ' : 'BUYER MENU'}</div>
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
            <div className="sidebar-footer-title">Direct Farmgate Sourcing</div>
            <p className="sidebar-footer-desc">Inspect crop variety, grade, available quintals, and grower verification before bidding.</p>
            <Link to="/listings" className="sidebar-footer-link">Open Crop Marketplace <ChevronRight size={14} /></Link>
          </div>
        </aside>

        <section className="account-content">
          {activeTab === 'overview' && (
            <div className="workspace-stack">
              <div className="dashboard-metrics-grid">
                <div className="metric-card" onClick={() => switchTab('offers')}>
                  <div className="metric-icon" style={{ background: '#eff6ff', color: '#0284c7' }}><ArrowUpRight size={22} /></div>
                  <div className="metric-data">
                    <span className="metric-num">{pendingOffers.length}</span>
                    <span className="metric-label">Active Bids</span>
                  </div>
                  <ChevronRight size={18} className="metric-arrow" />
                </div>

                <div className="metric-card" onClick={() => switchTab('offers')}>
                  <div className="metric-icon" style={{ background: '#fef3c7', color: '#d97706' }}><Bell size={22} /></div>
                  <div className="metric-data">
                    <span className="metric-num">{waitingBuyerReply.length}</span>
                    <span className="metric-label">Farmer Counteroffers</span>
                  </div>
                  <ChevronRight size={18} className="metric-arrow" />
                </div>

                <div className="metric-card" onClick={() => switchTab('orders')}>
                  <div className="metric-icon" style={{ background: '#ecfdf5', color: '#059669' }}><Truck size={22} /></div>
                  <div className="metric-data">
                    <span className="metric-num">{activeOrders.length}</span>
                    <span className="metric-label">Active Orders</span>
                  </div>
                  <ChevronRight size={18} className="metric-arrow" />
                </div>

                <Link to="/listings" className="metric-card" style={{ textDecoration: 'none' }}>
                  <div className="metric-icon" style={{ background: '#f5f3ff', color: '#7c3aed' }}><Search size={22} /></div>
                  <div className="metric-data">
                    <span className="metric-num">Browse</span>
                    <span className="metric-label">Farmgate Produce</span>
                  </div>
                  <ChevronRight size={18} className="metric-arrow" />
                </Link>
              </div>

              <div className="dashboard-card">
                <div className="panel-head">
                  <h2>Procurement Shortcuts</h2>
                </div>
                <div className="quick-actions-row">
                  <Link to="/listings" className="button primary">
                    <Store size={16} /> Browse Active Farm Produce
                  </Link>
                  <button type="button" className="button subtle" onClick={() => switchTab('offers')}>
                    <ArrowUpRight size={16} /> Track My Bids & Counteroffers
                  </button>
                  <button type="button" className="button subtle" onClick={() => switchTab('deliveries')}>
                    <FileCheck2 size={16} /> Confirm Physical Delivery
                  </button>
                  <Link to="/prices" className="button subtle">
                    <TrendingUp size={16} /> Reference Agmarknet Mandis
                  </Link>
                </div>
              </div>

              {waitingBuyerReply.length > 0 && (
                <div className="dashboard-card">
                  <div className="panel-head">
                    <h2>Farmer Counteroffers Waiting Your Decision</h2>
                    <button type="button" className="button subtle small" onClick={() => switchTab('offers')}>Open Negotiations →</button>
                  </div>
                  <div className="workspace-stack">
                    {waitingBuyerReply.slice(0, 3).map(o => (
                      <div key={o.id} className="result-line">
                        <div>
                          <b>{o.crop_name} · {o.quantity_qtl} qtl @ {money(o.price_per_qtl)}/qtl</b>
                          <small>Grower: {o.farmer_name} · {o.listing_district}, {o.listing_state}</small>
                        </div>
                        <button type="button" className="button primary small" onClick={() => switchTab('offers')}>Review Bid</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="dashboard-card">
                <div className="panel-head">
                  <h2>Recent Procurement Alerts</h2>
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
                      <p>No recent procurement notifications.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'offers' && <OffersWorkflow user={user} />}
          {activeTab === 'orders' && <OrdersWorkflow role="BUYER" />}
          {activeTab === 'deliveries' && <TradeCasework user={user} />}
          {activeTab === 'alerts' && <PriceAlerts />}
        </section>
      </div>
    </main>
  );
}

