// 通信の管理の画面（ゲーム風）。入口：番号盤の「通信・警報」、メニュー、本部の要確認。
// 一枚の画面に 順位表／原因の傾向／取り込み（CSV）／設定 の4つを切り替える。拠点を押すと通信の台帳と記録の窓が開く。
import {CAUSES,LINES,REBOOT_WAYS,commOf,commRule,commLevel,hasComm,ledgerFlags,outageMinutes,ranking,trends,commAttention,siteHistory,parseCsv,guessMap,importRows,bumpLastReceived,emptyComm} from './comm-model.js';
import {uid} from './model.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const no=s=>s?.boardNo?String(s.boardNo).padStart(3,'0'):'---';
const fmt=v=>{const x=Date.parse(v||'');return Number.isFinite(x)?new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(x):'未記録';};
const local=v=>{const x=Date.parse(v||'');if(!Number.isFinite(x))return '';return new Date(x+9*3600000).toISOString().slice(0,16);};
const fromLocal=v=>{const s=String(v||'').trim();if(!s)return '';const x=Date.parse(s+':00+09:00');return Number.isFinite(x)?new Date(x).toISOString():'';};
const dur=m=>m>=1440?`${Math.floor(m/1440)}日${Math.round(m%1440/60)}時間`:m>=60?`${Math.floor(m/60)}時間${m%60}分`:`${m}分`;
const LV={ok:['届いている','cm-ok'],yellow:['未更新','cm-yellow'],red:['途絶','cm-red'],unknown:['未受信・判定できない','cm-unknown'],none:['通信なし','cm-none']};
const sel=(name,opts,v,blank='未入力')=>`<select name="${name}"><option value="">${blank}</option>${opts.map(o=>`<option ${v===o?'selected':''}>${esc(o)}</option>`).join('')}</select>`;
const f=(label,html,cls='')=>`<label class="qm-f ${cls}">${label}${html}</label>`;
const inp=(name,v,extra='')=>`<input name="${name}" value="${esc(v??'')}" ${extra}>`;

let view={tab:'rank'},csv=null,api=null;
const TABS=[['rank','順位表'],['trend','原因の傾向'],['csv','取り込み'],['set','設定']];

export function commPage(d){const a=commAttention(d),r=commRule(d),tab=TABS.some(t=>t[0]===view.tab)?view.tab:'rank';
 return `<div class="td gm qm cm"><section class="gw qm-top"><div class="gt">通信の管理<small>黄 ${r.yellowHours}時間・赤 ${r.redHours}時間</small></div>
  <div class="cm-sum"><span class="${a.red?'is-red':''}">途絶 <b>${a.red}</b></span><span class="${a.yellow?'is-yel':''}">未更新 <b>${a.yellow}</b></span><span class="${a.contract?'is-yel':''}">契約期限 <b>${a.contract}</b></span><span class="${a.old3g?'is-yel':''}">3G <b>${a.old3g}</b></span></div></section>
  <div class="cm-tabs" role="tablist">${TABS.map(([k,l])=>`<button type="button" role="tab" data-comm-go="${k}" aria-selected="${k===tab}">${l}</button>`).join('')}</div>
  ${({rank:rankView,trend:trendView,csv:csvView,set:setView})[tab](d)}</div>`;}

