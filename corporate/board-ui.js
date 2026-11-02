import {menuButton} from './page-menu.js';
// 点検・全体監視盤の描画。番号・色・記号・件数はすべて実データから組み立て、背景には焼き込まない。
import {boardView,siteBrief,periodColors,BOARD_PERIODS,PLATES,boardLabel,lastLook,commState,sitePast,attentionRows} from './board-model.js';
import {esc} from './operations-ui.js';
import {day} from './model.js';

// 共通アイコン部品。絵文字に依存せず、番号盤と簡易データで同じ形を使う。
const glyph={
  battery:'<rect x="3" y="7" width="15.5" height="11" rx="1.6" fill="none" stroke="currentColor" stroke-width="2.2"/><rect x="18.5" y="10" width="2.6" height="5" rx=".6" fill="currentColor"/><path d="M6.5 12.5h6" stroke="currentColor" stroke-width="2.2"/>',
  pcs:'<rect x="5" y="3" width="14" height="18" rx="1.2" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M12 3v18M8.6 9v3.2M15.4 9v3.2" stroke="currentColor" stroke-width="2"/>',
  comm:'<path d="M12 10.5V21M8 21l4-10.5L16 21M9.3 16.5h5.4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><circle cx="12" cy="8.2" r="1.8" fill="currentColor"/><path d="M8.4 4.6a5 5 0 0 0 0 7.2M15.6 4.6a5 5 0 0 1 0 7.2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
};
const markSvg={
  unknown:'<circle cx="12" cy="12" r="10" fill="#5a6168" stroke="#c4cad0" stroke-width="1.6"/><path d="M9.2 9.3a2.9 2.9 0 1 1 4.1 2.6c-.8.4-1.3 1-1.3 1.9v.6" fill="none" stroke="#f1f3f5" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="17.6" r="1.35" fill="#f1f3f5"/>',
  caution:'<path d="M12 2.6 22.4 20.6H1.6Z" fill="#ffd23c" stroke="#5a4300" stroke-width="1.1" stroke-linejoin="round"/><path d="M12 8.6v6" stroke="#2b2100" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="17.6" r="1.35" fill="#2b2100"/>',
  alarm:'<circle cx="12" cy="12" r="10" fill="#e3343a" stroke="#fff" stroke-width="1.4"/><rect x="6" y="10.2" width="12" height="3.6" rx=".8" fill="#fff"/>',
  star:'<path d="m12 2.5 2.9 6.2 6.7.8-5 4.6 1.4 6.7L12 17.4l-6 3.4 1.4-6.7-5-4.6 6.7-.8Z" fill="#e9eef3" stroke="#56606a" stroke-width="1.1" stroke-linejoin="round"/>'
};
export const MARK_LABEL={unknown:'不明',caution:'注意',alarm:'異常',star:'注目'};
export const plate=(kind,cls='')=>`<span class="bp-plate ${cls}" data-plate="${kind}" role="img" aria-label="${PLATES[kind]}"><svg viewBox="0 0 24 24" aria-hidden="true">${glyph[kind]}</svg></span>`;
export const mark=(kind,cls='')=>`<span class="bp-mark ${cls}" data-mark="${kind}" role="img" aria-label="${MARK_LABEL[kind]}"><svg viewBox="0 0 24 24" aria-hidden="true">${markSvg[kind]}</svg></span>`;
const COLOR_LABEL={complete:'完了',pending:'未完了',none:'予定なし',unknown:'予定未取得',neutral:''};

