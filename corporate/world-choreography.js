// Decoration coordinates only (0..100). No operational data or dates are used.
export const FRAME_ANCHORS=[[.53941,.88063],[.50903,.88964],[.48533,.87838],[.49324,.88964],[.54054,.82393],[.49210,.82393],[.46163,.82619],[.44820,.82844]];
const OFFICE=[60.5,59.5],APPROACH=[[60.5,59.5],[65,59],[73,60.5],[81,65]],CABINET=APPROACH.at(-1),PARK=[34,79],PARK_ROUTE=[PARK,[38,80],[40,81]],SECOND=[88,72];
const hold=(state,seconds,point)=>({state,seconds,path:[point]}),walk=(seconds,path)=>({state:'walk',seconds,path});
export const WORKERS=[
 {id:'worker-walk',offset:0,segments:[hold('idle',3,OFFICE),walk(5,APPROACH),hold('idle',1,CABINET),hold('check',4,CABINET),hold('crouch',3,CABINET),hold('idle',2,CABINET),walk(5,[...APPROACH].reverse()),hold('idle',3,OFFICE)]},
 {id:'worker-check',offset:9,segments:[hold('idle',22,SECOND),hold('check',5,SECOND),hold('idle',12,SECOND),hold('crouch',3,SECOND),hold('idle',11,SECOND)]},
 {id:'worker-delivery',offset:15,segments:[hold('idle',20,PARK),walk(3,PARK_ROUTE),hold('check',4,PARK_ROUTE.at(-1)),hold('idle',8,PARK_ROUTE.at(-1)),walk(3,[...PARK_ROUTE].reverse()),hold('idle',9,PARK)]}
];
export const OBSTACLES=[
 {name:'事務所・周囲の花壇',polygon:[[4,37],[49,28],[64,45],[60,56],[42,72],[8,55]]},
 {name:'中央の植栽',polygon:[[57,64],[64,64],[74,82],[73,94],[52,88],[50,78]]},
 {name:'設備の占有範囲',polygon:[[66,34],[99,52],[98,73],[92,70],[92,65],[66,51]]},
 {name:'手前のフェンス外側',polygon:[[0,91],[48,100],[100,83],[100,100],[0,100]]}
];
const modulo=(n,d)=>((n%d)+d)%d;
export const cycleLength=actor=>actor.segments.reduce((n,s)=>n+s.seconds,0);
function interpolate(path,fraction){if(path.length===1)return {x:path[0][0],y:path[0][1],direction:'right'};const lengths=path.slice(1).map((p,i)=>Math.hypot(p[0]-path[i][0],(p[1]-path[i][1])/2)),total=lengths.reduce((a,b)=>a+b,0);let remaining=Math.max(0,Math.min(1,fraction))*total;for(let i=0;i<lengths.length;i++){if(remaining<=lengths[i]||i===lengths.length-1){const t=lengths[i]?remaining/lengths[i]:0,a=path[i],b=path[i+1];return {x:a[0]+(b[0]-a[0])*t,y:a[1]+(b[1]-a[1])*t,direction:b[0]>=a[0]?'right':'left'};}remaining-=lengths[i];}}
export function sampleWorker(actor,seconds){let t=modulo(seconds+actor.offset,cycleLength(actor));for(const segment of actor.segments){if(t<segment.seconds){const pose=interpolate(segment.path,t/segment.seconds),state=segment.state;let frame=4;if(state==='walk')frame=(pose.direction==='left'?2:0)+Math.floor(t/.24)%2;else if(state==='check')frame=5+Math.floor(t/.8)%2;else if(state==='crouch')frame=7;return {id:actor.id,...pose,state,frame,anchor:FRAME_ANCHORS[frame],depth:Math.round(pose.y*10)};}t-=segment.seconds;}throw Error('Empty choreography');}
export const sampleWorkers=seconds=>WORKERS.map(actor=>sampleWorker(actor,seconds));
const ease=t=>t*t*(3-2*t);
export function sampleVan(seconds){const t=modulo(seconds,60);let progress=0,state='parked';if(t>=25&&t<29){progress=ease((t-25)/4);state='moving';}else if(t>=29&&t<41)progress=1;else if(t>=41&&t<45){progress=1-ease((t-41)/4);state='reversing';}return {x:17+progress*2,y:86+progress,state,depth:Math.round((86+progress)*10)};}
export function pointInPolygon(point,polygon){let inside=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const [xi,yi]=polygon[i],[xj,yj]=polygon[j];if((yi>point.y)!==(yj>point.y)&&point.x<(xj-xi)*(point.y-yi)/(yj-yi)+xi)inside=!inside;}return inside;}
