import React,{useEffect,useState} from 'react';
import {api,entries,errorMessage} from './api.js';

function Section({title,children}){return <section className="panel"><div className="panel-head"><h2>{title}</h2></div>{children}</section>}
function Field({label,children}){return <label className="field"><span>{label}</span>{children}</label>}
function Notice({children,error=false}){return <p role={error?'alert':'status'} className={`notice ${error?'error':'info'}`}>{children}</p>}
function useDataset(endpoint){
  const [data,setData]=useState([]),[error,setError]=useState('');
  async function refresh(){try{setData(entries(await api.get(endpoint)));setError('');}catch(e){setError(errorMessage(e));}}
  useEffect(()=>{refresh();},[endpoint]);
  return {data,error,refresh};
}
const money=(v)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(Number(v||0));
function toPaise(amount){
  if(!/^\d+(\.\d{1,2})?$/.test(amount))throw new Error('Enter a positive INR amount with at most two decimal places');
  const [rupees,paise='']=amount.split('.');const value=Number(rupees)*100+Number(paise.padEnd(2,'0'));
  if(!Number.isSafeInteger(value)||value<=0)throw new Error('Invalid refund amount');
  return value;
}

export function TradeCasework({user}){
  const orders=useDataset('orders/'), changes=useDataset('order-changes/'), disputes=useDataset('disputes/');
  const refunds=useDataset('refunds/'), payments=useDataset('payments/'), settlements=useDataset('settlements/');
  const [message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const [accept,setAccept]=useState({order:'',quantity_qtl:'',evidence_note:'',farmgate_handover_confirmed:false});
  const [change,setChange]=useState({order:'',kind:'CANCEL_REMAINDER',quantity_qtl:'',reason:''});
  const [dispute,setDispute]=useState({order:'',category:'QUALITY',description:''});
  const [refund,setRefund]=useState({payment:'',amount_inr:'',reason:''});
  async function run(url,payload,refresh){setBusy(true);setMessage('');try{
    await api.post(url,payload);setMessage('Record updated. This does not independently verify goods or bank transfers.');
    await Promise.all([orders.refresh(),changes.refresh(),disputes.refresh(),refunds.refresh(),settlements.refresh()]);
    if(refresh)await refresh();
  }catch(e){setMessage(errorMessage(e));}finally{setBusy(false);}}
  const orderOptions=orders.data.map(o=><option key={o.id} value={o.id}>{o.id.slice(0,8)} · {o.status} · {o.quantity_qtl} qtl</option>);
  return <div className="workspace-stack">
    <p className="muted">Trading declarations are auditable platform records. They are not a guarantee of crop quality, physical delivery, escrow, or bank settlement.</p>
    {message&&<Notice>{message}</Notice>}
    {orders.error&&<Notice error>{orders.error}</Notice>}
    <div className="two-col"><Section title="Buyer-confirmed crop receipt">
      {user.role==='BUYER'?<form onSubmit={e=>{e.preventDefault();run(`orders/${accept.order}/accept-delivery/`,{...accept,farmgate_handover_confirmed:accept.farmgate_handover_confirmed===true})}}>
        <Field label="Order"><select required value={accept.order} onChange={e=>setAccept({...accept,order:e.target.value})}><option value="">Select order</option>{orderOptions}</select></Field>
        <Field label="Quantity received and accepted (quintals)"><input type="number" min="0.001" step="0.001" required value={accept.quantity_qtl} onChange={e=>setAccept({...accept,quantity_qtl:e.target.value})}/></Field>
        <Field label="Evidence note (optional)"><textarea value={accept.evidence_note} maxLength={1000} onChange={e=>setAccept({...accept,evidence_note:e.target.value})}/></Field>
        <label className="field"><input type="checkbox" checked={accept.farmgate_handover_confirmed} onChange={e=>setAccept({...accept,farmgate_handover_confirmed:e.target.checked})}/> I confirm direct farmgate handover if no transporter was assigned</label>
        <button className="button primary" disabled={busy}>Record buyer acceptance</button>
      </form>:<p className="muted">Only the buyer may attest receipt. The farmer sees the recorded accepted quantity below.</p>}
      {orders.data.map(o=><p className="muted" key={o.id}>Order {o.id.slice(0,8)} · Buyer accepted {o.accepted_qtl} of {o.quantity_qtl} qtl · Cancelled {o.cancelled_qtl} qtl</p>)}
    </Section>
    <Section title="Request partial cancellation or return"><form onSubmit={e=>{e.preventDefault();run('order-changes/',change)}}>
      <Field label="Order"><select required value={change.order} onChange={e=>setChange({...change,order:e.target.value})}><option value="">Select order</option>{orderOptions}</select></Field>
      <Field label="Request type"><select value={change.kind} onChange={e=>setChange({...change,kind:e.target.value})}><option value="CANCEL_REMAINDER">Cancel all quantity not yet accepted</option><option value="RETURN">Return previously accepted crop</option></select></Field>
      <Field label="Quantity (quintals)"><input required type="number" step="0.001" min="0.001" value={change.quantity_qtl} onChange={e=>setChange({...change,quantity_qtl:e.target.value})}/></Field>
      <Field label="Reason"><textarea required minLength={10} maxLength={1000} value={change.reason} onChange={e=>setChange({...change,reason:e.target.value})}/></Field>
      <button className="button primary" disabled={busy}>Send request to other party</button>
    </form></Section></div>
    <Section title="Changes awaiting agreement">{changes.error&&<Notice error>{changes.error}</Notice>}
      {changes.data.map(c=><div className="result-line" key={c.id}><div><b>{c.kind} · {c.quantity_qtl} qtl · {c.status}</b><small>{c.order.slice(0,8)} · {c.reason}</small></div>{c.status==='PROPOSED'&&c.proposed_by!==user.id&&<div className="actions-wrap"><button className="button primary small" disabled={busy} onClick={()=>run(`order-changes/${c.id}/respond/`,{decision:'APPROVE'})}>Accept</button><button className="button subtle small" disabled={busy} onClick={()=>run(`order-changes/${c.id}/respond/`,{decision:'REJECT'})}>Reject</button></div>}</div>)}
      {!changes.data.length&&<p className="muted">No quantity changes requested.</p>}
    </Section>
    <div className="two-col"><Section title="Raise an order dispute"><form onSubmit={e=>{e.preventDefault();run('disputes/',dispute)}}>
      <Field label="Order"><select required value={dispute.order} onChange={e=>setDispute({...dispute,order:e.target.value})}><option value="">Select order</option>{orderOptions}</select></Field>
      <Field label="Issue"><select value={dispute.category} onChange={e=>setDispute({...dispute,category:e.target.value})}><option value="QUALITY">Crop quality</option><option value="QUANTITY">Quantity mismatch</option><option value="TRANSPORT">Transportation</option><option value="PAYMENT">Payment</option><option value="OTHER">Other</option></select></Field>
      <Field label="Description"><textarea required minLength={15} maxLength={5000} value={dispute.description} onChange={e=>setDispute({...dispute,description:e.target.value})}/></Field>
      <button className="button primary" disabled={busy}>Open dispute for administrator review</button>
    </form><h3>Dispute history</h3>{disputes.data.map(d=><p className="muted" key={d.id}>#{d.id} · {d.category} · {d.status} · {d.resolution_note||'Pending review'}</p>)}</Section>
    <Section title="Request a captured-payment refund"><p className="muted">Refund requests require an actual gateway-captured payment and administrator approval. Provider refund status is confirmed separately.</p>
      <form onSubmit={e=>{e.preventDefault();try{run('refunds/',{payment:refund.payment,amount_paise:toPaise(refund.amount_inr),reason:refund.reason});}catch(err){setMessage(err.message);}}}>
        <Field label="Captured payment"><select required value={refund.payment} onChange={e=>setRefund({...refund,payment:e.target.value})}><option value="">Choose payment</option>{payments.data.filter(p=>p.status==='CAPTURED').map(p=><option key={p.id} value={p.id}>{p.order.slice(0,8)} · {money(p.amount_inr)}</option>)}</select></Field>
        <Field label="Amount (INR)"><input required value={refund.amount_inr} placeholder="1000.00" onChange={e=>setRefund({...refund,amount_inr:e.target.value})}/></Field>
        <Field label="Reason"><textarea required minLength={15} maxLength={1000} value={refund.reason} onChange={e=>setRefund({...refund,reason:e.target.value})}/></Field>
        <button className="button primary" disabled={busy}>Submit refund request</button>
      </form><h3>Refund status</h3>{refunds.data.map(r=><p className="muted" key={r.id}>Request #{r.id} · {money(Number(r.amount_paise)/100)} · {r.status}</p>)}</Section></div>
    <Section title="Confirm an off-platform settlement declaration"><p className="muted">An acknowledgement is only the other party's recorded claim. It is not bank verification.</p>
      {settlements.data.map(s=><div className="result-line" key={s.id}><span>Order {s.order.slice(0,8)} · {money(s.amount_inr)} · {s.status}</span>{s.status==='DECLARED'&&s.declared_by!==user.id&&<button className="button subtle small" disabled={busy} onClick={()=>run(`settlements/${s.id}/acknowledge/`,{acknowledge:true})}>Acknowledge declaration</button>}</div>)}
      {!settlements.data.length&&<p className="muted">No manual settlement records.</p>}
    </Section>
  </div>;
}

export function MyListings(){
  const listings=useDataset('my-listings/');const[editing,setEditing]=useState(null),[msg,setMsg]=useState('');
  async function submit(e){e.preventDefault();try{await api.patch(`listings/${editing.id}/`,{quantity_qtl:editing.quantity_qtl,asking_per_qtl:editing.asking_per_qtl,description:editing.description});setEditing(null);setMsg('Listing updated');listings.refresh();}catch(err){setMsg(errorMessage(err));}}
  async function close(id){try{await api.delete(`listings/${id}/`);setMsg('Listing closed; existing orders remain recorded.');listings.refresh();}catch(err){setMsg(errorMessage(err));}}
  return <Section title="Manage my crop listings">{msg&&<Notice>{msg}</Notice>}{listings.data.map(x=><div className="order-card" key={x.id}><b>Listing #{x.id} · {x.crop_name} · {x.status}</b><p>{x.quantity_qtl} qtl inventory · {x.reserved_qtl} qtl reserved · Available {x.available_qtl} qtl</p>
    {editing?.id===x.id?<form onSubmit={submit} className="form-grid"><Field label="Total remaining inventory (qtl)"><input required type="number" step="0.001" min="0.001" value={editing.quantity_qtl} onChange={e=>setEditing({...editing,quantity_qtl:e.target.value})}/></Field><Field label="Asking INR/qtl"><input required type="number" step="0.01" min="0.01" value={editing.asking_per_qtl} onChange={e=>setEditing({...editing,asking_per_qtl:e.target.value})}/></Field><Field label="Description"><input value={editing.description||''} onChange={e=>setEditing({...editing,description:e.target.value})}/></Field><button className="button primary">Save</button><button type="button" className="button subtle" onClick={()=>setEditing(null)}>Cancel</button></form>:<div className="actions-wrap"><button className="button subtle small" onClick={()=>setEditing(x)}>Edit</button>{x.status==='ACTIVE'&&<button className="button subtle small" onClick={()=>close(x.id)}>Close listing</button>}</div>}
  </div>)}{!listings.data.length&&<p className="muted">No listings created yet.</p>}</Section>;
}

function useReviewQueue(){
  const [data,setData]=useState({unverified_vehicles:[],open_disputes:[],pending_refunds:[]});
  const [error,setError]=useState('');
  async function refresh(){try{const r=await api.get('admin/review-queue/');setData(r.data);setError('');}catch(e){setError(errorMessage(e));}}
  useEffect(()=>{refresh();},[]);
  return {data,error,refresh};
}

export function AdminReview(){
  const queue=useReviewQueue();const [msg,setMsg]=useState(''),[busy,setBusy]=useState(false);
  const [imports,setImports]=useState(null);
  useEffect(()=>{api.get('admin/import-monitor/').then(r=>setImports(r.data)).catch(()=>{});},[]);
  const [notes,setNotes]=useState({});
  async function handle(url,payload){setBusy(true);try{await api.post(url,payload);setMsg('Administrator action recorded in audit log.');await queue.refresh();}catch(e){setMsg(errorMessage(e));}finally{setBusy(false);}}
  return <div className="workspace-stack"><p className="muted">Administrator review is a permissioned audit action. Vehicle verification requires actual evidence checks; gateway refunds require a configured merchant.</p>{msg&&<Notice>{msg}</Notice>}
    {queue.error&&<Notice error>{queue.error}</Notice>}
    <Section title="Government-data ingestion monitoring">
      <p className="muted">Import runs are operational records, not claims that live government data is connected. Unverified file imports and suspicious prices are flagged.</p>
      {(imports?.runs||[]).map(r=><div className="result-line" key={r.id}><span>Run #{r.id} · {r.source} · {r.status}<small>{new Date(r.started_at).toLocaleString()} · received {r.received_count} · created {r.created_count} · updated {r.updated_count} · invalid {r.invalid_count} · flagged {r.flagged_count}</small></span></div>)}
      {!(imports?.runs||[]).length&&<p className="muted">No ingestion jobs recorded yet.</p>}
      {(imports?.flagged_samples||[]).length>0&&<p className="muted">{imports.flagged_samples.length} recent flagged observations require administrator review. These are excluded from farmer recommendations.</p>}
    </Section>
    <Section title="Vehicle verification queue">{(queue.data.unverified_vehicles||[]).map(v=><div className="result-line" key={v.id}><div><span>{v.registration} · {v.vehicle_type} · {v.capacity_qtl} qtl</span><label className="field"><span>Evidence review note</span><input value={notes[`v${v.id}`]||''} onChange={e=>setNotes({...notes,[`v${v.id}`]:e.target.value})} placeholder="Document checked and date (no ID numbers)" /></label></div><button className="button subtle small" disabled={busy||(notes[`v${v.id}`]||'').length<15} onClick={()=>handle(`admin/vehicles/${v.id}/verify/`,{verified:true,evidence_note:notes[`v${v.id}`]})}>Approve after document review</button></div>)}</Section>
    <Section title="Trade disputes">{(queue.data.open_disputes||[]).map(d=><div className="order-card" key={d.id}><b>#{d.id} · {d.category} · {d.status}</b><p>{d.description}</p><Field label="Audit resolution note"><textarea value={notes[`d${d.id}`]||''} onChange={e=>setNotes({...notes,[`d${d.id}`]:e.target.value})}/></Field><div className="actions-wrap"><button className="button primary small" disabled={busy||(notes[`d${d.id}`]||'').length<15} onClick={()=>handle(`disputes/${d.id}/resolve/`,{decision:'RESOLVE',resolution_note:notes[`d${d.id}`]})}>Resolve</button><button className="button subtle small" disabled={busy||(notes[`d${d.id}`]||'').length<15} onClick={()=>handle(`disputes/${d.id}/resolve/`,{decision:'REJECT',resolution_note:notes[`d${d.id}`]})}>Reject</button></div></div>)}</Section>
    <Section title="Provider refund approval queue"><p className="muted">Submitting is a real gateway API request, not a demo. If the network outcome is unknown, use the merchant dashboard to reconcile rather than retry.</p>
      {(queue.data.pending_refunds||[]).map(r=><div className="result-line" key={r.id}><span>#{r.id} · {money(Number(r.amount_paise)/100)} · {r.reason}</span><div className="actions-wrap"><button className="button subtle small" disabled={busy} onClick={()=>handle(`refunds/${r.id}/review/`,{decision:'REJECT'})}>Reject</button><button className="button primary small" disabled={busy} onClick={()=>handle(`refunds/${r.id}/review/`,{decision:'SUBMIT'})}>Submit to gateway</button></div></div>)}
    </Section>
  </div>;
}