// 扉の下段に収める。異常を優先し（groups は異常順）、収まらない分は件数で示す。☆は必ず残す。
const KIND_LABEL={alarm:'異常',caution:'注意',unknown:'不明'};
// 内容の種類のアイコン（共通部品）と、対処のアイコン
const CAT_SVG={外観:'<path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12Z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="currentColor"/>',表示:'<rect x="3" y="5" width="18" height="12" rx="1.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 21h8M12 17v4M7 10h6" stroke="currentColor" stroke-width="2"/>',温度:'<path d="M10 4a2 2 0 0 1 4 0v9.5a4 4 0 1 1-4 0Z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="17" r="2" fill="currentColor"/>',音:'<path d="M4 9v6h4l5 4V5L8 9Z" fill="currentColor"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="2"/>',受信:'<path d="M4 9a11 11 0 0 1 16 0M7 13a6.5 6.5 0 0 1 10 0" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="17" r="1.6" fill="currentColor"/><path d="M4 4l16 16" stroke="currentColor" stroke-width="2.4"/>',警報:'<path d="M6 17V11a6 6 0 0 1 12 0v6l2 2H4Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M10 21h4" stroke="currentColor" stroke-width="2"/>',緊急:'<path d="M7 18v-6a5 5 0 0 1 10 0v6Z" fill="currentColor"/><path d="M5 18h14v3H5ZM12 2v3M4 6l2 2M20 6l-2 2" stroke="currentColor" stroke-width="2"/>',その他:'<circle cx="6" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="18" cy="12" r="2" fill="currentColor"/>'};
const WAY_SVG={現地:'<path d="M12 21s-6-6.2-6-11a6 6 0 0 1 12 0c0 4.8-6 11-6 11Z" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="12" cy="10" r="2.2" fill="currentColor"/>',遠隔:'<rect x="3" y="4" width="18" height="12" rx="1.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M8 20h8" stroke="currentColor" stroke-width="2.2"/>',外部:'<circle cx="9" cy="8" r="3" fill="currentColor"/><path d="M3 20a6 6 0 0 1 12 0" fill="currentColor"/><path d="M16 11h6M19 8l3 3-3 3" fill="none" stroke="currentColor" stroke-width="2"/>'};
const catIcon=c=>`<span class="cat-ic" data-category="${c}"><svg viewBox="0 0 24 24" aria-hidden="true">${CAT_SVG[c]||CAT_SVG['その他']}</svg></span>`;
const wayIcon=w=>WAY_SVG[w]?`<svg viewBox="0 0 24 24" aria-hidden="true">${WAY_SVG[w]}</svg>`:'';
// 設備・内容のマス：銀プレート（対象未特定は点線の？）＋内容の種類のアイコン＋2文字
// マスの右側の印は2つだけ、文字で出す（アプリ内の共通語：予定日・期限超過・再発）。担当や手順メモは詳細で見る。
const badges=(d,i)=>{const a=i.action||{},today=day(),out=[];
 if(a.due)out.push(a.due<today?`<span class="eb eb-late" title="予定日 ${esc(a.due)}">期限超過 ${md(a.due)}</span>`:`<span class="eb" title="予定日 ${esc(a.due)}">予定 ${md(a.due)}</span>`);
 if(i.recur)out.push(`<span class="eb eb-recur" title="同じ設備・種類で過去に${i.recur}回">再発 ${i.recur}回</span>`);
 return out.length?`<span class="eq-badges">${out.join('')}</span>`:'';};
const eqCell=i=>`<span class="eq-cell">${i.target&&glyph[i.target]?plate(i.target,'eq-plate'):'<span class="bp-plate eq-plate eq-unknown" aria-hidden="true">?</span>'}${catIcon(i.category)}<small>${i.category}</small></span>`;

// 扉の目印：番号の右に丸1つ（色＝いちばん重いもの、濃い＝新・薄い＝続）。☆は番号のすぐ右上に小さく。
function doorAttn(c){const a=c.attention;return a&&a.count?`<span class="bp-attn k-${a.worst} ${a.hasNew?'is-new':'is-old'}" data-board-attn="${esc(c.id)}" data-kind="${a.worst}" data-new="${a.hasNew}" aria-hidden="true"></span>`:'';}
const describe=c=>[c.label,c.name,COLOR_LABEL[c.color],c.attention?.count?`確認すること${c.attention.count}件（${KIND_LABEL[c.attention.worst]}${c.attention.hasNew?'・新あり':'・すべて確認済み'}）・丸を押すと詳しく`:'',c.star?'注目':''].filter(Boolean).join(' / ');

