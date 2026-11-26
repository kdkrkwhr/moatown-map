import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,readdirSync,unlinkSync,writeFileSync} from 'node:fs';
import {buildExpandedLayouts,validateAssociationLayouts} from './expanded-layouts.mjs';
import {generateSimulation} from '../pilot-simulation.mjs';

const root=new URL('../moatown-data/',import.meta.url), output=new URL('plans/scenes/',root);
const check=process.argv.includes('--check');
const read=path=>JSON.parse(readFileSync(new URL(path,root),'utf8'));
const m=read('latest.json'),towns=read(m.files.towns),zones=read(m.files.zones);
const shapes=new Map(read(m.files.boundaries).features.filter(f=>['Polygon','MultiPolygon'].includes(f.geometry?.type)).map(f=>[f.properties.entity_id,f]));
const pilot=read(m.files.pilot_plans).towns;
const originalInputs=new Map();
for(const [key,path] of Object.entries(m.files)){
  const match=key.match(/_(layout|design|public_space)$/);
  if(!match)continue;
  const input=read(path),id=input.town_id??input.metadata?.town_id;
  if(!pilot[id])continue;
  if(!originalInputs.has(id))originalInputs.set(id,{});
  originalInputs.get(id)[match[1]==='public_space'?'publicSpace':match[1]]=input;
}
const city=read('plans/citywide-town-programs.json'),supplement=read('plans/supplemental-town-programs.json'),local=read('plans/citywide-zone-programs.json');
const facilityDir=new URL('plans/public-spaces/',root);
const facilities=new Map(readdirSync(facilityDir).filter(f=>f.endsWith('.geojson')).map(file=>{
  const input=read('plans/public-spaces/'+file);
  if(file!==input.town_id+'.geojson'||!input.features.length)throw Error('시설 파일 불일치 '+file);
  return [input.town_id,input];
}));
const layoutDir=new URL('plans/association-layouts/',root);
const associations=new Map();
for(const file of existsSync(layoutDir)?readdirSync(layoutDir).filter(f=>f.endsWith('.json')).sort():[]){
  const input=read('plans/association-layouts/'+file);
  if(file!==input.town_id+'.json'||!shapes.has(input.town_id))throw Error('공개 배치도 대상지 불일치 '+file);
  associations.set(input.town_id,validateAssociationLayouts(input,zones));
}
const checkedOn=[city.checked_on,supplement.checked_on,local.checked_on,...Array.from(facilities.values(),f=>f.checked_on),
  ...[...associations.values()].flatMap(layouts=>layouts.map(l=>l.checked_on))].filter(Boolean).sort().at(-1);
