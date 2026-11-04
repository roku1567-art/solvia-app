// 品質管理（保安法人の品質管理の仕組み）。流れは「決める → やる → 記録する → 確かめる → 直す」。
// 点検者・測定器・規程文書は今ある台帳（人材・測定器・文書）をそのまま使い、足りない項目だけを d.qms に持つ。
// 既存の記録は消さない・書き換えない。判定の数値は本人指定のもの（点数の上限 33点、黄色は30点以上）だけを使う。
// model.js とは循環しないよう、日付はここで作る（日本時間）
const day=(date=new Date())=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);

export const DOC_TYPES=['業務規程','品質管理の手順','組織図・役割表','点検手順書','その他'];
export const NCR_KINDS=['不具合','苦情','事故','点検ミス'];
export const NCR_STATES=['受付','原因調査中','対策中','効果確認待ち','完了'];
export const LICENSES=['第一種','第二種','第三種'];
// 担当量の上限：本人指定（指示書）。人ごとの「担当可能点数」が入っていて33点より小さければ、それを上限にする
export const POINT_LIMIT=33, POINT_WARN=30;
export const AUDIT_CHECKS=['規程・文書は最新の版か','点検者の担当量は上限内か','教育・訓練は計画どおりか','測定器の校正は期限内か','不具合・苦情の是正は進んでいるか','点検の記録は残っているか'];
const ACTIVE=['受託予定','申請中','受託中'];
const DAY=86400000;
const t=v=>{const x=Date.parse(v||'');return Number.isFinite(x)?x:null;};
const ymd=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||''))?String(v):(t(v)!=null?new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo'}).format(new Date(t(v))):'');
const daysBetween=(a,b)=>Math.round((t(b+'T00:00:00Z')-t(a+'T00:00:00Z'))/DAY);

export function emptyQms(){return {docs:{},people:{},equipment:{},pointStd:{},trainings:[],plans:[],ncrs:[],audits:[],reviews:[]};}
export const qmsOf=d=>({...emptyQms(),...(d?.qms||{})});

// ---- 1. 規程・文書（台帳の「文書」＋種類・施行日・改訂理由・添付・過去の版） ----
export function docRows(d,today=day()){const q=qmsOf(d);return (d?.documents||[]).map(x=>{const m=q.docs[x.id]||{},last=ymd(x.revisionDate)||'',age=last?daysBetween(last,today):null;return {id:x.id,name:x.name||'文書名未入力',type:m.type||'',revision:x.revision||'',revisionDate:last,enforcedAt:m.enforcedAt||'',reason:m.reason||'',file:m.file||null,history:Array.isArray(m.history)?m.history:[],age,stale:age!=null&&age>=365};});}

// ---- 2. 点検者（台帳の「人材」＋実務経験の確認日。担当拠点の点数を合計） ----
export function limitOf(p){const c=Number(p?.capacity);return Number.isFinite(c)&&c>0&&c<POINT_LIMIT?c:POINT_LIMIT;}
export function inspectorRows(d){const q=qmsOf(d),sites=(d?.sites||[]).filter(s=>ACTIVE.includes(s.status));return (d?.people||[]).map(p=>{const mine=sites.filter(s=>s.assigneeId===p.id),pts=mine.map(s=>Number(s.points)).filter(Number.isFinite),missing=mine.length-pts.length,total=pts.reduce((a,b)=>a+b,0),limit=limitOf(p);
  const level=total>=limit?'red':total>=Math.min(POINT_WARN,limit)?'yellow':'ok';
  return {id:p.id,name:p.name||'氏名未入力',license:p.license||'',expConfirmedAt:q.people[p.id]?.expConfirmedAt||'',sites:mine,total,missing,limit,limitFrom:limit===POINT_LIMIT?'上限 33点（本人指定）':'担当可能点数（台帳）',level};});}
export function unassignedSites(d){return (d?.sites||[]).filter(s=>ACTIVE.includes(s.status)&&!s.assigneeId);}

// ---- 3. 教育・訓練 ----
export function overduePlans(d,today=day()){const q=qmsOf(d);return q.plans.filter(p=>p.date&&p.date<today&&!q.trainings.some(x=>x.planId===p.id));}
export function trainingsOf(d,personId){return qmsOf(d).trainings.filter(x=>(x.participants||[]).includes(personId)).sort((a,b)=>String(b.date).localeCompare(String(a.date)));}

// ---- 4. 測定器（台帳の「測定器・保護具」の最終校正日・次回期限＋校正証明書） ----
export function gaugeRows(d,today=day()){const q=qmsOf(d);return (d?.equipment||[]).map(e=>{const due=ymd(e.due),left=due?daysBetween(today,due):null;return {id:e.id,name:e.name||'機器名未入力',model:e.model||'',serial:e.serial||'',location:e.location||'',calibratedAt:ymd(e.lastCheck),due,left,level:left==null?'none':left<0?'red':left<=30?'yellow':'ok',cert:q.equipment[e.id]?.cert||null};});}
export const gaugeExpired=(d,id,today=day())=>gaugeRows(d,today).find(g=>g.id===id)?.level==='red';

// ---- 5. 不具合・苦情・事故 ----
export const openNcrs=d=>qmsOf(d).ncrs.filter(x=>x.status!=='完了');

// ---- 6. 内部監査・見直し ----
export function lastCheckDate(d){const q=qmsOf(d);return [...q.audits,...q.reviews].map(x=>x.date).filter(Boolean).sort().pop()||'';}
export function reviewSnapshot(d,today=day()){const q=qmsOf(d),year=today.slice(0,4),visits=(d?.visits||[]).filter(v=>v.status==='complete'&&String(v.at||'').slice(0,4)===year),ncr=q.ncrs.filter(x=>String(x.date||'').slice(0,4)===year),gs=gaugeRows(d,today),plans=q.plans.filter(p=>String(p.date||'').slice(0,4)===year);
  return {year,visits:visits.length,ncrs:ncr.length,ncrDone:ncr.filter(x=>x.status==='完了').length,trainings:q.trainings.filter(x=>String(x.date||'').slice(0,4)===year).length,plans:plans.length,plansDone:plans.filter(p=>q.trainings.some(x=>x.planId===p.id)).length,gauges:gs.length,gaugesRed:gs.filter(g=>g.level==='red').length,gaugesYellow:gs.filter(g=>g.level==='yellow').length,docs:(d?.documents||[]).length,docsStale:docRows(d,today).filter(x=>x.stale).length};}

// ---- 要確認の件数（6つのボタンに黄色で出し、合計を本部にも出す） ----
export function qmsAttention(d,today=day()){const ins=inspectorRows(d),last=lastCheckDate(d),gs=gaugeRows(d,today);
  const c={docs:docRows(d,today).filter(x=>x.stale).length,people:ins.filter(x=>x.level!=='ok').length+unassignedSites(d).length,training:overduePlans(d,today).length,gauges:gs.filter(g=>g.level==='red'||g.level==='yellow').length,ncr:openNcrs(d).length,audit:!last||daysBetween(last,today)>=365?1:0};
  return {...c,total:Object.values(c).reduce((a,b)=>a+b,0)};}

// ---- 保存のときの確かめ（検証）。添付は PDF・画像のデータURL（1件 8MB まで） ----
const obj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const text=(v,max=5000)=>v==null||typeof v==='string'&&v.length<=max;
const date=v=>v==null||v===''||/^\d{4}-\d{2}-\d{2}$/.test(v);
export const validFile=f=>f==null||obj(f)&&typeof f.name==='string'&&f.name.length<=300&&typeof f.data==='string'&&f.data.length<=8*1024*1024*1.4&&/^data:(application\/pdf|image\/(jpeg|png|webp));base64,[A-Za-z0-9+/=]*$/.test(f.data);
const list=(xs,fn,max=2000)=>Array.isArray(xs)&&xs.length<=max&&xs.every(x=>obj(x)&&typeof x.id==='string'&&x.id.length<=200&&fn(x));
export function validQms(q){if(q===undefined)return true;if(!obj(q))return false;
  const docs=obj(q.docs)&&Object.values(q.docs).every(m=>obj(m)&&(m.type==null||m.type===''||DOC_TYPES.includes(m.type))&&date(m.enforcedAt)&&text(m.reason)&&validFile(m.file)&&(m.history==null||Array.isArray(m.history)&&m.history.length<=200&&m.history.every(h=>obj(h)&&text(h.revision,100)&&date(h.revisionDate)&&date(h.enforcedAt)&&text(h.reason)&&validFile(h.file))));
  const people=obj(q.people)&&Object.values(q.people).every(m=>obj(m)&&date(m.expConfirmedAt));
  const eq=obj(q.equipment)&&Object.values(q.equipment).every(m=>obj(m)&&validFile(m.cert));
  const std=obj(q.pointStd)&&Object.values(q.pointStd).every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1000);
  const ids=xs=>xs.every(x=>typeof x==='string'&&x.length<=200);
  return docs&&people&&eq&&std
   &&list(q.trainings,x=>date(x.date)&&text(x.title,300)&&text(x.teacher,200)&&Array.isArray(x.participants)&&x.participants.length<=50&&ids(x.participants)&&validFile(x.file)&&text(x.planId,200))
   &&list(q.plans,x=>date(x.date)&&text(x.title,300))
   &&list(q.ncrs,x=>date(x.date)&&text(x.siteId,200)&&NCR_KINDS.includes(x.kind)&&NCR_STATES.includes(x.status)&&['content','cause','action'].every(k=>text(x[k]))&&date(x.actionDoneAt)&&date(x.effectAt)&&text(x.ownerId,200)&&text(x.docId,200)&&text(x.from,300))
   &&list(q.audits,x=>date(x.date)&&text(x.auditor,200)&&Array.isArray(x.checks)&&x.checks.length<=50&&x.checks.every(c=>obj(c)&&text(c.label,200)&&['','はい','いいえ'].includes(c.ok||''))&&Array.isArray(x.findings)&&x.findings.length<=100&&x.findings.every(f=>obj(f)&&text(f.text)&&text(f.ncrId,200)))
   &&list(q.reviews,x=>date(x.date)&&text(x.attendees,500)&&text(x.notes)&&text(x.decisions)&&(x.snapshot==null||obj(x.snapshot)));}