function rankView(d){const rows=ranking(d),bad=(d.sites||[]).filter(hasComm).map(s=>({s,l:commLevel(d,s)})).filter(x=>x.l.level==='red'||x.l.level==='yellow').sort((a,b)=>(a.l.level==='red'?0:1)-(b.l.level==='red'?0:1)),flagged=(d.sites||[]).filter(s=>{const f=ledgerFlags(d,s);return f.contractSoon||f.old3g;}),site=id=>(d.sites||[]).find(s=>s.id===id);
 return `${bad.length||flagged.length?`<section class="gw td-list"><div class="gh">いま見る拠点</div>${bad.slice(0,4).map(({s,l})=>`<button type="button" class="td-row qm-row" data-comm-site="${esc(s.id)}"><span class="td-tok">${no(s)}</span><span class="td-nm"><b>${esc(s.name)}</b><small>最後に届いた ${fmt(l.lastReceivedAt)}</small></span><span class="td-st ${l.level==='red'?'is-red':'is-yel'} td-st-warn">${esc(LV[l.level][0])}</span></button>`).join('')}${flagged.slice(0,3).map(s=>{const f=ledgerFlags(d,s);return `<button type="button" class="td-row qm-row" data-comm-site="${esc(s.id)}"><span class="td-tok">${no(s)}</span><span class="td-nm"><b>${esc(s.name)}</b><small>${f.contractSoon?(f.contractLeft<0?'契約期限切れ':`契約期限まで ${f.contractLeft}日`):''}${f.contractSoon&&f.old3g?'・':''}${f.old3g?'3G用の通信機':''}</small></span><span class="td-st is-yel td-st-warn">台帳</span></button>`;}).join('')}</section>`:''}
 <section class="gw td-list"><div class="gh">通信が悪い拠点（直近30日の途切れ）</div>${rows.slice(0,8).map((r,i)=>{const s=site(r.siteId);return `<button type="button" class="td-row qm-row" data-comm-site="${esc(r.siteId)}"><span class="td-tok">${i+1}位</span><span class="td-nm"><b>${no(s)} ${esc(s?.name||'')}</b><small>途切れ ${r.count}回・合計 ${dur(r.minutes)}${r.open?`・続いている ${r.open}`:''}</small></span></button>`;}).join('')||'<p class="td-note">直近30日の途切れの記録はありません（記録が無いことは、途切れが無かったという意味ではありません）。</p>'}</section>
 <p class="td-note">回数が多い順、同じなら合計時間が長い順。記録した途切れだけで並べます。</p>`;}

const bars=(pairs,max)=>pairs.map(([l,n])=>`<div class="cm-bar"><span>${esc(l)}</span><i style="--w:${max?Math.round(n/max*100):0}%"></i><b>${n}</b></div>`).join('');
function trendView(d){const t=trends(d);if(!t.total)return '<section class="gw"><p class="td-note">途切れの記録がまだありません。拠点の窓の「途切れを記録」から入れると、原因・時間帯・月ごとの件数がここに出ます。</p></section>';
 const c=Object.entries(t.cause),h=t.hours.map((n,i)=>[`${i*3}〜${i*3+3}時`,n]),m=t.months.map((n,i)=>[`${i+1}`,n]),mx=Math.max(...t.months,1);
 return `<div class="cm-2"><section class="gw"><div class="gh">原因別（全${t.total}件）</div>${bars(c,Math.max(...c.map(x=>x[1])))}</section>
 <section class="gw"><div class="gh">時間帯（始まり）</div>${bars(h,Math.max(...t.hours))}</section></div>
 <section class="gw"><div class="gh">月ごと</div><div class="cm-months">${m.map(([l,n])=>`<div><i style="--h:${Math.round(n/mx*100)}%"></i><b>${n||''}</b><span>${l}</span></div>`).join('')}</div></section>
 <p class="td-note">例：夏の昼に多く原因が「熱」なら、盤の中の温度を疑います。件数は記録したものだけです。</p>`;}

function csvView(d){if(!csv)return `<section class="gw"><div class="gh">監視サービスの画面から書き出したCSVを取り込む</div><label class="qm-f">CSVのファイル<input type="file" id="comm-csv-file" accept=".csv,text/csv,text/plain"></label><p class="td-note">1行目は見出しにしてください。次の画面で「拠点番号・日時・値」の列を対応づけます。拠点は番号（例 12）・事業場ID・名前で探します。時刻帯の無い日時は日本時間として読みます。</p></section>`;
 const head=csv.rows[0]||[],m=csv.map,opt=(k,label,need)=>`<label class="qm-f">${label}${need?'（必須）':''}<select name="${k}"><option value="-1">使わない</option>${head.map((h,i)=>`<option value="${i}" ${m[k]===i?'selected':''}>${i+1}列目：${esc(h)}</option>`).join('')}</select></label>`;
 return `<form id="comm-csv" class="gw qm-form"><div class="gh">列の対応づけ（${esc(csv.name)}・${csv.rows.length-1}行）</div><div class="qm-2">${opt('site','拠点番号',true)}${opt('at','記録日時',true)}</div><div class="qm-2">${opt('last','最後にデータが届いた時刻')}${opt('signal','電波の強さ（数値）')}</div><div class="qm-2">${opt('level','電波の強さ（5段階）')}${opt('data','その日のデータ量（MB）')}</div>
  <div class="cm-prev">${csv.rows.slice(0,3).map(r=>`<p>${r.map(esc).join(' ｜ ')}</p>`).join('')}</div><div class="td-acts"><button type="submit" class="td-btn td-main">取り込む</button><button type="button" class="td-btn" data-comm-csv-cancel>やめる</button></div></form>`;}

