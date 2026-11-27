import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseLot,matchingDistricts,positionInGeometry} from '../address-reference.mjs';
import {awardHistories,projectEvents} from '../detail-format.mjs';

const read=file=>JSON.parse(readFileSync(new URL('../moatown-data/'+file,import.meta.url),'utf8'));
const {files,coverage}=read('latest.json');
const towns=read(files.towns),zones=read(files.zones),index=read(files.parcel_index);

test('the five-town release preserves all 25 parcel points and identifies the housing site within each project',()=>{
  const dir='snapshots/2026-11-27/five-town-boundaries/';
  const audit=read(dir+'review.json').five_town_boundary_review;
  const before=new Set(read(audit.baseline_boundaries).features.map(f=>f.properties.entity_id));
  const old=read(audit.baseline_zones).filter(z=>audit.town_ids.includes(z.town_id) && z.representative_point && !before.has(z.id));
  const records=new Map(read(dir+'zones.json').map(z=>[z.id,z]));
  const shapes=new Map(read(dir+'boundaries.geojson').features.map(f=>[f.properties.entity_id,f]));
  assert.equal(old.length,25);
  assert.deepEqual(audit.results.map(row=>row.zone_id).sort(),old.map(z=>z.id).sort());
  for(const z of old){
    const updated=records.get(z.id),feature=shapes.get(z.id);
    assert.deepEqual(updated.representative_point,z.representative_point);
    assert.equal(feature.properties.source_url,updated.boundary_evidence.source_url);
    assert.equal(feature.properties.boundary_status,'reference_only');
    assert.equal(positionInGeometry(feature.properties.label_point.coordinates,feature.geometry,0),'inside',z.id);
    assert.ok(updated.housing_site_area_m2>0 && updated.field_evidence.housing_site_area_m2.source_url);
  }
  assert.equal(shapes.get('mz-plan-594346-a-2').geometry.type,'MultiPolygon');
  const jayang=records.get('mz-plan-639882-1121510500106400000');
  assert.equal(jayang.project_area_m2,20436.6);
  assert.equal(jayang.association_boundaries[0].properties.source_area_m2,20639.8);
});

test('the four-town boundary review accounts for every previously pin-only zone and preserves its parcel point',()=>{
  const dir='snapshots/2026-11-27/four-town-boundaries/';
  const audit=read(dir+'review.json').zone_pin_boundary_review;
  const before=new Set(read(audit.baseline_boundaries).features.map(f=>f.properties.entity_id));
  const original=read(audit.baseline_zones).filter(z=>audit.town_ids.includes(z.town_id)&&z.representative_point&&!before.has(z.id));
  const records=new Map(read(dir+'zones.json').map(z=>[z.id,z]));
  const features=new Map(read(dir+'boundaries.geojson').features.map(f=>[f.properties.entity_id,f]));
  const outcomes=new Map(audit.results.map(r=>[r.zone_id,r]));
  assert.deepEqual(original.map(z=>z.id).sort(),[...outcomes.keys()].sort());
  assert.equal(original.length,26);
  for(const z of original){
    const after=records.get(z.id),review=outcomes.get(z.id);
    assert.deepEqual(after.representative_point,z.representative_point,z.id);
    if(review.outcome==='parcel_point_retained'){
      assert.ok(review.reason);assert.ok(!features.has(z.id));continue;
    }
    const f=features.get(z.id);
    assert.equal(review.outcome,'reference_boundary');
    assert.equal(f.properties.parent_town_id,z.town_id);
    assert.equal(f.properties.boundary_status,'reference_only');
    assert.equal(f.properties.source_url,after.boundary_evidence.source_url);
    assert.match(review.source_as_of,/^\d{4}-\d{2}-\d{2}$/);
    assert.equal(positionInGeometry(f.properties.label_point.coordinates,f.geometry,0),'inside',z.id);
  }
});

