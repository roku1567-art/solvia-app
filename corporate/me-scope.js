// 自分の担当だけを見る（2026-11-03）：この端末を使う人（自分）を選び、本部・地図・点検の盤を「自分の担当（担当または代務）」に絞る。
// 端末ごとの見え方の設定なので、記録（IndexedDB）には入れず、この端末の保存領域に置く。データは消さない・変えない。
import {pix} from './eq-icons.js';
const KEY='solvia-me-v1',esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
function read(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')||{};}catch{return {};}}
export function meState(d){const x=read()[d?.kind||'work']||{},me=(d?.people||[]).some(p=>p.id===x.me)?x.me:'';return {me,mine:!!(me&&x.mine)};}
export function setMe(d,patch){const all=read(),k=d?.kind||'work';all[k]={...(all[k]||{}),...patch};try{localStorage.setItem(KEY,JSON.stringify(all));}catch{}}
export function scoped(d){const {me,mine}=meState(d);if(!mine||!Array.isArray(d?.sites))return d;
  const sites=d.sites.filter(s=>s.assigneeId===me||s.deputyId===me),ids=new Set(sites.map(s=>s.id)),all=new Set(d.sites.map(s=>s.id)),keep=r=>!r?.siteId||!all.has(r.siteId)||ids.has(r.siteId);
  const high=Number.isInteger(d.boardNoHigh)?d.boardNoHigh:Math.max(0,...d.sites.map(s=>s.boardNo||0));
  return {...d,sites,boardNoHigh:high,inspections:(d.inspections||[]).filter(keep),incidents:(d.incidents||[]).filter(keep),visits:(d.visits||[]).filter(keep),events:Array.isArray(d.events)?d.events.filter(keep):d.events,tasks:Array.isArray(d.tasks)?d.tasks.filter(keep):d.tasks,scopedMe:me};}
export function meChip(d){const {me,mine}=meState(d),p=(d?.people||[]).find(x=>x.id===me);return `<button type="button" class="me-chip${mine?' is-mine':''}" data-me-open aria-label="表示する担当：${mine?esc(p?.name)+'の担当だけ':'全員'}">${pix('person')}<span>${mine?esc(p?.name||'自分'):'全員'}</span><small class="me-lab">${mine?'自分':'全員'}</small></button>`;}
export function meWindow(d){const {me,mine}=meState(d),people=d?.people||[];
  return `<div class="td gm me-win"><section class="gw"><div class="gh">自分は誰？（この端末を使う人）</div>${people.length?`<div class="me-people">${people.map(p=>`<button type="button" class="td-btn${p.id===me?' td-main':''}" data-me-set="${esc(p.id)}">${p.id===me?'✓ ':''}${esc(p.name||'氏名未入力')}<small>${esc(p.area||p.role||'')}</small></button>`).join('')}</div>`:'<p class="td-note">人材の台帳に、まだ人が登録されていません。</p>'}</section>
  <section class="gw"><div class="gh">見る範囲</div><div class="td-acts"><button type="button" class="td-btn${mine?' td-main':''}" data-me-mine="1" ${me?'':'disabled'}>自分の担当だけ</button><button type="button" class="td-btn${mine?'':' td-main'}" data-me-mine="0">全員</button></div><p class="td-note">自分の担当＝台帳の「担当」か「代務者」が自分の拠点。代務の拠点は盤の扉に「代」と出ます。記録は変えません。この端末だけの設定です。</p></section></div>`;}
