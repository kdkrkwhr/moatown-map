import {createMarkerClusters} from './marker-clusters.mjs?v=0bc4fef5da11';
import {contractorName} from './project-search.mjs?v=0bc4fef5da11';
import {contractorProcedure} from './detail-format.mjs?v=0bc4fef5da11';
const SDK='https://oapi.map.naver.com/openapi/v3/maps.js';
export function loadMaps(onAuthError){
  window.navermap_authFailure=onAuthError;
  if(window.naver?.maps?.Map)return Promise.resolve(window.naver.maps);
  return new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    const finish=error=>{
      clearTimeout(timer);
      if(error)reject(error);else resolve(window.naver.maps);
    };
    const timer=setTimeout(()=>finish(Error('네이버 지도 연결 시간 초과')),15000);
    window.moaMapsReady=()=>finish();
    script.onerror=()=>finish(Error('네이버 지도 연결 실패'));
    const url=new URL(SDK);
    url.search=new URLSearchParams({ncpKeyId:'u5ra1f7vic',submodules:'geocoder',callback:'moaMapsReady'});
    script.async=true;script.src=url;document.head.append(script);
  });
}
export function mapSettings(search){
  const params=new URLSearchParams(search);
  return {hybrid:params.get('map')==='hybrid',cadastral:params.get('cadastral')==='1'};
}
export function fitPadding(canvas,panel,dock){
  const overlaps=panel && panel.left<canvas.right && panel.right>canvas.left && panel.top<canvas.bottom && panel.bottom>canvas.top;
  const left=overlaps && panel.width<canvas.width*.8 && panel.height>=canvas.height*.8?Math.max(0,panel.right-canvas.left):0;
  const bottom=overlaps && !left?Math.max(0,canvas.bottom-panel.top):0;
  const top=dock?.height && dock.bottom>canvas.top?Math.max(0,dock.bottom-canvas.top):0;
  const edge=Math.max(0,Math.min(50,Math.round(Math.min(canvas.width-left,canvas.height-top-bottom)*.12)));
  return {top:edge+top,right:edge,bottom:edge+bottom,left:edge+left};
}
export function distanceText(metres){
  const rounded=Math.round(metres);
  const length=rounded>=1000?(rounded/1000).toLocaleString('ko-KR',{maximumFractionDigits:2})+'km':rounded.toLocaleString('ko-KR')+'m';
  return '직선 약 '+length+' · 도보 약 '+(metres?Math.max(1,Math.round(metres/67)):0)+'분';
}
export function showReferencePin(id,selectedId,townHits,shapes){
  return !shapes.has(id) && (townHits.has(id) || selectedId===id);
}
const node=(tag,cls,text)=>{
  const el=document.createElement(tag);el.className=cls;if(text!=null)el.textContent=text;return el;
};
export function createProjectMap(m,container,{townById,zoneById,boundaries,districtCounts,districtStages,zoneStage,select,selectDistrict,view,signal}){
  const $=id=>document.getElementById(id),ll=([x,y])=>new m.LatLng(y,x);
  const map=new m.Map(container,{center:ll([126.978,37.565]),zoom:11,minZoom:7,maxZoom:21,keyboardShortcuts:true,
    mapTypeId:mapSettings(location.search).hybrid?m.MapTypeId.HYBRID:m.MapTypeId.NORMAL});
  const cadastral=new m.CadastralLayer();
  const shapes=new Map(),pins=new Map(),zonePins=new Map(),districts=[];
  const on=(target,event,handler)=>m.Event.addListener(target,event,handler);
  const setVisible=(overlay,visible)=>{if(Boolean(overlay.getMap())!==visible)overlay.setMap(visible?map:null);};
  const marker=(position,content,zIndex,title,clickable=false)=>new m.Marker({position,title,zIndex,clickable,icon:{content,anchor:new m.Point(0,0)}});
  let addressMarker,addressPoint,addressIds=new Set(),measuring=false,measureStart,measureLayers=[];
  const padding=()=>fitPadding(container.getBoundingClientRect(),$('explorer').getBoundingClientRect(),$('map-search-dock').getBoundingClientRect());
  const clusters=createMarkerClusters(m,map,container,{setVisible,padding,measuring:()=>measuring,measure,
    choose(member){if(member.district)selectDistrict(member.district);else select(member.townId,member.zoneId);}
  });
  function markerText(text,cls,record){
    const caption=node('span','map-caption '+cls,text);
    if(record?.selected_contractor)caption.append(node('small','map-company',contractorName(record.selected_contractor)));
    const procedure=contractorProcedure(record);
    if(procedure)caption.append(node('small','map-procedure',procedure.stage));
    return caption;
  }
  function selectLayer(townId,zoneId){if(!measuring)select(townId,zoneId);}
  for(const feature of boundaries.features){
    const {entity_id:id,entity_type:type,boundary_status}=feature.properties;
    const isTown=type==='town',record=(isTown?townById:zoneById).get(id);
    if(!record)continue;
    const townId=isTown?id:record.town_id;
    const geometry=feature.geometry;
    const parts=geometry.type==='Polygon'?[geometry.coordinates]:geometry.type==='MultiPolygon'?geometry.coordinates:[];
    if(!parts.length)continue;
    const bounds=new m.LatLngBounds(),polygons=[];
    for(const part of parts){
      const paths=part.map(ring=>ring.map(coord=>{const point=ll(coord);bounds.extend(point);return point;}));
      const polygon=new m.Polygon({paths,clickable:true,strokeLineJoin:'round',strokeStyle:boundary_status==='legal'?'solid':'shortdash'});
      on(polygon,'click',e=>{if(measuring)measure(e.coord);else selectLayer(townId,isTown?null:id);});
      polygons.push(polygon);
    }
    const stage=isTown?null:zoneStage(record.stage);
    const label=markerText(record.drawing_code??record.name,isTown?'town-caption':'zone-caption',record);
    if(stage){
      label.style.setProperty('--stage-ink',stage.ink);
      label.append(node('small','',stage.short));
    }
    const point=isTown?null:record.representative_point;
    const position=point?.type==='Point' && point.coordinates?.length===2 && point.coordinates.every(Number.isFinite)?ll(point.coordinates):bounds.getCenter();
    const pin=marker(position,label,isTown?80:90,record.name,true);
    on(pin,'click',e=>{if(measuring)measure(e.coord??pin.getPosition());else selectLayer(townId,isTown?null:id);});
    shapes.set(id,{isTown,townId,polygons,bounds,stage,pin,label});
  }
  for(const zone of zoneById.values()){
    const point=zone.representative_point;
    if(shapes.has(zone.id) || point?.type!=='Point' || !point.coordinates?.every(Number.isFinite) || point.coordinates.length!==2)continue;
    const stage=zoneStage(zone.stage);
    const label=markerText(zone.drawing_code??zone.name,'zone-point-caption',zone);
    label.style.setProperty('--stage-ink',stage.ink);
    label.append(node('small','','대표 지번'));
    const pin=marker(ll(point.coordinates),label,110,zone.name+' · '+zone.registered_address,true);
    on(pin,'click',e=>{if(measuring)measure(e.coord??pin.getPosition());else selectLayer(zone.town_id,zone.id);});
    zonePins.set(zone.id,pin);
  }
  for(const town of townById.values()){
    if(!town.representative_point || shapes.has(town.id))continue;
    const pin=marker(ll(town.representative_point.coordinates),markerText(town.name+' · 대표 위치','point-caption'),120,town.name,true);
    on(pin,'click',e=>{if(measuring)measure(e.coord??pin.getPosition());else selectLayer(town.id,null);});
    pins.set(town.id,pin);
  }
  fetch(new URL('./moatown-data/basemap/seoul-context.geojson',import.meta.url)).then(r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{
    if(signal?.aborted)return;
    for(const f of data.features.filter(f=>f.properties.kind==='label')){
      const name=f.properties.name,count=districtCounts.get(name)??0;
      const content=node('span','district-label'),plate=node('span','district-nameplate',name);
      plate.append(node('b','',String(count)));content.append(plate);
      const mix=node('span','stage-mix'),summary=[];
      for(const [stage,n] of districtStages.get(name)??[]){
        if(!n)continue;
        const segment=node('i','');segment.style.flexGrow=n;segment.style.backgroundColor=stage.ink;mix.append(segment);
        summary.push(stage.short+' '+n+'곳');
      }
      if(mix.childElementCount)content.append(mix);
      const pin=marker(ll(f.geometry.coordinates),content,100+count,name+' · 대상지 '+count+'곳 · '+summary.join(', '),Boolean(count));
      if(count)on(pin,'click',e=>{if(measuring)measure(e.coord??pin.getPosition());else selectDistrict(name);});
      districts.push({name,pin,count});
    }
    districts.sort((a,b)=>b.count-a.count);render();
  }).catch(()=>{$('map-status').textContent='자치구 집계 마커를 불러오지 못했습니다. 목록에서 자치구를 선택해 주세요.';});
  let measuredRows;
  function render(){
    if(signal?.aborted)return;
    const {current,visible,visibleZones,townHits,filtered,contractor,rows}=view();
    container.classList.toggle('contractor-map',Boolean(contractor) && contractor!=='pending');
    container.classList.toggle('procedure-map',contractor==='pending');
    if(rows!==measuredRows){clusters.resetSizes();measuredRows=rows;}
    const associationNames=new Map();
    if(contractor)for(const {town,zone,association} of rows){
      if(!association)continue;
      const id=zone?.id??town.id;
      if(!associationNames.has(id))associationNames.set(id,new Set());
      const name=contractorName(association.selected_contractor);
      associationNames.get(id).add(zone?association.project_name+' · '+name:name);
    }
    const wide=map.getZoom()<=12;
    const overview=wide && !filtered && !current.townId && districts.length>0;
    container.classList.toggle('district-overview',overview);
    container.classList.toggle('show-totals',overview);
    const candidates=[];
    for(const {pin,name,count} of districts){
      if(overview && count)candidates.push({id:name,name,district:name,pin,description:'대상지 '+count+'곳'});
      else setVisible(pin,false);
    }
    function projectPin(pin,show,townId,zoneId){
      const id=zoneId??townId,selected=id===(current.zoneId??current.townId);
      if(overview || !show){setVisible(pin,false);return;}
      const town=townById.get(townId),zone=zoneById.get(zoneId);
      const companies=associationNames.get(id);
      if(!zone || zone.contractor_projects?.length){
        const label=pin.getIcon().content;
        if(companies && !label.querySelector('.map-company'))label.append(node('small','map-company',''));
        const companyLabel=label.querySelector('.map-company'),text=companies?[...companies].join(' · '):contractorName(zone?.selected_contractor);
        if(companyLabel && companyLabel.textContent!==text)companyLabel.textContent=text;
      }
      const status=contractor==='pending'?contractorProcedure(zone)?.stage:contractorName(zone?.selected_contractor);
      const description=zone?[town.district,town.name,zone.stage,status,...(companies??[])].filter(Boolean).join(' · '):[town.district,'모아타운 대상지',...(companies??[])].join(' · ');
      candidates.push({id,pin,townId,zoneId,selected,name:zone?.name??town.name,description});
    }
    for(const [id,shape] of shapes){
      const {isTown,townId,stage}=shape;
      const hit=addressIds.has(id);
      const show=hit || (isTown?visible.has(id):visibleZones.has(id)||(!contractor && (townHits.has(townId)||current.townId===townId)));
      const selected=id===(current.zoneId??current.townId);
      const focusedChild=!isTown && current.townId===townId;
      const style={strokeColor:stage?.ink??(selected?'#155778':'#345b75'),fillColor:stage?.fill??'#a3c9dc',
        fillOpacity:wide || (!isTown && associationNames.has(id))?0:isTown?.14:selected?.65:.44,strokeWeight:wide?1:selected?4:hit?3:focusedChild?2.5:1.6,
        strokeOpacity:wide?.65:1,zIndex:isTown?1:selected?5:3};
      for(const poly of shape.polygons){
        setVisible(poly,show);
        if(show)poly.setStyles(style);
      }
      shape.pin.setZIndex(selected?140:isTown?80:90);
      shape.label.classList.toggle('selected-caption',selected);
      projectPin(shape.pin,isTown?townHits.has(id)||selected||hit:show,townId,isTown?null:id);
    }
    for(const [id,pin] of pins)projectPin(pin,showReferencePin(id,current.townId,townHits,shapes),id,null);
    for(const [id,pin] of zonePins){
      const selected=current.zoneId===id;
      const townId=zoneById.get(id).town_id;
      const show=visibleZones.has(id) || (!contractor && (townHits.has(townId) || current.townId===townId));
      pin.setZIndex(selected?150:110);
      pin.getIcon().content?.classList?.toggle('selected-caption',selected);
      projectPin(pin,show,townId,id);
    }
    clusters.render(candidates);
  }
  function fit(){
    if(signal?.aborted)return;
    const {current,rows,filtered}=view();
    const opts=padding();
    if(opts.top+opts.bottom>=container.clientHeight-24)return;
    if(addressPoint){map.fitBounds([addressPoint],{...opts,maxZoom:16});return;}
    const points=[];
    function include(id){
      const shape=shapes.get(id);
      if(shape)points.push(shape.bounds.getSW(),shape.bounds.getNE());
      else if(zonePins.has(id))points.push(zonePins.get(id).getPosition());
      else if(pins.has(id))points.push(pins.get(id).getPosition());
    }
    if(current.townId){
      if(shapes.has(current.zoneId) || zonePins.has(current.zoneId))include(current.zoneId);
      else {
        include(current.townId);
        for(const zone of zoneById.values())if(zone.town_id===current.townId)include(zone.id);
      }
    }else if(filtered)for(const {town,zone} of rows){if(town)include(shapes.has(zone?.id) || zonePins.has(zone?.id)?zone.id:town.id);}
    const all=!points.length;
    if(all)points.push(ll([126.76,37.425]),ll([127.184,37.702]));
    map.fitBounds(points,{...opts,maxZoom:all?12:current.townId?17:15});
  }
  function settings(){
    const {hybrid,cadastral:enabled}=mapSettings(location.search);
    map.setMapTypeId(hybrid?m.MapTypeId.HYBRID:m.MapTypeId.NORMAL);
    cadastral.setMap(enabled?map:null);
    for(const btn of document.querySelectorAll('[data-map-style]'))btn.setAttribute('aria-pressed',String((btn.dataset.mapStyle==='hybrid')===hybrid));
    $('cadastral').setAttribute('aria-checked',String(enabled));
  }
  for(const btn of [...document.querySelectorAll('[data-map-style]'),$('cadastral')]){
    btn.disabled=false;
    btn.addEventListener('click',()=>{
      const url=new URL(location.href);
      if(btn.id==='cadastral'){
        if(mapSettings(url.search).cadastral)url.searchParams.delete('cadastral');else url.searchParams.set('cadastral','1');
      }else if(btn.dataset.mapStyle==='hybrid')url.searchParams.set('map','hybrid');
      else url.searchParams.delete('map');
      history.replaceState(null,'',url);settings();
    });
  }
  function clearAddress(){
    addressMarker?.setMap(null);addressMarker=null;addressPoint=null;addressIds.clear();
  }
  function showAddress({point,hits,label,note}){
    clearAddress();addressPoint=ll(point);addressIds=new Set(hits.map(h=>h.feature.properties.entity_id));
    const badge=markerText(label,'address-caption');badge.append(node('small','',note));
    addressMarker=marker(addressPoint,badge,160,label);addressMarker.setMap(map);
    fit();render();
  }
  const measureButton=$('measure'),message=$('measure-status');
  function resetMeasure(){
    measureLayers.forEach(layer=>layer.setMap(null));measureLayers=[];measureStart=null;message.textContent='';
  }
  function toggleMeasure(active){
    resetMeasure();measuring=active;measureButton.setAttribute('aria-pressed',String(active));
    container.classList.toggle('measuring',active);
    if(active)message.textContent='시작점을 선택하세요.';
  }
  function measure(point){
    if(!point)return;
    if(!measureStart){
      resetMeasure();measureStart=point;
      const start=marker(point,markerText('시작','ruler-caption'),170,'시작');start.setMap(map);measureLayers.push(start);
      message.textContent='도착점을 선택하세요.';return;
    }
    const line=new m.Polyline({map,path:[measureStart,point],strokeColor:'#1356af',strokeWeight:4,strokeOpacity:.95,clickable:false,zIndex:30});
    const result=distanceText(map.getProjection().getDistance(measureStart,point));
    const end=marker(point,markerText(result,'ruler-caption'),175,result);end.setMap(map);
    measureLayers.push(line,end);measureStart=null;message.textContent=result+' · 분당 67m 기준';
  }
  measureButton.disabled=false;measureButton.addEventListener('click',()=>toggleMeasure(!measuring));
  on(map,'click',event=>{if(measuring)measure(event.coord);});
  document.addEventListener('keydown',e=>{if(e.key==='Escape' && measuring)toggleMeasure(false);});
  on(map,'idle',render);on(map,'zoom_changed',render);
  $('zoom-in').disabled=$('zoom-out').disabled=false;
  $('zoom-in').onclick=()=>map.setZoom(map.getZoom()+1,true);
  $('zoom-out').onclick=()=>map.setZoom(map.getZoom()-1,true);
  const resize=new ResizeObserver(entries=>{
    if(signal?.aborted)return;
    const canvasChanged=entries.some(entry=>entry.target===container);
    if(canvasChanged){clusters.resetSizes();map.autoResize();render();}
    if(canvasChanged || $('map-search-dock').offsetHeight)fit();
  });
  for(const element of [container,$('explorer'),$('map-search-dock')])resize.observe(element);
  signal?.addEventListener('abort',()=>resize.disconnect(),{once:true});
  document.fonts?.ready.then(()=>{clusters.resetSizes();render();});
  settings();fit();render();
  return {fit,render,settings,clearAddress,showAddress};
}
