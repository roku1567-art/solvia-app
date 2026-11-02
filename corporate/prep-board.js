// 立上げ準備のすごろく（＋横の列のビンゴ＝五重の塔が1階ずつ建つ）と、区分ごとのツリーの管理表。
// 並びは準備の No. の順。どのマスからでも済みにできる。駒は済んでいない一番若い番号に立つ。「不要」（理由あり）は数から外す。
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ICON={'監督部事前相談':'相','届出（消防など）':'届','法人体制':'組','従事者':'人','業務区域':'域','換算点数':'点','測定器':'計','規程・手順':'規','蓄電池':'電','緊急対応':'急','契約':'契','申請':'申','顧客・事業場':'客','運用':'運','文書管理':'文','開始判定':'旗'};
export const STAGES=['体制づくり','人と機器','手順づくり','契約と申請','開始の準備'];
const excluded=t=>t.status==='不要'&&String(t.unnecessaryReason||'').trim();
const done=t=>t.status==='完了';
export function prepBoard(tasks,today){const list=[...tasks].sort((a,b)=>(Number(a.no)||9999)-(Number(b.no)||9999)),live=list.filter(t=>!excluded(t));
  const heroIdx=list.findIndex(t=>!excluded(t)&&!done(t)),lastDone=list.reduce((n,t,i)=>done(t)?i:n,-1);
  const rows=[];for(let i=0;i<list.length;i+=5)rows.push(list.slice(i,i+5));
  const cells=list.map((t,i)=>({t,i,state:excluded(t)?'skip':done(t)?'done':t.status==='進行中'?'doing':t.status==='保留'?'hold':'todo',hero:i===heroIdx,left:!done(t)&&!excluded(t)&&i<lastDone,late:!done(t)&&!excluded(t)&&/^\d{4}-\d{2}-\d{2}$/.test(t.due||'')&&t.due<today,icon:ICON[t.category]||String(t.category||'？').slice(0,1)}));
  const rowDone=rows.map(r=>r.length>0&&r.every(t=>done(t)||excluded(t))&&r.some(done));
  return {cells,rows:rows.length,rowDone,done:live.filter(done).length,doing:live.filter(t=>t.status==='進行中').length,total:live.length};}
// 五重の塔（小さなドット絵）。1段目の列がそろうと1階、…。6段目以降は相輪（てっぺん）に数えない。
function pagoda(rowDone){const f=[0,1,2,3,4].map(i=>!!rowDone[i]),all=f.every(Boolean),w=[46,40,34,28,22];let y=86,svg='';
  for(let i=0;i<5;i++){const x=(56-w[i])/2,on=f[i];svg+=`<rect x="${x-3}" y="${y-3}" width="${w[i]+6}" height="4" fill="${on?'#4a5a6a':'#2a3442'}"/><rect x="${x}" y="${y+1}" width="${w[i]}" height="10" fill="${on?'#b8433a':'#3a4250'}"/><rect x="${x+w[i]/2-3}" y="${y+4}" width="6" height="7" fill="${on?'#ffd75e':'#1d2430'}"/>`;y-=15;}
  svg+=`<rect x="27" y="${y-2}" width="2" height="16" fill="${all?'#ffd75e':'#3a4250'}"/>`;
  return `<svg class="pg-tower" viewBox="0 0 56 104" aria-hidden="true"><rect x="2" y="98" width="52" height="5" fill="#5b4a33"/>${svg}</svg>`;}
