// 立ち上げ（立ち上げ準備・書類集め・保安規程）と、点検の月次・年次の前回／次回、一人作業の安全。
// 立ち上げ準備は既存の「立上げ管理」（d.tasks）をそのまま使い、指示書の初期13項目は名前が無いものだけ足す（本人決定「今の一覧に足す」）。
// 書類・保安規程・届け出・設定は d.launch に持つ。保安規程の版は品質管理の「規程・文書」（台帳の文書）につなぐ。
import {eventsFor} from './integration-model.js';
import {catalogItems,EQUIPMENT_KINDS} from './inspection-catalog.js';
const day=(date=new Date())=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);

export const SEED_TASKS=[
 ['自分の準備','低圧電気取扱業務の特別教育'],['自分の準備','蓄電池・パワコンのメーカー講習'],['自分の準備','現場への同行（先輩・施工担当）'],['自分の準備','保安業務従事者の実務経験の確認書類'],
 ['外との調整','産業保安監督部への事前相談（保安法人の形、低圧蓄電所の扱い、点数、測定器のレンタル、小さな蓄電所の使用前の手続き）'],
 ['外との調整','社内確認：設備の持ち主（設置者）の会社名'],['外との調整','社内確認：連系の申込みの状況'],['外との調整','社内確認：補助金の有無'],['外との調整','社内確認：通信の現状と監視サービス名'],
 ['体制づくり','保安法人の形の決定（社内部署・子会社など）'],['体制づくり','測定器の準備（持つもの・レンタルするもの）'],['体制づくり','緊急連絡体制の決定']];
export const COMMON_DOCS=['会社の正式名称・住所・代表者','委託契約書のひな形','点検者の免状の写し','実務経験の確認書','測定器の一覧（校正証明書・レンタル契約書）','緊急連絡体制図','品質管理の文書','点検手順書・チェックリスト','遠隔監視の仕組みの説明','メーカーの取扱説明書・点検要領'];
export const SITE_DOCS=['単線結線図','配置図・位置図','機器の仕様（蓄電池・パワコン・通信機の型番と容量）','保護機能の設定値（連系協議の結果）','竣工時の試験成績書（絶縁抵抗・接地抵抗）','連系契約書','土地の契約書','委託契約書（署名済み）'];
export const DOC_STATES=['未','集めた','不要'];
export const DOC_FROM=['会社','施工担当','保安法人','メーカー','その他'];
export const FILING_STATES=['未','準備中','届け出済み','承認済み'];
export const CHAPTERS=['目的と対象','保安の組織と役割（持ち主・保安法人・点検者）','保安教育','点検（月次・年次・臨時の内容と頻度）','運転・操作の方法','災害や事故のときの対応','記録の残し方','工事のときの保安','サイバーセキュリティの対策（遠隔監視・制御の安全）','その他'];
// 差し込み欄。本文に {会社名} のように書くと拠点ごとに差し替える。値が無いときは【未入力：…】と見せる（空欄を正常に見せない）
export const FIELDS=[['会社名',(d)=>d.launch?.company?.name],['会社の住所',(d)=>d.launch?.company?.address],['代表者',(d)=>d.launch?.company?.rep],['拠点名',(d,s)=>s?.name],['拠点番号',(d,s)=>s?.boardNo?String(s.boardNo).padStart(3,'0'):''],['所在地',(d,s)=>s?.address],['設置者',(d,s)=>s?.client],['容量',(d,s)=>s?.batteryCapacity!=null&&s.batteryCapacity!==''?s.batteryCapacity+'kWh':''],['出力',(d,s)=>s?.batteryPower!=null&&s.batteryPower!==''?s.batteryPower+'kW':'']];
export const DEFAULT_SETTINGS={soloHours:3,groundLimit:100};
const ACTIVE=['受託予定','申請中','受託中'];

export function emptyLaunch(){return {seeded:false,settings:{...DEFAULT_SETTINGS},company:{name:'',address:'',rep:''},docTypes:[],docs:{},standardSiteId:'',kitei:{chapters:CHAPTERS.map(title=>({title,body:''})),revision:'',revisionDate:'',reason:'',history:[],docId:''},filings:{},taskFiles:{}};}
export const launchOf=d=>{const l={...emptyLaunch(),...(d?.launch||{})};l.settings={...DEFAULT_SETTINGS,...(l.settings||{})};return l;};

// 初めて開いたときに一度だけ：初期の準備項目（同じ名前は足さない）と、書類の種類を入れる
export function seedLaunch(d,{record,uid}){d.launch={...emptyLaunch(),...(d.launch||{})};const l=d.launch;if(l.seeded)return 0;let n=0,no=Math.max(0,...(d.tasks||[]).map(t=>Number(t.no)||0));
  for(const [category,name] of SEED_TASKS)if(!(d.tasks||[]).some(t=>t.name===name)){d.tasks.push(record('tasks',{no:++no,category,name,status:'未着手',authority:'指示書（立ち上げ）'}));n++;}
  if(!l.docTypes.length)l.docTypes=[...COMMON_DOCS.map(name=>({id:uid(),name,scope:'common'})),...SITE_DOCS.map(name=>({id:uid(),name,scope:'site'}))];
  l.seeded=true;return n;}

