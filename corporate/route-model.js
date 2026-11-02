// 点検する日の計画（1日のスケジュール）。出発地から拠点を回る順番と、時刻の目安を出す。
// 距離は2点の直線距離×道路の係数、時間は平均の速さから出した「目安」。道路・渋滞は見ていない。位置がないところは「未取得」のまま（0にしない）。
import {record} from './model.js';
import {locationOf} from './operations-model.js';
export const PLACES=[['home','自宅'],['warehouse','倉庫'],['office','本社']];
export const ROUTE_DEFAULT={places:{},speed:35,factor:1.4,departure:'08:00',baseMinutes:60,dayEnd:'18:00'};
export const routeSettings=d=>({...ROUTE_DEFAULT,...(d.routeSettings||{}),places:{...(d.routeSettings?.places||{})}});
const ok=p=>p&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&Math.abs(p.lat)<=90&&Math.abs(p.lon)<=180;
const toMin=t=>/^([01]\d|2[0-3]):[0-5]\d$/.test(t||'')?Number(t.slice(0,2))*60+Number(t.slice(3)):null;
export const hm=m=>m==null?'':`${String(Math.floor(m/60)%24).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
export function leg(a,b,set){if(!ok(a)||!ok(b))return null;const r=Math.PI/180,x=(b.lat-a.lat)*r,y=(b.lon-a.lon)*r,h=Math.sin(x/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(y/2)**2,km=6371*2*Math.asin(Math.sqrt(Math.min(1,h)))*set.factor;return {km,minutes:Math.ceil(km/set.speed*60/5)*5};}
export const placeOf=(set,key)=>{const p=set.places[key];return ok(p)?p:null;};
export const placeLabel=(set,key)=>PLACES.find(p=>p[0]===key)?.[1]||'';
// 1日の表：出発 →（立ち寄り）→ 拠点… → 帰着。前の時刻が出せないところから先は時刻を「未取得」にする。
export function dayTimeline(d,plan){const set=routeSettings(d),rows=[];let now=toMin(plan.departure||set.departure),pos=placeOf(set,plan.start),km=0,known=true;
  rows.push({kind:'start',label:`出発（${placeLabel(set,plan.start)}）`,at:now,place:!!pos});
  const go=(to,row)=>{const l=leg(pos,to,set);if(!l||now==null){now=null;known=false;}else{now+=l.minutes;km+=l.km;}rows.push({...row,arrive:now,move:l});pos=to;};
  if(plan.via){go(placeOf(set,plan.via),{kind:'via',label:`立ち寄り（${placeLabel(set,plan.via)}）`});if(now!=null)now+=15;}
  for(const st of plan.stops||[]){const s=d.sites.find(x=>x.id===st.siteId);if(!s){rows.push({kind:'missing',label:'見つからない拠点',arrive:null});continue;}const work=Number.isInteger(st.minutes)?st.minutes:set.baseMinutes;go(locationOf(s),{kind:'site',site:s,work,exception:Number.isInteger(st.minutes),label:s.name});if(now!=null)now+=work;rows.at(-1).leave=now;}
  go(placeOf(set,plan.end||plan.start),{kind:'end',label:`帰着（${placeLabel(set,plan.end||plan.start)}）`});
  const end=rows.at(-1).arrive,limit=toMin(set.dayEnd);
  return {rows,km:known?km:null,end,over:end!=null&&limit!=null&&end>limit,workTotal:rows.filter(r=>r.kind==='site').reduce((n,r)=>n+r.work,0),set};}
// 近い順：出発地（立ち寄りがあればそこ）から、まだ回っていない一番近い拠点を順に選ぶ。位置のない拠点は最後に元の順で。
export function nearestOrder(d,plan){const set=routeSettings(d);let pos=placeOf(set,plan.via||plan.start);const left=[...(plan.stops||[])],out=[],noLoc=[];
  for(const st of [...left]){const s=d.sites.find(x=>x.id===st.siteId);if(!s||!locationOf(s)){noLoc.push(st);left.splice(left.indexOf(st),1);}}
  if(!pos)return [...left,...noLoc];
  while(left.length){let best=0,bd=Infinity;left.forEach((st,i)=>{const l=leg(pos,locationOf(d.sites.find(x=>x.id===st.siteId)),set);if(l&&l.km<bd){bd=l.km;best=i;}});const [st]=left.splice(best,1);out.push(st);pos=locationOf(d.sites.find(x=>x.id===st.siteId));}
  return [...out,...noLoc];}
// 足す候補：受託中・受託予定・申請中の拠点。今月まだ点検していない拠点を上に。すでにこの日に入っている拠点は外す。
export function candidates(d,plan){const m=plan.date.slice(0,7),inPlan=new Set((plan.stops||[]).map(s=>s.siteId)),doneThisMonth=id=>(d.visits||[]).some(v=>v.siteId===id&&v.status==='complete'&&String(v.at||'').slice(0,7)===m)||(d.inspections||[]).some(i=>i.siteId===id&&String(i.performedOn||'').slice(0,7)===m);
  return d.sites.filter(s=>['受託中','受託予定','申請中'].includes(s.status)&&!inPlan.has(s.id)).map(s=>({site:s,done:doneThisMonth(s.id),loc:!!locationOf(s)})).sort((a,b)=>a.done-b.done||(a.site.boardNo??9999)-(b.site.boardNo??9999));}
export const newPlan=(date,set)=>({id:'day-'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),date,start:'home',via:'',end:'home',departure:set.departure,stops:[],links:{},confirmedAt:null});
// 確定：各拠点に点検予定を作る（作ったものは plan.links で覚え、もう一度確定したときは時刻だけ合わせる）。外した拠点の予定は消さない。
export function confirmPlan(d,plan){const t=dayTimeline(d,plan);let made=0,updated=0;plan.links??={};
  for(const r of t.rows.filter(r=>r.kind==='site')){const id=plan.links[r.site.id],old=id&&d.inspections.find(i=>i.id===id),start=r.arrive==null?'':hm(r.arrive);
    if(old){if(!old.performedOn){old.date=plan.date;old.start=start;old.durationMinutes=r.work;updated++;}}
    else{const i=record('inspections',{siteId:r.site.id,kind:'月次点検',date:plan.date,start,durationMinutes:r.work,memo:'点検する日の計画から作成'});d.inspections.push(i);plan.links[r.site.id]=i.id;made++;}}
  plan.confirmedAt=new Date().toISOString();return {made,updated};}
// 独立デモだけ：見本の出発地（架空）と、作成済みの計画（自宅 → 倉庫に寄る → 拠点 → 自宅）を入れる。実務では使わない。
export function addDemoSample(d,today){if(d.kind!=='demo')throw Error('見本は独立デモの中だけで入れられます');const s=d.sites.find(x=>x.status==='受託中')||d.sites[0];if(!s)throw Error('拠点がありません');
  if(!locationOf(s))s.location={lat:37.7608,lon:140.4747,source:'独立デモの見本の位置（架空）'};
  const set=routeSettings(d);d.routeSettings={...set,places:{home:{label:'見本の自宅（架空）',lat:37.7440,lon:140.4384},warehouse:{label:'見本の倉庫（架空）',lat:37.7900,lon:140.4400},office:{label:'見本の本社（架空）',lat:37.7500,lon:140.4670},...set.places}};
  const plan={...newPlan(today,set),via:'warehouse',stops:[{siteId:s.id,minutes:120}]};d.dayPlans??=[];d.dayPlans.push(plan);confirmPlan(d,plan);return plan;}
