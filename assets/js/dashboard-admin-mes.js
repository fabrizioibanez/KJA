/* KJA · Fase 4 — Libro mensual y resumen administrativo. */
let ADMIN_MONTH_DIALOG=null;
let ADMIN_MONTH_LOAD=null;
const ADMIN_MONTH_TIMEOUT_MS=20000;
let ADMIN_MONTH_AREA_TYPEAHEAD='';
let ADMIN_MONTH_AREA_TYPEAHEAD_TIMER=null;

function monthMessage(text){
  const id=APP.adminSection==='resumen'?'admin-summary-message':'admin-month-message';
  const el=$(id);el.textContent=text||'';el.classList.toggle('show',!!text);
}
function activeMonthPrefix(){return APP.adminSection==='resumen'?'admin-summary':'admin-month'}
function currentMonthValue(){return $(`${activeMonthPrefix()}-value`).value||isoLima().slice(0,7)}
function monthTitle(value){
  const [year,month]=String(value).split('-').map(Number);
  return `${monthNames[month-1]||''} ${year}`.replace(/^./,x=>x.toUpperCase());
}
function syncMonthInputs(value){
  $('admin-month-value').value=value;if($('admin-summary-value'))$('admin-summary-value').value=value;
  $('admin-month-stamp').textContent=monthTitle(value);if($('admin-summary-stamp'))$('admin-summary-stamp').textContent=monthTitle(value);
}
function shiftMonth(value,amount){
  const [year,month]=String(value).split('-').map(Number),date=new Date(year,month-1+amount,1);
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
}
function monthPeople(kind){
  if(!APP.adminMonth)return [];
  const summary=kind==='summary';
  const query=$(summary?'admin-summary-search':'admin-month-search').value.trim().toLocaleLowerCase('es');
  const area=$(summary?'admin-summary-area':'admin-month-area').value;
  return (APP.adminMonth.personas||[]).filter(person=>(!area||String(person.area_id)===area)
    &&(!query||person.nombre.toLocaleLowerCase('es').includes(query)));
}
function fillMonthFilters(){
  const areas=(APP.adminMonth?.areas||[]).filter(area=>area.activo);
  for(const id of ['admin-month-area','admin-summary-area']){
    const select=$(id);if(!select)continue;const current=select.value;
    select.innerHTML='<option value="">Todas las áreas</option>'+areas.map(area=>`<option value="${area.id}">${esc(area.nombre)}</option>`).join('');
    if(areas.some(area=>String(area.id)===current))select.value=current;
  }
  syncMonthAreaCombobox();
}
function syncMonthAreaCombobox(){
  const select=$('admin-month-area'),selected=$('admin-month-area-selected'),list=$('admin-month-area-options');
  if(!select||!selected||!list)return;
  const current=select.options[select.selectedIndex]||select.options[0];
  selected.textContent=current?.textContent||'Todas las áreas';
  list.innerHTML=[...select.options].map((option,index)=>{
    const active=option.value===select.value;
    return `<button type="button" id="admin-month-area-option-${index}" role="option" tabindex="-1" data-month-area-option="${esc(option.value)}" aria-selected="${active}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6.5 12.5 3.5 3.5 7.5-8" /></svg><span>${esc(option.textContent)}</span></button>`;
  }).join('');
}
function setMonthAreaOpen(open,{focusSelected=false}={}){
  const field=document.querySelector('.admin-month-area-combobox'),trigger=$('admin-month-area-trigger'),list=$('admin-month-area-options');
  if(!field||!trigger||!list)return;
  if(open)syncMonthAreaCombobox();
  field.classList.toggle('is-open',open);
  trigger.setAttribute('aria-expanded',String(open));
  list.hidden=!open;
  if(open&&focusSelected)requestAnimationFrame(()=>{
    (list.querySelector('[aria-selected="true"]')||list.querySelector('[role="option"]'))?.focus();
  });
}
function chooseMonthArea(value){
  const select=$('admin-month-area');
  if(![...select.options].some(option=>option.value===value))return;
  select.value=value;
  syncMonthAreaCombobox();
  setMonthAreaOpen(false);
  select.dispatchEvent(new Event('change',{bubbles:true}));
  $('admin-month-area-trigger').focus();
}
function monthAreaOptions(){return [...$('admin-month-area-options').querySelectorAll('[role="option"]')]}
function focusMonthAreaOption(buttons,index){
  if(!buttons.length)return;
  buttons[(index+buttons.length)%buttons.length].focus();
}
function normalizeMonthAreaText(value){
  return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es');
}
function sumMonth(people,key){return people.reduce((total,person)=>total+Number(person.resumen?.[key]||0),0)}
function monthRate(people){
  const p=sumMonth(people,'P'),t=sumMonth(people,'T'),j=sumMonth(people,'J'),base=p+t+j;
  return base?Math.round((p+t)*100/base):null;
}

function mergeAdminMonthClosures(data,closeData){
  const by=new Map((closeData?.cierres||[]).map(item=>[`${item.colaborador_id}|${item.fecha}`,item]));
  for(const person of data.personas||[]){
    const summary=person.resumen||{},counts={P:0,T:0,J:0,NG:0,incompletas:0,pendientes:0,horas:0};
    for(const day of person.dias||[]){
      const leave=(data.dias_libres||[]).find(item=>String(item.colaborador_id)===String(person.id)&&item.fecha===day.fecha);
      const isDay5=day.fecha==='2026-10-05';
      const isDay13=day.fecha==='2026-10-13';
      const isSpecialOff=(isDay5||(isDay13&&day.laborable!==false))&&(!day.estado||day.estado==='F');
      const diaLibre=!!leave||isSpecialOff;
      day.dia_libre=diaLibre;
      if(diaLibre){
        day.laborable=false;
        day.motivo=leave?.motivo||(isDay5?'Día libre general (05/10)':'Día libre asignado (13/10)');
        day.excepcion_nota=leave?.motivo||'Reconocimiento por asistencia presencial';
      }
      const close=by.get(`${person.id}|${day.fecha}`);day.cierre_estado=close?.estado||null;day.salida_at=close?.salida_at||null;
      const valid=!day.cierre_estado||['no_aplica','completa','regularizada'].includes(day.cierre_estado);
      if(day.estado==='P'&&valid)counts.P++;
      else if(day.estado==='T'&&valid)counts.T++;
      else if(day.estado==='J')counts.J++;
      else if(day.estado==='NG')counts.NG++;
      if(day.cierre_estado==='incompleta')counts.incompletas++;
      if(day.laborable&&day.fecha<=data.hoy&&!day.estado)counts.pendientes++;
      if((day.laborable||(['P','T','J'].includes(day.estado)&&valid))&&(day.estado==='J'||(['P','T'].includes(day.estado)&&valid)))counts.horas+=Number(day.horas||0);
    }
    const base=counts.P+counts.T+counts.J;
    person.resumen={...summary,...counts,
      programados:(person.dias||[]).filter(day=>day.laborable).length,
      programados_transcurridos:(person.dias||[]).filter(day=>day.laborable&&day.fecha<=data.hoy).length,
      porcentaje:base?Math.round((counts.P+counts.T)*100/base):null};
  }
}