function setView(d){const r=commRule(d);return `<form id="comm-set" class="gw qm-form"><div class="gh">通信の印の時間</div><div class="qm-2">${f('黄（最後に届いてから何時間）',`<input type="number" name="yellowHours" min="1" max="8760" step="1" required value="${r.yellowHours}">`)}${f('赤（最後に届いてから何時間）',`<input type="number" name="redHours" min="2" max="8760" step="1" required value="${r.redHours}">`)}</div><p class="td-note">初期値は 黄3時間・赤24時間（指示書の本人指定）。拠点の「通信・警報」で「何分以内を正常」を入れた拠点は、そちらを優先します。</p><div class="td-acts"><button type="submit" class="td-btn td-main">保存</button></div></form>`;}

// ---- 拠点ごとの窓 ----
export function siteWindow(d,id){const s=(d.sites||[]).find(x=>x.id===id);if(!s)return '';const c=commOf(d),i=c.info[id]||{},e=s.equipmentInfo?.comm||{},l=commLevel(d,s),fl=ledgerFlags(d,s),h=siteHistory(d,id);
 const line=(k,v)=>`<p><b>${k}</b>${v}</p>`;
 return `<div class="cm-site"><p class="cm-state"><span class="bp-cm ${LV[l.level][1]}"></span>${esc(l.label)}・最後に届いた ${fmt(l.lastReceivedAt)}</p>
 <div class="qm-hist cm-ledger">${line('通信機',`${esc([e.maker,e.model].filter(Boolean).join(' ')||'未入力')}${e.serial?`（${esc(e.serial)}）`:''}・${esc(i.place||'設置場所 未入力')}・${esc(i.line||'回線の種類 未入力')}${fl.old3g?' <em class="cm-w">3G用</em>':''}`)}
  ${line('回線',`${esc(i.carrier||'携帯会社 未入力')}・${esc(i.sim||'番号 未入力')}・${esc(i.plan||'プラン 未入力')}${i.dataCap?`・月 ${esc(i.dataCap)}`:''}・期限 ${esc(i.contractDue||'未入力')}${fl.contractSoon?` <em class="cm-w">${fl.contractLeft<0?'期限切れ':'あと'+fl.contractLeft+'日'}</em>`:''}`)}
  ${line('アンテナ',`${esc(i.antenna||'未入力')}${i.antenna==='外付け'&&i.antennaPlace?`（${esc(i.antennaPlace)}）`:''}・予備回線 ${esc(i.backup||'未入力')}${i.backup==='あり'?`（${esc(i.backupCarrier||'')} ${esc(i.backupSim||'')}）`:''}`)}
  ${line('再起動',`遠隔 ${esc(i.remoteReboot||'未入力')}・自動の設定 ${esc(i.autoReboot||'未入力')}・契約先 ${esc(i.provider||'未入力')}`)}</div>
 <div class="si-cmds"><button type="button" class="td-btn" data-comm-form="info|${esc(id)}">台帳を直す</button><button type="button" class="td-btn" data-comm-form="log|${esc(id)}">状態を記録</button><button type="button" class="td-btn" data-comm-form="outage|${esc(id)}">途切れを記録</button><button type="button" class="td-btn" data-comm-form="reboot|${esc(id)}">再起動を記録</button></div>
 <div class="qm-hist"><b>途切れ（新しい順）</b>${h.outages.slice(0,4).map(o=>`<div class="cm-out"><p>${fmt(o.start)}〜${o.end?fmt(o.end):'<em class="cm-w">続いている</em>'}・${dur(outageMinutes(o))}・${esc(o.cause)}${o.rebooted?'・再起動した':''}</p><button type="button" class="td-btn" data-comm-form="outage|${esc(id)}|${esc(o.id)}">直す</button><button type="button" class="td-btn" data-qms-ncr="" data-qms-ncr-preset="${esc(JSON.stringify({siteId:id,kind:'不具合',content:`通信の途切れ ${fmt(o.start)}〜${o.end?fmt(o.end):'継続中'}（原因：${o.cause}）${o.action?'。対処：'+o.action:''}`,from:'comm:'+o.id}))}">品質管理へ</button></div>`).join('')||'<p>記録はありません。</p>'}</div>
 <div class="qm-hist"><b>状態の記録・再起動</b>${h.logs.slice(0,3).map(x=>`<p>${fmt(x.at)}・${x.signal!=null?esc(x.signal)+'dBm':'電波 数値なし'}${x.level!=null?`・${x.level}/5`:''}${x.dataMB!=null?`・${esc(x.dataMB)}MB`:''}・${esc(x.source)}</p>`).join('')}${h.reboots.slice(0,3).map(x=>`<p>${fmt(x.at)}・再起動（${esc(x.way)}）${x.note?'・'+esc(x.note):''}</p>`).join('')||(h.logs.length?'':'<p>記録はありません。</p>')}</div></div>`;}

