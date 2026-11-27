import {dayNumber,projectEvents,contractorProcedure} from './detail-format.mjs?v=9cd048534ed6';

export const managementFilters=[
  ['selected','선정 대상지 전체'],['draft','관리계획 수립 중'],['approved','관리계획 승인'],
  ['unknown','관리계획 미확인'],['canceled','취소 이력']
];
export const progressFilters=[
  ['resident-resurvey','주민 찬반 재조사','주민 찬반 재조사'],
  ['consent-planned','동의서 징구 예정','동의서 징구 예정'],
  ['founding-meeting','조합창립총회 완료','창립총회 완료'],
  ['association-change-approved','조합설립변경인가','조합 변경인가'],
  ['project-type-review','사업유형 검토 중','방식 검토 중'],
  ['before-consent','조합설립 동의서 검인 전','동의서 검인 전'],
  ['resident-consent','주민동의 확보 중','주민동의 확보'],
  ['association-inspection','조합설립인가 전 주민공람','조합인가 전 공람'],
  ['association-change','조합설립 변경 추진 중','조합 변경 추진'],
  ['review-requested','통합심의 신청','통합심의 신청'],
  ['consent','동의서 징구','동의서 징구'],['association-returned','조합설립인가 반려','조합인가 반려'],
  ['implementer','사업시행자 지정','시행자 지정'],
  ['association','조합설립 진행 중','조합설립 중'],
  ['association-approved','조합설립인가','조합설립인가 완료'],
  ['association-revoked','조합설립인가 취소','조합인가 취소'],['demolition-reported','철거신고','철거신고'],
  ['architecture-review','건축심의','건축심의'],['integrated-review','통합심의 완료','통합심의'],
  ['approval-pending','사업시행계획인가 진행 중','사업인가 진행 중'],
  ['approved','사업시행계획인가','사업인가 완료'],
  ['construction','착공','착공'],['revoked','사업시행계획 폐지','시행계획 폐지'],['unknown','미확인','단계 미확인']
];
const compact=value=>String(value ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g,'');
const termsFor=value=>value.normalize('NFKC').trim().split(/\s+/).filter(Boolean).map(compact);
const matches=(terms,fields)=>terms.every(term=>fields.some(field=>compact(field).includes(term)));
const companyAliases=new Map([
  ['디엘건설','DL건설'],['한화','한화 건설부문'],['에스케이에코플랜트','SK에코플랜트'],
  ['에이치제이중공업','HJ중공업'],['에이치에스화성','HS화성'],['비에스한양','BS한양']
]);
export function contractorName(value){
  const name=String(value??'').normalize('NFKC').replace(/주식회사|\(주\)/g,'').trim();
  return companyAliases.get(name)??name;
}
function contractorTerms(value){
  const name=contractorName(value);
  if(!name)return [];
  return [name,value,'시공사 선정',...[...companyAliases].filter(([,key])=>key===name).map(([alias])=>alias)];
}
export const associationReviewKey=(owner,project)=>owner.id+'/'+project.project_name;
function management(town){
  const stage=town.management_plan_stage;
  if(['관리계획 승인','관리계획 승인고시'].includes(stage) || town.management_plan_notices?.length)return 'approved';
  if(['관리계획 수립','관리계획 수립 중','관리계획 통합심의 통과','관리계획 수립안 주민공람','관리계획 수립안 주민 재공람','관리계획 수립안 주민 재공람 종료'].includes(stage))return 'draft';
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
  function includeAssociations(owner){
    for(const project of owner.contractor_projects??[]){
      const key=associationReviewKey(owner,project);
      include(key,project.field_evidence?.selected_contractor?.checked_on);
      if(dates.has(key))include(owner.id,dates.get(key));
    }
  }
  for(const town of towns){
    include(town.id,town.last_verified_at);
    for(const event of projectEvents(town))include(town.id,event.date);
    for(const notice of town.management_plan_notices??[])include(town.id,notice.notice_date);
    includeAssociations(town);
    for(const zone of groups.get(town.id)??[]){
      includeAssociations(zone);
      include(zone.id,zone.last_verified_at);
      include(zone.id,contractorProcedure(zone)?.checked_on);
      for(const event of projectEvents(town,zone))include(zone.id,event.date);
      if(dates.has(zone.id))include(town.id,dates.get(zone.id));
    }
  }
  for(const row of excluded){
    for(const date of [row.last_verified_at,row.cancellation_date])include(row.address_raw,date);
  }
  return dates;
}