async function loadAdminMonth(force=false){
  if(!APP.access.acceso_panel)return;
  const prefix=activeMonthPrefix(),value=currentMonthValue();syncMonthInputs(value);
  const include=$(`${prefix}-inactive`).checked,key=`${value}|${include}`;
  if(!force&&ADMIN_MONTH_LOAD?.key===key)return ADMIN_MONTH_LOAD.promise;
  if(!force&&!ADMIN_MONTH_LOAD&&APP.adminMonth&&APP.adminMonthKey===key){renderAdminMonthViews();return true}
  ADMIN_MONTH_LOAD?.controller.abort();
  const state={key,controller:new AbortController(),promise:null};
  ADMIN_MONTH_LOAD=state;
  state.promise=fetchAdminMonth(value,include,key,state.controller).finally(()=>{
    if(ADMIN_MONTH_LOAD===state)ADMIN_MONTH_LOAD=null;
  });
  return state.promise;
}

async function fetchAdminMonth(value,include,key,controller){
  closeAdminPersonCalendar();
  const [year,month]=value.split('-').map(Number),request=++APP.adminMonthRequest,button=$('admin-refresh');
  const target=APP.adminSection==='resumen'?'admin-summary-table':'admin-month-ledger';
  button.disabled=true;monthMessage('');
  $(target).innerHTML='<p class="admin-empty">Preparando el mes completo…</p>';
  let timer;
  const cancelled=new Promise((resolve,reject)=>{
    controller.signal.addEventListener('abort',()=>reject(new Error('La consulta del mes tardó demasiado. Vuelve a intentarlo.')),{once:true});
    timer=setTimeout(()=>controller.abort(),ADMIN_MONTH_TIMEOUT_MS);
  });
  try{
    const [{data,error},{data:closeData,error:closeError}]=await Promise.race([
      Promise.all([
        db.rpc('dash_admin_mes',{p_anio:year,p_mes:month,p_incluir_inactivos:include}).abortSignal(controller.signal),
        db.rpc('dash_admin_cierres_mes',{p_anio:year,p_mes:month}).abortSignal(controller.signal)
      ]),cancelled
    ]);
    if(request!==APP.adminMonthRequest)return;
    if(error||!data?.ok||closeError||!closeData?.ok){
      const missing=error&&(error.code==='PGRST202'||String(error.message||'').includes('dash_admin_mes'));
      throw new Error(missing?'La fase 4 todavía no está instalada en Supabase. Ejecuta dashboard_07_admin_mes.sql.':'No se pudo cargar el mes completo ni verificar sus cierres. Actualiza e inténtalo nuevamente.');
    }
    mergeAdminMonthClosures(data,closeData);
    APP.adminMonth=data;APP.adminMonthKey=key;fillMonthFilters();renderAdminMonthViews();
    // Las fotos son opcionales: nunca bloquean la tabla ni sus estados de cierre.
    void hydrateAdminMonthPhotos(data,request);
    return true;
  }catch(error){
    if(request!==APP.adminMonthRequest)return;
    APP.adminMonth=null;APP.adminMonthKey='';
    monthMessage(error?.message||'No se pudo cargar el mes completo. Vuelve a intentarlo.');
    $(target).innerHTML='<p class="admin-empty">La información mensual no está disponible.</p>';
    return false;
  }finally{
    clearTimeout(timer);
    if(request===APP.adminMonthRequest)button.disabled=false;
  }
}

async function hydrateAdminMonthPhotos(data,request){
  try{
    const people=await hydrateProfilePhotos(data.personas||[]);
    if(request!==APP.adminMonthRequest||APP.adminMonth!==data)return;
    data.personas=people;
    const byId=new Map(people.map(person=>[String(person.id),person]));
    document.querySelectorAll('[data-month-photo-person]').forEach(node=>{
      const person=byId.get(node.dataset.monthPhotoPerson),avatar=node.querySelector('.avatar');
      if(person&&avatar)avatar.outerHTML=profileAvatarMarkup(person,avatar.tagName.toLowerCase());
    });
  }catch{}
}

