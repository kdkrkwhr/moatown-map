import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseLot,matchingDistricts} from '../address-reference.mjs';

const read=file=>JSON.parse(readFileSync(new URL('../moatown-data/'+file,import.meta.url),'utf8'));
const {files,coverage}=read('latest.json');
const towns=read(files.towns),zones=read(files.zones),index=read(files.parcel_index);

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