function meter(label,p){const pct=p.known&&p.total?Math.round(p.done/p.total*100):null;return `<button class="bp-meter" data-map-list="${label==='本日'?'today':'month'}" aria-label="${label} ${p.known?`${p.done}／${p.total}拠点`:'未取得'}"><svg class="bp-mini-ring" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="14" class="bp-ring-bg"/><circle cx="18" cy="18" r="14" class="bp-ring" pathLength="100" stroke-dasharray="${pct??0} 100"/></svg>${pct===null?'':`<span class="bp-mini-pct">${pct}%</span>`}<small>${label}</small>${!p.known?'<b>未取得</b>':!p.total?'<b class="dim">予定なし</b>':`<b>${p.done}/${p.total}</b>`}</button>`;}

export function boardScreen(d,view){
  const {period,pageIndex,selected}=view,v=boardView(d,{period,pageIndex}),s=v.summary,sel=v.cells.find(c=>c.id===selected)||v.cells[0]||null;
  const kind=d.kind==='demo'?'サンプル':d.kind==='plan'?'計画':'',cells=period==='comm'?v.cells.map(c=>{const items=c.attention.items.filter(i=>i.target==='comm'),order={alarm:0,caution:1,unknown:2};return {...c,attention:{...c.attention,items,count:items.length,newCount:items.filter(i=>i.isNew).length,hasNew:items.some(i=>i.isNew),worst:items.map(i=>i.kind).sort((x,y)=>order[x]-order[y])[0]||null}};}):v.cells;
  const colors=new Set(cells.map(c=>c.color));
  const pages=`<div class="bp-pages" aria-label="ページ">${v.pages.map(p=>`<button data-board-page="${p.index}" aria-pressed="${p.index===v.page.index}">${p.label.replace('–',' – ')}</button>`).join('')}${menuButton('bp-menu')}</div>`;
  const head=`<div class="bp-head"><h2>点検・全体監視盤</h2><span class="bp-total">管理<b>${s.sites}</b>拠点</span><button class="bp-alert ${s.issues.count?'has':''}" data-map-list="issues" data-list-region="" aria-label="要対応 ${s.issues.known?s.issues.count+'件':'未取得'}${s.alarms.unlinked?`・警報 未登録${s.alarms.unlinked}件`:''}"><small>要対応</small><b>${s.issues.known?s.issues.count:'—'}</b><small>件</small></button>${kind?`<span class="bp-kind">${kind}</span>`:''}</div>
  <div class="bp-row2"><div class="bp-counts">${meter('本日',s.today)}<span class="bp-dot" aria-hidden="true">・</span>${meter('今月',s.month)}</div><div class="bp-tabs" role="tablist">${BOARD_PERIODS.map(([id,l])=>`<button role="tab" data-board-period="${id}" aria-selected="${id===period}">${l}</button>`).join('')}</div></div>`;
  if(!s.sites)return `<section class="board-screen">${head}<div class="bp-empty"><p>${(d.sites||[]).length?'番号のある実務の事業場がありません（旧サンプルは番号盤に表示しません）。':'事業場はまだ登録されていません。'}</p><div class="actions"><button data-page="sites" class="primary">＋ 事業場を登録</button><button data-board-list>一覧</button></div></div></section>`;
  // 1ページ50枠を常に並べる。拠点の無い枠は「空き」（扉なし・押せない・拠点として数えない）。
  // 空き：今ある最大の番号より後ろ（押すと登録へ）。欠番：削除などで空いた番号（再利用しないので押せない）。
  const high=Number.isInteger(d.boardNoHigh)?d.boardNoHigh:Math.max(0,...(d.sites||[]).map(x=>x.boardNo||0));
  const slots=Array.from({length:v.page.to-v.page.from+1},(_,i)=>v.page.from+i),byNo=new Map(cells.map(c=>[c.no,c]));
  const grid=`<div class="bp-cabinet"><div class="bp-grid" role="grid" aria-label="拠点番号 ${esc(v.page.label)}">${slots.map(n=>{const c=byNo.get(n);return c?`<button class="bp-door c-${c.color} ${sel?.id===c.id?'is-selected':''}" data-board-cell="${esc(c.id)}" aria-pressed="${sel?.id===c.id}" aria-label="${esc(describe(c))}"><i class="bp-hinge" aria-hidden="true"></i><span class="bp-door-in"><span class="bp-no">${c.label}</span>${c.star?'<span class="bp-star-mini" data-mark="star" aria-hidden="true">★</span>':''}${doorAttn(c)}</span></button>`:n>high?`<button class="bp-slot is-open" data-board-slot="${n}" data-new="sites" aria-label="空き ${boardLabel(n)}・事業場を登録（登録すると次の番号が付きます）"><span>${boardLabel(n)}</span></button>`:`<span class="bp-slot is-gap" data-board-slot="${n}" data-board-gap aria-hidden="true"><span>${boardLabel(n)}</span></span>`;}).join('')}</div></div>`;
  const legend=`<div class="bp-legend" aria-label="凡例（000は説明用で拠点ではありません）"><span class="bp-legend-colors">${period==='comm'?`<span class="bp-legend-note">通信 正常${s.comm.normal}・不明${s.comm.unknown}・注意${s.comm.caution}・異常${s.comm.alarm}・なし${s.comm.none}（番号色なし）</span>`:`<span class="c-complete"><b>000</b>完了</span><span class="c-pending"><b>000</b>未完了</span><span class="c-none"><b>000</b>予定なし</span>${colors.has('unknown')?'<span class="c-unknown"><b>000</b>予定未取得</span>':''}`}</span><i class="bp-legend-sep" aria-hidden="true"></i><span class="bp-legend-marks"><span><i class="bp-attn k-alarm is-new"></i>異常</span><span><i class="bp-attn k-caution is-new"></i>注意</span><span><i class="bp-attn k-unknown is-new"></i>不明</span><span>濃=新</span><span><b class="bp-star-mini">★</b>注目</span></span></div>`;
  const selCell=sel&&cells.find(c=>c.id===sel.id);
  return `<section class="board-screen">${head}${grid}${pages}${legend}${sel?brief(d,d.sites.find(x=>x.id===sel.id),period,view.expanded):''}${selCell&&view.bubble===sel.id&&(selCell.attention.count||view.bubblePast)?attentionBubble(d,d.sites.find(x=>x.id===sel.id),selCell.attention,!!view.bubblePast):''}</section>`;
}