function renderAdminMonthViews(){
  if(!APP.adminMonth)return;
  renderAdminMonthLedger();renderAdminMonthSummary();
}
function statusText(state){return ({P:'Presente',T:'Tardanza',J:'Justificado',NG:'No gestiona'})[state]||'Sin registro'}
function monthCellClass(day){
  const classes=['admin-month-cell'];
  if(day.dia_libre)classes.push('day-off');
  else if(day.cierre_estado==='incompleta')classes.push('incomplete');
  else if(day.cierre_estado==='en_curso')classes.push('close-pending');
  else if(day.estado)classes.push(day.estado.toLowerCase());
  else if(!day.laborable)classes.push(day.motivo==='feriado'?'holiday':day.motivo==='preinicio'?'pre':'off');
  else classes.push('empty');
  if(day.futura)classes.push('future');if(day.evidencia)classes.push('has-evidence');if(day.excepcion_tipo)classes.push('exception');
  return classes.join(' ');
}
function closeAdminPersonCalendar(returnToLedger=false){
  const host=$('admin-person-calendar');
  if(!host)return;
  host._personCalendar=null;host.hidden=true;host.innerHTML='';
  host.onclick=null;host.onchange=null;
  if(returnToLedger){
    const ledger=$('admin-month-ledger');
    ledger.setAttribute('tabindex','-1');ledger.focus({preventScroll:true});
    ledger.scrollIntoView({block:'start',behavior:'instant'});
  }
}
function renderAdminMonthLedger(){
  closeAdminPersonCalendar();
  const data=APP.adminMonth,people=monthPeople('month');
  const p=sumMonth(people,'P'),t=sumMonth(people,'T'),j=sumMonth(people,'J'),pending=sumMonth(people,'pendientes'),incomplete=sumMonth(people,'incompletas');
  const kpis=[['PERSONAS',people.length,''],['JORNADAS VÁLIDAS',p+t+j+sumMonth(people,'NG'),'ready'],['ASISTENCIA',monthRate(people)==null?'—':`${monthRate(people)}%`,'ready'],['INCOMPLETAS',incomplete,incomplete?'danger':''],['SIN ENTRADA',pending,pending?'warning':'']];
  $('admin-month-kpis').innerHTML=kpis.map(item=>`<article class="admin-list-kpi ${item[2]}"><small>${item[0]}</small><b>${item[1]}</b></article>`).join('');
  const sample=people[0]?.dias||APP.adminMonth.personas?.[0]?.dias||[];
  const holidays=new Map((data.feriados||[]).map(item=>[item.fecha,item.nota||'Feriado']));
  let html='<table class="admin-month-table"><thead><tr><th class="person-col">Colaborador</th>';
  for(const day of sample){
    const date=new Date(day.fecha+'T12:00:00'),dow=['D','L','M','M','J','V','S'][date.getDay()],number=date.getDate(),holiday=holidays.get(day.fecha);
    html+=`<th class="day-col ${holiday?'holiday':''} ${day.fecha===data.hoy?'today':''}" title="${holiday?esc(holiday):''}"><span>${dow}</span><b>${number}</b>${holiday?'<i></i>':''}</th>`;
  }
  html+='</tr></thead><tbody>';
  if(!people.length)html+=`<tr><td class="admin-month-empty" colspan="${sample.length+1}">No hay colaboradores para los filtros seleccionados.</td></tr>`;
  let currentArea='';
  for(const person of people){
    if(person.area!==currentArea){currentArea=person.area;html+=`<tr class="admin-month-area-row"><td colspan="${sample.length+1}"><span class="admin-month-area-sticky"><i></i><b>${esc(currentArea||'Sin área')}</b><span>${people.filter(x=>x.area===currentArea).length}</span></span></td></tr>`}
    html+=`<tr><th class="person-col" scope="row"><div class="admin-month-person" data-month-photo-person="${person.id}">${profileAvatarMarkup(person)}<div class="admin-month-person-info"><b>${esc(person.nombre)}</b><small class="admin-month-person-status ${person.activo?'is-active':'is-inactive'}">${person.activo?'Activo':'Dado de baja'}</small></div><button type="button" class="admin-month-person-calendar" data-person-calendar="${person.id}" aria-label="Ver calendario y evidencias de ${esc(person.nombre)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M16 3v4M8 3v4M3 11h18M8 15h2M14 15h2"/></svg><span>Ver calendario y evidencias</span><svg class="admin-month-person-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></button></div></th>`;
    for(const day of person.dias||[]){
      const content=day.dia_libre?'DL':day.cierre_estado==='incompleta'?'INC':day.cierre_estado==='en_curso'?'…':day.estado||(!day.laborable?'—':'·'),detail=`${person.nombre} · ${day.fecha} · ${day.dia_libre?'Día libre asignado':day.cierre_estado==='incompleta'?'Jornada incompleta':day.cierre_estado==='en_curso'?'Entrada registrada, cierre pendiente':day.estado?statusText(day.estado):day.laborable?'Sin registro':day.motivo}`;
      html+=`<td><button type="button" class="${monthCellClass(day)}" data-month-person="${person.id}" data-month-date="${day.fecha}" aria-label="${esc(detail)}"><b>${content}</b>${day.nota?'<i class="note"></i>':''}${day.evidencia?'<i class="camera"></i>':''}</button></td>`;
    }
    html+='</tr>';
  }
  html+='</tbody></table>';$('admin-month-ledger').innerHTML=html;
  if(window.innerWidth<=768){
    requestAnimationFrame(()=>{
      const todayCol=$('admin-month-ledger')?.querySelector('.day-col.today');
      if(todayCol){
        const personCol=$('admin-month-ledger')?.querySelector('.person-col');
        const offset=(personCol?.offsetWidth||168);
        const targetLeft=Math.max(0,todayCol.offsetLeft-offset-8);
        $('admin-month-ledger').scrollTo({left:targetLeft,behavior:'auto'});
      }
    });
  }
  if(!data.puede_editar)monthMessage('Tu rol es de solo lectura. Puedes consultar celdas y exportar, pero no modificar el mes.');
}

function renderAdminMonthSummary(){
  if(!$('admin-summary-table'))return;
  const people=monthPeople('summary'),rate=monthRate(people),p=sumMonth(people,'P'),t=sumMonth(people,'T'),j=sumMonth(people,'J'),ng=sumMonth(people,'NG'),pending=sumMonth(people,'pendientes'),incomplete=sumMonth(people,'incompletas'),hours=sumMonth(people,'horas');
  const cards=[
    ['ASISTENCIA DEL MES',rate==null?'—':`${rate}%`,`${p+t} registros presentes o con tardanza`,'primary'],
    ['PUNTUALIDAD',p+t?`${Math.round(p*100/(p+t))}%`:'—',`${p} presentes · ${t} tardanzas`,''],
    ['PENDIENTES / INCOMPLETAS',pending+incomplete,`${pending} sin entrada · ${incomplete} sin salida`,'warning'],
    ['HORAS REGISTRADAS',`${hours.toFixed(1)} h`,`${people.length} personas en la lectura`,'']
  ];
  $('admin-summary-kpis').innerHTML=cards.map(card=>`<article class="${card[3]}"><small>${card[0]}</small><b>${card[1]}</b><span>${card[2]}</span></article>`).join('');
  let html='<div class="admin-summary-head"><span>Colaborador</span><span>Estados del mes</span><span>Programados</span><span>Pendientes</span><span>Horas</span><span>Asistencia</span></div>';
  for(const person of people){
    const r=person.resumen||{},pct=r.porcentaje==null?null:Number(r.porcentaje),bar=pct==null?0:pct;
    html+=`<article class="admin-summary-row ${person.activo?'':'inactive'}">
      <span class="admin-summary-person" data-month-photo-person="${person.id}">${profileAvatarMarkup(person,'i')}<span><b>${esc(person.nombre)}</b><small>${esc(person.area||'Sin área')} · ${person.activo?'Activo':'Dado de baja'}</small></span></span>
      <span class="admin-summary-states"><i class="p">P <b>${r.P||0}</b></i><i class="t">T <b>${r.T||0}</b></i><i class="j">J <b>${r.J||0}</b></i><i class="ng">NG <b>${r.NG||0}</b></i><i class="incomplete">INC <b>${r.incompletas||0}</b></i></span>
      <span><b>${r.programados||0}</b><small>${r.programados_transcurridos||0} transcurridos</small></span>
      <span class="${Number(r.pendientes)>0?'needs-review':''}"><b>${r.pendientes||0}</b><small>a la fecha</small></span>
      <span><b>${Number(r.horas||0).toFixed(1)} h</b><small>congeladas</small></span>
      <span class="admin-summary-rate"><b>${pct==null?'—':pct+'%'}</b><i><u style="width:${bar}%"></u></i></span>
    </article>`;
  }
  $('admin-summary-table').innerHTML=people.length?html:'<p class="admin-empty">No hay colaboradores para los filtros seleccionados.</p>';
}

