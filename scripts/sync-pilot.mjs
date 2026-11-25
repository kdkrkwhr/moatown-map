import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';

// Pin all inputs of a scene together when publishing a new data release.
const root=new URL('../moatown-data/',import.meta.url),latest=new URL('latest.json',root);
const manifest=JSON.parse(readFileSync(latest,'utf8'));
const read=key=>readFileSync(new URL(manifest.files[key],root),'utf8').replaceAll('\r\n','\n');
const keys=['towns','zones','boundaries','buildings','pilot_plans'];
const buildings=JSON.parse(read('buildings')).towns,plans=JSON.parse(read('pilot_plans')).towns;
const town_ids=Object.keys(buildings).sort();
if(!town_ids.length || town_ids.join()!==Object.keys(plans).sort().join())throw Error('계획과 건물 자료의 시범 대상지가 다릅니다.');
const hashes=Object.fromEntries(keys.map(key=>[key,createHash('sha256').update(read(key)).digest('hex')]));
const config={town_ids,hashes};
if(process.argv.includes('--check')){
  if(JSON.stringify(config)!==JSON.stringify(manifest.pilot_3d))throw Error('3D 입력 버전 갱신 필요 (node scripts/sync-pilot.mjs)');
}else{
  manifest.pilot_3d=config;
  writeFileSync(latest,JSON.stringify(manifest,null,2)+'\n');
}
