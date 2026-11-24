import {basemapMode,basemapUrl,basemapSwitcher} from './map-engine.mjs?v=atlas-1';
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
const townStyle=(active,legal)=>({color:active?'#193b95':'#3558bb',fillColor:active?'#5472db':'#6986e7',weight:active?4.5:2.4,dashArray:legal?null:'8 3',fillOpacity:active?.55:.39,opacity:1});
const zoneStyle=(active,legal)=>({color:active?'#81370c':'#98501a',fillColor:active?'#df7b21':'#e9ad50',weight:active?3.8:2,dashArray:legal?null:'2 4',fillOpacity:active?.64:.40});

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
  for(const name of [...districtCounts.keys()].sort((a,b)=>a.localeCompare(b,'ko'))){
    district.append(new Option(name,name));
  }
  const markers=new Map(),townLayers=new Map(),zoneLayers=new Map();
  const boundaryProps=new Map(boundaries.features.map(({properties:p})=>[p.entity_id,p]));
  let current,rows=[],visible=new Set(),map,setBasemap;
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
    setBasemap=basemapSwitcher(leaf,map,mapStatus,{districtCounts,selectDistrict(name){
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
        style:town?townStyle(false,legal):zoneStyle(false,legal)
      });
      layer.on('click',()=>select(townId,town?null:zone.id));
      const label=el('span',(town?townById.get(townId).name:zone.name)+' · '+(legal?'법정 경계':'참고 경계'));
      layer.bindTooltip(label);
      (town?townLayers:zoneLayers).set(p.entity_id,{layer,legal,props:p});
    }
    for(const t of towns){
      const coords=pointLatLng(t.representative_point);if(!coords || townLayers.has(t.id)) continue;
      const layer=leaf.circleMarker(coords,{pane:'pinReference',radius:7,color:'#243f8b',fillColor:'#4364c8',weight:2,fillOpacity:.9});
      layer.bindTooltip(el('span',t.name+' · 대표 위치 (경계 미확인)'),{permanent:true,direction:'top',offset:[0,-7]});
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
    map.getContainer().classList.toggle('district-overview',overview && map.getZoom()>=9 && map.getZoom()<=12);
    map.getContainer().classList.toggle('show-totals',overview);
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
      const style=zoneStyle(id===current.zoneId,legal);
      if(current.zoneId && id!==current.zoneId)style.fillOpacity=.16;
      layer.setStyle(style);
    }
    zoneLayers.get(current.zoneId)?.layer.bringToFront();
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
      const button=el('button',zone.name,'zone-item');
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
    detail.append(metrics);
    if(plan?.state?.includes('not_latest')){
      detail.append(el('p','공개 당시의 계획값입니다. 최신 인가·분양계획과 차이가 있을 수 있습니다.','notice'));
    }
    const facts=el('dl',undefined,'facts');
    field(facts,'추진 단계',zone.stage);
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