function closeMonthModal(){
  $('admin-month-modal')._leavePlanner?.dispose();
  $('admin-month-modal')._leavePlanner=null;
  $('admin-month-modal')._dayDetail?.dispose();
  $('admin-month-modal')._dayDetail=null;
  $('admin-month-modal').hidden=true;document.body.style.overflow='';ADMIN_MONTH_DIALOG=null;
  $('admin-month-modal-message').textContent='';$('admin-month-modal-message').classList.remove('show');
  $('admin-month-modal')._returnFocus?.focus({preventScroll:true});
}
function modalMonthMessage(text){const el=$('admin-month-modal-message');el.textContent=text||'';el.classList.toggle('show',!!text)}
function openMonthModal(eyebrow,title,copy,body){
  const modal=$('admin-month-modal');
  modal._dayDetail?.dispose();modal._dayDetail=null;
  modal._leavePlanner?.dispose();modal._leavePlanner=null;
  modal.classList.toggle('leave-planner-modal',ADMIN_MONTH_DIALOG?.kind==='days-off');
  if(modal.hidden)modal._returnFocus=document.activeElement;
  modal.classList.toggle('month-detail-modal',ADMIN_MONTH_DIALOG?.kind==='cell');
  modal.querySelector('.admin-editor-head').dataset.initials=String(title).trim().split(/\s+/).slice(0,2).map(word=>word[0]).join('').toUpperCase();
  $('admin-month-modal-eyebrow').textContent=eyebrow;$('admin-month-modal-title').textContent=title;$('admin-month-modal-copy').textContent=copy||'';$('admin-month-modal-body').innerHTML=body;modalMonthMessage('');
  $('admin-month-modal').hidden=false;document.body.style.overflow='hidden';
  modal.querySelector('.admin-month-sheet').scrollTop=0;
  modal.querySelector('.modal-close').focus({preventScroll:true});
}
function findMonthCell(personId,date){
  const person=(APP.adminMonth?.personas||[]).find(item=>String(item.id)===String(personId));
  return {person,day:(person?.dias||[]).find(item=>item.fecha===date)};
}
async function loadMonthIncompleteReasons(dialog){
  const container=$('month-incomplete-reasons');
  if(!container)return;
  container.setAttribute('aria-busy','true');
  container.innerHTML='<p class="month-reasons-loading">Consultando los pendientes de este día…</p>';
  try{
    const {data,error}=await db.rpc('dash_admin_cierres',{p_fecha:dialog.date});
    if(ADMIN_MONTH_DIALOG!==dialog||$('month-incomplete-reasons')!==container)return;
    const close=(data?.personas||[]).find(person=>String(person.id)===dialog.personId)?.cierre;
    if(error||!data?.ok||!close)throw new Error('Detalle no disponible');
    const reasons=CLOSE_MODEL.incompleteReasons(null,close);
    container.innerHTML=reasons.length
      ?`<header><h3>Qué faltó para completar la jornada</h3><span>${reasons.length} ${reasons.length===1?'pendiente':'pendientes'}</span></header><ul>${reasons.map(reason=>`<li><span aria-hidden="true">−</span>${esc(reason)}</li>`).join('')}</ul>`
      :'<p>No se encontraron pendientes en el cierre actual. Actualiza el mes para comprobar el estado de la jornada.</p>';
  }catch(error){
    if(ADMIN_MONTH_DIALOG!==dialog||$('month-incomplete-reasons')!==container)return;
    container.innerHTML='<p>No se pudo consultar el detalle de esta jornada.</p><button type="button" class="admin-secondary-action" data-month-action="retry-reasons">Reintentar</button>';
  }finally{
    if(ADMIN_MONTH_DIALOG===dialog&&$('month-incomplete-reasons')===container)container.setAttribute('aria-busy','false');
  }
}

