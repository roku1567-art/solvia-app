export const jstDay=(date=new Date())=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
export function freshness(metric, now=Date.now(), maxAge=30*60000){
 if(!metric || metric.value===null || metric.value===undefined || metric.value==='' || !Number.isFinite(Number(metric.value)))return '未取得';
 const time=Date.parse(metric.at); if(!Number.isFinite(time)||time>now+60000)return '時刻不明';
 return now-time>maxAge?'古いデータ':'取得済';
}
export function priority(site,today=jstDay()){
 if(site.issues.some(i=>i.status!=='完了'&&i.severity==='要対応'))return {label:'要対応',rank:0,tone:'red'};
 if(site.due<today)return {label:'期限超過',rank:1,tone:'red'};
 if(site.issues.some(i=>i.status!=='完了'))return {label:'要確認',rank:2,tone:'amber'};
 if(site.due<=new Date(Date.parse(today+'T00:00:00Z')+7*86400000).toISOString().slice(0,10))return {label:'点検間近',rank:3,tone:'amber'};
 return {label:'予定内',rank:4,tone:'green'};
}
export function ordered(sites,today){return [...sites].sort((a,b)=>priority(a,today).rank-priority(b,today).rank||a.due.localeCompare(b.due));}
export function validReading(value,min,max){return String(value).trim()!==''&&Number.isFinite(Number(value))&&Number(value)>=min&&Number(value)<=max;}
export const fields=[['soc','SOC','%',0,100],['temp','電池温度','°C',-40,100],['power','充放電電力','kW',-10000,10000]];
export function seed(now=Date.now()){
 const day=jstDay(new Date(now)); const due=n=>new Date(Date.parse(day+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
 const info=[['松川・南','福島市','太陽光＋蓄電池',37.657,140.470,49.5,215,-1,'要対応','PCS通信断','未対応',54],['飯坂・東','福島市','太陽光',37.825,140.451,49.5,0,1,'要確認','集電箱の変色を再確認','確認中',null],['本宮・高木','本宮市','太陽光＋蓄電池',37.522,140.403,49.5,215,3,'','','',78],['二本松・杉田','二本松市','太陽光',37.574,140.419,49.5,0,5,'','','',null],['伊達・保原','伊達市','太陽光＋蓄電池',37.815,140.557,49.5,215,15,'','','',66],['郡山・西田','郡山市','太陽光＋蓄電池',37.443,140.442,49.5,430,20,'要確認','電池温度の記録を確認','未対応',null],['須賀川・北','須賀川市','太陽光',37.310,140.371,49.5,0,22,'','','',null],['白河・東','白河市','太陽光＋蓄電池',37.133,140.280,49.5,215,28,'','','',82]];
 return {version:1,sites:info.map((a,i)=>({id:'ND-'+String(i+1).padStart(3,'0'),name:a[0],city:a[1],type:a[2],lat:a[3],lon:a[4],pv:a[5],battery:a[6],due:due(a[7]),issues:a[8]?[{id:'issue-'+i,severity:a[8],title:a[9],status:a[10],createdAt:new Date(now).toISOString()}]:[],metrics:{soc:{value:a[11],at:a[11]===null?null:new Date(now-(i===4?180:8)*60000).toISOString(),source:'サンプル（EMS未接続）'},temp:{value:a[6]?26.4+i*.3:null,at:new Date(now-8*60000).toISOString(),source:'サンプル（BMS未接続）'},power:{value:a[6]?-18.2+i:null,at:new Date(now-8*60000).toISOString(),source:'サンプル（EMS未接続）'}},history:[{id:'log-'+i,at:new Date(now-(i+1)*86400000).toISOString(),kind:'定期点検',note:'サンプル記録：外観・接続部を確認。',method:'サンプル',photo:null}],weather:{at:new Date(now-10*60000).toISOString(),source:'サンプル気象',temp:17.2-i*.4,humidity:62+i,rain:i===5?1.5:0,wind:2.4+i*.2}}))};
}

export function reportRecords(sites,from,to){return sites.flatMap(s=>s.history.map(h=>({site:s,record:h}))).filter(({record:h})=>{const n=Date.parse(h.at);if(!Number.isFinite(n))return false;const d=jstDay(new Date(n));return (!from||d>=from)&&(!to||d<=to);}).sort((a,b)=>b.record.at.localeCompare(a.record.at));}
export function csvCell(value){let s=String(value??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}
export function confirmationState(record){return record?.confirmed===true?'confirmed':record?.confirmed===false?'pending':'unknown';}
export function validBackup(data){
 const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
 const date=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
 const time=s=>typeof s==='string'&&Number.isFinite(Date.parse(s));
 const photo=p=>p===undefined||p===null||p===''||typeof p==='string'&&(p==='sample-meter.svg'||/^data:image\/(?:jpeg|png|webp);base64,/.test(p));
 const record=h=>object(h)&&typeof h.id==='string'&&typeof h.kind==='string'&&typeof h.note==='string'&&typeof h.method==='string'&&time(h.at)&&photo(h.photo)
  &&(h.confirmed===undefined||typeof h.confirmed==='boolean')
  &&(h.confirmedAt===undefined||h.confirmed===true&&time(h.confirmedAt))
  &&(h.readings===undefined||h.readings===null||object(h.readings)&&Object.entries(h.readings).every(([k,v])=>fields.some(f=>f[0]===k&&validReading(v,f[3],f[4]))));
 const issue=i=>object(i)&&typeof i.id==='string'&&typeof i.title==='string'&&['要対応','要確認'].includes(i.severity)&&['未対応','確認中','完了'].includes(i.status)&&time(i.createdAt);
 const site=s=>object(s)&&typeof s.id==='string'&&s.id.length>0&&typeof s.name==='string'&&typeof s.city==='string'&&typeof s.type==='string'&&date(s.due)
  &&[s.pv,s.battery,s.lat,s.lon].every(Number.isFinite)&&s.pv>0&&s.battery>=0&&s.lat>=-90&&s.lat<=90&&s.lon>=-180&&s.lon<=180
  &&Array.isArray(s.issues)&&s.issues.every(issue)&&Array.isArray(s.history)&&s.history.every(record)
  &&object(s.metrics)&&fields.every(([k,,,min,max])=>{const m=s.metrics[k];return object(m)&&(m.value===null||validReading(m.value,min,max))&&(m.at===null||time(m.at))&&typeof m.source==='string';})
  &&(s.weather===null||object(s.weather)&&[s.weather.temp,s.weather.humidity,s.weather.rain,s.weather.wind].every(Number.isFinite)&&time(s.weather.at)&&typeof s.weather.source==='string');
 try{return object(data)&&data.version===1&&Array.isArray(data.sites)&&data.sites.length<=2000&&data.sites.every(site)&&new Set(data.sites.map(s=>s.id)).size===data.sites.length;}catch{return false;}
}