const md=v=>{const [,m,dd]=v.split('-');return `${Number(m)}/${Number(dd)}`;};
const stamp=v=>{const t=Date.parse(v||'');return Number.isFinite(t)?new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(t):'—';};
const val=(v,unit='')=>v===null||v===undefined||v===''?`<span class="bp-na">—${unit?' '+unit:''}</span>`:`${esc(String(v))}${unit?' '+unit:''}`;
const text=v=>v===null||v===undefined||v===''?'<span class="bp-na">未取得</span>':esc(String(v));
function unitBox(kind,u,rows){
  const body=!u.exists?'<p class="bp-na">設備なし</p>':u.multiple?`<p>${u.multiple}台 <small>代表値なし・詳細で確認</small></p>`:rows.map(([l,v])=>`<p><small>${l}</small>${v}</p>`).join('');
  return `<div class="bp-unit">${plate(kind)}<b>${PLATES[kind]}</b>${body}</div>`;}

export function brief(d,s,period,open=false){
  const b=siteBrief(d,s),pc=periodColors(d,{period:period==='comm'?'today':period});
  const next=!pc.known?'<span class="bp-na">予定未取得</span>':b.next?`<span class="c-pending">${b.next.today?'本日':md(b.next.date)}${b.next.overdue?'（期限超過）':''}・未完了</span>${b.sameDay.length>1?`<small>同日${b.sameDay.length}件</small>`:''}`:b.undated?`<span class="c-none">日程未定 ${b.undated}件</span>`:'<span class="c-none">予定なし</span>';
  const comm=b.comm,cm=comm.mark?mark(comm.mark):'';
  return `<section class="bp-brief${open?' is-open':''}" aria-live="polite" data-brief="${esc(s.id)}" data-menu-group="選択中の拠点 ${esc(s.boardNo?String(s.boardNo).padStart(3,'0'):'')} ${esc(s.name)}">
  <div class="bp-brief-head"><h3>選択中 <b>${b.label}</b> <span>${esc(b.name)}</span></h3><button class="bp-star-btn" data-board-watch="${esc(s.id)}" aria-pressed="${!!b.watch?.on}" aria-label="注目（☆）と理由メモ${b.watch?.on?'・設定中'+(b.watch.note?'：'+esc(b.watch.note):''):''}" title="${b.watch?.on&&b.watch.note?esc(b.watch.note):''}">${mark('star',b.watch?.on?'':'is-off')}</button><button class="bp-expand" data-board-expand aria-expanded="${open}">設備・通信 ${open?'▴':'▾'}</button><button class="bp-list-btn" data-board-past="${esc(s.id)}" aria-label="この拠点の過去（解決済み）を見る">過去</button><button class="bp-link" data-board-score>成績表 ›</button><button class="bp-list-btn" data-board-list aria-label="今日の点検・下書き・現場一覧を開く">一覧</button></div>
  <p class="bp-brief-line">前回 ${b.lastDone?`${md(b.lastDone)} <span class="c-complete">完了</span>`:'記録なし'} · 次回 ${next} · 不具合 ${b.issues?`<span class="bp-warn">${b.issues}件</span>`:'0件'}</p><div class="bp-brief-row"><div><small>前回点検</small><p>${b.lastDone?`${md(b.lastDone)} <span class="c-complete">完了</span>`:'<span class="bp-na">記録なし</span>'}</p></div><div><small>次回点検</small><p>${next}</p></div><div><small>不具合</small><p>${b.issues?`<span class="bp-warn">未解決 ${b.issues}件</span>`:'未解決 0件'}</p></div></div>
  <div class="bp-brief-row bp-units">${unitBox('battery',b.battery,[['BMS',text(b.battery.bms)],['SOC',val(b.battery.soc,'%')+(b.battery.soc!=null&&b.battery.at?` <small title="${esc(b.battery.source||'')}">${stamp(b.battery.at)}</small>`:'')]])}${unitBox('pcs',b.pcs,[['運転',text(b.pcs.run)],['出力',val(b.pcs.power,'kW')]])}<button class="bp-unit bp-unit-btn" data-board-comm="${esc(s.id)}" aria-label="通信 ${esc(comm.label)}・設定と警報">${plate('comm')}<b>通信</b>${cm}<p>${esc(comm.label)}</p><p><small>受信</small>${stamp(comm.lastReceivedAt)}</p></button></div>
  ${b.watch?.on&&b.watch.note?`<p class="bp-watch-note">☆ ${esc(b.watch.note)}</p>`:''}<div class="bp-actions"><button class="bp-primary" data-board-inspect="${esc(s.id)}">この拠点を点検する ›</button><button data-board-detail="${esc(s.id)}">流れ・写真・履歴 ›</button></div></section>`;
}