function openMonthCell(personId,date){
  const {person,day}=findMonthCell(personId,date);if(!person||!day)return;
  ADMIN_MONTH_DIALOG={kind:'cell',personId:String(personId),date};
  const dateText=new Date(date+'T12:00:00').toLocaleDateString('es-PE',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  const visualState=day.cierre_estado==='incompleta'?'incomplete':day.cierre_estado==='en_curso'?'close-pending':day.estado?.toLowerCase(),visualLabel=day.cierre_estado==='incompleta'?'Jornada incompleta':day.cierre_estado==='en_curso'?'Entrada registrada · cierre pendiente':statusText(day.estado);
  const mark=day.estado?`<div class="month-day-current ${visualState}"><b>${esc(visualLabel)}</b></div>`:'';
  const canEdit=!!APP.adminMonth.puede_editar,isFuture=day.fecha>APP.adminMonth.hoy;
  let actions='';
  if(canEdit&&person.activo&&day.motivo!=='preinicio')actions+='<button type="button" class="admin-secondary-action" data-month-action="day-off">Gestionar día libre</button>';
  if(canEdit&&!isFuture&&day.laborable){actions+=`<div class="month-state-picker"><p>Registrar o corregir estado</p>${['P','T','J','NG'].map(state=>`<button type="button" class="${state.toLowerCase()} ${day.estado===state?'on':''}" data-month-state="${state}">${state}<small>${statusText(state)}</small></button>`).join('')}</div>`}
  if(canEdit&&day.estado)actions+='<button type="button" class="admin-danger-action" data-month-action="remove-mark">Quitar marca</button>';
  if(canEdit&&!isFuture&&day.motivo!=='preinicio'&&!day.dia_libre){
    if(day.excepcion_tipo)actions+=`<button type="button" class="admin-secondary-action" data-month-action="clear-exception">Restablecer horario normal</button>`;
    else if(!day.laborable)actions+=`<button type="button" class="admin-primary-action" data-month-action="extra">Habilitar como día trabajado</button>`;
    else actions+=`<button type="button" class="admin-secondary-action" data-month-action="off">Registrar permiso / no laborable</button>`;
  }
  const reason={preinicio:'Fecha anterior al inicio del contrato',extra:'Día adicional habilitado',feriado:`Feriado${day.feriado_nota?' · '+day.feriado_nota:''}`,permiso:`Permiso${day.excepcion_nota?' · '+day.excepcion_nota:''}`,horario:day.laborable?'Día programado por horario':'Día no programado'}[day.motivo]||day.motivo;
  const managementHtml=`<h3>Gestión de la jornada</h3>${canEdit?'':'<p>Tu rol tiene acceso de solo lectura.</p>'}<div class="month-modal-actions">${actions||'<p class="admin-empty">No hay acciones disponibles para esta fecha.</p>'}</div>`;
  openMonthModal('DETALLE DE ASISTENCIA',person.nombre,dateText,
    `<div class="md-day-summary"><div class="md-person-context"><span>${esc(person.area||'Sin área')}</span>${person.dni?`<span>DNI ${esc(person.dni)}</span>`:''}<span>${person.activo?'Colaborador activo':'Dado de baja'}</span></div><div class="month-day-facts"><span><small>Condición del día</small><b>${esc(reason||'No registrada')}</b></span><span><small>Modalidad</small>${canEdit&&!isFuture&&day.estado?`<div class="md-mode-picker" role="group" aria-label="Modalidad de asistencia">${['virtual','presencial'].map(mode=>`<button type="button" data-month-mode="${mode}" aria-pressed="${day.modalidad===mode}">${cap(mode)}</button>`).join('')}</div><small>Solo para este día · guardado automático</small><small id="month-mode-status" role="status" aria-live="polite"></small>`:`<b>${esc(cap(day.modalidad||'No registrada'))}</b>`}</span><span><small>Origen de la marca</small><b>${esc(day.origen||'Sin registro')}</b></span></div>${mark}</div>${[...new Set([day.nota,day.excepcion_nota,day.feriado_nota].filter(Boolean))].map(note=>`<p class="month-day-note"><b>Nota:</b> ${esc(note)}</p>`).join('')}<section id="month-day-detail" aria-label="Registros y evidencias del día" aria-live="polite"></section>`);
  const detailDialog=ADMIN_MONTH_DIALOG;
  $('admin-month-modal')._dayDetail=KJAMonthDayDetail.mount($('month-day-detail'),{person,day,future:isFuture,canManageFacebook:APP.access?.rol==='direccion',canManageEvidence:APP.access?.rol==='direccion',managementHtml,onChanged:()=>{
    APP.adminMonthKey='';void loadAdminMonth(true);
    if(ADMIN_MONTH_DIALOG===detailDialog&&$('month-incomplete-reasons'))void loadMonthIncompleteReasons(detailDialog);
  }});
  if(day.cierre_estado==='incompleta'){
    const body=$('admin-month-modal-body'),anchor=body.querySelector('.md-day-summary');
    anchor.insertAdjacentHTML('afterend','<section class="month-incomplete-reasons" id="month-incomplete-reasons" aria-live="polite" aria-busy="true"></section>');
    void loadMonthIncompleteReasons(ADMIN_MONTH_DIALOG);
  }
}

async function changeMonthMode(mode){
  const dialog=ADMIN_MONTH_DIALOG;
  if(dialog?.kind!=='cell'||dialog.savingMode||!APP.adminMonth?.puede_editar)return;
  const {person,day}=findMonthCell(dialog.personId,dialog.date);
  if(!person||!day?.estado||day.fecha>APP.adminMonth.hoy||!['virtual','presencial'].includes(mode)||day.modalidad===mode)return;
  const picker=$('admin-month-modal-body').querySelector('.md-mode-picker'),status=$('month-mode-status');
  const live=()=>ADMIN_MONTH_DIALOG===dialog&&status?.isConnected;
  dialog.savingMode=true;
  picker.setAttribute('aria-busy','true');
  picker.querySelectorAll('button').forEach(button=>button.disabled=true);
  status.textContent='Guardando modalidad…';
  let saved=false;
  try{
    const {data,error}=await db.rpc('dash_admin_cambiar_modalidad',{p_colaborador:Number(person.id),p_fecha:day.fecha,p_modalidad:mode});
    if(error||!data?.ok){
      const messages={sin_permiso:'Tu rol no permite cambiar la modalidad.',sesion:'Tu sesión venció. Vuelve a iniciar sesión.',sin_registro:'La marca ya no existe. Actualiza el mes.',fecha:'No se puede corregir una fecha futura.'};
      throw new Error(error?.code==='PGRST202'?'Falta aplicar la migración 85 en Supabase para guardar cambios.':messages[data?.motivo]||'No se pudo guardar. Inténtalo nuevamente.');
    }
    saved=true;
    APP.adminMonthKey='';
    if(live())status.textContent='Modalidad guardada. Actualizando jornada…';
    await loadAdminMonth(true);
    if(live()){
      if(APP.adminMonth){
        openMonthCell(dialog.personId,dialog.date);
        const updatedStatus=$('month-mode-status');
        if(updatedStatus)updatedStatus.textContent='Modalidad guardada.';
        $('admin-month-modal-body').querySelector('[data-month-mode="'+mode+'"]')?.focus({preventScroll:true});
      }else{
        picker.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.monthMode===mode)));
        status.textContent='Modalidad guardada. No se pudo actualizar el detalle; cierra y actualiza el mes.';
      }
    }
    toast('Modalidad actualizada a '+cap(mode)+'.');
  }catch(error){
    if(live())status.textContent=saved?'Modalidad guardada. Cierra y actualiza el mes para consultar los pendientes.':error.message;
  }finally{
    dialog.savingMode=false;
    if(live()){
      picker.removeAttribute('aria-busy');
      picker.querySelectorAll('button').forEach(button=>button.disabled=saved);
    }
  }
}

