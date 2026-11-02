// 拠点の流れ（受託 → 使用前 → 運用（月次）→ 年次）。保存済みの記録から組み立てるだけで、合否や期限の判定はしない。
import {PREUSE_DOCS} from './integration-validation.js';
export {PREUSE_DOCS};
// 使用前の測定でよく使う項目の候補（本人が選んで足す。初めからは入れない）
export const PREUSE_SUGGEST=['絶縁抵抗','接地抵抗','開放電圧','極性','保護継電器の動作','蓄電池の電圧','通信の確認'];
const t=v=>{const n=Date.parse(v||'');return Number.isFinite(n)?n:null;};
const year=v=>String(v||'').slice(0,4);
export function siteFlow(d,s,today){
  const contract=['受託中'].includes(s.status)?'done':['受託予定','申請中'].includes(s.status)?'now':['休止','終了'].includes(s.status)?'gray':'next';
  const pre=s.preUse,preState=pre?.status==='実施済み'?'done':pre?'now':'next';
  const done=(d.visits||[]).filter(v=>v.siteId===s.id&&v.status==='complete'),last=done.map(v=>v.at).filter(Boolean).sort().at(-1)||null,open=(s.field?.issues||[]).filter(i=>i.status!=='完了').length;
  const run=s.status==='受託中'&&done.length?'done':s.status==='受託中'?'now':'next';
  const annual=(d.inspections||[]).filter(i=>i.siteId===s.id&&/年次/.test(i.kind||'')).map(i=>({id:i.id,year:year(i.performedOn||i.date)||'日付未入力',date:i.date||'',performedOn:i.performedOn||'',report:i.reportStatus||''})).sort((a,b)=>String(b.performedOn||b.date).localeCompare(String(a.performedOn||a.date)));
  const recs=[...(s.annuals||[])].sort((a,b)=>String(b.date).localeCompare(String(a.date))),lastAnnual=[annual.find(a=>a.performedOn)?.performedOn||'',recs[0]?.date||''].sort().at(-1),base=lastAnnual||(pre?.status==='実施済み'?pre.date:'');
  // 次の年次の目安：前回（年次か使用前）の日付から1年後。案として出すだけ。
  const hint=base&&/^\d{4}-\d{2}-\d{2}$/.test(base)?`${Number(base.slice(0,4))+1}${base.slice(4)}`:'';
  const planned=annual.find(a=>!a.performedOn&&a.date&&a.date>=today);
  const annualState=planned?'now':annual.some(a=>a.performedOn)||recs.length?'done':'next';
  return [
    {key:'contract',label:'受託・申請',state:contract,lines:[`状態：${s.status||'未入力'}`,`委託契約日：${s.contractDate||'未入力'}`,`業務開始日：${s.startDate||'未入力'}`]},
    {key:'preUse',label:'使用前',state:preState,lines:pre?[`${pre.status||'記録中'}${pre.date?' · '+pre.date:''}${pre.mode?' · '+pre.mode:''}`,`測定 ${(pre.rows||[]).filter(r=>r.name).length}件 · 資料 ${PREUSE_DOCS.filter(([k])=>pre.docs?.[k]==='あり').length}/${PREUSE_DOCS.length}`]:['未記録（運転開始前の検査・立会いの記録）']},
    {key:'run',label:'運用（月次）',state:run,lines:[`点検 ${done.length}回${last?` · 最終 ${last.slice(0,10)}`:''}`,`未解決の不具合 ${open}件`]},
    {key:'annual',label:'年次',state:annualState,years:annual,records:recs.map(a=>({id:a.id,date:a.date,count:(a.rows||[]).length})),lines:[planned?`予定 ${planned.date}`:annual.length?'':'予定なし',recs.length?`数値の記録 ${recs.length}回（最新 ${recs[0].date}）`:'',hint?`次の目安（案）：${hint}ごろ（前回から1年）`:'次の目安：前回の記録がありません'].filter(Boolean)}];}

// 年次の記録（site.annuals）。測定は「項目＋測定箇所」で使用前・前年と並べる。値を並べるだけで、良し悪しは付けない。
const rowKey=r=>`${String(r.name||'').trim()}|${String(r.place||'').trim()}`;
const byDate=(a,b)=>String(b.date||'').localeCompare(String(a.date||''));
export function annualList(s){return [...(s.annuals||[])].sort(byDate);}
// 比べる表を作る。current は編集中の記録（新規なら null）。前年は current より前の日付で一番新しい記録。
export function annualCompare(s,current=null){const list=annualList(s).filter(a=>a.id!==current?.id),date=current?.date||'9999-12-31',prev=list.find(a=>String(a.date||'')<date)||null,pre=s.preUse||null;
  const order=[],rows=new Map(),put=(r,col)=>{const k=rowKey(r);if(!String(r.name||'').trim())return;if(!rows.has(k)){rows.set(k,{name:r.name.trim(),place:String(r.place||'').trim(),unit:r.unit||'',pre:null,prev:null,cur:null,curId:''});order.push(k);}const x=rows.get(k);x[col]=r.value??null;if(!x.unit&&r.unit)x.unit=r.unit;if(col==='cur')x.curId=r.id;};
  for(const r of pre?.rows||[])put(r,'pre');for(const r of prev?.rows||[])put(r,'prev');for(const r of current?.rows||[])put(r,'cur');
  return {rows:order.map(k=>rows.get(k)),preDate:pre?.date||'',prevDate:prev?.date||'',prevId:prev?.id||''};}
