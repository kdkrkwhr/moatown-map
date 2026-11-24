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