// ---- 書類集め ----
export const docKey=(typeId,siteId='')=>siteId?typeId+'@'+siteId:typeId;
export const docOf=(d,typeId,siteId='')=>launchOf(d).docs[docKey(typeId,siteId)]||{state:'未'};
export const activeSites=d=>(d?.sites||[]).filter(s=>ACTIVE.includes(s.status)||!s.status);
export function siteDocCount(d,siteId){const types=launchOf(d).docTypes.filter(t=>t.scope==='site'),st=types.map(t=>docOf(d,t.id,siteId).state),need=st.filter(x=>x!=='不要');return {done:need.filter(x=>x==='集めた').length,total:need.length};}
export function commonDocCount(d){const st=launchOf(d).docTypes.filter(t=>t.scope==='common').map(t=>docOf(d,t.id).state),need=st.filter(x=>x!=='不要');return {done:need.filter(x=>x==='集めた').length,total:need.length};}
export function overdueDocs(d,today=day()){const l=launchOf(d),out=[];for(const [k,v] of Object.entries(l.docs))if(v.state==='未'&&v.due&&v.due<today)out.push(k);return out;}

// ---- 標準の拠点から新しい拠点を作る：構成・仕様を写す（名前・番号・場所・設置者・製造番号・確認の記録は写さない） ----
const COPY=['equipmentType','pcs','distributionBoard','voltage','pv','batteryPower','batteryCapacity','points','monthlyFrequency','annualFrequency','responseMinutes','extraEquipment'];
export function siteFromStandard(d,record){const std=(d.sites||[]).find(s=>s.id===launchOf(d).standardSiteId);if(!std)throw Error('標準の拠点が決まっていません');
  const s=record('sites',{status:'候補'});for(const k of COPY)if(std[k]!==undefined&&std[k]!==null&&std[k]!=='')s[k]=structuredClone(std[k]);
  if(std.equipmentInfo){s.equipmentInfo={};for(const [k,v] of Object.entries(std.equipmentInfo)){const {serial,installed,warranty,updatedAt,...rest}=v||{};s.equipmentInfo[k]=rest;}}
  if(std.monitoring?.comm?.mode)s.monitoring={comm:{mode:std.monitoring.comm.mode}};
  if(d.comm?.info?.[std.id]){const {sim,backupSim,contractDue,...rest}=d.comm.info[std.id];d.comm.info[s.id]=rest;}
  s.fromStandard=std.id;return s;}

// ---- 保安規程：差し込み欄を拠点ごとに差し替える ----
export function fillText(d,s,text){return String(text||'').replace(/\{([^{}]{1,20})\}/g,(m,k)=>{const f=FIELDS.find(([n])=>n===k);if(!f)return m;const v=f[1](d,s);return v!=null&&String(v).trim()?String(v):`【未入力：${k}】`;});}
export function kiteiFor(d,s){const k=launchOf(d).kitei;return k.chapters.map((c,i)=>({no:i+1,title:c.title,body:fillText(d,s,c.body)}));}
export const missingFields=(d,s)=>[...new Set(launchOf(d).kitei.chapters.flatMap(c=>[...String(c.body||'').matchAll(/\{([^{}]{1,20})\}/g)].map(m=>m[1])).filter(k=>{const f=FIELDS.find(([n])=>n===k);return f&&!String(f[1](d,s)??'').trim();}))];
export const filingOf=(d,siteId)=>launchOf(d).filings[siteId]||{state:'未'};
// 点検項目の一覧（保安規程の「4. 点検」と食い違わないように、ここから見られる）
export function itemList(d){const names=Object.fromEntries(EQUIPMENT_KINDS.map(t=>[t.key,t.label]));return catalogItems(d).filter(it=>!it.hv).map(it=>({equip:names[it.equip]||it.equip,name:it.name,children:it.children||[],tier:it.tier,cycle:it.cycle||'月次'}));}

// ---- 点検の前回（月次・年次）と次回の予定。予定日を過ぎて済んでいないものは要確認 ----
const isAnnual=x=>/年次/.test(String(x?.title||x?.kind||''));
export function inspectionDue(d,s,today=day()){const vs=(d.visits||[]).filter(v=>v.siteId===s.id&&v.status==='complete'),dOf=v=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo'}).format(new Date(Date.parse(v.at)||0));
  const ids=new Set(vs.map(v=>v.id)),hist=(s.field?.history||[]).filter(h=>h.kind==='点検完了'&&!ids.has(h.id)&&Date.parse(h.at)),lastM=[...vs.filter(v=>(v.inspectionType||'月次')!=='年次'&&v.inspectionType!=='臨時'),...hist].map(dOf).sort().pop()||'',lastA=[...vs.filter(v=>v.inspectionType==='年次').map(dOf),...(s.annuals||[]).map(a=>a.date)].filter(Boolean).sort().pop()||'';
  let ev=[];try{ev=eventsFor(d).filter(e=>e.siteId===s.id&&e.kind==='点検'&&!e.done&&e.date);}catch{}
  const nextOf=fn=>ev.filter(fn).map(e=>e.date).sort()[0]||'';const nextM=nextOf(e=>!isAnnual(e)),nextA=nextOf(isAnnual);
  return {lastM,lastA,nextM,nextA,overdueM:!!nextM&&nextM<today,overdueA:!!nextA&&nextA<today};}