async function openPrivateMonthEvidence(path){
  const popup=window.open('about:blank','_blank');
  try{const {data,error}=await db.storage.from('asis-evidencias').createSignedUrl(path,3600);if(error||!data?.signedUrl)throw error||new Error('url');if(popup){popup.opener=null;popup.location.replace(data.signedUrl)}else window.open(data.signedUrl,'_blank','noopener')}
  catch(error){if(popup)popup.close();modalMonthMessage('No se pudo abrir la evidencia. Inténtalo nuevamente.')}
}
async function changeMonthState(state){
  const dialog=ADMIN_MONTH_DIALOG,{person,day}=findMonthCell(dialog.personId,dialog.date);if(!person||!day)return;
  modalMonthMessage('Guardando…');
  const {data,error}=await db.rpc('dash_admin_guardar_estado',{p_colab:Number(person.id),p_fecha:day.fecha,p_estado:state});
  if(error||!data?.ok){const reason=data?.motivo||error?.message;return modalMonthMessage(({no_labora:'Primero habilita este día como laborable.',fecha:'No se puede marcar una fecha futura.',antes_contrato:'La fecha es anterior al contrato.',sin_permiso:'Tu rol no permite editar.'})[reason]||'No se pudo guardar el estado.')}
  closeMonthModal();await loadAdminMonth(true);toast('Estado mensual actualizado.');
}
async function removeMonthMark(){
  const dialog=ADMIN_MONTH_DIALOG,{person,day}=findMonthCell(dialog.personId,dialog.date);if(!person||!day)return;
  modalMonthMessage('Quitando marca…');
  let {data,error}=await db.rpc('dash_admin_quitar_estado',{p_colab:Number(person.id),p_fecha:day.fecha,p_evidencia_eliminada:false});
  if(error)return modalMonthMessage('No se pudo quitar la marca.');
  if(!data?.ok&&data?.motivo==='requiere_evidencia'){
    if(!confirm(`La marca de ${person.nombre} tiene una evidencia. ¿Quieres eliminar la marca y su imagen?`))return modalMonthMessage('');
    const removed=await db.storage.from('asis-evidencias').remove([data.ruta]);if(removed.error)return modalMonthMessage('No se pudo borrar la evidencia; la marca se conservó.');
    ({data,error}=await db.rpc('dash_admin_quitar_estado',{p_colab:Number(person.id),p_fecha:day.fecha,p_evidencia_eliminada:true}));
  }
  if(error||!data?.ok)return modalMonthMessage('No se pudo quitar la marca.');
  closeMonthModal();await loadAdminMonth(true);toast('Marca eliminada.');
}
async function changeMonthException(type){
  const dialog=ADMIN_MONTH_DIALOG,{person,day}=findMonthCell(dialog.personId,dialog.date);if(!person||!day)return;
  modalMonthMessage('Guardando excepción…');
  const call=type?db.rpc('dash_admin_guardar_excepcion',{p_colab:Number(person.id),p_fecha:day.fecha,p_tipo:type,p_nota:null}):db.rpc('dash_admin_quitar_excepcion',{p_colab:Number(person.id),p_fecha:day.fecha});
  const {data,error}=await call;
  if(error||!data?.ok)return modalMonthMessage('No se pudo actualizar la condición del día.');
  closeMonthModal();await loadAdminMonth(true);toast(type==='laborable_extra'?'Día habilitado.':type==='no_laborable'?'Permiso registrado.':'Horario restablecido.');
}

async function openHolidayManager(){
  if(!APP.adminMonth)return;
  const dialog=ADMIN_MONTH_DIALOG={kind:'holidays',saving:false};
  openMonthModal('CALENDARIO LABORAL','Programar feriados','Agenda un feriado para todo el equipo, también para los próximos meses.','<p role="status">Consultando próximos feriados…</p>');
  try{
    const {data,error}=await db.rpc('dash_admin_feriados_proximos');
    if(ADMIN_MONTH_DIALOG!==dialog)return;
    if(error||!data?.ok)throw new Error(error?.code==='PGRST202'?'La agenda de feriados aún no está disponible. Contacta a Sistemas.':'No se pudo cargar la agenda. Inténtalo nuevamente.');
    dialog.today=data.hoy;
    const canEdit=!!data.puede_editar;
    const items=(data.feriados||[]).map(item=>`<li><span><b>${new Date(item.fecha+'T12:00:00').toLocaleDateString('es-PE',{day:'numeric',month:'long',year:'numeric'})}</b><small>${esc(item.nota||'Feriado')}</small><small>${item.solo_comparticiones?'Solo comparticiones programadas':'Sin jornada ni comparticiones'}</small></span>${canEdit?`<button type="button" data-remove-holiday="${esc(item.fecha)}" aria-label="Cancelar feriado del ${esc(item.fecha)}">Cancelar feriado</button>`:''}</li>`).join('');
    const selected=APP.adminMonth.inicio>data.hoy?APP.adminMonth.inicio:data.hoy;
    const form=canEdit?`<form class="month-holiday-form holiday-scheduler" id="month-holiday-form"><label>Fecha del feriado<input type="date" id="month-holiday-date" min="${data.hoy}" max="2100-12-31" value="${selected}" required></label><label>Nombre o motivo<input id="month-holiday-note" maxlength="60" placeholder="Ej. Feriado nacional"></label><p class="holiday-scheduler-effect">Ese día nadie tendrá que marcar asistencia ni subir RPE, salida o entregables. Solo se mantienen las comparticiones de quienes las tengan programadas. El anuncio aparecerá automáticamente ese día.</p><button class="admin-primary-action" type="submit">Agendar feriado</button></form>`:'<p class="admin-empty">Tu rol permite consultar, pero no editar feriados.</p>';
    $('admin-month-modal-body').innerHTML=`${form}<h3>Próximos feriados</h3><ul class="month-holiday-list holiday-agenda">${items||'<li class="empty">No hay feriados programados desde hoy.</li>'}</ul>`;
    if(canEdit)$('month-holiday-form').onsubmit=saveHoliday;
  }catch(error){if(ADMIN_MONTH_DIALOG===dialog){modalMonthMessage(error.message);$('admin-month-modal-body').innerHTML='<button type="button" class="admin-secondary-action" data-retry-holidays>Reintentar</button>';}}
}

