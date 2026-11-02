// 担当者ごとの点数の合計（拠点の「換算点数・記載値」を足すだけ）。上限を超えるかどうかの判定はしない。
// 上限にあたる「担当可能点数」は本人が入れた記載値。確認の記録があるかどうかを分けて示す。
import {hasNumber,verified,workloadSites} from './model.js';
const round=v=>Math.round(v*100)/100;
function tally(sites){const known=sites.filter(s=>hasNumber(s.points)),sum=known.reduce((n,s)=>n+s.points,0),ok=sites.filter(s=>verified(s,'points'));
  return {sites:sites.length,active:sites.filter(s=>s.status==='受託中').length,planned:sites.filter(s=>s.status!=='受託中').length,points:known.length?round(sum):null,missing:sites.length-known.length,confirmed:ok.length?round(ok.reduce((n,s)=>n+s.points,0)):null,confirmedSites:ok.length};}
export function pointsByPerson(d){const load=workloadSites(d),ids=new Set(d.people.map(p=>p.id));
  const rows=d.people.map(p=>{const t=tally(load.filter(s=>s.assigneeId===p.id)),cap=hasNumber(p.capacity)?p.capacity:null;return {id:p.id,name:p.name||'氏名未入力',...t,capacity:cap,capacityConfirmed:verified(p,'capacity'),over:cap!==null&&t.points!==null&&t.points>cap};});
  const none=tally(load.filter(s=>!ids.has(s.assigneeId)));
  return {rows,unassigned:none,total:tally(load)};}
