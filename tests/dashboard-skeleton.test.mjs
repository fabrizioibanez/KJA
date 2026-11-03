import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';

const source=fs.readFileSync(new URL('../assets/js/dashboard-skeleton.js',import.meta.url),'utf8');
const styles=fs.readFileSync(new URL('../assets/css/paginas/dashboard-skeleton.css',import.meta.url),'utf8');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function setup(){
  const dom=new JSDOM('<section id="view"><p id="content">Contenido</p></section>',{runScripts:'outside-only'});
  dom.window.eval(source);
  return {dom,host:dom.window.document.getElementById('view'),api:dom.window.DashboardSkeleton};
}

test('declara un wireframe especifico para cada seccion administrativa',t=>{
  const {dom,api}=setup();t.after(()=>dom.window.close());
  const sections={overview:'overview-panels',control:'control-workbench',ranking:'ranking-analytics',facebook:'facebook-results',lista:'roster',mes:'ledger',cierres:'close-grid',asignaciones:'assignment-columns',colaboradores:'export-card',contratos:'contract-caption',roles:'role-grid',marcado:'access-layout'};
  for(const [section,signature] of Object.entries(sections)){
    assert.equal(typeof api.layouts[section],'function',section);
    assert.match(api.layouts[section](),/kja-sk-/);
    assert.match(api.layouts[section](),new RegExp(`kja-sk-${signature}`),section);
  }
});

test('omite el skeleton en cargas mas rapidas que el umbral',async t=>{
  const {dom,host,api}=setup();t.after(()=>dom.window.close());
  const result=await api.withSkeleton(host,'lista',async()=>true,{delay:30,minVisible:10,fade:0});
  assert.equal(result,true);
  assert.equal(host.querySelector('.kja-skeleton-layer'),null);
  assert.equal(host.getAttribute('aria-busy'),'false');
});

test('mantiene el skeleton visible y lo reemplaza por el contenido',async t=>{
  const {dom,host,api}=setup();t.after(()=>dom.window.close());
  let resolve;
  const request=new Promise(done=>{resolve=done});
  const started=Date.now();
  const loading=api.withSkeleton(host,'mes',()=>request,{delay:5,minVisible:25,fade:0});
  await wait(12);
  assert.ok(host.querySelector('.kja-skeleton-layer'));
  assert.equal(host.getAttribute('aria-busy'),'true');
  resolve(true);
  assert.equal(await loading,true);
  assert.ok(Date.now()-started>=25);
  assert.equal(host.querySelector('.kja-skeleton-layer'),null);
  assert.equal(host.getAttribute('aria-busy'),'false');
  assert.equal(host.querySelector('#content').textContent,'Contenido');
});

test('copia la estructura y las clases reales sin duplicar ids interactivos',async t=>{
  const {dom,host,api}=setup();t.after(()=>dom.window.close());
  host.innerHTML='<header class="real-toolbar"><h2 id="real-title">Título real</h2><button id="real-action">Actualizar</button></header><div class="real-grid"><article class="real-card"><b>Dato</b><p>Detalle operativo</p></article></div>';
  let resolve;const request=new Promise(done=>{resolve=done});
  const loading=api.withSkeleton(host,'lista',()=>request,{delay:0,minVisible:0,fade:0});
  await wait(5);
  const mirror=host.querySelector('.kja-skeleton-mirror');
  assert.ok(mirror.querySelector('.real-toolbar'));
  assert.ok(mirror.querySelector('.real-grid .real-card'));
  assert.equal(mirror.querySelector('[id]'),null);
  assert.ok(mirror.querySelector('.kja-sk-native-line'));
  assert.equal(mirror.querySelector('button').disabled,true);
  resolve(true);await loading;
});

test('neutraliza fondos decorativos y conserva los KPI como hijos directos',async t=>{
  const dom=new JSDOM('<section id="admin-month-section"><div class="admin-month-workbench"><header class="admin-month-workbench-head"><div id="admin-month-kpis" class="admin-list-kpis"></div></header><div id="admin-month-ledger"></div></div></section>',{runScripts:'outside-only'});
  dom.window.eval(source);t.after(()=>dom.window.close());
  const host=dom.window.document.getElementById('admin-month-section');
  let resolve;const request=new Promise(done=>{resolve=done});
  const loading=dom.window.DashboardSkeleton.withSkeleton(host,'mes',()=>request,{delay:0,minVisible:0,fade:0});
  await wait(5);
  const kpis=host.querySelector('.kja-skeleton-mirror .admin-list-kpis');
  assert.equal(kpis.children.length,5);
  assert.ok([...kpis.children].every(card=>card.matches('.admin-list-kpi.kja-sk-native-metric')));
  assert.match(styles,/admin-month-workbench-head\{background:var\(--kja-sk-card\)!important/);
  assert.match(styles,/background-image:none!important/);
  resolve(true);await loading;
});

test('muestra un error con reintento cuando la carga falla',async t=>{
  const {dom,host,api}=setup();t.after(()=>dom.window.close());
  let attempts=0;
  const fetchFn=async()=>++attempts>1;
  assert.equal(await api.withSkeleton(host,'control',fetchFn,{delay:0,minVisible:0,fade:0}),false);
  const retry=host.querySelector('.kja-skeleton-error button');
  assert.ok(retry);
  assert.equal(retry.textContent,'Reintentar');
  assert.equal(host.getAttribute('aria-busy'),'false');
  retry.click();
  await wait(10);
  assert.equal(attempts,2);
  assert.equal(host.querySelector('.kja-skeleton-layer'),null);
  assert.equal(host.getAttribute('aria-busy'),'false');
});
