const VECTOR_STYLE='https://tiles.openfreemap.org/styles/positron';
const OSM='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>';
const VECTOR_ATTR='<a href="https://openfreemap.org/">OpenFreeMap</a> · &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> · '+OSM;

// Leaflet geometry and pins remain usable throughout vector/raster transitions.
export function attachBasemap(leaf,map,status,glLib=globalThis.maplibregl){
  let vector, raster, deadline, fallbackStarted=false, disposed=false;
  const dispose=()=>{
    disposed=true; clearTimeout(deadline);
    for(const layer of [vector,raster])if(layer && map.hasLayer(layer)){try{map.removeLayer(layer);}catch{/* keep overlays */}}
  };
  const failMessage='배경지도를 불러오지 못했습니다. 대상지·경계·목록은 계속 이용할 수 있습니다.';
  function fallback(){
    if(fallbackStarted || disposed)return;
    fallbackStarted=true; clearTimeout(deadline);
    if(vector && map.hasLayer(vector)){
      try{map.removeLayer(vector);}catch{/* retain Leaflet overlays */}
    }
    if(raster)return;
    raster=leaf.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:OSM});
    raster.on('tileerror',()=>{if(!disposed)status.textContent=failMessage;});
    raster.addTo(map);
  }
  if(typeof leaf.maplibreGL!=='function' || typeof glLib?.Map!=='function'){fallback();return dispose;}
  try{
    vector=leaf.maplibreGL({style:VECTOR_STYLE,attributionControl:{customAttribution:VECTOR_ATTR}});
    vector.addTo(map);
    const gl=vector.getMaplibreMap();
    let signaled=false, errors=0;
    deadline=setTimeout(fallback,12000);
    gl.once('idle',()=>{
      if(fallbackStarted || disposed)return;
      signaled=true;
      clearTimeout(deadline);
    });
    gl.on('error',event=>{
      if(fallbackStarted || disposed)return;
      if((!signaled && !event?.tile) || ++errors>=4)fallback();
    });
    gl.on('sourcedata',event=>{if(event?.sourceDataType==='content' && event?.tile)errors=0;});
    gl.getCanvas().addEventListener('webglcontextlost',fallback,{once:true});
  }catch{fallback();}
  return dispose;
}

export function basemapMode(search){
  return new URLSearchParams(search).get('map')==='detail'?'detail':'quiet';
}
export function basemapUrl(input,mode){
  const url=new URL(input);
  if(mode==='detail')url.searchParams.set('map','detail'); else url.searchParams.delete('map');
  return url;
}

