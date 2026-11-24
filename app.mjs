import {basemapMode,basemapUrl,basemapSwitcher} from './map-engine.mjs?v=stages-1';
const normalize = value => String(value ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g,'');
export function filterTowns(towns, query, district) {
  const q=normalize(query);
  return towns.filter(t=>(!district || t.district===district) &&
    [t.name,t.address,t.district,...(t.alternate_locations ?? []).map(a=>a.address)]
      .some(value=>normalize(value).includes(q)));
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
    const response=await get(url);
    if(!response.ok) throw Error(`HTTP ${response.status} ${url.pathname}`);
    return response.json();
  }
  const manifest=await json(manifestUrl);
  const [towns,zones,boundaries]=await Promise.all(['towns','zones','boundaries'].map(k=>json(new URL(manifest.files[k],manifestUrl))));
  return {manifest,towns,zones,boundaries};
}

const el=(tag,text,cls)=>{
  const out=document.createElement(tag);
  if(text!==undefined) out.textContent=text;
  if(cls) out.className=cls;
  return out;
};
const unknown='미확인';
const shown=v=>v===null || v===undefined || v==='' ? unknown : String(v);
const numeric=(v,suffix)=>Number.isFinite(v) ? v.toLocaleString('ko-KR')+suffix : unknown;
function sourceLink(url,label='출처') {
  if(!url) return null;
  try { if(new URL(url).protocol!=='https:') return null; } catch { return null; }
  const link=el('a',label,'source-link');
  link.href=url; link.target='_blank'; link.rel='noopener noreferrer';return link;
}
function field(list,label,value){
  const row=el('div');
  row.append(el('dt',label),el('dd',shown(value)));
  list.append(row);
}
function displayDate(value){
  return value ? value.split('-').join('.') : unknown;
}
function evidenceSection(entries){
  const section=el('details',undefined,'provenance');
  section.append(el('summary','출처와 자료 기준일'));
  for(const [label,evidence] of entries){
    const link=sourceLink(evidence?.source_url,label);
    if(!link)continue;
    const row=el('p',undefined,'evidence-row');
    row.append(link,el('small',['자료 기준 '+(evidence.source_as_of ?? '미상'),evidence.checked_on && '확인 '+evidence.checked_on].filter(Boolean).join(' · ')));
    section.append(row);
  }
  return section;
}
const seoulView=[[37.425,126.760],[37.702,127.184]];
export const mapInteractionOptions={
  scrollWheelZoom:true, zoomSnap:.25, zoomDelta:.75, wheelPxPerZoomLevel:100, wheelDebounceTime:36
};
export function overviewOptions({x,y}){
  const narrow=x<=760;
  const edge=narrow?Math.min(18,x*.045):Math.min(40,x*.034);
  const top=narrow?Math.min(132,y*.22):Math.min(72,y*.10);
  const bottom=narrow?Math.min(140,y*.20):Math.min(86,y*.11);
  return {paddingTopLeft:[edge,top],paddingBottomRight:[edge,bottom],maxZoom:12,animate:false};
}
const fitSeoul=map=>map?.fitBounds(seoulView,overviewOptions(map.getSize()));
const townStyle=(active,legal)=>({
  color:active?'#263a56':'#50677c',fillColor:'#adc6d1',weight:active?3:1.7,
  dashArray:legal?null:'10 3',lineJoin:'round',fillOpacity:active?.21:.28
});
const stages=[
  {label:'조합설립 진행 중',short:'조합설립 중',ink:'#6746a3',fill:'#aa8bd9',shape:'circle',description:'주민들이 사업을 추진할 조합을 설립하는 단계입니다.'},
  {label:'사업시행계획인가 진행 중',short:'사업인가 진행 중',ink:'#995117',fill:'#edac56',shape:'diamond',description:'사업시행계획의 인가 절차를 진행하는 단계입니다.'},
  {label:'착공',short:'착공',ink:'#006e62',fill:'#4bb8a1',shape:'square',description:'공사를 시작한 것으로 공개 자료에 표시된 단계입니다.'},
  {label:'미확인',short:'미확인',ink:'#586474',fill:'#a4adb8',shape:'ring',description:'해당 구역의 추진 단계를 확인할 공개 자료가 아직 없습니다.'}
];
export function zoneStage(value){
  return stages.find(stage=>stage.label===value) ?? stages[3];
}
function stageBadge(value,short=false){
  const stage=zoneStage(value);
  const badge=el('span',short?stage.short:shown(value),'stage-badge');
  badge.dataset.shape=stage.shape;
  badge.style.setProperty('--stage-ink',stage.ink);
  return badge;
}
function zoneStyle(stage,active,legal,muted=false){
  return {color:stage.ink,fillColor:stage.shape==='ring'?'url(#stage-unverified)':stage.fill,
    weight:active?3.3:1.8,fillOpacity:active?.74:muted?.24:.5,
    lineCap:'round',lineJoin:'round',dashArray:legal?null:stage.shape==='ring'?'2 4':'6 2'};
}
export function elapsedMonths(start,end){
  const monthNumber=value=>{
    const parts=/^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
    return parts ? Number(parts[1])*12+Number(parts[2]) : NaN;
  };
  const elapsed=monthNumber(end)-monthNumber(start);
  return elapsed>=0 ? elapsed : null;
}

