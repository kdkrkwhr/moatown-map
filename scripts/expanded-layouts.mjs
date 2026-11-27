import {generateSimulation} from '../pilot-simulation.mjs';

function usable(record){
  return record?.source_url?.startsWith('https://') && [record.units,record.floors,record.building_count].some(v=>Number.isInteger(v)&&v>0);
}

function zoneProgram(zone,published){
  if(usable(published))return published;
  const evidence=zone.field_evidence?.plan??zone.field_evidence?.planned_units_total;
  if(!Number.isInteger(zone.planned_units_total)||zone.planned_units_total<=0||!evidence?.source_url)return null;
  return {units:zone.planned_units_total,floors:null,scope:zone.name,kind:'공개 구역 계획',evidence:evidence.kind??evidence.state??'published_zone_plan',
    source_url:evidence.source_url,source_as_of:evidence.source_as_of??null,checked_on:evidence.checked_on??null};
}

export function validateAssociationLayouts(input,children){
  const zones=new Set(children.filter(z=>z.town_id===input.town_id && z.stage!=='사업시행계획 폐지').map(z=>z.id));
  zones.add(input.town_id);
  const seen=new Set();
  const date=s=>typeof s==='string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
  function validRing(ring,within){
    if(!Array.isArray(ring)||ring.length<4||!ring.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&within(...p)))return false;
    if(ring[0][0]!==ring.at(-1)[0]||ring[0][1]!==ring.at(-1)[1])return false;
    return Math.abs(ring.slice(1).reduce((sum,[x,y],i)=>sum+ring[i][0]*y-ring[i][1]*x,0))>0;
  }
  if(!Array.isArray(input.layouts)||!input.layouts.length)throw Error('빈 공개 배치도 '+input.town_id);
  for(const layout of input.layouts){
    if(!zones.has(layout.zone_id)||seen.has(layout.zone_id)||!layout.zone_name||
      ![layout.source_url,layout.image_url].every(url=>typeof url==='string'&&url.startsWith('https://'))||
      !/^[a-f0-9]{64}$/.test(layout.source_sha256)||!date(layout.checked_on)||(layout.source_as_of!==null&&!date(layout.source_as_of))||
      !Array.isArray(layout.image_size)||layout.image_size.length!==2||!layout.image_size.every(n=>Number.isInteger(n)&&n>0)||
      !Array.isArray(layout.buildings)||!layout.buildings.length)throw Error('공개 배치도 원문·범위 확인 필요 '+layout.zone_id);
    seen.add(layout.zone_id);
    const [w,h]=layout.image_size,ids=new Set();
    const inImage=(x,y)=>x>=0&&y>=0&&x<=w&&y<=h;
    const onMap=(x,y)=>x>=-180&&x<=180&&y>=-90&&y<=90;
    for(const b of layout.buildings){
      if(!b.id||ids.has(b.id)||!validRing(b.ring,inImage)||
        (b.geographic_ring!=null&&!validRing(b.geographic_ring,onMap))||
        (b.floors!==null&&!(Number.isInteger(b.floors)&&b.floors>0)))throw Error('공개 배치도 주거동 확인 필요 '+layout.zone_id+' '+b.id);
      ids.add(b.id);
    }
    if(layout.spaces!==undefined&&!Array.isArray(layout.spaces))throw Error('공개 배치도 시설 목록 확인 필요 '+layout.zone_id);
    for(const s of layout.spaces??[]){
      if(!s.id||ids.has(s.id)||typeof s.label!=='string'||!s.label.trim()||
        !['park','playground','community','pedestrian','road'].includes(s.kind)||!validRing(s.ring,inImage)||
        (s.geographic_ring!=null&&!validRing(s.geographic_ring,onMap)))
        throw Error('공개 배치도 시설 확인 필요 '+layout.zone_id+' '+s.id);
      ids.add(s.id);
    }
  }
  return input.layouts;
}

export function buildExpandedLayouts(town,children,shapes,whole,zoneSources,previousPrograms={},publicSpace=null,associationLayouts=[]){
  if(!shapes.has(town.id))return null;
  if(publicSpace && publicSpace.town_id!==town.id)throw Error('시설 도형 대상지 불일치 '+town.id);
  const plan=usable(whole)?whole:null;
  const zones={},modes={},updatedZones={};
  for(const z of children){
    if(z.stage==='사업시행계획 폐지')continue;
    const record=zoneProgram(z,zoneSources[z.id]);
    if(!record)continue;
    if(record.scope_geometry_mismatch && usable(previousPrograms[z.id])){
      zones[z.id]=previousPrograms[z.id];
      updatedZones[z.id]=record;
    }else zones[z.id]=record;
  }
  function addMode(key,rows,areas){
    if(!areas.length)return;
    const map=new Map(rows.map(r=>[r.id,r]));
    const result=generateSimulation(areas,map,{plan,zones},{schematic:true,publicSpace});
    if(!result.features.length)return;
    for(const f of result.features)f.geometry.coordinates[0]=f.geometry.coordinates[0].map(xy=>xy.map(n=>Number(n.toFixed(7))));
    modes[key]=result;
  }
  const siteShape=z=>{
    const boundary=shapes.get(z.id),site=zones[z.id]?.residential_site;
    return site?{...boundary,geometry:site.geometry}:boundary;
  };
  if(plan&&!plan.scope_geometry_mismatch){
    const boundary=shapes.get(town.id);
    const sites=children.map(z=>zones[z.id]?.residential_site);
    const allSites=sites.length && sites.every(site=>site?.geometry);
    const parts=allSites?sites.flatMap(({geometry})=>geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates):[];
    const area=parts.length?{...boundary,geometry:{type:'MultiPolygon',coordinates:parts}}:boundary;
    addMode('town',[{...town,planned_units_total:plan.units}],[area]);
  }
  const modeled=children.filter(z=>shapes.has(z.id)&&zones[z.id]&&!zones[z.id].scope_geometry_mismatch);
  addMode('zones',modeled,modeled.map(siteShape));
  return Object.keys(modes).length||associationLayouts.length?{town_id:town.id,plan,zones,modes,
    ...(associationLayouts.length?{association_layouts:associationLayouts}:{}),
    ...(publicSpace?{public_space:publicSpace}:{}),
    ...(Object.keys(updatedZones).length?{updated_zones:updatedZones}:{})}:null;
}
