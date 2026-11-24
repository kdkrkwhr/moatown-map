import {renderProjectDetail} from './detail-view.mjs?v=boundaries-2';
import {formatValue} from './detail-format.mjs?v=detail-1';
import {loadMaps,createProjectMap} from './map-engine.mjs?v=boundaries-2';
import {loadNews,matchNews,newsCard,sourceLabels} from './news.mjs?v=atlas-1';
import {searchProjects,managementFilters,progressFilters} from './project-search.mjs?v=sub-areas-1';
import {mountAddressLookup} from './address-reference.mjs?v=seoul-parcels-1';
export function filterTowns(towns, query, district) {
  return searchProjects(towns,new Map(),[],{query,district}).map(row=>row.town);
}
export function resolveSelection(search, towns, zones) {
  const params=new URLSearchParams(search);
  const requestedTown=params.get('town');
  const zone=zones.get(params.get('zone'));
  const townId=towns.has(requestedTown) ? requestedTown :
    (!requestedTown && towns.has(zone?.town_id) ? zone.town_id : null);
  return {townId,zoneId:townId && zone?.town_id===townId ? zone.id : null};
}
export function pointLatLng(point) {
  if (point?.type!=='Point' || !Array.isArray(point.coordinates)) return null;
  const [lon,lat]=point.coordinates;
  return Number.isFinite(lon) && Number.isFinite(lat) && Math.abs(lat)<=90 && Math.abs(lon)<=180 ? [lat,lon] : null;
}
export async function loadSnapshot(base, get=fetch) {
  const manifestUrl=new URL('./moatown-data/latest.json',base);
  async function json(url){
    const response=await get(url,{cache:'no-cache'});
    if(!response.ok) throw Error(`HTTP ${response.status} ${url.pathname}`);
    return response.json();
  }
  const manifest=await json(manifestUrl);
  const [towns,zones,boundaries,excluded]=await Promise.all(['towns','zones','boundaries','excluded'].map(k=>manifest.files[k]?json(new URL(manifest.files[k],manifestUrl)):[]));
  return {manifest,towns,zones,boundaries,excluded};
}

const el=(tag,text,cls)=>{
  const out=document.createElement(tag);
  if(text!==undefined) out.textContent=text;
  if(cls) out.className=cls;
  return out;
};
const unknown='미확인';
const shown=v=>v===null || v===undefined || v==='' ? unknown : String(v);

function sourceLink(url,label='출처') {
  if(!url) return null;
  try { if(new URL(url).protocol!=='https:') return null; } catch { return null; }
  const link=el('a',label,'source-link');
  link.href=url; link.target='_blank'; link.rel='noopener noreferrer';return link;
}
const displayDate=value=>formatValue(value,'date');
const stages=[
  {label:'조합설립 진행 중',short:'조합설립 중',ink:'#6746a3',fill:'#aa8bd9',shape:'circle',description:'주민들이 사업을 추진할 조합을 설립하는 단계입니다.'},
  {label:'조합설립인가',short:'조합설립인가',ink:'#523394',fill:'#9572ce',shape:'circle',description:'관할 구청이 조합 설립을 인가했습니다.'},
  {label:'건축심의',short:'건축심의',ink:'#87582a',fill:'#e8bd87',shape:'diamond',description:'공개 사업 현황에 건축심의 단계로 기록되어 있습니다.'},
  {label:'통합심의 완료',short:'통합심의 완료',ink:'#915421',fill:'#d5a369',shape:'diamond',description:'관련 사항에 대한 통합심의를 마쳤습니다.'},
  {label:'사업시행계획인가 진행 중',short:'사업인가 진행 중',ink:'#995117',fill:'#edac56',shape:'diamond',description:'사업시행계획의 인가 절차를 진행하는 단계입니다.'},
  {label:'사업시행계획인가',short:'사업인가 완료',ink:'#265d99',fill:'#80a9dd',shape:'triangle',description:'관할 구청이 사업시행계획을 인가했습니다. 구역 상세에서 인가일과 고시를 확인할 수 있습니다.'},
  {label:'착공',short:'착공',ink:'#006e62',fill:'#4bb8a1',shape:'square',description:'공사를 시작한 것으로 공개 자료에 표시된 단계입니다.'},
  {label:'미확인',short:'미확인',ink:'#586474',fill:'#a4adb8',shape:'ring',description:'해당 구역의 추진 단계를 확인할 공개 자료가 아직 없습니다.'}
];
export function zoneStage(value){
  return stages.find(stage=>stage.label===value) ?? stages.at(-1);
}
function stageBadge(value,short=false){
  const stage=zoneStage(value);
  const badge=el('span',value==null?'확인 중':short?stage.short:shown(value),'stage-badge');
  badge.dataset.shape=stage.shape;
  badge.style.setProperty('--stage-ink',stage.ink);
  return badge;
}
export function elapsedMonths(start,end){
  const monthNumber=value=>{
    const parts=/^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
    return parts ? Number(parts[1])*12+Number(parts[2]) : NaN;
  };
  const elapsed=monthNumber(end)-monthNumber(start);
  return elapsed>=0 ? elapsed : null;
}
export function planIntervals(towns){
  const months=new Map();
  for(const town of towns){
    const notices=town.management_plan_notices;
    if(notices?.length!==1 || !town.selected_date)continue;
    const duration=elapsedMonths(town.selected_date.slice(0,7),notices[0].notice_date?.slice(0,7));
    if(duration!==null)months.set(town.id,duration);
  }
  const mean=months.size?[...months.values()].reduce((a,b)=>a+b,0)/months.size:null;
  return {months,mean};
}