const contextStyle=p=>{
  if(p.kind==='water')return {color:'#a3ccd8',fillColor:'#afd7e1',fillOpacity:1,weight:1,opacity:1};
  if(p.kind==='road')return {color:'#ccd2cf',weight:1,opacity:.75};
  return {color:'#bcc9c7',weight:1.15,fillColor:'#fbfaf3',fillOpacity:1};
};
let detailStack;
function getDetailStack(){
  if(detailStack)return detailStack;
  function script(src,integrity){
    const tag=document.createElement('script');
    tag.src=src;
    if(integrity){tag.integrity=integrity;tag.crossOrigin='anonymous';}
    const ready=new Promise((resolve,reject)=>{
      const stop=setTimeout(()=>{tag.remove();reject(new Error('Detailed basemap library timeout'));},5000);
      tag.onload=()=>{clearTimeout(stop);resolve();};
      tag.onerror=()=>{clearTimeout(stop);reject(new Error('Detailed basemap library unavailable'));};
    });
    document.head.append(tag);
    return ready;
  }
  // Detailed comparison preserves the established style and fallback.
  const style=document.createElement('link');
  style.rel='stylesheet';style.href=new URL('./vendor/maplibre/maplibre-gl.css',import.meta.url);
  document.head.append(style);
  detailStack=script('https://cdn.jsdelivr.net/npm/maplibre-gl@5.24.1/dist/maplibre-gl.js','sha384-nXMl9YiLoSG5KBPTFgvxVuIqQQcqIvo0bFrvoEaGJC6r7IibIzF1S36Zbf/sKBtL')
    .then(()=>script(new URL('./vendor/maplibre/leaflet-maplibre-gl.js',import.meta.url))).catch(()=>{});
  return detailStack;
}
export function basemapSwitcher(leaf,map,status,{read=fetch,loadDetailed=getDetailStack,startDetailed=attachBasemap,districtCounts=new Map(),selectDistrict}={}){
  let mode,disposeDetail,quietLayer,labels,version=0;
  let attribution='',attributionActive=false;
  let contextData;
  const districtLabels=[];
  for(const [pane,z] of [['contextDistrict',201],['contextRoad',202],['contextWater',203],['contextLabel',435]]){
    const node=map.createPane(pane);node.style.zIndex=z;node.style.pointerEvents='none';
  }
  function loadContext(){
    contextData ??= read(new URL('./moatown-data/basemap/seoul-context.geojson',import.meta.url)).then(r=>{
      if(!r.ok)throw new Error('Basemap unavailable');
      return r.json();
    }).catch(e=>{contextData=null;throw e;});
    return contextData;
  }
  function syncLabels(){
    if(!labels || mode!=='quiet')return;
    const show=map.getZoom()>=9 && map.getZoom()<=14;
    if(show&&!map.hasLayer(labels))labels.addTo(map);
    if(!show&&map.hasLayer(labels))map.removeLayer(labels);
    if(!show)return;
    const placed=[];
    const size=map.getSize?.();
    for(const {marker,count} of districtLabels){
      const at=map.latLngToContainerPoint(marker.getLatLng());
      const onScreen=at.x>=32 && at.x<=size.x-32 && at.y>=12 && at.y<=size.y-12;
      const clear=onScreen && placed.every(p=>Math.abs(p.x-at.x)>74 || Math.abs(p.y-at.y)>27);
      if(clear){
        placed.push(at);
        if(!labels.hasLayer(marker))labels.addLayer(marker);
        count.hidden=map.getZoom()>12.5;
      }else if(labels.hasLayer(marker))labels.removeLayer(marker);
    }
  }
  map.on('zoomend moveend resize',syncLabels);
  return async function setMode(next){
    if(mode===next)return;
    const request=++version;
    mode=next;status.textContent='';
    map.getContainer().dataset.basemap=next;
    if(disposeDetail){disposeDetail();disposeDetail=null;}
    if(quietLayer?.hasLayer && map.hasLayer(quietLayer))map.removeLayer(quietLayer);
    if(labels && map.hasLayer(labels))map.removeLayer(labels);
    if(attributionActive){map.attributionControl?.removeAttribution(attribution);attributionActive=false;}
    if(next==='detail'){
      await loadDetailed();
      if(request!==version)return;
      disposeDetail=startDetailed(leaf,map,status);
      return;
    }
    try{
      const source=await loadContext();
      if(request!==version)return;
      if(!quietLayer){
        quietLayer=leaf.layerGroup();
        for(const [kind,pane] of [['district','contextDistrict'],['road','contextRoad'],['water','contextWater']]){
          quietLayer.addLayer(leaf.geoJSON(source,{
            pane,interactive:kind==='district' && Boolean(selectDistrict),
            filter:f=>f.properties?.kind===kind,style:f=>contextStyle(f.properties),
            onEachFeature(f,layer){
              const name=f.properties.name;
              if(kind!=='district' || !selectDistrict)return;
              if(!districtCounts.has(name)){layer.options.interactive=false;return;}
              layer.on('click',()=>selectDistrict(name));
              const label=document.createElement('span');
              label.textContent=name+' · 수록 대상지 '+districtCounts.get(name)+'곳';
              layer.bindTooltip(label,{sticky:true});
            }
          }));
        }
        labels=leaf.layerGroup();
        const labelFeatures=source.features.filter(f=>f.properties?.kind==='label');
        labelFeatures.sort((a,b)=>(districtCounts.get(b.properties.name) ?? 0)-(districtCounts.get(a.properties.name) ?? 0));
        for(const f of labelFeatures){
          const name=f.properties.name,total=districtCounts.get(name) ?? 0;
          const text=document.createElement('span');text.className='district-label';text.textContent=name;
          const count=document.createElement('b');count.textContent=String(total);text.append(count);
          const interactive=Boolean(selectDistrict && total);
          const marker=leaf.marker(leaf.GeoJSON.coordsToLatLng(f.geometry.coordinates),{
            pane:'contextLabel',interactive,keyboard:interactive,autoPanOnFocus:false,title:name+' 수록 대상지 '+total+'곳',
            icon:leaf.divIcon({className:'quiet-district',html:text,iconSize:[0,0]})
          });
          if(interactive)marker.on('click',()=>selectDistrict(name));
          districtLabels.push({marker,count});
        }
        const districtCredit=source.districtSource==='seoul'?
          '<a href="https://data.seoul.go.kr/dataList/OA-21184/F/1/datasetView.do">서울특별시</a>' :
          source.districtSource==='sgis'?
            '<a href="https://sgis.mods.go.kr/">SGIS</a> · <a href="https://github.com/vuski/admdongkor">vuski/admdongkor</a>' : '';
        attribution=[districtCredit,OSM].filter(Boolean).join(' · ');
      }
      quietLayer.addTo(map);syncLabels();
      map.getContainer().dataset.contextReady='true';
      if(attribution){map.attributionControl?.addAttribution(attribution);attributionActive=true;}
    }catch{
      if(request===version)status.textContent='서울 배경을 불러오지 못했습니다. 사업구역과 목록은 계속 이용할 수 있습니다.';
    }
  };
}
