import {inspectionPeriod,unresolvedItems} from './map-summary.js';
import {eventsFor,equipmentFor,regionOf as regionOfSite} from './integration-model.js';
import {day,validDay} from './model.js';
// 全体監視盤の拠点番号（boardNo）。拠点IDとは別の、表示用の安定した通し番号。
// 規則: 振り直さない／削除・並べ替え・名称変更で変えない／欠番は再利用しない。
export const BOARD_PAGE_SIZE=50;
const valid=n=>Number.isInteger(n)&&n>=1&&n<=9999;
// 実務データの拠点にだけ番号を付ける。旧サンプル（sample:true）は対象外。
// 戻り値: 変更があれば true。同じ入力に何度適用しても結果は変わらない。
export function assignBoardNos(d){
  if(!d||!Array.isArray(d.sites))return false;
  let changed=false;const used=new Set();
  let high=valid(d.boardNoHigh)?d.boardNoHigh:0;
  for(const s of d.sites){if(s.sample===true)continue;if(valid(s.boardNo)&&!used.has(s.boardNo)){used.add(s.boardNo);if(s.boardNo>high)high=s.boardNo;}}
  const seen=new Set();
  for(const s of d.sites){
    if(s.sample===true){continue;}
    if(valid(s.boardNo)&&!seen.has(s.boardNo)){seen.add(s.boardNo);continue;}
    s.boardNo=++high;seen.add(s.boardNo);changed=true;
  }
  if(high>0&&d.boardNoHigh!==high){d.boardNoHigh=high;changed=true;}
  return changed;
}
export const boardLabel=n=>valid(n)?String(n).padStart(3,'0'):'---';
// 番号順の拠点一覧（番号のない拠点は含めない）。
export function boardSites(d){return (d?.sites||[]).filter(s=>s.sample!==true&&valid(s.boardNo)).sort((a,b)=>a.boardNo-b.boardNo);}
// ページ: 001–050, 051–100 … 将来150件以上でも同じ構造。実在する拠点だけを返す。
export function boardPages(d,size=BOARD_PAGE_SIZE){
  const list=boardSites(d),top=list.length?list[list.length-1].boardNo:0,count=Math.max(1,Math.ceil(top/size)),pages=[];
  for(let i=0;i<count;i++){const from=i*size+1,to=(i+1)*size;pages.push({index:i,from,to,label:`${boardLabel(from)}–${boardLabel(to)}`,sites:list.filter(s=>s.boardNo>=from&&s.boardNo<=to)});}
  return pages;
}