function infoForm(d,id){const s=d.sites.find(x=>x.id===id),i=commOf(d).info[id]||{},e=s?.equipmentInfo?.comm||{};
 return `<form id="comm-info" data-site="${esc(id)}" class="qm-form"><div class="qm-2">${f('メーカー',inp('maker',e.maker,'maxlength="300"'))}${f('型番',inp('model',e.model,'maxlength="300"'))}</div><div class="qm-2">${f('製造番号',inp('serial',e.serial,'maxlength="300"'))}${f('設置場所',sel('place',['盤の中','盤の外'],i.place||''))}</div>
 <div class="qm-2">${f('回線の種類',sel('line',LINES,i.line||''))}${f('携帯会社',inp('carrier',i.carrier,'maxlength="300"'))}</div><div class="qm-2">${f('SIMの番号（電話番号）',inp('sim',i.sim,'maxlength="300" inputmode="tel"'))}${f('契約プラン',inp('plan',i.plan,'maxlength="300"'))}</div>
 <div class="qm-2">${f('月のデータ量の上限',inp('dataCap',i.dataCap,'maxlength="300" placeholder="例 1GB"'))}${f('契約の期限',`<input type="date" name="contractDue" value="${esc(i.contractDue||'')}">`)}</div>
 <div class="qm-2">${f('アンテナ',sel('antenna',['内蔵','外付け'],i.antenna||''))}${f('外付けの取付位置',inp('antennaPlace',i.antennaPlace,'maxlength="300"'))}</div>
 <div class="qm-2">${f('予備回線',sel('backup',['あり','なし'],i.backup||''))}${f('予備の携帯会社',inp('backupCarrier',i.backupCarrier,'maxlength="300"'))}</div>${f('予備のSIMの番号',inp('backupSim',i.backupSim,'maxlength="300"'))}
 <div class="qm-2">${f('遠隔での再起動',sel('remoteReboot',['できる','できない'],i.remoteReboot||''))}${f('自動再起動の設定',sel('autoReboot',['あり','なし'],i.autoReboot||''))}</div>${f('通信の契約先（監視サービス・アグリゲーター）',inp('provider',i.provider,'maxlength="300"'))}
 <div class="form-footer"><button type="submit" class="primary">保存</button></div></form>`;}
