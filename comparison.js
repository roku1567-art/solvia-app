import {freshness} from './core.js';
export const comparisonFields=[{key:'soc',label:'SOC',unit:'%',battery:true,min:0,max:100},{key:'temp',label:'電池温度',unit:'°C',battery:true,min:-40,max:100},{key:'power',label:'充放電電力',unit:'kW',battery:true,min:-10000,max:10000},{key:'ambient',weather:'temp',label:'気温',unit:'°C',min:-80,max:80},{key:'humidity',weather:'humidity',label:'湿度',unit:'%',min:0,max:100},{key:'rain',weather:'rain',label:'1時間降水量',unit:'mm',min:0,max:2000},{key:'wind',weather:'wind',label:'風速',unit:'m/s',min:0,max:200}];
export function comparisonReading(site,field,kind='sample',now=Date.now()){
 if(field.battery&&!site.battery)return {value:null,eligible:false,status:'対象外',source:'',at:null};
 const m=field.weather?{value:site.weather?.[field.weather],at:site.weather?.at,source:site.weather?.source}:site.metrics[field.key];
 const source=m?.source||'未取得',sample=/サンプル/.test(source),has=m&&m.value!==null&&m.value!==undefined&&m.value!==''&&Number.isFinite(Number(m.value));
 if(has&&sample!==(kind==='sample'))return {value:null,eligible:false,status:sample?'サンプル（対象外）':'実記録（対象外）',source,at:m?.at};
 const status=freshness(m,now),value=has?Number(m.value):null,range=value!==null&&value>=field.min&&value<=field.max;
 return {value,eligible:status==='取得済'&&range,status:status==='取得済'&&!range?'範囲を確認':status,source,at:m?.at};
}
export function comparisonStats(sites,field,kind='sample',now=Date.now()){
 const values=sites.map(s=>comparisonReading(s,field,kind,now)).filter(m=>m.eligible).map(m=>m.value),n=values.length;
 return {count:n,total:sites.length,mean:n?values.reduce((a,b)=>a+b,0)/n:null,min:n?Math.min(...values):null,max:n?Math.max(...values):null};
}
export function aboveAverage(reading,stats){return reading.eligible&&stats.count>=2&&Math.round(reading.value*10)>Math.round(stats.mean*10);}
export function sortComparison(sites,field,kind='sample',direction='desc',now=Date.now()){
 return [...sites].sort((a,b)=>{const x=comparisonReading(a,field,kind,now),y=comparisonReading(b,field,kind,now);if(x.eligible!==y.eligible)return x.eligible?-1:1;return x.eligible?(x.value-y.value)*(direction==='asc'?1:-1):a.id.localeCompare(b.id);});
}
