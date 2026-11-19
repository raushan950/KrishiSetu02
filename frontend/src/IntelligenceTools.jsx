import React,{useState,useEffect} from 'react';
import {ResponsiveContainer,LineChart,Line,XAxis,YAxis,Tooltip,CartesianGrid} from 'recharts';
import {api,entries,errorMessage} from './api.js';
function Section({title,children}){return <section className="panel"><div className="panel-head"><h2>{title}</h2></div>{children}</section>}
function Field({label,children}){return <label className="field"><span>{label}</span>{children}</label>}
function useRows(url){const[data,setData]=useState([]);useEffect(()=>{let live=true;api.get(url).then(r=>{if(live)setData(entries(r));}).catch(()=>{});return()=>{live=false};},[url]);return data;}
const money=v=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(Number(v||0));
export function IntelligenceTools({role}){
  const crops=useRows('crops/'),markets=useRows('markets/'),farms=useRows(role==='FARMER'?'farms/':'crops/');
  const [crop,setCrop]=useState(''),[market,setMarket]=useState(''),[profile,setProfile]=useState(''),[question,setQuestion]=useState(''),[quantity,setQuantity]=useState(''),[route,setRoute]=useState({farm_id:'',market_id:''});
  const [cost,setCost]=useState(''),[result,setResult]=useState(null),[history,setHistory]=useState(null),[routeResult,setRouteResult]=useState(null),[message,setMessage]=useState('');
  const profileParams=profile?JSON.parse(profile):{};
  const availableProfiles=result?.available_profiles||history?.available_profiles||[];
  async function runAssistant(e){e.preventDefault();setMessage('');try{
    const costs=cost&&market?{[market]:{costs:{transport:cost}}}:{};
    const {data}=await api.post('assistant/guided/',{crop_id:crop,question,quantity_qtl:quantity||null,costs_by_market:costs,...profileParams});setResult(data);
  }catch(err){setMessage(errorMessage(err));}}
  async function loadHistory(e){e.preventDefault();setMessage('');try{
    const {data}=await api.get('analytics/history/',{params:{crop,market,...profileParams}});setHistory(data);
  }catch(err){setMessage(errorMessage(err));}}
  async function getRoute(e){e.preventDefault();setMessage('');try{
    const {data}=await api.post('routing/road/',route);setRouteResult(data);
  }catch(err){setRouteResult(null);setMessage(errorMessage(err));}}
  const chart=(history?.observations||[]).slice(0,70).reverse().map(o=>({date:o.date,price:Number(o.modal_inr_per_qtl)}));
  return <div className="workspace-stack">
    <p className="muted">These insights use stored agricultural observations, not guaranteed trade prices. Enter costs yourself; no assumed freight or route is invented.</p>
    {message&&<p role="alert" className="notice error">{message}</p>}
    {availableProfiles.length>1&&<Section title="Choose comparable market data"><p className="muted">This crop has different varieties, grades or sources. Choose one profile to avoid misleading price comparisons. Then run the query again.</p><Field label="Variety · Grade · Data source"><select value={profile} onChange={e=>setProfile(e.target.value)}><option value="">Choose a specific data profile</option>{availableProfiles.map((p,i)=><option key={i} value={JSON.stringify(p)}>{p.variety||'Unspecified variety'} · {p.grade||'Unspecified grade'} · {p.source}</option>)}</select></Field></Section>}
    <Section title="Market assistant — verified source facts"><form onSubmit={runAssistant}>
      <div className="form-grid"><Field label="Crop"><select required value={crop} onChange={e=>{setCrop(e.target.value);setProfile('');setResult(null);setHistory(null);}}><option value="">Select crop</option>{crops.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
      <Field label="Quantity (qtl, optional)"><input type="number" min="0.001" step="0.001" value={quantity} onChange={e=>setQuantity(e.target.value)}/></Field></div>
      <Field label="Question"><textarea value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Where can I sell my crop and what evidence supports the comparison?" maxLength={600}/></Field>
      <Field label="Optional market for cost-specific calculation"><select value={market} onChange={e=>{setMarket(e.target.value);setProfile('');setResult(null);setHistory(null);}}><option value="">No market selected</option>{markets.map(m=><option key={m.id} value={m.id}>{m.name}, {m.district}</option>)}</select></Field>
      <Field label="Your total transport cost for this market (₹)"><input value={cost} type="number" min="0" step="0.01" onChange={e=>setCost(e.target.value)}/></Field>
      <button className="button primary">Get source-grounded explanation</button>
    </form>{result&&<div aria-live="polite"><p>{result.answer}</p>{result.profile&&<p className="muted">Profile: {result.profile.variety||'Unspecified variety'} · {result.profile.grade||'Unspecified grade'} · {result.profile.source}</p>}{result.llm_narration&&<p className="notice">Optional AI wording (verify it against the facts below): {result.llm_narration}</p>}
      {(result.ranked||[]).map(r=><div className="result-line" key={r.market_id}><span>{r.market} · Net estimate: {money(r.calculation.net_inr)}</span><small>{r.date} · {r.source}</small></div>)}
      {(result.sources||[]).map((o,i)=><div className="result-line" key={i}><span>{o.market}: {money(o.modal_inr_per_qtl)}/qtl</span><small>{o.date} · {o.source} · {o.freshness_days} days old</small></div>)}
    </div>}</Section>
    <Section title="Historical mandi observations"><p className="muted">Select a crop and market above. The graph shows dates of recorded modal prices, not a future-price guarantee.</p>
      <form onSubmit={loadHistory}><button disabled={!crop||!market} className="button subtle">Load selected crop/market history</button></form>
      {history&&(history.status==='PROFILE_SELECTION_REQUIRED'?<p className="notice">{history.reason}</p>:history.observations.length?<><p>{history.count} source-specific recorded observations found</p><div className="chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={chart}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="date"/><YAxis/><Tooltip formatter={v=>money(v)}/><Line type="monotone" dataKey="price" stroke="#167449" dot={false}/></LineChart></ResponsiveContainer></div><p className="muted">Sources: {[...new Set(history.observations.map(x=>x.source))].join(', ')}</p></>:<p className="muted">No verified historical observations available for this selection.</p>)}
    </Section>
    {role==='FARMER'&&<Section title="Verified road-route estimate"><p className="muted">Requires your farm coordinates, market coordinates and an authorized openrouteservice account. Route distance is not a transporter freight quotation.</p>
      <form onSubmit={getRoute} className="form-grid"><Field label="My farm"><select required value={route.farm_id} onChange={e=>setRoute({...route,farm_id:e.target.value})}><option value="">Choose farm</option>{farms.map(f=><option key={f.id} value={f.id}>{f.name} · {f.district}</option>)}</select></Field>
        <Field label="Destination mandi"><select required value={route.market_id} onChange={e=>setRoute({...route,market_id:e.target.value})}><option value="">Choose market</option>{markets.map(m=><option key={m.id} value={m.id}>{m.name} · {m.district}</option>)}</select></Field>
        <button className="button primary">Check provider road distance</button>
      </form>{routeResult&&<p role="status">{routeResult.distance_km} km · {routeResult.estimated_driving_hours} hours estimated · Source: {routeResult.source}</p>}
    </Section>}
  </div>;
}