export function showReferencePin(id,selectedId,visible,polygons){
  return id===selectedId && visible.has(id) && !polygons.has(id);
}

export function groupSubAreas(towns,zones){
  const byId=new Map(zones.map(z=>[z.id,z]));
  const groups=new Map(towns.map(t=>[t.id,new Set((t.sub_areas??[]).map(id=>byId.get(id)).filter(z=>z?.town_id===t.id))]));
  for(const zone of zones)groups.get(zone.town_id)?.add(zone);
  return new Map([...groups].map(([id,children])=>[id,[...children]]));
}

export function mount({manifest,towns,zones,boundaries,excluded=[]},sdk){
  const get=id=>document.getElementById(id);
  const list=get('town-list'),detail=get('town-detail'),search=get('search-input'),district=get('district-filter');
  const explorer=get('explorer'),sheet=get('sheet-toggle'),mapStatus=get('map-status');
  const mapGuides=[...document.querySelectorAll('details.stage-guide,details.legend,details.stage-filters')];
  document.addEventListener('click',event=>{
    for(const guide of mapGuides)if(guide.open && !guide.contains(event.target))guide.open=false;
  });
  document.addEventListener('keydown',event=>{
    if(event.key!=='Escape')return;
    const guide=mapGuides.find(item=>item.open);
    if(guide){guide.open=false;guide.querySelector('summary').focus();}
  });
  const townById=new Map(towns.map(t=>[t.id,t]));
  const cancellations=new Map(excluded.map(r=>[r.address_raw,{
    ...r,name:r.name_raw,address:r.address_raw,management_plan_stage:'선정 취소',risk_info:{is_canceled:true},
    timeline:[{stage:'대상지 선정',date:r.selected_date},{stage:'선정 취소',date:r.cancellation_date,source_url:r.source_url}],
    sources:[r.source_url],official_links:[{title:'서울시 대상지 취소현황',url:r.source_url}]
  }]));
  const zoneById=new Map(zones.map(z=>[z.id,z]));
  const planStats=planIntervals(towns);
  let newsItems=[];
  const newsCounts=new Map();
  get('map-totals').textContent=new Set(towns.map(town=>town.district)).size+'개 자치구 · 선정 대상지 '+towns.length+'곳';
  const groups=groupSubAreas(towns,zones);
  const districtCounts=new Map();
  for(const town of towns) districtCounts.set(town.district,(districtCounts.get(town.district) ?? 0)+1);
  const districtStages=new Map();
  for(const zone of zones){
    const region=townById.get(zone.town_id)?.district;
    if(!region)continue;
    if(!districtStages.has(region))districtStages.set(region,new Map(stages.map(stage=>[stage,0])));
    const totals=districtStages.get(region),stage=zoneStage(zone.stage);
    totals.set(stage,(totals.get(stage) ?? 0)+1);
  }
  for(const stage of stages){

    const item=el('div');
    item.append(stageBadge(stage.label),el('span',stage.description));
    get('stage-definitions').append(item);
  }
  district.replaceChildren(new Option('서울 전체',''));
  for(const name of [...new Set([...districtCounts.keys(),...excluded.map(x=>x.district)])].sort((a,b)=>a.localeCompare(b,'ko'))){
    district.append(new Option(name,name));
  }
  const boundaryProps=new Map(boundaries.features.map(({properties:p})=>[p.entity_id,p]));
  let current,rows=[],visible=new Set(),visibleZones=new Set(),townHits=new Set(),map;
  const chosen={plan:'',progress:''};
  const choices={plan:managementFilters,progress:progressFilters};
  for(const [group,options] of Object.entries(choices)){
    get(group+'-chips').replaceChildren();
    for(const [key,label,short] of [['','전체'],...options]){
      const button=el('button',short ?? label);
      button.type='button';button.dataset.group=group;button.value=key;
      if(group==='progress' && key)button.replaceChildren(stageBadge(label,true));
      button.addEventListener('click',()=>{
        chosen[group]=key;
        if(group==='plan' && key==='canceled')chosen.progress='';
        if(group==='progress' && key && chosen.plan==='canceled')chosen.plan='';
        updateFilters(false);
      });
      get(group+'-chips').append(button);
    }
  }
  const results=()=>searchProjects(towns,groups,excluded,{query:search.value,district:district.value,...chosen});
  const filtered=()=>Boolean(search.value.trim() || district.value || chosen.plan || chosen.progress);
  function readUrl(){
    const params=new URLSearchParams(location.search);
    search.value=params.get('q') ?? '';
    const region=params.get('district');
    district.value=region ?? '';
    for(const [key,options] of Object.entries(choices)){
      const value=params.get(key);
      chosen[key]=options.some(([code])=>code===value)?value:'';
    }
    if(chosen.plan==='canceled')chosen.progress='';
    current=resolveSelection(location.search,townById,zoneById);
    if(!current.townId && cancellations.has(params.get('cancellation'))){
      current.cancellation=params.get('cancellation');chosen.plan='canceled';chosen.progress='';
    }
    if(current.townId && !results().some(row=>row.town?.id===current.townId && (!current.zoneId || !row.zone || row.zone.id===current.zoneId))){
      search.value='';district.value='';chosen.plan='';chosen.progress='';
    }
  }
  readUrl();
  function writeUrl(replace=false){
    const url=new URL(location.href);
    for(const [key,value] of [['town',current.townId],['zone',current.zoneId],['cancellation',current.cancellation],['q',search.value],['district',district.value],...Object.entries(chosen)]){
      if(value)url.searchParams.set(key,value);else url.searchParams.delete(key);
    }
    if(url.href!==location.href) history[replace?'replaceState':'pushState'](null,'',url);
  }
  function expandSheet(expanded){
    explorer.classList.toggle('collapsed',!expanded);
    sheet.setAttribute('aria-expanded',String(expanded));
  }
  const sheetSize=get('sheet-size');
  function setSheetHeight(height){
    const tall=height===2;
    explorer.classList.toggle('tall',tall);
    expandSheet(height>0);
    sheetSize.setAttribute('aria-pressed',String(tall));
    sheetSize.textContent=tall?'기본 높이':'크게 보기';
  }
  const currentHeight=()=>explorer.classList.contains('collapsed')?0:explorer.classList.contains('tall')?2:1;
  sheetSize.addEventListener('click',()=>setSheetHeight(currentHeight()===2?1:2));
  let dragStart=null,dragged=false;
  sheet.addEventListener('pointerdown',event=>{
    if(!event.isPrimary || event.button!==0)return;
    dragStart=event.clientY;dragged=false;sheet.setPointerCapture(event.pointerId);
  });
  sheet.addEventListener('pointercancel',()=>{dragStart=null;dragged=false;});
  sheet.addEventListener('pointerup',event=>{
    if(dragStart===null)return;
    const distance=dragStart-event.clientY;
    dragStart=null;
    if(Math.abs(distance)<24)return;
    dragged=true;setSheetHeight(Math.max(0,Math.min(2,currentHeight()+Math.sign(distance))));
  });
  sheet.addEventListener('click',event=>{
    if(!dragged || event.detail===0)setSheetHeight(currentHeight()?0:1);
    dragged=false;
  });
  if(matchMedia('(max-width: 760px) and (orientation: portrait)').matches && !filtered() && !current.townId)setSheetHeight(0);
  function clearAddress(){map?.clearAddress();}
  function fitView(){map?.fit();}
  function renderLayers(){map?.render();}
  mountAddressLookup(townById,boundaries,result=>map?.showAddress(result),()=>Boolean(map));
  function renderList(){
    rows=results();
    visible=new Set(rows.filter(row=>row.town).map(row=>row.town.id));
    visibleZones=new Set(rows.filter(row=>row.zone).map(row=>row.zone.id));
    townHits=new Set(rows.filter(row=>row.town && !row.zone).map(row=>row.town.id));
    const canceled=rows.filter(row=>row.excluded).length;
    get('result-count').textContent=[townHits.size && '대상지 '+townHits.size+'곳',visibleZones.size && '구역 '+visibleZones.size+'곳',canceled && '취소 이력 '+canceled+'건'].filter(Boolean).join(' · ') || '0건';
    get('clear-filters').hidden=!filtered();
    const active=Object.values(chosen).filter(Boolean).length;
    const group=chosen.progress?'progress':'plan';
    const option=choices[group].find(([key])=>key===chosen[group]);
    get('filter-label').textContent=active===1?(option[2] ?? option[1]):active?'사업 단계 · '+active:'사업 단계';
    for(const button of get('stage-filter-box').querySelectorAll('[data-group]')){
      button.setAttribute('aria-pressed',String(chosen[button.dataset.group]===button.value));
    }
    const fragment=document.createDocumentFragment();
    for(const {town,zone,excluded:archived} of rows){
      if(archived){
        const entry=el('article',undefined,'archive-item');
        const button=el('button',archived.name_raw,'archive-detail');
        button.type='button';button.dataset.cancellation=archived.address_raw;
        button.addEventListener('click',()=>select(null,null,archived.address_raw));
        entry.append(button,el('small','대상지 취소 · '+displayDate(archived.cancellation_date)));
        const link=sourceLink(archived.source_url,'취소 원문');if(link)entry.append(link);
        fragment.append(entry);continue;
      }
      const button=el('button',undefined,'town-item');
      button.type='button';button.dataset.town=town.id;
      const meta=el('span',undefined,'row-meta');
      meta.append(el('span',town.district,'district-name'));
      if(zone){
        button.dataset.zone=zone.id;
        meta.append(el('span',town.name));
        button.append(el('strong',zone.name),meta,stageBadge(zone.stage));
        button.addEventListener('click',()=>select(town.id,zone.id));
        fragment.append(button);continue;
      }
      if(town.selected_date)meta.append(el('span',displayDate(town.selected_date)+' 선정'));
      const count=groups.get(town.id).length;
      if(count)meta.append(el('span','세부 '+count+'곳'));
      if(chosen.plan || search.value.trim())meta.append(el('span',town.management_plan_stage || (town.management_plan_notices?.length?'관리계획 승인고시':'관리계획 미확인')));
      const note=el('span',undefined,'row-news');
      note.dataset.newsTown=town.id;
      note.hidden=!newsCounts.has(town.id);
      if(!note.hidden)note.textContent='소식 '+newsCounts.get(town.id);
      meta.append(note);
      button.append(el('strong',town.name),meta);
      if(!boundaryProps.has(town.id))button.append(el('span',town.representative_point?'대표 위치만 확인':'지도 위치 미확인','location-note'));
      button.addEventListener('click',()=>select(town.id,null));
      fragment.append(button);
    }
    if(!rows.length){
      const note=el('div','검색 조건에 맞는 대상지가 없습니다.','empty');
      const clear=el('button','검색 조건 지우기');
      clear.type='button';clear.addEventListener('click',reset);
      note.append(clear);fragment.append(note);
    }
    list.replaceChildren(fragment);
    list.scrollTop=0;
  }
  function renderPanel(){
    const town=townById.get(current.townId)??cancellations.get(current.cancellation),zone=zoneById.get(current.zoneId);
    get('list-view').hidden=Boolean(town);get('detail-view').hidden=!town;
    get('sheet-label').textContent=zone?'사업구역 상세':town?'대상지 상세':'주소·사업 단계 검색';
    detail.replaceChildren();
    if(!town)return;
    const query=[district.value,search.value.trim()].filter(Boolean).join(' ');
    const direct=zone && visibleZones.has(zone.id);
    get('back-label').textContent=zone && !direct ? town.name : (query?query+' · ':'')+'검색 결과 '+rows.length+'건';
    const title=el('h2',zone?.name ?? town.name);
    title.tabIndex=-1;
    detail.append(el('span',town.district,'detail-district'),title,el('p',zone?[town.name+' 모아타운',zone.registered_address].filter(Boolean).join(' · '):town.address,'address'));
    const children=groups.get(town.id)??[];
    const jump=el('a','세부 사업구역 '+children.length+'곳 보기','sub-area-jump');
    jump.href='#sub-area-heading';
    jump.addEventListener('click',e=>{
      e.preventDefault();
      const heading=detail.querySelector('#sub-area-heading');heading.tabIndex=-1;heading.focus({preventScroll:true});heading.scrollIntoView({block:'start'});
    });
    if(children.length)detail.append(jump);
    renderProjectDetail(detail,{town,zone,children,boundaries:boundaryProps,snapshot:manifest.snapshot_date,cityRule:current.cancellation?null:manifest.seoul_road_permit,stats:planStats,select,badge:stageBadge});
    renderRelatedNews();
    detail.scrollTop=0;
  }
  function renderRelatedNews(){
    detail.querySelector('.related-news')?.remove();
    const {townId,zoneId}=current;
    if(!townId)return;
    const section=el('section',undefined,'related-news');
    const townItems=matchNews(newsItems,{townId});
    const groups=zoneId?[
      ['이 구역 소식',matchNews(townItems,{townId,zoneId}),{town:townId,zone:zoneId}],
      ['상위 대상지 소식',townItems.filter(item=>item.related_sites.some(s=>s.town_id===townId && !s.zone_id)),{town:townId}]
    ]:[['이 대상지 소식',townItems,{town:townId}]];
    for(const [title,items,params] of groups){
      if(!items.length)continue;
      const head=el('div',undefined,'related-head'),more=el('a','소식 목록 →');
      more.href='./news.html?'+new URLSearchParams(params);
      head.append(el('h3',title),more);section.append(head);
      for(const item of items.slice(0,2))section.append(newsCard(item,{compact:true}));
    }
    if(section.childElementCount)detail.querySelector('.detail-sources')?.before(section);
  }
  function select(townId,zoneId,cancellation=null){
    clearAddress();
    current={townId,zoneId,cancellation};
    expandSheet(true);writeUrl();renderPanel();renderLayers();fitView();
    detail.querySelector('h2')?.focus({preventScroll:true});
  }
  get('back-results').addEventListener('click',()=>{
    const {townId,zoneId,cancellation}=current;
    const direct=zoneId && visibleZones.has(zoneId);
    select(zoneId && !direct?townId:null,null);
    if(cancellation){list.querySelector('[data-cancellation="'+CSS.escape(cancellation)+'"]')?.focus();return;}
    const target=zoneId ? (direct?list:detail).querySelector('[data-zone="'+CSS.escape(zoneId)+'"]') : list.querySelector('[data-town="'+CSS.escape(townId)+'"]');
    target?.focus();
  });
  function updateFilters(replace=true){
    clearAddress();
    current={townId:null,zoneId:null};
    expandSheet(true);writeUrl(replace);renderList();renderPanel();renderLayers();fitView();
  }
  function reset(){
    search.value='';district.value='';chosen.plan='';chosen.progress='';
    get('stage-filter-box').open=false;updateFilters(false);
  }
  search.addEventListener('input',()=>updateFilters());
  district.addEventListener('change',()=>updateFilters(false));
  get('clear-filters').addEventListener('click',reset);
  get('apply-stage').addEventListener('click',()=>{get('stage-filter-box').open=false;get('stage-filter-box').querySelector('summary').focus();});
  get('reset-map').addEventListener('click',reset);
  window.addEventListener('popstate',()=>{
    clearAddress();
    readUrl();expandSheet(true);map?.settings();renderList();renderPanel();renderLayers();fitView();
  });
  const date=get('snapshot-date');
  date.dateTime=manifest.snapshot_date;date.textContent=displayDate(manifest.snapshot_date);
  get('coverage-note').textContent=displayDate(manifest.coverage.baseline_as_of)+' 선정 명부와 이후 확인한 변동을 반영했습니다. '+districtCounts.size+'개 자치구의 대상지 '+towns.length+'곳이 수록되어 있습니다.';
  renderList();renderPanel();renderLayers();fitView();
  loadNews(document.baseURI).then(({items})=>{
    newsItems=items;
    for(const item of items){
      for(const id of new Set(item.related_sites.map(site=>site.town_id)))newsCounts.set(id,(newsCounts.get(id) ?? 0)+1);
    }
    for(const note of list.querySelectorAll('[data-news-town]')){
      const count=newsCounts.get(note.dataset.newsTown);
      if(count){note.hidden=false;note.textContent='소식 '+count;}
    }
    renderRelatedNews();
    if(!items.length)return;
    const latest=items[0],brief=get('map-brief'),link=el('a',latest.title);
    link.href='./news.html#story-'+latest.id;
    const head=el('div',undefined,'brief-head');
    head.append(el('strong','최근 소식'),el('span',sourceLabels[latest.type]+' · '+displayDate(latest.published_on)));
    brief.append(head,link);brief.hidden=false;
  });
  sdk.then(maps=>{
    if(!maps)return;
    map=createProjectMap(maps,get('map'),{townById,zoneById,boundaries,districtCounts,districtStages,zoneStage,select,
      selectDistrict(name){search.value='';district.value=name;updateFilters(false);},
      view:()=>({current,rows,visible,visibleZones,townHits,filtered:filtered()})});
  }).catch(()=>{mapStatus.textContent='네이버 지도를 열 수 없습니다. 검색 결과와 구역 상세는 목록에서 확인하세요.';});
}
function prepareLoading(){
  const $=id=>document.getElementById(id);
  const params=new URLSearchParams(location.search);
  $('search-input').value=params.get('q')??'';
  const region=params.get('district');
  if(region)$('district-filter').add(new Option(region,region,true,true));
  const selected=[];
  for(const [group,options] of [['plan',managementFilters],['progress',progressFilters]]){
    const active=options.find(([key])=>key===params.get(group));
    if(active)selected.push(active[2]??active[1]);
    for(const [key,label,short] of [['','전체'],...options]){
      const button=el('button',short??label);button.disabled=true;
      button.setAttribute('aria-pressed',String(key===(active?.[0]??'')));
      $(group+'-chips').append(button);
    }
  }
  if(selected.length)$('filter-label').textContent=selected.join(' · ');
  const isDetail=Boolean(params.get('town')||params.get('zone'));
  $('detail-view').hidden=!isDetail;$('list-view').hidden=isDetail;
  if(isDetail)$('sheet-label').textContent=params.get('zone')?'사업구역 상세':'대상지 상세';
  $('search-input').disabled=$('district-filter').disabled=true;
  const guide=$('guide-dialog');
  $('guide-open').onclick=()=>guide.showModal();$('guide-close').onclick=()=>guide.close();
}
if(typeof document!=='undefined'){
  prepareLoading();
  const sdk=loadMaps(()=>{document.getElementById('map-status').textContent='네이버 지도 인증을 확인할 수 없습니다.';})
    .catch(()=>{document.getElementById('map-status').textContent='네이버 지도 연결에 실패했습니다. 목록에서 구역을 확인할 수 있습니다.';return null;});
  loadSnapshot(document.baseURI).then(data=>mount(data,sdk)).catch(error=>{
    document.getElementById('detail-view').hidden=true;document.getElementById('list-view').hidden=false;
    document.getElementById('result-count').textContent='불러오기 실패';
    const message=el('div','지도 자료를 불러오지 못했습니다.','empty');
    const retry=el('button','다시 불러오기');retry.type='button';retry.onclick=()=>location.reload();message.append(retry);
    document.getElementById('town-list').replaceChildren(message);console.error(error);
  }).finally(()=>{
    document.body.removeAttribute('data-loading');
    for(const id of ['town-list','town-detail'])document.getElementById(id).setAttribute('aria-busy','false');
    for(const id of ['search-input','district-filter'])document.getElementById(id).disabled=false;
  });
}
