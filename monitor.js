import {freshness,priority} from './core.js';
export function monitoringState(site,now=Date.now()){
 const p=priority(site);if(site.issues.some(i=>i.status!=='完了'&&i.severity==='要対応'))return {label:'要対応',tone:'red',reason:site.issues.find(i=>i.status!=='完了'&&i.severity==='要対応').title};
 if(site.battery){const quality=Object.values(site.metrics).map(m=>freshness(m,now));if(quality.includes('古いデータ'))return {label:'データ未更新',tone:'amber',reason:'30分を超えた数値があります。現在状態は不明です。'};if(quality.includes('未取得')||quality.includes('時刻不明'))return {label:'取得を確認',tone:'gray',reason:'未取得・時刻不明の数値があります。'};}
 if(p.rank<4)return {label:p.label,tone:p.tone,reason:site.issues.find(i=>i.status!=='完了')?.title||'点検予定を確認してください。'};
 return {label:'稼働未判定',tone:'gray',reason:'運転状態・警報は未取得。設備の正常判定はしていません。'};
}
const demo={soc:[72,71,70,69,68,66,65,64,63,65,69,74,79,83,85,84,82,79,75,72,69,67,65,64],temp:[24,24,23,23,23,24,24,25,26,27,28,29,30,31,31,30,29,28,27,26,26,25,25,24]};
export function trendChart(kind='soc'){
 const values=demo[kind]||demo.soc,max=kind==='temp'?40:100,unit=kind==='temp'?'°C':'%',x=i=>40+i*660/23,y=v=>164-v/max*136,points=values.map((v,i)=>`${x(i)},${y(v)}`).join(' ');
 return `<svg viewBox="0 0 730 200" role="img" aria-label="${kind==='temp'?'電池温度':'SOC'}の固定デモ波形。現場の実測履歴ではありません"><defs><linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#58a68f" stop-opacity=".24"/><stop offset="1" stop-color="#58a68f" stop-opacity="0"/></linearGradient></defs>${[0,1,2,3,4].map(i=>{const v=max*i/4;return `<line x1="40" x2="700" y1="${y(v)}" y2="${y(v)}" stroke="#dce4e1"/><text x="30" y="${y(v)+4}" text-anchor="end" fill="#72837e" font-size="10">${v}</text>`}).join('')}<polygon points="40,164 ${points} 700,164" fill="url(#trend-fill)"/><polyline points="${points}" fill="none" stroke="#328b76" stroke-width="2.5"/>${[0,6,12,18,23].map(i=>`<text x="${x(i)}" y="186" text-anchor="middle" font-size="10" fill="#72837e">${i}:00</text>`).join('')}<text x="40" y="14" font-size="10" fill="#72837e">${unit} / 固定サンプル</text></svg>`;
}