const ago=(t,now=Date.now())=>{const v=Date.parse(t||'');if(!Number.isFinite(v))return '—';const m=Math.round((now-v)/60000);return m<1?'たった今':m<60?m+'分前':m<1440?Math.round(m/60)+'時間前':Math.round(m/1440)+'日前';};
// ふきだし：確認すること・前回の様子・通信・☆メモ・すぐ押せるボタン。自動の判定や原因の推測は出さない。
export function attentionBubble(d,s,a,startPast=false){
  const past=sitePast(d,s),look=lastLook(d,s),comm=commState(s),person=look?.personId?d.people.find(p=>p.id===look.personId)?.name:'';
  // 表：日付 ｜ 設備・内容（アイコン）｜ 状態 ｜ 対処。文章や数字は、行を押したときの詳細に出す。
  const row=i=>`<tr class="st-${i.stage}"><td class="bt-date">${i.since?md(i.since.slice(0,10)):'不明'}<small>${i.days?i.days+'日目':''}</small></td><td class="bt-what"><button class="bt-open" data-item-open="${esc(s.id)}|${esc(i.key)}" aria-label="${esc((i.target?PLATES[i.target]:'対象未特定')+'・'+i.category+'・'+i.title)}の詳細">${eqCell(i)}${badges(d,i)}</button></td><td class="bt-stage"><i class="bp-attn k-${i.kind} ${i.isNew?'is-new':'is-old'}"></i>${i.stage}</td><td class="bt-act"><button class="way-chip w-${i.action?.way||'none'}" data-item-open="${esc(s.id)}|${esc(i.key)}">${i.action?wayIcon(i.action.way)+i.action.way:'選ぶ'}</button></td></tr>`;
  return `<div class="bp-bubble" data-bubble="${esc(s.id)}" role="dialog" aria-label="${boardLabel(s.boardNo)} ${esc(s.name||'')}の確認すること">
  <div class="bb-head"><b>${boardLabel(s.boardNo)} ${esc(s.name||'')}</b><span>${a.count?`確認すること ${a.count}件${a.newCount?`（新 ${a.newCount}）`:'（すべて確認済み）'}`:'確認することはありません'}</span>${a.count?`<button class="bb-past-btn" data-bubble-past aria-pressed="${startPast}">${startPast?'今に戻る':'過去 '+past.length}</button>`:''}<button data-bubble-close aria-label="閉じる">×</button></div>
  <div class="bb-body"><table class="bb-table bb-list" ${startPast?'hidden':''}><thead><tr><th>日付</th><th>設備・内容</th><th>状態</th><th>対処</th></tr></thead><tbody>${a.items.map(row).join('')}</tbody></table>
  <div class="bb-two" ${startPast?'hidden':''}><section><h4>前回の様子</h4>${look?`<div class="bb-look">${look.photo?`<img src="${look.photo==='sample-meter.svg'?'../sample-meter.svg':esc(look.photo)}" alt="前回の点検写真">`:''}<p><b>${look.at?md(new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo'}).format(new Date(look.at))):'日付不明'}</b>${person?` · ${esc(person)}`:''}<br>${esc(look.note||'所見の記録なし')}</p></div>`:'<p class="bp-na">前回の点検記録なし</p>'}</section>
  <section><h4>通信</h4><p>${s.monitoring?.comm?.mode?esc(comm.label):'未設定'}<br><small>最終受信 ${ago(comm.lastReceivedAt)}</small></p><h4>☆メモ</h4><p>${s.watch?.on?esc(s.watch.note||'（メモなし）'):'<span class="bp-na">☆なし</span>'}</p></section></div></div>
  <section class="bb-past" ${startPast?'':'hidden'}><h4>過去（解決済み・新しい順）</h4>${past.length?`<table class="bb-table"><thead><tr><th>日付</th><th>内容</th><th>状態</th></tr></thead><tbody>${past.map(x=>`<tr><td class="bt-date">${x.at?md(new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo'}).format(new Date(x.at))):'不明'}</td><td class="bt-what">${esc(x.title)}${x.detail?`<small>${esc(x.detail)}</small>`:''}</td><td class="bt-stage">${esc(x.kind.replace(/^\S+ /,''))}<small>${esc(x.kind.split(' ')[0])}</small></td></tr>`).join('')}</tbody></table>`:'<p class="bp-na">過去の記録はありません。</p>'}</section><div class="bb-actions bb-actions2" ${a.count?'':'hidden'}><button data-board-inspect="${esc(s.id)}">この拠点を点検する</button><button data-issue-list="${esc(s.id)}">不具合の状態を変える</button></div></div>`;
}
// 一覧の画面：全拠点の「未確認（新）」と「確認済み・対応中」を表で並べる。扉番号を押すと番号盤でその拠点を選ぶ。
export function attentionLists(d){const rows=attentionRows(d),tbl=(list,empty)=>list.length?`<table class="bb-table att-table"><thead><tr><th>日付</th><th>扉</th><th>状態</th><th>設備・内容</th></tr></thead><tbody>${list.map(i=>`<tr><td class="bt-date">${i.since?md(i.since.slice(0,10)):'不明'}</td><td><button class="att-door" data-board-go="${esc(i.siteId)}">${i.label}</button></td><td class="bt-stage"><i class="bp-attn k-${i.kind} ${i.isNew?'is-new':'is-old'}"></i>${i.stage}</td><td class="bt-what"><button class="bt-open" data-item-open="${esc(i.siteId)}|${esc(i.key)}">${eqCell(i)}</button></td></tr>`).join('')}</tbody></table>`:`<p class="bp-na">${empty}</p>`;
 return `<section class="att-lists"><h3>未確認（新） <small>${rows.filter(i=>i.stage==='新').length}件</small></h3>${tbl(rows.filter(i=>i.stage==='新'),'未確認はありません。')}<h3>確認済み・対応中 <small>${rows.filter(i=>i.stage!=='新').length}件</small></h3>${tbl(rows.filter(i=>i.stage!=='新'),'確認済み・対応中はありません。')}</section>`;}
// 行を押したときの詳細：内容の全文・原文・経過、対処（現地・遠隔・外部・未定）と手順・予定日・担当、段階を進めるボタン。
export function itemDetail(d,s,i){const people=d.people||[],a=i.action||{};
  return `<form id="item-detail" data-site="${esc(s.id)}" data-key="${esc(i.key)}" class="item-detail">
  <div class="id-top">${eqCell(i)}<div><b>${i.target?PLATES[i.target]:'対象未特定'} · ${KIND_LABEL[i.kind]}</b><p>${esc(i.title)}</p></div></div>
  <dl class="id-facts"><dt>最初に出た日</dt><dd>${i.since?md(i.since.slice(0,10))+`（${i.days}日目）`:'不明'}</dd><dt>点検をまたいだ回数</dt><dd>${i.spanned??'—'}回</dd><dt>再発</dt><dd>${i.recur?`${i.recur}回（同じ設備・種類で過去に解決）`:'なし'}</dd><dt>状態</dt><dd>${i.stage}</dd>${i.code||i.severityText?`<dt>警報コード</dt><dd>${esc([i.code,i.severityText].filter(Boolean).join(' '))}</dd>`:''}${i.source==='alarm'&&i.text?`<dt>原文</dt><dd>${esc(i.text)}</dd>`:''}</dl>
  <fieldset class="id-way"><legend>対処${i.stage==='新'?'（選ぶと確認済みになります）':''}</legend>${['現地','遠隔','外部','未定'].map(w=>`<label class="way-chip w-${w}"><input type="radio" name="way" value="${w}" ${a.way===w?'checked':''} required>${wayIcon(w)}${w}</label>`).join('')}</fieldset>
  <label>手順・やること<textarea name="note" maxlength="2000" placeholder="例：監視画面で警報履歴を確認">${esc(a.note||'')}</textarea></label>
  <div class="id-row"><label>予定日<input type="date" name="due" value="${esc(a.due||'')}"></label><label>担当<select name="personId"><option value="">未設定</option>${people.map(p=>`<option value="${esc(p.id)}" ${a.personId===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label></div>
  <p class="small-note">対処法の手順を登録して自動で出す機能は後で作ります。今は文字で入力します。</p>
  <div class="id-actions"><button type="submit" class="primary">${i.stage==='新'?'確認した（対処を保存）':'対処を保存'}</button>${i.stage==='確認済み'?`<button type="button" data-board-step="${esc(s.id)}|${esc(i.key)}">対応を始める</button>`:i.stage==='対応中'?(i.source==='incident'?`<button type="button" data-open="incidents:${esc(i.key.slice(9))}">記録を開く</button>`:i.source==='comm'?`<button type="button" data-board-comm="${esc(s.id)}">通信の設定</button>`:`<button type="button" data-board-step="${esc(s.id)}|${esc(i.key)}">解決にする</button>`):''}</div></form>`;}
export {boardLabel,day};
