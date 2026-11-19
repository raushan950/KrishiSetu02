import axios from 'axios';
export const api=axios.create({baseURL:import.meta.env.VITE_API_BASE_URL||'/api/v1/',timeout:20000});
const key='krishisetu_session';
export function getSession(){try{return JSON.parse(sessionStorage.getItem(key)||'null')}catch{return null}}
export function setSession(session){sessionStorage.setItem(key,JSON.stringify(session));}
export function dropSession(){sessionStorage.removeItem(key)}
api.interceptors.request.use((config)=>{const session=getSession();if(session?.access&&!config.headers.Authorization)config.headers.Authorization=`Bearer ${session.access}`;return config});
let refreshing;
api.interceptors.response.use(r=>r,async error=>{
 const original=error.config;
 if(error.response?.status===401&&!original?._retry&&getSession()?.refresh&&!['auth/refresh/','auth/login/','auth/google/','auth/register/'].some(p=>original.url?.includes(p))){
  original._retry=true;
  try{
   refreshing ||= axios.post(`${api.defaults.baseURL}auth/refresh/`,{refresh:getSession().refresh}).then(r=>{
    const updated={...getSession(),access:r.data.access,refresh:r.data.refresh||getSession().refresh};setSession(updated);return updated;
   }).finally(()=>{refreshing=null});
   const next=await refreshing;original.headers.Authorization=`Bearer ${next.access}`;return api(original);
  }catch{dropSession();window.dispatchEvent(new Event('krishisetu-session-expired'))}
 }
 return Promise.reject(error);
});
export function errorMessage(error){const data=error?.response?.data;if(typeof data==='string')return data;if(data?.detail)return data.detail;if(data&&typeof data==='object')return Object.entries(data).map(([k,v])=>`${k}: ${Array.isArray(v)?v.join(', '):typeof v==='object'?JSON.stringify(v):v}`).join(' · ');return error?.message||'Request failed';}
export function entries(response){return Array.isArray(response.data)?response.data:response.data?.results||[]}
