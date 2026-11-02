// 人材・体制の「メンバー表」（ゲーム風の窓）。記録された事実だけを並べる。能力の点数や人物の評価は作らない。
import {pointsByPerson} from './points-summary.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n2=v=>v==null?'—':(Math.round(v*100)/100).toString();
const ok=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'');
export function rosterHtml(d){if(!d.people.length)return `<div class="rs gm"><section class="gw rs-head"><div class="gt">人材・体制<small>まだ登録がありません</small><button type="button" class="gclose" data-page-back aria-label="閉じて戻る">×<small>戻る</small></button></div></section></div>`;const pb=pointsByPerson(d),rows=new Map(pb.rows.map(r=>[r.id,r]));
  const people=[...d.people].sort((a,b)=>({'代表者':0,'保安部門責任者':1,'保安業務従事者':2,'代務者':3,'補助者':4,'申請担当':5}[a.role]??9)-({'代表者':0,'保安部門責任者':1,'保安業務従事者':2,'代務者':3,'補助者':4,'申請担当':5}[b.role]??9));
  const badge=(on,label)=>`<span class="rs-b ${on?'on':''}">${on?'✓':'？'}${label}</span>`;
  const card=p=>{const r=rows.get(p.id)||{},cap=r.capacity,pts=r.points,pct=cap&&pts!=null?Math.min(1,pts/cap):0;
    return `<button type="button" class="rs-card" data-open="people:${esc(p.id)}" data-menu-label="${esc(p.name||'氏名未入力')}"><span class="rs-face" aria-hidden="true"><i></i></span><span class="rs-main"><span class="rs-top"><b>${esc(p.name||'氏名未入力')}</b><small>${esc(p.role||'役割未入力')}</small></span>
     <span class="rs-line"><span>免状 <b>${esc(p.license||'未入力')}</b></span><span>経験 <b>${p.experience!=null&&p.experience!==''?esc(p.experience)+'年':'未入力'}</b></span><span>担当 <b>${r.sites??0}</b>か所</span></span>
     <span class="rs-bar"><span class="rs-bar-l">点数</span><span class="rs-gauge ${r.over?'over':''}"><i style="width:${(pct*100).toFixed(0)}%"></i></span><span class="rs-bar-v">${n2(pts)}／${cap==null?'未入力':n2(cap)}</span></span>
     <span class="rs-badges">${badge(p.fullTime==='確認済','常勤')}${badge(ok(p.courseDate),'講習')}${badge(ok(p.trainingDate),'訓練')}${badge(!!p.deputyId||!!p.deputyName,'代務')}</span></span><i class="rs-go">›</i></button>`;};
  const total=pb.total;
  return `<div class="rs gm"><section class="gw rs-head"><div class="gt">人材・体制<small>メンバー表・押すと詳しく</small><button type="button" class="gclose" data-page-back aria-label="閉じて戻る">×<small>戻る</small></button></div><p class="rs-sum"><span>人数 <b>${d.people.length}</b>名</span><span>点数の合計 <b>${n2(total.points)}</b></span><span>担当なしの拠点 <b class="${pb.unassigned.sites?'warn':''}">${pb.unassigned.sites}</b>か所</span></p></section>
   <section class="gw rs-list">${people.map(card).join('')}</section>
   <p class="sg-note">点数は拠点の「換算点数・記載値」の合計／担当可能点数（記載値）。✓は記録あり、？は未入力・未確認。能力の評価はしません。</p></div>`;}
