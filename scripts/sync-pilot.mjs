import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';

// Pin all inputs of a scene together when publishing a new data release.
const root=new URL('../moatown-data/',import.meta.url),latest=new URL('latest.json',root);
const manifest=JSON.parse(readFileSync(latest,'utf8'));
const read=key=>readFileSync(new URL(manifest.files[key],root),'utf8').replaceAll('\r\n','\n');
const buildings=JSON.parse(read('buildings')).towns,plans=JSON.parse(read('pilot_plans')).towns;
const town_ids=Object.keys(buildings).sort();
const boundaries=JSON.parse(read('boundaries')).features;
const boundaryIds=boundaries.filter(f=>f.properties.entity_type==='town').map(f=>f.properties.entity_id).sort();
const {towns:expanded,pilot_associations={}}=JSON.parse(readFileSync(new URL('plans/expanded-index.json',root),'utf8'));
const plan_town_ids=[...Object.keys(plans),...Object.keys(expanded)].sort();
if(!town_ids.length || boundaryIds.join()!==town_ids.join() || !plan_town_ids.every(id=>town_ids.includes(id)))
  throw Error('대상지 참고 경계, 건물, 계획의 범위를 확인하세요.');
const savedFiles=JSON.stringify(manifest.files);
manifest.files.registry_heights='buildings/registry-heights.json';
manifest.files.unplaced_programs='plans/unplaced-programs.json';
for(const key of Object.keys(manifest.files))if(key.startsWith('building_town_'))delete manifest.files[key];
function townFiles(suffix){
  const result={};
  for(const key of Object.keys(manifest.files).filter(key=>key.endsWith(suffix))){
    const file=JSON.parse(read(key)),id=file.town_id??file.metadata?.town_id;
    if(!town_ids.includes(id) || result[id])throw Error(key+' 대상지 ID를 확인하세요.');
    result[id]=key;
  }
  return result;
}
const visuals=townFiles('_visuals'),current_details=townFiles('_current_details'),current_heights=townFiles('_height_evidence');
const designs=townFiles('_design'),layouts=townFiles('_layout'),publicSpaces=townFiles('_public_space');
const zoneShapes=new Set(boundaries.filter(f=>f.properties.entity_type==='zone'&&['Polygon','MultiPolygon'].includes(f.geometry?.type)).map(f=>f.properties.entity_id));
const zoneTown=new Map(JSON.parse(read('zones')).map(z=>[z.id,z.town_id]));
const simulation_inputs={};
for(const id of Object.keys(plans).sort()){
  const town=plans[id];
  const zone_ids=Object.entries(town.zones??{}).filter(([zone,record])=>
    zoneTown.get(zone)===id && zoneShapes.has(zone) && [record?.floors,town.plan?.floors].some(n=>Number.isInteger(n)&&n>0)).map(([zone])=>zone);
  if(zone_ids.length)simulation_inputs[id]={zone_ids,design:designs[id]??null,layout:layouts[id]??null,public_space:publicSpaces[id]??null};
  if(pilot_associations[id]){
    const association=pilot_associations[id];
    const content=readFileSync(new URL(association.association_path,root),'utf8').replaceAll('\r\n','\n');
    if(createHash('sha256').update(content).digest('hex')!==association.association_sha256 ||
      association.association_zone_ids.some(zone=>zone!==id&&zoneTown.get(zone)!==id))throw Error('공개 배치도 파일 불일치 '+id);
    Object.assign(simulation_inputs[id],association,{modes:['association','design','spaced']});
  }
}
for(const [id,entry] of Object.entries(expanded)){
  if(simulation_inputs[id]||!entry.modes?.length||entry.zone_ids.some(zone=>zoneTown.get(zone)!==id || !zoneShapes.has(zone))||
    entry.association_zone_ids?.some(zone=>zone!==id&&zoneTown.get(zone)!==id))
    throw Error('추가 3D 장면 범위 불일치 '+id);
  const scene=readFileSync(new URL(entry.path,root),'utf8').replaceAll('\r\n','\n');
  if(JSON.parse(scene).town_id!==id||createHash('sha256').update(scene).digest('hex')!==entry.sha256)throw Error('예상 배치 파일 검증 실패 '+id);
  simulation_inputs[id]=entry;
}
for(const id of town_ids){
  for(const [group,folder] of [[current_details,'details'],[current_heights,'heights']]){
    if(group[id])continue;
    const key='building_town_'+folder+'_'+id;
    manifest.files[key]='buildings/'+folder+'/'+id+'.json';
    if(JSON.parse(read(key)).town_id!==id)throw Error(key+' 건물 자료 대상지 ID 불일치');
    group[id]=key;
  }
}
const keys=['towns','zones','boundaries','buildings','pilot_plans','building_height_review','registry_heights','unplaced_programs',
  ...Object.values(designs),...Object.values(layouts),...Object.values(publicSpaces),
  ...Object.values(visuals),...Object.values(current_details),...Object.values(current_heights)];
if(manifest.files.current_site_sources)keys.push('current_site_sources');
const hashes=Object.fromEntries(keys.map(key=>[key,createHash('sha256').update(read(key)).digest('hex')]));
const height_review_town_ids=[...new Set(Object.values(JSON.parse(read('building_height_review')).records).flatMap(r=>r.town_ids))].sort();
const registry_height_town_ids=[...new Set(Object.values(JSON.parse(read('registry_heights')).records).flatMap(r=>r.town_ids))].sort();
if(registry_height_town_ids.some(id=>!town_ids.includes(id)))throw Error('표제부 높이 자료의 대상지 ID 불일치');
const config={town_ids,plan_town_ids,hashes,visuals,simulation_town_ids:Object.keys(simulation_inputs).sort(),simulation_inputs,current_details,current_heights,height_review_town_ids,registry_height_town_ids};
if(process.argv.includes('--check')){
  if(JSON.stringify(config)!==JSON.stringify(manifest.pilot_3d)||JSON.stringify(manifest.files)!==savedFiles)throw Error('3D 입력 버전 갱신 필요 (node scripts/sync-pilot.mjs)');
}else{
  manifest.pilot_3d=config;
  writeFileSync(latest,JSON.stringify(manifest,null,2)+'\n');
}