test('approval boundaries, housing sites and draft road connections retain their own scope',()=>{
  const release=read('snapshots/2026-11-27/four-town-boundaries/zones.json');
  const byId=new Map(release.map(z=>[z.id,z]));
  const siheung=byId.get('mz-notice-public-026-a-1');
  assert.equal(siheung.project_area_m2,14010.7);
  assert.equal(siheung.housing_site_area_m2,13092.1);
  assert.equal(siheung.housing_allocation.sale_total+siheung.housing_allocation.rental,siheung.planned_units_total);
  const sadang=byId.get('mz-notice-public-059-a-2-1');
  assert.equal(sadang.project_area_m2,sadang.housing_site_area_m2+682.4);
  const gocheok=byId.get('mz-plan-601972-a-2');
  assert.equal(gocheok.project_area_m2,13983.3);
  assert.equal(gocheok.association_boundaries[0].properties.source_area_m2,13915);
  const majang=byId.get('mz-plan-607655-a2');
  assert.equal(majang.boundary_evidence.source_as_of,'2024-12-26');
  assert.deepEqual(majang.plan_overlays.map(f=>f.properties.published_area_m2).sort((a,b)=>a-b),[551.5,867.3]);
  for(const road of majang.plan_overlays){
    assert.equal(road.properties.kind,'public_inspection_road');
    assert.equal(road.properties.source_as_of,'2026-11-05');
  }
});

