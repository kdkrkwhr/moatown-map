import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {filterTowns,resolveSelection,pointLatLng,loadSnapshot,zoneStage,elapsedMonths} from '../app.mjs';
const read=u=>JSON.parse(fs.readFileSync(new URL(u,import.meta.url),'utf8'));
test('the stage legend covers every published zone stage and keeps missing values distinct',()=>{
  const manifest=read('../moatown-data/latest.json');
  const zones=read('../moatown-data/'+manifest.files.zones);
  for(const zone of zones)assert.equal(zoneStage(zone.stage).label,zone.stage ?? '미확인');
  assert.equal(new Set(zones.map(zone=>zoneStage(zone.stage).ink)).size,new Set(zones.map(zone=>zone.stage)).size);
});
test('housing breakdowns reconcile with the published plan for their own zone',()=>{
  const manifest=read('../moatown-data/latest.json');
  const zones=read('../moatown-data/'+manifest.files.zones);
  const coverage=manifest.coverage;
  assert.equal(zones.filter(z=>z.selected_contractor).length,coverage.zones_with_contractor);
  assert.equal(zones.filter(z=>z.planned_units_total!=null).length,coverage.zone_records_with_plan_numbers);
  for(const zone of zones){
    const rows=zone.unit_types ?? zone.published_private_area_bands;
    if(rows)assert.equal(rows.reduce((sum,row)=>sum+row.units,0),zone.planned_units_total);
    if(zone.unit_types){
      assert.ok(zone.unit_types.every(row=>row.type && Number(row.private_area_m2)>0));
      assert.ok(zone.field_evidence.plan.attachment_name);
      assert.ok(zone.field_evidence.stage.approval_date<=zone.field_evidence.plan.source_as_of);
      assert.ok(Object.values(zone.approved_allocation).reduce((a,b)=>a+b,0)<=zone.planned_units_total);
    }
    if(zone.selected_contractor)assert.ok(zone.field_evidence.selected_contractor.source_url.startsWith('https://'));
  }
  const bun=zones.find(z=>z.name==='번동1구역');
  assert.deepEqual(bun.previous_plan.published_private_area_bands.filter(row=>row.type==='임대').map(row=>[row.privateAreaBandM2,row.units]),[['40 초과~50 이하',12],['50 초과',18]]);
  assert.equal(bun.housing_allocation.rental,18);
  assert.equal(bun.field_evidence.plan.notice_number,'서울특별시 고시 제2026-566호');
});
test('management notices stay scoped to each address in a joint listing',()=>{
  const manifest=read('../moatown-data/latest.json');
  const towns=read('../moatown-data/'+manifest.files.towns);
  const notices=towns.flatMap(t=>t.management_plan_notices ?? []);
  assert.equal(notices.length,manifest.coverage.management_plan_notice_records);
  assert.equal(towns.filter(t=>t.management_plan_notices?.length).length,manifest.coverage.towns_with_management_plan_notices);
  const joint=towns.find(t=>t.name==='등촌2동 515-44');
  assert.deepEqual(joint.management_plan_notices.filter(n=>Number.isInteger(n.zone_count)).map(n=>[n.site,n.zone_count]),[['등촌2동 515-44',4],['등촌2동 520-3',2]]);
  assert.deepEqual(joint.management_plan_notices.filter(n=>n.notice_number?.includes('2026-282')).map(n=>n.site).sort(),['등촌동 515-44','등촌동 520-3']);
});
test('published milestone intervals use calendar months and only apply to the cited project group',()=>{
  const manifest=read('../moatown-data/latest.json');
  const towns=read('../moatown-data/'+manifest.files.towns);
  const zones=read('../moatown-data/'+manifest.files.zones);
  const group=towns.find(town=>town.id==='mt-202603-public-034');
  const history=group.published_timeline;
  assert.equal(history.zone_ids.length,5);
  assert.ok(history.zone_ids.every(id=>zones.find(z=>z.id===id)?.town_id===group.id));
  const dates=history.events.map(event=>event.month);
  assert.deepEqual(dates.slice(1).map((end,i)=>elapsedMonths(dates[i],end)),[15,17]);
  assert.equal(elapsedMonths(dates[2],dates[1]),null);
  assert.equal(elapsedMonths(undefined,dates[1]),null);
});
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
test('GeoJSON longitude/latitude becomes map latitude/longitude exactly once',()=>{
  assert.deepEqual(pointLatLng({type:'Point',coordinates:[127.01,37.55]}),[37.55,127.01]);
  assert.equal(pointLatLng(null),null);
});
test('production snapshot loads from the custom domain root with all layers present',async()=>{
 const paths=[];
 const get=async u=>{paths.push(new URL(u).pathname);return {ok:true,json:async()=>read('..'+new URL(u).pathname)}};
 const data=await loadSnapshot('https://moatownmap.com/',get);
 const coverage=data.manifest.coverage;
 assert.equal(data.towns.length,coverage.town_records);
 assert.equal(data.towns.filter(t=>pointLatLng(t.representative_point)).length,coverage.representative_points);
 assert.equal(data.zones.length,coverage.zone_records);
 assert.equal(data.boundaries.features.filter(f=>f.properties.entity_type==='town').length,coverage.town_reference_boundaries);
 assert.equal(data.boundaries.features.filter(f=>f.properties.entity_type==='zone').length,coverage.zone_reference_boundaries);
 assert.ok(paths.every(x=>x.startsWith('/moatown-data/')));
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

test('normal and hybrid keep the cadastral overlay independent and support older map links',async()=>{
  const {mapSettings}=await import('../map-engine.mjs');
  assert.deepEqual(mapSettings('?map=detail&town=a'),{hybrid:false,cadastral:false});
  assert.deepEqual(mapSettings('?map=hybrid&cadastral=1&zone=b'),{hybrid:true,cadastral:true});
  assert.deepEqual(mapSettings('?cadastral=1'),{hybrid:false,cadastral:true});
});
test('fit padding compensates only the part of the panel that covers the map',async()=>{
  const {fitPadding}=await import('../map-engine.mjs');
  const box=(left,top,width,height)=>({left,top,width,height,right:left+width,bottom:top+height});
  const map=box(0,60,1200,720);
  assert.deepEqual(fitPadding(map,box(0,60,370,720)),{top:50,right:50,bottom:50,left:420});
  assert.equal(fitPadding(box(370,60,830,720),box(0,60,370,720)).left,50);
  assert.equal(fitPadding(map,box(0,560,1200,220)).bottom,270);
  const phone=box(0,42,390,802),dock=box(0,42,390,105);
  assert.deepEqual(fitPadding(phone,box(8,675,374,146),dock),{top:152,right:47,bottom:216,left:47});
  const tall=fitPadding(phone,box(8,165,374,656),dock);
  assert.ok(tall.bottom>650 && tall.left<10);
  assert.ok(phone.height-tall.top-tall.bottom>0);
});
test('straight-line distances include a consistently rounded walking estimate',async()=>{
  const {distanceText}=await import('../map-engine.mjs');
  assert.equal(distanceText(340),'직선 약 340m · 도보 약 5분');
  assert.equal(distanceText(1200),'직선 약 1.2km · 도보 약 18분');
});
test('geocoding rejects ambiguous, unavailable and non-Seoul coordinates',async()=>{
  const {geocodeSeoul}=await import('../address-reference.mjs');
  const row={roadAddress:'서울특별시 중구 세종대로 110',x:'126.978',y:'37.566'};
  const mock=(rows,status=200)=>({Status:{OK:200},geocode(_,done){done(status,{v2:{addresses:rows,meta:{totalCount:rows.length}}});}});
  assert.deepEqual(await geocodeSeoul('서울시청',mock([row])),{label:row.roadAddress,point:[126.978,37.566]});
  assert.equal(await geocodeSeoul('광장',mock([row,row])),null);
  assert.equal(await geocodeSeoul('부산',mock([{...row,roadAddress:'부산광역시 중구'}])),null);
  await assert.rejects(geocodeSeoul('서울',mock([],500)));
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