function logForm(d,id){const now=new Date().toISOString();return `<form id="comm-log" data-site="${esc(id)}" class="qm-form"><div class="qm-2">${f('記録日時',`<input type="datetime-local" name="at" required value="${local(now)}">`)}${f('最後にデータが届いた時刻',`<input type="datetime-local" name="lastReceivedAt">`)}</div>
 <div class="qm-2">${f('電波の強さ（数値・dBm）','<input type="number" name="signal" step="any" min="-200" max="0" inputmode="decimal">')}${f('電波の強さ（5段階）',`<select name="level"><option value="">未入力</option>${[0,1,2,3,4,5].map(n=>`<option>${n}</option>`).join('')}</select>`)}</div>
 ${f('その日のデータ量（MB）','<input type="number" name="dataMB" step="any" min="0" inputmode="decimal">')}${f('メモ','<textarea name="note" rows="2" maxlength="2000"></textarea>')}<div class="form-footer"><button type="submit" class="primary">記録する</button></div></form>`;}
function outageForm(d,id,oid){const o=oid?commOf(d).outages.find(x=>x.id===oid)||{}:{};return `<form id="comm-outage" data-site="${esc(id)}" data-id="${esc(oid||'')}" class="qm-form"><div class="qm-2">${f('始まり',`<input type="datetime-local" name="start" required value="${local(o.start)}">`)}${f('終わり（続いているなら空欄）',`<input type="datetime-local" name="end" value="${local(o.end)}">`)}</div>
 ${f('原因',`<select name="cause" required>${CAUSES.map(c=>`<option ${o.cause===c?'selected':''}>${c}</option>`).join('')}</select>`)}${f('対処の内容','<textarea name="action" rows="2" maxlength="2000">'+esc(o.action||'')+'</textarea>')}
 <label class="qm-chk"><input type="checkbox" name="rebooted" ${o.rebooted?'checked':''}>再起動した（再起動の履歴にも残す）</label>${f('再起動のしかた',sel('way',REBOOT_WAYS,'遠隔','選ぶ'))}<div class="form-footer"><button type="submit" class="primary">保存</button></div></form>`;}
function rebootForm(d,id){return `<form id="comm-reboot" data-site="${esc(id)}" class="qm-form">${f('日時',`<input type="datetime-local" name="at" required value="${local(new Date().toISOString())}">`)}${f('しかた',`<select name="way">${REBOOT_WAYS.map(w=>`<option>${w}</option>`).join('')}</select>`)}${f('メモ','<textarea name="note" rows="2" maxlength="2000"></textarea>')}<div class="form-footer"><button type="submit" class="primary">記録する</button></div></form>`;}

