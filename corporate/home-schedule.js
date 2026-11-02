// 本部の黒板：本日・今週・今月の予定の件数と、小さな月のカレンダー。共通カレンダーと同じ予定（eventsFor）を数える。
// 数えるのは日付のある未完了の予定。済んだ予定だけの日は「・」で分ける。
const pad=n=>String(n).padStart(2,'0');
const iso=dt=>`${dt.getUTCFullYear()}-${pad(dt.getUTCMonth()+1)}-${pad(dt.getUTCDate())}`;
const at=s=>new Date(s+'T00:00:00Z');
export function weekRange(today){const t=at(today),start=new Date(t);start.setUTCDate(t.getUTCDate()-t.getUTCDay());const end=new Date(start);end.setUTCDate(start.getUTCDate()+6);return [iso(start),iso(end)];}
export function scheduleCounts(events,today){const open=events.filter(e=>!e.done&&/^\d{4}-\d{2}-\d{2}$/.test(e.date||'')),[ws,we]=weekRange(today),m=today.slice(0,7);
  return {today:open.filter(e=>e.date===today).length,week:open.filter(e=>e.date>=ws&&e.date<=we).length,month:open.filter(e=>e.date.slice(0,7)===m).length,undated:events.filter(e=>!e.done&&!e.date).length};}
// 屋上のパネル：今週の日曜から5週間（35日）。1段目がいつも今週。月をまたいでも続けて並べる。
// 各日：ev（未完了の予定あり）、today、past（今週の過ぎた日）、nx（今月より後の月）。数字は今日だけ画面に出す。
export function rollingWeeks(events,today){const [start]=weekRange(today),open=new Set(events.filter(e=>!e.done&&e.date).map(e=>e.date)),m=today.slice(0,7),cells=[];
  for(let k=0;k<35;k++){const dt=at(start);dt.setUTCDate(dt.getUTCDate()+k);const date=iso(dt);cells.push({date,n:dt.getUTCDate(),ev:open.has(date),today:date===today,past:date<today,nx:date.slice(0,7)>m});}
  const later=cells.find(c=>c.nx);return {cells,nextMonth:later?Number(later.date.slice(5,7)):null,end:cells.at(-1).date};}
// 次の予定まであと何日（今日に予定があれば 0）。予定がなければ null。
export function daysToNext(events,today){const d=events.filter(e=>!e.done&&/^\d{4}-\d{2}-\d{2}$/.test(e.date||'')&&e.date>=today).map(e=>e.date).sort()[0];return d?Math.round((at(d)-at(today))/86400000):null;}

// 点検する日の計画のうち、まだ予定に入れていない下書きも、本部の黒板・屋上のパネル・カレンダーに「点検する日」として出す。
// 予定に入れた計画は、作った点検予定のほうで数える（二重に数えない）。
export function draftPlanEvents(d){return (d.dayPlans||[]).filter(p=>!p.confirmedAt).map(p=>({id:p.id,source:'dayPlans',title:`点検する日（下書き・${(p.stops||[]).length}か所）`,date:p.date,time:p.departure||'',kind:'点検日',timing:'時刻付き',note:'',done:false}));}
