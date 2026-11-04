/* Ranking mensual V2 — renderiza la propuesta. Uso: KJARankingV2.render(datos)
   datos = { pending:n, kpis:{entrada,rpe,facebook,salida}  (0-100),
     top:[{id,rank,name,area,foto,score,parts:[en,rp,fb,sa]}]  (ordenado, hasta 10; parts = puntos por criterio),
     areas:[{name,pct}], overall:{score,evaluated,total}, limiting:{name,pct} }
   Eventos: 'rk2:select' (detail:{id,name}), 'rk2:review'. */
(function(){
  var $=function(i){return document.getElementById(i)};
  var esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
  var f1=function(n){return (Math.round(n*10)/10).toFixed(1)};
  var ini=function(n){var p=String(n||'').trim().split(/\s+/);return ((p[0]||'')[0]||'')+((p[1]||'')[0]||'')};
  var COL=['var(--ok)','var(--a2)','var(--a1)','var(--terra)'];
  var KPI=[['entrada','Entrada','var(--ok)','M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1'],
    ['rpe','RPE (Rendimiento)','var(--a2)','M13 10V3L4 14h7v7l9-11h-7z'],
    ['facebook','Facebook','var(--a1)','M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5'],
    ['salida','Salida','var(--terra)','M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1']];
  var AC=['var(--ok)','var(--a2)','var(--a1)','var(--mu)','var(--terra)'];
  var ph=function(p){return p.foto?'<img src="'+esc(p.foto)+'" alt="" loading="lazy" onerror="this.remove()">':''};
  function pod(p,i){var c=['p1','p2','p3'][i];if(!p)return '';
    return '<div class="rk2-pod '+c+'" data-id="'+esc(p.id)+'" role="button" tabindex="0"><div class="rk2-av">'+(i===0?'<svg class="rk2-star" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 7.2h7.6l-6 4.8 2.4 7.2-6-4.8-6 4.8 2.4-7.2-6-4.8h7.6z"/></svg>':'')+'<div class="rk2-avw"><b>'+esc(ini(p.name))+ph(p)+'</b><em>'+(p.rank||i+1)+'</em></div></div><h4 class="rk2-name" title="'+esc(p.name)+'">'+esc(p.name)+'</h4><small>'+esc(p.area)+'</small><div class="rk2-score"><b>'+f1(p.score)+'</b><span>/100</span></div></div>'}
  function row(p,i){var seg=(p.parts||[]).map(function(w,k){return '<i style="width:'+w+'%;background:'+COL[k]+'"></i>'}).join('');
    return '<button type="button" class="rk2-row" data-id="'+esc(p.id)+'"><div class="rk2-row-l"><span class="rk2-rank">'+(p.rank||i+4)+'</span><span class="rk2-ini" style="background:'+AC[i%4]+'22;color:'+AC[i%4]+'">'+esc(ini(p.name))+ph(p)+'</span><div class="rk2-row-m"><h4 class="rk2-name">'+esc(p.name)+'</h4><small>'+esc(p.area)+'</small></div></div><div class="rk2-seg" aria-hidden="true">'+seg+'</div><b>'+f1(p.score)+'</b></button>'}
  function render(d){d=d||{};var t=d.top||[],k=d.kpis||{},n=d.pending||0;
    $('rk2-alert').hidden=!n;$('rk2-alert-title').textContent='Atención: '+n+' revisiones pendientes';
    $('rk2-kpis').innerHTML=KPI.map(function(x){var v=k[x[0]]||0;return '<div class="rk2-kpi"><div class="rk2-kpi-top"><span>'+x[1]+'</span><span class="rk2-kpi-ic" style="color:'+x[2]+';background:color-mix(in srgb,'+x[2]+' 10%,transparent)"><svg viewBox="0 0 24 24"><path d="'+x[3]+'"/></svg></span></div><b>'+f1(v)+'<small>%</small></b><div class="rk2-bar"><i style="width:'+v+'%;background:'+x[2]+'"></i></div></div>'}).join('');
    $('rk2-podium').innerHTML=[t[1],t[0],t[2]].map(function(p,j){return pod(p,[1,0,2][j])}).join('');
    $('rk2-list').innerHTML=t.slice(3,10).map(row).join('');
    $('rk2-areas').innerHTML=(d.areas||[]).map(function(a,i){return '<div><div class="rk2-ar-top"><span>'+esc(a.name)+'</span><b>'+Math.round(a.pct)+'%</b></div><div class="rk2-bar"><i style="width:'+a.pct+'%;background:'+AC[i%5]+'"></i></div></div>'}).join('');
    var o=d.overall||{};$('rk2-overall').textContent=o.score==null?'—':f1(o.score);
    $('rk2-overall-note').textContent=o.total?'Promedio general de '+o.evaluated+' colaboradores evaluables de '+o.total+'.':'Sin datos todavía.';
    var l=d.limiting;$('rk2-limit').hidden=!l;if(l)$('rk2-limit-name').textContent=l.name+' ('+Math.round(l.pct)+'%)';}
  var root=$('admin-ranking-section');if(!root)return;
  function pick(e){var el=e.target.closest('[data-id]');if(el&&root.contains(el))document.dispatchEvent(new CustomEvent('rk2:select',{detail:{id:el.getAttribute('data-id')}}))}
  root.addEventListener('click',pick);
  root.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){if(e.target.classList.contains('rk2-pod')){e.preventDefault();pick(e)}}});
  $('rk2-alert-btn').addEventListener('click',function(){document.dispatchEvent(new CustomEvent('rk2:review'))});
  var b=$('rk2-full-toggle');b.addEventListener('click',function(){var o=$('rk2-full').hidden;$('rk2-full').hidden=!o;b.setAttribute('aria-expanded',o);b.textContent=o?'Ocultar ranking completo':'Ver ranking completo'});
  window.KJARankingV2={render:render};
})();
