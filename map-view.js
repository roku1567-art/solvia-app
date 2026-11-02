export const NAKADORI_BOUNDS=[[37.08,140.13],[37.90,140.65]];
export function regionalBounds(){return NAKADORI_BOUNDS.map(p=>[...p]);}
export function setupMap({onSite=()=>{}}={}){
 const root=document.querySelector('#map'),panel=document.querySelector('.map-panel'),toggle=document.querySelector('#map-expand'),dialog=document.querySelector('#map-fullscreen'),home=document.createComment('map home');
 panel.before(home);const L=window.L;
 if(!L){root.textContent='地図を起動できませんでした。ページを再読み込みしてください。';return {render(){}};}
 const map=L.map(root,{zoomControl:false,scrollWheelZoom:true,minZoom:7,maxZoom:18,zoomSnap:.25});
 const tiles=L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png',{maxZoom:18,opacity:.4,className:'muted-basemap',attribution:'<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">地理院タイル</a>'}).addTo(map);
 const background=document.querySelector('#map-background');let backgroundVisible=true;
 background.onclick=()=>{backgroundVisible=!backgroundVisible;tiles.setOpacity(backgroundVisible ? 0.4 : 0);background.textContent=backgroundVisible?'背景を隠す':'背景を表示';background.setAttribute('aria-pressed',String(!backgroundVisible));};
 const markers=L.layerGroup().addTo(map);let initialized=false,previousOverflow='',hadError=false;
 const listToggle=document.querySelector('#map-list-toggle'),listPanel=document.querySelector('#map-site-panel'),list=document.querySelector('#map-site-list'),search=document.querySelector('#map-site-search');
 let listOpen=!matchMedia('(max-width:760px)').matches,sitesCache=[],priorityFn=null,escapeFn=null,selectedSite=null;
 function showList(open){listOpen=open;panel.classList.toggle('site-list-open',open);listPanel.hidden=!open;listToggle.setAttribute('aria-expanded',String(open));requestAnimationFrame(()=>map.invalidateSize({pan:false}));}
 listToggle.onclick=()=>showList(!listOpen);document.querySelector('#map-list-close').onclick=()=>{showList(false);listToggle.focus();};
 function renderList(){if(!priorityFn)return;const focused=list.contains(document.activeElement)?document.activeElement.dataset.mapSite:null,scroll=list.scrollTop;const q=search.value.trim().toLocaleLowerCase(),shown=sitesCache.filter(s=>`${s.name} ${s.city} ${s.id}`.toLocaleLowerCase().includes(q));document.querySelector('#map-list-count').textContent=`${shown.length} / ${sitesCache.length}`;list.innerHTML=shown.map(s=>{const p=priorityFn(s);return `<button class="map-list-item ${s.id===selectedSite?'is-selected':''}" data-map-site="${escapeFn(s.id)}" aria-pressed="${s.id===selectedSite}"><span class="map-list-name">${escapeFn(s.name)}<span class="pill ${p.tone}">${p.label}</span></span><small>${escapeFn(s.city)} · ${escapeFn(s.id)}</small></button>`;}).join('')||'<p class="map-list-empty">該当する拠点はありません</p>';list.scrollTop=scroll;if(focused)[...list.querySelectorAll('[data-map-site]')].find(b=>b.dataset.mapSite===focused)?.focus({preventScroll:true});}
 function selectSite(id){const site=sitesCache.find(s=>s.id===id);if(!site)return;selectedSite=id;map.setView([site.lat,site.lon],Math.max(map.getZoom(),12),{animate:false});renderList();root.querySelectorAll('.geo-site').forEach(b=>b.classList.toggle('is-selected',b.dataset.site===id));onSite(id);}
 list.addEventListener('click',e=>{const b=e.target.closest('[data-map-site]');if(b)selectSite(b.dataset.mapSite);});search.addEventListener('input',renderList);showList(listOpen);
 const status=document.querySelector('#map-network');
 tiles.on('tileerror',()=>{hadError=true;status.hidden=false;});
 tiles.on('loading',()=>{hadError=false;});tiles.on('load',()=>{if(!hadError)status.hidden=true;});
 document.querySelector('#map-retry').onclick=()=>{status.hidden=true;tiles.redraw();};
 function scale(){document.querySelector('#map-scale').textContent=`z${map.getZoom().toFixed(1)}`;}
 function fit(){map.invalidateSize({pan:false});map.fitBounds(regionalBounds(),{padding:[26,26],animate:false});scale();}
 map.on('zoomend',scale);document.querySelector('#map-in').onclick=()=>map.zoomIn();document.querySelector('#map-out').onclick=()=>map.zoomOut();document.querySelector('#map-reset').onclick=fit;
 function resize(){map.invalidateSize({pan:false});if(initialized)fit();}
 const observer=new ResizeObserver(()=>{map.invalidateSize({pan:false});});observer.observe(root);
 toggle.onclick=()=>{if(dialog.open){dialog.close();return;}previousOverflow=document.body.style.overflow;dialog.append(panel);dialog.showModal();document.body.style.overflow='hidden';toggle.textContent='× 地図を閉じる';toggle.setAttribute('aria-expanded','true');requestAnimationFrame(resize);toggle.focus();};
 dialog.addEventListener('close',()=>{home.after(panel);document.body.style.overflow=previousOverflow;toggle.textContent='⛶ 全画面';toggle.setAttribute('aria-expanded','false');requestAnimationFrame(resize);toggle.focus();});
 window.addEventListener('orientationchange',()=>requestAnimationFrame(resize));
 L.control.scale({imperial:false,position:'bottomleft'}).addTo(map);
 function render(sites,priority,esc){
 sitesCache=sites;priorityFn=priority;escapeFn=esc;renderList();markers.clearLayers();for(const s of sites){const p=priority(s),color={red:'#b65b43',amber:'#ba934c',green:'#5f8062'}[p.tone];
 const button=document.createElement('button');button.type='button';button.className='geo-site'+(['ND-002','ND-004','ND-008'].includes(s.id)?' label-left':'');button.dataset.site=s.id;button.classList.toggle('is-selected',s.id===selectedSite);button.setAttribute('aria-label',`${s.name} ${p.label}（架空の現場）`);button.style.setProperty('--site-color',color);button.innerHTML=`<i></i><span>${esc(s.name)}</span>`;
 // Reuse the page's delegated site selection; keyboard also produces click.
 L.DomEvent.disableClickPropagation(button);button.addEventListener('click',e=>{e.stopPropagation();selectSite(s.id);});
 const icon=L.divIcon({className:'geo-marker',html:button,iconSize:[145,34],iconAnchor:[10,17]});L.marker([s.lat,s.lon],{icon,keyboard:false}).addTo(markers);
 }
 if(!initialized){initialized=true;fit();}else map.invalidateSize({pan:false});
 }
 return {render};
}
