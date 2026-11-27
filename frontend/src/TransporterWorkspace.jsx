import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Truck, ShieldCheck, CheckCircle2, AlertTriangle, Package,
  MapPin, Calendar, ChevronRight, FileText, Upload, Bell,
  Clock, ClipboardList, Check
} from 'lucide-react';
import { api, entries, errorMessage } from './api.js';
import { ShipmentTimeline } from './Workspace.jsx';

const money = (v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(v || 0));

function useDataset(url, enabled = true) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(enabled);

  async function refresh() {
    if (!enabled) return;
    setLoading(true);
    try {
      const res = await api.get(url);
      setData(entries(res));
    } catch {
      // handled cleanly by notice
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (enabled) refresh();
  }, [url, enabled]);

  return { data, loading, refresh };
}

export function TransporterWorkspace({ session, t, lang = 'en' }) {
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

  const vehicles = useDataset('vehicles/');
  const requests = useDataset('freight/requests/');
  const quotes = useDataset('freight/quotes/');
  const shipments = useDataset('shipments/');
  const notifications = useDataset('notifications/');

  const [vehicleForm, setVehicleForm] = useState({ registration: '', vehicle_type: 'TRUCK', capacity_qtl: '' });
  const [quoteForm, setQuoteForm] = useState({ freight_request: '', vehicle: '', price_inr: '', message: '' });
  const [notes, setNotes] = useState({});
  const [evidence, setEvidence] = useState({});
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  const user = session.user;
  const verifiedVehicles = vehicles.data.filter(v => v.verified);
  const openRequests = requests.data.filter(r => !r.has_shipment && r.order_status === 'CONFIRMED');
  const quotedRequestIds = new Set(quotes.data.map(q => q.freight_request));
  const activeShipments = shipments.data.filter(s => s.status !== 'DELIVERED');
  const completedShipments = shipments.data.filter(s => s.status === 'DELIVERED');

  async function addVehicle(e) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      await api.post('vehicles/', vehicleForm);
      setNotice({ type: 'success', text: 'Vehicle submitted for administrator verification review. Verified vehicles can bid on freight loads.' });
      setVehicleForm({ registration: '', vehicle_type: 'TRUCK', capacity_qtl: '' });
      vehicles.refresh();
    } catch (err) {
      setNotice({ type: 'error', text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  async function submitQuote(e) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      await api.post('freight/quotes/', quoteForm);
      setNotice({ type: 'success', text: 'Freight quotation submitted! You will be notified if the farmer or buyer assigns your vehicle.' });
      setQuoteForm({ freight_request: '', vehicle: '', price_inr: '', message: '' });
      quotes.refresh();
    } catch (err) {
      setNotice({ type: 'error', text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  async function recordMilestone(shipment, nextStatus) {
    setBusy(true);
    setNotice(null);
    try {
      const form = new FormData();
      form.append('status', nextStatus);
      form.append('evidence_note', notes[shipment.id] || '');
      if (evidence[shipment.id]) form.append('evidence_image', evidence[shipment.id]);
      await api.post(`shipments/${shipment.id}/update/`, form);
      setNotice({ type: 'success', text: `Shipment milestone "${nextStatus}" recorded with audit timestamp.` });
      setNotes(n => ({ ...n, [shipment.id]: '' }));
      setEvidence(ev => ({ ...ev, [shipment.id]: null }));
      shipments.refresh();
    } catch (err) {
      setNotice({ type: 'error', text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  const nextStepMap = { ASSIGNED: 'PICKED_UP', PICKED_UP: 'IN_TRANSIT', IN_TRANSIT: 'DELIVERED' };
  const milestoneOrder = ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED'];

  const tabs = [
    { id: 'overview', label: lang === 'hi' ? 'लॉजिस्टिक्स अवलोकन' : lang === 'pa' ? 'ਲੌਜਿਸਟਿਕਸ ਸੰਖੇਪ' : 'Logistics Overview', icon: Truck },
    { id: 'freight-board', label: lang === 'hi' ? 'उपलब्ध भाड़ा लोड' : lang === 'pa' ? 'ਉਪਲਬਧ ਭਾੜਾ ਲੋਡ' : 'Available Freight Board', icon: Package, count: openRequests.length },
    { id: 'quotes', label: lang === 'hi' ? 'मेरे भाड़ा प्रस्ताव' : lang === 'pa' ? 'ਮੇਰੀਆਂ ਭਾੜਾ ਬੋਲੀਆਂ' : 'My Submitted Quotes', icon: ClipboardList, count: quotes.data.length },
    { id: 'vehicles', label: lang === 'hi' ? 'मेरे वाहन व बेड़ा' : lang === 'pa' ? 'ਮੇਰੇ ਵਾਹਨ ਤੇ ਬੇੜਾ' : 'Fleet & Vehicles', icon: ShieldCheck, count: vehicles.data.length },
    { id: 'shipments', label: lang === 'hi' ? 'नियुक्त खेप व डिलीवरी' : lang === 'pa' ? 'ਨਿਯੁਕਤ ਖੇਪ ਤੇ ਡਿਲੀਵਰੀ' : 'Assigned Shipments', icon: MapPin, count: activeShipments.length }
  ];

  return (
    <main className="container page">
      {/* Transporter Hub Banner */}
      <div className="role-hub-banner transporter-hub">
        <div className="role-hub-identity">
          <div className="role-hub-icon transporter"><Truck size={26} /></div>
          <div>
            <div className="role-hub-eyebrow">
              <span className="role-hub-tag transporter">{lang === 'hi' ? 'ट्रांसपोर्टर लॉजिस्टिक्स हब' : lang === 'pa' ? 'ਟਰਾਂਸਪੋਰਟਰ ਲੌਜਿਸਟਿਕਸ ਹੱਬ' : 'TRANSPORTER LOGISTICS HUB'}</span>
              {user.identity_verified && user.account_verified ? (
                <span className="status-pill verified"><ShieldCheck size={12} /> Verified Carrier</span>
              ) : user.account_verified ? (
                <span className="status-pill verified"><CheckCircle2 size={12} /> Account Verified</span>
              ) : (
                <span className="status-pill unverified"><AlertTriangle size={12} /> Verification Pending</span>
              )}
            </div>
            <h1>{user.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : 'Carrier'} — {lang === 'hi' ? 'बेड़ा एवं माल ढुलाई संचालन' : lang === 'pa' ? 'ਗੱਡੀਆਂ ਅਤੇ ਢੋਆ-ਢੁਆਈ ਸੰਚਾਲਨ' : 'Fleet & Freight Operations'}</h1>
            <p className="muted" style={{ margin: 0 }}>
              {[user.district, user.state].filter(Boolean).join(', ') || 'India'} · Bid on confirmed farmgate orders, match payload capacities, and log pickup-to-delivery evidence.
            </p>
          </div>
        </div>
        <div className="role-hub-actions">
          <button type="button" className="button primary small" onClick={() => switchTab('freight-board')}>
            <Package size={15} /> {lang === 'hi' ? 'भाड़ा लोड देखें' : lang === 'pa' ? 'ਭਾੜਾ ਲੋਡ ਵੇਖੋ' : 'Browse Freight Loads'}
          </button>
          <button type="button" className="button subtle small" onClick={() => switchTab('vehicles')}>
            <Truck size={15} /> {lang === 'hi' ? 'वाहन जोड़ें' : lang === 'pa' ? 'ਗੱਡੀ ਜੋੜੋ' : 'Manage Fleet'}
          </button>
        </div>
      </div>

      {/* Honest Verification Readiness Alerts */}
      {!user.account_verified && (
        <div className="notice warning" style={{ marginBottom: '16px', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle size={18} style={{ color: '#d97706', flexShrink: 0 }} />
            <span>
              <b>Carrier Account Verification Required:</b> Verify your email and mobile number before registering fleet vehicles or quoting on farmgate freight.
            </span>
          </div>
          <Link to="/account?tab=verification" className="button primary small">Open Verification Center →</Link>
        </div>
      )}

      {user.account_verified && verifiedVehicles.length === 0 && (
        <div className="notice info" style={{ marginBottom: '16px', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <span>
            <b>Fleet Verification Needed to Quote:</b> Register a vehicle and await administrator verification approval before submitting quotes on open freight requests.
          </span>
          <button type="button" className="button subtle small" onClick={() => switchTab('vehicles')}>Go to Fleet & Vehicles →</button>
        </div>
      )}

      {notice && <div className={`notice ${notice.type}`} style={{ marginBottom: '16px' }}>{notice.text}</div>}

      <div className="account-layout">
        <aside className="account-sidebar" aria-label="Transporter Workspace Menu">
          <div className="sidebar-group-label">{lang === 'hi' ? 'लॉजिस्टिक्स मेनू' : lang === 'pa' ? 'ਲੌਜਿਸਟਿਕਸ ਮੀਨੂ' : 'LOGISTICS MENU'}</div>
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
            <div className="sidebar-footer-title">Capacity Guardrails</div>
            <p className="sidebar-footer-desc">Only admin-verified vehicles with sufficient quintal payload capacity can quote on confirmed orders.</p>
          </div>
        </aside>

        <section className="account-content">
          {activeTab === 'overview' && (
            <div className="workspace-stack">
              <div className="dashboard-metrics-grid">
                <div className="metric-card" onClick={() => switchTab('freight-board')}>
                  <div className="metric-icon" style={{ background: '#fffbeb', color: '#d97706' }}><Package size={22} /></div>
                  <div className="metric-data">
                    <span className="metric-num">{openRequests.length}</span>
                    <span className="metric-label">Open Freight Loads</span>
                  </div>
                  <ChevronRight size={18} className="metric-arrow" />
                </div>

                <div className="metric-card" onClick={() => switchTab('quotes')}>
                  <div className="metric-icon" style={{ background: '#eff6ff', color: '#2563eb' }}><ClipboardList size={22} /></div>
                  <div className="metric-data">
                    <span className="metric-num">{quotes.data.length}</span>
                    <span className="metric-label">Submitted Quotes</span>
                  </div>
                  <ChevronRight size={18} className="metric-arrow" />
                </div>

                <div className="metric-card" onClick={() => switchTab('vehicles')}>
                  <div className="metric-icon" style={{ background: '#ecfdf5', color: '#059669' }}><Truck size={22} /></div>
                  <div className="metric-data">
                    <span className="metric-num">{verifiedVehicles.length} / {vehicles.data.length}</span>
                    <span className="metric-label">Verified Fleet Vehicles</span>
                  </div>
                  <ChevronRight size={18} className="metric-arrow" />
                </div>

                <div className="metric-card" onClick={() => switchTab('shipments')}>
                  <div className="metric-icon" style={{ background: '#f5f3ff', color: '#7c3aed' }}><MapPin size={22} /></div>
                  <div className="metric-data">
                    <span className="metric-num">{activeShipments.length}</span>
                    <span className="metric-label">Active Shipments ({completedShipments.length} Done)</span>
                  </div>
                  <ChevronRight size={18} className="metric-arrow" />
                </div>
              </div>

              <div className="dashboard-card">
                <div className="panel-head">
                  <h2>Fleet & Freight Shortcuts</h2>
                </div>
                <div className="quick-actions-row">
                  <button type="button" className="button primary" onClick={() => switchTab('freight-board')}>
                    <Package size={16} /> View Available Freight Loads
                  </button>
                  <button type="button" className="button subtle" onClick={() => switchTab('vehicles')}>
                    <Truck size={16} /> Register Commercial Vehicle
                  </button>
                  <button type="button" className="button subtle" onClick={() => switchTab('shipments')}>
                    <MapPin size={16} /> Update Delivery Milestones
                  </button>
                </div>
              </div>

              <div className="dashboard-card">
                <div className="panel-head">
                  <h2>Recent Dispatch Notifications</h2>
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
                      <p>No carrier notifications yet.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'freight-board' && (
            <div className="workspace-stack">
              <section className="panel">
                <div className="panel-head">
                  <h2>Available Agricultural Freight Loads</h2>
                  <span className="chip">{openRequests.length} Open Requests</span>
                </div>
                <div className="workspace-stack">
                  {openRequests.map((req) => {
                    const compatibleVehicles = verifiedVehicles.filter(v => Number(v.capacity_qtl) >= Number(req.order_quantity_qtl || 0));
                    const alreadyQuoted = quotedRequestIds.has(req.id);
                    const isSelected = String(quoteForm.freight_request) === String(req.id);

                    return (
                      <div key={req.id} className="order-card role-enriched-card">
                        <div className="order-card-top">
                          <div>
                            <div className="card-badges-row">
                              <span className="chip-accent">{req.crop_name || 'Agricultural Cargo'}</span>
                              <span className="chip">{req.order_quantity_qtl} qtl Payload</span>
                              <span className="chip-muted"><Calendar size={12} /> Pickup: {req.pickup_date}</span>
                            </div>
                            <strong style={{ display: 'block', marginTop: '6px', fontSize: '1.05rem', color: '#0f172a' }}>
                              {req.pickup_location} → {req.dropoff_location}
                            </strong>
                            <small className="muted">
                              Order #{String(req.order).slice(0, 8)} ·{' '}
                              {compatibleVehicles.length > 0
                                ? `${compatibleVehicles.length} compatible verified vehicle(s) in your fleet`
                                : 'No verified fleet vehicle matches this payload weight yet'}
                            </small>
                          </div>

                          <div>
                            {alreadyQuoted ? (
                              <span className="status-pill verified">Quote Submitted ✓</span>
                            ) : (
                              <button
                                type="button"
                                className="button primary small"
                                disabled={compatibleVehicles.length === 0 || !user.account_verified}
                                onClick={() => {
                                  setQuoteForm({
                                    freight_request: String(req.id),
                                    vehicle: compatibleVehicles[0] ? String(compatibleVehicles[0].id) : '',
                                    price_inr: '',
                                    message: ''
                                  });
                                }}
                              >
                                Quote This Load
                              </button>
                            )}
                          </div>
                        </div>

                        {isSelected && !alreadyQuoted && (
                          <form onSubmit={submitQuote} style={{ marginTop: '14px', padding: '14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                            <div className="form-grid">
                              <label className="field">
                                <span>Select Verified Vehicle (min {req.order_quantity_qtl} qtl)</span>
                                <select
                                  required
                                  value={quoteForm.vehicle}
                                  onChange={(e) => setQuoteForm({ ...quoteForm, vehicle: e.target.value })}
                                >
                                  {compatibleVehicles.map(v => (
                                    <option key={v.id} value={v.id}>{v.registration} · {v.vehicle_type} ({v.capacity_qtl} qtl)</option>
                                  ))}
                                </select>
                              </label>
                              <label className="field">
                                <span>Total Freight Quote (₹ INR)</span>
                                <input
                                  type="number"
                                  min="1"
                                  step="0.01"
                                  required
                                  placeholder="e.g. 3200"
                                  value={quoteForm.price_inr}
                                  onChange={(e) => setQuoteForm({ ...quoteForm, price_inr: e.target.value })}
                                />
                              </label>
                              <label className="field">
                                <span>Carrier Note (Optional)</span>
                                <input
                                  placeholder="e.g. Tarpaulin covered pickup, morning arrival"
                                  value={quoteForm.message}
                                  onChange={(e) => setQuoteForm({ ...quoteForm, message: e.target.value })}
                                />
                              </label>
                            </div>
                            <div className="actions-wrap" style={{ marginTop: '10px' }}>
                              <button type="submit" className="button primary small" disabled={busy}>
                                {busy ? 'Sending...' : 'Submit Binding Freight Quote'}
                              </button>
                              <button type="button" className="button subtle small" onClick={() => setQuoteForm({ freight_request: '', vehicle: '', price_inr: '', message: '' })}>
                                Cancel
                              </button>
                            </div>
                          </form>
                        )}
                      </div>
                    );
                  })}
                  {openRequests.length === 0 && (
                    <p className="muted">No open un-assigned freight requests at the moment. Confirmed farmer-buyer orders requiring transport appear here automatically.</p>
                  )}
                </div>
              </section>
            </div>
          )}

          {activeTab === 'quotes' && (
            <section className="panel">
              <div className="panel-head">
                <h2>My Submitted Freight Quotations</h2>
                <span className="chip">{quotes.data.length} Quotes</span>
              </div>
              <div className="workspace-stack">
                {quotes.data.map(q => (
                  <div key={q.id} className="order-card role-enriched-card">
                    <div className="order-card-top">
                      <div>
                        <div className="card-badges-row">
                          <span className="chip-accent">{q.crop_name || 'Agricultural Cargo'}</span>
                          <span className="chip">{q.order_quantity_qtl} qtl</span>
                          <span className="chip-muted">Vehicle {q.vehicle_registration} ({q.vehicle_type})</span>
                        </div>
                        <strong style={{ display: 'block', marginTop: '6px', fontSize: '1.05rem' }}>
                          {q.pickup_location} → {q.dropoff_location} · {money(q.price_inr)}
                        </strong>
                        <small className="muted">Pickup Date: {q.pickup_date} {q.message ? `· "${q.message}"` : ''}</small>
                      </div>
                      <span className={`status-pill ${q.is_assigned ? 'verified' : 'pending'}`}>
                        {q.is_assigned ? 'Assigned to You ✓' : 'Awaiting Assignment'}
                      </span>
                    </div>
                  </div>
                ))}
                {quotes.data.length === 0 && (
                  <p className="muted">You haven’t submitted any freight quotations yet. Visit the Available Freight Board to place bids on open loads.</p>
                )}
              </div>
            </section>
          )}

          {activeTab === 'vehicles' && (
            <div className="two-col">
              <section className="panel">
                <div className="panel-head">
                  <h2>Register Commercial Vehicle</h2>
                </div>
                <p className="muted">All registered vehicles undergo administrator document verification before quoting is enabled.</p>
                <form onSubmit={addVehicle}>
                  <label className="field">
                    <span>Registration Plate Number *</span>
                    <input
                      required
                      placeholder="e.g. PB-08-CD-4521"
                      value={vehicleForm.registration}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, registration: e.target.value.toUpperCase() })}
                    />
                  </label>
                  <label className="field">
                    <span>Vehicle Type *</span>
                    <select
                      value={vehicleForm.vehicle_type}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, vehicle_type: e.target.value })}
                    >
                      <option value="PICKUP">Mini Pickup / Bolero (15–30 qtl)</option>
                      <option value="TRACTOR_TROLLEY">Tractor Trolley (40–80 qtl)</option>
                      <option value="LCV">Light Commercial Truck / Eicher (50–120 qtl)</option>
                      <option value="TRUCK">Heavy Truck / 10-Wheeler (150–300 qtl)</option>
                      <option value="REFRIGERATED">Refrigerated Reefer Van</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Payload Capacity (Quintals) *</span>
                    <input
                      type="number"
                      min="1"
                      step="0.5"
                      required
                      placeholder="e.g. 80"
                      value={vehicleForm.capacity_qtl}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, capacity_qtl: e.target.value })}
                    />
                  </label>
                  <button className="button primary full" disabled={busy || !user.account_verified} style={{ marginTop: '12px' }}>
                    {busy ? 'Submitting...' : 'Register Vehicle for Review'}
                  </button>
                </form>
              </section>

              <section className="panel">
                <div className="panel-head">
                  <h2>My Fleet Directory</h2>
                  <span className="chip">{vehicles.data.length} Vehicles</span>
                </div>
                <div className="workspace-stack">
                  {vehicles.data.map(v => (
                    <div key={v.id} className="result-line">
                      <div>
                        <b>{v.registration}</b>
                        <small style={{ display: 'block' }}>{v.vehicle_type} · Capacity: {v.capacity_qtl} qtl</small>
                      </div>
                      <span className={`status-pill ${v.verified ? 'verified' : 'pending'}`}>
                        {v.verified ? 'Admin Verified ✓' : 'Pending Review'}
                      </span>
                    </div>
                  ))}
                  {vehicles.data.length === 0 && <p className="muted">No vehicles registered in your fleet yet.</p>}
                </div>
              </section>
            </div>
          )}

          {activeTab === 'shipments' && (
            <section className="panel">
              <div className="panel-head">
                <h2>Assigned Shipments & Milestone Evidence</h2>
                <span className="chip">{shipments.data.length} Total</span>
              </div>
              <div className="workspace-stack">
                {shipments.data.map(sh => {
                  const nextStatus = nextStepMap[sh.status];
                  const curIdx = milestoneOrder.indexOf(sh.status);
                  return (
                    <div key={sh.id} className="order-card role-enriched-card">
                      <div className="order-card-top">
                        <div>
                          <div className="card-badges-row">
                            <span className="chip-accent">{sh.crop_name || 'Agricultural Shipment'}</span>
                            <span className="chip">{sh.quantity_qtl} qtl</span>
                            <span className="chip-muted">{sh.vehicle_registration}</span>
                            <span className="chip">{money(sh.freight_price_inr)} Freight</span>
                          </div>
                          <strong style={{ display: 'block', marginTop: '6px', fontSize: '1.05rem' }}>
                            {sh.pickup_location} → {sh.dropoff_location}
                          </strong>
                          <small className="muted">Order #{String(sh.order).slice(0, 8)} · Scheduled Pickup: {sh.pickup_date}</small>
                        </div>
                        <span className={`status-pill ${sh.status === 'DELIVERED' ? 'verified' : 'pending'}`}>{sh.status}</span>
                      </div>

                      {/* Clean Visual Stepper */}
                      <div className="order-stage-bar" style={{ marginTop: '12px' }}>
                        {milestoneOrder.map((step, i) => (
                          <div key={step} className={`order-stage-step ${i <= curIdx ? 'done' : 'pending'}`}>
                            <span className="stage-dot">{i <= curIdx ? <Check size={11} /> : <Clock size={11} />}</span>
                            <span>{step.replace('_', ' ')}</span>
                          </div>
                        ))}
                      </div>

                      {nextStatus && (
                        <div style={{ marginTop: '14px', padding: '14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                          <label className="field">
                            <span>Milestone Note / Delivery Confirmation {nextStatus === 'DELIVERED' ? '(min 12 chars or upload photo)' : ''}</span>
                            <textarea
                              rows={2}
                              value={notes[sh.id] || ''}
                              onChange={(e) => setNotes({ ...notes, [sh.id]: e.target.value })}
                              placeholder={`Describe ${nextStatus.toLowerCase().replace('_', ' ')} details (condition, weighbridge note, receiver)...`}
                            />
                          </label>
                          <label className="field" style={{ marginTop: '8px' }}>
                            <span>Private Delivery Evidence Image (Optional, JPEG/PNG/WebP, max 5MB)</span>
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              onChange={(e) => setEvidence({ ...evidence, [sh.id]: e.target.files?.[0] || null })}
                            />
                          </label>
                          <button
                            type="button"
                            className="button primary small"
                            style={{ marginTop: '10px' }}
                            disabled={busy}
                            onClick={() => recordMilestone(sh, nextStatus)}
                          >
                            <Upload size={14} /> Record {nextStatus.replace('_', ' ')}
                          </button>
                        </div>
                      )}

                      <div style={{ marginTop: '10px' }}>
                        <ShipmentTimeline id={sh.id} />
                      </div>
                    </div>
                  );
                })}
                {shipments.data.length === 0 && (
                  <p className="muted">No shipments assigned to your fleet yet. Submit quotes on the Available Freight Board to win assignments.</p>
                )}
              </div>
            </section>
          )}
        </section>
      </div>
    </main>
  );
}