export function sugorokuHtml(tasks,today){if(!tasks.length)return `<div class="sg gm"><section class="gw"><div class="gt">立上げ準備<small>まだ準備項目がありません</small><button type="button" class="gclose" data-page-back aria-label="閉じて戻る">×<small>戻る</small></button></div></section></div>`;const b=prepBoard(tasks,today),cols=5,floors=b.rowDone.slice(0,5).filter(Boolean).length;
  let grid='';for(let r=0;r<b.rows;r++){let row=b.cells.slice(r*cols,r*cols+cols);if(r%2)row=[...row].reverse();
    const pad=Array.from({length:cols-row.length},()=>'<span class="sq sq-pad"></span>');const cellsHtml=(r%2?[...pad,...row.map(c=>cell(c))]:[...row.map(c=>cell(c)),...pad]).join('');
    grid+=`<div class="sg-row${b.rowDone[r]?' is-clear':''}"><span class="sg-stage"><b>${r+1}</b><small>${esc(STAGES[r]||`${r+1}段目`)}</small>${b.rowDone[r]?'<em>クリア</em>':''}</span><div class="sg-cells">${cellsHtml}</div></div>`;}
  function cell(c){return `<button type="button" class="sq sq-${c.state}${c.hero?' is-hero':''}" data-open="tasks:${esc(c.t.id)}" aria-label="${esc(`${c.t.no||''} ${c.t.name||''} ${c.t.status||'未入力'}`)}"><span class="no">${esc(c.t.no||'')}</span><b>${esc(c.icon)}</b><small>${esc(String(c.t.name||'').slice(0,7))}</small>${c.hero?'<i class="hero" aria-hidden="true"></i>':''}${c.left?'<em class="left">残り</em>':''}${c.late?'<em class="late">!</em>':''}${c.i===b.cells.length-1?'<i class="flag" aria-hidden="true">🏁</i>':''}</button>`;}
  const next=b.cells.filter(c=>c.state==='doing'||c.state==='todo').sort((a,c)=>(c.late-a.late)||((c.state==='doing')-(a.state==='doing'))||a.i-c.i).slice(0,3);
  return `<div class="sg gm"><section class="gw sg-head">${pagoda(b.rowDone)}<div class="sg-sum"><div class="gt">立上げ準備<small>初回受託まで</small><button type="button" class="gclose" data-page-back aria-label="閉じて戻る">×<small>戻る</small></button></div><p><b>${b.done}／${b.total}</b><span>済み${b.doing?`・進行中 ${b.doing}`:''}</span></p><p class="sg-floor">五重の塔 <b>${floors}</b>／5 階${floors===5?' ・完成！':''}</p><p class="sg-lg"><i class="d"></i>済み<i class="p"></i>進行中<i class="n"></i>これから<i class="h"></i>保留</p></div></section>
   <section class="sg-board">${grid}</section>
   ${next.length?`<section class="gw sg-next"><div class="gh">次にやること</div>${next.map((c,k)=>`<button type="button" class="gc${k===0?' gc-main':''}" data-open="tasks:${esc(c.t.id)}"><b>${esc(c.t.no||'')} ${esc(c.t.name||'')}</b>${c.state==='doing'?'<em>進行中</em>':''}${c.late?'<em class="late">期限切れ</em>':''}<small>${esc(c.t.owner||'')}</small></button>`).join('')}</section>`:''}
   <p class="sg-note">マスを押すと中身（成果物・担当・期限・確認先・状態）が開きます。順番どおりでなくても済みにできます。横の列がそろうと、五重の塔が1階建ちます。</p></div>`;}
// 区分ごとのツリーの管理表：大きな分け方（法令・申請／契約・お金／体制・人／機器／手順・安全／運用・記録）→ 区分 → 項目
export const GROUPS=[['法令・申請',['監督部事前相談','申請','届出（消防など）','開始判定']],['契約・お金',['契約']],['体制・人',['法人体制','従事者','業務区域','換算点数']],['機器',['測定器']],['手順・安全',['規程・手順','緊急対応','蓄電池']],['運用・記録',['運用','文書管理','顧客・事業場']]];
const catOf=t=>t.name==='蓄電池の消防の届出の要否確認'&&t.category==='蓄電池'?'届出（消防など）':(t.category||'区分なし');
export function prepTreeHtml(tasks,today){const known=new Set(GROUPS.flatMap(g=>g[1])),groups=[...GROUPS,['その他',[...new Set(tasks.map(catOf).filter(c=>!known.has(c)))]]];
  const chip=t=>`<span class="pt-st st-${esc(excluded(t)?'skip':t.status||'none')}">${esc(excluded(t)?'不要':t.status||'未入力')}</span>`;
  const body=groups.map(([g,cats])=>{const ts=tasks.filter(t=>cats.includes(catOf(t)));if(!ts.length)return '';const live=ts.filter(t=>!excluded(t)),dn=live.filter(done).length;
    return `<details class="tree-branch pt-group" ${dn<live.length?'open':''}><summary><b>${esc(g)}</b><small>${dn}／${live.length} 済み</small></summary><div class="pt-cats">${cats.map(c=>{const cs=ts.filter(t=>catOf(t)===c).sort((a,b)=>(Number(a.no)||0)-(Number(b.no)||0));if(!cs.length)return '';
      return `<div class="pt-cat"><p class="pt-cat-h">${esc(c)}<small>${cs.filter(done).length}／${cs.filter(t=>!excluded(t)).length}</small></p><ul class="tree-leaves">${cs.map(t=>`<li><button data-open="tasks:${esc(t.id)}"><span class="pt-no">${esc(t.no||'')}</span><span class="pt-main"><b>${esc(t.name||'名称未入力')}</b><small>${esc([t.owner,t.due?`期限 ${t.due}${!done(t)&&t.due<today?'（過ぎています）':''}`:'',t.authority].filter(Boolean).join(' ・ '))}</small></span>${chip(t)}</button></li>`).join('')}</ul></div>`;}).join('')}</div></details>`;}).join('');
  return `<div class="gm" style="margin-bottom:8px"><section class="gw"><div class="gt">立上げ準備の管理表<small>法令・契約などのツリー</small><button type="button" class="gclose" data-page-back aria-label="閉じて戻る">×<small>戻る</small></button></div></section></div><section class="panel body-pad tree-menu pt"><p class="small-note">立上げ準備を、法令・契約などの大きな分け方 → 区分 → 項目のツリーで見る管理表です。項目を押すと中身を開いて編集できます。分け方はアプリが区分から決めたもので、法令の分類ではありません。</p><div class="actions"><button data-page="tasks">すごろくで見る ›</button>${''}</div>${body||'<p>準備項目がありません。</p>'}</section>`;}