// ---- 番号盤のデータ層（画面から切り離した純粋関数） ----
// 番号の色は選択期間の点検状態だけ: complete=緑 / pending=青 / none=灰。予定が取得できない場合は unknown（予定なしと区別）。
// 状態記号: unknown=？（不明・未設定） / caution=⚠（注意・不具合） / alarm=⛔（定義した異常条件） / 手動の☆は別管理。
export const BOARD_PERIODS=[['today','本日'],['month','今月'],['comm','通信']];
// 銀プレートは蓄電池・PCS・通信の3種。太陽光（パネル類）は「その他の設備」として扱い、既存の pv 記録は変えない。
export const PLATES={battery:'蓄電池',pcs:'PCS',comm:'通信',other:'その他の設備'};
// 印の区分（2026-11-03）：alarm＝緊急（🚨すぐ行く・止める）／caution＝要対応（⚠直す）／watch＝様子見（⏳続けて見る）／unknown＝不明（?）。
// 今までの記録の「異常」は緊急、「注意」は要対応として読む（記録は書き換えない）。
export const MARK_ORDER={alarm:0,caution:1,watch:2,unknown:3};
export const LEVELS=['緊急','要対応','様子見','不明'];
const levelMark={'緊急':'alarm','要対応':'caution','様子見':'watch','不明':'unknown'};
export const ALARM_SEVERITIES=['異常','注意','様子見','不明'];
const sevMark={'異常':'alarm','緊急':'alarm','注意':'caution','要対応':'caution','様子見':'watch','不明':'unknown'};
const time=v=>{const t=Date.parse(v||'');return Number.isFinite(t)?t:null;};
// 設備ID（siteId:battery 等）から銀プレートの種類を返す。対象が特定できない場合は null。
export function plateOf(siteId,equipmentId){if(!equipmentId)return null;if(equipmentId==='comm')return 'comm';const m=String(equipmentId).match(/^(.*):(battery|pcs|pv|comm)(?:#.*)?$/);return m&&m[1]===siteId?(m[2]==='pv'?'other':m[2]):null;}
export const activeAlarms=s=>(Array.isArray(s?.monitoring?.alarms)?s.monitoring.alarms:[]).filter(a=>a&&!a.recoveredAt);

// 通信状態。正常は「受信を確認でき、本人が設定した判定時間内」の場合だけ。未設定・未受信・条件未設定は不明。
export function commState(s,now=Date.now()){
  const c=s?.monitoring?.comm,alarms=activeAlarms(s).filter(a=>a.target==='comm');
  if(!c||!c.mode)return {state:'unknown',mark:'unknown',label:'未設定',lastReceivedAt:null};
  if(c.mode==='なし')return {state:'none',mark:null,label:'通信なし',lastReceivedAt:null};
  const last=c.lastReceivedAt||null,base={lastReceivedAt:last};
  if(alarms.length){const worst=alarms.map(a=>sevMark[a.severity]||'unknown').sort((a,b)=>MARK_ORDER[a]-MARK_ORDER[b])[0];return {...base,state:worst,mark:worst,label:worst==='alarm'?'通信異常':worst==='caution'?'通信注意':'警報内容不明'};}
  if(time(last)===null)return {...base,state:'unknown',mark:'unknown',label:'未受信'};
  if(!(Number.isFinite(c.staleMinutes)&&c.staleMinutes>0))return {...base,state:'unknown',mark:'unknown',label:'判定条件未設定'};
  if(now-time(last)>c.staleMinutes*60000)return {...base,state:'caution',mark:'caution',label:'未更新'};
  return {...base,state:'normal',mark:null,label:'正常'};
}

// 期間ごとの番号色。inspectionPeriod と同じ根拠（地図の集計と一致）。
export function periodColors(d,{period='today',today=day()}={}){
  const ids=(d?.sites||[]).map(s=>s.id);
  if(period==='comm')return {known:true,period,colors:new Map(ids.map(id=>[id,'neutral'])),summary:null};
  const p=inspectionPeriod(d,{period,today}),colors=new Map();
  for(const id of ids){if(!p.known){colors.set(id,'unknown');continue;}const g=p.groups.find(g=>g.siteId===id);colors.set(id,!g?'none':g.rows.every(r=>r.done)?'complete':'pending');}
  return {known:p.known,period,colors,summary:p};
}

// 1拠点の状態記号。対象プレートと状態記号を一組にし、別の注意事項とは分ける。複数の状態を上書きしない。
export function siteMarks(d,s,now=Date.now()){
  const groups=new Map(),add=(target,mark,source)=>{const key=target||'';if(!groups.has(key))groups.set(key,{target,marks:new Map()});const g=groups.get(key);if(!g.marks.has(mark))g.marks.set(mark,[]);g.marks.get(mark).push(source);};
  for(const i of unresolvedItems(d).rows.filter(i=>i.siteId===s.id))add(i.type==='issue'?plateOf(s.id,i.equipmentId):null,'caution',{type:i.type,id:i.id,title:i.title||''});
  for(const a of activeAlarms(s)){if(a.target==='comm')continue;add(plateOf(s.id,a.target),sevMark[a.severity]||'unknown',{type:'alarm',id:a.id,code:a.code||'',title:a.text||''});}
  const c=commState(s,now);if(c.mark)add('comm',c.mark,{type:'comm',label:c.label});
  const list=[...groups.values()].map(g=>({target:g.target,marks:[...g.marks].map(([kind,sources])=>({kind,count:sources.length,sources})).sort((a,b)=>MARK_ORDER[a.kind]-MARK_ORDER[b.kind])}));
  list.sort((a,b)=>MARK_ORDER[a.marks[0].kind]-MARK_ORDER[b.marks[0].kind]||(a.target?0:1)-(b.target?0:1));
  return {groups:list,star:!!s.watch?.on,starNote:s.watch?.note||''};
}
// 収まらない場合は異常を優先し、残りの組数を返す。
export function fitMarks(groups,max=2){return {shown:groups.slice(0,max),rest:Math.max(0,groups.length-max)};}

// 盤全体。上部の集計は実データから（見本の数値を固定しない）。
export function boardView(d,{period='today',pageIndex=0,today=day(),now=Date.now()}={}){
  const pages=boardPages(d),page=pages[Math.min(Math.max(0,pageIndex),pages.length-1)],pc=periodColors(d,{period,today});
  const cells=page.sites.map(s=>({id:s.id,no:s.boardNo,label:boardLabel(s.boardNo),name:s.name||'',color:pc.colors.get(s.id)||'none',...siteMarks(d,s,now),attention:siteAttention(d,s,now)}));
  return {period,pages,page,cells,summary:boardSummary(d,{today,now})};
}
export function boardSummary(d,{today=day(),now=Date.now()}={}){
  const sites=boardSites(d),issues=unresolvedItems(d),rowIds=new Set(issues.rows.map(r=>r.id)),alarms=sites.flatMap(s=>activeAlarms(s).map(a=>({...a,siteId:s.id,linked:!!a.issueId&&rowIds.has(a.issueId)})));
  const comm={normal:0,unknown:0,caution:0,alarm:0,none:0};for(const s of sites)comm[commState(s,now).state]++;
  return {sites:sites.length,unnumbered:(d?.sites||[]).length-sites.length,today:inspectionPeriod(d,{period:'today',today}),month:inspectionPeriod(d,{period:'month',today}),
    urgent:urgentCount(d,'',now),issues:{known:issues.known,count:issues.rows.length+attentionExtras(d,now).length,issue:issues.rows.filter(r=>r.type==='issue').length,incident:issues.rows.filter(r=>r.type==='incident').length,rows:issues.rows},
    alarms:{active:alarms.length,linked:alarms.filter(a=>a.linked).length,unlinked:alarms.filter(a=>!a.linked).length,rows:alarms},comm,
    watched:sites.filter(s=>s.watch?.on).length};
}

// 選択中の簡易データ。未取得は null（画面で「未取得」「—」）。設備なしと未取得を区別し、同種複数台は代表値を出さない。
export function siteBrief(d,s,{today=day(),now=Date.now()}={}){
  const plans=eventsFor(d).filter(e=>e.kind==='点検'&&e.siteId===s.id),visits=(d.visits||[]).filter(v=>v.siteId===s.id&&v.status==='complete');
  const doneDays=[...visits.map(v=>v.at&&day(new Date(v.at))),...(s.field?.history||[]).filter(h=>h.kind==='点検完了').map(h=>time(h.at)!==null?day(new Date(h.at)):null),...plans.filter(p=>p.source==='inspections').map(p=>d.inspections.find(i=>i.id===p.id)?.performedOn)].filter(validDay).sort();
  const completed=e=>visits.some(v=>v.scheduleId===e.id&&(v.scheduleSource||'inspections')===e.source)||e.done===true;
  const open=plans.filter(e=>!completed(e)&&validDay(e.date)).sort((a,b)=>(a.date+(a.time||'')).localeCompare(b.date+(b.time||''))),undated=plans.filter(e=>!completed(e)&&!validDay(e.date)).length;
  const next=open[0]||null,sameDay=next?open.filter(e=>e.date===next.date):[];
  const eq=equipmentFor(s),has=k=>eq.some(e=>e.kind===k),readings=Object.entries(s.monitoring?.readings||{}).filter(([id])=>id.startsWith(s.id+':'));
  const unit=(key,kind,fields,legacy={})=>{if(!has(kind))return {exists:false};const rows=readings.filter(([id])=>plateOf(s.id,id)===key);if(rows.length>1)return {exists:true,multiple:rows.length};const r=rows[0]?.[1]||{};const out={exists:true};for(const f of fields)out[f]=r[f]??legacy[f]??null;out.at=r.at||legacy.at||null;out.source=r.source||legacy.source||null;return out;};
  const m=s.field?.metrics?.soc,legacySoc=m&&typeof m.value==='number'?{soc:m.value,at:m.at||null,source:m.source||'保存値'}:{};
  return {id:s.id,no:s.boardNo,label:boardLabel(s.boardNo),name:s.name||'',sample:!!s.sample,
    lastDone:doneDays.at(-1)||null,next:next?{id:next.id,source:next.source,date:next.date,time:next.time||'',title:next.title||'点検',today:next.date===today,overdue:next.date<today,state:'pending'}:null,sameDay:sameDay.map(e=>({id:e.id,source:e.source,title:e.title||'点検',time:e.time||''})),undated,
    issues:unresolvedItems(d).rows.filter(i=>i.siteId===s.id).length,
    battery:unit('battery','蓄電池',['bms','soc'],legacySoc),pcs:unit('pcs','PCS',['run','power']),comm:commState(s,now),watch:s.watch||null};
}

// ---- 確認すること（扉の丸とふきだし） ----
// 扉には「確認することがあるか」と「新（まだ確認していない）／続（確認済みで続いている）」だけを出す。
// 種類（不明・注意・異常）と設備は、丸を押したときのふきだしに出す。通信が「未設定」の拠点は扉の丸に含めない（選択中の枠と通信タブで示す）。
const DAY=86400000;
const sinceOf=v=>{const t=Date.parse(v||'');return Number.isFinite(t)?t:null;};
// 確認済みの記録：site.review = {at, keys:[確認済みにした項目のキー]}。「確認した」ボタンか点検の完了で更新する。
export function reviewKeys(s){return new Set(Array.isArray(s?.review?.keys)?s.review.keys:[]);}
// 要対応の数（本部・地図・点検の札）は「確認すること全部」でそろえる：記録した不具合・緊急対応（unresolvedItems）に、機器の警報と通信の受信の問題を足す。不具合に結び付けた警報は二重に数えない。
export function attentionExtras(d,now=Date.now()){const rows=[];for(const s of (Array.isArray(d?.sites)?d.sites:[]))for(const i of siteAttention(d,s,now).items)if((i.source==='alarm'&&!(s.monitoring?.alarms||[]).find(x=>'alarm:'+x.id===i.key)?.issueId)||i.source==='comm')rows.push({id:i.key,key:i.key,type:i.source,title:i.title,siteId:s.id,siteName:s.name,region:regionOfSite(s),status:i.stage,kind:i.kind,createdAt:i.since||'',occurredAt:i.since||''});return rows;}
// 緊急（🚨）の数。1件でもあれば本部・地図・点検の札を赤い「緊急」にする
export function urgentCount(d,region='',now=Date.now()){let n=0;for(const s of (Array.isArray(d?.sites)?d.sites:[]))if(!region||regionOfSite(s)===region)n+=siteAttention(d,s,now).items.filter(i=>i.kind==='alarm').length;return n;}
export function siteAttention(d,s,now=Date.now()){
  const items=[],seen=reviewKeys(s),visits=(d.visits||[]).filter(v=>v.siteId===s.id&&v.status==='complete').map(v=>sinceOf(v.at)).filter(t=>t!==null);
  const push=(key,target,kind,title,since,extra={})=>{const t=sinceOf(since);items.push({key,target,kind,title:title||'内容未記入',since:t===null?null:new Date(t).toISOString(),days:t===null?null:Math.floor((now-t)/DAY)+1,spanned:t===null?null:visits.filter(v=>v>t).length,isNew:!seen.has(key),...extra});};
  for(const i of unresolvedItems(d).rows.filter(i=>i.siteId===s.id))push((i.type==='incident'?'incident:':'issue:')+i.id,i.type==='issue'?plateOf(s.id,i.equipmentId):null,'caution',i.title||i.event,i.createdAt||i.occurredAt,{source:i.type});
  for(const a of activeAlarms(s)){const target=a.target==='comm'?'comm':plateOf(s.id,a.target);push('alarm:'+a.id,target,sevMark[a.severity]||'unknown',a.text||'警報',a.occurredAt,{source:'alarm',code:a.code||'',text:a.text||'',severityText:a.severityText||''});}
  const c=commState(s,now);
  if(s.monitoring?.comm?.mode==='接続'&&c.mark&&!activeAlarms(s).some(a=>a.target==='comm')){const last=sinceOf(c.lastReceivedAt),stale=s.monitoring.comm.staleMinutes;push('comm:'+c.label,'comm',c.mark,c.label==='未更新'?'受信が止まっている':c.label==='未受信'?'受信を確認できない':c.label,c.label==='未更新'&&last!==null&&stale?new Date(last+stale*60000).toISOString():null,{source:'comm'});}
  // 内容の種類（アイコン用）と、確認のときに選んだ対処（現地・遠隔・外部・未定）と詳細
  const acts=s.review?.actions||{};for(const i of items){const issue=i.source==='issue'?(s.field?.issues||[]).find(x=>'issue:'+x.id===i.key):null;i.category=issue?(CATEGORIES.includes(issue.category)?issue.category:'その他'):i.source==='incident'?'緊急':i.target==='comm'?'受信':i.source==='alarm'?'警報':'その他';i.action=acts[i.key]||null;i.recur=recurCount(s,i);}
  // 段階：新 → 確認済み → 対応中 → 解決（解決したものは一覧から消え「過去」へ）。不具合の「確認中」は対応中として扱う。
  // 人が選んだ区分（緊急・要対応・様子見・不明）があれば、それを使う。不具合の重さ「緊急」「様子見」も読む。緊急対応の記録は緊急。
  const lv=s.review?.levels||{};for(const i of items){const issue=i.source==='issue'?(s.field?.issues||[]).find(x=>'issue:'+x.id===i.key):null;if(i.source==='incident')i.kind='alarm';else if(issue&&levelMark[issue.severity])i.kind=levelMark[issue.severity];if(levelMark[lv[i.key]?.level])i.kind=levelMark[lv[i.key].level];i.level=Object.keys(levelMark).find(k=>levelMark[k]===i.kind);}
  const prog=s.review?.progress||{};for(const i of items){const issue=i.source==='issue'?(s.field?.issues||[]).find(x=>'issue:'+x.id===i.key):null;i.stage=prog[i.key]?.state==='対応中'||issue?.status==='確認中'?'対応中':i.isNew?'新':'確認済み';if(i.stage==='対応中')i.isNew=false;}
  const order=MARK_ORDER;items.sort((a,b)=>(b.isNew-a.isNew)||order[a.kind]-order[b.kind]);
  const worst=items.map(i=>i.kind).sort((a,b)=>order[a]-order[b])[0]||null;
  return {items,count:items.length,newCount:items.filter(i=>i.isNew).length,worst,hasNew:items.some(i=>i.isNew)};
}
// 確認済みにする（今ある項目すべて）。点検の完了でも同じ処理をする。
export function markReviewed(d,siteId,at=new Date().toISOString(),only=null){const s=d.sites.find(x=>x.id===siteId);if(!s)return false;const keys=new Set(reviewKeys(s));for(const i of siteAttention(d,s,Date.parse(at)||Date.now()).items)if(!only||i.key===only)keys.add(i.key);s.review={...(s.review||{}),at,keys:[...keys]};return true;}
// 点検の完了で確認済みにする。対処を選んでいない項目は「現地」（その場で見たため）にする。
export function reviewByVisit(d,siteId,at=new Date().toISOString()){const s=d.sites.find(x=>x.id===siteId);if(!s)return false;const items=siteAttention(d,s,Date.parse(at)||Date.now()).items;markReviewed(d,siteId,at);const acts={...(s.review.actions||{})};for(const i of items)if(!acts[i.key])acts[i.key]={way:'現地',note:'',due:'',personId:'',at};s.review.actions=acts;return true;}
// 不具合を登録するときに選ぶ内容の種類（扉やふきだしのアイコンになる）。選ばない・古い記録は「その他」。
export const CATEGORIES=['外観','表示','温度','音','受信','その他'];
// 再発の回数：同じ設備・同じ種類で、過去に解決したもの（不具合の完了・警報の復帰）の数。
export function recurCount(s,i){const issues=(s.field?.issues||[]).filter(x=>x.status==='完了'&&'issue:'+x.id!==i.key&&(CATEGORIES.includes(x.category)?x.category:'その他')===i.category&&plateOf(s.id,x.equipmentId)===i.target).length;const alarms=(s.monitoring?.alarms||[]).filter(a=>a.recoveredAt&&'alarm:'+a.id!==i.key&&(a.target==='comm'?'comm':plateOf(s.id,a.target))===i.target&&(i.source!=='alarm'||!i.code||a.code===i.code)).length;return i.source==='issue'?issues:i.source==='alarm'||i.source==='comm'?alarms:0;}
export const WAYS=['現地','遠隔','外部','未定'];
// 確認する：対処（現地・遠隔・外部・未定のどれか）を必ず選ぶ。選んだ対処と手順・予定日・担当は review.actions に残す。
export function reviewItem(d,siteId,key,way,{note,due,personId}={},at=new Date().toISOString()){if(!WAYS.includes(way))throw Error('対処（現地・遠隔・外部・未定）を選んでください');const s=d.sites.find(x=>x.id===siteId);if(!s)throw Error('拠点が見つかりません');markReviewed(d,siteId,at,key);const prev=s.review.actions?.[key]||{};s.review.actions={...(s.review.actions||{}),[key]:{...prev,way,note:note??prev.note??'',due:due??prev.due??'',personId:personId??prev.personId??'',at}};return '確認済みにした（'+way+'）';}
export function saveAction(d,siteId,key,patch,at=new Date().toISOString()){const s=d.sites.find(x=>x.id===siteId);if(!s)throw Error('拠点が見つかりません');const prev=s.review?.actions?.[key];if(!prev)return reviewItem(d,siteId,key,patch.way||'未定',patch,at);if(patch.way&&!WAYS.includes(patch.way))throw Error('対処を選んでください');s.review.actions={...s.review.actions,[key]:{...prev,...patch,at}};return '対処を保存した';}
// 1件の段階を進める。確認済み→対応中（不具合は状態を「確認中」にする）、対応中→解決（不具合は「完了」、警報は復帰を記録）。
// 緊急対応と通信の状態は、ここでは解決にしない（記録の画面・通信の設定で終える）。戻り値：行った操作の名前。
// 確かめて解決（1回で）：遠隔や現地で確かめて終わったとき。方法（現地・遠隔・外部）と日付を必ず残す。「未定」では解決にしない。
export function resolveNow(d,siteId,key,way,patch={},at=new Date().toISOString()){
  if(!['現地','遠隔','外部'].includes(way))throw Error('確かめた方法（現地・遠隔・外部）を選んでください');
  const s=d.sites.find(x=>x.id===siteId);if(!s)throw Error('拠点が見つかりません');const item=siteAttention(d,s,Date.parse(at)||Date.now()).items.find(i=>i.key===key);if(!item)throw Error('対象が見つかりません（すでに解決済みの可能性があります）');
  if(item.source!=='issue'&&item.source!=='alarm')throw Error('この項目は記録の画面・通信の設定で終えてください');
  if(item.stage==='新')reviewItem(d,siteId,key,way,patch,at);else saveAction(d,siteId,key,{...patch,way},at);
  const issue=item.source==='issue'?(s.field?.issues||[]).find(x=>'issue:'+x.id===key):null,alarm=item.source==='alarm'?(s.monitoring?.alarms||[]).find(x=>'alarm:'+x.id===key):null;
  if(issue){issue.status='完了';issue.updatedAt=at;}else if(alarm)alarm.recoveredAt=at;
  s.review.actions={...s.review.actions,[key]:{...s.review.actions[key],resolvedAt:at}};
  if(s.review?.progress?.[key]){const {[key]:_,...rest}=s.review.progress;s.review={...s.review,progress:rest};}
  return '解決にした（'+way+'で確認）';
}
export function advanceItem(d,siteId,key,at=new Date().toISOString()){
  const s=d.sites.find(x=>x.id===siteId);if(!s)throw Error('拠点が見つかりません');const item=siteAttention(d,s,Date.parse(at)||Date.now()).items.find(i=>i.key===key);if(!item)throw Error('対象が見つかりません（すでに解決済みの可能性があります）');
  if(item.stage==='新')throw Error('確認するときは対処（現地・遠隔・外部・未定）を選んでください');
  const issue=item.source==='issue'?(s.field?.issues||[]).find(x=>'issue:'+x.id===key):null,alarm=item.source==='alarm'?(s.monitoring?.alarms||[]).find(x=>'alarm:'+x.id===key):null;
  if(item.stage==='確認済み'){if(issue){issue.status='確認中';issue.updatedAt=at;}else{s.review={...(s.review||{}),progress:{...(s.review?.progress||{}),[key]:{state:'対応中',at}}};}return '対応を始めた';}
  if(!['現地','遠隔','外部'].includes(s.review?.actions?.[key]?.way))throw Error('解決にするときは、確かめた方法（現地・遠隔・外部）を選んで保存してください');
  if(issue){issue.status='完了';issue.updatedAt=at;}else if(alarm){alarm.recoveredAt=at;}else throw Error('この項目は記録の画面・通信の設定で終えてください');
  s.review.actions={...s.review.actions,[key]:{...s.review.actions[key],resolvedAt:at}};
  if(s.review?.progress?.[key]){const {[key]:_,...rest}=s.review.progress;s.review={...s.review,progress:rest};}return '解決にした';
}
// 全拠点の「確認すること」を表の行にする（一覧の画面用）。
export function attentionRows(d,now=Date.now()){return boardSites(d).flatMap(s=>siteAttention(d,s,now).items.map(i=>({...i,siteId:s.id,no:s.boardNo,label:boardLabel(s.boardNo),name:s.name||''}))).sort((a,b)=>(a.since||'').localeCompare(b.since||''));}
// ふきだし用：前回の様子（最新の完了点検の写真1枚・所見・担当・日付）
export function lastLook(d,s){const t=x=>Date.parse(x?.at||'')||0,v=(d.visits||[]).filter(v=>v.siteId===s.id&&v.status==='complete').sort((a,b)=>t(b)-t(a))[0],h=(s.field?.history||[]).filter(h=>h.kind==='点検完了').sort((a,b)=>t(b)-t(a))[0],r=v||h;if(!r)return null;const photos=(r.photos?.length?r.photos:[r.photo]).filter(Boolean);return {at:r.at||null,note:r.note||'',personId:r.personId||'',photo:photos[0]||null};}
// ふきだしの「過去」：解決済みの不具合・復帰した警報・終わった緊急対応・完了した点検を、新しい順に並べる（羅列）。
export function sitePast(d,s,limit=40){
  const out=[],t=v=>sinceOf(v),add=(at,kind,title,detail='')=>out.push({at:t(at)===null?null:new Date(t(at)).toISOString(),kind,title:title||'内容未記入',detail});
  for(const i of (s.field?.issues||[]).filter(i=>i.status==='完了'))add(i.updatedAt||i.createdAt,'不具合 解決',i.title,i.createdAt?'登録 '+String(i.createdAt).slice(0,10):'');
  for(const a of (s.monitoring?.alarms||[]).filter(a=>a.recoveredAt))add(a.recoveredAt,'警報 復帰',a.text||'警報',[a.code,a.occurredAt?'発生 '+String(a.occurredAt).slice(0,10):''].filter(Boolean).join(' · '));
  for(const i of (d.incidents||[]).filter(i=>i.siteId===s.id&&i.restoredAt&&i.permanent?.trim()))add(i.restoredAt,'緊急対応 完了',i.event||i.name,i.permanent);
  for(const v of (d.visits||[]).filter(v=>v.siteId===s.id&&v.status==='complete'))add(v.at,'点検 完了',v.note||'所見の記録なし');
  return out.sort((a,b)=>(b.at||'').localeCompare(a.at||'')).slice(0,limit);
}
