import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import booleanPointInPolygon from '../vendor/turf/boolean-point-in-polygon.mjs';
import {buildExpandedLayouts} from '../scripts/expanded-layouts.mjs';

const shape=(id,x,width)=>({type:'Feature',properties:{entity_id:id},geometry:{type:'Polygon',
  coordinates:[[[x,37.5],[x+width,37.5],[x+width,37.5018],[x,37.5018],[x,37.5]]]}});
const town={id:'town',name:'대상지'},zone={id:'z',town_id:'town',name:'사업구역',planned_units_total:100,
  field_evidence:{plan:{source_url:'https://example.com/zone',source_as_of:'2026-01-01'}}};
const shapes=new Map([['town',shape('town',127,.006)],['z',shape('z',127.001,.002)]]);
const record={floors:15,units:800,scope:'대상지',source_url:'https://example.com/town',source_as_of:'2026-02-01'};
const build=(townPlan,rows=[zone],zoneRecords={},geometries=shapes)=>buildExpandedLayouts(town,rows,geometries,townPlan,zoneRecords);

test('whole-town and child illustrations preserve independent boundaries, quantities and sources',()=>{
  const scene=build(record);
  assert.equal(scene.modes.town.summaries.town.units,800);
  assert.equal(scene.modes.zones.summaries.z.units,100);
  assert.equal(scene.zones.z.source_url,zone.field_evidence.plan.source_url);
  assert.equal(scene.modes.zones.summaries.z.capSource,'default');
  assert.ok(scene.modes.town.features.every(f=>f.properties.zone_id==='town'));
  assert.ok(scene.modes.zones.features.every(f=>f.properties.zone_id==='z'));
});

test('a change of project extent preserves the public source without placing it on a superseded shape',()=>{
  const latest={...record,scope_geometry_mismatch:true};
  const scene=build(record,[zone],{z:latest});
  assert.equal(scene.zones.z.source_url,latest.source_url);
  assert.ok(!scene.modes.zones);
  assert.ok(!build(latest,[],{}));
  const previous={...record,kind:'historical_management_plan',units:201,source_as_of:'2024-01-01'};
  const oldScene=buildExpandedLayouts(town,[zone],shapes,record,{z:latest},{z:previous});
  assert.equal(oldScene.modes.zones.summaries.z.units,201);
  assert.equal(oldScene.updated_zones.z.units,800);
  assert.equal(oldScene.zones.z.source_as_of,'2024-01-01');
  const child=build(record,[zone],{z:{...record,floors:null}});
  assert.equal(child.modes.zones.summaries.z.capSource,'town');
});

test('missing floors stay null in sources and any illustrative height identifies its assumption',()=>{
  const scene=build(null);
  assert.equal(scene.zones.z.floors,null);
  assert.equal(scene.modes.zones.summaries.z.capSource,'default');
  assert.equal(scene.modes.zones.summaries.z.capFloors,20);
  assert.ok(!scene.modes.town);
  assert.ok(!build(null,[]));
  assert.ok(!build(null,[zone],{},new Map([['town',shapes.get('town')]])));
  assert.ok(!build(record,[zone],{},new Map()));
});

test('published building count takes priority and a local source supplies its own cap',()=>{
  const published={...record,scope:'사업구역',units:123,floors:35,height_m:99.35,building_count:4};
  const scene=build(record,[zone],{z:published});
  const s=scene.modes.zones.summaries.z;
  assert.equal(s.units,123);
  assert.equal(s.publishedCount,4);
  assert.equal(s.blocks,4);
  assert.equal(s.capSource,'zone');
  assert.equal(s.maxHeight,99.35);
});

test('every released mass fits its own boundary and all source-backed buildable zones are accounted for',()=>{
  const root=new URL('../moatown-data/',import.meta.url),read=path=>JSON.parse(readFileSync(new URL(path,root)));
  const m=read('latest.json'),published=read('plans/expanded-index.json').towns;
  const boundaries=new Map(read(m.files.boundaries).features.map(f=>[f.properties.entity_id,f]));
  const pilots=new Set(Object.keys(read(m.files.pilot_plans).towns));
  const catalog=read('plans/citywide-zone-programs.json'),childPrograms=catalog.zones;
  const held=read('plans/unplaced-programs.json');
  for(const [id,record] of Object.entries(childPrograms)){
    if(!record.scope_geometry_mismatch)continue;
    assert.equal(held[id]?.source_url,record.source_url,'missing evidence for changed extent '+id);
    if(catalog.previous_geometry_programs?.[id]){
      const parent=read(m.files.zones).find(z=>z.id===id).town_id,scene=read(published[parent].path);
      assert.equal(scene.zones[id].source_url,catalog.previous_geometry_programs[id].source_url);
      assert.equal(scene.updated_zones[id].units,record.units);
      assert.ok(scene.modes.zones.summaries[id].blocks>0);
    }
  }
  const expected=read(m.files.zones).filter(z=>!pilots.has(z.town_id)&&boundaries.has(z.id)&&!childPrograms[z.id]?.scope_geometry_mismatch&&
    (z.planned_units_total>0&&z.field_evidence?.plan?.source_url || childPrograms[z.id]?.floors>0 || childPrograms[z.id]?.units>0));
  for(const z of expected)assert.ok(published[z.town_id]?.zone_ids.includes(z.id),'omitted eligible zone '+z.id);
  for(const [id,entry] of Object.entries(published)){
    const scene=read(entry.path);
    for(const [scope,mode] of Object.entries(scene.modes)){
      assert.ok(mode.features.length>0);
      if(scope==='town')assert.ok(!scene.plan.scope_geometry_mismatch);
      const totals=new Map();
      for(const f of mode.features){
        const key=f.properties.zone_id,boundary=boundaries.get(key),s=mode.summaries[key];
        assert.ok(boundary && f.properties.floors>0 && f.properties.floors<=s.capFloors);
        assert.ok(scope==='town'?key===id:entry.zone_ids.includes(key));
        assert.ok(f.properties.height_m>0);
        for(const point of f.geometry.coordinates[0])assert.ok(booleanPointInPolygon(point,boundary),f.id);
        totals.set(key,(totals.get(key)??0)+1);
      }
      for(const [key,s] of Object.entries(mode.summaries))assert.equal(s.blocks,totals.get(key)??0);
    }
  }
});
