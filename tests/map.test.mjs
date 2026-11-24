import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {filterTowns,resolveSelection,pointLatLng,loadSnapshot} from '../app.mjs';
const read=u=>JSON.parse(fs.readFileSync(new URL(u,import.meta.url),'utf8'));
test('no-coordinate towns remain discoverable, combined with district filter',()=>{
  const towns=read('../moatown-data/snapshots/2026-11-24/towns.json');
  assert.equal(filterTowns(towns,'','').length,138);
  const town=towns.find(x=>!x.representative_point);
  assert.ok(filterTowns(towns,town.name.replaceAll(' ',''),town.district).includes(town));
  assert.equal(filterTowns(towns,town.name,'없는구').length,0);
});
test('deep link rejects a zone assigned to another town, yet supports zone alone',()=>{
  const map=new Map([['a',{id:'a'}],['b',{id:'b'}]]);
  const zones=new Map([['z',{id:'z',town_id:'a'}]]);
  assert.deepEqual(resolveSelection('?town=b&zone=z',map,zones),{townId:'b',zoneId:null});
  assert.deepEqual(resolveSelection('?zone=z',map,zones),{townId:'a',zoneId:'z'});
});
test('GeoJSON longitude/latitude becomes Leaflet latitude/longitude exactly once',()=>{
  assert.deepEqual(pointLatLng({type:'Point',coordinates:[127.01,37.55]}),[37.55,127.01]);
  assert.equal(pointLatLng(null),null);
});
test('production snapshot loads from nested project path; all layers are present',async()=>{
 const paths=[];
 const get=async u=>{paths.push(new URL(u).pathname);return {ok:true,json:async()=>read('..'+new URL(u).pathname.replace('/moatown-map',''))}};
 const data=await loadSnapshot('https://example.org/moatown-map/',get);
 assert.equal(data.towns.length,138);assert.equal(data.towns.filter(t=>pointLatLng(t.representative_point)).length,104);
 assert.equal(data.zones.length,32);
 assert.equal(data.boundaries.features.filter(f=>f.properties.entity_type==='town').length,103);
 assert.equal(data.boundaries.features.filter(f=>f.properties.entity_type==='zone').length,32);
 assert.ok(paths.every(x=>x.startsWith('/moatown-map/moatown-data/')));
});

test('a reference point appears only for selected, visible towns without boundaries',async()=>{
  const {showReferencePin}=await import('../app.mjs');
  const visible=new Set(['with-shape','point-only']);
  const polygons=new Set(['with-shape']);
  assert.equal(showReferencePin('point-only',null,visible,polygons),false);
  assert.equal(showReferencePin('with-shape','with-shape',visible,polygons),false);
  assert.equal(showReferencePin('point-only','point-only',visible,polygons),true);
  assert.equal(showReferencePin('point-only','point-only',new Set(),polygons),false);
});

test('vector start failure leaves map and exposes raster failure without removing overlays',async()=>{
  const {attachBasemap}=await import('../map-engine.mjs');
  const status={textContent:''};
  const seen=[];
  const overlays=new Set(['local-shape']);
  let vectorEvent,tileError;
  const map={hasLayer:layer=>overlays.has(layer),removeLayer:layer=>overlays.delete(layer)};
  const vector={
    addTo(){overlays.add(this);},
    getMaplibreMap(){return {
      once(){},on(event,fn){if(event==='error')vectorEvent=fn;},
      getCanvas(){return {addEventListener(){}}}
    };}
  };
  const leaf={
    maplibreGL(options){seen.push(options);return vector;},
    tileLayer(url,options){seen.push({url,...options});return {
      on(_,cb){tileError=cb;},addTo(){overlays.add('raster');}
    };}
  };
  attachBasemap(leaf,map,status,{Map:function(){}});
  assert.ok(seen[0].style.endsWith('/positron'));
  assert.match(seen[0].attributionControl.customAttribution,/OpenMapTiles/);
  vectorEvent({error:new Error('style failed')});
  assert.equal(seen.length,2);
  assert.match(seen[1].attribution,/OpenStreetMap/);
  assert.deepEqual([...overlays],['local-shape','raster']);
  tileError();
  assert.match(status.textContent,/계속 이용/);
});

