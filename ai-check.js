import {seed,jstDay,freshness,confirmationState} from './core.js';
import {defaultTravel,travelEstimate} from './travel.js';
const iso=t=>Number.isFinite(Date.parse(t))?new Date(t).toISOString():null;
const validVisit=v=>v&&/^\d{4}-\d{2}-\d{2}$/.test(v.date)&&/^([01]\d|2[0-3]):[0-5]\d$/.test(v.start)&&Number.isFinite(v.durationMinutes)&&v.durationMinutes>0&&v.durationMinutes<=1440;
const numeric=v=>v!==null&&v!==undefined&&String(v).trim()!==''&&Number.isFinite(Number(v));
const source=s=>/サンプル/.test(s||'')?'サンプル':/写真/.test(s||'')?'写真確認・手入力':/手入力/.test(s||'')?'手入力':'取得方法不明';
const context=s=>s.operatingContext;
const validContext=x=>x&&['group','mode','batteryType'].every(k=>typeof x[k]==='string'&&x[k].trim())&&typeof x.socTarget==='number'&&x.socTarget>=0&&x.socTarget<=100;
function comparable(a,b){const x=context(a),y=context(b);return validContext(x)&&validContext(y)&&source(a.metrics.soc.source)!=='取得方法不明'&&['group','mode','batteryType','socTarget'].every(k=>x[k]!==undefined&&x[k]===y[k])&&a.battery===b.battery&&source(a.metrics.soc.source)===source(b.metrics.soc.source)&&Math.abs(Date.parse(a.metrics.soc.at)-Date.parse(b.metrics.soc.at))<=300000;}
export function buildCheckPayload(state){
 // Strict allowlist: no names, addresses, coordinates, notes, image bytes or URLs.
 return {schemaVersion:1,sites:state.sites.map((s,i)=>({ref:`site-${i+1}`,batteryKWh:s.battery,due:/^\d{4}-\d{2}-\d{2}$/.test(s.due)?s.due:null,metrics:Object.fromEntries(['soc','temp','power'].map(k=>[k,{value:numeric(s.metrics[k]?.value)?Number(s.metrics[k].value):null,at:iso(s.metrics[k]?.at),source:source(s.metrics[k]?.source)}])),issues:s.issues.map(i=>({severity:['要対応','要確認'].includes(i.severity)?i.severity:'不明',status:['未対応','確認中','完了'].includes(i.status)?i.status:'不明',createdAt:iso(i.createdAt),updatedAt:iso(i.updatedAt),communicationMention:/通信|未更新/.test(i.title)})),records:s.history.map(h=>({at:iso(h.at),kind:['定期点検','臨時点検','修繕・交換','数値確認','対応記録'].includes(h.kind)?h.kind:'その他',source:source(h.method),notePresent:!!h.note?.trim(),photoPresent:!!h.photo,confirmed:typeof h.confirmed==='boolean'?h.confirmed:null,readings:Object.fromEntries(['soc','temp','power'].filter(k=>numeric(h.readings?.[k])).map(k=>[k,Number(h.readings[k])]))})),visit:s.visit&&/^\d{4}-\d{2}-\d{2}$/.test(s.visit.date)&&/^([01]\d|2[0-3]):[0-5]\d$/.test(s.visit.start)&&Number.isFinite(s.visit.durationMinutes)&&s.visit.durationMinutes>0?{date:s.visit.date,start:s.visit.start,durationMinutes:s.visit.durationMinutes}:null}))};
}
export function checkAge(result,state,now=Date.now()){
 if(!result)return '未実行';if(result.mode==='current'&&result.snapshot!==JSON.stringify(state))return '対象データが変更されています。再チェックが必要です。';
 if(result.nextExpiryAt&&now>=result.nextExpiryAt)return '対象データの鮮度が変わりました。再チェックが必要です。';
 if(now-result.checkedAt>=30*60000||jstDay(new Date(now))!==jstDay(new Date(result.checkedAt)))return 'チェックから時間が経過しています。再チェックが必要です。';
 return 'チェック時点の結果です。自動監視はしていません。';
}
export function runLocalCheck(state,{now=Date.now(),mode='current'}={}){
 const today=jstDay(new Date(now)),items=[],limitations=[],add=(s,priority,title,evidence,next,missing=[],hypothesis=[])=>items.push({siteId:s.id,siteName:s.name,priority,title,evidence,next,missing,hypothesis,kind:'固定ルール'});

 for(const s of state.sites){
 const open=s.issues.filter(i=>i.status!=='完了');
 if(s.battery){for(const [k,label,unit] of [['temp','電池温度','°C'],['soc','SOC','%'],['power','充放電電力','kW']]){const m=s.metrics[k],limits=k==='soc'?[0,100]:k==='temp'?[-40,100]:[-10000,10000],f=freshness(m,now)==='取得済'&&(Number(m.value)<limits[0]||Number(m.value)>limits[1])?'範囲外・値を確認':freshness(m,now);if(f!=='取得済')add(s,f==='古いデータ'?1:2,`${label}：${f}`,[{text:`${numeric(m?.value)?m.value+' '+unit:'値なし'} / ${f}`,at:m?.at,source:m?.source||'未取得'}],['現地表示と取得時刻を確認','通信・収集処理の状態を確認'],['現在の値、機器側時刻、受信時刻、通信ログ'],f==='古いデータ'?['通信経路・収集処理の停止、機器側時刻のずれが候補。設備停止とは断定できません。']:[]);}
 const m=s.metrics.temp;
 if(freshness(m,now)==='取得済'&&Number(m.value)>=-40&&Number(m.value)<=100){
 const prior=s.history.filter(h=>(h.confirmed===undefined||confirmationState(h)==='confirmed')&&numeric(h.readings?.temp)&&Number(h.readings.temp)>=-40&&Number(h.readings.temp)<=100&&iso(h.at)&&Date.parse(h.at)<Date.parse(m.at)&&Date.parse(m.at)-Date.parse(h.at)<=3600000&&source(h.method)===source(m.source)).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at))[0];
 if(prior&&Number(m.value)-Number(prior.readings.temp)>=5)add(s,1,'電池温度の上昇を確認',[{text:`前回 ${prior.readings.temp} °C`,at:prior.at,source:prior.method},{text:`今回 ${m.value} °C（差 +${(m.value-prior.readings.temp).toFixed(1)} °C）`,at:m.at,source:m.source}],['同一機器・測定点の値か確認','運転負荷、周囲温度、通風条件とメーカー基準を確認'],['測定点・運転負荷・メーカーの許容温度'],['負荷変動、周囲温度、通風条件、測定誤差が候補。過熱故障とは断定しません。']);
 else if(!prior)limitations.push(`${s.name}：1時間以内・同じ取得区分の過去温度がなく、温度上昇の傾向は判断できません。`);
 }
 const peers=state.sites.filter(t=>t.id!==s.id&&t.battery&&comparable(s,t)&&freshness(t.metrics.soc,now)==='取得済'&&Number(t.metrics.soc.value)>=0&&Number(t.metrics.soc.value)<=100);
 if(freshness(s.metrics.soc,now)==='取得済'&&Number(s.metrics.soc.value)>=0&&Number(s.metrics.soc.value)<=100&&peers.length){const mean=peers.reduce((n,t)=>n+Number(t.metrics.soc.value),0)/peers.length;if(Math.abs(Number(s.metrics.soc.value)-mean)>=20)add(s,2,'条件をそろえたSOCの差を確認',[{text:`SOC ${s.metrics.soc.value} % / 同条件${peers.length}拠点の平均 ${mean.toFixed(1)} %`,at:s.metrics.soc.at,source:s.metrics.soc.source},...peers.map(t=>({text:`比較先 ${t.name}：${t.metrics.soc.value} %`,at:t.metrics.soc.at,source:t.metrics.soc.source}))],['運転条件・目標SOC・容量・取得時刻が実際にも一致するか確認','充放電指令とメーカー資料を確認'],['制御履歴・SOC推定方式・警報履歴'],['制御指令やSOC推定の差が候補。故障の断定はできません。']);}
 else limitations.push(`${s.name}：SOC比較には同じ運転グループ・モード・電池型式・容量・目標SOCと、5分以内の取得時刻が必要です。条件不足または欠測のため単純比較しません。`);
 }
 if(s.due<today)add(s,1,'点検期限超過・実施状況を確認',[{text:`次回点検日 ${s.due}`,at:null,source:'手動の点検予定'},{text:`保存済み記録 ${s.history.length}件`,at:s.history[0]?.at,source:s.history[0]?.method||'記録なし'}],['点検が実施済みか記録と担当状況を確認','未実施なら日程を調整、実施済みなら記録と次回日を確認'],['予定に対応する実施完了記録。期限超過だけで点検漏れとは断定しません。']);
 else if(s.due===today)add(s,2,'本日が点検予定日',[{text:`次回点検日 ${s.due}`,at:null,source:'手動の点検予定'}],['訪問と実施予定を確認']);
 for(const i of open){add(s,i.severity==='要対応'?1:2,/通信/.test(i.title)?'通信に関する未完了の不具合':'不具合の対応状況を確認',[{text:`${i.title} / ${i.severity} / ${i.status}`,at:i.updatedAt||i.createdAt,source:'登録された不具合'}],['現在の表示・警報と対応担当を確認','不具合に紐づく対応記録とメーカー資料を確認'],['メーカーの該当手順、警報コード、不具合と対応記録の紐付け'],/通信/.test(i.title)?['通信経路、ゲートウェイ、収集処理が候補。機器の停止とは断定できません。']:[]);}
 for(const h of s.history){
 if(!h.note?.trim()&&['定期点検','臨時点検','修繕・交換'].includes(h.kind))add(s,3,'点検記録のメモが未記入',[{text:`${h.kind} / メモなし`,at:h.at,source:h.method}],['必須の点検項目と実施内容を確認して補記'],['正式な点検表・必須項目の定義']);
 if(h.photo&&Object.keys(h.readings||{}).length&&confirmationState(h)==='pending')add(s,1,'写真の読取候補が未確認',[{text:`写真付き数値 / 確認フラグ false（確定値として扱いません）`,at:h.at,source:h.method}],['原写真と数値・単位・測定日時・対象機器を人が照合']);
 else if(h.photo&&Object.keys(h.readings||{}).length&&confirmationState(h)==='unknown')limitations.push(`${s.name}：${h.at}の写真付き記録は確認フラグ未記録または形式不正。未確認とは断定できないため人による確認が必要です。`);
 }

 }
 const dated=new Map();for(const s of state.sites){const d=validVisit(s.visit)?s.visit.date:s.due;if(!dated.has(d))dated.set(d,[]);dated.get(d).push(s);}
 for(const [date,sites] of dated){if(date<today)continue;if(sites.length>1&&sites.some(s=>!validVisit(s.visit)))limitations.push(`${date}：${sites.length}拠点の予定がありますが、作業開始時刻・所要時間が不足しています。予定重複や移動の可否は判断できません。`);const scheduled=sites.filter(s=>validVisit(s.visit)).sort((a,b)=>a.visit.start.localeCompare(b.visit.start));for(let i=1;i<scheduled.length;i++){const a=scheduled[i-1],b=scheduled[i],minutes=t=>{const [h,m]=t.split(':').map(Number);return h*60+m;},gap=minutes(b.visit.start)-minutes(a.visit.start)-a.visit.durationMinutes,trip=travelEstimate({...defaultTravel,lat:a.lat,lon:a.lon,departure:a.visit.start},b);if(!trip)limitations.push(`${date} ${a.name} → ${b.name}：現場座標が不足・不正のため移動時間を計算できません。`);if(gap<0||trip&&gap<trip.minutes)add(b,1,gap<0?'作業予定時間が重複':'移動を含めると予定に余裕が不足',[{text:`${date} ${a.name} ${a.visit.start}開始・${a.visit.durationMinutes}分 → ${b.name} ${b.visit.start}開始 / 空き${gap}分`,at:null,source:'登録された訪問予定'},...(trip?[{text:`拠点間 約${trip.distance.toFixed(1)}km・約${trip.minutes}分（直線×1.4、35km/h）`,at:null,source:'固定条件の概算'}]:[])],['実道路の所要時間と作業時間を確認','訪問順・開始時刻を人が調整'],['実道路・交通状況・作業延長の見込み']);}}
 for(const [date,sites] of dated){if(date<today)continue;const visits=sites.filter(s=>validVisit(s.visit)).sort((a,b)=>a.visit.start.localeCompare(b.visit.start)),minute=t=>{const [h,m]=t.split(':').map(Number);return h*60+m;};for(let i=0;i<visits.length;i++)for(let j=i+2;j<visits.length;j++){const a=visits[i],b=visits[j];if(minute(a.visit.start)+a.visit.durationMinutes>minute(b.visit.start))add(b,1,'作業予定時間が重複',[{text:`${date} ${a.name} ${a.visit.start}開始・${a.visit.durationMinutes}分 → ${b.name} ${b.visit.start}開始（間に別の予定あり）`,at:null,source:'登録された訪問予定'}],['開始時刻と作業時間を確認','担当者・日程を人が調整']);}}
 if(!state.sites.some(s=>validVisit(s.visit)))limitations.push('訪問の開始時刻・作業所要時間が未登録です。点検日と自宅からの到着目安だけでは予定重複・連続巡回の可否を判断しません。');
 limitations.push('メーカー資料・警報基準・点検表は未登録です。原因の確定、設備正常、不具合解消、点検完了の判定は行いません。','写真そのものは解析していません。未保存の読取候補はチェック対象外です。過去記録の数値差は同一機器・測定点・取得区分が確認できる範囲に限ります。');
 const differences=state.sites.flatMap(s=>['soc','temp','power'].flatMap(key=>{const records=s.history.filter(h=>(h.confirmed===undefined||confirmationState(h)==='confirmed')&&numeric(h.readings?.[key])&&iso(h.at)).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at));const [latest,previous]=records;if(!latest||!previous||source(latest.method)==='取得方法不明'||source(latest.method)!==source(previous.method))return [];return [{siteName:s.name,key,latest:{value:Number(latest.readings[key]),at:latest.at,source:latest.method},previous:{value:Number(previous.readings[key]),at:previous.at,source:previous.method},delta:Number(latest.readings[key])-Number(previous.readings[key])}];}));
 const expiries=state.sites.flatMap(s=>Object.values(s.metrics).filter(m=>freshness(m,now)==='取得済').map(m=>Date.parse(m.at)+30*60000+1)).filter(t=>t>now);
 return {nextExpiryAt:expiries.length?Math.min(...expiries):null,differences,checkedAt:now,mode,snapshot:JSON.stringify(state),ruleVersion:'local-v1',items:items.sort((a,b)=>a.priority-b.priority||a.siteName.localeCompare(b.siteName)),limitations:[...new Set(limitations)],payload:buildCheckPayload(state),cases:state.sites.flatMap(s=>s.history.filter(h=>h.kind==='修繕・交換').map(h=>({siteId:s.id,siteName:s.name,at:h.at,note:h.note,method:h.method}))),siteCount:state.sites.length,dataTimes:state.sites.flatMap(s=>Object.values(s.metrics).map(m=>iso(m.at))).filter(Boolean)};
}
export function demoCheckState(now=Date.now()){
 const state=seed(now),a=state.sites[0],b=state.sites[4],c=state.sites[2],today=jstDay(new Date(now)),at=n=>new Date(now-n*60000).toISOString();
 a.metrics.temp={value:36,at:at(2),source:'サンプル温度'};a.history.unshift({id:'demo-previous',at:at(32),kind:'数値確認',method:'サンプル温度',note:'同一測定点を想定した検知例',readings:{temp:28}});
 a.history.unshift({id:'demo-case',at:at(1440),kind:'修繕・交換',method:'サンプル',note:'架空事例：通信状態を保守担当と確認し、ケーブルを点検。今回の原因との関連は未確認。'});
 b.due=today;b.history.unshift({id:'demo-unconfirmed',at:at(5),kind:'定期点検',method:'サンプル読取候補',note:'',photo:'sample-meter.svg',readings:{soc:90},confirmed:false});
 a.visit={date:today,start:'09:00',durationMinutes:60};b.visit={date:today,start:'09:30',durationMinutes:30};c.visit={date:today,start:'10:05',durationMinutes:40};
 for(const [s,value] of [[a,40],[c,85]]){s.operatingContext={group:'demo',mode:'待機',batteryType:'架空共通型式',socTarget:70};s.metrics.soc={value,at:at(2),source:'サンプル（EMS未接続）'};}
 return state;
}
