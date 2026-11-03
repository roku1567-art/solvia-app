// 写真・履歴・対処法・設備情報（拠点ごと）。画面から切り離した集め方。すべて保存済みの記録から作り、判定はしない。
import {siteEquipment} from './inspection-catalog.js';
import {siteAttention} from './board-model.js';

const t=v=>{const n=Date.parse(v||'');return Number.isFinite(n)?n:0;};
const keyOf=(s,equipmentId)=>{const m=String(equipmentId||'').match(/:(battery|pcs|comm|pv|board|other|hv)(?:#.*)?$/);return m&&String(equipmentId).startsWith(s.id+':')?m[1]:'';};

// 写真：完了した点検（visits と引継ぎ前の履歴）の写真を新しい順に。設備は写真ごとの関連（photoLinks）から。
export function sitePhotos(d,s){const out=[],seen=new Set();
  for(const v of (d.visits||[]).filter(v=>v.siteId===s.id&&v.status==='complete'))(v.photos||[]).forEach((src,i)=>{const link=v.photoLinks?.[i]||{};out.push({src,at:link.at||v.at||null,visitAt:v.at||null,visitId:v.id,equip:keyOf(s,link.equipmentId),personId:v.personId||''});seen.add(v.id);});
  for(const h of (s.field?.history||[]).filter(h=>!seen.has(h.id)))((h.photos?.length?h.photos:[h.photo]).filter(Boolean)).forEach((src,i)=>{const link=h.photoLinks?.[i]||{};out.push({src,at:link.at||h.at||null,visitAt:h.at||null,visitId:h.id,equip:keyOf(s,link.equipmentId),personId:h.personId||''});});
  return out.sort((a,b)=>t(b.visitAt||b.at)-t(a.visitAt||a.at));}
// 点検中（未完了）の下書きの写真。完了した写真とは分けて出す。
export function draftPhotos(d,s){const v=d.visitDrafts?.[s.id];if(!v||v.siteId!==s.id)return [];return (v.photos||[]).map((src,i)=>({src,at:v.photoLinks?.[i]?.at||null,equip:keyOf(s,v.photoLinks?.[i]?.equipmentId)}));}
// 今回と前回：写真のある点検のうち新しい2回（設備で絞ったときは、その設備の写真がある点検）
export function photoPair(photos,equip=''){const list=photos.filter(p=>!equip||p.equip===equip),visits=[...new Set(list.map(p=>p.visitId))];return visits.slice(0,2).map(id=>list.find(p=>p.visitId===id));}

// 履歴に足せる記録の種類（本人が書く）
export const LOG_KINDS=['設備交換','修理','メモ','その他'];
// 履歴：点検の完了、不具合（登録・解決）、警報（発生・復帰）、緊急対応、対処を決めた、設備交換・修理・メモ。新しい順。
export function siteHistory(d,s){const out=[],add=(at,kind,tone,equip,title,extra={})=>out.push({at:at||null,kind,tone,equip,title:title||'内容未記入',...extra});
  const done=new Set();for(const v of (d.visits||[]).filter(v=>v.siteId===s.id&&v.status==='complete')){done.add(v.id);add(v.at,'点検 完了','done','',v.note||'所見の記録なし',{photos:(v.photos||[]).length,visitId:v.id,personId:v.personId||''});}
  for(const h of (s.field?.history||[]).filter(h=>!done.has(h.id)))add(h.at,h.kind==='点検完了'?'点検 完了':h.kind||'記録','done','',h.note||'',{photos:(h.photos||[h.photo]).filter(Boolean).length,visitId:h.id,personId:h.personId||''});
  // 今の区分（緊急・要対応・様子見・不明）と、解決したときの確かめた方法も出す
  const now=siteAttention(d,s),mk=k=>now.items.find(i=>i.key===k),how=k=>{const w=s.review?.actions?.[k]?.way;return ['現地','遠隔','外部'].includes(w)?w+'で確認':'';};
  for(const i of (s.field?.issues||[])){const k='issue:'+i.id,m=mk(k);add(i.createdAt,'不具合','warn',keyOf(s,i.equipmentId),i.title,{key:k,mark:m?.kind||'',isNew:!!m?.isNew,stage:m?.stage||''});if(i.status==='完了')add(i.updatedAt||i.createdAt,'不具合 解決','gray',keyOf(s,i.equipmentId),i.title,{how:how(k)});}
  for(const a of (s.monitoring?.alarms||[])){const eq=a.target==='comm'?'comm':keyOf(s,a.target),k='alarm:'+a.id,m=mk(k);add(a.occurredAt,'警報','alarm',eq,[a.code,a.text].filter(Boolean).join(' ')||'警報',{key:k,mark:m?.kind||'',isNew:!!m?.isNew,stage:m?.stage||''});if(a.recoveredAt)add(a.recoveredAt,'警報 復帰','gray',eq,[a.code,a.text].filter(Boolean).join(' ')||'警報',{how:how(k)});}
  for(const i of (d.incidents||[]).filter(i=>i.siteId===s.id))add(i.occurredAt,'緊急対応','alarm','',i.event||i.name||'緊急対応');
  for(const [key,a] of Object.entries(s.review?.actions||{}))add(a.at,'対処を決めた','gray','',`${a.way}${a.note?'：'+a.note:''}`,{key});
  if(s.preUse)add(s.preUse.date||s.preUse.updatedAt,s.preUse.status==='実施済み'?'使用前 実施':'使用前 記録中',s.preUse.status==='実施済み'?'done':'gray','',`${s.preUse.mode||'やり方未選択'} · 測定 ${(s.preUse.rows||[]).length}件`);
  for(const a of (s.annuals||[]))add(a.date+'T12:00:00+09:00','年次 数値','done','',`測定 ${(a.rows||[]).length}件${a.note?' · '+a.note:''}`);
  for(const l of (s.logs||[]))add(l.at,l.kind,'gray',l.equip||'',l.text);
  return out.sort((a,b)=>t(b.at)-t(a.at));}

// 対処法：いまの確認すること（対処つき）と、解決済みで対処を記録したもの。資料は画面側で並べる。
export function siteFixes(d,s,now=Date.now()){const acts=s.review?.actions||{},cur=siteAttention(d,s,now).items.map(i=>({key:i.key,equip:i.target||'',title:i.title,way:i.action?.way||'',note:i.action?.note||'',due:i.action?.due||'',state:i.stage,recur:i.recur||0,current:true,kind:i.kind,isNew:i.isNew}));
  const curKeys=new Set(cur.map(c=>c.key)),past=[];for(const i of (s.field?.issues||[]).filter(i=>i.status==='完了')){const k='issue:'+i.id;if(acts[k]&&!curKeys.has(k))past.push({key:k,equip:keyOf(s,i.equipmentId),title:i.title,way:acts[k].way,note:acts[k].note||'',due:acts[k].due||'',state:'解決',at:i.updatedAt||null,current:false,how:['現地','遠隔','外部'].includes(acts[k].way)?acts[k].way+'で確認':''});}
  for(const a of (s.monitoring?.alarms||[]).filter(a=>a.recoveredAt)){const k='alarm:'+a.id;if(acts[k]&&!curKeys.has(k))past.push({key:k,equip:a.target==='comm'?'comm':keyOf(s,a.target),title:[a.code,a.text].filter(Boolean).join(' '),way:acts[k].way,note:acts[k].note||'',due:'',state:'解決',at:a.recoveredAt,current:false,how:['現地','遠隔','外部'].includes(acts[k].way)?acts[k].way+'で確認':''});}
  return [...cur,...past.sort((a,b)=>t(b.at)-t(a.at))];}

// 設備情報：設備ごとのメーカー・型式など（site.equipmentInfo[設備の種類]）。台帳の容量・出力と、引継ぎ前の「メーカー・型式」は参考として添える。
export const INFO_FIELDS=[['maker','メーカー'],['model','型式'],['serial','製造番号'],['rated','定格（出力・容量など）'],['count','台数'],['installed','設置日'],['warranty','保証期限'],['memo','メモ']];
export function equipmentInfo(d,s){const info=s.equipmentInfo||{};return siteEquipment(d,s).map(e=>{const v=info[e.key]||{},ledger=e.key==='battery'?[s.batteryPower!=null&&s.batteryPower!==''?`出力 ${s.batteryPower} kW`:'',s.batteryCapacity!=null&&s.batteryCapacity!==''?`容量 ${s.batteryCapacity} kWh`:''].filter(Boolean).join(' · '):e.key==='pv'&&s.pv!=null&&s.pv!==''?`発電出力 ${s.pv} kW`:'';
  return {key:e.key,label:e.label,values:v,filled:INFO_FIELDS.filter(([k])=>v[k]!=null&&String(v[k]).trim()!=='').length,ledger,legacy:[s.field?.manufacturer,s.field?.model].filter(Boolean).join(' / ')};});}
