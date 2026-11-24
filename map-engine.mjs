const VECTOR_STYLE='https://tiles.openfreemap.org/styles/positron';
const OSM='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>';
const VECTOR_ATTR='<a href="https://openfreemap.org/">OpenFreeMap</a> · &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> · '+OSM;

// Leaflet geometry and pins remain usable throughout vector/raster transitions.
export function attachBasemap(leaf,map,status,glLib=globalThis.maplibregl){
  let vector, raster, deadline, fallbackStarted=false;
  const failMessage='배경지도를 불러오지 못했습니다. 대상지·경계·목록은 계속 이용할 수 있습니다.';
  function fallback(){
    if(fallbackStarted)return;
    fallbackStarted=true; clearTimeout(deadline);
    if(vector && map.hasLayer(vector)){
      try{map.removeLayer(vector);}catch{/* retain Leaflet overlays */}
    }
    if(raster)return;
    raster=leaf.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:OSM});
    raster.on('tileerror',()=>{status.textContent=failMessage;});
    raster.addTo(map);
  }
  if(typeof leaf.maplibreGL!=='function' || typeof glLib?.Map!=='function'){fallback();return;}
  try{
    vector=leaf.maplibreGL({style:VECTOR_STYLE,attributionControl:{customAttribution:VECTOR_ATTR}});
    vector.addTo(map);
    const gl=vector.getMaplibreMap();
    let signaled=false, errors=0;
    deadline=setTimeout(fallback,12000);
    gl.once('idle',()=>{
      if(fallbackStarted)return;
      signaled=true;
      clearTimeout(deadline);
    });
    gl.on('error',event=>{
      if(fallbackStarted)return;
      if((!signaled && !event?.tile) || ++errors>=4)fallback();
    });
    gl.on('sourcedata',event=>{if(event?.sourceDataType==='content' && event?.tile)errors=0;});
    gl.getCanvas().addEventListener('webglcontextlost',fallback,{once:true});
  }catch{fallback();}
}