const modal=(t,h)=>{api.modal(t,h);document.getElementById('dialog')?.classList.add('gm-dlg');};
const openSite=id=>{const d=api.data(),s=d.sites.find(x=>x.id===id);modal(`${no(s)} ${s?.name||''} · 通信`,siteWindow(d,id));};
export function initComm(a){api=a;
 document.addEventListener('click',e=>{const b=e.target.closest('[data-comm-go],[data-comm-site],[data-comm-form],[data-comm-csv-cancel]');if(!b)return;
  if(b.dataset.commGo!==undefined){view.tab=b.dataset.commGo||view.tab||'rank';document.getElementById('dialog')?.close();if(document.body.dataset.page!=='comm')api.go('comm');else api.render();return;}
  if(b.dataset.commSite){openSite(b.dataset.commSite);return;}
  if(b.hasAttribute('data-comm-csv-cancel')){csv=null;api.render();return;}
  if(b.dataset.commForm){const [k,id,oid]=b.dataset.commForm.split('|'),d=api.data();modal({info:'通信の台帳',log:'通信の状態を記録',outage:oid?'途切れの記録を直す':'途切れを記録',reboot:'再起動を記録'}[k],({info:infoForm,log:logForm,outage:outageForm,reboot:rebootForm})[k](d,id,oid));}});
 document.addEventListener('change',e=>{if(e.target.id!=='comm-csv-file')return;const file=e.target.files?.[0];if(!file)return;if(file.size>5*1024*1024){api.toast('CSVは5MBまでです');return;}
  const r=new FileReader();r.onload=()=>{const rows=parseCsv(String(r.result||''));if(rows.length<2){api.toast('見出しと1行以上のデータが必要です');return;}csv={name:file.name,rows,map:guessMap(rows[0])};api.render();};r.readAsText(file);});
 document.addEventListener('submit',async e=>{const fm=e.target;if(!/^comm-/.test(fm.id||''))return;e.preventDefault();const fd=new FormData(fm),v=k=>String(fd.get(k)||'').trim(),n=k=>{const x=v(k);return x===''?null:Number(x);},id=fm.dataset.site;
  try{if(fm.id==='comm-csv'){const map=Object.fromEntries(['site','at','last','signal','level','data'].map(k=>[k,Number(fd.get(k))]));if(map.site<0||map.at<0&&map.last<0)return api.toast('拠点番号と日時（記録日時か最後に届いた時刻）の列を選んでください');let res;
    await api.change(d=>{res=importRows(d,csv.rows,map,uid);},'通信：CSV取り込み');csv=null;view.tab='rank';api.render();api.modal('取り込みの結果',`<p>${res.added}行を取り込みました。${res.skipped.length?`取り込まなかった行 ${res.skipped.length}：`:''}</p>${res.skipped.slice(0,20).map(x=>`<p class="td-note">${x.line}行目：${esc(x.reason)}</p>`).join('')}`);return;}
   if(fm.id==='comm-set'){const y=n('yellowHours'),r=n('redHours');if(!(y>0&&r>y))return api.toast('赤の時間は黄より長くしてください');await api.change(d=>{d.comm={...emptyComm(),...(d.comm||{})};d.comm.settings={yellowHours:y,redHours:r};},'通信：印の時間');api.toast('保存しました');return;}
   await api.change(d=>{d.comm={...emptyComm(),...(d.comm||{})};const c=d.comm,s=d.sites.find(x=>x.id===id);if(!s)throw Error('拠点が見つかりません');
    if(fm.id==='comm-info'){s.equipmentInfo??={};const ei={...(s.equipmentInfo.comm||{})};for(const k of ['maker','model','serial']){if(v(k))ei[k]=v(k);else delete ei[k];}ei.updatedAt=new Date().toISOString();s.equipmentInfo.comm=ei;
     c.info={...c.info,[id]:Object.fromEntries(['place','line','carrier','sim','plan','dataCap','contractDue','antenna','antennaPlace','backup','backupCarrier','backupSim','remoteReboot','autoReboot','provider'].map(k=>[k,v(k)]))};}
    else if(fm.id==='comm-log'){const last=fromLocal(v('lastReceivedAt')),lv=n('level');c.logs=[...c.logs,{id:uid(),siteId:id,at:fromLocal(v('at'))||new Date().toISOString(),lastReceivedAt:last,signal:n('signal'),level:lv,dataMB:n('dataMB'),source:'手入力',note:v('note')}];if(last)bumpLastReceived(s,last);}
    else if(fm.id==='comm-outage'){const oid=fm.dataset.id||uid(),old=c.outages.find(x=>x.id===oid),start=fromLocal(v('start')),end=fromLocal(v('end'));if(!start)throw Error('始まりを入れてください');if(end&&Date.parse(end)<Date.parse(start))throw Error('終わりは始まりより後にしてください');
     const rec={...(old||{}),id:oid,siteId:id,start,end,cause:v('cause')||'不明',action:v('action'),rebooted:fd.has('rebooted')};c.outages=[...c.outages.filter(x=>x.id!==oid),rec];
     if(rec.rebooted&&!c.reboots.some(x=>x.outageId===oid))c.reboots=[...c.reboots,{id:uid(),siteId:id,at:end||start,way:REBOOT_WAYS.includes(v('way'))?v('way'):'遠隔',note:'途切れの対処',outageId:oid}];}
    else if(fm.id==='comm-reboot'){c.reboots=[...c.reboots,{id:uid(),siteId:id,at:fromLocal(v('at'))||new Date().toISOString(),way:v('way'),note:v('note')}];}
   },'通信の記録');api.toast('保存しました');openSite(id);}catch(err){api.toast(err.message);}});}
export function setCommTab(t){view.tab=t;}
