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
  return new URLSearchParams(search).get('map')==='quiet'?'quiet':'detail';
}
export function basemapUrl(input,mode){
  const url=new URL(input);
  if(mode==='quiet')url.searchParams.set('map','quiet'); else url.searchParams.delete('map');
  return url;
}

const contextStyle=p=>{
  if(p.kind==='water')return {color:'#c6dce5',fillColor:'#c9e0e9',fillOpacity:1,weight:1.2,opacity:.92};
  if(p.kind==='road')return {color:'#b7b9ad',weight:1,opacity:.62};
  return {color:'#c6c9bd',weight:1,fillColor:'#eeefe8',fillOpacity:.86};
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
export function basemapSwitcher(leaf,map,status,{read=fetch,loadDetailed=getDetailStack,startDetailed=attachBasemap}={}){
  let mode,disposeDetail,quietLayer,labels,version=0;
  let attribution='',attributionActive=false;
  let contextData;
  for(const [pane,z] of [['contextDistrict',201],['contextRoad',202],['contextWater',203],['contextLabel',399]]){
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
  }
  map.on('zoomend',syncLabels);
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
          quietLayer.addLayer(leaf.geoJSON(source,{pane,interactive:false,filter:f=>f.properties?.kind===kind,style:f=>contextStyle(f.properties)}));
        }
        labels=leaf.geoJSON(source,{pane:'contextLabel',filter:f=>f.properties?.kind==='label',pointToLayer(f,latLng){
          const text=document.createElement('span');text.textContent=f.properties.name;
          return leaf.marker(latLng,{pane:'contextLabel',interactive:false,keyboard:false,icon:leaf.divIcon({className:'quiet-district',html:text,iconSize:null})});
        }});
        const districtCredit=source.districtSource==='seoul'?
          '<a href="https://data.seoul.go.kr/dataList/OA-21184/F/1/datasetView.do">서울특별시</a>' :
          source.districtSource==='sgis'?
            '<a href="https://sgis.mods.go.kr/">SGIS</a> · <a href="https://github.com/vuski/admdongkor">vuski/admdongkor</a>' : '';
        attribution=[districtCredit,OSM].filter(Boolean).join(' · ');
      }
      quietLayer.addTo(map);syncLabels();
      if(attribution){map.attributionControl?.addAttribution(attribution);attributionActive=true;}
    }catch{
      if(request===version)status.textContent='서울 배경을 불러오지 못했습니다. 사업구역과 목록은 계속 이용할 수 있습니다.';
    }
  };
}