export function showReferencePin(id,selectedId,visible,polygons){
  return id===selectedId && visible.has(id) && !polygons.has(id);
}

export function mount({manifest,towns,zones,boundaries},leaf=globalThis.L){
  const get=id=>document.getElementById(id);
  const list=get('town-list'),detail=get('town-detail'),search=get('search-input'),district=get('district-filter');
  const explorer=get('explorer'),sheet=get('sheet-toggle'),mapStatus=get('map-status');
  const townById=new Map(towns.map(t=>[t.id,t]));
  const zoneById=new Map(zones.map(z=>[z.id,z]));
  const groups=new Map(towns.map(t=>[t.id,[]]));
  for(const zone of zones) groups.get(zone.town_id)?.push(zone);
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
    get('stage-key').append(stageBadge(stage.label,true));
    const item=el('div');
    item.append(stageBadge(stage.label),el('span',stage.description));
    get('stage-definitions').append(item);
  }
  for(const name of [...districtCounts.keys()].sort((a,b)=>a.localeCompare(b,'ko'))){
    district.append(new Option(name,name));
  }
  const markers=new Map(),townLayers=new Map(),zoneLayers=new Map();
  const boundaryProps=new Map(boundaries.features.map(({properties:p})=>[p.entity_id,p]));
  let current,rows=[],visible=new Set(),map,setBasemap,selectedCaption,captionZoneId;
  function readUrl(){
    const params=new URLSearchParams(location.search);
    search.value=params.get('q') ?? '';
    const region=params.get('district');
    district.value=districtCounts.has(region) ? region : '';
    current=resolveSelection(location.search,townById,zoneById);
    if(current.townId && !filterTowns([townById.get(current.townId)],search.value,district.value).length){
      search.value='';district.value='';
    }
  }
  readUrl();
  function writeUrl(replace=false){
    const url=new URL(location.href);
    for(const [key,value] of [['town',current.townId],['zone',current.zoneId],['q',search.value],['district',district.value]]){
      if(value)url.searchParams.set(key,value);else url.searchParams.delete(key);
    }
    if(url.href!==location.href) history[replace?'replaceState':'pushState'](null,'',url);
  }
  function expandSheet(expanded){
    explorer.classList.toggle('collapsed',!expanded);
    sheet.setAttribute('aria-expanded',String(expanded));
  }
  sheet.addEventListener('click',()=>expandSheet(explorer.classList.contains('collapsed')));
  const mapStyleControls=[...document.querySelectorAll('[data-map-style]')];
  function refreshBasemap(){
    const mode=basemapMode(location.search);
    mapStyleControls.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.mapStyle===mode)));
    setBasemap?.(mode);
  }
  if(leaf && get('map')){
    map=leaf.map(get('map'),mapInteractionOptions);
    map.zoomControl?.setPosition('topright');
    fitSeoul(map);
    setBasemap=basemapSwitcher(leaf,map,mapStatus,{districtCounts,districtStages,selectDistrict(name){
      search.value='';district.value=name;updateFilters();
    }});
    mapStyleControls.forEach(button=>button.addEventListener('click',()=>{
      const url=basemapUrl(location.href,button.dataset.mapStyle);
      history.replaceState(null,'',url);
      refreshBasemap();
    }));
    refreshBasemap();
    function boundaryPane(name,zIndex){
      const pane=map.createPane(name); pane.style.zIndex=zIndex;
    }
    boundaryPane('townReference',410);boundaryPane('zoneReference',420);boundaryPane('pinReference',430);
    for(const f of boundaries.features){
      const p=f.properties, town=p.entity_type==='town', zone=zoneById.get(p.entity_id);
      const townId=town?p.entity_id:zone?.town_id;
      if(!townById.has(townId) || (!town && !zone)) continue;
      const legal=p.boundary_status==='legal';
      const layer=leaf.geoJSON(f,{
        pane:town?'townReference':'zoneReference',
        style:town?townStyle(false,legal):zoneStyle(zoneStage(zone.stage),false,legal)
      });
      layer.on('click',()=>select(townId,town?null:zone.id));
      const label=el('span',(town?townById.get(townId).name:zone.name)+' · '+(legal?'법정 경계':'참고 경계'),'boundary-caption');
      if(!town)label.append(stageBadge(zone.stage));
      layer.bindTooltip(label,{className:'boundary-tip',direction:'top'});
      (town?townLayers:zoneLayers).set(p.entity_id,{layer,legal,props:p});
    }
    for(const t of towns){
      const coords=pointLatLng(t.representative_point);if(!coords || townLayers.has(t.id)) continue;
      const layer=leaf.marker(coords,{pane:'pinReference',title:t.name+' 대표 위치',
        icon:leaf.divIcon({className:'reference-pin',iconSize:[38,46],iconAnchor:[19,46]})});
      layer.bindTooltip(el('span',t.name+' · 대표 위치'),{permanent:true,className:'boundary-tip',direction:'top',offset:[0,-46]});
      layer.on('click',()=>select(t.id,null));
      markers.set(t.id,layer);
    }
  } else mapStatus.textContent='지도를 사용할 수 없습니다. 목록에서 모든 대상지를 확인할 수 있습니다.';


  function fitView(){
    if(!map)return;
    const shape=zoneLayers.get(current.zoneId)?.layer ?? townLayers.get(current.townId)?.layer;
    const pin=markers.get(current.townId)?.getLatLng();
    const bounds=leaf.latLngBounds([]);
    if(shape)bounds.extend(shape.getBounds());
    else if(pin)bounds.extend(pin);
    else if(!current.townId && (search.value || district.value)){
      for(const town of rows){
        const layer=townLayers.get(town.id)?.layer;
        if(layer)bounds.extend(layer.getBounds());
        else if(markers.has(town.id))bounds.extend(markers.get(town.id).getLatLng());
      }
    }
    if(!bounds.isValid()){fitSeoul(map);return;}
    const size=map.getSize();
    const side=Math.min(size.x*.12,55), vertical=Math.min(size.y*.19,72);
    map.fitBounds(bounds,{paddingTopLeft:[side,vertical],paddingBottomRight:[side,vertical],maxZoom:current.townId?17:15,animate:false});
  }
  function renderLayers(){
    if(!map)return;
    const overview=!current.townId && !search.value && !district.value;
    const wasOverview=map.getContainer().classList.contains('district-overview');
    const isOverview=overview && map.getZoom()>=9 && map.getZoom()<=12;
    map.getContainer().classList.toggle('district-overview',isOverview);
    map.getContainer().classList.toggle('show-totals',overview);
    if(wasOverview!==isOverview)map.fire('districtviewchange');
    const show=(layer,yes)=>{
      if(yes && !map.hasLayer(layer))layer.addTo(map);
      else if(!yes && map.hasLayer(layer))layer.remove();
    };
    for(const [id,{layer,legal}] of townLayers){
      show(layer,visible.has(id));
      const style=townStyle(id===current.townId,legal);
      if(current.zoneId)style.fillOpacity=.13;
      layer.setStyle(style);
    }
    for(const [id,{layer,legal}] of zoneLayers){
      const parent=zoneById.get(id).town_id;
      show(layer,visible.has(parent) && (map.getZoom()>=14 || current.townId===parent));
      const style=zoneStyle(zoneStage(zoneById.get(id).stage),id===current.zoneId,legal,Boolean(current.zoneId));
      layer.setStyle(style);
    }
    zoneLayers.get(current.zoneId)?.layer.bringToFront();
    if(captionZoneId!==current.zoneId){
      selectedCaption?.remove();selectedCaption=null;captionZoneId=current.zoneId;
      const geometry=zoneLayers.get(current.zoneId)?.layer.getLayers()[0];
      if(geometry && map.hasLayer(geometry)){
        const zone=zoneById.get(current.zoneId);
        const caption=el('span',zone.name,'boundary-caption');
        caption.append(stageBadge(zone.stage));
        selectedCaption=leaf.tooltip({className:'boundary-tip',direction:'top',offset:[0,-3],opacity:1})
          .setLatLng(geometry.getCenter()).setContent(caption).addTo(map);
      }
    }
    for(const [id,layer] of markers)show(layer,showReferencePin(id,current.townId,visible,townLayers));
  }
  function renderList(){
    rows=filterTowns(towns,search.value,district.value);
    visible=new Set(rows.map(t=>t.id));
    get('result-count').textContent=rows.length+'곳';
    const fragment=document.createDocumentFragment();
    for(const town of rows){
      const button=el('button',undefined,'town-item');
      button.type='button';button.dataset.town=town.id;
      const meta=el('span',undefined,'row-meta');
      meta.append(el('span',town.district,'district-name'));
      if(town.selected_date)meta.append(el('span',displayDate(town.selected_date)+' 선정'));
      const count=groups.get(town.id).length;
      if(count)meta.append(el('span','세부 '+count+'곳'));
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
  function renderTown(town){
    const children=groups.get(town.id);
    const metrics=el('dl',undefined,'metrics');
    field(metrics,'선정일',displayDate(town.selected_date));
    field(metrics,'대상지 면적',numeric(town.area_m2,'㎡'));
    detail.append(metrics,el('h3',children.length?'세부 사업구역 '+children.length+'곳':'세부 사업구역'));
    for(const zone of children){
      const button=el('button',undefined,'zone-item');
      button.append(el('strong',zone.name),stageBadge(zone.stage,true));
      button.type='button';button.dataset.zone=zone.id;
      button.addEventListener('click',()=>select(town.id,zone.id));
      detail.append(button);
    }
    if(!children.length)detail.append(el('p','이 대상지에 연결된 세부 사업구역 자료는 아직 미확인입니다.','notice'));
    const facts=el('dl',undefined,'facts');
    field(facts,'선정 방식',town.selection_track);
    field(facts,'관리계획 단계',town.management_plan_stage);
    field(facts,'지도 위치',town.representative_point?'대표 위치 확인':'미확인');
    const boundary=boundaryProps.get(town.id);
    field(facts,'대상지 경계',boundary ? (boundary.boundary_status==='legal'?'법정 경계':'참고 경계') : unknown);
    const sources=(town.sources ?? []).map((url,i)=>[i?'추가 원문 '+i:'선정 명부 · 선정일 및 면적',{source_url:url,source_as_of:town.source_as_of}]);
    detail.append(facts,evidenceSection([...sources,['대표 위치',town.representative_point_evidence],['대상지 경계',boundary]]));
  }
  function renderZone(zone){
    const plan=zone.field_evidence?.plan,stage=zone.field_evidence?.stage,contractor=zone.field_evidence?.selected_contractor;
    const metrics=el('dl',undefined,'metrics');
    field(metrics,'계획 세대수',numeric(zone.planned_units_total,'세대'));
    field(metrics,'최고 지상 층수',numeric(zone.max_floors_above_ground,'층'));
    const status=el('div',undefined,'zone-status');
    status.append(stageBadge(zone.stage));
    if(stage?.source_as_of)status.append(el('small','자료 기준 '+displayDate(stage.source_as_of)));
    else if(stage?.checked_on)status.append(el('small','자료 확인 '+displayDate(stage.checked_on)));
    detail.append(status,metrics);
    if(plan?.state?.includes('not_latest')){
      detail.append(el('p','공개 당시의 계획값입니다. 최신 인가·분양계획과 차이가 있을 수 있습니다.','notice'));
    }
    const facts=el('dl',undefined,'facts');
    field(facts,contractor?.state==='contractor_reported'?'시공사 (시공사 발표)':'선정 시공사',zone.selected_contractor);
    field(facts,'지하 층수',numeric(zone.floors_below_ground,'층'));
    field(facts,'세부 주택형',Array.isArray(zone.unit_types)?zone.unit_types.join(', '):zone.unit_types);
    if(zone.published_private_area_bands?.length){
      field(facts,'공개 전용면적 구간',zone.published_private_area_bands.map(x=>x.type+' '+x.privateAreaBandM2+'㎡ '+x.units+'세대').join(' · '));
    }
    const boundary=boundaryProps.get(zone.id);
    field(facts,'사업구역 경계',boundary ? (boundary.boundary_status==='legal'?'법정 경계':'참고 경계') : unknown);
    detail.append(facts,evidenceSection([['계획 세대수 · 층수 · 면적',plan],['추진 단계',stage],['시공사',contractor],['사업구역 경계',boundary]]));
  }
  function renderPanel(){
    const town=townById.get(current.townId),zone=zoneById.get(current.zoneId);
    get('list-view').hidden=Boolean(town);get('detail-view').hidden=!town;
    get('sheet-label').textContent=zone?'사업구역 상세':town?'대상지 상세':'대상지 탐색';
    detail.replaceChildren();
    if(!town)return;
    const query=[district.value,search.value.trim()].filter(Boolean).join(' ');
    get('back-label').textContent=zone ? town.name : (query?query+' · ':'')+'검색 결과 '+rows.length+'곳';
    const title=el('h2',zone?.name ?? town.name);
    title.tabIndex=-1;
    detail.append(el('span',town.district,'detail-district'),title,el('p',zone?town.name+' 모아타운':town.address,'address'));
    if(zone)renderZone(zone);else renderTown(town);
    const history=town.published_timeline;
    if(history && (!zone || history.zone_ids.includes(zone.id))){
      const section=el('section',undefined,'project-timeline');
      section.append(el('h3','단계 사이 소요 기간'),el('p',history.scope+' · 연월 기준','notice'));
      const timeline=el('ol');
      history.events.forEach((event,index)=>{
        const item=el('li');
        item.append(el('time',displayDate(event.month)),el('strong',event.label));
        if(index){
          const months=elapsedMonths(history.events[index-1].month,event.month);
          if(months!==null)item.append(el('small','앞 단계에서 '+months+'개월'));
        }
        timeline.append(item);
      });
      section.append(timeline);
      const source=sourceLink(history.source_url,'서울시 발표 · '+displayDate(history.source_as_of));
      if(source)section.append(source);
      detail.insertBefore(section,detail.querySelector('.facts'));
    }else if(zone){
      detail.insertBefore(el('p','단계 사이 소요 기간은 자료 미확인입니다.','notice'),detail.querySelector('.provenance'));
    }
    detail.scrollTop=0;
  }
  function select(townId,zoneId){
    current={townId,zoneId};
    expandSheet(true);writeUrl();renderPanel();renderLayers();fitView();
    detail.querySelector('h2')?.focus({preventScroll:true});
  }
  get('back-results').addEventListener('click',()=>{
    const {townId,zoneId}=current;
    select(zoneId?townId:null,null);
    const target=zoneId ? detail.querySelector('[data-zone="'+CSS.escape(zoneId)+'"]') : list.querySelector('[data-town="'+CSS.escape(townId)+'"]');
    target?.focus();
  });
  function updateFilters(){
    current={townId:null,zoneId:null};
    expandSheet(true);writeUrl(true);renderList();renderPanel();renderLayers();fitView();
  }
  function reset(){
    search.value='';district.value='';
    updateFilters();
  }
  search.addEventListener('input',updateFilters);
  district.addEventListener('change',updateFilters);
  get('reset-map').addEventListener('click',reset);
  map?.on('zoomend',renderLayers);
  window.addEventListener('popstate',()=>{
    readUrl();expandSheet(true);refreshBasemap();renderList();renderPanel();renderLayers();fitView();
  });
  const date=get('snapshot-date');
  date.dateTime=manifest.snapshot_date;date.textContent=displayDate(manifest.snapshot_date);
  get('coverage-note').textContent=displayDate(manifest.coverage.baseline_as_of)+' 선정 명부와 이후 확인한 변동을 반영했습니다. '+districtCounts.size+'개 자치구의 대상지 '+towns.length+'곳이 수록되어 있습니다.';
  renderList();renderPanel();renderLayers();fitView();
  if(map){
    let lastSize=map.getSize();
    new ResizeObserver(()=>{
      map.invalidateSize({pan:false});
      const next=map.getSize();
      if(!next.equals(lastSize)){lastSize=next;fitView();}
    }).observe(get('map'));
  }
}
if(typeof document!=='undefined')loadSnapshot(document.baseURI).then(data=>mount(data)).catch(error=>{
  document.getElementById('result-count').textContent='불러오기 실패';
  document.getElementById('town-list').append(el('p','자료를 불러오지 못했습니다. 페이지를 새로고침해 주세요.','empty'));
  console.error(error);
});
