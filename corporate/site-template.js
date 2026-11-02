// 拠点の型（ひな形）とまとめて登録。似た構成の拠点を素早く増やすためのもの。
// 型に入れるのは設備の構成と記載値だけ。確認の記録（根拠・確認日）は写さない（各拠点で本人が確認する）。
import {record} from './model.js';
import {TEMPLATE_KEYS} from './integration-validation.js';
export {TEMPLATE_KEYS};
export const BULK_STATUSES=['候補','情報収集中','受託予定','申請中','受託中'];
// 最初から使える型。数値は入れない（根拠のない値を作らない）。
export const STARTER={id:'starter-lv-bess',name:'低圧太陽光＋蓄電池',values:{equipmentType:'太陽光＋蓄電池',pcs:'登録あり',distributionBoard:'あり'}};
export const templatesOf=d=>[...(d.siteTemplates||[]),...((d.siteTemplates||[]).some(t=>t.id===STARTER.id)?[]:[STARTER])];
export const siteName=(prefix,n)=>`${prefix}${String(n).padStart(3,'0')}`;
export function pickValues(src){return Object.fromEntries(TEMPLATE_KEYS.filter(k=>src[k]!==undefined&&src[k]!==null&&src[k]!=='').map(k=>[k,src[k]]));}
// まとめて作る。名前が重なる・件数が範囲外のときは何も作らずに理由を返す。
export function bulkSites(d,{count,prefix,start=1,status='候補',assigneeId='',values={}}){
  if(!Number.isInteger(count)||count<1||count>100)throw Error('件数は1〜100で入力してください。');
  if(!Number.isInteger(start)||start<0||start>9999-count)throw Error('開始番号を確認してください。');
  prefix=String(prefix||'').trim();if(!prefix)throw Error('名前の頭を入力してください。');if(prefix.length>80)throw Error('名前の頭は80文字までです。');
  if(!BULK_STATUSES.includes(status))throw Error('状態を選んでください。');
  if(assigneeId&&!d.people.some(p=>p.id===assigneeId))throw Error('担当者が見つかりません。');
  for(const [k,v] of Object.entries(values))if(typeof v==='number'&&(!Number.isFinite(v)||v<0))throw Error('数値は0以上で入力してください。');
  const names=Array.from({length:count},(_,i)=>siteName(prefix,start+i)),taken=new Set(d.sites.map(s=>s.name)),dup=names.filter(n=>taken.has(n));
  if(dup.length)throw Error(`同じ名前の事業場があります（${dup.slice(0,3).join('、')}${dup.length>3?' ほか':''}）。名前の頭か開始番号を変えてください。`);
  const made=names.map(name=>({...record('sites',{name,status,assigneeId,...pickValues(values)}),field:{history:[],metrics:{},issues:[]}}));
  d.sites.push(...made);return made;}
export function saveTemplate(d,name,values){name=String(name||'').trim();if(!name)throw Error('型の名前を入力してください。');if(name.length>80)throw Error('型の名前は80文字までです。');
  d.siteTemplates??=[];const v=pickValues(values),old=d.siteTemplates.find(t=>t.name===name);if(old){old.values=v;old.updatedAt=new Date().toISOString();return old;}
  if(d.siteTemplates.length>=30)throw Error('型は30件までです。');const t={id:'tpl-'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),name,values:v,updatedAt:new Date().toISOString()};d.siteTemplates.push(t);return t;}
