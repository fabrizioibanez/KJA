/* Clasificación explicable. Ninguna simulación otorga premios ni cambia registros. */
(function(){'use strict';
  const get=id=>document.getElementById(id),model=window.KJARankingModel;
  const CRITERION_KEYS=['entrada','rpe','facebook','salida'];
  const labels={entrada:'Entrada puntual',rpe:'RPE en jornadas virtuales',facebook:'Comparticiones de Facebook',salida:'Salida en horario',penalizacion:'Descuento por asignación',tope:'Descuento máximo'};
  const SHORT_LABELS={entrada:'Entrada',rpe:'RPE',facebook:'Facebook',salida:'Salida'};
  const CRITERION_HELP={
    entrada:'Marca de entrada dentro de los minutos de tolerancia configurados por Dirección. Se compara con tus días laborables programados desde el día 1.',
    rpe:'Se evalúa únicamente en jornadas virtuales. Debe estar aprobado, tener archivo y haberse subido dentro de la jornada; también cuenta una carga auditada de Administración. Si todo el periodo fue presencial, recibe crédito neutral.',
    facebook:'Evidencias completas y aprobadas para cada día asignado en la agenda de comparticiones, trabajes o no ese día. Los pendientes de revisión y observados no suman aún.',
    salida:'Salida dentro de la ventana permitida (antes o después del horario programado según la política activa). Se evalúan solo las franjas ya terminadas.'
  };
  const CRITERION_ICONS={entrada:'🕐',rpe:'📄',facebook:'📘',salida:'🚪'};
  const CRITERION_COLORS={entrada:'#28649a',rpe:'#138574',facebook:'#7662a8',salida:'#a66a26'};

  let rows=[],weights={...model.defaults},request=0,stickyLeaderRow=null,exitPolicy=null;
  function rankingPhoto(host,row){
    host.textContent=initials(row.nombre);
    if(!row.foto_url)return;
    const image=el('img');image.src=row.foto_url;image.alt='';image.decoding='async';image.loading='lazy';
    image.onerror=()=>image.remove();host.append(image);
  }

  /* ── HELPERS ──────────────────────────────────────────── */
  function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n}
  function bar(value,max,label,key){
    const track=el('div',undefined,'ranking-bar'),fill=el('i');
    track.setAttribute('role','img');track.setAttribute('aria-label',label);
    fill.style.width=`${max>0?Math.min(100,Math.max(0,(value||0)/max*100)):0}%`;fill.dataset.criterion=key;track.append(fill);return track;
  }
  function initials(name){return(name||'KJ').split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase();}
  const point=n=>n===null?'Sin evaluar':n.toFixed(2);
  const names=Object.keys(model.pairs);

  /* ── WEIGHTS FORM ─────────────────────────────────────── */
  for(const [key,value] of Object.entries(weights)){
    const lbl=el('label',labels[key]),inp=el('input');
    inp.type='number';inp.min='0';inp.max='100';inp.step='1';inp.required=true;inp.value=value;inp.name=key;
    lbl.append(inp);get('ranking-weights').append(lbl);
  }

  /* ── MONTH SETUP ──────────────────────────────────────── */
  const now=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Lima',year:'numeric',month:'2-digit'}).format(new Date());
  get('ranking-month').value=now;get('ranking-month').max=now;

  function isCurrentMonth(){return get('ranking-month').value===now;}
  let pickerYear=Number(now.slice(0,4));
  const monthLabels=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  function updateMonthPicker(){
    const value=get('ranking-month').value;
    get('ranking-month-label').textContent=`${monthLabels[Number(value.slice(5))-1]} ${value.slice(0,4)}`;
    get('ranking-picker-year').textContent=pickerYear;
    get('ranking-year-next').disabled=pickerYear>=Number(now.slice(0,4));
    const options=get('ranking-month-options');options.replaceChildren();
    monthLabels.forEach((label,index)=>{
      const target=`${pickerYear}-${String(index+1).padStart(2,'0')}`,button=el('button',label);
      button.type='button';button.disabled=target>now;button.setAttribute('aria-pressed',String(target===value));
      button.onclick=()=>{get('ranking-month').value=target;get('ranking-month-picker').open=false;get('ranking-month-label').focus();withAdminSkeleton('ranking',()=>window.loadAdminRanking())};options.append(button);
    });
  }
  get('ranking-year-prev').onclick=()=>{pickerYear--;updateMonthPicker()};
  get('ranking-year-next').onclick=()=>{pickerYear++;updateMonthPicker()};
  get('ranking-month-picker').addEventListener('toggle',()=>{if(get('ranking-month-picker').open){pickerYear=Number(get('ranking-month').value.slice(0,4));updateMonthPicker()}});
  document.addEventListener('click',event=>{if(!get('ranking-month-picker').contains(event.target))get('ranking-month-picker').open=false});
  get('ranking-month-picker').addEventListener('keydown',event=>{if(event.key==='Escape'){get('ranking-month-picker').open=false;get('ranking-month-label').focus()}});

  function updateMonthStatus(){
    updateMonthPicker();
    const month=get('ranking-month').value;
    const isCurrent=month===now;
    const badge=get('ranking-month-badge');
    const desc=get('ranking-header-desc');
    const nextBtn=get('ranking-month-next');
    if(isCurrent){
      badge.textContent='BETA';badge.className='ranking-beta-badge';
      desc.innerHTML='Resultados provisionales · <strong>En desarrollo</strong>, los criterios pueden cambiar.';
    }else{
      const[y,m]=month.split('-');
      const monthName=new Intl.DateTimeFormat('es-PE',{month:'long',year:'numeric'}).format(new Date(Number(y),Number(m)-1,1));
      badge.textContent='HISTÓRICO';badge.className='ranking-beta-badge ranking-hist-badge';
      desc.innerHTML=`Registro cerrado · <strong>${monthName}</strong> · Resultados finales.`;
    }
    // Next button state: disabled if selected month >= current month
    const[ny,nm]=now.split('-').map(Number);
    const[sy,sm]=(month||now).split('-').map(Number);
    nextBtn.disabled=(sy>ny)||(sy===ny&&sm>=nm);
  }

  /* ── MONTH NAV ────────────────────────────────────────── */
  function shiftMonth(delta){
    const val=get('ranking-month').value||now;
    const[y,m]=val.split('-').map(Number);
    const d=new Date(y,m-1+delta,1);
    const next=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Lima',year:'numeric',month:'2-digit'}).format(d);
    const[ny,nm]=now.split('-').map(Number);
    const[ry,rm]=next.split('-').map(Number);
    if(ry>ny||(ry===ny&&rm>nm))return;
    get('ranking-month').value=next;
    withAdminSkeleton('ranking',()=>window.loadAdminRanking());
  }
  get('ranking-month-prev').addEventListener('click',()=>shiftMonth(-1));
  get('ranking-month-next').addEventListener('click',()=>shiftMonth(+1));
  get('ranking-month-today').addEventListener('click',()=>{if(!isCurrentMonth()){get('ranking-month').value=now;withAdminSkeleton('ranking',()=>window.loadAdminRanking());}});

  /* ── MODAL DETAIL ─────────────────────────────────────── */
  function openRankingDetail(row){
    const m=row.metricas||{};
    const modal=get('ranking-detail-modal');
    // Header
    rankingPhoto(get('ranking-detail-avatar'),row);
    get('ranking-detail-name').textContent=row.nombre;
    get('ranking-detail-area').textContent=row.area||'Área no registrada';
    get('ranking-detail-rank').textContent=row.rank?`#${row.rank}`:'—';
    const scoreEl=get('ranking-detail-score');
    scoreEl.textContent=row.score!==null?point(row.score):'Sin evaluar';
    scoreEl.dataset.quality=row.score===null?'na':row.score>=85?'high':row.score>=65?'mid':'low';
    // Criteria
    const grid=get('ranking-detail-criteria-grid');grid.replaceChildren();
    for(const key of CRITERION_KEYS){
      const[num,den]=model.pairs[key];
      const earned=row.parts[key],max=weights[key],done=Number(m[num]||0),total=Number(m[den]||0),neutralRpe=key==='rpe'&&total===0&&Number(m.rpe_exentos_presencial||0)>0;
      const card=el('div',undefined,'ranking-detail-criterion');
      card.style.setProperty('--criterion-color',CRITERION_COLORS[key]);
      const head=el('div',undefined,'ranking-detail-criterion-head');
      const tipEl=el('span','ⓘ','ranking-criterion-tip');
      tipEl.setAttribute('tabindex','0');tipEl.setAttribute('aria-label',CRITERION_HELP[key]);tipEl.dataset.tooltip=CRITERION_HELP[key];
      if(key==='salida'&&exitPolicy){
        const help=`Cuenta con estado Presente o Tardanza y salida entre ${exitPolicy.before} min antes y ${exitPolicy.after} min después del fin del horario. Puntos = salidas válidas ÷ días evaluados × ${max}.`;
        tipEl.setAttribute('aria-label',help);tipEl.dataset.tooltip=help;
      }
      head.append(el('span',CRITERION_ICONS[key],'ranking-detail-criterion-icon'),el('span',labels[key],'ranking-detail-criterion-label'),tipEl);
      const scoreLine=el('div',undefined,'ranking-detail-criterion-score');
      scoreLine.append(el('strong',neutralRpe?`Crédito neutral · ${point(earned)} / ${max} pts`:earned===null?'Sin programación':`${point(earned)} / ${max} pts`),el('small',neutralRpe?`${Number(m.rpe_exentos_presencial)} días presenciales exentos`:`${done} de ${total} días`));
      const barEl=bar(earned,max,`${labels[key]}: ${point(earned)} de ${max}`,key);barEl.classList.add('ranking-detail-bar');
      const pct=total?Math.min(100,Math.round(done/total*100)):null;
      const ring=el('div',undefined,'ranking-detail-ring');ring.style.setProperty('--progress',`${pct||0}%`);
      ring.setAttribute('role','img');ring.setAttribute('aria-label',`${SHORT_LABELS[key]}: ${neutralRpe?'exento por presencial':pct===null?'sin programación':pct+'% de cumplimiento'}`);
      ring.append(el('b',neutralRpe?'Exento':pct===null?'—':`${pct}%`));
      const missing=Math.max(0,total-done);
      const explanation=el('p',neutralRpe?'Exento por presencial: no se solicitó evidencia RPE.':!total?'Sin días programados.':missing?`${missing} ${missing===1?'día no suma':'días no suman'} puntos.`:'Cumplimiento completo.','ranking-detail-explanation');
      if(key==='salida'&&total)explanation.textContent=missing?`${missing} ${missing===1?'día sin salida válida':'días sin salida válida'}.`:'Todas las salidas evaluadas son válidas.';
      card.append(head,ring,scoreLine,explanation);grid.append(card);
    }
    // Evidence
    const evDl=get('ranking-detail-evidence-dl');evDl.replaceChildren();
    const req=Number(m.evidencias_requeridas||0),approved=Number(m.evidencias_aprobadas||0),uploaded=Number(m.evidencias_subidas||0),observed=Number(m.evidencias_observadas||0),pending=Number(m.revisiones_pendientes||0);
    const evItems=req?[['Aprobadas',`${approved} de ${req}`],['Subidas',`${uploaded}`],['Observadas',`${observed}`],['Pendientes de revisión',`${pending}`]]:[['Estado','Sin requisitos en los días evaluados']];
    for(const[dt,dd] of evItems){const d=el('div');d.append(el('dt',dt),el('dd',dd));evDl.append(d);}
    // Penalties
    const penDl=get('ranking-detail-penalties-dl');penDl.replaceChildren();
    const penItems=[['Asignaciones incumplidas',`${Number(m.asignaciones_incumplidas||0)}`],['Puntos descontados',`${row.penalty} (máx. ${weights.tope})`],['Penalización por tarea',`${weights.penalizacion} pts c/u`]];
    for(const[dt,dd] of penItems){const d=el('div');d.append(el('dt',dt),el('dd',dd));penDl.append(d);}
    // Footer
    get('ranking-detail-start').textContent=row.inicio||'Sin fecha registrada';
    get('ranking-detail-participation').textContent=`${Math.round(row.participation*100)}% (${m.dias||0} de ${m.dias_mes||0} días)`;
    get('ranking-detail-days').textContent=`${m.dias||0} trabajados · ${m.presentes||0} presencias`;
    modal.hidden=false;
    requestAnimationFrame(()=>modal.querySelector('.ranking-detail-sheet').focus());
  }
  function closeRankingDetail(){get('ranking-detail-modal').hidden=true;}
  document.addEventListener('click',e=>{if(e.target.closest('[data-close-ranking-detail]'))closeRankingDetail();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!get('ranking-detail-modal').hidden)closeRankingDetail();});

  /* ── STICKY BAR ───────────────────────────────────────── */
  function renderStickyBar(filtered,all){
    const stickyEl=get('ranking-sticky-bar');
    const indicators=get('ranking-sticky-indicators');
    const leaderBtn=get('ranking-sticky-leader');
    const areaLabel=get('ranking-sticky-area-label');
    const area=get('ranking-area').value;
    // 4 indicator chips
    indicators.replaceChildren();
    for(const key of CRITERION_KEYS){
      const[num,den]=model.pairs[key];
      const done=filtered.reduce((s,r)=>s+Number(r.metricas?.[num]||0),0);
      const expected=filtered.reduce((s,r)=>s+Number(r.metricas?.[den]||0),0);
      const pct=expected?Math.round(done/expected*100):null;
      const chip=el('div',undefined,'ranking-ring-stat');
      chip.style.setProperty('--cc',CRITERION_COLORS[key]);
      const ring=el('div',undefined,'ranking-metric-ring');
      ring.style.setProperty('--progress',`${pct===null?0:Math.min(100,Math.max(0,pct))}%`);
      ring.setAttribute('role','img');ring.setAttribute('aria-label',`${SHORT_LABELS[key]}: ${pct===null?'sin programación':pct+'%, '+done+' de '+expected+' días cumplidos'}`);
      ring.append(el('strong',pct===null?'—':`${pct}%`));
      chip.append(ring,el('b',SHORT_LABELS[key]),el('small',expected?`${done}/${expected} días`:'Sin programación'));
      indicators.append(chip);
    }
    // Leader chip
    const top=(area?filtered:all).find(r=>r.rank===1);
    stickyLeaderRow=top||null;
    leaderBtn.hidden=true;
    // Area label
    if(area){
      const sel=get('ranking-area');
      const areaName=sel.options[sel.selectedIndex]?.text||area;
      areaLabel.textContent=`📍 ${areaName}`;areaLabel.hidden=false;
    }else{areaLabel.hidden=true;}
    stickyEl.hidden=false;
  }
  get('ranking-sticky-leader').addEventListener('click',()=>{if(stickyLeaderRow)openRankingDetail(stickyLeaderRow);});

  /* ── RENDER ───────────────────────────────────────────── */
  function renderAnalytics(filtered){
    const summary=model.summarize(filtered),host=get('ranking-area-analytics'),insights=get('ranking-insights');
    host.replaceChildren(el('h3','Cumplimiento por área'),el('p','Promedio de puntajes evaluables · pulsa un área para ver sus criterios.'));
    const groups=new Map();
    filtered.forEach(row=>{const key=String(row.area_id);if(!groups.has(key))groups.set(key,{name:row.area||'Sin área',rows:[]});groups.get(key).rows.push(row)});
    const areas=[...groups.values()].map(group=>({...group,...model.summarize(group.rows)})).sort((a,b)=>(b.average??-1)-(a.average??-1));
    areas.forEach(area=>{
      const detail=el('details',undefined,'ranking-area-stat'),heading=el('summary');
      heading.append(el('span',area.name),el('b',area.average===null?'Sin evaluar':`${point(area.average)} pts`));
      detail.append(heading,bar(area.average,100,`${area.name}: ${area.average===null?'sin evaluar':point(area.average)+' puntos promedio'}`,'total'),el('small',`${area.evaluated} de ${area.count} personas evaluables`));
      const body=el('div',undefined,'ranking-area-reasons');
      const criteria=el('div',undefined,'ranking-area-criteria');
      area.criteria.forEach(c=>{
        const tile=el('div',undefined,'ranking-area-criterion');tile.style.setProperty('--criterion',CRITERION_COLORS[c.key]);
        const head=el('div',undefined,'ranking-area-criterion-heading');head.append(el('span',SHORT_LABELS[c.key]),el('b',c.rate===null?'—':`${Math.round(c.rate)}%`));
        tile.append(head,bar(c.rate,100,`${SHORT_LABELS[c.key]}: ${c.rate===null?'sin programación':Math.round(c.rate)+'% de cumplimiento'}`,c.key),el('small',c.rate===null?'Sin días programados':`${c.done} de ${c.expected} días cumplidos`));criteria.append(tile);
      });
      const audit=el('div',undefined,'ranking-area-audit');
      for(const [label,value] of [['Revisiones pendientes',String(area.pending)],['Descuento total',`${point(area.penalty)} pts`]]){
        const item=el('div');item.append(el('b',value),el('small',label));audit.append(item);
      }
      const lowest=area.criteria.filter(c=>c.rate!==null).sort((a,b)=>a.rate-b.rate)[0];
      const note=el('p',lowest?`Menor cumplimiento: ${SHORT_LABELS[lowest.key]} (${Math.round(lowest.rate)}%). Consulta las evidencias y los días programados para revisar el resultado.`:'No hay días programados para comparar los criterios.','ranking-area-reading');
      body.append(criteria,audit,note);
      detail.append(body);host.append(detail);
    });
    if(!areas.length)host.append(el('p','Sin áreas para este filtro.'));
    insights.replaceChildren();
    const stat=el('article');stat.append(el('h3','Lectura del mes'),el('strong',summary.average===null?'Sin evaluar':`${point(summary.average)} / 100`),el('p',`Promedio de ${summary.evaluated} colaboradores evaluables de ${summary.count}. Las áreas se comparan por promedio, no por tamaño.`));insights.append(stat);
    const weak=summary.criteria.filter(c=>c.rate!==null).sort((a,b)=>a.rate-b.rate)[0],reason=el('article');
    reason.append(el('h3','Qué limita el cumplimiento'),el('strong',weak?SHORT_LABELS[weak.key]:'Sin programación'),el('p',weak?`${weak.done} de ${weak.expected} días cumplidos (${Math.round(weak.rate)}%). Es el criterio con menor cumplimiento; revisa su desglose antes de atribuir causas.`:'No hay días programados evaluables.'));insights.append(reason);
    const review=el('article');review.append(el('h3','Antes de reconocer al equipo'),el('strong',`${summary.pending} revisiones pendientes`),el('p',`${point(summary.penalty)} puntos descontados por asignaciones incumplidas entre personas evaluables. Las evidencias sin aprobar pueden afectar RPE y Facebook.`));insights.append(review);
  }
  /* ── V2: alimenta el diseño nuevo (dashboard-ranking-v2.js) ── */
  let v2Rows=[];
  function renderV2(filtered){
    if(!window.KJARankingV2)return;
    v2Rows=filtered;
    const summary=model.summarize(filtered),ok=filtered.filter(r=>r.score!==null);
    const kpis={};summary.criteria.forEach(c=>{kpis[c.key]=c.rate===null?0:c.rate});
    const groups=new Map();
    filtered.forEach(r=>{const k=String(r.area_id);if(!groups.has(k))groups.set(k,{name:r.area||'Sin área',rows:[]});groups.get(k).rows.push(r)});
    const areas=[...groups.values()].map(g=>({name:g.name,avg:model.summarize(g.rows).average})).filter(a=>a.avg!==null).sort((a,b)=>b.avg-a.avg).map(a=>({name:a.name,pct:a.avg}));
    const weak=summary.criteria.filter(c=>c.rate!==null).sort((a,b)=>a.rate-b.rate)[0];
    window.KJARankingV2.render({
      pending:summary.pending,kpis,areas,
      top:ok.slice(0,10).map(r=>({id:r.colaborador_id,rank:r.rank,name:r.nombre,area:r.area||'Sin área',score:r.score,foto:r.foto_url||'',parts:CRITERION_KEYS.map(k=>r.parts[k]||0)})),
      overall:{score:summary.average,evaluated:summary.evaluated,total:summary.count},
      limiting:weak?{name:SHORT_LABELS[weak.key],pct:weak.rate}:null
    });
  }
  document.addEventListener('rk2:select',e=>{const row=v2Rows.find(r=>String(r.colaborador_id)===String(e.detail.id));if(row)openRankingDetail(row)});
  document.addEventListener('rk2:review',()=>{const b=document.querySelector('[data-lateral-section="facebook"]');if(b)b.click()});
  function render(page=0){
    page=Number.isInteger(page)?Math.max(0,page):0;
    const all=model.evaluate(rows,weights),area=get('ranking-area').value;
    const filtered=area?model.evaluate(rows.filter(r=>String(r.area_id)===area),weights):all;
    const pageSize=8,pages=Math.max(1,Math.ceil(filtered.length/pageSize));
    page=Math.min(page,pages-1);
    const pagination=get('ranking-pagination');
    if(pagination){
      pagination.replaceChildren();
      const previous=el('button','Anterior'),next=el('button','Siguiente');
      previous.type=next.type='button';previous.disabled=page===0;next.disabled=page>=pages-1;
      previous.onclick=()=>render(page-1);next.onclick=()=>render(page+1);
      const status=el('span',`${filtered.length} colaboradores · Página ${page+1} de ${pages}`);status.setAttribute('aria-live','polite');
      pagination.append(previous,status,next);
    }
    // Sticky bar (replaces old stats cards)
    renderStickyBar(filtered,all);
    renderAnalytics(filtered);
    renderV2(filtered);
    get('ranking-results').replaceChildren();get('ranking-leaders').replaceChildren();
    // Guide text
    get('ranking-guide').textContent=`Entrada puntual: ${weights.entrada} puntos. RPE solo en jornadas virtuales, en horario o cargado por Administración: ${weights.rpe}. Los periodos completamente presenciales reciben crédito neutral. Facebook en sus días asignados, trabajes o no: ${weights.facebook}. Salida en horario: ${weights.salida}. Se descuentan ${weights.penalizacion} puntos por asignación incumplida, hasta ${weights.tope}.`;
    // Chart (top 10) — clickable rows
    const chart=get('ranking-chart');
    const areaName=area?(get('ranking-area').options[get('ranking-area').selectedIndex]?.text||''):'';
    chart.replaceChildren(el('h3',area?`Top 10 · ${areaName}`:'Top 10 del equipo'),el('p','Puntaje sobre 100 · pulsa una persona para ver días cumplidos, evidencias y descuentos.'));
    for(const row of filtered.filter(r=>r.score!==null).slice(0,10)){
      const line=el('button',undefined,'ranking-chart-row');
      line.type='button';line.setAttribute('aria-label',`Ver desglose de ${row.nombre}`);
      const position=el('span',String(row.rank),'ranking-top-position');
      position.dataset.podium=row.rank<=3?'true':'false';
      const identity=el('span',undefined,'ranking-top-identity');
      identity.append(el('strong',row.nombre),el('small',row.area||'Sin área'));
      const avatar=el('span',undefined,'ranking-top-avatar');rankingPhoto(avatar,row);identity.prepend(avatar);
      const score=el('span',undefined,'ranking-top-score');score.append(el('b',point(row.score)),el('small','/ 100'));
      line.append(position,identity,score,bar(row.score,100,`${row.nombre}: ${point(row.score)} de 100 puntos`,'total'));
      const breakdown=el('span',undefined,'ranking-top-breakdown');
      CRITERION_KEYS.forEach(key=>{
        const chip=el('span',undefined,'ranking-top-criterion');chip.style.setProperty('--criterion',CRITERION_COLORS[key]);
        chip.append(el('span',SHORT_LABELS[key]),el('b',row.parts[key]===null?'—':`${point(row.parts[key])}/${weights[key]}`));breakdown.append(chip);
      });
      if(row.penalty>0)breakdown.append(el('span',`−${point(row.penalty)} por asignaciones`,'ranking-top-penalty'));
      line.append(breakdown);
      line.addEventListener('click',()=>openRankingDetail(row));chart.append(line);
    }
    if(!filtered.filter(r=>r.score!==null).length)chart.append(el('p','Sin datos evaluables en este período.'));
    // Leaders by area
    const groups=new Map([['General',all]]);
    for(const row of all)if(!groups.has(row.area))groups.set(row.area,model.evaluate(rows.filter(r=>r.area_id===row.area_id),weights));
    for(const[name,group] of groups){
      if(area&&name!=='General'&&name!==filtered[0]?.area)continue;
      const top=group.filter(r=>r.rank===1),card=el('article',undefined,'ranking-leader');
      card.setAttribute('role','button');card.setAttribute('tabindex','0');
      card.setAttribute('aria-label',`Ver desglose de ${top.map(r=>r.nombre).join(' y ')}`);
      card.append(el('small',name),el('h3',top.length?top.map(r=>r.nombre).join(' · '):'Sin datos evaluables'),el('p',top.length?`${point(top[0].score)} / 100 · ${top.length>1?'Empate provisional':'Primera posición provisional'}`:'Pendiente de registros'));
      if(top.length){
        card.addEventListener('click',()=>openRankingDetail(top[0]));
        card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openRankingDetail(top[0]);}});
      }
      get('ranking-leaders').append(card);
    }
    // Full list — buttons with mini-bars
    if(!filtered.length){get('ranking-results').append(el('p','No hay colaboradores evaluables para este filtro.'));return}
    const loggedId=window.__kja_user_id;
    for(const row of filtered.slice(page*pageSize,(page+1)*pageSize)){
      const isMe=loggedId&&row.colaborador_id===loggedId;
      const btn=el('button',undefined,'ranking-person-btn'+(isMe?' ranking-person-btn--me':''));
      btn.type='button';btn.setAttribute('aria-label',`Ver desglose de ${row.nombre}`);
      const rankBadge=el('b',row.rank===null?'—':`#${row.rank}`,'ranking-person-rank');
      rankBadge.style.color=CRITERION_COLORS.entrada;
      const nameSpan=el('span',row.nombre+(isMe?' (yo)':''),'ranking-person-name');
      const areaSpan=el('small',row.area,'ranking-person-area');
      const scoreSpan=el('strong',row.score===null?'Sin evaluar':`${point(row.score)} pts`,'ranking-person-score');
      btn.append(rankBadge,el('span',undefined,'ranking-person-info'),nameSpan,areaSpan,scoreSpan);
      const miniBar=el('div',undefined,'ranking-person-minibars');
      for(const key of CRITERION_KEYS){const fill=bar(row.parts[key],weights[key],labels[key],key);fill.classList.add('ranking-mini-bar');miniBar.append(fill);}
      btn.append(miniBar);
      btn.addEventListener('click',()=>openRankingDetail(row));
      get('ranking-results').append(btn);
    }
  }

  /* ── LOAD DATA ────────────────────────────────────────── */
  window.loadAdminRanking=async()=>{
    const token=++request,month=get('ranking-month').value;
    updateMonthStatus();
    get('ranking-status').textContent='Calculando los días terminados del mes…';
    get('ranking-results').replaceChildren();get('ranking-leaders').replaceChildren();
    if(get('ranking-pagination'))get('ranking-pagination').replaceChildren();
    get('ranking-chart').replaceChildren();get('ranking-sticky-bar').hidden=true;
    get('ranking-area-analytics').replaceChildren();get('ranking-insights').replaceChildren();
    rows=[];
    try{
      if(!/^\d{4}-\d{2}$/.test(month))throw Error('Selecciona un mes.');
      const{data,error}=await db.rpc('dash_ranking_mes',{p_mes:month+'-01'});if(token!==request)return;
      if(error)throw error;
      if(data.version!==4)throw Error('Actualiza la función ejecutando dashboard_70_rpe_presencial.sql.');
      rows=data.filas||[];
      exitPolicy={before:Number(data.salida_anticipacion_min),after:Number(data.salida_gracia_min)};
      if(typeof hydrateProfilePhotos==='function'){
        try{rows=await hydrateProfilePhotos(rows)}catch{}
        if(token!==request)return;
      }
      // Preserve selected area across month changes
      const previous=get('ranking-area').value;get('ranking-area').replaceChildren();
      const first=el('option','Todas las áreas');first.value='';get('ranking-area').append(first);
      for(const[id,name] of new Map(rows.map(r=>[String(r.area_id),r.area]))){const opt=el('option',name);opt.value=id;get('ranking-area').append(opt)}
      if(rows.some(r=>String(r.area_id)===previous))get('ranking-area').value=previous;
      // Status bar prefix differs for historical months
      const isCurrent=month===now;
      const prefix=isCurrent?'Datos hasta':'Registro cerrado al';
      const closedNote=isCurrent?' Las franjas aún abiertas quedan pendientes de evaluación.':'';
      get('ranking-status').textContent=`${prefix} ${data.hasta}. Entrada según estado puntual del sistema. Salida: ventana permitida desde ${data.salida_anticipacion_min} min antes hasta ${data.salida_gracia_min} min después del horario.${closedNote}`;
      render();
      return true;
    }catch(error){
      if(token!==request)return;
      get('ranking-status').textContent=error.code==='PGRST202'
        ?'Falta ejecutar dashboard_70_rpe_presencial.sql en Supabase.'
        :'No se pudo calcular el ranking. '+(error.message||'Intenta actualizar.');
      return false;
    }
  };

  /* ── FORM & EVENTS ────────────────────────────────────── */
  get('ranking-form').onsubmit=event=>{
    event.preventDefault();
    try{
      const next={};
      for(const inp of get('ranking-weights').querySelectorAll('input'))next[inp.name]=Number(inp.value);
      model.evaluate([],next);weights=next;render();
      get('ranking-status').textContent='Simulación recalculada. Los pesos no se han aprobado ni guardado.';
    }catch(error){get('ranking-status').textContent=error.message;}
  };
  get('ranking-month').onchange=()=>withAdminSkeleton('ranking',()=>window.loadAdminRanking());
  get('ranking-refresh').onclick=()=>withAdminSkeleton('ranking',()=>window.loadAdminRanking());
  get('ranking-area').onchange=render;
})();