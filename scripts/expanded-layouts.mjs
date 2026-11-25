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

export function buildExpandedLayouts(town,children,shapes,whole,zoneSources,previousPrograms={}){
  if(!shapes.has(town.id))return null;
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
    const result=generateSimulation(areas,map,{plan,zones},{schematic:true});
    if(!result.features.length)return;
    for(const f of result.features)f.geometry.coordinates[0]=f.geometry.coordinates[0].map(xy=>xy.map(n=>Number(n.toFixed(7))));
    modes[key]=result;
  }
  if(plan&&!plan.scope_geometry_mismatch)addMode('town',[{...town,planned_units_total:plan.units}],[shapes.get(town.id)]);
  const modeled=children.filter(z=>shapes.has(z.id)&&zones[z.id]&&!zones[z.id].scope_geometry_mismatch);
  addMode('zones',modeled,modeled.map(z=>shapes.get(z.id)));
  return Object.keys(modes).length?{town_id:town.id,plan,zones,modes,
    ...(Object.keys(updatedZones).length?{updated_zones:updatedZones}:{})}:null;
}
