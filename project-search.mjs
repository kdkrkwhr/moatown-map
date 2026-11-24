export const managementFilters=[
  ['selected','선정 대상지 전체'],['draft','관리계획 수립 중'],['approved','관리계획 승인'],
  ['unknown','관리계획 미확인'],['canceled','취소 이력']
];
export const progressFilters=[
  ['association','조합설립 진행 중','조합설립 중'],
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
export function searchProjects(towns,groups,excluded,{query='',district='',plan='',progress=''}={}){
  const terms=termsFor(query),rows=[];
  if(plan==='canceled' || (!plan && !progress && /취소|철회/.test(query))){
    for(const record of excluded){
      if((!district || district===record.district) && matches(terms,[record.address_raw,record.name_raw,record.status_raw,'취소 이력'])){
        rows.push({excluded:record});
      }
    }
    return rows;
  }
  for(const town of towns){
    if(district && town.district!==district)continue;
    const status=management(town);
    if(plan && plan!=='selected' && plan!==status)continue;
    const fields=[town.name,town.address,town.district,'대상지 선정',town.management_plan_stage,
      managementFilters.find(([key])=>key===status)?.[1],...(town.alternate_locations ?? []).map(a=>a.address)];
    const townMatches=matches(terms,fields);
    if(!progress && townMatches)rows.push({town});
    if(!progress && !terms.length)continue;
    for(const zone of groups.get(town.id) ?? []){
      const stage=zone.stage || '미확인';
      const def=progressFilters.find(([,label])=>label===stage);
      if(progress && progress!==def?.[0])continue;
      const zoneFields=[zone.name,stage,def?.[2]];
      if(def && def[0]!=='unknown')zoneFields.push(stage+' 단계');
      if(stage==='사업시행계획인가')zoneFields.push('사업시행계획인가 완료','사업시행인가 완료');
      if(stage==='사업시행계획인가 진행 중')zoneFields.push('사업시행인가 진행 중');
      if(!matches(terms,[...fields,...zoneFields]))continue;
      if(progress || !townMatches || terms.some(term=>matches([term],zoneFields)))rows.push({town,zone});
    }
  }
  return rows;
}
