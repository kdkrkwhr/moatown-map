import {attachBasemap} from './map-engine.mjs?v=polygon-1';
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
function field(list,label,value,evidence){
  const row=el('div'),dd=el('dd',shown(value));
  row.append(el('dt',label),dd);
  if(evidence?.source_url){
    const line=el('small',undefined,'field-source');
    const link=sourceLink(evidence.source_url);
    if(link) line.append(link);
    if(evidence.source_as_of) line.append(` · 기준 ${evidence.source_as_of}`);
    else line.append(' · 자료 기준일 미상');
    if(evidence.checked_on) line.append(` · 확인 ${evidence.checked_on}`);
    dd.append(line);
  }
  list.append(row);
}
const seoulView=[[37.425,126.760],[37.702,127.184]];
const fitSeoul=map=>map?.fitBounds(seoulView,{padding:[12,12],maxZoom:11,animate:false});
const townStyle=(active,legal)=>({color:active?'#084085':'#2366a0',fillColor:active?'#2678d1':'#589bc4',weight:active?4:2,dashArray:legal?null:'7 3',fillOpacity:active?.36:.24,opacity:active?1:.92});
const zoneStyle=(active,legal)=>({color:active?'#8b390c':'#a5561c',fillColor:active?'#df7b21':'#e9ad50',weight:active?3.5:1.8,dashArray:legal?null:'2 4',fillOpacity:active?.55:.30});

export function showReferencePin(id,selectedId,visible,polygons){
  return id===selectedId && visible.has(id) && !polygons.has(id);
}

