import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';

// Pin all inputs of a scene together when publishing a new data release.
const root=new URL('../moatown-data/',import.meta.url),latest=new URL('latest.json',root);
const manifest=JSON.parse(readFileSync(latest,'utf8'));
const read=key=>readFileSync(new URL(manifest.files[key],root),'utf8').replaceAll('\r\n','\n');
const buildings=JSON.parse(read('buildings')).towns,plans=JSON.parse(read('pilot_plans')).towns;
const town_ids=Object.keys(buildings).sort();
const boundaryIds=JSON.parse(read('boundaries')).features.filter(f=>f.properties.entity_type==='town').map(f=>f.properties.entity_id).sort();
const plan_town_ids=Object.keys(plans).sort();
if(!town_ids.length || boundaryIds.join()!==town_ids.join() || !plan_town_ids.every(id=>town_ids.includes(id)))
  throw Error('대상지 참고 경계, 건물, 계획의 범위를 확인하세요.');
const savedFiles=JSON.stringify(manifest.files);
for(const key of Object.keys(manifest.files))if(key.startsWith('building_town_'))delete manifest.files[key];
function townFiles(suffix){
  const result={};
  for(const key of Object.keys(manifest.files).filter(key=>key.endsWith(suffix))){
    const id=JSON.parse(read(key)).town_id;
    if(!town_ids.includes(id) || result[id])throw Error(key+' 대상지 ID를 확인하세요.');
    result[id]=key;
  }
  return result;
}
const visuals=townFiles('_visuals'),current_details=townFiles('_current_details'),current_heights=townFiles('_height_evidence');
for(const id of town_ids){
  for(const [group,folder] of [[current_details,'details'],[current_heights,'heights']]){
    if(group[id])continue;
    const key='building_town_'+folder+'_'+id;
    manifest.files[key]='buildings/'+folder+'/'+id+'.json';
    if(JSON.parse(read(key)).town_id!==id)throw Error(key+' 건물 자료 대상지 ID 불일치');
    group[id]=key;
  }
}
const keys=['towns','zones','boundaries','buildings','pilot_plans','building_height_review','sinwol_public_space','sinwol_design','sinwol_layout',
  ...Object.values(visuals),...Object.values(current_details),...Object.values(current_heights)];
if(manifest.files.current_site_sources)keys.push('current_site_sources');
const hashes=Object.fromEntries(keys.map(key=>[key,createHash('sha256').update(read(key)).digest('hex')]));
const height_review_town_ids=[...new Set(Object.values(JSON.parse(read('building_height_review')).records).flatMap(r=>r.town_ids))].sort();
const config={town_ids,plan_town_ids,hashes,visuals,simulation_town_ids:['mt-202603-public-067'],current_details,current_heights,height_review_town_ids};
if(process.argv.includes('--check')){
  if(JSON.stringify(config)!==JSON.stringify(manifest.pilot_3d)||JSON.stringify(manifest.files)!==savedFiles)throw Error('3D 입력 버전 갱신 필요 (node scripts/sync-pilot.mjs)');
}else{
  manifest.pilot_3d=config;
  writeFileSync(latest,JSON.stringify(manifest,null,2)+'\n');
}
