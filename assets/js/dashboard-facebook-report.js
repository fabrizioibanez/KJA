(function(){
  'use strict';
  const get=id=>document.getElementById(id),m=globalThis.KJAFacebookReport;
  const GOAL=80,COMPACT_DAYS=10,MAX_DAYS=93;
  let data=null,request=0,pdfBusy=false,currentViewMode='area',cachedGroups=[],loadTimer=null,comparison=null;
  let areaSort={key:'pct',dir:'desc'},personSort={key:'pct',dir:'asc'},personFilter='all';
  const openAreas=new Set(),popovers=[];
  const drawer={open:false,personId:null,date:null,detail:null,returnFocus:null};
  const today=()=>isoLima();

  // ── Formato ───────────────────────────────────────────────────────────────
  const WEEK=['dom','lun','mar','mié','jue','vie','sáb'],WEEK_LONG=['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
  const MONTHS=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const MONTH_NAMES=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const pad=n=>String(n).padStart(2,'0'),cap=text=>text.charAt(0).toUpperCase()+text.slice(1);
  const parts=value=>{const d=new Date(value+'T12:00:00Z');return {dow:d.getUTCDay(),day:d.getUTCDate(),month:d.getUTCMonth(),year:d.getUTCFullYear()};};
  const weekend=value=>[0,6].includes(parts(value).dow);
  function shortDate(value,{year=false,weekday=true}={}){
    if(!value)return '—';
    const p=parts(value);return `${weekday?WEEK[p.dow]+' ':''}${pad(p.day)} ${MONTHS[p.month]}${year?' '+p.year:''}`;
  }
  const pretty=value=>shortDate(value,{year:true});
  const dayLabel=value=>{const p=parts(value);return `${cap(WEEK[p.dow])} ${pad(p.day)}`;};
  function longDate(value){
    try{return new Intl.DateTimeFormat('es-PE',{timeZone:'UTC',weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date(value+'T12:00:00Z'));}catch(_){return value;}
  }
  const fmtPct=value=>value==null?'—':`${value.toFixed(1).replace('.',',')} %`;
  const plural=(n,one,many)=>`${n} ${n===1?one:many}`;
  function level(pct){
    if(pct==null)return {label:'Sin evaluar',tone:'na'};
    if(pct>=GOAL)return {label:'Excelente',tone:'ok'};
    if(pct>=50)return {label:'Regular',tone:'mid'};
    return {label:'Bajo',tone:'no'};
  }
  function tally(cells){
    const yes=cells.filter(c=>c.value==='Sí').length,no=cells.filter(c=>c.value==='No').length,evaluated=yes+no;
    return {yes,no,evaluated,pct:evaluated?yes/evaluated*100:null};
  }
  function rangeDays(from,to){try{return m.days(from,to).length;}catch(_){return 0;}}

  // ── Construcción de nodos ─────────────────────────────────────────────────
  const ICONS={
    check:'<path d="M20 6 9 17l-5-5"/>',x:'<path d="M18 6 6 18M6 6l12 12"/>',clock:'<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    chevr:'<path d="m9 18 6-6-6-6"/>',up:'<path d="m18 15-6-6-6 6"/>',down:'<path d="m6 9 6 6 6-6"/>',
    users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    trend:'<path d="m22 17-8.5-8.5-5 5L2 7"/><path d="M16 17h6v-6"/>',arrow:'<path d="M5 12h14M12 5l7 7-7 7"/>',
    search:'<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',alert:'<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4M12 17h.01"/>',
    refresh:'<path d="M21 12a9 9 0 1 1-2.64-6.36L21 8"/><path d="M21 3v5h-5"/>',party:'<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4 12 14.01l-3-3"/>'
  };
  function el(tag,className,text){
    const node=document.createElement(tag);
    if(className)node.className=className;
    if(text!=null)node.textContent=String(text);
    return node;
  }
  function icon(name){
    const span=el('span','fbr-ico');span.setAttribute('aria-hidden','true');
    span.innerHTML=`<svg class="fbr-i" viewBox="0 0 24 24">${ICONS[name]||''}</svg>`;
    return span;
  }
  const chip=(text,tone)=>el('span',`fbr-chip is-${tone}`,text);
  function bar(pct){
    const wrap=el('div','fbr-pct'),track=el('span','fbr-bar'),fill=el('i',`is-${level(pct).tone}`);
    fill.setAttribute('style',`width:${pct==null?0:Math.max(0,Math.min(100,pct)).toFixed(1)}%`);
    track.setAttribute('aria-hidden','true');track.append(fill);wrap.append(track,el('b',null,fmtPct(pct)));
    return wrap;
  }
  function avatar(name){
    const initials=String(name).trim().split(/\s+/).slice(0,2).map(word=>word[0]||'').join('').toUpperCase();
    const tone=[...String(name)].reduce((sum,c)=>sum+c.charCodeAt(0),0)%6;
    const span=el('span',`fbr-av t${tone}`,initials);span.setAttribute('aria-hidden','true');
    return span;
  }
  function numCell(value,tone,tag='td'){
    const cell=el(tag,`r${value===0?' is-zero':tone?' is-'+tone:''}`,value);
    return cell;
  }
  function cellWith(...children){const td=el('td');td.append(...children);return td;}

  // ── Celdas Sí / No / motivo ───────────────────────────────────────────────
  const SHORT={'No comparte ese día':'No comparte','Sistema aún no activo':'Sin sistema','Aún no incorporado':'No incorporado','Falta fecha de ingreso':'Sin ingreso','Sin información':'Sin información'};
  function cellTone(answer){
    if(answer.value==='Sí')return 'yes';
    if(answer.value==='No')return answer.state==='en_plazo'?'open':'no';
    if(answer.value==='Aún no incorporado')return 'out';
    if(answer.value==='Sin información')return 'blank';
    return 'na';
  }
  const isSelected=(personId,date)=>drawer.open&&String(drawer.personId)===String(personId)&&drawer.date===date;
  function evidenceCell(host,person,date,answer,compact=false){
    host.dataset.answer=answer.value;
    const tone=cellTone(answer),reason=tone==='open'?'En plazo: la franja sigue abierta y cuenta como No':['Sí','No'].includes(answer.value)?(m.labels[answer.state]||answer.value):answer.value;
    const tip=`${pretty(date)} · ${reason}`;
    if(!['Sí','No'].includes(answer.value)){
      const span=el('span',`fbr-c is-${tone}${compact?' is-mini':''}`,compact?null:SHORT[answer.value]||answer.value);
      span.title=tip;host.append(span);return;
    }
    const button=el('button','fb-evidence-cell');
    button.type='button';button.title=tip;
    button.dataset.answer=answer.value;button.dataset.tone=tone;button.dataset.person=String(person.id);button.dataset.date=date;
    if(compact){button.dataset.compact='true';button.append(el('span','fbr-glyph',tone==='yes'?'✓':tone==='open'?'·':'✕'));}
    else button.append(icon(tone==='yes'?'check':tone==='open'?'clock':'x'),el('span',null,tone==='open'?'En plazo':answer.value));
    button.setAttribute('aria-label',`Ver evidencias de ${person.nombre}, ${pretty(date)}: ${tone==='open'?'en plazo':answer.value}`);
    button.setAttribute('aria-haspopup','dialog');
    if(isSelected(person.id,date))button.dataset.selected='true';
    button.onclick=()=>{
      if(APP.access?.rol!=='direccion'||!data)return;
      drawer.returnFocus=button;
      openFacebookReportEvidence(person,date);
    };
    host.append(button);
  }
  function heatHeader(dates){
    const row=el('div','fbr-cells is-head');
    dates.forEach((date,index)=>{
      const p=parts(date),mark=el('i',[p.dow===1&&index>0?'wk':'',weekend(date)?'we':''].filter(Boolean).join(' ')||null);
      mark.title=pretty(date);mark.append(el('span',null,'DLMMJVS'[p.dow]),el('b',null,p.day));row.append(mark);
    });
    return row;
  }
  function heatCells(person,dates,cells){
    const row=el('div','fbr-cells');
    cells.forEach((cell,index)=>{
      const slot=el('span',`fbr-slot${parts(dates[index]).dow===1&&index>0?' wk':''}`);
      evidenceCell(slot,person,dates[index],cell,true);row.append(slot);
    });
    return row;
  }

  // ── Estado de la consulta ─────────────────────────────────────────────────
  function rows(){return (data?.filas||[]).filter(r=>!get('fb-report-area').value||r.area===get('fb-report-area').value);}
  function provisional(){return data?.provisional===true||data?.hasta===(data?.hoy||today())||data?.filas.some(r=>r.estado==='en_plazo');}
  function syncDownloads(){
    const trigger=get('fb-report-download');
    if(trigger)trigger.disabled=get('fb-report-export').disabled&&get('fb-report-pdf').disabled;
  }
  function setStateChip(kind){
    const badge=get('fb-report-state');if(!badge)return;
    const open=(data?.filas||[]).filter(r=>r.estado==='en_plazo').length;
    const states={
      loading:['Consultando…','na'],closed:['Período cerrado','ok'],error:['Sin datos','no'],
      provisional:[`Provisional${open?' · '+plural(open,'franja abierta','franjas abiertas'):''}`,'info']
    };
    badge.hidden=!states[kind];
    if(!states[kind])return;
    badge.className=`fbr-chip is-${states[kind][1]}`;
    badge.replaceChildren(el('span','fbr-dot'),el('span',null,states[kind][0]));
  }
  function updatedText(iso){
    try{
      const moment=new Date(iso),day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit'}).format(moment);
      const time=new Intl.DateTimeFormat('es-PE',{timeZone:'America/Lima',hour:'2-digit',minute:'2-digit',hour12:false}).format(moment);
      const when=day===today()?'hoy':day===m.shift(today(),-1)?'ayer':shortDate(day,{weekday:false});
      return `Actualizado ${when} ${time} · hora de Lima`;
    }catch(_){return 'Actualizado · hora de Lima';}
  }
  function showEmpty(kind,message=''){
    const box=get('fb-report-empty');if(!box)return;
    box.hidden=!kind;if(!kind)return;
    box.dataset.kind=kind;
    get('fb-report-empty-icon').innerHTML=`<svg class="fbr-i" viewBox="0 0 24 24">${ICONS.alert}</svg>`;
    box.setAttribute('role','alert');
    get('fb-report-empty-title').textContent='No se pudo cargar el reporte';
    get('fb-report-empty-desc').textContent=message;
    const action=get('fb-report-empty-action');action.hidden=false;action.textContent='Reintentar';action.onclick=()=>runLoad();
  }

  function clear(){
    request++;data=null;cachedGroups=[];comparison=null;
    closeDrawer();
    get('fb-report-results').hidden=true;
    get('fb-report-results').setAttribute('aria-busy','false');
    get('fb-report-export').disabled=true;
    get('fb-report-pdf').disabled=true;
    syncDownloads();
    get('fb-report-status').dataset.error='false';
    get('fb-report-status').textContent='';
    setStateChip(null);showEmpty(null);
    for(const id of ['fb-report-kpis','fb-report-matrix','fb-report-person-view','fb-report-attention'])get(id)?.replaceChildren();
  }

  function period(){
    clear();closeCalendar();const kind=get('fb-report-kind').value,ref=get('fb-report-reference').value||today(),custom=kind==='custom';
    get('fb-report-from').readOnly=!custom;get('fb-report-to').readOnly=!custom;
    let range;
    if(kind==='general')range=m.month(ref,today());
    else if(!custom)range=m.cutoff(ref,kind);
    if(range){get('fb-report-from').value=range.desde;get('fb-report-to').value=range.hasta;}
    if(range?.report)get('fb-report-reference').value=range.report;
    get('fb-report-to').max=today();
    get('fb-report-reference').max=kind==='general'?today():m.shift(today(),1);
    syncControls();
  }

  function runLoad(){
    return typeof withAdminSkeleton==='function'?withAdminSkeleton('facebook',()=>window.loadAdminFacebookReport()):window.loadAdminFacebookReport();
  }
  // Los filtros consultan solos; una espera breve agrupa cambios seguidos.
  function scheduleLoad(){
    if(loadTimer&&typeof clearTimeout==='function')clearTimeout(loadTimer);
    loadTimer=setTimeout(()=>{loadTimer=null;runLoad();},300);
  }

  // ── Filtros: tipo de corte, flechas y rango ───────────────────────────────
  function canStep(delta){
    const kind=get('fb-report-kind').value,ref=get('fb-report-reference').value||today(),from=get('fb-report-from').value;
    if(kind==='lunes'||kind==='jueves'){const next=m.shift(m.cutoff(ref,kind).report,7*delta);return next<=m.shift(today(),1)&&m.cutoff(next,kind).desde>='2020-01-01';}
    if(kind==='general'&&from){const d=new Date(from+'T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+delta,1);const first=d.toISOString().slice(0,10);return first<=today()&&first>='2020-01-01';}
    return false;
  }
  function step(delta){
    if(!canStep(delta))return;
    const kind=get('fb-report-kind').value,ref=get('fb-report-reference').value||today();
    if(kind==='general'){const d=new Date(get('fb-report-from').value+'T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+delta,1);get('fb-report-reference').value=d.toISOString().slice(0,10);}
    else get('fb-report-reference').value=m.shift(m.cutoff(ref,kind).report,7*delta);
    closeCalendar();period();scheduleLoad();
  }
  function syncControls(){
    const kind=get('fb-report-kind').value,from=get('fb-report-from').value,to=get('fb-report-to').value,ref=get('fb-report-reference').value,days=rangeDays(from,to);
    const kinds=get('fb-report-kinds');
    if(kinds&&typeof kinds.querySelectorAll==='function')kinds.querySelectorAll('[data-kind]').forEach(button=>{
      const on=button.dataset.kind===kind;button.classList.toggle('is-on',on);button.setAttribute('aria-checked',String(on));
    });
    const stepper=get('fb-report-stepper');if(stepper)stepper.dataset.kind=kind;
    let label='',hint='';
    if(kind==='lunes'||kind==='jueves'){const p=parts(ref||today());label=`${cap(WEEK[p.dow])} ${pad(p.day)} ${MONTHS[p.month]} ${p.year}`;hint=canStep(1)?'':'· corte más reciente';}
    else if(kind==='general'&&from){const p=parts(from);label=`${MONTH_NAMES[p.month]} ${p.year}`;hint=from.slice(0,7)===today().slice(0,7)?'· mes en curso':'';}
    else if(from&&to){label=`${shortDate(from,{weekday:false})} → ${shortDate(to,{weekday:false,year:true})}`;hint=`· ${plural(days,'día','días')}`;}
    get('fb-report-pick-label').textContent=label;get('fb-report-pick-hint').textContent=hint;
    get('fb-report-prev').disabled=!canStep(-1);get('fb-report-next').disabled=!canStep(1);
    const line=get('fb-report-period-line');
    if(line&&from&&to){
      const p=parts(ref||today()),lead=kind==='general'?'General del mes':kind==='custom'?'Rango personalizado':`Corte del ${WEEK_LONG[p.dow]} ${pad(p.day)} ${MONTHS[p.month]}`;
      line.replaceChildren(el('span',null,`${lead} · `),el('b',null,`${shortDate(from)} → ${shortDate(to,{year:true})}`),el('span',null,` · ${plural(days,'día','días')}`));
    }
    const sticky=get('fb-sticky-period');
    if(sticky&&from&&to)sticky.replaceChildren(el('span',null,`${kind==='general'?'Mes':kind==='custom'?'Rango':kind==='lunes'?'Corte lunes':'Corte jueves'} · `),el('b',null,`${shortDate(from)} → ${shortDate(to)}`));
  }

  // ── Calendario: una fecha para los cortes y rango con atajos ─────────────
  const cal={mode:'single',year:2026,month:0,start:'',end:''};
  function openCalendar(mode){
    const pop=get('fb-calendar-popover');if(!pop)return;
    closePopovers();
    const kind=get('fb-report-kind').value,from=get('fb-report-from').value,to=get('fb-report-to').value;
    cal.mode=mode;cal.start=mode==='range'?from:'';cal.end=mode==='range'?to:'';
    const anchor=(mode==='range'?to:kind==='general'?from:get('fb-report-reference').value)||today(),p=parts(anchor);
    cal.year=p.year;cal.month=p.month;
    pop.dataset.mode=mode;
    get('fb-cal-presets').hidden=mode!=='range';
    renderCalendar();
    pop.hidden=false;get('fb-report-pick').setAttribute('aria-expanded','true');
  }
  function closeCalendar(){
    const pop=get('fb-calendar-popover');if(!pop||pop.hidden)return;
    pop.hidden=true;get('fb-report-pick').setAttribute('aria-expanded','false');
  }
  function calendarLimit(){
    const kind=get('fb-report-kind').value;
    return cal.mode==='range'||kind==='general'?today():m.shift(today(),1);
  }
  function renderCalendar(){
    const grid=get('fb-cal-days-grid');if(!grid)return;
    get('fb-cal-month-year').textContent=`${MONTH_NAMES[cal.month]} ${cal.year}`;
    grid.replaceChildren();
    const first=new Date(Date.UTC(cal.year,cal.month,1)),offset=(first.getUTCDay()+6)%7,length=new Date(Date.UTC(cal.year,cal.month+1,0)).getUTCDate();
    for(let i=0;i<offset;i++){const gap=el('span','fbr-cal-gap');gap.setAttribute('aria-hidden','true');grid.append(gap);}
    const max=calendarLimit(),from=cal.mode==='range'?cal.start:get('fb-report-from').value,to=cal.mode==='range'?(cal.end||cal.start):get('fb-report-to').value;
    const marked=cal.mode==='single'&&get('fb-report-kind').value!=='general'?get('fb-report-reference').value:'';
    for(let d=1;d<=length;d++){
      const date=`${cal.year}-${pad(cal.month+1)}-${pad(d)}`,button=el('button','fbr-cal-day',d);
      button.type='button';button.dataset.date=date;button.setAttribute('aria-label',longDate(date));
      if(date===today())button.classList.add('is-today');
      if(from&&to&&date>=from&&date<=to)button.classList.add('is-range');
      if(date===from)button.classList.add('is-start');
      if(date===to)button.classList.add('is-end');
      if(date===marked)button.classList.add('is-report');
      if(date>max||date<'2020-01-01'){button.disabled=true;button.classList.add('is-off');}
      else button.onclick=event=>{event?.stopPropagation?.();pickDate(date);};
      grid.append(button);
    }
    const now=new Date(Date.UTC(cal.year,cal.month,1)).toISOString().slice(0,7);
    get('fb-cal-next').disabled=now>=max.slice(0,7);
    get('fb-cal-prev').disabled=now<='2020-01';
    syncCalendarSummary();
  }
  function syncCalendarSummary(){
    const summary=get('fb-cal-summary'),apply=get('fb-cal-apply');if(!summary||!apply)return;
    apply.hidden=cal.mode!=='range';
    if(cal.mode!=='range'){
      const kind=get('fb-report-kind').value;
      summary.textContent=kind==='general'?'Elige cualquier día del mes.':`Elige un día: se muestra el corte del ${kind} correspondiente.`;
      return;
    }
    if(!cal.start||!cal.end){summary.replaceChildren(el('span',null,cal.start?'Elige la fecha final.':'Elige la fecha inicial.'));apply.disabled=true;return;}
    const days=Math.round((Date.parse(cal.end)-Date.parse(cal.start))/864e5)+1,tooLong=days>MAX_DAYS;
    summary.replaceChildren(el('b',null,`${shortDate(cal.start,{weekday:false})} → ${shortDate(cal.end,{weekday:false})}`),el('span',tooLong?'is-warn':null,tooLong?` · máximo ${MAX_DAYS} días`:` · ${plural(days,'día','días')}`));
    apply.disabled=tooLong;
  }
  function pickDate(date){
    if(cal.mode==='single'){get('fb-report-reference').value=date;closeCalendar();period();scheduleLoad();return;}
    if(!cal.start||cal.end){cal.start=date;cal.end='';}
    else if(date<cal.start)cal.start=date;
    else cal.end=date;
    renderCalendar();
  }
  function applyPreset(preset){
    const end=m.shift(today(),-1);
    if(preset==='month'){const d=new Date(today().slice(0,7)+'-01T12:00:00Z');d.setUTCDate(0);cal.end=d.toISOString().slice(0,10);cal.start=cal.end.slice(0,8)+'01';}
    else{cal.end=end;cal.start=m.shift(end,-(Number(preset)-1));}
    const p=parts(cal.end);cal.year=p.year;cal.month=p.month;renderCalendar();
  }
  function applyRange(){
    if(!cal.start||!cal.end)return;
    get('fb-report-kind').value='custom';
    get('fb-report-from').value=cal.start;get('fb-report-to').value=cal.end;
    closeCalendar();period();scheduleLoad();
  }

  // ── Indicadores ───────────────────────────────────────────────────────────
  function summarize(groups){
    const dates=groups[0]?.dates||(data?m.days(data.desde,data.hasta):[]);
    const persons=groups.flatMap(g=>g.persons.map(p=>({id:p.id,nombre:p.nombre,area:g.area,cells:p.cells,...tally(p.cells)})));
    const yes=persons.reduce((n,p)=>n+p.yes,0),no=persons.reduce((n,p)=>n+p.no,0),evaluated=yes+no;
    const daily=dates.map((date,i)=>{
      const y=groups.reduce((n,g)=>n+g.totals[i].yes,0),n=groups.reduce((s,g)=>s+g.totals[i].no,0);
      return {date,yes:y,no:n,pct:y+n?y/(y+n)*100:null};
    });
    return {dates,persons,yes,no,evaluated,pct:evaluated?yes/evaluated*100:null,notApplicable:persons.length*dates.length-evaluated,daily,withNo:persons.filter(p=>p.no>0).length,areas:groups.length};
  }
  function ring(pct){
    const length=2*Math.PI*54,filled=pct==null?0:length*Math.min(100,pct)/100;
    return `<svg viewBox="0 0 128 128" aria-hidden="true"><circle cx="64" cy="64" r="54" class="fbr-ring-track"/><circle cx="64" cy="64" r="54" class="fbr-ring-fill is-${level(pct).tone}" stroke-dasharray="${filled.toFixed(1)} ${length.toFixed(1)}"/></svg>`;
  }
  function comparisonPct(){
    if(!comparison)return null;
    const area=get('fb-report-area').value;let yes=0,no=0;
    for(const r of comparison.filas){if(area&&r.area!==area)continue;const answer=m.answer(r.estado);if(answer==='Sí')yes++;else if(answer==='No')no++;}
    return yes+no?yes/(yes+no)*100:null;
  }
  function insight(daily){
    const scored=daily.filter(d=>d.pct!=null);
    if(!scored.length)return {text:'Aún no hay días evaluados en este período.'};
    const pctOf=list=>{const y=list.reduce((s,d)=>s+d.yes,0),n=list.reduce((s,d)=>s+d.no,0);return y+n?y/(y+n)*100:null;};
    const ends=scored.filter(d=>weekend(d.date)),weekdays=scored.filter(d=>!weekend(d.date));
    if(ends.length&&weekdays.length){
      const we=pctOf(ends),wd=pctOf(weekdays);
      if(Math.abs(we-wd)>=5)return {text:`El fin de semana ${we<wd?'baja':'sube'} a ${fmtPct(we)} (entre semana: ${fmtPct(wd)}).`,tone:we<wd?'down':'up'};
    }
    if(scored.every(d=>d.pct>=GOAL))return {text:`Todos los días evaluados alcanzan la meta del ${GOAL} %.`,tone:'up'};
    const low=scored.reduce((a,b)=>b.pct<a.pct?b:a);
    return {text:`El día más bajo es el ${dayLabel(low.date).toLowerCase()} con ${fmtPct(low.pct)}.`,tone:'down'};
  }
  function tile(mark,title,value,unit,sub){
    const card=el('div','fbr-card fbr-tile'),head=el('h5',null);
    head.append(mark,el('span',null,title));
    const big=el('div','fbr-tile-v');big.append(el('span',null,value),el('small',null,unit));
    card.append(head,big,el('p','fbr-tile-s',sub));
    return card;
  }
  const square=tone=>el('i',`fbr-sq is-${tone}`);
  function renderKpis(s){
    const container=get('fb-report-kpis');if(!container)return;
    container.replaceChildren();
    const long=s.dates.length>COMPACT_DAYS,lvl=level(s.pct);
    container.classList.toggle('is-long',long);

    const hero=el('div','fbr-card fbr-hero'),ringBox=el('div','fbr-ring'),value=el('div','fbr-ring-value');
    ringBox.innerHTML=ring(s.pct);
    value.append(el('b','fbr-hero-value',fmtPct(s.pct)),el('small',null,`meta ${GOAL} %`));ringBox.append(value);
    const copy=el('div','fbr-hero-copy'),big=el('p','fbr-big');
    big.append(el('b',null,`${s.yes} de ${s.evaluated}`),el('span',null,' evaluaciones con evidencia'));
    copy.append(el('h5',null,'Cumplimiento'),big,chip(lvl.label,lvl.tone));
    const previous=comparisonPct();
    if(previous!=null&&s.pct!=null){
      const diff=s.pct-previous,delta=el('p',`fbr-delta is-${Math.abs(diff)<0.05?'flat':diff>0?'up':'down'}`);
      delta.append(icon(diff>=0?'up':'down'),el('b',null,`${diff>=0?'+':'−'}${Math.abs(diff).toFixed(1).replace('.',',')} pts`),el('span',null,comparison.label));
      delta.title=`${comparison.label.replace(/^vs /,'Período anterior')}: ${fmtPct(previous)}`;
      copy.append(delta);
    }
    hero.append(ringBox,copy);

    const tiles=el('div','fbr-tiles');
    tiles.append(
      tile(square('yes'),'Con evidencia',s.yes,'Sí','Persona/día con publicación registrada'),
      tile(square('no'),'Sin evidencia',s.no,'No',`${plural(s.withNo,'persona','personas')} con al menos un No`),
      tile(icon('users'),'Colaboradores',s.persons.length,`en ${plural(s.areas,'área','áreas')}`,'Equipo activo del período'),
      tile(square('na'),'No aplica',s.notApplicable,s.notApplicable===1?'día':'días','Sin Facebook asignado o no incorporado')
    );

    const chart=el('div',`fbr-card fbr-chart${long?' is-long':''}`),head=el('div','fbr-chart-head'),legend=el('div','fbr-legend');
    legend.append(...[['ok','≥ 80 %'],['mid','50–79 %'],['no','< 50 %']].map(([tone,text])=>{const item=el('span');item.append(square(tone),el('span',null,text));return item;}));
    const goalKey=el('span');goalKey.append(el('i','fbr-goal-key'),el('span',null,`Meta ${GOAL} %`));legend.append(goalKey);
    if(long)legend.append(el('span','fbr-we-note','S D = fin de semana'));
    head.append(el('h5',null,long?'Cumplimiento diario':'Cumplimiento por día'),legend);
    const bars=el('div','fbr-bars'),plot=el('div','fbr-plot'),goal=el('div','fbr-goal');
    goal.setAttribute('aria-hidden','true');plot.append(goal);
    const labels=el('div','fbr-xl');
    s.daily.forEach(day=>{
      const column=el('div',`fbr-bcol${weekend(day.date)?' is-we':''}`),fill=el('i',`fbr-b is-${level(day.pct).tone}`);
      const height=day.pct==null?0:Math.max(2,day.pct);
      fill.setAttribute('style',`height:${height.toFixed(1)}%`);
      column.title=`${pretty(day.date)} · ${fmtPct(day.pct)} · ${day.yes} Sí · ${day.no} No`;
      column.append(fill);
      if(!long){const tag=el('span','fbr-bv',day.pct==null?'—':`${Math.round(day.pct)} %`);tag.setAttribute('style',`bottom:calc(${height.toFixed(1)}% + 4px)`);column.append(tag);}
      plot.append(column);
      const label=el('div',weekend(day.date)?'is-we':null);
      if(long)label.textContent=String(parts(day.date).day);
      else label.append(el('span',null,dayLabel(day.date)),el('small',null,`${day.yes} Sí · ${day.no} No`));
      labels.append(label);
    });
    bars.append(plot);
    const note=insight(s.daily),line=el('p',`fbr-insight${note.tone?' is-'+note.tone:''}`);
    line.append(icon('trend'),el('span',null,note.text));
    chart.append(head,bars,labels,line);

    container.append(hero,tiles,chart);
  }

  // ── Tabla por área con detalle desplegable ────────────────────────────────
  function sorter(sort,tie){
    return (a,b)=>{
      let x=a[sort.key],y=b[sort.key];
      if(x==null&&y==null)return tie(a,b);
      if(x==null)return 1;
      if(y==null)return -1;
      const result=typeof x==='string'?x.localeCompare(y,'es'):x-y;
      return (sort.dir==='asc'?result:-result)||tie(a,b);
    };
  }
  function headerCell(column,sort,onSort){
    const th=el('th',column.num?'r':column.className||null);th.setAttribute('scope','col');
    if(!column.key){th.textContent=column.label;return th;}
    const active=sort.key===column.key;
    th.setAttribute('aria-sort',active?(sort.dir==='asc'?'ascending':'descending'):'none');
    const button=el('button',`fbr-sort${active?' is-active':''}`);button.type='button';
    button.append(el('span',null,column.label));if(active)button.append(icon(sort.dir==='asc'?'up':'down'));
    button.onclick=event=>{event?.stopPropagation?.();onSort(column.key,column.num||column.key==='pct');};
    th.append(button);
    return th;
  }
  function nextSort(sort,key,numeric,numericDefault='desc'){
    if(sort.key===key)return {key,dir:sort.dir==='asc'?'desc':'asc'};
    return {key,dir:numeric?numericDefault:'asc'};
  }
  const AREA_COLUMNS=[{key:'area',label:'Área',className:'fbr-col-area'},{key:'people',label:'Personas',num:true},{key:'yes',label:'Sí',num:true},{key:'no',label:'No',num:true},{key:'evaluated',label:'Evaluados',num:true},{key:'pct',label:'Cumplimiento'},{label:'Nivel'}];

  function drillTable(group,compact){
    const inner=el('div','fbr-drill-inner'),table=el('table','fbr-table fbr-sub'),head=el('thead'),body=el('tbody'),foot=el('tfoot');
    const hr=el('tr');hr.append(el('th','fbr-col-person','Colaborador'));
    if(compact){const th=el('th');th.append(heatHeader(group.dates));hr.append(th);}
    else group.dates.forEach(date=>{const th=el('th','ctr',dayLabel(date));th.title=pretty(date);hr.append(th);});
    hr.append(el('th','r','Sí'),el('th','r','No'),el('th',null,'Cumplimiento'));
    for(const th of hr.children)th.setAttribute('scope','col');
    head.append(hr);
    group.persons.forEach(person=>{
      const t=tally(person.cells),tr=el('tr'),name=el('th','fbr-who');name.setAttribute('scope','row');
      const ref={id:person.id,nombre:person.nombre,area:group.area};
      name.append(avatar(person.nombre),el('span',null,person.nombre));tr.append(name);
      if(compact)tr.append(cellWith(heatCells(ref,group.dates,person.cells)));
      else person.cells.forEach((cell,index)=>{const td=el('td','ctr');evidenceCell(td,ref,group.dates[index],cell);tr.append(td);});
      tr.append(numCell(t.yes,'y'),numCell(t.no,'n'),cellWith(bar(t.pct)));
      body.append(tr);
    });
    const t=tally(group.persons.flatMap(p=>p.cells)),fr=el('tr');
    fr.append(el('th',null,'Total diario · Sí / No'));
    if(compact)fr.append(el('td','fbr-muted','Pasa el cursor por cada día para ver su fecha'));
    else group.totals.forEach(total=>{
      const td=el('td','ctr fbr-split-count');
      td.append(el('span','is-y',total.yes),el('span','fbr-muted',' / '),el('span',total.no?'is-n':'is-zero',total.no));
      td.title=`Sí: ${total.yes}, No: ${total.no}`;fr.append(td);
    });
    fr.append(numCell(t.yes,'y'),numCell(t.no,'n'),cellWith(bar(t.pct)));
    foot.append(fr);
    table.append(head,body,foot);inner.append(table);
    return inner;
  }

  function renderAreaTable(groups){
    const container=get('fb-report-matrix');if(!container)return;
    container.replaceChildren();
    container.dataset.singleArea=String(groups.length===1);
    if(!groups.length){container.append(el('p','fb-report-matrix-empty','No hay colaboradores para esta área y período.'));return;}
    const compact=groups[0].dates.length>COMPACT_DAYS;
    const areas=groups.map(group=>{
      const yes=group.totals.reduce((n,t)=>n+t.yes,0),no=group.totals.reduce((n,t)=>n+t.no,0);
      return {group,area:group.area,people:group.persons.length,yes,no,evaluated:yes+no,pct:yes+no?yes/(yes+no)*100:null};
    }).sort(sorter(areaSort,(a,b)=>a.area.localeCompare(b.area,'es')));

    const wrap=el('div','fbr-table-wrap'),table=el('table','fbr-table fbr-area-table'),head=el('thead'),body=el('tbody'),foot=el('tfoot');
    wrap.setAttribute('role','region');wrap.setAttribute('aria-label','Cumplimiento de Facebook por área');
    const hr=el('tr');
    AREA_COLUMNS.forEach(column=>hr.append(headerCell(column,areaSort,(key,numeric)=>{areaSort=nextSort(areaSort,key,numeric);renderAreaTable(cachedGroups);syncSortLabel();})));
    head.append(hr);

    areas.forEach((row,index)=>{
      const open=groups.length===1||openAreas.has(row.area),lvl=level(row.pct),detailId=`fb-area-detail-${index}`;
      const tr=el('tr',`fbr-area-row${row.pct!=null&&row.pct<50?' is-flag':''}${open?' is-open':''}`);
      const th=el('th');th.setAttribute('scope','row');
      const toggle=el('button','fbr-area-toggle');toggle.type='button';
      toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-controls',detailId);
      toggle.append(icon('chevr'),el('span','fbr-area-name',row.area));th.append(toggle);
      tr.append(th,numCell(row.people),numCell(row.yes,'y'),numCell(row.no,'n'),numCell(row.evaluated),cellWith(bar(row.pct)),cellWith(chip(lvl.label,lvl.tone)));
      const drill=el('tr','fbr-drill');drill.id=detailId;drill.hidden=!open;
      const cell=el('td');cell.colSpan=AREA_COLUMNS.length;cell.append(drillTable(row.group,compact));drill.append(cell);
      const setOpen=value=>{
        if(value)openAreas.add(row.area);else openAreas.delete(row.area);
        tr.classList.toggle('is-open',value);toggle.setAttribute('aria-expanded',String(value));drill.hidden=!value;
      };
      tr.onclick=()=>setOpen(drill.hidden);
      body.append(tr,drill);
    });

    const yes=areas.reduce((n,a)=>n+a.yes,0),no=areas.reduce((n,a)=>n+a.no,0),pct=yes+no?yes/(yes+no)*100:null,lvl=level(pct);
    const fr=el('tr'),title=el('th',null,`Total · ${plural(areas.length,'área','áreas')}`);title.setAttribute('scope','row');
    fr.append(title,numCell(areas.reduce((n,a)=>n+a.people,0)),numCell(yes,'y'),numCell(no,'n'),numCell(yes+no),cellWith(bar(pct)),cellWith(chip(lvl.label,lvl.tone)));
    foot.append(fr);
    table.append(head,body,foot);wrap.append(table);container.append(wrap);
  }

  // ── Vista por persona ─────────────────────────────────────────────────────
  const PERSON_FILTERS=[['all','Todos'],['no','Con algún No'],['full','Completo'],['none','Sin evaluar']];
  const matchFilter=(person,filter)=>filter==='no'?person.no>0:filter==='full'?person.evaluated>0&&person.no===0:filter==='none'?person.evaluated===0:true;
  function visiblePersons(groups){
    const query=(get('fb-report-search')?.value||'').trim().toLowerCase();
    const base=groups.flatMap(g=>g.persons.map(p=>({id:p.id,nombre:p.nombre,area:g.area,cells:p.cells,...tally(p.cells)})))
      .filter(p=>!query||p.nombre.toLowerCase().includes(query)||p.area.toLowerCase().includes(query));
    const list=base.filter(p=>matchFilter(p,personFilter)).sort(sorter(personSort,(a,b)=>b.no-a.no||a.nombre.localeCompare(b.nombre,'es')));
    return {base,list,query};
  }
  function renderPersonFilters(base){
    const box=get('fb-report-person-filters');if(!box)return;
    box.replaceChildren();
    PERSON_FILTERS.forEach(([key,label])=>{
      const on=personFilter===key,button=el('button',`fbr-fchip${on?' is-on':''}`);
      button.type='button';button.setAttribute('aria-pressed',String(on));
      button.append(el('span',null,label),el('em',null,base.filter(p=>matchFilter(p,key)).length));
      button.onclick=()=>{personFilter=key;renderPersonView(cachedGroups);syncExportCopy();};
      box.append(button);
    });
  }
  function personEmpty(container,query){
    const box=el('div','fbr-empty'),filter=PERSON_FILTERS.find(([key])=>key===personFilter)?.[1];
    const what=[query?`«${get('fb-report-search').value.trim()}»`:'',personFilter!=='all'?`«${filter}»`:''].filter(Boolean).join(' + ');
    const ic=icon('search');ic.classList.add('fbr-empty-ic');
    const reset=el('button','fbr-btn fbr-btn-ghost fbr-btn-sm','Quitar filtros');reset.type='button';
    reset.onclick=()=>{get('fb-report-search').value='';personFilter='all';renderPersonView(cachedGroups);syncExportCopy();};
    box.append(ic,el('b',null,`Nadie coincide con ${what||'los filtros'}`),el('p',null,personFilter==='full'?'Las personas encontradas tienen días sin evidencia en este período.':'Prueba con otro nombre, otra área u otro filtro.'),reset);
    container.append(box);
  }
  function renderPersonView(groups){
    const container=get('fb-report-person-view');if(!container)return;
    container.replaceChildren();
    const {base,list,query}=visiblePersons(groups);
    renderPersonFilters(base);
    if(!groups.length){container.append(el('p','fb-report-matrix-empty','No hay colaboradores para esta área y período.'));return;}
    if(!list.length){personEmpty(container,query);return;}
    const dates=groups[0].dates,compact=dates.length>COMPACT_DAYS;
    const wrap=el('div','fbr-table-wrap'),table=el('table',`fbr-table fbr-person-table${compact?' is-heat':''}`),head=el('thead'),body=el('tbody'),foot=el('tfoot');
    wrap.setAttribute('role','region');wrap.setAttribute('aria-label','Facebook · Reporte por persona');wrap.setAttribute('tabindex','0');
    const onSort=(key,numeric)=>{personSort=nextSort(personSort,key,numeric,key==='pct'?'asc':'desc');renderPersonView(cachedGroups);syncSortLabel();};
    const hr=el('tr');
    // El mapa de calor necesita el ancho: sin número de fila ni nivel (la barra ya lo indica).
    if(!compact){const number=el('th','r fbr-col-n','#');number.setAttribute('scope','col');hr.append(number);}
    const who=headerCell({key:'nombre',label:'Colaborador',className:'fbr-col-person'},personSort,onSort);
    const areaSortButton=headerCell({key:'area',label:'Área'},personSort,onSort).children[0];
    if(areaSortButton){areaSortButton.classList.add('is-secondary');who.append(areaSortButton);}
    hr.append(who);
    if(compact){const th=el('th');th.setAttribute('scope','col');th.append(heatHeader(dates));hr.append(th);}
    else dates.forEach(date=>{const th=el('th','ctr',dayLabel(date));th.setAttribute('scope','col');th.title=pretty(date);hr.append(th);});
    hr.append(headerCell({key:'yes',label:'Sí',num:true},personSort,onSort),headerCell({key:'no',label:'No',num:true},personSort,onSort),headerCell({key:'pct',label:'Cumplimiento'},personSort,onSort));
    if(!compact)hr.append(headerCell({label:'Nivel'},personSort,onSort));
    head.append(hr);

    list.forEach((person,index)=>{
      const tr=el('tr'),name=el('th','fbr-who');name.setAttribute('scope','row');
      const text=el('span','fbr-who-text');text.append(el('b',null,person.nombre),el('small',null,person.area));
      name.append(avatar(person.nombre),text);
      if(!compact)tr.append(el('td','r fbr-muted',index+1));
      tr.append(name);
      if(compact)tr.append(cellWith(heatCells(person,dates,person.cells)));
      else person.cells.forEach((cell,i)=>{const td=el('td','ctr');evidenceCell(td,person,dates[i],cell);tr.append(td);});
      const lvl=level(person.pct);
      tr.append(numCell(person.yes,'y'),numCell(person.no,'n'),cellWith(bar(person.pct)));
      if(!compact)tr.append(cellWith(chip(lvl.label,lvl.tone)));
      body.append(tr);
    });

    const yes=list.reduce((n,p)=>n+p.yes,0),no=list.reduce((n,p)=>n+p.no,0),pct=yes+no?yes/(yes+no)*100:null,lvl=level(pct);
    const fr=el('tr');
    if(!compact)fr.append(el('td'));
    fr.append(el('th',null,`${plural(list.length,'persona','personas')} · ${compact?'totales del filtro':'Sí / No por día'}`));
    if(compact)fr.append(el('td'));
    else dates.forEach((_,i)=>{
      const y=list.filter(p=>p.cells[i]?.value==='Sí').length,n=list.filter(p=>p.cells[i]?.value==='No').length,td=el('td','ctr fbr-split-count');
      td.append(el('span','is-y',y),el('span','fbr-muted',' / '),el('span',n?'is-n':'is-zero',n));td.title=`Sí: ${y}, No: ${n}`;fr.append(td);
    });
    fr.append(numCell(yes,'y'),numCell(no,'n'),cellWith(bar(pct)));
    if(!compact)fr.append(cellWith(chip(lvl.label,lvl.tone)));
    foot.append(fr);
    table.append(head,body,foot);wrap.append(table);container.append(wrap);
  }

  // ── Requieren atención ────────────────────────────────────────────────────
  function renderAttention(s){
    const box=get('fb-report-attention');if(!box)return;
    box.replaceChildren();
    const withNo=s.persons.filter(p=>p.no>0),strong=withNo.filter(p=>p.no>=2),pool=strong.length?strong:withNo;
    const list=[...pool].sort((a,b)=>b.no-a.no||(a.pct??101)-(b.pct??101)||a.nombre.localeCompare(b.nombre,'es')).slice(0,6);
    box.append(el('h5',null,'Requieren atención'),el('p','fbr-att-sub',strong.length?`${plural(strong.length,'persona','personas')} con 2 o más días sin evidencia`:withNo.length?`${plural(withNo.length,'persona','personas')} con 1 día sin evidencia`:'Nadie tiene días sin evidencia en este período.'));
    if(!withNo.length){
      const ok=el('div','fbr-att-ok');ok.append(icon('party'),el('span',null,'Todas las personas evaluadas tienen evidencia cada día.'));box.append(ok);return;
    }
    const people=el('div','fbr-att-list'),mini=s.dates.length<=COMPACT_DAYS;
    list.forEach(person=>{
      const row=el('button','fbr-att-person');row.type='button';
      const firstNo=s.dates[person.cells.findIndex(c=>c.value==='No')];
      row.setAttribute('aria-label',`${person.nombre}, ${person.area}: ${plural(person.no,'día','días')} sin evidencia. Ver evidencias.`);
      const text=el('span','fbr-who-text');text.append(el('b',null,person.nombre),el('small',null,person.area));
      row.append(avatar(person.nombre),text);
      if(mini){
        const days=el('span','fbr-minis');
        person.cells.forEach((cell,i)=>{const tone=cellTone(cell),mark=el('i',`fbr-mini is-${tone}`,tone==='yes'?'✓':tone==='no'?'✕':tone==='open'?'·':null);mark.title=`${pretty(s.dates[i])} · ${cell.value}`;days.append(mark);});
        row.append(days);
      }
      row.append(el('span','fbr-cnt-no',`${person.no} No`));
      row.onclick=()=>{if(APP.access?.rol!=='direccion'||!firstNo)return;drawer.returnFocus=row;openFacebookReportEvidence(person,firstNo);};
      people.append(row);
    });
    const more=el('button','fbr-att-more');more.type='button';
    more.append(el('span',null,`Ver ${withNo.length===1?'a la persona':'las '+withNo.length+' personas'} con algún No`),icon('arrow'));
    more.onclick=()=>{personFilter='no';personSort={key:'pct',dir:'asc'};get('fb-report-search').value='';setViewMode('person');};
    box.append(people,more);
  }

  // ── Vista, orden y textos de apoyo ────────────────────────────────────────
  function syncSortLabel(){
    const label=get('fb-report-sort-label');if(!label)return;
    const sort=currentViewMode==='area'?areaSort:personSort;
    const names={area:'Área',people:'Personas',yes:'Sí',no:'No',evaluated:'Evaluados',nombre:'Nombre'};
    if(sort.key==='pct')label.textContent=currentViewMode==='area'?(sort.dir==='desc'?'Mayor cumplimiento':'Menor cumplimiento'):(sort.dir==='asc'?'Menor cumplimiento primero':'Mayor cumplimiento primero');
    else label.textContent=`Orden: ${names[sort.key]} ${sort.dir==='asc'?'↑':'↓'}`;
  }
  function syncExportCopy(){
    const area=get('fb-report-area')?.value||'Todas las áreas',title=get('fb-report-export-title'),desc=get('fb-report-export-desc');
    if(!title||!desc)return;
    if(currentViewMode==='person'){title.textContent='Excel · vista por persona';desc.textContent=`La tabla por persona con el área (${area}), la búsqueda y el filtro actuales.`;}
    else{title.textContent='Excel · vista por área';desc.textContent=`Hojas Por área, Por persona y Revisión diaria. Respeta el área: ${area}.`;}
    const sticky=get('fb-sticky-area');if(sticky)sticky.textContent=area;
  }
  function syncViewChrome(){
    const mode=currentViewMode,long=(cachedGroups[0]?.dates.length||0)>COMPACT_DAYS;
    const btnArea=get('fb-btn-view-area'),btnPerson=get('fb-btn-view-person');
    btnArea.classList.toggle('active',mode==='area');btnArea.setAttribute('aria-selected',String(mode==='area'));
    btnPerson.classList.toggle('active',mode==='person');btnPerson.setAttribute('aria-selected',String(mode==='person'));
    get('fb-report-matrix').hidden=mode!=='area';
    get('fb-report-person-view').hidden=mode!=='person';
    get('fb-report-search-wrap').hidden=mode!=='person';
    get('fb-report-person-filters').hidden=mode!=='person';
    get('fb-report-legend').hidden=!(mode==='person'&&long);
    get('fb-report-table-hint').hidden=mode!=='area';
    get('fb-report-attention').hidden=mode!=='area';
    get('fb-report-split').dataset.view=mode;
    syncSortLabel();syncExportCopy();
  }
  function setViewMode(mode){
    currentViewMode=mode;
    syncViewChrome();
    if(mode==='person'&&cachedGroups.length)renderPersonView(cachedGroups);
  }
  function renderScope(){
    const scope=get('fb-report-scope');if(!scope)return;
    scope.replaceChildren();
    const show=provisional();scope.hidden=!show;
    if(!show)return;
    const now=data.hoy||today(),text=el('div');
    text.append(el('b',null,'Provisional.'),el('span',null,data.hasta>=now?` El período incluye hoy (${shortDate(now)}). Los «No» de franjas aún abiertas pueden cambiar cuando se registre la evidencia.`:' Hay franjas aún abiertas. Los «No» pueden cambiar cuando se registre la evidencia.'));
    scope.append(icon('clock'),text);
  }
  function syncSticky(s){
    const badge=get('fb-sticky-chip');if(!badge)return;
    const lvl=level(s.pct);badge.className=`fbr-chip is-${lvl.tone}`;
    badge.textContent=s.pct==null?'Sin evaluar':`${fmtPct(s.pct)} · ${lvl.label}`;
  }

  function render(){
    if(!data)return;
    const groups=m.matrix(rows(),data.desde,data.hasta);
    cachedGroups=groups;
    const s=summarize(groups);
    get('fb-report-split').dataset.long=String(s.dates.length>COMPACT_DAYS);
    renderKpis(s);
    renderAreaTable(groups);
    renderPersonView(groups);
    renderAttention(s);
    renderScope();
    syncViewChrome();syncSticky(s);
    setStateChip(provisional()?'provisional':'closed');
    get('fb-report-results').hidden=false;showEmpty(null);
    get('fb-report-export').disabled=!groups.length;
    get('fb-report-pdf').disabled=pdfBusy||!data.filas.length;
    syncDownloads();
    if(drawer.open){if(findPerson(drawer.personId))markSelected();else closeDrawer();}
  }

  // ── Comparación con el período anterior (después de pintar) ───────────────
  function previousRange(){
    const kind=get('fb-report-kind').value,from=get('fb-report-from').value,to=get('fb-report-to').value;
    if(kind==='lunes'||kind==='jueves'){const prev=m.cutoff(m.shift(get('fb-report-reference').value,-7),kind);return {desde:prev.desde,hasta:prev.hasta,label:'vs corte anterior'};}
    if(kind==='general'){const end=m.shift(from,-1);return {desde:end.slice(0,8)+'01',hasta:end,label:'vs mes anterior'};}
    const length=rangeDays(from,to);
    return length?{desde:m.shift(from,-length),hasta:m.shift(from,-1),label:'vs período anterior'}:null;
  }
  function loadComparison(token){
    if(typeof requestAnimationFrame!=='function')return;
    const prev=previousRange();if(!prev||prev.desde<'2020-01-01')return;
    requestAnimationFrame(async()=>{
      try{
        const result=await db.rpc('dash_reporte_facebook',{p_desde:prev.desde,p_hasta:prev.hasta});
        if(token!==request||result.error||!Array.isArray(result.data?.filas))return;
        comparison={...prev,filas:result.data.filas};
        renderKpis(summarize(cachedGroups));
      }catch(_){/* Sin comparación: el reporte principal sigue completo. */}
    });
  }

  window.loadAdminFacebookReport=async()=>{
    if(APP.access?.rol!=='direccion')return;
    clear();const token=request,from=get('fb-report-from').value,to=get('fb-report-to').value,status=get('fb-report-status');
    status.dataset.error='false';
    try{
      m.days(from,to);if(from<'2020-01-01'||to>today())throw new Error('Selecciona fechas desde 2020 y como máximo hasta hoy.');
      status.textContent='Consultando Facebook…';setStateChip('loading');get('fb-report-results').setAttribute('aria-busy','true');
      const result=await db.rpc('dash_reporte_facebook',{p_desde:from,p_hasta:to});
      if(token!==request)return;
      if(result.error){
        if(result.error.code==='PGRST202')throw new Error('El reporte aún no está habilitado. Falta aplicar la migración 64 de reportes Facebook y su actualización 65.');
        if(result.error.message?.includes('hasta ayer'))throw new Error('Falta actualizar el reporte en Supabase: aplica la migración 65 para consultar hoy.');
        throw new Error('No se pudo consultar el reporte. Revisa tu conexión y vuelve a intentarlo.');
      }
      if(!result.data||!Array.isArray(result.data.filas))throw new Error('El servidor devolvió un reporte inválido. Vuelve a intentarlo.');
      data=result.data;
      const selected=get('fb-report-area').value;
      get('fb-report-area').replaceChildren(new Option('Todas las áreas',''),...[...new Set(data.filas.map(r=>r.area))].sort((a,b)=>a.localeCompare(b,'es')).map(area=>new Option(area,area)));
      get('fb-report-area').value=[...get('fb-report-area').options].some(o=>o.value===selected)?selected:'';
      render();status.textContent=updatedText(data.generado_at);
      loadComparison(token);
      return true;
    }catch(error){
      if(token!==request)return;
      status.dataset.error='true';status.textContent=error.message||'No se pudo cargar el reporte. Vuelve a intentarlo.';
      setStateChip('error');showEmpty('error',status.textContent);
      return false;
    }
    finally{if(token===request)get('fb-report-results').setAttribute('aria-busy','false');}
  };

  // ── Panel lateral de evidencia ────────────────────────────────────────────
  function findPerson(id){
    for(const group of cachedGroups){const person=group.persons.find(p=>String(p.id)===String(id));if(person)return {person,group};}
    return null;
  }
  function markSelected(){
    const section=get('admin-facebook-section');
    if(!section||typeof section.querySelectorAll!=='function')return;
    section.querySelectorAll('.fb-evidence-cell[data-selected]').forEach(button=>delete button.dataset.selected);
    if(drawer.open)section.querySelectorAll(`.fb-evidence-cell[data-person="${CSS.escape(String(drawer.personId))}"][data-date="${drawer.date}"]`).forEach(button=>{button.dataset.selected='true';});
  }
  function answerChip(answer){
    const tone=cellTone(answer);
    if(tone==='yes'){const c=chip('Con evidencia','ok');c.prepend(icon('check'));return c;}
    if(tone==='open'){const c=chip('En plazo · cuenta como No','info');c.prepend(icon('clock'));return c;}
    if(tone==='no'){const c=chip('Sin evidencia','no');c.prepend(icon('x'));return c;}
    return chip(answer.value,'na');
  }
  function openDrawer(personId,date){
    const found=findPerson(personId);if(!found)return;
    const {person,group}=found,index=group.dates.indexOf(date);if(index<0)return;
    const box=get('fb-evidence-drawer'),wasOpen=drawer.open;
    drawer.open=true;drawer.personId=person.id;drawer.date=date;
    box.hidden=false;get('admin-facebook-section').classList.add('has-drawer');
    get('fb-evidence-name').textContent=person.nombre;
    get('fb-evidence-meta').textContent=`${group.area} · ${longDate(date)}`;
    const answer=person.cells[index],row=(data?.filas||[]).find(r=>String(r.id)===String(person.id)&&r.fecha===date);
    const chips=get('fb-evidence-chips');chips.replaceChildren(answerChip(answer));
    const review={pendiente:['Pendiente de revisión','mid'],aprobada:['Aprobada','ok'],observada:['Requiere corrección','no']}[row?.revision];
    if(answer.value==='Sí'&&review)chips.append(chip(review[0],review[1]));

    drawer.detail?.dispose?.();drawer.detail=null;
    const host=get('fb-evidence-detail');host.replaceChildren();
    if(['Sí','No'].includes(answer.value)&&typeof KJAMonthDayDetail!=='undefined')drawer.detail=KJAMonthDayDetail.mount(host,{person:{id:person.id,nombre:person.nombre},day:{fecha:date,laborable:true},facebookOnly:true});
    else host.append(el('p','fbr-drawer-note',`${answer.value}: este día no se evalúa y no suma al total.`));

    const strip=get('fb-evidence-strip'),compact=group.dates.length>COMPACT_DAYS;
    strip.replaceChildren();strip.classList.toggle('is-compact',compact);
    group.dates.forEach((day,i)=>{
      const tone=cellTone(person.cells[i]),button=el('button',`fbr-day${day===date?' is-on':''}`);
      button.type='button';button.title=`${pretty(day)} · ${person.cells[i].value}`;
      button.setAttribute('aria-label',`${longDate(day)}: ${person.cells[i].value}`);
      if(day===date)button.setAttribute('aria-current','date');
      if(!compact)button.append(el('span',null,dayLabel(day)));
      button.append(el('i',`fbr-mini is-${tone}`,tone==='yes'?'✓':tone==='no'?'✕':tone==='open'?'·':null));
      button.onclick=()=>openDrawer(person.id,day);
      strip.append(button);
    });
    get('fb-evidence-prev').disabled=index===0;
    get('fb-evidence-next').disabled=index===group.dates.length-1;
    markSelected();
    if(!wasOpen)get('fb-evidence-close')?.focus?.({preventScroll:true});
  }
  function closeDrawer(){
    if(!drawer.open)return;
    drawer.detail?.dispose?.();drawer.detail=null;drawer.open=false;
    get('fb-evidence-drawer').hidden=true;get('admin-facebook-section').classList.remove('has-drawer');
    get('fb-evidence-detail').replaceChildren();
    markSelected();
    const back=drawer.returnFocus;drawer.returnFocus=null;
    if(back?.isConnected)back.focus?.({preventScroll:true});
  }
  function moveDay(delta){
    const found=findPerson(drawer.personId);if(!found)return;
    const dates=found.group.dates,next=dates[dates.indexOf(drawer.date)+delta];
    if(next)openDrawer(drawer.personId,next);
  }
  function movePerson(delta){
    const order=currentViewMode==='person'?visiblePersons(cachedGroups).list.map(p=>p.id):(findPerson(drawer.personId)?.group.persons.map(p=>p.id)||[]);
    const next=order[order.findIndex(id=>String(id)===String(drawer.personId))+delta];
    if(next!=null)openDrawer(next,drawer.date);
  }
  window.openFacebookReportEvidence=(person,date)=>{
    if(APP.access?.rol!=='direccion')return;
    openDrawer(person.id,date);
  };

  // ── Descargas ─────────────────────────────────────────────────────────────
  function exportGroups(){
    const groups=m.matrix(rows(),data.desde,data.hasta);
    if(currentViewMode!=='person'||personFilter==='all')return groups;
    return groups.map(group=>{
      const persons=group.persons.filter(p=>matchFilter(tally(p.cells),personFilter));
      return {...group,persons,totals:group.dates.map((_,i)=>({yes:persons.filter(p=>p.cells[i].value==='Sí').length,no:persons.filter(p=>p.cells[i].value==='No').length}))};
    });
  }
  get('fb-report-export').onclick=()=>{
    if(!data)return;
    const button=get('fb-report-export');button.disabled=true;closePopovers();
    try{
      const currentArea=get('fb-report-area')?.value||'';
      const bytes=globalThis.KJAFacebookExcel.build(exportGroups(),{...data,area:currentArea,view:currentViewMode,search:currentViewMode==='person'?(get('fb-report-search')?.value||''):'',provisional:provisional()});
      const url=URL.createObjectURL(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})),link=document.createElement('a');
      link.href=url;link.download=`facebook_${data.desde}_${data.hasta}.xlsx`;
      document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(error){get('fb-report-status').dataset.error='true';get('fb-report-status').textContent=error.code==='EMPTY_PREVIEW'?'No hay colaboradores para exportar. Cambia la búsqueda, el filtro o el área seleccionada.':'No se pudo preparar el Excel. Actualiza la página e inténtalo nuevamente.';}
    finally{button.disabled=false;syncDownloads();}
  };

  get('fb-report-pdf').onclick=async()=>{
    if(!data||pdfBusy)return;
    const snapshot=data,token=request,meta={...snapshot,provisional:provisional()},button=get('fb-report-pdf'),trigger=get('fb-report-download');
    pdfBusy=true;button.disabled=true;closePopovers();
    get('fb-report-pdf-label').textContent='Preparando PDF…';get('fb-report-download-label').textContent='Preparando PDF…';trigger?.classList.add('is-busy');
    try{
      await globalThis.KJAFacebookPDF.load();
      if(token!==request)return;
      const groups=m.matrix(snapshot.filas,snapshot.desde,snapshot.hasta);
      const bytes=globalThis.KJAFacebookPDF.build(groups,meta);
      const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'})),link=document.createElement('a');
      link.href=url;link.download=`facebook_detalle_${snapshot.desde}_${snapshot.hasta}.pdf`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
      get('fb-report-status').dataset.error='false';get('fb-report-status').textContent='PDF preparado: detalle de todas las áreas y ranking final.';
    }catch(error){if(token===request){get('fb-report-status').dataset.error='true';get('fb-report-status').textContent='No se pudo preparar el PDF. Vuelve a intentarlo.';}}
    finally{
      pdfBusy=false;button.disabled=!data?.filas.length;
      get('fb-report-pdf-label').textContent='PDF completo';get('fb-report-download-label').textContent='Descargar';trigger?.classList.remove('is-busy');
      syncDownloads();
    }
  };

  // ── Menús emergentes y teclado ────────────────────────────────────────────
  function closePopovers(){
    popovers.forEach(([trigger,panel])=>{panel.hidden=true;trigger.setAttribute('aria-expanded','false');});
    closeCalendar();
  }
  function popover(trigger,panel){
    if(!trigger||!panel)return;
    trigger.onclick=event=>{
      event?.stopPropagation?.();
      const open=panel.hidden;closePopovers();
      if(open){panel.hidden=false;trigger.setAttribute('aria-expanded','true');}
    };
    popovers.push([trigger,panel]);
  }
  function initListeners(){
    get('fb-report-form').addEventListener('submit',event=>{event.preventDefault();runLoad();});
    get('fb-report-kind').onchange=()=>{
      const kind=get('fb-report-kind').value;closeCalendar();
      if(kind==='custom'){syncControls();openCalendar('range');return;}
      get('fb-report-reference').value=kind==='general'?today():m.shift(today(),1);
      period();scheduleLoad();
    };
    get('fb-report-reference').onchange=()=>{period();scheduleLoad();};
    for(const id of ['fb-report-from','fb-report-to'])get(id).onchange=()=>{
      if(get('fb-report-kind').value==='custom'){period();scheduleLoad();}else clear();
    };
    get('fb-report-area').onchange=()=>{render();syncExportCopy();};
    get('fb-btn-view-area').addEventListener('click',()=>setViewMode('area'));
    get('fb-btn-view-person').addEventListener('click',()=>setViewMode('person'));
    get('fb-report-search').addEventListener('input',()=>{if(cachedGroups.length)renderPersonView(cachedGroups);});
    get('fb-report-sort').onclick=()=>{
      if(currentViewMode==='area'){areaSort=areaSort.key==='pct'?{key:'pct',dir:areaSort.dir==='desc'?'asc':'desc'}:{key:'pct',dir:'desc'};renderAreaTable(cachedGroups);}
      else{personSort=personSort.key==='pct'?{key:'pct',dir:personSort.dir==='asc'?'desc':'asc'}:{key:'pct',dir:'asc'};renderPersonView(cachedGroups);}
      syncSortLabel();
    };
    get('fb-report-prev').onclick=()=>step(-1);
    get('fb-report-next').onclick=()=>step(1);
    get('fb-report-pick').onclick=event=>{
      event?.stopPropagation?.();
      if(!get('fb-calendar-popover').hidden){closeCalendar();return;}
      openCalendar(get('fb-report-kind').value==='custom'?'range':'single');
    };
    get('fb-cal-prev').onclick=event=>{event?.stopPropagation?.();cal.month--;if(cal.month<0){cal.month=11;cal.year--;}renderCalendar();};
    get('fb-cal-next').onclick=event=>{event?.stopPropagation?.();cal.month++;if(cal.month>11){cal.month=0;cal.year++;}renderCalendar();};
    get('fb-cal-apply').onclick=event=>{event?.stopPropagation?.();applyRange();};
    get('fb-evidence-close').onclick=closeDrawer;
    get('fb-evidence-prev').onclick=()=>moveDay(-1);
    get('fb-evidence-next').onclick=()=>moveDay(1);
    popover(get('fb-report-download'),get('fb-report-download-menu'));
    popover(get('fb-report-help-btn'),get('fb-report-help'));

    if(typeof document.addEventListener!=='function')return;
    get('fb-report-kinds').querySelectorAll('[data-kind]').forEach(button=>button.addEventListener('click',event=>{
      event.stopPropagation();
      const kind=button.dataset.kind,select=get('fb-report-kind');
      if(kind==='custom'){if(select.value!=='custom'){select.value='custom';syncControls();}openCalendar('range');return;}
      if(select.value===kind)return;
      select.value=kind;select.onchange();
    }));
    get('fb-cal-presets').querySelectorAll('[data-preset]').forEach(button=>button.addEventListener('click',event=>{event.stopPropagation();applyPreset(button.dataset.preset);}));
    document.addEventListener('click',event=>{
      if(event.target.closest?.('#admin-facebook-section .fbr-pop-wrap'))return;
      closePopovers();
    });
    document.addEventListener('keydown',event=>{
      if(get('admin-facebook-section').hidden)return;
      if(event.key==='Escape'){
        const open=popovers.some(([,panel])=>!panel.hidden)||!get('fb-calendar-popover').hidden;
        if(open){closePopovers();return;}
        if(drawer.open){event.preventDefault();closeDrawer();}
        return;
      }
      if(!drawer.open||event.altKey||event.ctrlKey||event.metaKey)return;
      if(event.target.closest?.('input,textarea,select,[contenteditable="true"]'))return;
      const moves={ArrowLeft:()=>moveDay(-1),ArrowRight:()=>moveDay(1),ArrowUp:()=>movePerson(-1),ArrowDown:()=>movePerson(1)};
      if(moves[event.key]){event.preventDefault();moves[event.key]();}
    });
    // Barra compacta cuando la cabecera sale de la vista.
    const sticky=get('fb-report-sticky'),head=get('fb-report-head');
    if(typeof IntersectionObserver==='function'&&sticky&&head){
      new IntersectionObserver(([entry])=>sticky.classList.toggle('is-on',!entry.isIntersecting&&!get('fb-report-results').hidden),{threshold:0}).observe(head);
    }
  }

  const refresh=get('admin-refresh'),previousRefresh=refresh.onclick;
  refresh.onclick=event=>APP.adminSection==='facebook'?runLoad():previousRefresh?.call(refresh,event);
  initListeners();
  const limit=m.shift(today(),1),monday=m.cutoff(limit,'lunes'),thursday=m.cutoff(limit,'jueves');
  get('fb-report-kind').value=monday.report>thursday.report?'lunes':'jueves';
  get('fb-report-reference').value=limit;period();setViewMode('area');
})();