test('quiet preview URL round-trips without disturbing town or zone',async()=>{
  const {basemapMode,basemapUrl}=await import('../map-engine.mjs');
  const input=new URL('https://example.org/moatown-map/?town=town-a&zone=zone-a#legend');
  assert.equal(basemapMode(input.search),'detail');
  const switched=basemapUrl(input,'quiet');
  assert.equal(basemapMode(switched.search),'quiet');
  assert.equal(switched.searchParams.get('town'),'town-a');
  assert.equal(switched.searchParams.get('zone'),'zone-a');
  assert.equal(switched.hash,'#legend');
  assert.equal(basemapUrl(switched,'detail').href,input.href);
});

test('quiet mode fetches only same-origin context and supersedes delayed detailed startup without moving camera',async()=>{
  const {basemapSwitcher}=await import('../map-engine.mjs');
  const seen=[],active=new Set(),container={dataset:{}};
  let detailedResolve;
  const layer=()=>({addTo(){active.add(this);},addLayer(){}});
  const map={createPane:()=>({style:{}}),on(){},getContainer:()=>container,getZoom:()=>11,
    hasLayer:x=>active.has(x),removeLayer:x=>active.delete(x)};
  const leaf={layerGroup:layer,geoJSON:layer};
  const set=basemapSwitcher(leaf,map,{textContent:''},{
    read:async url=>{seen.push(url.pathname);return {ok:true,json:()=>({type:'FeatureCollection',features:[]})};},
    loadDetailed:()=>new Promise(r=>{detailedResolve=r;}),
    startDetailed:()=>{throw Error('superseded startup must never attach');}
  });
  await set('quiet');
  assert.equal(seen.length,1);
  assert.ok(seen[0].endsWith('/moatown-data/basemap/seoul-context.geojson'));
  const delayed=set('detail');
  await set('quiet');detailedResolve();
  await delayed;
  assert.equal(container.dataset.basemap,'quiet');
  assert.equal(seen.length,1);
  assert.equal(active.size,2);
});

test('static Seoul context contains all 25 distinct Korean district names and local road/water geometry',()=>{
  const resource='../moatown-data/basemap/seoul-context.geojson';
  assert.ok(fs.statSync(new URL(resource,import.meta.url)).size < 350_000,'overview context must stay below 350 KB');
  const source=read(resource);
  const byKind=kind=>source.features.filter(f=>f.properties.kind===kind);
  assert.equal(source.type,'FeatureCollection');
  assert.equal(byKind('district').length,25);
  const labels=byKind('label');
  assert.equal(new Set(labels.map(f=>f.properties.name)).size,25);
  for(const f of labels){
    assert.match(f.properties.name,/^[가-힣]+구$/);
    const [lat,lon]=pointLatLng(f.geometry);
    assert.ok(lat>37.4 && lat<37.72 && lon>126.7 && lon<127.2);
  }
  assert.ok(byKind('road').length);
  const han=byKind('water').find(f=>f.properties.name==='한강');
  assert.ok(han && ['Polygon','MultiPolygon'].includes(han.geometry.type),'real named Han River water polygon');
});

test('map wheel zoom is cursor anchored with fractional zoom and responsive fit above old cap',async()=>{
  const {mapInteractionOptions,overviewOptions}=await import('../app.mjs');
  assert.equal(mapInteractionOptions.scrollWheelZoom,true);
  assert.ok(mapInteractionOptions.zoomSnap>0 && mapInteractionOptions.zoomSnap<1);
  assert.ok(mapInteractionOptions.wheelPxPerZoomLevel>=80);
  const wide=overviewOptions({x:1363,y:936});
  assert.ok(wide.maxZoom>11);
  assert.ok(wide.paddingTopLeft[1]+wide.paddingBottomRight[1]<230);
  const tall=overviewOptions({x:390,y:760});
  assert.ok(tall.paddingTopLeft[1]>wide.paddingTopLeft[1]);
  assert.ok(tall.paddingTopLeft[0]+tall.paddingBottomRight[0]<=48);
  const short=overviewOptions({x:600,y:300});
  assert.ok(short.paddingTopLeft[1]+short.paddingBottomRight[1]<150);
});
