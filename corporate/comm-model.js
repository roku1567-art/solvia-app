// 通信の管理（低圧の拠点は携帯回線の通信機でつながる。「通信は止まりやすい」前提で、状態と原因を残して悪い拠点を直す）。
// 通信機のメーカー・型式・製造番号は既存の「設備情報（通信）」を使い、回線・アンテナ・予備回線などの足りない項目だけを d.comm.info に持つ。
// 最後にデータが届いた時刻は既存の「通信・警報」（s.monitoring.comm.lastReceivedAt）を正とし、記録や取り込みで新しい時刻が来たらそこも進める。
// 黄・赤の時間は本人指定（指示書）の初期値 3時間・24時間。拠点ごとに「何分以内を正常とするか」が入っていれば、そちらを優先する（既存の決まり）。
import {commState} from './board-model.js';

export const CAUSES=['電波','通信機','熱','停電','契約・SIM','工事','不明'];
export const LINES=['4G','5G','LTE-M','3G','不明'];
export const REBOOT_WAYS=['遠隔','現地','自動'];
export const DEFAULT_RULE={yellowHours:3,redHours:24};
const HOUR=3600000,DAY=86400000;
const t=v=>{const x=Date.parse(v||'');return Number.isFinite(x)?x:null;};
const jst=ms=>new Date(ms+9*HOUR);
const ymd=ms=>jst(ms).toISOString().slice(0,10);

export function emptyComm(){return {settings:{...DEFAULT_RULE},info:{},logs:[],outages:[],reboots:[]};}
export const commOf=d=>{const c={...emptyComm(),...(d?.comm||{})};c.settings={...DEFAULT_RULE,...(c.settings||{})};return c;};
export const commRule=d=>commOf(d).settings;

// ---- 判定（既存の commState に本人指定の時間を渡す） ----
export function commLevel(d,s,now=Date.now()){const c=commState(s,now,commRule(d));return {...c,level:{normal:'ok',caution:'yellow',alarm:'red',unknown:'unknown',none:'none'}[c.state]||'unknown'};}
export function hasComm(s){return s?.monitoring?.comm?.mode==='接続';}

// ---- 台帳の要確認：契約期限まで30日以内（過ぎたものを含む）・3G用の通信機 ----
export function ledgerFlags(d,s,now=Date.now()){const i=commOf(d).info[s.id]||{},due=t(i.contractDue?i.contractDue+'T00:00:00+09:00':''),left=due==null?null:Math.ceil((due-now)/DAY);
  return {contractLeft:left,contractSoon:left!=null&&left<=30,old3g:i.line==='3G'};}

// ---- 途切れ：続いた時間（終わりが無ければ今まで＝続いている） ----
export function outageMinutes(o,now=Date.now()){const a=t(o.start),b=t(o.end)??now;return a==null?0:Math.max(0,Math.round((b-a)/60000));}
// 通信が悪い拠点の順位表：直近30日の途切れ回数、同じなら合計時間で並べる（成績ランキングの考え方：数えたものだけで並べ、推測で点を付けない）
export function ranking(d,now=Date.now()){const from=now-30*DAY,rows=new Map();
  for(const o of commOf(d).outages){const a=t(o.start);if(a==null||a<from)continue;const r=rows.get(o.siteId)||{siteId:o.siteId,count:0,minutes:0,open:0};r.count++;r.minutes+=outageMinutes(o,now);if(!o.end)r.open++;rows.set(o.siteId,r);}
  return [...rows.values()].filter(r=>(d.sites||[]).some(s=>s.id===r.siteId)).sort((x,y)=>y.count-x.count||y.minutes-x.minutes);}
// 原因の傾向：原因別・時間帯（3時間ごと）・月ごとの件数（日本時間）
export function trends(d){const os=commOf(d).outages,cause=Object.fromEntries(CAUSES.map(c=>[c,0])),hours=Array(8).fill(0),months=Array(12).fill(0);
  for(const o of os){const a=t(o.start);cause[CAUSES.includes(o.cause)?o.cause:'不明']++;if(a==null)continue;const j=jst(a);hours[Math.floor(j.getUTCHours()/3)]++;months[j.getUTCMonth()]++;}
  return {total:os.length,cause,hours,months};}

// ---- 要確認の件数（通信の画面に出し、赤と契約期限は本部の要確認にも足す） ----
export function commAttention(d,now=Date.now()){let red=0,yellow=0,contract=0,old3g=0;
  for(const s of d?.sites||[]){const l=commLevel(d,s,now).level;if(l==='red')red++;else if(l==='yellow')yellow++;const f=ledgerFlags(d,s,now);if(f.contractSoon)contract++;if(f.old3g)old3g++;}
  return {red,yellow,contract,old3g,home:red+contract,total:red+yellow+contract+old3g};}

