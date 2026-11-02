// 画面のボタン一覧（≣ 一覧）。いまの画面にある押せるものを集めて一覧にし、押すとその場所を押したのと同じになる。
// 絵の中の札も、絵の外のボタンも同じ一覧に出す。最初に触れるところ（親）を大きく、それに付随するもの（子）は下に枝で小さく。番号盤の扉（50枚）は数が多いので、まとめて1行にする。
export const menuButton=(cls='')=>`<button type="button" class="pg-menu ${cls}" data-page-menu aria-label="この画面のボタン一覧" data-menu-label="この画面のボタン一覧">${cls==='hq-menu'?'<svg class="hq-menu-icon" viewBox="0 0 24 18" aria-hidden="true"><rect y="0" width="24" height="3" rx="1"/><rect y="7.5" width="24" height="3" rx="1"/><rect y="15" width="24" height="3" rx="1"/></svg><small>一覧</small>':'≣ 一覧'}</button>`;
const SCENE='.miniature,.landmark-canvas,.regional-map';
const SKIP='[data-page-menu],#nav *,header *,[data-board-cell],[data-board-slot],[data-board-gap],dialog *,.hq-roofcal>*';
let targets=[];
const labelOf=el=>(el.dataset.menuLabel||el.getAttribute('aria-label')||el.innerText||el.title||'').replace(/\s+/g,' ').replace(/[›»]/g,'').trim().slice(0,60);
// 木の形：data-menu-group の中（または data-menu-in で data-menu-key の組を指したもの）は、data-menu-head のボタンを親（大きく）、ほかを子（付随）にする。親ボタンがない組は、名前（data-menu-group の値）を見出しにする。
export function collectMenu(root=document.querySelector('#page')){const seen=new Set(),groups={scene:[],other:[]},nodes=new Map();targets=[];
  for(const el of root.querySelectorAll('button,a[href],summary')){if(el.matches(SKIP)||el.disabled||!el.offsetParent&&getComputedStyle(el).position!=='fixed')continue;const label=labelOf(el);if(!label||seen.has(label))continue;seen.add(label);targets.push(el);const i=targets.length-1,list=el.closest(SCENE)?groups.scene:groups.other,g=el.closest('[data-menu-group]')||(el.dataset.menuIn?root.querySelector(`[data-menu-key="${CSS.escape(el.dataset.menuIn)}"]`):null);
    if(!g||!root.contains(g)){list.push({i,label,children:[]});continue;}
    let node=nodes.get(g);if(!node){node={i:null,label:g.dataset.menuGroup||'',children:[]};nodes.set(g,node);list.push(node);}
    if(el.hasAttribute('data-menu-head')&&node.i===null){node.i=i;node.label=label;}else node.children.push({i,label});}
  const clean=l=>l.filter(n=>n.i!==null||n.children.length);
  const doors=root.querySelectorAll('[data-board-cell]').length;return {scene:clean(groups.scene),other:clean(groups.other),doors};}
const e=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function menuHtml(m){const node=n=>`<li class="pm-node">${n.i!==null?`<button type="button" class="pm-top" data-menu-go="${n.i}">${e(n.label)}<i>›</i></button>`:`<div class="pm-top pm-label">${e(n.label)}</div>`}${n.children.length?`<ul class="pm-sub">${n.children.map(c=>`<li><button type="button" class="pm-child" data-menu-go="${c.i}">${e(c.label)}<i>›</i></button></li>`).join('')}</ul>`:''}</li>`;
  const list=(t,rows)=>rows.length?`<h3 class="pm-h">${t}</h3><ul class="pm-list">${rows.map(node).join('')}</ul>`:'';
  return `<div class="pm">${list('絵の中',m.scene)}${list(m.scene.length?'絵の外':'この画面',m.other)}${m.doors?`<p class="small-note">番号の扉（${m.doors}枚）は、盤の扉を直接押して選びます。</p>`:''}</div>`;}
export function goMenu(i){const el=targets[Number(i)];if(el&&el.isConnected)el.click();}