export function searchProjects(towns,groups,excluded,{query='',district='',plan='',progress='',contractor='',recentDates=null}={}){
  const terms=termsFor(query),rows=[];
  const company=contractorName(contractor);
  const eligible=value=>!company || (Boolean(contractorName(value)) && (company==='all' || compact(contractorName(value))===compact(company)));
  function addAssociations(town,zone,fields){
    const owner=zone??town;
    for(const association of owner.contractor_projects??[]){
      if(!association.selected_contractor || !eligible(association.selected_contractor))continue;
      if(recentDates && !recentDates.has(associationReviewKey(owner,association)))continue;
      const name=association.project_name;
      const local=[name,name.replace(/(\d)의(?=\d)/g,'$1-'),association.registered_address,...contractorTerms(association.selected_contractor)];
      if(matches(terms,[...fields,...local]))rows.push(zone?{town,zone,association}:{town,association});
    }
  }
  if(plan==='canceled' || (!plan && !progress && /취소|철회/.test(query) && !/조합/.test(query))){
    if(company)return rows;
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
    if(plan==='selected' && town.candidate_status && !town.selected_date)continue;
    if(plan && plan!=='selected' && plan!==status)continue;
    const fields=[town.name,town.address,town.district,town.candidate_status??'대상지 선정',town.management_plan_stage,
      managementFilters.find(([key])=>key===status)?.[1],...(town.alternate_locations ?? []).map(a=>a.address)];
    const townMatches=matches(terms,fields);
    if(!contractor && !progress && townMatches)rows.push({town});
    if(!contractor && !progress && !terms.length)continue;
    if(!progress && (contractor || !townMatches))addAssociations(town,null,fields);
    for(const zone of groups.get(town.id) ?? []){
      const procedure=contractorProcedure(zone);
      if(recentDates && !recentDates.has(zone.id))continue;
      const stage=zone.stage || '미확인';
      const def=progressFilters.find(([,label])=>label===stage);
      if(progress && progress!==def?.[0])continue;
      const code=zone.drawing_code?.replace(/^([A-Z])-?(?=\d)/,'$1');
      const zoneFields=[zone.name,zone.project_name,zone.registered_address,zone.drawing_code,code,code?.replace(/^([A-Z])(?=\d)/,'$1-'),stage,zone.field_evidence?.stage?.source_label,zone.field_evidence?.stage_review?.context_label,def?.[2],...contractorTerms(zone.selected_contractor)];
      if(procedure && (!contractor || contractor==='pending')){
        zoneFields.push(procedure.stage,...procedure.participants.flatMap(p=>[p.role,...p.names]));
      }
      if(def && def[0]!=='unknown')zoneFields.push(stage+' 단계');
      if(stage==='사업시행계획인가')zoneFields.push('사업시행계획인가 완료','사업시행인가 완료');
      if(stage==='사업시행계획인가 진행 중')zoneFields.push('사업시행인가 진행 중');
      const combined=[...fields,...zoneFields],zoneMatches=matches(terms,combined);
      if(contractor!=='pending' && (contractor || !zoneMatches))addAssociations(town,zone,combined);
      if(contractor==='pending'?!procedure:!eligible(zone.selected_contractor))continue;
      if(!zoneMatches)continue;
      if(contractor || progress || !townMatches || terms.some(term=>matches([term],zoneFields)))rows.push({town,zone});
    }
  }
  return rows;
}