export function mount({manifest,towns,zones,boundaries}, leaf=globalThis.L) {
  const get=id=>document.getElementById(id);
  const list=get('town-list'), detail=get('town-detail'), search=get('search-input'), district=get('district-filter');
  const result=get('result-count'), mapStatus=get('map-status');
  const browse=get('browse-panel'), browseToggle=get('browse-toggle');
  const townById=new Map(towns.map(t=>[t.id,t]));
  const zoneById=new Map(zones.map(z=>[z.id,z]));
  const groups=new Map(towns.map(t=>[t.id,[]]));
  for(const z of zones) groups.get(z.town_id)?.push(z);
  const stageValues=new Set(towns.map(t=>t.management_plan_stage).filter(Boolean));
  const statusFilter=get('status-filter');
  if(statusFilter && stageValues.size){
    for(const text of [...stageValues].sort()) statusFilter.append(el('option',text));
    statusFilter.hidden=false;
  }
  const markers=new Map(),townLayers=new Map(),zoneLayers=new Map();
  const boundaryProps=new Map(boundaries.features.map(({properties:p})=>[p.entity_id,p]));
  let current=resolveSelection(location.search,townById,zoneById);
  if(browse){
    if(current.townId)browse.open=true;
    else if(window.matchMedia('(max-width: 760px)').matches)browse.open=false;
    get('browse-close')?.addEventListener('click',()=>{browse.open=false;browseToggle?.focus();});
  }
  function setUrl(replace=false){
    const url=new URL(location.href);
    if(current.townId) url.searchParams.set('town',current.townId); else url.searchParams.delete('town');
    if(current.zoneId) url.searchParams.set('zone',current.zoneId); else url.searchParams.delete('zone');
    if(url.href!==location.href) history[replace?'replaceState':'pushState'](null,'',url);
  }
  for(const value of [...new Set(towns.map(t=>t.district))].sort((a,b)=>a.localeCompare(b,'ko'))){
    const option=el('option',value); option.value=value; district.append(option);
  }

  let map=null;
  if(leaf && get('map')){
    map=leaf.map(get('map'),{scrollWheelZoom:false});
    map.zoomControl?.setPosition('topright');
    fitSeoul(map);
    attachBasemap(leaf,map,mapStatus);
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
      const layer=leaf.circleMarker(coords,{pane:'pinReference',radius:7,color:'#133a7a',fillColor:'#397ac4',weight:2,fillOpacity:.9});
      layer.bindTooltip(el('span',t.name+' · 대표 위치 (경계 미확인)'),{permanent:true,direction:'top',offset:[0,-7]});
      layer.on('click',()=>select(t.id,null));
      markers.set(t.id,layer);
    }
  } else mapStatus.textContent='지도를 사용할 수 없습니다. 목록에서 모든 대상지를 확인할 수 있습니다.';

  function fitSelection(){
    if(!map) return;
    const zone=zoneLayers.get(current.zoneId)?.layer,town=townLayers.get(current.townId)?.layer;
    const shape=zone??town;
    const pin=markers.get(current.townId)?.getLatLng();
    const bounds=shape?.getBounds().isValid() ? shape.getBounds() : pin ? leaf.latLngBounds([pin,pin]) : null;
    if(!bounds){if(current.townId)fitSeoul(map);return;}
    const size=map.getSize();
    const narrow=window.matchMedia('(max-width: 760px)').matches;
    const panel=browse?.open ? browse.getBoundingClientRect() : null;
    const chrome=get('search-input')?.getBoundingClientRect();
    const paddingTopLeft=narrow ? [22,Math.min(size.y*.32,(chrome?.bottom ?? 0)+16)] : [Math.min(size.x*.43,(panel?.right ?? 0)+20),36];
    const paddingBottomRight=narrow ? [22,Math.min(size.y*.51,panel ? size.y-panel.top+16 : 24)] : [45,36];
    map.fitBounds(bounds,{paddingTopLeft,paddingBottomRight,maxZoom:shape?17:16,animate:false});
  }
  function select(townId,zoneId,focus=false){
    current={townId,zoneId};if(townId && browse)browse.open=true;setUrl();render();fitSelection();
    if(focus) detail.querySelector(zoneId?'[data-zone-heading]':'h2')?.focus({preventScroll:false});
  }
  function renderDetails(){
    detail.replaceChildren();
    const town=townById.get(current.townId), zone=zoneById.get(current.zoneId);
    if(!town){detail.append(el('h2','대상지 상세'),el('p','지도 또는 목록에서 모아타운을 선택하세요.'));return;}
    const title=el('h2',town.name);title.tabIndex=-1;
    detail.append(title,el('p',town.address));
    const townFields=el('dl');
    const townEvidence={source_url:town.sources?.[0],source_as_of:town.source_as_of};
    field(townFields,'선정 방식',town.selection_track,townEvidence);
    field(townFields,'선정일',town.selected_date,townEvidence);
    field(townFields,'관리계획 단계',town.management_plan_stage,townEvidence);
    field(townFields,'대상지 면적',numeric(town.area_m2,'㎡'),townEvidence);
    field(townFields,'지도 위치',town.representative_point?'대표 위치 참고점':'대표 위치 미확인',town.representative_point_evidence);
    const tp=boundaryProps.get(town.id);
    field(townFields,'대상지 경계',tp?'참고 경계 (법정 경계 아님)':'미확인',tp);
    detail.append(townFields);
    if(town.sources?.length>1){
      const links=el('p',undefined,'field-source');
      town.sources.forEach((url,i)=>{const a=sourceLink(url,`원문 ${i+1}`);if(a) links.append(a,' ');});
      detail.append(links);
    }
    detail.append(el('h3','세부 사업구역'));
    const children=groups.get(town.id) ?? [];
    if(!children.length){detail.append(el('p','공개 자료에서 연결한 세부 사업구역은 아직 미확인입니다.'));return;}
    const zoneList=el('div',undefined,'zone-list');
    for(const z of children){
      const button=el('button',z.name,'zone-item');button.type='button';
      button.setAttribute('aria-pressed',z.id===zone?.id);
      button.addEventListener('click',()=>select(town.id,z.id,true));
      zoneList.append(button);
    }
    detail.append(zoneList);
    if(!zone){detail.append(el('p','사업구역을 선택하면 계획 수치와 출처를 볼 수 있습니다.'));return;}
    const zoneTitle=el('h3',zone.name);zoneTitle.tabIndex=-1;zoneTitle.dataset.zoneHeading='';detail.append(zoneTitle);
    const plan=zone.field_evidence?.plan;
    const zFields=el('dl');
    field(zFields,'사업 추진 단계',zone.stage,zone.field_evidence?.stage);
    field(zFields,'계획 세대수',numeric(zone.planned_units_total,'세대'),plan);
    field(zFields,'최고 지상 층수',numeric(zone.max_floors_above_ground,'층'),plan);
    field(zFields,'지하 층수',numeric(zone.floors_below_ground,'층'),plan);
    field(zFields,'세부 주택형',Array.isArray(zone.unit_types)?zone.unit_types.join(', '):zone.unit_types,plan);
    if(zone.published_private_area_bands?.length) {
      field(zFields,'공개 전용면적 구간 (주택형 아님)',zone.published_private_area_bands.map(x=>`${x.type} ${x.privateAreaBandM2}㎡ ${x.units}세대`).join(' · '),plan);
    }
    const contractorEvidence=zone.field_evidence?.selected_contractor;
    field(zFields,contractorEvidence?.state==='contractor_reported'?'선정 시공사 (시공사 발표)':'선정 시공사',zone.selected_contractor,contractorEvidence);
    const zp=boundaryProps.get(zone.id);
    field(zFields,'사업구역 경계',zp?'참고 경계 (법정 경계 아님)':'미확인',zp);
    detail.append(zFields);
    if(plan?.state?.includes('not_latest')){
      const label=plan.state.startsWith('historical_')?'과거 공개 계획값':'공개 계획값';
      detail.append(el('p',`${label}입니다. 최신 인가·확정 분양계획과 동일한지는 확인되지 않았습니다.`));
    }
  }

  function render(layersOnly=false){
    const rows=filterTowns(towns,search.value,district.value)
      .filter(t=>!statusFilter?.value || t.management_plan_stage===statusFilter.value);
    const visible=new Set(rows.map(t=>t.id));
    if(!layersOnly){
    list.replaceChildren();result.textContent=`${rows.length} / ${towns.length}곳`;
    if(!rows.length) list.append(el('p','검색 조건에 맞는 대상지가 없습니다.'));
    for(const t of rows){
      const button=el('button',undefined,'town-item');
      button.type='button';button.dataset.town=t.id;
      button.setAttribute('aria-pressed',t.id===current.townId);
      button.append(el('strong',t.name),el('span',t.address));
      if(!boundaryProps.has(t.id)) button.append(el('small',t.representative_point?'경계 미확인 · 대표 위치 있음':'경계·대표 위치 미확인'));
      button.addEventListener('click',()=>select(t.id,null,true));list.append(button);
    }
    }
    if(map){
      const show=(layer,yes)=>{ if(yes && !map.hasLayer(layer)) layer.addTo(map); else if(!yes && map.hasLayer(layer)) layer.remove(); };
      for(const [id,{layer,legal}] of townLayers){show(layer,visible.has(id));layer.setStyle(townStyle(id===current.townId,legal));}
      for(const [id,{layer,legal}] of zoneLayers){
        const parent=zoneById.get(id).town_id;
        show(layer,visible.has(parent) && (map.getZoom()>=14 || current.townId===parent));
        layer.setStyle(zoneStyle(id===current.zoneId,legal));
      }
      for(const [id,layer] of markers)show(layer,showReferencePin(id,current.townId,visible,townLayers));
    }
    if(!layersOnly) renderDetails();
  }
  function filterChange(){
    if(current.townId && !filterTowns(towns,search.value,district.value).some(t=>t.id===current.townId)){
      current={townId:null,zoneId:null};setUrl(true);
    }
    render();
  }
  function browseFilter(){if(browse)browse.open=true;filterChange();}
  search.addEventListener('input',browseFilter);district.addEventListener('change',browseFilter);
  statusFilter?.addEventListener('change',filterChange);
  get('reset-map').addEventListener('click',()=>{
    search.value='';district.value='';if(statusFilter)statusFilter.value='';
    select(null,null);fitSeoul(map);
  });
  map?.on('zoomend',()=>render(true));
  window.addEventListener('popstate',()=>{
    search.value=''; district.value='';if(statusFilter)statusFilter.value='';
    current=resolveSelection(location.search,townById,zoneById);if(current.townId && browse)browse.open=true;render();fitSelection();
  });
  if(get('snapshot-date')) get('snapshot-date').textContent=manifest.snapshot_date;
  render();fitSelection();
}
if(typeof document!=='undefined') loadSnapshot(document.baseURI).then(data=>mount(data)).catch(error=>{
  document.getElementById('result-count').textContent='자료 불러오기 실패';
  document.getElementById('town-list').textContent='자료를 불러오지 못했습니다. 페이지를 새로고침해 주세요.';
  console.error(error);
});