export function overdueInspections(d,today=day()){return (d?.sites||[]).filter(s=>{const x=inspectionDue(d,s,today);return x.overdueM||x.overdueA;});}

// ---- 一人作業：開始から決めた時間（初期3時間）たっても終了が無い点検 ----
export function soloAlerts(d,now=Date.now()){const h=launchOf(d).settings.soloHours,lim=h*3600000,list=[...Object.values(d?.visitDrafts||{}),...(d?.visits||[])],seen=new Set();
  return list.filter(v=>{if(!v?.startedAt||v.endedAt||seen.has(v.id))return false;seen.add(v.id);const t=Date.parse(v.startedAt);return Number.isFinite(t)&&now-t>lim;}).map(v=>({id:v.id,siteId:v.siteId,startedAt:v.startedAt,personId:v.personId||''}));}

// ---- 件数 ----
export function launchAttention(d,today=day()){const l=launchOf(d),tasksOpen=(d?.tasks||[]).filter(t=>!['完了','不要'].includes(t.status)).length;
  const c=commonDocCount(d),sitesOpen=activeSites(d).filter(s=>{const x=siteDocCount(d,s.id);return x.done<x.total;}).length,filingsOpen=activeSites(d).filter(s=>filingOf(d,s.id).state!=='承認済み').length;
  return {tasks:tasksOpen,docs:(c.total-c.done)+sitesOpen,kitei:filingsOpen,overdueDocs:overdueDocs(d,today).length,seeded:!!l.seeded};}
// 本部の「準備完了」：立上げ管理＋共通の書類（書類は立ち上げを開いて種類が入ってから数える）
export function withLaunch(d,p){const l=launchOf(d);if(!l.seeded)return p;const c=commonDocCount(d),done=(p.done||0)+c.done,total=(p.total||0)+c.total;return {...p,done,total,ratio:total?done/total:0};}

// ---- 保存のときの確かめ ----
const obj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const text=(v,max=5000)=>v==null||typeof v==='string'&&v.length<=max;
const date=v=>v==null||v===''||/^\d{4}-\d{2}-\d{2}$/.test(v);
const file=f=>f==null||obj(f)&&typeof f.name==='string'&&f.name.length<=300&&typeof f.data==='string'&&f.data.length<=8*1024*1024*1.4&&/^data:(application\/pdf|image\/(jpeg|png|webp));base64,[A-Za-z0-9+/=]*$/.test(f.data);
const chapters=cs=>Array.isArray(cs)&&cs.length<=40&&cs.every(c=>obj(c)&&text(c.title,200)&&text(c.body,40000));
export function validLaunch(l){if(l===undefined)return true;if(!obj(l))return false;
  return (l.seeded==null||typeof l.seeded==='boolean')&&(l.settings==null||obj(l.settings)&&['soloHours','groundLimit'].every(k=>l.settings[k]==null||typeof l.settings[k]==='number'&&l.settings[k]>0&&l.settings[k]<=10000))
   &&(l.company==null||obj(l.company)&&['name','address','rep'].every(k=>text(l.company[k],300)))
   &&(l.docTypes==null||Array.isArray(l.docTypes)&&l.docTypes.length<=200&&l.docTypes.every(t=>obj(t)&&typeof t.id==='string'&&t.id.length<=200&&text(t.name,300)&&['common','site'].includes(t.scope)))
   &&(l.docs==null||obj(l.docs)&&Object.keys(l.docs).length<=20000&&Object.values(l.docs).every(x=>obj(x)&&DOC_STATES.includes(x.state)&&text(x.from,200)&&text(x.memo,2000)&&date(x.due)&&file(x.file)))
   &&text(l.standardSiteId,200)
   &&(l.kitei==null||obj(l.kitei)&&chapters(l.kitei.chapters)&&text(l.kitei.revision,100)&&date(l.kitei.revisionDate)&&text(l.kitei.reason,2000)&&text(l.kitei.docId,200)&&Array.isArray(l.kitei.history??[])&&(l.kitei.history??[]).length<=100&&(l.kitei.history??[]).every(h=>obj(h)&&text(h.revision,100)&&date(h.revisionDate)&&text(h.reason,2000)&&chapters(h.chapters)))
   &&(l.filings==null||obj(l.filings)&&Object.values(l.filings).every(x=>obj(x)&&FILING_STATES.includes(x.state)&&date(x.date)&&text(x.number,200)&&file(x.file)))
   &&(l.taskFiles==null||obj(l.taskFiles)&&Object.values(l.taskFiles).every(file));}
