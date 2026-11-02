// Keep the app and dialogs inside the visual viewport when the keyboard opens.
// No persistence or app-state changes: this only responds to viewport geometry.
const viewport=window.visualViewport;
let frame;
function sync(){cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{const height=viewport?.height||window.innerHeight,top=viewport?.offsetTop||0;document.documentElement.style.setProperty('--app-height',`${Math.round(height)}px`);document.documentElement.style.setProperty('--viewport-top',`${Math.round(top)}px`);for(const [selector,key] of [['header','--shell-header'],['.topline','--shell-title'],['.rail','--shell-nav']]){const el=document.querySelector(selector);if(el)document.documentElement.style.setProperty(key,`${Math.round(el.getBoundingClientRect().height)}px`);}const active=document.activeElement;if(document.querySelector('dialog[open],#solvia-visit')&&active?.matches('input,textarea,select'))active.scrollIntoView({block:'nearest',inline:'nearest'});});}
viewport?.addEventListener('resize',sync);viewport?.addEventListener('scroll',sync);window.addEventListener('resize',sync);window.addEventListener('orientationchange',sync);document.addEventListener('focusin',sync);sync();

if(window.ResizeObserver){const observer=new ResizeObserver(sync);for(const selector of ['header','.topline','.rail']){const el=document.querySelector(selector);if(el)observer.observe(el);}}
