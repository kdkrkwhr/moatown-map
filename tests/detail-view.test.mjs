import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {formatValue,intervalBadge,projectEvents,unitsChange} from '../detail-format.mjs';
import {groupSubAreas} from '../app.mjs';
import {searchProjects} from '../project-search.mjs';
import {positionInGeometry} from '../address-reference.mjs';

const read=file=>JSON.parse(readFileSync(new URL('../moatown-data/'+file,import.meta.url),'utf8'));
const {files,coverage}=read('latest.json'),towns=read(files.towns),zones=read(files.zones);
const groups=groupSubAreas(towns,zones);

test('published figures preserve units, a valid zero, and date precision',()=>{
  assert.equal(formatValue(85420,'㎡'),'85,420㎡ (약 25,840평)');
  assert.equal(formatValue(50,'%'),'50.0%');
  assert.equal(formatValue(null,'%'),'확인 중');
  assert.equal(formatValue(0,'명'),'0명');
  assert.equal(formatValue('2024-02-29','date'),'2024.02.29');
  assert.equal(formatValue('2023-02-29','date'),'확인 중');
  assert.equal(formatValue('2026-11','date'),'2026년 11월 (일자 확인 중)');
  assert.equal(unitsChange(980,1650),'(+670세대 순증)');
  assert.equal(unitsChange(10,9),'(−1세대 순감)');
});

test('exact intervals use calendar days and ongoing intervals count the starting day',()=>{
  assert.equal(intervalBadge('2024-02-28','2024-03-01','2026-11-24'),'2일 소요 (약 0.1개월)');
  assert.equal(intervalBadge('2026-11-24',null,'2026-11-24',{ongoing:true}),'현재 1일째 진행 중');
  assert.equal(intervalBadge('2026-08-13',null,'2026-11-24',{ongoing:true}),'현재 104일째 진행 중');
  assert.equal(intervalBadge('2026-11','2026-11-23','2026-11-24'),'고시일 미확인');
  assert.equal(intervalBadge('2026-12-01',null,'2026-11-24',{ongoing:true}),'고시일 미확인');
  assert.equal(intervalBadge('2026-11-13',null,'2026-11-24',{terminal:true}),'사업 종료');
  assert.equal(projectEvents({}, {stage:'착공',field_evidence:{stage:{source_as_of:'2026-11-24'}}})[0].date,null);
});

test('every linked area has one parent and parcel pins resolve to the published cadastral index',()=>{
  const parcels=new Map(),polys=new Set(read(files.boundaries).features.map(f=>f.properties.entity_id));
  let points=0,pointOnly=0;
  for(const town of towns){
    assert.deepEqual(town.sub_areas,groups.get(town.id).map(z=>z.id));
    for(const z of groups.get(town.id)){
      if(!z.representative_point)continue;
      const {pnu,legal_dong,source_url,address_source_url}=z.representative_point_evidence;
      assert.ok(source_url && address_source_url,z.id);assert.match(pnu,/^11\d{17}$/);
      const district=pnu.slice(0,5),sub=Number(pnu.slice(15));
      if(!parcels.has(district))parcels.set(district,read('addresses/'+district+'.json').points);
      const lot=(pnu[10]==='2'?'산':'')+Number(pnu.slice(11,15))+(sub?'-'+sub:'');
      assert.deepEqual(z.representative_point.coordinates,parcels.get(district)[legal_dong][lot]);
      points++;if(!polys.has(z.id))pointOnly++;
    }
  }
  assert.equal(points,coverage.zone_representative_points);assert.equal(pointOnly,coverage.zone_point_only);
});

test('Sinwol drawing numbers and superseding review remain searchable',()=>{
  const town=towns.find(t=>t.name==='신월동 102-33'),group=groups.get(town.id);
  assert.deepEqual(group.map(z=>[z.drawing_code,z.registered_address,z.planned_units_total]),[
    ['A1','신월동 144-20',354],['A2','신월동 137-14',390],['A3','신월동 102-33',592],['A4','신월동 108-1',503]
  ]);
  assert.equal(group[0].previous_plan.planned_units_total,344);
  assert.equal(group[0].boundary_evidence.status,'reference_only');
  assert.deepEqual(searchProjects(towns,groups,[],{query:'신월동 102-33 A-3'}).map(r=>r.zone.id),[group[2].id]);
  assert.deepEqual(groupSubAreas([{id:'legacy'}],[{id:'old',town_id:'legacy'}]).get('legacy').map(z=>z.id),['old']);
});

test('both Sinwol towns have four separately selectable reference polygons tied to their official sources',()=>{
  const features=read(files.boundaries).features;
  const bounds=new Map(features.map(f=>[f.properties.entity_id,f]));
  assert.equal(bounds.size,coverage.boundary_features);
  assert.equal(features.filter(f=>f.properties.entity_type==='zone').length,coverage.zone_reference_boundaries);
  for(const [townId,notices] of [
    ['mt-202603-public-067',[null,'644883','640660','584443']],
    ['mt-202603-public-066',['594579','594579','594579','594579']]
  ]){
    const children=groups.get(townId);
    assert.equal(children.length,4);
    for(const [i,zone] of children.entries()){
      const feature=bounds.get(zone.id),p=feature.properties;
      assert.equal(p.parent_town_id,townId);
      assert.equal(p.boundary_status,'reference_only');
      assert.equal(zone.drawing_code,'A'+(i+1));
      for(const child of children){
        assert.equal(positionInGeometry(child.representative_point.coordinates,feature.geometry,0),child===zone?'inside':'outside');
      }
      if(!notices[i]){assert.equal(p.kind,'official_project_geometry');continue;}
      assert.equal(p.kind,'official_notice_drawing');
      assert.equal(new URL(p.source_url).searchParams.get('seq'),notices[i]);
      assert.equal(p.scope,['644883','640660'].includes(notices[i])?'association_project_area':'management_plan_project_area');
      assert.deepEqual(p.registration,zone.boundary_evidence.registration);
      assert.ok(p.pdf_page>0 && p.digitized_area_sqm>0 && p.registration.source_url);
      assert.equal(p.document_area_sqm,zone.project_area_m2);
    }
  }
});

test('contractor selections stay tied to named zones and the missing-field report matches the published rows',()=>{
  const byId=new Map(zones.map(z=>[z.id,z]));
  const contractors=ids=>ids.map(id=>byId.get(id).selected_contractor);
  assert.deepEqual(contractors(['a1','a2','a3','a4'].map(c=>'mz-plan-584443-'+c)),['호반건설',null,null,null]);
  const proof=byId.get('mz-plan-584443-a1').field_evidence.selected_contractor;
  assert.equal(proof.kind,'reported_selection');
  assert.equal(proof.selection_date,'2025-08-30');
  assert.equal(proof.contract_date,undefined);
  assert.deepEqual(contractors(['mz-seoul-11000uq120ps202505310477','mz-junghwa-2-2','mz-junghwa-2-3','mz-junghwa-2-5']),['DL건설','DL건설','DL건설','계룡건설산업']);
  assert.equal(byId.get('mz-plan-601972-a-1').selected_contractor,'계룡건설산업');
  assert.deepEqual(read(files.review).missing_fields.zone_selected_contractor.toSorted(),zones.filter(z=>!z.selected_contractor).map(z=>z.id).toSorted());
});