function openDaysOffManager(personId='',date=''){
  if(!APP.adminMonth)return;
  const dialog=ADMIN_MONTH_DIALOG={kind:'days-off'};
  openMonthModal('','Días libres','Busca un trabajador, selecciona sus fechas y revisa los descansos del equipo.','<div id="month-days-off-planner"></div>');
  $('admin-month-modal')._leavePlanner=KJADaysOffPlanner.mount($('month-days-off-planner'),{
    data:APP.adminMonth,month:currentMonthValue(),personId,date,
    rpc:(name,args)=>db.rpc(name,args),isCurrent:()=>ADMIN_MONTH_DIALOG===dialog,
    onChanged:()=>{APP.adminMonthKey='';return loadAdminMonth(true)}
  });
}
async function saveHoliday(event){
  event.preventDefault();
  if(!$('month-holiday-form').reportValidity())return;
  return mutateHoliday($('month-holiday-date').value,$('month-holiday-note').value.trim());
}
async function removeHoliday(date){
  return mutateHoliday(date,'',true);
}
async function mutateHoliday(date,note,remove=false){
  const dialog=ADMIN_MONTH_DIALOG;
  if(dialog?.kind!=='holidays'||dialog.saving)return;
  dialog.saving=true;
  const controls=[...$('admin-month-modal-body').querySelectorAll('input,button')];
  controls.forEach(el=>el.disabled=true);
  modalMonthMessage(remove?'Cancelando feriado…':'Agendando feriado…');
  try{
    const {data,error}=await db.rpc(remove?'dash_admin_quitar_feriado':'dash_admin_guardar_feriado',remove?{p_fecha:date}:{p_fecha:date,p_nota:note||null});
    if(error||!data?.ok){
      const messages={fecha:'Selecciona hoy o una fecha futura.',nota:'El motivo admite hasta 60 caracteres.',sin_permiso:'No tienes permiso para modificar feriados.'};
      throw new Error(messages[data?.motivo]||'No se pudo guardar el cambio. Inténtalo nuevamente.');
    }
    if(ADMIN_MONTH_DIALOG!==dialog)return;
    syncMonthInputs(date.slice(0,7));await loadAdminMonth(true);
    if(ADMIN_MONTH_DIALOG===dialog)await openHolidayManager();
    toast(remove?'Feriado cancelado. Se restableció el horario habitual.':'Feriado agendado para todo el equipo.');
  }catch(error){if(ADMIN_MONTH_DIALOG===dialog)modalMonthMessage(error.message);}
  finally{dialog.saving=false;controls.forEach(el=>el.disabled=false);}
}

