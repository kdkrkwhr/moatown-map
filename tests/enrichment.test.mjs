import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseLot,matchingDistricts,positionInGeometry} from '../address-reference.mjs';

const read=file=>JSON.parse(readFileSync(new URL('../moatown-data/'+file,import.meta.url),'utf8'));
const {files,coverage}=read('latest.json');
const towns=read(files.towns),zones=read(files.zones),index=read(files.parcel_index);

test('Siheung contractor selection and contract dates belong to separate associations',()=>{
  const a1=zones.find(z=>z.id==='mz-notice-public-026-a-1');
  const a5=zones.find(z=>z.id==='mz-plan-601822-a-5');
  assert.equal(a1.selected_contractor,'쌍용건설');
  assert.equal(a1.field_evidence.selected_contractor.selection_date,'2024-04-28');
  assert.equal(a5.selected_contractor,'신원종합개발');
  assert.equal(a5.field_evidence.selected_contractor.contract_date,'2022-05-25');
  assert.match(a5.field_evidence.selected_contractor.source_url,/rcpNo=20220526900050/);
  assert.equal(a5.timeline.find(e=>e.stage==='사업시행계획인가').date,'2024-04-09');
});

test('the revised Hwagok A2-3 lot lies outside the historical zone with the same label',()=>{
  const historical=zones.find(z=>z.id==='mz-seoul-11500uq120ps202603130003');
  const boundary=read(files.boundaries).features.find(f=>f.properties.entity_id===historical.id);
  const lots=read('addresses/11500.json').points['화곡동'];
  assert.equal(positionInGeometry(lots['366-38'],boundary.geometry),'inside');
  assert.equal(positionInGeometry(lots['354-128'],boundary.geometry),'outside');
  assert.notEqual(historical.field_evidence.stage?.source_url,'https://www.gangseo.seoul.kr/build/bui070102/324767');
  assert.equal(historical.field_evidence.stage_review.state,'scope_mismatch');
});

test('missing-field lists and published coverage describe the same snapshot',()=>{
  const missing=read(files.review).missing_fields;
  for(const [rows,absent,count,pick] of [
    [towns,'town_rights_cutoff_history','towns_with_cutoff_history',t=>t.rights_cutoff_history?.length],
    [towns,'town_land_transaction_permit','towns_with_permit_record',t=>t.land_transaction_permit],
    [towns,'town_planned_units','towns_with_planned_units',t=>Number.isFinite(t.metrics?.planned_units)],
    [zones,'zone_selected_contractor','zones_with_contractor',z=>z.selected_contractor],
    [zones,'zone_stage','zones_with_stage',z=>z.stage],
    [zones,'zone_planned_units_total','zone_records_with_plan_numbers',z=>Number.isFinite(z.planned_units_total)]
  ]){
    assert.deepEqual(missing[absent],rows.filter(row=>!pick(row)).map(row=>row.id));
    assert.equal(coverage[count],rows.filter(pick).length);
  }
});

test('published town metrics retain field sources and allocations reconcile within their own plan',()=>{
  for(const t of towns){
    for(const key of Object.keys(t.metrics??{})){
      const e=t.field_evidence?.['metrics.'+key];
      assert.ok(e?.source_url?.startsWith('https://') && e.checked_on && e.kind,t.id+' '+key);
    }
    for(const key of ['rental','sale_total']){
      const a=t.housing_allocation?.[key];
      if(a==null)continue;
      const e=t.field_evidence['housing_allocation.'+key];
      assert.equal(e.planned_units_in_source,t.metrics.planned_units,t.id);
      assert.ok(a>=0 && a<=t.metrics.planned_units,t.id);
    }
    for(const h of t.rights_cutoff_history??[])assert.ok(h.scope && h.date && h.evidence?.source_url,t.id);
  }
});

test('the Siheung revised plan and the Hwagok inspection draft each reconcile to their own rows',()=>{
  for(const [id,total,rental] of [['mt-202603-public-026',2151,717],['mt-202603-public-006',899,103]]){
    const t=towns.find(t=>t.id===id),rows=zones.filter(z=>z.town_id===id);
    assert.equal(rows.reduce((sum,z)=>sum+z.planned_units_total,0),total);
    assert.equal(rows.reduce((sum,z)=>sum+z.housing_allocation.rental,0),rental);
    assert.equal(t.metrics.planned_units,total);
    if(id.endsWith('006'))assert.ok(rows.every(z=>z.field_evidence.plan.kind==='management_plan_public_inspection'));
  }
});