const index={checked_on:checkedOn,towns:{}},rows=[];
const saved=new Set();
const heldPrograms={};
function emit(url,content){
  if(check){
    if(readFileSync(url,'utf8').replaceAll('\r\n','\n')!==content)throw Error('3D 자료 재생성 필요 '+url.pathname);
  }else writeFileSync(url,content);
}
function sourced(townId){
  const first=city.towns[townId],second=supplement.towns[townId];
  if(!first)return second??null;
  if(!second)return first;
  // A later article update can still describe a plan superseded by an approval.
  const selected=second.supersedes_profile || second.source_as_of>=first.source_as_of?second:first;
  const other=selected===first?second:first;
  if(selected.source_url===other.source_url)return selected;
  return {...selected,related_record:{scope:other.scope,kind:other.kind,source_url:other.source_url,source_as_of:other.source_as_of}};
}
if(!check)mkdirSync(output,{recursive:true});
const ids=new Set(towns.map(t=>t.id)),zids=new Set(zones.map(z=>z.id));
for(const id of [...Object.keys(city.towns),...Object.keys(supplement.towns)])if(!ids.has(id))throw Error('대상지 불일치 '+id);
for(const id of Object.keys(local.zones))if(!zids.has(id))throw Error('세부구역 불일치 '+id);
for(const town of towns){
  const children=zones.filter(z=>z.town_id===town.id),pinned=children.filter(z=>shapes.has(z.id));
  const plan=sourced(town.id);
  const previous=plan?.scope_geometry_mismatch && (plan.previous_geometry_profile?city.towns[town.id]:plan.previous_geometry_program);
  const displayPlan=previous?{...previous,previous_geometry:true}:plan;
  const layouts=associations.get(town.id)??[],associationIds=layouts.map(layout=>layout.zone_id);
  const scene=pilot[town.id]?null:buildExpandedLayouts(town,children,shapes,displayPlan,local.zones,local.previous_geometry_programs,facilities.get(town.id),layouts);
  const state={id:town.id,district:town.district,name:town.name};
  if(pilot[town.id]){
    state.status='도면·계획 기반 구역별 배치';
    const result=generateSimulation(pinned.map(z=>shapes.get(z.id)),new Map(children.map(z=>[z.id,z])),pilot[town.id],originalInputs.get(town.id));
    const placed=Object.values(result.summaries).filter(s=>s.blocks>0);
    state.pilotDrawing=placed.some(s=>s.sourceLayout);
    state.zones=placed.length;state.zoneBlocks=result.features.length;state.assumptions=placed.some(s=>s.capSource==='default');
    if(layouts.length){
      const path='plans/association-layouts/'+town.id+'.json';
      const content=readFileSync(new URL(path,root),'utf8').replaceAll('\r\n','\n');
      (index.pilot_associations??={})[town.id]={association_path:path,association_sha256:createHash('sha256').update(content).digest('hex'),association_zone_ids:associationIds};
    }
  }
  else if(scene){
    if(previous)scene.updated_town=plan;
    const path='plans/scenes/'+town.id+'.json',content=JSON.stringify(scene)+'\n';
    emit(new URL(path,root),content);saved.add(town.id+'.json');
    const modes=Object.keys(scene.modes),zoneIds=Object.keys(scene.modes.zones?.summaries??{}).filter(id=>scene.modes.zones.summaries[id].blocks);
    index.towns[town.id]={path,sha256:createHash('sha256').update(content).digest('hex'),modes:layouts.length?['association',...modes]:modes,zone_ids:zoneIds,
      ...(layouts.length?{association_zone_ids:associationIds}:{})};
    state.status=modes.length===2?'구역별 / 대상지 전체':modes[0]==='town'?'대상지 전체':'구역별';
    state.zones=zoneIds.length;state.zoneBlocks=scene.modes.zones?.features.length;state.townBlocks=scene.modes.town?.features.length;
    state.assumptions=Object.values(scene.modes).some(mode=>Object.values(mode.summaries).some(s=>s.blocks && s.capSource==='default'));
  }else state.status=!shapes.has(town.id)?'참고 외곽 미수록':
    !pinned.length && children.length?'세부구역 경계 및 대상지 전체 계획 수치 추가 대조':'배치에 쓸 공개 계획 수치·적용 범위 추가 대조';
  if(plan && !pilot[town.id] && (!scene?.modes.town||previous)){
    heldPrograms[town.id]={...plan,reason:!shapes.has(town.id)?'대상지 참고 외곽 미수록':'사업 범위와 참고 외곽 추가 대조'};
  }
  if(layouts.length){
    const traced=layouts.reduce((n,l)=>n+l.buildings.length,0);
    const scopes=layouts.map(l=>l.zone_id===town.id?'대상지 통합':l.zone_name);
    state.status=['공개 배치도 ('+scopes.join(' · ')+', '+traced+'동)',...((scene&&!Object.keys(scene.modes).length)?[]:[state.status])].join(' / ');
  }
  rows.push(state);
}
for(const file of readdirSync(output)){
  if(!/^mt-\d+-(public|resident)-\d+\.json$/.test(file)||saved.has(file))continue;
  if(check)throw Error('현재 배포 대상에서 빠진 장면 파일 '+file);
  const path=new URL(file,output);
  if(JSON.parse(readFileSync(path,'utf8')).town_id+'.json'!==file)throw Error('장면 파일 ID 불일치 '+file);
  unlinkSync(path);
}
emit(new URL('plans/expanded-index.json',root),JSON.stringify(index,null,2)+'\n');
const linked=rows.filter(r=>index.towns[r.id]),published=linked.length+Object.keys(pilot).length;
const heldZones=zones.filter(z=>!pilot[z.town_id]&&(!index.towns[z.town_id]?.zone_ids.includes(z.id)||local.zones[z.id]?.scope_geometry_mismatch)).filter(z=>{
  const p=local.zones[z.id],e=z.field_evidence?.plan??z.field_evidence?.planned_units_total;
  const r=p??(z.planned_units_total>0 && e?.source_url?{...e,scope:z.name,units:z.planned_units_total}:null);
  if(!r)return false;
  heldPrograms[z.id]={...r,reason:z.stage==='사업시행계획 폐지'?'사업시행계획 폐지 고시':r.scope_geometry_mismatch?'공개 계획과 수록 도형의 사업 범위가 다름':
    !shapes.has(z.id)?'세부구역 참고 경계 미수록':'배치 범위 추가 대조'};
  return true;
});
emit(new URL('plans/unplaced-programs.json',root),JSON.stringify(heldPrograms)+'\n');
const number=n=>n==null?'—':String(n);
const drawingRows=[...associations.values()].flat();
const pilotDrawingTowns=rows.filter(r=>r.pilotDrawing).map(r=>r.id);
const drawingTownCount=new Set([...pilotDrawingTowns,...associations.keys()]).size;
const drawingSpaces=drawingRows.reduce((n,l)=>n+(l.spaces?.length??0),0);
const mappedSpaces=drawingRows.reduce((n,l)=>n+(l.spaces?.filter(s=>s.geographic_ring).length??0),0);
const report=[
  '# 건축 후 3D 수록 현황','',
  '계획 자료 대조일 '+checkedOn+'. '+towns.length+'개 대상지 중 '+published+'곳에서 건축 후 3D를 제공한다. 시범 대상지 '+Object.keys(pilot).length+'곳과 확장 대상지 '+linked.length+'곳을 포함한다.','',
  '구역별 계획 모형은 '+rows.filter(r=>r.zones>0).length+'개 대상지의 '+rows.reduce((n,r)=>n+(r.zones??0),0)+'개 세부구역에 있다. 대상지 전체 예시를 제공하는 곳은 '+rows.filter(r=>r.townBlocks>0).length+'곳이다. 한 가지 이상의 보기에서 층수 기본 가정을 사용하는 대상지는 '+rows.filter(r=>r.assumptions).length+'곳이다.','',
  '건축 후 3D를 보류한 '+(rows.length-published)+'곳 중 '+rows.filter(r=>!shapes.has(r.id)).length+'곳은 참고 외곽을 기다리고 있다. 나머지는 공개 규모나 그 수치에 맞는 사업 범위의 확인이 필요하다.','',
  '공개 배치도에 근거한 주거동을 볼 수 있는 대상지는 총 '+drawingTownCount+'곳이다. 기존 시범 도면 '+pilotDrawingTowns.length+'곳에 이번에 '+(drawingTownCount-pilotDrawingTowns.length)+'곳을 추가했다. 건축 후 3D를 제공하는 나머지 '+(published-drawingTownCount)+'곳에는 가상 배치만 수록했다.','',
  ...(drawingRows.length?['이번에 수록한 대상지 통합 도면과 개별 구역 도면 '+drawingRows.length+'개 범위에서 주거동 '+drawingRows.reduce((n,l)=>n+l.buildings.length,0)+'동의 윤곽을 옮겼다. '+
    (drawingSpaces?'도면에 표시된 공원·시설 등 '+drawingSpaces+'개 공간을 도면 좌표로 옮겼으며, 이 중 '+mappedSpaces+'개는 지도 좌표로도 볼 수 있다. ':'')+
    '도면 좌표 보기는 원본 픽셀을 사용하며, 지도 좌표가 확인된 동은 지리 공간에서도 볼 수 있다. 3D 화면에서 도면의 출처·범위·높이 환산 기준을 확인할 수 있다.','']:[]),
  '대상지 전체 예시는 전체 외곽과 그 대상지에 발표된 규모를 사용한다. 구역별 예시는 세부구역의 경계와 그곳의 사업 수치를 사용한다. 같은 대상지의 두 보기는 대안이므로 모형 수를 합산하지 않는다.','',
  '가상 배치는 공개 동 수를 목표로 한다. 그 밖에는 계획 세대수와 층당 4세대를 사용하고, 층수만 확인한 곳은 참고 경계에 들어가는 예시 동을 표시한다. 공개 층수 또는 확인된 대상지 상한이 없으면 예시 상한을 20층으로 명시한다. 기본 동은 42×14m, 경계 여백 10m, 동간 거리 35m다. 이 조건으로 계획 규모를 담기 어려우면 32×16m 또는 24×12m(경계 5m·동간 10m), 80세대 이하 소규모 필지에는 16×9m(경계 3m·동간 10m) 예시를 적용할 수 있다. 구역별로 실제 적용한 간격을 표시한다. 가상 배치의 동 위치·입면·높이는 추정이다.','',
  '| 자치구 · 대상지 | 제공 범위 또는 보류 이유 | 모델링 세부구역 | 구역별 모형 | 전체 예시 모형 | 층수 기본 가정 포함 |',
  '| --- | --- | ---: | ---: | ---: | --- |',
  ...rows.map(r=>'| '+(r.zones!=null||pilot[r.id]?'['+r.district+' '+r.name+'](https://moatownmap.com/?town='+r.id+'&view=3d&mode=after)':r.district+' '+r.name)+' | '+r.status+' | '+number(r.zones)+' | '+number(r.zoneBlocks)+' | '+number(r.townBlocks)+' | '+(r.zones==null?'—':r.assumptions?'예':'아니오')+' |'),
  '', '## 대상지 전체 3D 배치를 보류한 공개 계획','',
  '| 대상지 | 자료 적용 범위 | 공개 세대수 | 공개 최고 층수 | 보류 사유 | 원문 |','| --- | --- | ---: | ---: | --- | --- |',
  ...towns.filter(t=>heldPrograms[t.id]).map(t=>{
    const r=heldPrograms[t.id];
    return '| '+t.district+' '+t.name+' | '+r.scope+' | '+number(r.units)+' | '+number(r.floors)+' | '+r.reason+' | [출처]('+r.source_url+') |';
  }),
  '', '## 세부구역 3D 배치를 보류한 공개 계획','',
  '아래 '+heldZones.length+'곳의 수치와 원문은 지도 상세 화면의 사업성·규제 탭에서 열 수 있다.','',
  '| 대상지 | 세부구역 | 공개 세대수 | 공개 최고 층수 | 보류 사유 | 원문 |','| --- | --- | ---: | ---: | --- | --- |',
  ...heldZones.map(z=>{
    const r=heldPrograms[z.id];
    const town=towns.find(t=>t.id===z.town_id);
    return '| '+town.district+' '+town.name+' | '+z.name+' | '+number(r.units)+' | '+number(r.floors)+' | '+r.reason+' | [출처]('+r.source_url+') |';
  }),
  '', '각 장면에는 수치의 출처·범위·자료 기준일을 기록했다. [대상지별 파일 색인](../moatown-data/plans/expanded-index.json) · [기존 시범 3곳의 산출 근거](3d-pilot-results.md)',''];
emit(new URL('../docs/3d-plan-coverage.md',root),report.join('\n'));
console.log(JSON.stringify({total:rows.length,published,added:linked.length,withheld:rows.length-published}));