// ---- 記録したら「最後にデータが届いた時刻」を進める（新しいときだけ。通信の方式が空なら「接続」にする） ----
export function bumpLastReceived(s,iso){if(!iso||t(iso)==null)return;s.monitoring??={};s.monitoring.comm??={};const c=s.monitoring.comm;if(!c.mode)c.mode='接続';if(t(c.lastReceivedAt)==null||t(iso)>t(c.lastReceivedAt))c.lastReceivedAt=new Date(t(iso)).toISOString();}
export function siteHistory(d,siteId){const c=commOf(d),by=(a,b)=>String(b.at||b.start||'').localeCompare(String(a.at||a.start||''));
  return {logs:c.logs.filter(x=>x.siteId===siteId).sort(by),outages:c.outages.filter(x=>x.siteId===siteId).sort(by),reboots:c.reboots.filter(x=>x.siteId===siteId).sort(by)};}

// ---- CSV（監視サービスの画面から書き出したもの）。1行目は見出し。列を対応づけて取り込む ----
export function parseCsv(text){const src=String(text||'').replace(/^﻿/,''),sep=(src.split('\n')[0].match(/\t/g)||[]).length>(src.split('\n')[0].match(/,/g)||[]).length?'\t':',',rows=[];let row=[],cell='',q=false;
  for(let i=0;i<src.length;i++){const ch=src[i];if(q){if(ch==='"'&&src[i+1]==='"'){cell+='"';i++;}else if(ch==='"')q=false;else cell+=ch;}
   else if(ch==='"')q=true;else if(ch===sep){row.push(cell);cell='';}else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&src[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row.map(x=>x.trim()));row=[];cell='';}else cell+=ch;}
  row.push(cell);if(row.some(x=>x.trim()))rows.push(row.map(x=>x.trim()));return rows;}
