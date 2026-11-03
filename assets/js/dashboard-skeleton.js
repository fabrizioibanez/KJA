/*
 * Skeletons del Centro de gestion.
 *
 * Uso en cualquier carga nueva:
 *   await DashboardSkeleton.withSkeleton(contenedor, 'tabla', fetchFn)
 *
 * La espera visual aparece despues de 180 ms y, si llego a mostrarse, permanece
 * al menos 300 ms. fetchFn puede devolver false para activar el estado de error.
 */
(function(global){
  'use strict';

  const DEFAULTS={delay:180,minVisible:300,fade:200};
  const active=new WeakMap();
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const block=(className='')=>`<span class="kja-sk-block ${className}" aria-hidden="true"></span>`;
  const lines=(count=2)=>`<span class="kja-sk-lines">${Array.from({length:count},(_,index)=>block(`kja-sk-line w-${[80,58,68,42][index%4]}`)).join('')}</span>`;
  const metric=()=>`<article class="kja-sk-card kja-sk-metric">${block('kja-sk-line w-58')}${block('kja-sk-number')}</article>`;
  /* Tarjetas con la jerarquía real de los indicadores del resumen: anillo y tres líneas. */
  const overviewCharts=(count=4)=>Array.from({length:count},()=>`<article class="admin-chart kja-sk-native-chart"><header>${block('kja-sk-line w-58')}${block('kja-sk-line w-80')}${block('kja-sk-line w-68')}</header>${block('admin-chart-ring kja-sk-circle')}</article>`).join('');
  const metrics=(count=4)=>`<div class="kja-sk-metrics">${Array.from({length:count},metric).join('')}</div>`;
  /* Los contenedores KPI reales esperan tarjetas como hijos directos. Mantener
     esa jerarquia evita que sus grids responsive se conviertan en una columna. */
  const nativeMetrics=(count=4)=>Array.from({length:count},()=>`<article class="admin-list-kpi kja-sk-native-metric"><small>${block('kja-sk-line w-68')}</small><b>${block('kja-sk-number')}</b></article>`).join('');
  const filters=(count=3)=>`<div class="kja-sk-filters">${Array.from({length:count},()=>block('kja-sk-input')).join('')}</div>`;
  const row=(cells=4,avatar=false)=>`<div class="kja-sk-row">${avatar?block('kja-sk-circle'):''}${Array.from({length:cells},(_,index)=>index===0?lines(2):block(`kja-sk-line w-${[58,68,42][index%3]}`)).join('')}</div>`;
  const table=(rows=6,cells=4,avatar=true)=>`<section class="kja-sk-table"><div class="kja-sk-table-head">${Array.from({length:cells},()=>block('kja-sk-line w-58')).join('')}</div>${Array.from({length:rows},()=>row(cells,avatar)).join('')}</section>`;
  const heading=()=>`<header class="kja-sk-heading"><span>${block('kja-sk-line w-32')}${block('kja-sk-title')}${block('kja-sk-line w-58')}</span>${block('kja-sk-button')}</header>`;
  const cards=(count=4)=>`<div class="kja-sk-card-grid">${Array.from({length:count},()=>`<article class="kja-sk-card">${block('kja-sk-circle')}${lines(3)}${block('kja-sk-button')}</article>`).join('')}</div>`;
  const chart=()=>`<article class="kja-sk-card kja-sk-chart">${lines(2)}<div class="kja-sk-bars">${[42,68,54,82,63,74,48].map(height=>block(`kja-sk-bar h-${height}`)).join('')}</div></article>`;
  const panel=(rows=4,avatar=true)=>`<article class="kja-sk-panel">${lines(2)}<div class="kja-sk-panel-rows">${Array.from({length:rows},()=>row(2,avatar)).join('')}</div>${block('kja-sk-panel-foot')}</article>`;
  const dayStrip=()=>`<div class="kja-sk-day-strip">${Array.from({length:7},()=>`<span>${block('kja-sk-line w-42')}${block('kja-sk-date')}</span>`).join('')}</div>`;
  const areaBars=(count=6)=>`<article class="kja-sk-area-panel">${lines(2)}${Array.from({length:count},(_,index)=>`<div class="kja-sk-area-row">${block('kja-sk-circle small')}${lines(2)}${block(`kja-sk-progress p-${[72,55,83,46,64,38][index%6]}`)}</div>`).join('')}</article>`;
  const cases=(count=6)=>`<article class="kja-sk-case-panel"><div class="kja-sk-queue-pills">${Array.from({length:4},()=>block('kja-sk-pill')).join('')}</div>${filters(3)}${Array.from({length:count},()=>`<div class="kja-sk-case">${block('kja-sk-circle')}${lines(3)}<span class="kja-sk-case-meta">${block('kja-sk-pill')}${block('kja-sk-button')}</span></div>`).join('')}</article>`;
  const roster=(groups=2,perGroup=3)=>`<section class="kja-sk-roster">${Array.from({length:groups},()=>`<div class="kja-sk-roster-group">${block('kja-sk-group-title')}${Array.from({length:perGroup},()=>row(4,true)).join('')}</div>`).join('')}</section>`;
  const ledger=()=>`<section class="kja-sk-ledger"><div class="kja-sk-ledger-head">${block('kja-sk-line w-68')}${Array.from({length:31},()=>block('kja-sk-ledger-day-label')).join('')}</div>${Array.from({length:6},()=>`<div class="kja-sk-ledger-row"><span class="kja-sk-ledger-person">${block('kja-sk-circle')}${lines(2)}</span>${Array.from({length:31},()=>block('kja-sk-ledger-cell')).join('')}</div>`).join('')}</section>`;
  // Roles y equipos es una lista; kja-sk-role-grid se conserva como firma de la sección.
  const roleList=()=>`<div class="kja-sk-role-grid">${table(8,6,true)}</div>`;
  const closeCards=(count=6)=>`<div class="kja-sk-close-grid">${Array.from({length:count},()=>`<article class="kja-sk-close-card"><span>${block('kja-sk-circle')}${lines(2)}</span><div class="kja-sk-checks">${Array.from({length:4},()=>block('kja-sk-check')).join('')}</div>${block('kja-sk-button')}</article>`).join('')}</div>`;

  const layouts={
    overview:()=>`<div class="kja-sk-scene overview">${heading()}${metrics(4)}<div class="kja-sk-overview-panels">${panel(5,true)}${panel(4,false)}</div></div>`,
    control:()=>`<div class="kja-sk-scene control">${heading()}${metrics(4)}<div class="kja-sk-control-workbench">${areaBars(7)}${cases(6)}</div></div>`,
    ranking:()=>`<div class="kja-sk-scene ranking">${heading()}${filters(3)}<div class="kja-sk-formula-bar">${lines(2)}${block('kja-sk-button')}</div><div class="kja-sk-ranking-analytics">${chart()}<aside>${chart()}${panel(3,false)}</aside></div><details open class="kja-sk-directory">${block('kja-sk-line w-32')}${table(6,5,true)}</details></div>`,
    facebook:()=>`<div class="kja-sk-scene facebook">${heading()}${filters(5)}${metrics(4)}<div class="kja-sk-report-toolbar">${block('kja-sk-pill')}${block('kja-sk-pill')}${block('kja-sk-input')}</div><div class="kja-sk-facebook-results">${panel(4,false)}${table(7,6,true)}</div></div>`,
    lista:()=>`<div class="kja-sk-scene lista">${heading()}${filters(3)}${dayStrip()}${metrics(5)}${roster(2,4)}</div>`,
    mes:()=>`<div class="kja-sk-scene mes">${heading()}${filters(4)}${metrics(5)}${ledger()}<div class="kja-sk-legend">${Array.from({length:7},()=>block('kja-sk-pill')).join('')}</div></div>`,
    cierres:()=>`<div class="kja-sk-scene cierres">${heading()}${filters(4)}${metrics(3)}${closeCards(6)}</div>`,
    asignaciones:()=>`<div class="kja-sk-scene asignaciones">${heading()}<div class="kja-sk-assignment-columns"><article class="kja-sk-form kja-sk-assignment-form">${lines(2)}${filters(2)}${Array.from({length:4},()=>block('kja-sk-input')).join('')}${block('kja-sk-upload')}${block('kja-sk-button')}</article><section class="kja-sk-assignment-list">${lines(2)}${Array.from({length:5},()=>`<article>${block('kja-sk-icon')}${lines(3)}${block('kja-sk-pill')}</article>`).join('')}</section></div></div>`,
    colaboradores:()=>`<div class="kja-sk-scene colaboradores">${heading()}${filters(4)}<article class="kja-sk-export-card">${lines(3)}${filters(2)}<div>${block('kja-sk-button')}${block('kja-sk-button')}</div></article>${metrics(5)}${cards(6)}</div>`,
    contratos:()=>`<div class="kja-sk-scene contratos">${heading()}${metrics(4)}${filters(4)}<div class="kja-sk-contract-caption">${lines(2)}</div>${table(8,6,true)}</div>`,
    roles:()=>`<div class="kja-sk-scene roles">${heading()}${metrics(5)}${block('kja-sk-security-pill')}${roleList()}${panel(4,true)}</div>`,
    marcado:()=>`<div class="kja-sk-scene marcado">${heading()}<div class="kja-sk-access-layout"><article class="kja-sk-route-card">${lines(2)}${Array.from({length:2},()=>`<section>${block('kja-sk-icon')}${lines(3)}${block('kja-sk-input')}</section>`).join('')}${block('kja-sk-qr')}</article><article class="kja-sk-policy-card">${lines(2)}${filters(2)}${block('kja-sk-map')}${block('kja-sk-button')}</article></div>${metrics(5)}${panel(2,true)}${filters(2)}${table(7,4,true)}${panel(3,false)}</div>`,
    tabla:()=>`${heading()}${filters(3)}${metrics(4)}${table()}`,
    tarjetas:()=>`${heading()}${metrics(4)}${cards(6)}`,
    lista_simple:()=>`${heading()}${filters(2)}${table(7,3,true)}`
  };

  function resolveContainer(container){
    return typeof container==='string'?document.querySelector(container):container;
  }

  function skeletonMarkup(kind){
    if(typeof kind==='function')return kind();
    if(typeof kind==='string'&&kind.trim().startsWith('<'))return kind;
    return (layouts[kind]||layouts.tabla)();
  }

  function fillMirrorSlot(clone,id,html,{reveal=false}={}){
    const slot=clone.querySelector(`#${id}`);if(!slot)return;
    if(reveal)slot.hidden=false;
    slot.dataset.skeletonReady='true';
    slot.innerHTML=html;
  }

  /* Las zonas que normalmente nacen vacías reciben filas representativas. El
     resto conserva el árbol y las clases reales de la vista. */
  function hydrateMirror(clone,kind){
    if(kind==='overview'){
      fillMirrorSlot(clone,'admin-overview-charts',overviewCharts(4));
      fillMirrorSlot(clone,'admin-status-list',Array.from({length:5},()=>row(2,true)).join(''));
      fillMirrorSlot(clone,'admin-request-list',Array.from({length:4},()=>row(2,false)).join(''));
    }else if(kind==='control'){
      fillMirrorSlot(clone,'admin-control-areas',areaBars(7));
      fillMirrorSlot(clone,'admin-control-kpis',Array.from({length:4},()=>block('kja-sk-pill')).join(''));
      fillMirrorSlot(clone,'admin-control-table',cases(6));
    }else if(kind==='ranking'){
      fillMirrorSlot(clone,'ranking-leaders',cards(3));
      fillMirrorSlot(clone,'ranking-chart',chart());
      fillMirrorSlot(clone,'ranking-area-analytics',chart());
      fillMirrorSlot(clone,'ranking-insights',panel(3,false));
      fillMirrorSlot(clone,'ranking-results',table(7,5,true));
    }else if(kind==='facebook'){
      const results=clone.querySelector('#fb-report-results');if(results)results.hidden=false;
      fillMirrorSlot(clone,'fb-report-kpis',`${panel(1,false)}${metrics(4)}${chart()}`,{reveal:true});
      fillMirrorSlot(clone,'fb-report-matrix',table(7,6,true),{reveal:true});
      fillMirrorSlot(clone,'fb-report-attention',panel(5,true),{reveal:true});
    }else if(kind==='lista'){
      fillMirrorSlot(clone,'admin-date-strip',dayStrip());
      fillMirrorSlot(clone,'admin-list-kpis',nativeMetrics(5));
      fillMirrorSlot(clone,'admin-roster',roster(2,4));
    }else if(kind==='mes'){
      fillMirrorSlot(clone,'admin-month-kpis',nativeMetrics(5));
      fillMirrorSlot(clone,'admin-month-ledger',ledger());
    }else if(kind==='cierres'){
      fillMirrorSlot(clone,'admin-review-summary',metrics(3),{reveal:true});
      fillMirrorSlot(clone,'admin-close-status',closeCards(6));
    }else if(kind==='asignaciones'){
      fillMirrorSlot(clone,'admin-close-assignment-list',Array.from({length:5},()=>`<article class="kja-sk-assignment-item">${block('kja-sk-icon')}${lines(3)}${block('kja-sk-pill')}</article>`).join(''));
    }else if(kind==='colaboradores'){
      fillMirrorSlot(clone,'admin-people-kpis',nativeMetrics(5));
      fillMirrorSlot(clone,'admin-people-list',cards(6));
    }else if(kind==='contratos'){
      fillMirrorSlot(clone,'admin-contract-kpis',nativeMetrics(4));
      fillMirrorSlot(clone,'admin-contract-list',table(8,6,true));
    }else if(kind==='roles'){
      fillMirrorSlot(clone,'admin-roles-kpis',nativeMetrics(5));
      fillMirrorSlot(clone,'admin-role-map',roleList());
      fillMirrorSlot(clone,'admin-role-audit',Array.from({length:4},()=>row(2,true)).join(''));
    }else if(kind==='marcado'){
      fillMirrorSlot(clone,'admin-access-kpis',nativeMetrics(5));
      fillMirrorSlot(clone,'admin-access-requests',Array.from({length:3},()=>row(3,true)).join(''));
      fillMirrorSlot(clone,'admin-access-list',table(7,4,true));
      fillMirrorSlot(clone,'admin-access-audit',Array.from({length:4},()=>row(2,false)).join(''));
    }
  }

  function mirrorSection(host,kind){
    if(!host?.cloneNode)return null;
    const clone=host.cloneNode(true);clone.hidden=false;
    clone.classList.add('kja-skeleton-mirror',`kja-skeleton-${kind}`);
    clone.setAttribute('aria-hidden','true');clone.setAttribute('inert','');
    hydrateMirror(clone,kind);
    clone.querySelectorAll('dialog,[role="dialog"],[class*="modal"],[class*="popover"],[hidden]').forEach(element=>element.remove());
    clone.querySelectorAll('[id]').forEach(element=>element.removeAttribute('id'));
    clone.removeAttribute('id');
    clone.querySelectorAll('[aria-labelledby],[aria-describedby],[aria-controls],[aria-owns],[for]').forEach(element=>{
      for(const attribute of ['aria-labelledby','aria-describedby','aria-controls','aria-owns','for'])element.removeAttribute(attribute);
    });
    clone.querySelectorAll('a,input,select,textarea,button,details,summary').forEach(element=>{
      element.setAttribute('tabindex','-1');element.setAttribute('aria-hidden','true');
      if('disabled'in element)element.disabled=true;
      element.removeAttribute('href');element.removeAttribute('name');
      if('value'in element)element.value='';
      if('placeholder'in element)element.placeholder='';
      element.classList.add('kja-sk-native-control');
    });
    clone.querySelectorAll('img,video,canvas,iframe').forEach(element=>{
      element.removeAttribute('src');element.removeAttribute('srcset');element.classList.add('kja-sk-native-media','kja-sk-block');
    });
    clone.querySelectorAll('svg').forEach(element=>{element.replaceChildren();element.classList.add('kja-sk-native-icon','kja-sk-block')});
    const walker=document.createTreeWalker(clone,global.NodeFilter.SHOW_TEXT);
    const textNodes=[];while(walker.nextNode())textNodes.push(walker.currentNode);
    textNodes.forEach(node=>{
      const value=node.nodeValue.trim();if(!value||node.parentElement?.closest('[data-skeleton-ready="true"]'))return;
      const line=document.createElement('span');line.className='kja-sk-block kja-sk-native-line';
      line.style.setProperty('--kja-sk-text-width',`${Math.max(3,Math.min(24,Math.ceil(value.length*.58)))}ch`);
      node.replaceWith(line);
    });
    clone.querySelectorAll('[data-skeleton-ready]').forEach(element=>element.removeAttribute('data-skeleton-ready'));
    return clone;
  }

  function makeLayer(kind,mirror=null){
    const layer=document.createElement('div');
    layer.className='kja-skeleton-layer';
    layer.setAttribute('role','status');
    layer.setAttribute('aria-live','polite');
    layer.setAttribute('aria-label','Cargando contenido');
    layer.innerHTML='<span class="sr-only">Cargando contenido, espera un momento.</span>';
    if(mirror)layer.append(mirror);
    else layer.insertAdjacentHTML('beforeend',`<div class="kja-skeleton kja-skeleton-${kind}">${skeletonMarkup(kind)}</div>`);
    return layer;
  }

  function makeError(message,retry){
    const error=document.createElement('div');
    error.className='kja-skeleton-error';
    error.setAttribute('role','alert');
    error.innerHTML='<span class="kja-skeleton-error-icon" aria-hidden="true">!</span><div><h3>No pudimos cargar esta seccion</h3><p></p><button type="button">Reintentar</button></div>';
    error.querySelector('p').textContent=message||'Comprueba tu conexion e intentalo nuevamente.';
    error.querySelector('button').addEventListener('click',retry);
    return error;
  }

  /**
   * Envuelve una promesa de datos con demora anti-parpadeo, permanencia minima,
   * transicion de contenido y recuperacion accesible ante errores.
   */
  async function withSkeleton(container,kind,fetchFn,options={}){
    const host=resolveContainer(container);
    if(!host||typeof fetchFn!=='function')return fetchFn?.();

    const settings={...DEFAULTS,...options};
    const previous=active.get(host);
    if(previous){
      previous.cancelled=true;clearTimeout(previous.timer);previous.layer?.remove();
      host.classList.remove('is-skeleton-visible','kja-skeleton-error-visible');
    }

    const state={cancelled:false,shownAt:0,layer:null,timer:null};
    active.set(host,state);
    host.classList.add('kja-skeleton-host');
    host.classList.remove('kja-skeleton-error-visible','kja-content-fade');
    host.setAttribute('aria-busy','true');
    const measured=Math.ceil(host.getBoundingClientRect?.().height||host.scrollHeight||0);
    if(measured>0)host.style.setProperty('--kja-skeleton-height',`${measured}px`);
    const mirror=mirrorSection(host,kind);

    const show=()=>{
      if(state.cancelled||active.get(host)!==state)return;
      state.layer=makeLayer(kind,mirror);
      state.shownAt=Date.now();
      host.append(state.layer);
      host.classList.add('is-skeleton-visible');
    };
    state.timer=setTimeout(show,settings.delay);

    const retry=()=>withSkeleton(host,kind,fetchFn,options);
    try{
      const result=await fetchFn();
      if(state.cancelled||active.get(host)!==state)return result;
      const failed=result===false||(typeof settings.isError==='function'&&settings.isError(result));
      if(failed)throw Object.assign(new Error(settings.errorMessage||'No fue posible obtener los datos.'),{expected:true});
      clearTimeout(state.timer);
      if(state.layer){
        const remaining=Math.max(0,settings.minVisible-(Date.now()-state.shownAt));
        if(remaining)await sleep(remaining);
      }
      if(state.cancelled||active.get(host)!==state)return result;
      state.layer?.remove();
      host.classList.remove('is-skeleton-visible');
      host.classList.add('kja-content-fade');
      host.setAttribute('aria-busy','false');
      setTimeout(()=>host.classList.remove('kja-content-fade'),settings.fade);
      active.delete(host);
      return result;
    }catch(error){
      if(state.cancelled||active.get(host)!==state)return false;
      clearTimeout(state.timer);
      if(!state.layer)show();
      state.layer.replaceChildren(makeError(error?.message, retry));
      host.classList.add('kja-skeleton-error-visible');
      host.setAttribute('aria-busy','false');
      return false;
    }
  }

  global.DashboardSkeleton={withSkeleton,layouts,block,lines};
  global.withSkeleton=withSkeleton;
})(globalThis);
