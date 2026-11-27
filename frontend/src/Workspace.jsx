import React,{useEffect,useState} from 'react';
import {
  CheckCircle2,
  Clock,
  Truck,
  ShieldCheck,
  AlertCircle,
  ArrowRight,
  ArrowLeftRight,
  Store,
  CreditCard,
  FileCheck2
} from 'lucide-react';
import {api,entries,errorMessage} from './api.js';
import {SearchableSelect} from './SearchableSelect.jsx';

const money=(value)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(Number(value||0));
const Box=({title,aside,children})=><section className="panel"><div className="panel-head"><h2>{title}</h2>{aside}</div>{children}</section>;
const Field=({label,children})=><label className="field"><span>{label}</span>{children}</label>;
const Note=({children,type='info'})=><div className={`notice ${type}`} role="status">{children}</div>;
const Error=({children})=><div className="notice error" role="alert">{children}</div>;

function useData(url){
  const [data,setData]=useState([]),[error,setError]=useState('');
  async function reload(){try{const result=await api.get(url);setData(entries(result));setError('');}catch(e){setError(errorMessage(e));}}
  useEffect(()=>{reload()},[url]);
  return {data,error,reload};
}

export function GoogleAuth({onLogin,linkAccount=false,role='FARMER'}){
  const [clientId,setClientId]=useState(''),[error,setError]=useState('');
  useEffect(()=>{let alive=true;api.get('status/').then(r=>{if(alive)setClientId(r.data.google_client_id||'')}).catch(()=>{});return()=>{alive=false}},[]);
  useEffect(()=>{
    if(!clientId)return;
    let alive=true;
    function render(){if(!alive||!window.google?.accounts?.id)return;
      window.google.accounts.id.initialize({client_id:clientId,callback:async ({credential})=>{
        try{
          if(linkAccount){await api.post('auth/google/link/',{credential});setError('Google account linked successfully.');return;}
          const {data}=await api.post('auth/google/',{credential,role});onLogin({...data.tokens,user:data.user});
          const dest = data.user?.role === 'FARMER' ? '/farmer' : data.user?.role === 'BUYER' ? '/buyer' : data.user?.role === 'TRANSPORTER' ? '/transport' : '/account';
          window.location.assign(dest);
        }catch(e){setError(errorMessage(e));}
      }});
      const target=document.getElementById(linkAccount?'google-link-button':'google-signin-button');
      if(target)window.google.accounts.id.renderButton(target,{theme:'outline',size:'large',text:linkAccount?'continue_with':'signin_with'});
    }
    if(window.google?.accounts?.id){render();return()=>{alive=false};}
    const existing=document.querySelector('script[data-krishisetu-google]');
    const script=existing||document.createElement('script');
    if(!existing){script.src='https://accounts.google.com/gsi/client';script.async=true;script.defer=true;script.dataset.krishisetuGoogle='1';document.head.appendChild(script);}
    script.addEventListener('load',render);
    if(existing){const poll=setInterval(()=>{if(window.google?.accounts?.id){clearInterval(poll);render();}},300);return()=>{alive=false;clearInterval(poll);script.removeEventListener('load',render)};}
    return()=>{alive=false;script.removeEventListener('load',render)};
  },[clientId,linkAccount,onLogin]);
  if(!clientId)return null;
  return <div className="external-login"><div id={linkAccount?'google-link-button':'google-signin-button'}/>{error&&<p role="alert">{error}</p>}</div>;
}