// 人を押したとき：選手カードのような窓。事実だけ（免状・経験・常勤・講習・訓練・点数・担当の拠点）。全部の項目は下にたたんで出す。
export function personCard(d,p,{fields,proofs}){const pb=pointsByPerson(d),r=pb.rows.find(x=>x.id===p.id)||{},cap=r.capacity,pts=r.points,pct=cap&&pts!=null?Math.min(1,pts/cap):0;
  const sites=d.sites.filter(s=>s.assigneeId===p.id&&['受託中','受託予定','申請中'].includes(s.status)),deputy=d.sites.filter(s=>s.deputyId===p.id&&['受託中','受託予定','申請中'].includes(s.status));
  const no=s=>s.boardNo?String(s.boardNo).padStart(3,'0'):'---',st=(label,v)=>`<div><dt>${label}</dt><dd>${v}</dd></div>`;
  const visits=(d.visits||[]).filter(v=>v.personId===p.id).sort((a,b)=>String(b.at||'').localeCompare(String(a.at||''))).slice(0,5);
  return `<div class="td gm pc">
  <section class="gw pc-head"><span class="rs-face" aria-hidden="true"><i></i></span><div><b class="pc-name">${esc(p.name||'氏名未入力')}</b><small class="pc-role">${esc(p.role||'役割未入力')}</small><div class="rs-badges">${['常勤','講習','訓練'].map((l,i)=>{const on=[p.fullTime==='確認済',ok(p.courseDate),ok(p.trainingDate)][i];return `<span class="rs-b ${on?'on':''}">${on?'✓':'？'}${l}</span>`;}).join('')}</div></div></section>
  <section class="gw"><dl class="pc-stats">${st('免状',esc(p.license||'未入力'))}${st('免状番号',esc(p.licenseNo||'未入力'))}${st('実務経験',p.experience!=null&&p.experience!==''?esc(p.experience)+'年':'未入力')}${st('雇用',esc(p.employment||'未入力'))}${st('講習修了',esc(p.courseDate||'未入力'))}${st('訓練修了',esc(p.trainingDate||'未入力'))}${st('担当区域',esc(p.area||'未入力'))}${st('緊急連絡',esc(p.contact||'未入力'))}</dl>
   <div class="rs-bar pc-bar"><span class="rs-bar-l">点数</span><span class="rs-gauge ${r.over?'over':''}"><i style="width:${(pct*100).toFixed(0)}%"></i></span><span class="rs-bar-v">${n2(pts)}／${cap==null?'未入力':n2(cap)}${r.capacityConfirmed?'':' <small>（根拠未確認）</small>'}</span></div></section>
  <section class="gw"><div class="gh">担当の拠点 ${sites.length}か所${deputy.length?`・代務 ${deputy.length}か所`:''}</div>${sites.map(s=>`<div class="pc-site"><button type="button" class="td-row" data-open="sites:${esc(s.id)}"><span class="td-tok">${no(s)}</span><span class="td-nm"><b>${esc(s.name)}</b><small>${esc(s.status)}・点数 ${s.points??'未入力'}</small></span></button><button type="button" class="td-btn" data-edit="sites:${esc(s.id)}">配置変更</button></div>`).join('')||'<p class="td-note">担当の拠点はありません。</p>'}${deputy.map(s=>`<div class="pc-site"><button type="button" class="td-row" data-open="sites:${esc(s.id)}"><span class="td-tok pc-dep">${no(s)}</span><span class="td-nm"><b>${esc(s.name)}</b><small>代務</small></span></button></div>`).join('')}</section>
  ${visits.length?`<section class="gw"><div class="gh">点検の記録（新しい順）</div>${visits.map(v=>`<p class="pc-visit">${esc(String(v.at||'').slice(0,10)||'日付なし')}　${esc(d.sites.find(s=>s.id===v.siteId)?.name||'拠点不明')}　<em>${v.status==='complete'?'点検完了':'下書き'}</em></p>`).join('')}</section>`:''}
  ${p.skills||p.memo?`<section class="gw">${p.skills?`<p class="pc-visit">得意分野（自己申告）：${esc(p.skills)}</p>`:''}${p.memo?`<p class="pc-visit">メモ：${esc(p.memo)}</p>`:''}</section>`:''}
  <section class="gw gcmds" style="grid-template-columns:1fr"><button type="button" class="gc gc-main" data-edit="people:${esc(p.id)}">編集する</button></section>
  <details class="gw pc-all"><summary>すべての項目を見る</summary><dl class="pc-stats">${fields.map(([l,v])=>st(esc(l),esc(v||'未入力'))).join('')}</dl>${proofs}</details>
  <p class="td-note">記録された事実だけを出しています。能力の評価はしません。</p></div>`;}
