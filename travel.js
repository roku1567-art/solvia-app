// The initial location is a neighborhood representative point, not a home geocode.
export const defaultTravel={label:'出発地（福島駅・見本）',lat:37.7544,lon:140.4596,departure:'08:00',speed:35,factor:1.4};
export function validTravel(s){return s&&typeof s.label==='string'&&s.label.trim().length>0&&s.label.length<=160&&Number.isFinite(s.lat)&&s.lat>=-90&&s.lat<=90&&Number.isFinite(s.lon)&&s.lon>=-180&&s.lon<=180&&/^([01]\d|2[0-3]):[0-5]\d$/.test(s.departure)&&Number.isFinite(s.speed)&&s.speed>=5&&s.speed<=100&&Number.isFinite(s.factor)&&s.factor>=1&&s.factor<=3;}
export function travelEstimate(origin,destination){
 if(!validTravel(origin)||!Number.isFinite(destination.lat)||!Number.isFinite(destination.lon)||Math.abs(destination.lat)>90||Math.abs(destination.lon)>180)return null;
 const r=Math.PI/180,a=(destination.lat-origin.lat)*r,b=(destination.lon-origin.lon)*r,h=Math.sin(a/2)**2+Math.cos(origin.lat*r)*Math.cos(destination.lat*r)*Math.sin(b/2)**2;
 const straight=6371*2*Math.asin(Math.sqrt(Math.min(1,h))),distance=straight*origin.factor,minutes=Math.ceil(distance/origin.speed*60/5)*5,[hour,minute]=origin.departure.split(':').map(Number),arrival=hour*60+minute+minutes;
 return {distance,minutes,time:`${String(Math.floor(arrival/60)%24).padStart(2,'0')}:${String(arrival%60).padStart(2,'0')}`,dayOffset:Math.floor(arrival/1440)};
}