test('plan zoning coverage counts each town with a published planned area once',()=>{
  const withPlanAreas=towns.filter(town=>town.zoning?.areas?.some(
    area=>Number.isFinite(area?.planned_sqm) && area.planned_sqm>=0
  ));
  assert.equal(coverage.towns_with_plan_zoning,withPlanAreas.length);
});

test('each Seoul district can resolve a lot without loading any other district file',()=>{
  assert.equal(new Set(index.districts.map(d=>d.code)).size,25);
  let count=0;
  for(const district of index.districts){
    const {points,evidence}=read('addresses/'+district.file);
    assert.equal(evidence.source_crs,'EPSG:5179');
    assert.deepEqual(Object.keys(points).sort(),district.dongs);
    for(const [dong,lots] of Object.entries(points)){
      const lot=Object.keys(lots)[0];
      const key=parseLot(district.name+' '+dong+' '+lot);
      assert.ok(key,dong);
      assert.deepEqual(matchingDistricts(index,key),[district]);
      const [lon,lat]=lots[key.lot];assert.ok(lon>126 && lon<128 && lat>37 && lat<38);
      count+=Object.keys(lots).length;
    }
  }
  assert.equal(count,coverage.indexed_parcels);
  assert.equal(count,index.count);
  assert.ok(matchingDistricts(index,parseLot('신사동 1')).length>1);
  assert.equal(parseLot('부산광역시 중구 중앙동 1'),null);
});

test('new town pins resolve to the exact indexed PNU and every missing point has a review entry',()=>{
  const filesByCode=new Map();
  for(const t of towns){
    const e=t.representative_point_evidence;
    if(e?.layer!=='landbiz:ln_parcel')continue;
    assert.match(e.pnu,/^11\d{17}$/);
    const district=index.districts.find(d=>d.code===e.pnu.slice(0,5));
    if(!filesByCode.has(district.code))filesByCode.set(district.code,read('addresses/'+district.file).points);
    const sub=Number(e.pnu.slice(15));
    const lot=(e.pnu[10]==='2'?'산':'')+Number(e.pnu.slice(11,15))+(sub?'-'+sub:'');
    assert.deepEqual(filesByCode.get(district.code)[e.legal_dong][lot],t.representative_point.coordinates);
  }
  assert.deepEqual(read(files.review).missing_points.map(t=>t.id).sort(),towns.filter(t=>!t.representative_point).map(t=>t.id).sort());
});

test('area-specific cutoffs and limited road permits keep their notice and geographic scope',()=>{
  const hap=towns.find(t=>t.name==='합정동 369');
  assert.equal(hap.rights_cutoff_date,null);
  assert.equal(hap.rights_cutoff_history.find(r=>r.scope==='추가 구역').date,'2024-05-09');
  assert.equal(hap.rights_cutoff_history.find(r=>r.scope==='제척 구역').status,'실효');
  const seok=towns.find(t=>t.name==='석관동 207-1');
  assert.equal(seok.land_transaction_permit.roads_only,true);
  assert.equal(seok.land_transaction_permit.end_date,'2031-08-10');
  for(const t of towns){
    if(t.land_transaction_permit)assert.ok(t.field_evidence.land_transaction_permit.source_as_of);
    if(t.zoning?.observed)assert.ok(['reference_boundary_interior','representative_point'].includes(t.zoning.observed.scope));
  }
});

test('all linked projects have a unique ID and the Hapjeong plan reconciles across the four drawing IDs',()=>{
  assert.equal(zones.length,new Set(zones.map(z=>z.id)).size);
  assert.ok(zones.every(z=>towns.some(t=>t.id===z.town_id)));
  const group=zones.filter(z=>z.town_id===towns.find(t=>t.name==='합정동 369').id);
  const sum=get=>group.reduce((s,z)=>s+get(z),0);
  assert.equal(sum(z=>z.metrics.owner_count),1007);
  assert.equal(sum(z=>z.metrics.existing_units),922);
  assert.equal(sum(z=>z.planned_units_total),1113);
  assert.equal(sum(z=>z.housing_allocation.rental),129);
  assert.ok(group.every(z=>z.housing_allocation.members===null && z.housing_allocation.general===null));
});