function csvCell(value){const text=String(value??'');return /[;"\n]/.test(text)?`"${text.replace(/"/g,'""')}"`:text}
function downloadMonthCsv(kind){
  if(!APP.adminMonth)return;const people=monthPeople(kind),summary=kind==='summary';let rows;
  if(summary){rows=[['Colaborador','Área','Estado','P','T','J','NG','Incompletas','Programados','Transcurridos','Sin entrada','Horas','Asistencia %'],...people.map(person=>{const r=person.resumen||{};return [person.nombre,person.area,person.activo?'Activo':'Baja',r.P||0,r.T||0,r.J||0,r.NG||0,r.incompletas||0,r.programados||0,r.programados_transcurridos||0,r.pendientes||0,Number(r.horas||0).toFixed(1),r.porcentaje??'']})]}
  else{rows=[['Colaborador','Área','Estado persona','Fecha','Laborable','Motivo','Modalidad','Estado entrada','Estado cierre','Horas','Hora de entrada','Hora de salida','Origen','Nota','Evidencia'],...people.flatMap(person=>(person.dias||[]).map(day=>[person.nombre,person.area,person.activo?'Activo':'Baja',day.fecha,day.laborable?'Sí':'No',day.motivo,day.modalidad,day.estado||'',day.cierre_estado||'no_aplica',day.horas??'',day.marcado_at||'',day.salida_at||'',day.origen||'',day.nota||day.excepcion_nota||day.feriado_nota||'',day.evidencia?'Sí':'No']))]}
  const content='\ufeff'+rows.map(row=>row.map(csvCell).join(';')).join('\r\n'),blob=new Blob([content],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=`KJA_${summary?'resumen':'asistencia'}_${currentMonthValue()}.csv`;document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);toast('Archivo CSV preparado.');
}

function setMonthFrom(prefix,value){syncMonthInputs(value);APP.adminMonthKey='';withAdminSkeleton('mes',()=>loadAdminMonth())}
const initialAdminMonth=isoLima().slice(0,7);syncMonthInputs(initialAdminMonth);
['admin-month','admin-summary'].forEach(prefix=>{
  if(!$(`${prefix}-value`))return;
  $(`${prefix}-prev`).onclick=()=>setMonthFrom(prefix,shiftMonth($(`${prefix}-value`).value,-1));
  $(`${prefix}-next`).onclick=()=>setMonthFrom(prefix,shiftMonth($(`${prefix}-value`).value,1));
  $(`${prefix}-today`).onclick=()=>setMonthFrom(prefix,isoLima().slice(0,7));
  $(`${prefix}-value`).onchange=e=>setMonthFrom(prefix,e.target.value||isoLima().slice(0,7));
  $(`${prefix}-inactive`).onchange=()=>{APP.adminMonthKey='';withAdminSkeleton('mes',()=>loadAdminMonth())};
});
$('admin-month-search').oninput=renderAdminMonthLedger;$('admin-month-area').onchange=renderAdminMonthLedger;
if($('admin-summary-search'))$('admin-summary-search').oninput=renderAdminMonthSummary;if($('admin-summary-area'))$('admin-summary-area').onchange=renderAdminMonthSummary;
$('admin-month-area-trigger').onclick=()=>{
  const open=$('admin-month-area-trigger').getAttribute('aria-expanded')!=='true';
  setMonthAreaOpen(open,{focusSelected:open});
};
$('admin-month-area-trigger').onkeydown=event=>{
  if(['Enter',' ','ArrowDown','ArrowUp'].includes(event.key)){
    event.preventDefault();
    setMonthAreaOpen(true,{focusSelected:true});
  }
  if(event.key==='Escape')setMonthAreaOpen(false);
};
$('admin-month-area-options').onclick=event=>{
  const option=event.target.closest('[data-month-area-option]');
  if(option)chooseMonthArea(option.dataset.monthAreaOption);
};
$('admin-month-area-options').onkeydown=event=>{
  const options=monthAreaOptions(),current=options.indexOf(event.target.closest('[role="option"]'));
  if(event.key==='ArrowDown'){event.preventDefault();focusMonthAreaOption(options,current+1);return}
  if(event.key==='ArrowUp'){event.preventDefault();focusMonthAreaOption(options,current-1);return}
  if(event.key==='Home'){event.preventDefault();focusMonthAreaOption(options,0);return}
  if(event.key==='End'){event.preventDefault();focusMonthAreaOption(options,options.length-1);return}
  if(event.key==='Escape'){event.preventDefault();setMonthAreaOpen(false);$('admin-month-area-trigger').focus();return}
  if(['Enter',' '].includes(event.key)){
    event.preventDefault();
    const option=event.target.closest('[data-month-area-option]');
    if(option)chooseMonthArea(option.dataset.monthAreaOption);
    return;
  }
  if(event.key==='Tab'){setTimeout(()=>setMonthAreaOpen(false),0);return}
  if(event.key.length===1&&!event.ctrlKey&&!event.metaKey&&!event.altKey){
    ADMIN_MONTH_AREA_TYPEAHEAD+=normalizeMonthAreaText(event.key);
    clearTimeout(ADMIN_MONTH_AREA_TYPEAHEAD_TIMER);
    ADMIN_MONTH_AREA_TYPEAHEAD_TIMER=setTimeout(()=>{ADMIN_MONTH_AREA_TYPEAHEAD=''},650);
    const match=options.find(option=>normalizeMonthAreaText(option.textContent).startsWith(ADMIN_MONTH_AREA_TYPEAHEAD));
    if(match){event.preventDefault();match.focus()}
  }
};
$('admin-month-area-options').onfocusout=event=>{
  if(!event.relatedTarget?.closest('.admin-month-area-combobox'))setMonthAreaOpen(false);
};
document.addEventListener('pointerdown',event=>{
  if(!event.target.closest('.admin-month-area-combobox'))setMonthAreaOpen(false);
});
$('admin-month-export').onclick=()=>downloadMonthCsv('month');if($('admin-summary-export'))$('admin-summary-export').onclick=()=>downloadMonthCsv('summary');
$('admin-month-holidays').onclick=openHolidayManager;
$('admin-month-days-off').onclick=()=>openDaysOffManager();
$('admin-month-ledger').onclick=event=>{
  const calendar=event.target.closest('[data-person-calendar]');
  if(calendar){
    const person=APP.adminMonth?.personas?.find(p=>String(p.id)===calendar.dataset.personCalendar);
    if(person){
      const host=$('admin-person-calendar');
      KJAPersonCalendar.mount({host,person,month:currentMonthValue(),onBack:()=>closeAdminPersonCalendar(true)});
      host.querySelector('h3')?.focus({preventScroll:true});
      host.scrollIntoView({block:'start',behavior:'instant'});
    }
    return;
  }
  const personInfo=event.target.closest('.admin-month-person-info');
  if(personInfo){
    const btn=personInfo.closest('.admin-month-person')?.querySelector('[data-person-calendar]');
    if(btn){btn.click();return;}
  }
  const cell=event.target.closest('[data-month-person]');
  if(cell)openMonthCell(cell.dataset.monthPerson,cell.dataset.monthDate);
};
$('admin-month-modal-body').onclick=event=>{
  if(event.target.closest('[data-retry-holidays]'))return openHolidayManager();
  const mode=event.target.closest('[data-month-mode]');if(mode&&!mode.disabled)return changeMonthMode(mode.dataset.monthMode);
  if(ADMIN_MONTH_DIALOG?.savingMode)return;
  const state=event.target.closest('[data-month-state]');if(state)return changeMonthState(state.dataset.monthState);
  const removeHolidayButton=event.target.closest('[data-remove-holiday]');if(removeHolidayButton)return removeHoliday(removeHolidayButton.dataset.removeHoliday);
  const action=event.target.closest('[data-month-action]');if(!action||ADMIN_MONTH_DIALOG?.kind!=='cell')return;
  if(action.dataset.monthAction==='retry-reasons')return loadMonthIncompleteReasons(ADMIN_MONTH_DIALOG);
  if(action.dataset.monthAction==='day-off')return openDaysOffManager(ADMIN_MONTH_DIALOG.personId,ADMIN_MONTH_DIALOG.date);
  const {day}=findMonthCell(ADMIN_MONTH_DIALOG.personId,ADMIN_MONTH_DIALOG.date);
  if(action.dataset.monthAction==='evidence')return openPrivateMonthEvidence(day?.evidencia_path);
  if(action.dataset.monthAction==='remove-mark')return removeMonthMark();
  if(action.dataset.monthAction==='extra')return changeMonthException('laborable_extra');
  if(action.dataset.monthAction==='off')return changeMonthException('no_laborable');
  if(action.dataset.monthAction==='clear-exception')return changeMonthException(null);
};
document.querySelectorAll('[data-close-month-modal]').forEach(item=>item.onclick=closeMonthModal);
$('admin-month-modal')?.addEventListener('click',event=>{if(event.target===$('admin-month-modal'))closeMonthModal();});
document.addEventListener('keydown',event=>{
  const modal=$('admin-month-modal');if(modal.hidden)return;
  if(event.key==='Escape'){event.preventDefault();closeMonthModal();return;}
  if(event.key==='Tab'){
    const controls=[...modal.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex="0"]')].filter(el=>el.getClientRects().length);
    const first=controls[0],last=controls.at(-1);if(!first)return;
    if(event.shiftKey&&(document.activeElement===first||!modal.contains(document.activeElement))){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&(document.activeElement===last||!modal.contains(document.activeElement))){event.preventDefault();first.focus();}
  }
});
syncMonthAreaCombobox();
