import {eventsFor,regionOf} from './integration-model.js';
import {day,validDay} from './model.js';
import {attentionExtras,urgentCount,attentionIndex,rowKey} from './board-model.js';
const regions=['県北','県中','県南','未分類'];
// Read-only projection. All badges and drilldowns consume these same rows.
export function unresolvedItems(d){
 const sites=Array.isArray(d.sites)?d.sites:[],unknown=sites.filter(s=>!Array.isArray(s.field?.issues)).map(s=>({id:s.id,name:s.name})),rows=[];
 for(const s of sites)for(const [index,i] of (Array.isArray(s.field?.issues)?s.field.issues:[]).entries())rows.push({...i,key:i.id||`missing:${s.id}:${index}`,type:'issue',siteId:s.id,siteName:s.name,region:regionOf(s),resolved:i.status==='完了'});
 for(const [index,i] of (Array.isArray(d.incidents)?d.incidents:[]).entries()){const s=sites.find(s=>s.id===i.siteId);rows.push({...i,key:i.id||`incident-missing:${index}`,type:'incident',title:i.event||i.name||'緊急対応',siteId:i.siteId||'',siteName:s?.name||'事業場未設定',region:s?regionOf(s):'未分類',resolved:!!(i.restoredAt&&i.permanent?.trim())});}
 const latest=new Map();for(const row of rows){const previous=latest.get(row.key),stamp=x=>Date.parse(x.updatedAt||x.createdAt||x.occurredAt||'')||0;if(!previous||stamp(row)>stamp(previous)||stamp(row)===stamp(previous)&&previous.resolved&&!row.resolved)latest.set(row.key,row);}
 return {known:Array.isArray(d.sites)&&Array.isArray(d.incidents)&&unknown.length===0&&rows.every(r=>r.id),unknown,rows:[...latest.values()].filter(r=>!r.resolved)};
}
export function inspectionPeriod(d,{region='',period='today',today=day()}={}){
 const sites=Array.isArray(d.sites)?d.sites:[],ids=new Map(sites.map(s=>[s.id,s]));
 let known=Array.isArray(d.inspections)&&Array.isArray(d.tasks)&&(d.events===undefined||Array.isArray(d.events))&&(d.visits===undefined||Array.isArray(d.visits));
 const all=known?eventsFor(d).filter(e=>e.kind==='点検'&&validDay(e.date)&&(period==='month'?e.date.startsWith(today.slice(0,7)):e.date===today)):[];
 const seen=new Set(),rows=[];
 for(const e of all){const site=ids.get(e.siteId);if(region&&(!site||regionOf(site)!==region))continue;const key=e.source+':'+e.id;if(seen.has(key))continue;seen.add(key);if(!site)known=false;
 const completed=(d.visits||[]).some(v=>v.status==='complete'&&v.siteId===e.siteId&&v.scheduleId===e.id&&(v.scheduleSource||'inspections')===e.source);
 const original=e.source==='inspections'?d.inspections.find(i=>i.id===e.id):null;
 if(original?.performedOn&&!validDay(original.performedOn)&&!completed)known=false;const done=completed||(original?validDay(original.performedOn):e.done===true);
 rows.push({...e,key,done,siteName:site?.name||'事業場未設定',region:site?regionOf(site):'未分類'});
 }
 const groups=new Map();for(const row of rows){const key=row.siteId||'unassigned:'+row.key;if(!groups.has(key))groups.set(key,{siteId:row.siteId||'',siteName:row.siteName,rows:[]});groups.get(key).rows.push(row);}
 const assigned=[...groups.values()].filter(g=>ids.has(g.siteId)),total=assigned.length,done=assigned.filter(g=>g.rows.every(e=>e.done)).length;
 return {known,rows,groups:[...groups.values()],total,done,pending:rows.filter(e=>!e.done).length,state:!known?'unknown':!rows.length?'none':rows.every(e=>e.done)?'complete':'pending',label:!known?'未取得':!rows.length?'予定なし':`${done}／${total}拠点`};
}
export function mapSummary(d,{region='',today=day()}={}){
 const issues=unresolvedItems(d),sites=(Array.isArray(d.sites)?d.sites:[]).filter(s=>!region||regionOf(s)===region),unknown=issues.unknown.filter(s=>!region||sites.some(x=>x.id===s.id));
 const extra=attentionExtras(d).filter(i=>!region||i.region===region),idx=attentionIndex(d,region),allRows=[...issues.rows.filter(i=>!region||i.region===region),...extra],isWatch=r=>idx.get(rowKey(r))?.kind==='watch';
 // 要対応の数は様子見を除く（緊急・要対応・不明）。〈新〉はまだ見ていないもの全部（様子見も含む）
 return {urgent:urgentCount(d,region),newCount:[...idx.values()].filter(v=>v.isNew).length,watch:allRows.filter(isWatch),sites:sites.length,sitesKnown:Array.isArray(d.sites),issues:allRows.filter(r=>!isWatch(r)),issuesKnown:region?Array.isArray(d.sites)&&Array.isArray(d.incidents)&&unknown.length===0&&issues.rows.filter(i=>i.region===region).every(i=>i.id):issues.known,unknown,today:inspectionPeriod(d,{region,period:'today',today}),month:inspectionPeriod(d,{region,period:'month',today})};
}
export {regions};