test('all previously unplaced zones have a documented location review and drawing labels stay inside their own zone',()=>{
  const path='snapshots/2026-11-27/zone-locations/';
  const audit=read(path+'review.json').zone_location_review;
  const oldIds=new Set(read(audit.baseline_boundaries).features.map(f=>f.properties.entity_id));
  const expected=read(audit.baseline_zones).filter(z=>!oldIds.has(z.id) && !z.representative_point).map(z=>z.id);
  assert.deepEqual(audit.results.map(r=>r.zone_id).sort(),expected.sort());
  const byId=new Map(read(path+'zones.json').map(z=>[z.id,z]));
  const features=new Map(read(path+'boundaries.geojson').features.map(f=>[f.properties.entity_id,f]));
  for(const row of audit.results){
    const zone=byId.get(row.zone_id),feature=features.get(row.zone_id);
    assert.equal(row.town_id,zone.town_id);
    assert.match(row.source_url,/^https:\/\//);
    assert.match(row.source_as_of,/^\d{4}-\d{2}-\d{2}$/);
    if(row.outcome==='reference_boundary'){
      assert.equal(feature.properties.boundary_status,'reference_only');
      assert.equal(feature.properties.parent_town_id,zone.town_id);
      assert.equal(feature.properties.source_url,zone.boundary_evidence.source_url);
      assert.equal(positionInGeometry(feature.properties.label_point.coordinates,feature.geometry,0),'inside',zone.id);
    }else if(row.outcome==='parcel_point'){
      assert.equal(zone.representative_point.type,'Point');
      assert.ok(zone.representative_point_evidence.source_url);
    }else{
      assert.equal(row.outcome,'withheld');assert.equal(feature,undefined);assert.ok(!zone.representative_point);
      assert.equal(zone.field_evidence.location_review.note,row.reason);assert.ok(row.reason);
    }
  }
});

test('Cheongnyong district figures keep the approval and later inspection rental schedules separate',()=>{
  const release=read('snapshots/2026-11-27/zone-locations/zones.json');
  const rows=release.filter(z=>z.town_id==='mt-202603-public-073');
  const sum=pick=>rows.reduce((total,z)=>total+pick(z),0);
  assert.equal(sum(z=>z.metrics.owner_count),247);
  assert.equal(sum(z=>z.metrics.existing_units),387);
  assert.equal(sum(z=>z.planned_units_total),507);
  assert.equal(sum(z=>z.approved_supply_history[0].rental),92);
  assert.equal(sum(z=>z.housing_allocation.rental),71);
  for(const z of rows){
    assert.equal(z.approved_supply_history[0].evidence.source_as_of,'2026-02-05');
    assert.equal(z.field_evidence['housing_allocation.rental'].source_as_of,'2026-02-12');
  }
});

test('Dunchon association notices retain their own boundaries and the 448-unit tender uses its matching site',()=>{
  const townId='mt-202603-public-056';
  const release=read('snapshots/2026-11-27/zone-locations/zones.json').filter(z=>z.town_id===townId);
  const scene=read('plans/scenes/'+townId+'.json');
  const expectedAreas={'A-1':14531.75,'A-2':15592.87,'B-1':14095.77};
  for(const z of release){
    const [boundary]=z.association_boundaries;
    assert.equal(boundary.properties.source_area_m2,expectedAreas[z.drawing_code]);
    assert.equal(boundary.properties.source_page,2);
    assert.equal(boundary.properties.plan_overlap.published_plan_zone,z.drawing_code);
    assert.equal(z.stage,'조합설립인가');
    if(z.drawing_code!=='B-1')continue;
    const program=scene.zones[z.id];
    assert.equal(program.association_notice_number,boundary.properties.notice_number);
    assert.deepEqual([program.units,program.floors],[448,29]);
    const blocks=scene.modes.zones.features.filter(f=>f.properties.zone_id===z.id);
    assert.ok(blocks.length>0);
    for(const block of blocks)for(const point of block.geometry.coordinates[0]){
      assert.equal(positionInGeometry(point,boundary.geometry,0),'inside');
    }
  }
  assert.equal(release.length,3);
});

test('November review preserves the three town totals and dates the earlier allocations separately',()=>{
  const boundaries=new Map(read(files.boundaries).features.map(f=>[f.properties.entity_id,f.geometry]));
  for(const [suffix,n,latest,draft,rental] of [['039',6,2441,2447,441],['048',2,1485,1489,240],['069',3,1786,1788,284]]){
    const town=towns.find(t=>t.id==='mt-202603-public-'+suffix),children=zones.filter(z=>z.town_id===town.id);
    assert.equal(children.length,n);
    assert.equal(town.metrics.planned_units,latest);
    assert.equal(children.reduce((sum,z)=>sum+z.previous_plan.planned_units_total,0),draft);
    assert.equal(children.reduce((sum,z)=>sum+z.previous_plan.rental_units,0),rental);
    for(const z of children){
      assert.equal(z.planned_units_total,null);
      assert.equal(z.previous_plan.evidence.source_as_of,z.boundary_evidence.source_as_of);
      assert.equal(positionInGeometry(z.representative_point.coordinates,boundaries.get(z.id),0),'inside');
      if(suffix==='048')assert.equal(z.registered_address,null);
    }
  }
  const jangwi=zones.filter(z=>z.town_id==='mt-202603-resident-035');
  assert.deepEqual(jangwi.map(z=>[z.drawing_code,z.selected_contractor,z.planned_units_total,z.metrics.owner_count??null]),
    [['11-3','계룡건설산업',176,null],['11-4','금호건설',210,133]]);
});

test('every blank stage in the audit baseline has a scoped, sourced outcome',()=>{
  const release='snapshots/2026-11-26/stage-audit/';
  const audit=read(release+'review.json').stage_audit;
  const before=read(audit.baseline_zone_file);
  const after=new Map(read(release+'zones.json').map(z=>[z.id,z]));
  const reviewed=[...audit.verified_zone_ids,...audit.related_history_only_ids,...audit.pending_zone_ids];
  assert.equal(reviewed.length,audit.reviewed);
  assert.deepEqual(reviewed.sort(),before.filter(z=>!z.stage).map(z=>z.id).sort());
  for(const old of before){
    const z=after.get(old.id);
    if(old.stage){assert.deepEqual(z,old);continue;}
    const isDirect=audit.verified_zone_ids.includes(z.id);
    const e=isDirect?z.field_evidence.stage:z.field_evidence.stage_review;
    assert.equal(Boolean(z.stage),isDirect,z.id);
    assert.ok(e.source_url.startsWith('https://') && e.note && e.checked_on===audit.checked_on,z.id);
    if(audit.related_history_only_ids.includes(z.id))assert.ok(e.scoped_events?.length,z.id);
    for(const event of e.scoped_events??[])assert.ok(event.project_name && event.stage && event.source_url.startsWith('https://'),z.id);
  }
});

test('source dates, scoped events and contracting events do not become administrative milestones',()=>{
  const group=zones.find(z=>z.id==='mz-plan-641915-a1');
  const reviewed=zones.find(z=>z.id==='mz-plan-587169-project-2');
  const tender=zones.find(z=>z.id==='mz-plan-613956-1126010100101100036');
  const t=id=>towns.find(row=>row.id===id);
  assert.equal(projectEvents(t(group.town_id),group)[0].stage,'조합설립인가 전 주민공람 시작');
  assert.equal(reviewed.stage,null);
  assert.ok(reviewed.field_evidence.stage_review.scoped_events.length);
  assert.deepEqual(awardHistories(tender).flatMap(h=>h.events.map(e=>e.date)),['2026-05-16','2026-05-28']);
  assert.ok(!projectEvents(t(tender.town_id),tender).some(e=>e.date==='2026-05-28'));
  const bangbae=zones.find(z=>z.id.includes('584797'));
  assert.equal(projectEvents(t(bangbae.town_id),bangbae).at(-1).date,null);
});

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

test('the contractor audit covers every previously empty zone and preserves existing selections',()=>{
  const release='snapshots/2026-11-26/contractors/';
  const audit=read(release+'review.json').contractor_audit;
  const earlier=read(audit.baseline_zone_file);
  const updated=new Map(read(release+'zones.json').map(z=>[z.id,z]));
  assert.deepEqual(audit.zone_reviews.map(row=>row.zone_id).sort(),earlier.filter(z=>!z.selected_contractor).map(z=>z.id).sort());
  for(const z of earlier.filter(z=>z.selected_contractor))assert.deepEqual(updated.get(z.id),z);
  for(const row of audit.zone_reviews){
    const z=updated.get(row.zone_id);
    assert.equal(Boolean(z.selected_contractor),row.outcome==='verified');
    const evidence=z.field_evidence[z.selected_contractor?'selected_contractor':'contractor_review'];
    assert.equal(evidence.checked_on,audit.checked_on);
    assert.ok(evidence.note && evidence.source_title && /^https:\/\//.test(evidence.source_url),z.name);
  }
  const preferred=updated.get('mz-seoul-11410uq120ps202607270001');
  assert.equal(preferred.selected_contractor,null);
  assert.match(preferred.field_evidence.contractor_review.note,/우선협상/);
});

test('awards for towns without zone cards identify each contracting project separately',()=>{
  const release='snapshots/2026-11-26/contractors/';
  const audit=read(release+'review.json').contractor_audit;
  const hasZones=new Set(read(audit.baseline_zone_file).map(z=>z.town_id));
  const towns=read(release+'towns.json');
  const target=towns.filter(t=>!hasZones.has(t.id));
  assert.deepEqual(audit.town_reviews.map(row=>row.town_id).sort(),target.map(t=>t.id).sort());
  for(const town of target){
    assert.ok(!town.selected_contractor);
    const awards=town.contractor_projects??[];
    assert.equal(awards.length,audit.town_reviews.find(r=>r.town_id===town.id).confirmed_projects);
    if(!awards.length)assert.equal(town.field_evidence.contractor_review.checked_on,audit.checked_on);
    for(const project of awards){
      assert.ok(project.project_name && project.registered_address && project.selected_contractor);
      const e=project.field_evidence.selected_contractor;
      assert.ok(e.source_url.startsWith('https://') && e.supporting_sources.length && e.checked_on===audit.checked_on);
    }
  }
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

test('notice tables cover exactly the reviewed towns and owner records match the baseline cohort',()=>{
  const release='snapshots/2026-11-27/';
  const audit=read(release+'review.json').notice_zone_owner_audit;
  const before=read(audit.baseline_zones),after=new Map(read(release+'zones.json').map(z=>[z.id,z]));
  const linked=new Set(before.map(z=>z.town_id));
  const targets=read(audit.baseline_towns).filter(t=>!linked.has(t.id) && t.management_plan_notices?.length);
  assert.deepEqual(audit.towns.map(r=>r.town_id).sort(),targets.map(t=>t.id).sort());
  const ids=audit.towns.flatMap(t=>t.zones.map(r=>r.id));
  assert.equal(new Set(ids).size,59);
  for(const r of audit.towns)for(const row of r.zones){
    const z=after.get(row.id);
    assert.equal(z.town_id,r.town_id);
    assert.ok(z.registered_address && z.project_area_m2>0 && z.planned_units_total>0);
    assert.ok(z.field_evidence.plan.notice_number && z.field_evidence.registered_address.source_url);
    assert.equal(row.point,Boolean(z.representative_point));
    assert.equal(row.boundary,z.boundary_evidence?.source_feature_id??null);
  }
  const previous=before.filter(z=>z.stage==='조합설립인가' && z.metrics?.owner_count==null);
  assert.deepEqual(audit.owner_reviews.map(r=>r.id).sort(),previous.map(z=>z.id).sort());
  for(const r of [...audit.owner_reviews,...audit.additional_owner_reviews]){
    const z=after.get(r.id);
    assert.equal(z.metrics?.owner_count??null,r.owners);
    if(r.owners==null)continue;
    assert.equal(z.field_evidence['metrics.owner_count'].source_url,r.source_url);
    if(!r.same_plan_units || z.stage==='조합설립인가 취소')continue;
    const e=z.field_evidence.planned_units_per_owner;
    assert.equal(e.numerator_planned_units,r.same_plan_units);
    assert.equal(e.denominator_owner_count,r.owners);
    assert.equal(z.metrics.planned_units_per_owner,Math.round(100*r.same_plan_units/r.owners)/100);
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

test('November management drawings link six separate areas and retain the limits of association awards',()=>{
  const path='snapshots/2026-11-27/management-plans/';
  const release=read(path+'zones.json');
  const outlines=new Map(read(path+'boundaries.geojson').features.map(f=>[f.properties.entity_id,f]));
  const areas=id=>release.filter(z=>z.town_id==='mt-202603-resident-'+id);
  assert.deepEqual(areas('023').map(z=>[z.drawing_code,z.planned_units_total,z.housing_allocation.rental,z.max_floors_above_ground]),[
    ['A1',110,22,18],['A2',182,37,20],['A3',294,59,20]
  ]);
  for(const id of ['010','023','028','031']){
    for(const zone of areas(id)){
      const feature=outlines.get(zone.id);
      assert.ok(feature?.geometry && feature.properties.source_url && feature.properties.source_page);
      assert.equal(feature.properties.parent_town_id,zone.town_id);
      assert.ok(zone.representative_point && zone.field_evidence.plan.source_url);
      assert.equal(zone.contractor_projects.length,1);
      assert.ok(zone.contractor_projects[0].scope_note && !zone.selected_contractor);
    }
  }
  assert.equal(areas('010')[0].representative_point_evidence.address,'망우동 509-1');
  assert.equal(areas('031')[0].contractor_projects[0].owner_count,107);
  assert.equal(areas('028')[0].stage,null);
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
test('the citywide audit covers every previously unlinked town and GIS review row',()=>{
  const previous=read('snapshots/2026-11-27/november-review/towns.json');
  const previousReview=read('snapshots/2026-11-27/november-review/review.json');
  const current=read(files.review);
  const audit=current.citywide_link_audit;
  const byTown=new Map(towns.map(t=>[t.id,t]));
  const before=previous.filter(t=>!t.sub_areas?.length).map(t=>t.id).sort();
  assert.deepEqual(audit.town_reviews.map(r=>r.town_id).sort(),before);
  for(const entry of audit.town_reviews){
    const t=byTown.get(entry.town_id);
    assert.deepEqual(entry.linked_zone_ids,t.sub_areas);
    assert.ok(t.sub_area_review.note && t.sub_area_review.sources.some(s=>s.url?.startsWith('https://')));
  }
  const reviewed=new Map(audit.feature_reviews.map(r=>[r.feature_id,r]));
  assert.equal(reviewed.size,audit.feature_reviews.length);
  assert.deepEqual(audit.previously_unlinked_feature_ids,previousReview.unlinked_or_conflicting_features.map(r=>r.source_feature_id).sort());
  for(const id of audit.previously_unlinked_feature_ids)assert.ok(reviewed.get(id)?.outcome);
  const refs=[...towns,...zones].flatMap(r=>r.registered_project_references??[]);
  assert.equal(new Set(refs.map(r=>r.feature_id)).size,refs.length);
  for(const r of refs)assert.ok(r.register_row && r.parcel_pnu && r.geometry_source && r.source_url && reviewed.has(r.feature_id));
  const gaebong=byTown.get('mt-202603-resident-042');
  assert.ok(gaebong.sub_area_review.reported_count===3 && !gaebong.sub_areas.length);
  const ilwon=byTown.get('mt-2026-extra-012');
  assert.equal(ilwon.name,'일원동 720');
  assert.deepEqual(ilwon.rights_cutoff_history.map(x=>x.date),['2024-06-05','2025-07-25']);
  assert.equal(ilwon.rights_cutoff_date,null);
  assert.ok(ilwon.land_transaction_permit.roads_only);
  assert.ok(byTown.get('mt-202603-public-087').name.includes('619-641'));
  assert.ok(current.resolved_notice_rows.some(x=>x.matched_excluded_address?.includes('월계동 500')));
});