// 見出しから列を推測（あくまで初期値。画面で直せる）
export function guessMap(header){const f=re=>header.findIndex(h=>re.test(h));return {site:f(/拠点|番号|site|id/i),at:f(/記録|日時|date|time/i),last:f(/最後|最終|受信|last/i),signal:f(/dbm|rssi|電波.*(数|値)|強度/i),level:f(/段階|レベル|level|アンテナ/i),data:f(/データ量|通信量|mb|byte/i)};}
// 日時：時刻帯の無いものは日本時間として読む
export function parseWhen(v){const s=String(v||'').trim().replace(/\//g,'-');if(!s)return null;if(/[zZ]|[+-]\d{2}:?\d{2}$/.test(s))return t(s);const m=/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(s);if(!m)return null;const p=n=>String(n||0).padStart(2,'0');return t(`${m[1]}-${p(m[2])}-${p(m[3])}T${p(m[4])}:${p(m[5])}:${p(m[6])}+09:00`);}
export function findSite(d,v){const s=String(v||'').trim();if(!s)return null;const n=/^\d+$/.test(s)?Number(s):null;return (d.sites||[]).find(x=>n!=null&&x.boardNo===n)||(d.sites||[]).find(x=>x.externalId&&String(x.externalId)===s)||(d.sites||[]).find(x=>x.name===s)||null;}
const num=v=>{const s=String(v??'').replace(/[^\d.+-]/g,'');if(!s)return null;const n=Number(s);return Number.isFinite(n)?n:null;};
// 取り込む（同じ拠点・同じ日時の取り込み済みは足さない）。足した数と、足さなかった行と理由を返す
export function importRows(d,rows,map,uid,now=new Date().toISOString()){d.comm={...emptyComm(),...(d.comm||{})};const c=d.comm,out={added:0,skipped:[]},seen=new Set(c.logs.filter(x=>x.source==='CSV').map(x=>x.siteId+'|'+x.at));
  rows.slice(1).forEach((r,i)=>{const line=i+2,s=findSite(d,r[map.site]);if(!s){out.skipped.push({line,reason:'拠点が見つかりません'});return;}
   const at=parseWhen(r[map.at])??parseWhen(r[map.last]);if(at==null){out.skipped.push({line,reason:'日時が読めません'});return;}
   const iso=new Date(at).toISOString(),key=s.id+'|'+iso;if(seen.has(key)){out.skipped.push({line,reason:'取り込み済み'});return;}seen.add(key);
   const last=map.last>=0?parseWhen(r[map.last]):null,lv=map.level>=0?num(r[map.level]):null;
   c.logs.push({id:uid(),siteId:s.id,at:iso,lastReceivedAt:last!=null?new Date(last).toISOString():'',signal:map.signal>=0?num(r[map.signal]):null,level:lv!=null&&lv>=0&&lv<=5?Math.round(lv):null,dataMB:map.data>=0?num(r[map.data]):null,source:'CSV',importedAt:now});
   if(last!=null)bumpLastReceived(s,new Date(last).toISOString());out.added++;});
  detectOutages(d,uid);if(c.logs.length>20000)c.logs=c.logs.slice(-20000);return out;}
// 取り込んだ記録から途切れを起こす：記録の時点で「最後に届いた時刻」から黄の時間（設定）より長く空いていれば、そこから途切れ（原因は不明。あとで直せる）。
// 後の記録で間が黄の時間以内に戻っていれば、その「最後に届いた時刻」で終わりにする。手で書いた途切れは変えない。
export function detectOutages(d,uid){const c=d.comm,y=commRule(d).yellowHours*HOUR,by=new Map();
  for(const l of c.logs){if(l.source!=='CSV'||!l.lastReceivedAt)continue;(by.get(l.siteId)||by.set(l.siteId,[]).get(l.siteId)).push(l);}
  for(const [siteId,ls] of by){ls.sort((a,b)=>t(a.at)-t(b.at));let open=c.outages.find(o=>o.siteId===siteId&&o.fromCsv&&!o.end)||null;
   for(const l of ls){const gap=t(l.at)-t(l.lastReceivedAt);
    if(gap>y){if(!open){const start=new Date(t(l.lastReceivedAt)).toISOString();open=c.outages.find(o=>o.siteId===siteId&&o.start===start)||null;if(!open){open={id:uid(),siteId,start,end:'',cause:'不明',action:'',rebooted:false,fromCsv:true};c.outages.push(open);}}}
    else if(open&&t(l.lastReceivedAt)>t(open.start)){if(open.fromCsv&&!open.end)open.end=new Date(t(l.lastReceivedAt)).toISOString();open=null;}}}}

// ---- 保存のときの確かめ ----
const obj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const text=(v,max=2000)=>v==null||typeof v==='string'&&v.length<=max;
const when=v=>v==null||v===''||typeof v==='string'&&v.length<=40&&t(v)!=null;
const date=v=>v==null||v===''||/^\d{4}-\d{2}-\d{2}$/.test(v);
const numOk=v=>v==null||typeof v==='number'&&Number.isFinite(v);
const list=(xs,fn,max)=>Array.isArray(xs)&&xs.length<=max&&xs.every(x=>obj(x)&&typeof x.id==='string'&&x.id.length<=200&&text(x.siteId,200)&&fn(x));
const INFO_TEXT=['carrier','sim','plan','dataCap','antennaPlace','backupCarrier','backupSim','provider'];
export function validComm(c){if(c===undefined)return true;if(!obj(c))return false;
  const st=c.settings==null||obj(c.settings)&&['yellowHours','redHours'].every(k=>typeof c.settings[k]==='number'&&c.settings[k]>0&&c.settings[k]<=24*365)&&c.settings.yellowHours<c.settings.redHours;
  const info=obj(c.info)&&Object.values(c.info).every(i=>obj(i)&&INFO_TEXT.every(k=>text(i[k],300))&&date(i.contractDue)&&['','盤の中','盤の外'].includes(i.place??'')&&['',...LINES].includes(i.line??'')&&['','内蔵','外付け'].includes(i.antenna??'')&&['','あり','なし'].includes(i.backup??'')&&['','できる','できない'].includes(i.remoteReboot??'')&&['','あり','なし'].includes(i.autoReboot??''));
  return st&&info
   &&list(c.logs,x=>when(x.at)&&when(x.lastReceivedAt)&&numOk(x.signal)&&(x.level==null||Number.isInteger(x.level)&&x.level>=0&&x.level<=5)&&numOk(x.dataMB)&&['手入力','CSV','点検'].includes(x.source)&&text(x.note),20000)
   &&list(c.outages,x=>when(x.start)&&x.start&&when(x.end)&&CAUSES.includes(x.cause)&&text(x.action)&&(x.rebooted==null||typeof x.rebooted==='boolean'),5000)
   &&list(c.reboots,x=>when(x.at)&&x.at&&REBOOT_WAYS.includes(x.way)&&text(x.note),5000);}
export {ymd as commDay};