export function PriceAlerts(){
  const alerts=useData('price-alerts/');const crops=useData('crops/');const markets=useData('markets/');
  const [form,setForm]=useState({crop:'',market:'',direction:'ABOVE',threshold_per_qtl:''}),[message,setMessage]=useState('');
  async function save(e){e.preventDefault();try{await api.post('price-alerts/',{...form,market:form.market||null});setMessage('Alert saved. It is evaluated after new prices are imported.');alerts.reload();}catch(e){setMessage(errorMessage(e));}}
  async function remove(id){try{await api.delete(`price-alerts/${id}/`);alerts.reload();}catch(e){setMessage(errorMessage(e));}}
  return <div className="two-col"><Box title="Set a mandi price alert">
    <p className="muted">Alerts use recorded prices, not guaranteed trade offers. In-app notifications require scheduled price imports.</p>
    <form onSubmit={save}>
      <Field label="Crop"><SearchableSelect options={crops.data} value={form.crop} onChange={val=>setForm({...form,crop:val})} placeholder="Type to search crop..." emptyOption="Choose crop" required /></Field>
      <Field label="Mandi (optional)"><SearchableSelect options={markets.data} value={form.market} onChange={val=>setForm({...form,market:val})} placeholder="Type mandi..." emptyOption="All recorded markets" /></Field>
      <Field label="Alert when price is"><select value={form.direction} onChange={e=>setForm({...form,direction:e.target.value})}><option value="ABOVE">At or above</option><option value="BELOW">At or below</option></select></Field>
      <Field label="Threshold (₹/quintal)"><input type="number" min="0.01" step="0.01" required value={form.threshold_per_qtl} onChange={e=>setForm({...form,threshold_per_qtl:e.target.value})}/></Field>
      <button className="button primary">Create alert</button>
    </form>{message&&<Note>{message}</Note>}</Box><Box title="My price alerts">{alerts.error&&<Error>{alerts.error}</Error>}{alerts.data.map(a=><div key={a.id} className="result-line"><span>Crop #{a.crop} · {a.direction==='ABOVE'?'≥':'≤'} {money(a.threshold_per_qtl)}/qtl{a.market&&` · Market #${a.market}`}</span><button className="button subtle small" onClick={()=>remove(a.id)}>Remove</button></div>)}{!alerts.data.length&&<p className="muted">No price alerts saved.</p>}</Box></div>;
}

export function ForecastView(){
  const crops=useData('crops/');const markets=useData('markets/');
  const [crop,setCrop]=useState(''),[market,setMarket]=useState(''),[result,setResult]=useState(null),[error,setError]=useState(''),[profile,setProfile]=useState('');
  async function submit(e){e.preventDefault();try{const picked=profile?JSON.parse(profile):{};const {data}=await api.get('forecast/',{params:{crop,market,...picked}});setResult(data);setError('')}catch(e){setError(errorMessage(e));}}
  return <Box title="History-based price projection"><p className="muted">An explainable seven-day baseline is shown only with sufficient genuine observations. It is not a reliable future bid or guaranteed price.</p>
    <form onSubmit={submit} className="form-grid"><Field label="Crop"><SearchableSelect options={crops.data} value={crop} onChange={setCrop} placeholder="Search crop..." emptyOption="Choose crop" required /></Field><Field label="Market"><SearchableSelect options={markets.data} value={market} onChange={setMarket} placeholder="Search market..." emptyOption="Choose market" required /></Field><button className="button primary">Check historical baseline</button></form>
    {error&&<Error>{error}</Error>}
    {result?.available_profiles?.length>1&&<div className="notice"><Field label="History contains multiple profiles: select a single variety, grade and source"><select value={profile} onChange={e=>setProfile(e.target.value)}><option value="">Select a precise historical profile</option>{result.available_profiles.map((p,i)=><option key={i} value={JSON.stringify(p)}>{p.variety||'Unspecified variety'} · {p.grade||'Unspecified grade'} · {p.source}</option>)}</select></Field><p className="muted">Choose a profile, then run the forecast again.</p></div>}
    {result&&(result.status==='FORECAST'?<div><p className="big-value">{money(result.expected_modal_inr_per_qtl)}/qtl</p><p>{result.target_date} · {result.method}</p><p>Heuristic range: {money(result.heuristic_lower_inr_per_qtl)} – {money(result.heuristic_upper_inr_per_qtl)}</p><p>Seven-day walk-forward holdout MAE: {money(result.holdout_mae_inr_per_qtl)} · {result.holdout_samples} holdout targets</p>
      <p>Persistence baseline error: {money(result.baseline_mae_inr_per_qtl)} · Estimated improvement: {result.relative_holdout_improvement_pct}%</p>
      <p>{result.observations} observations across {result.history_days} days · Last observation {result.latest_observation_date}</p>
      <Note>{result.disclaimer}</Note></div>:<Note>Forecast unavailable: {result.reason}</Note>)}
  </Box>;
}

function loadCheckoutScript(){return new Promise((resolve,reject)=>{
  if(window.Razorpay)return resolve();
  const existing=document.querySelector('script[data-krishisetu-checkout]');
  if(existing){existing.addEventListener('load',()=>resolve(),{once:true});existing.addEventListener('error',()=>reject(new Error('Gateway checkout could not load')),{once:true});return;}
  const s=document.createElement('script');s.src='https://checkout.razorpay.com/v1/checkout.js';s.async=true;s.dataset.krishisetuCheckout='1';s.onload=()=>resolve();s.onerror=()=>reject(new Error('Gateway checkout could not load'));document.head.appendChild(s);
});}

function OrderStageBar({ status, hasShipment }) {
  const stageIdx =
    status === 'CANCELLED' || status === 'DISPUTED' || status === 'RETURNED' ? -1 :
    status === 'PARTIALLY_FULFILLED' ? 3 :
    status === 'DELIVERED' ? 3 :
    status === 'DISPATCHED' ? 2 :
    hasShipment ? 1 : 0;

  if (stageIdx === -1) {
    return <span className="status-pill unverified">{status}</span>;
  }

  const steps = ['Confirmed', 'Freight Assigned', 'Dispatched', 'Delivered'];
  return (
    <div className="order-stage-bar" aria-label="Order fulfillment stages">
      {steps.map((label, idx) => (
        <div key={label} className={`order-stage-step ${idx <= stageIdx ? 'done' : 'pending'}`}>
          <span className="stage-dot">{idx <= stageIdx ? <CheckCircle2 size={12} /> : <Clock size={11} />}</span>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}

export function OrdersWorkflow({role}){
  const orders=useData('orders/');const freight=useData('freight/requests/');const quotes=useData('freight/quotes/');const shipments=useData('shipments/');const payments=useData('payments/');const settlements=useData('settlements/');
  const [notice,setNotice]=useState(''),[form,setForm]=useState({order:'',pickup_location:'',dropoff_location:'',pickup_date:''}),[settle,setSettle]=useState({order:'',amount_inr:'',reference:''});
  const [payState,setPayState]=useState({});
  async function perform(url,payload,refresh){
    setNotice('');
    try{
      await api.post(url,payload);
      setNotice('Action recorded successfully.');
      orders.reload(); freight.reload(); quotes.reload(); shipments.reload(); settlements.reload();
      refresh?.();
    }catch(e){setNotice(errorMessage(e));}
  }
  async function checkout(order){
    try{
      setPayState(s=>({...s,[order.id]:'Preparing payment…'}));
      const {data}=await api.post('payments/initiate/',{order:order.id});
      if(data.status==='CAPTURED'){setPayState(s=>({...s,[order.id]:'Payment already captured by gateway.'}));return;}
      await loadCheckoutScript();
      const r=new window.Razorpay({key:data.key_id,amount:data.amount_paise,currency:data.currency,
        name:'KrishiSetu',description:`Order ${order.id.slice(0,8)}`,order_id:data.gateway_order_id,
        handler:async result=>{
          try{await api.post('payments/confirm/',result);setPayState(s=>({...s,[order.id]:'Signed callback received. Awaiting gateway webhook confirmation.'}));payments.reload();}
          catch(e){setPayState(s=>({...s,[order.id]:errorMessage(e)}));}
        },modal:{ondismiss:()=>setPayState(s=>({...s,[order.id]:'Payment window closed; check status before retrying.'}))}});
      r.open();
    }catch(e){setPayState(s=>({...s,[order.id]:errorMessage(e)}));}
  }

  const confirmedOrdersWithoutFreight = orders.data.filter(
    o => o.status === 'CONFIRMED' && !o.has_shipment && !freight.data.some(fr => fr.order === o.id)
  );

  return <div className="workspace-stack">
    {notice&&<Note>{notice}</Note>}
    <Box
      title={role === 'BUYER' ? 'Confirmed Purchases & Fulfillment' : 'Confirmed Sales & Order Fulfillment'}
      aside={<span className="chip">{orders.data.length} Orders</span>}
    >
      {orders.error&&<Error>{orders.error}</Error>}
      <div className="workspace-stack">
        {orders.data.map(o=>(
          <div className="order-card role-enriched-card" key={o.id}>
            <div className="order-card-top">
              <div>
                <div className="card-badges-row">
                  <span className="chip-accent">{o.crop_name || 'Agricultural Lot'}</span>
                  {o.variety && <span className="chip-muted">{o.variety}</span>}
                  {o.grade && <span className="chip-muted">Grade {o.grade}</span>}
                  <span className="muted" style={{fontSize:'0.75rem'}}>Order #{o.id.slice(0,8)}</span>
                </div>
                <strong style={{display:'block',marginTop:'6px',fontSize:'1.05rem',color:'#0f172a'}}>
                  {o.quantity_qtl} qtl @ {money(o.price_per_qtl)}/qtl · Total {money(Number(o.quantity_qtl)*Number(o.price_per_qtl))}
                </strong>
                <small className="muted">
                  {role === 'BUYER'
                    ? `Grower: ${o.farmer_name || `Farmer #${o.farmer}`}`
                    : `Commercial Buyer: ${o.buyer_name || `Buyer #${o.buyer}`}`}
                  {o.district ? ` · ${o.district}, ${o.state}` : ''}
                </small>
              </div>
              <OrderStageBar status={o.status} hasShipment={o.has_shipment} />
            </div>

            <div className="actions-wrap" style={{marginTop:'10px',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                {o.status==='CONFIRMED'&&<small className="muted">Need changes? Open Delivery & Trade Casework to request counterparty-approved adjustments.</small>}
                {Number(o.accepted_qtl) > 0 && <small style={{color:'#15803d',fontWeight:600,display:'block'}}>Buyer accepted: {o.accepted_qtl} of {o.quantity_qtl} qtl</small>}
              </div>
              {role==='BUYER'&&['CONFIRMED','DISPATCHED','DELIVERED'].includes(o.status)&&(
                <button className="button primary small" onClick={()=>checkout(o)}>
                  <CreditCard size={14}/> Pay via Razorpay
                </button>
              )}
            </div>
            {payState[o.id]&&<p role="status" className="muted" style={{marginTop:'6px'}}>{payState[o.id]}</p>}
          </div>
        ))}
        {!orders.data.length&&<p className="muted">No orders yet. Accepted offers will appear here with full logistics and payment controls.</p>}
      </div>
      {payments.data.length>0&&(
        <div style={{marginTop:'18px',paddingTop:'14px',borderTop:'1px solid #e2e8f0'}}>
          <h3>Gateway Payment Records</h3>
          {payments.data.map(p=>(
            <div key={p.id} className="result-line">
              <span>Order #{p.order.slice(0,8)} · {money(p.amount_inr)}</span>
              <b>{p.status==='CAPTURED'?'Gateway-confirmed capture (not bank settlement)':p.status}</b>
            </div>
          ))}
        </div>
      )}
    </Box>

    <div className="two-col">
      <Box title="Arrange Farmgate Freight Pickup">
        <p className="muted">Post pickup and dropoff details for a confirmed order so verified commercial transporters can submit competitive bids.</p>
        <form onSubmit={e=>{e.preventDefault();perform('freight/requests/',form, ()=>{setForm({order:'',pickup_location:'',dropoff_location:'',pickup_date:''});});}}>
          <Field label="Confirmed Order">
            <select required value={form.order} onChange={e=>setForm({...form,order:e.target.value})}>
              <option value="">Select confirmed order needing freight</option>
              {confirmedOrdersWithoutFreight.map(o=>(
                <option key={o.id} value={o.id}>
                  {o.crop_name || 'Crop'} · {o.quantity_qtl} qtl · Order #{o.id.slice(0,8)} ({o.district || 'Origin'})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Farmgate Pickup Location">
            <input required placeholder="e.g. Sirhind Mandi Road, Fatehgarh Sahib, Punjab" value={form.pickup_location} onChange={e=>setForm({...form,pickup_location:e.target.value})}/>
          </Field>
          <Field label="Destination / Dropoff Location">
            <input required placeholder="e.g. Khanna Grain Yard / Buyer Warehouse" value={form.dropoff_location} onChange={e=>setForm({...form,dropoff_location:e.target.value})}/>
          </Field>
          <Field label="Scheduled Pickup Date">
            <input required type="date" value={form.pickup_date} onChange={e=>setForm({...form,pickup_date:e.target.value})}/>
          </Field>
          <button className="button primary" disabled={!confirmedOrdersWithoutFreight.length}>
            <Truck size={15}/> Request Transporter Quotes
          </button>
        </form>
        {freight.data.length > 0 && (
          <div style={{marginTop:'14px'}}>
            <h4 style={{fontSize:'0.85rem',color:'#475569',marginBottom:'6px'}}>Published Freight Requests:</h4>
            {freight.data.map(f=>(
              <div key={f.id} className="result-line">
                <div>
                  <b>{f.crop_name || 'Cargo'} ({f.order_quantity_qtl} qtl)</b>
                  <small>{f.pickup_location} → {f.dropoff_location} · {f.pickup_date}</small>
                </div>
                <span className={`status-pill ${f.has_shipment ? 'verified' : 'pending'}`}>
                  {f.has_shipment ? 'Carrier Assigned' : 'Awaiting Quotes'}
                </span>
              </div>
            ))}
          </div>
        )}
      </Box>

      <Box title="Transporter Quotations & Active Shipments">
        {quotes.data.map(q=>(
          <div className="result-line" key={q.id}>
            <div>
              <b>{money(q.price_inr)} · {q.transporter_name || 'Carrier'}</b>
              <small>
                {q.crop_name || 'Cargo'} ({q.order_quantity_qtl} qtl) · Vehicle {q.vehicle_registration} ({q.vehicle_type}, {q.vehicle_capacity_qtl} qtl)
              </small>
              <small>{q.pickup_location} → {q.dropoff_location} ({q.pickup_date})</small>
            </div>
            {q.is_assigned ? (
              <span className="status-pill verified">Assigned ✓</span>
            ) : (
              <button className="button primary small" onClick={()=>perform(`freight/quotes/${q.id}/assign/`,{},shipments.reload)}>
                Assign Carrier
              </button>
            )}
          </div>
        ))}
        {shipments.data.map(s=>(
          <div key={s.id} className="order-card" style={{marginTop:'10px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <b>{s.crop_name || 'Shipment'} · {s.quantity_qtl} qtl</b>
                <small style={{display:'block'}}>{s.pickup_location} → {s.dropoff_location} · {s.vehicle_registration}</small>
              </div>
              <span className="status-pill verified">{s.status}</span>
            </div>
            <ShipmentTimeline id={s.id}/>
          </div>
        ))}
        {!quotes.data.length&&!shipments.data.length&&<p className="muted">No freight quotations or shipments yet. Request transport for a confirmed order to receive bids from verified carriers.</p>}
      </Box>
    </div>

    <Box title="Manual Off-Platform Settlement Declarations">
      <p className="muted">Only declare an off-platform bank/cash settlement after delivery acceptance. Manual declarations are not gateway-confirmed or proof of bank clearing.</p>
      <form className="form-grid" onSubmit={e=>{e.preventDefault();perform('settlements/',settle,settlements.reload)}}>
        <Field label="Delivered Order">
          <select required value={settle.order} onChange={e=>setSettle({...settle,order:e.target.value})}>
            <option value="">Select delivered order</option>
            {orders.data.filter(o=>o.status==='DELIVERED' || o.status==='PARTIALLY_FULFILLED').map(o=>(
              <option key={o.id} value={o.id}>{o.crop_name || 'Crop'} · {o.accepted_qtl} qtl · #{o.id.slice(0,8)}</option>
            ))}
          </select>
        </Field>
        <Field label="Declared Amount (INR)"><input type="number" min="0.01" step="0.01" required value={settle.amount_inr} onChange={e=>setSettle({...settle,amount_inr:e.target.value})}/></Field>
        <Field label="Bank / UPI Reference (optional)"><input placeholder="UTR / NEFT / Cash receipt ref" value={settle.reference} onChange={e=>setSettle({...settle,reference:e.target.value})}/></Field>
        <button className="button primary"><FileCheck2 size={15}/> Record Declaration</button>
      </form>
      {settlements.data.map(s=>(
        <div className="result-line" key={s.id}>
          <span>Order #{s.order.slice(0,8)} · {money(s.amount_inr)} {s.reference ? `(Ref: ${s.reference})` : ''} · {s.status}</span>
          <small>{s.status === 'RECONCILED' ? 'Counterparty Acknowledged ✓' : 'Awaiting Counterparty Acknowledgement'}</small>
        </div>
      ))}
    </Box>
  </div>;
}

export function FarmManager(){
  const farms=useData('farms/');const [form,setForm]=useState({name:'',village:'',district:'',state:'',latitude:'',longitude:''}),[notice,setNotice]=useState('');
  async function create(e){e.preventDefault();try{await api.post('farms/',{...form,latitude:form.latitude||null,longitude:form.longitude||null});farms.reload();setForm({name:'',village:'',district:'',state:'',latitude:'',longitude:''});setNotice('Farm saved. Exact coordinates remain optional and private.')}catch(e){setNotice(errorMessage(e));}}
  return <div className="two-col"><Box title="Add a farm"><form onSubmit={create}>{[['name','Farm name'],['village','Village'],['district','District'],['state','State'],['latitude','Latitude (optional)'],['longitude','Longitude (optional)']].map(([key,label])=><Field key={key} label={label}><input required={!['village','latitude','longitude'].includes(key)} value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})}/></Field>)}<button className="button primary">Save farm</button></form>{notice&&<Note>{notice}</Note>}</Box><Box title="My farms">{farms.error&&<Error>{farms.error}</Error>}<div className="workspace-stack">{farms.data.map(f=><div className="result-line" key={f.id}><div><b>{f.name}</b><small>{[f.village,f.district,f.state].filter(Boolean).join(', ')}</small></div>{f.latitude&&f.longitude?<span className="chip">GPS Recorded</span>:<span className="chip-muted">District Level</span>}</div>)}{!farms.data.length&&<p className="muted">No farms added yet.</p>}</div></Box></div>;
}

export function OffersWorkflow({user}){
  const offers=useData('offers/');const [open,setOpen]=useState(null),[values,setValues]=useState({quantity_qtl:'',price_per_qtl:''}),[notice,setNotice]=useState('');
  const isFarmer = user?.role === 'FARMER';

  async function accept(o){
    setNotice('');
    try{await api.post(`offers/${o.id}/accept/`);setNotice('Offer accepted! Order confirmed and inventory atomically locked.');offers.reload();}
    catch(e){setNotice(errorMessage(e));}
  }
  async function counter(e,o){
    e.preventDefault();
    setNotice('');
    try{await api.post(`offers/${o.id}/counter/`,values);setNotice('Counteroffer sent. Waiting for counterparty response.');setOpen(null);offers.reload();}
    catch(e){setNotice(errorMessage(e));}
  }

  return <Box
    title={isFarmer ? 'Incoming Purchase Offers & Negotiations' : 'Submitted Purchase Offers & Counteroffers'}
    aside={<span className="chip">{offers.data.filter(o=>o.status==='PENDING').length} Pending</span>}
  >
    {offers.error&&<Error>{offers.error}</Error>}
    {notice&&<Note>{notice}</Note>}
    <div className="workspace-stack">
      {offers.data.map(o=>{
        const canRespond=o.status==='PENDING'&&o.proposed_by!==user.id;
        const counterpartyLabel = isFarmer
          ? `${o.buyer_name || `Buyer #${o.buyer}`}`
          : `${o.farmer_name || 'Grower'}`;
        const counterpartyVerified = isFarmer ? o.buyer_verified : true;
        const totalInr = Number(o.quantity_qtl || 0) * Number(o.price_per_qtl || 0);

        return <div key={o.id} className="order-card role-enriched-card">
          <div className="order-card-top">
            <div>
              <div className="card-badges-row">
                <span className="chip-accent">{o.crop_name || `Listing #${o.listing}`}</span>
                {o.listing_variety && <span className="chip-muted">{o.listing_variety}</span>}
                {o.listing_grade && <span className="chip-muted">Grade {o.listing_grade}</span>}
                {isFarmer && (
                  <span className={`status-pill ${counterpartyVerified ? 'verified' : 'unverified'}`}>
                    {counterpartyVerified ? 'Verified Buyer' : 'Unverified Buyer'}
                  </span>
                )}
              </div>
              <strong style={{display:'block',marginTop:'6px',fontSize:'1.05rem',color:'#0f172a'}}>
                {o.quantity_qtl} qtl @ {money(o.price_per_qtl)}/qtl · {money(totalInr)} total
              </strong>
              <small className="muted">
                {isFarmer ? 'From' : 'To'}: <b>{counterpartyLabel}</b> · {o.listing_district}, {o.listing_state}
                {o.listing_asking_per_qtl ? ` · Asking: ${money(o.listing_asking_per_qtl)}/qtl` : ''}
                {` · Expires ${new Date(o.expires_at).toLocaleDateString()}`}
              </small>
            </div>
            <span className={`status-pill ${o.status === 'ACCEPTED' ? 'verified' : o.status === 'PENDING' ? 'pending' : 'unverified'}`}>
              {o.status}
            </span>
          </div>

          {o.status==='PENDING'&&(
            <div className="actions-wrap" style={{marginTop:'10px',alignItems:'center',justifyContent:'space-between'}}>
              <small className="muted">
                {canRespond
                  ? 'Counterparty waiting for your response.'
                  : 'Waiting for counterparty to accept, reject, or counter.'}
              </small>
              <div className="actions-wrap">
                {canRespond ? (
                  <>
                    <button className="button primary small" onClick={()=>accept(o)}>
                      <CheckCircle2 size={14}/> Accept Offer
                    </button>
                    <button className="button subtle small" onClick={()=>{setOpen(open===o.id?null:o.id);setValues({quantity_qtl:o.quantity_qtl,price_per_qtl:o.price_per_qtl});}}>
                      <ArrowLeftRight size={14}/> Counteroffer
                    </button>
                    <button className="button subtle small" onClick={async()=>{try{await api.post(`offers/${o.id}/reject/`);offers.reload();}catch(err){setNotice(errorMessage(err));}}}>
                      Reject
                    </button>
                  </>
                ) : (
                  <button className="button subtle small" onClick={async()=>{try{await api.post(`offers/${o.id}/withdraw/`);offers.reload();}catch(err){setNotice(errorMessage(err));}}}>
                    Withdraw My Proposal
                  </button>
                )}
              </div>
            </div>
          )}

          {open===o.id&&(
            <form onSubmit={e=>counter(e,o)} className="form-grid" style={{marginTop:'12px',padding:'12px',background:'#f8fafc',borderRadius:'8px',border:'1px solid #e2e8f0'}}>
              <Field label="Counter Quantity (qtl)"><input type="number" step="0.001" min="0.001" value={values.quantity_qtl} required onChange={e=>setValues({...values,quantity_qtl:e.target.value})}/></Field>
              <Field label="Counter Price (₹/qtl)"><input type="number" step="0.01" min="0.01" value={values.price_per_qtl} required onChange={e=>setValues({...values,price_per_qtl:e.target.value})}/></Field>
              <button className="button primary small" style={{alignSelf:'flex-end'}}>Submit Counteroffer</button>
            </form>
          )}
        </div>;
      })}
      {!offers.data.length&&<p className="muted">No offers on your account yet.</p>}
    </div>
  </Box>;
}

export function AccountSecurity({onUserUpdate}){
  const params=new URLSearchParams(window.location.search);
  const [current,setCurrent]=useState(''),[next,setNext]=useState(''),[message,setMessage]=useState('');
  const [emailPassword,setEmailPassword]=useState(''),[newEmail,setNewEmail]=useState('');
  const [emailChallenge,setEmailChallenge]=useState(params.get('email_change_id')||'');
  const [emailToken,setEmailToken]=useState(params.get('email_change_token')||'');
  const [sessions,setSessions]=useState([]);
  async function refreshSessions(){try{const r=await api.get('auth/sessions/');setSessions(r.data);}catch(e){setMessage(errorMessage(e));}}
  useEffect(()=>{refreshSessions();},[]);
  async function change(e){e.preventDefault();try{const r=await api.post('auth/change-password/',{
    current_password:current,new_password:next});setMessage(r.data.message);setCurrent('');setNext('');}
    catch(e){setMessage(errorMessage(e));}}
  async function requestEmailChange(e){e.preventDefault();try{
    const r=await api.post('auth/email-change/request/',{new_email:newEmail,current_password:emailPassword});
    setMessage(r.data.message);setEmailChallenge(r.data.challenge_id);setEmailPassword('');
  }catch(e){setMessage(errorMessage(e));}}
  async function confirmEmailChange(e){e.preventDefault();try{
    const r=await api.post('auth/email-change/confirm/',{challenge_id:emailChallenge,token:emailToken});
    onUserUpdate?.(r.data.user);setMessage(r.data.message);setEmailToken('');
    window.history.replaceState(null,'',window.location.pathname);
  }catch(e){setMessage(errorMessage(e));}}
  async function revoke(jti){try{const r=await api.post(`auth/sessions/${encodeURIComponent(jti)}/revoke/`);
    setMessage(r.data.message);refreshSessions();}catch(e){setMessage(errorMessage(e));}}
  return <div className="workspace-stack">
    <Box title="Change password"><p className="muted">Password changes revoke all existing refresh tokens. Existing short-lived access tokens expire normally.</p>
      <form onSubmit={change}><Field label="Current password"><input type="password" autoComplete="current-password" required value={current} onChange={e=>setCurrent(e.target.value)}/></Field>
        <Field label="New password"><input type="password" autoComplete="new-password" required minLength={10} value={next} onChange={e=>setNext(e.target.value)}/></Field>
        <button className="button primary">Change password</button>
      </form>
    </Box>
    <Box title="Change verified email"><p className="muted">Requires your current password and confirmation from the NEW mailbox. Google-linked accounts with no password need to create a password through verified account recovery first.</p>
      <form onSubmit={requestEmailChange}><Field label="New email"><input type="email" required value={newEmail} onChange={e=>setNewEmail(e.target.value)}/></Field>
        <Field label="Current password"><input type="password" required value={emailPassword} onChange={e=>setEmailPassword(e.target.value)}/></Field>
        <button className="button subtle">Send new-email confirmation</button>
      </form>
      <form onSubmit={confirmEmailChange}><Field label="Email change request ID"><input required value={emailChallenge} onChange={e=>setEmailChallenge(e.target.value)}/></Field>
        <Field label="Single-use email token"><input required value={emailToken} onChange={e=>setEmailToken(e.target.value)}/></Field>
        <button className="button primary">Verify new address</button>
      </form>
    </Box>
    <Box title="Active refresh-token sessions"><p className="muted">You may revoke individual refresh tokens. Current access tokens may remain valid for up to 15 minutes.</p>
      {sessions.map(s=><div key={s.jti} className="result-line"><span>Issued {new Date(s.created_at).toLocaleString()} · expires {new Date(s.expires_at).toLocaleString()} · {s.revoked?'Revoked':'Active'}</span>
        {!s.revoked&&<button className="button subtle small" onClick={()=>revoke(s.jti)}>Revoke</button>}</div>)}
      {!sessions.length&&<p className="muted">No active refresh sessions found.</p>}
      <button className="button subtle small" onClick={refreshSessions}>Refresh sessions</button>
    </Box>{message&&<Note>{message}</Note>}
  </div>;
}


/** Shipment evidence is private. Only order parties and assigned transporters can open it. */
export function ShipmentTimeline({id}){
  const [events,setEvents]=useState([]),[shown,setShown]=useState(false),[error,setError]=useState('');
  async function load(){try{const {data}=await api.get(`shipments/${id}/events/`);setEvents(data);setShown(true);setError('');}catch(e){setError(errorMessage(e));}}
  async function evidence(eventId){try{
    const r=await api.get(`shipments/evidence/${eventId}/`,{responseType:'blob'});
    const url=URL.createObjectURL(r.data),anchor=document.createElement('a');
    anchor.href=url;anchor.download=`shipment-evidence-${eventId}`;anchor.click();
    URL.revokeObjectURL(url);
  }catch(e){setError(errorMessage(e));}}
  return <div className="timeline"><button className="button subtle small" type="button" onClick={()=>shown?setShown(false):load()}>{shown?'Hide':'View'} shipment timeline</button>
    {error&&<p role="alert">{error}</p>}
    {shown&&<div>{events.map(ev=><div className="result-line" key={ev.id}><span>{ev.status} · {new Date(ev.recorded_at).toLocaleString()} · {ev.note||'No note'}</span>{ev.has_evidence&&<button type="button" className="button subtle small" onClick={()=>evidence(ev.id)}>Private evidence</button>}</div>)}{!events.length&&<p className="muted">No milestone events recorded.</p>}</div>}
  </div>;
}
