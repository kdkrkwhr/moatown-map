import {dayNumber,projectEvents} from './detail-format.mjs?v=744430b0c9fe';

export const managementFilters=[
  ['selected','선정 대상지 전체'],['draft','관리계획 수립 중'],['approved','관리계획 승인'],
  ['unknown','관리계획 미확인'],['canceled','취소 이력']
];
export const progressFilters=[
  ['association','조합설립 진행 중','조합설립 중'],
  ['association-approved','조합설립인가','조합설립인가 완료'],
  ['architecture-review','건축심의','건축심의'],['integrated-review','통합심의 완료','통합심의'],
  ['approval-pending','사업시행계획인가 진행 중','사업인가 진행 중'],
  ['approved','사업시행계획인가','사업인가 완료'],
  ['construction','착공','착공'],['unknown','미확인','단계 미확인']
];
const compact=value=>String(value ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g,'');
const termsFor=value=>value.normalize('NFKC').trim().split(/\s+/).filter(Boolean).map(compact);
const matches=(terms,fields)=>terms.every(term=>fields.some(field=>compact(field).includes(term)));
function management(town){
  const stage=town.management_plan_stage;
  if(['관리계획 승인','관리계획 승인고시'].includes(stage) || town.management_plan_notices?.length)return 'approved';
  if(['관리계획 수립','관리계획 수립 중'].includes(stage))return 'draft';
  return stage?'':'unknown';
}
export function recentProjectDates(towns,groups,excluded,today){
  const end=dayNumber(today),dates=new Map();
  function include(id,date){
    const day=dayNumber(date);
    if(end===null || day===null || day>end || day<end-6)return;
    const iso=date.replaceAll('.','-');
    if(!dates.has(id) || iso>dates.get(id))dates.set(id,iso);
  }
  for(const town of towns){
    include(town.id,town.last_verified_at);
    for(const event of projectEvents(town))include(town.id,event.date);
    for(const notice of town.management_plan_notices??[])include(town.id,notice.notice_date);
    for(const zone of groups.get(town.id)??[]){
      include(zone.id,zone.last_verified_at);
      for(const event of projectEvents(town,zone))include(zone.id,event.date);
      if(dates.has(zone.id))include(town.id,dates.get(zone.id));
    }
  }
  for(const row of excluded){
    for(const date of [row.last_verified_at,row.cancellation_date])include(row.address_raw,date);
  }
  return dates;
}

export function searchProjects(towns,groups,excluded,{query='',district='',plan='',progress='',recentDates=null}={}){
  const terms=termsFor(query),rows=[];
  if(plan==='canceled' || (!plan && !progress && /취소|철회/.test(query))){
    for(const record of excluded){
      if(recentDates && !recentDates.has(record.address_raw))continue;
      if((!district || district===record.district) && matches(terms,[record.address_raw,record.name_raw,record.status_raw,'취소 이력'])){
        rows.push({excluded:record});
      }
    }
    return rows;
  }
  for(const town of towns){
    if(recentDates && !recentDates.has(town.id))continue;
    if(district && town.district!==district)continue;
    const status=management(town);
    if(plan && plan!=='selected' && plan!==status)continue;
    const fields=[town.name,town.address,town.district,'대상지 선정',town.management_plan_stage,
      managementFilters.find(([key])=>key===status)?.[1],...(town.alternate_locations ?? []).map(a=>a.address)];
    const townMatches=matches(terms,fields);
    if(!progress && townMatches)rows.push({town});
    if(!progress && !terms.length)continue;
    for(const zone of groups.get(town.id) ?? []){
      if(recentDates && !recentDates.has(zone.id))continue;
      const stage=zone.stage || '미확인';
      const def=progressFilters.find(([,label])=>label===stage);
      if(progress && progress!==def?.[0])continue;
      const code=zone.drawing_code?.replace(/^([A-Z])-?(?=\d)/,'$1');
      const zoneFields=[zone.name,zone.registered_address,zone.drawing_code,code,code?.replace(/^([A-Z])(?=\d)/,'$1-'),stage,def?.[2]];
      if(def && def[0]!=='unknown')zoneFields.push(stage+' 단계');
      if(stage==='사업시행계획인가')zoneFields.push('사업시행계획인가 완료','사업시행인가 완료');
      if(stage==='사업시행계획인가 진행 중')zoneFields.push('사업시행인가 진행 중');
      if(!matches(terms,[...fields,...zoneFields]))continue;
      if(progress || !townMatches || terms.some(term=>matches([term],zoneFields)))rows.push({town,zone});
    }
  }
  return rows;
}
