import {formatValue,unitsChange,projectIntervals,compareInterval,projectStage} from './detail-format.mjs?v=9dd69d08e58e';
import {projectUrl} from './project-url.mjs?v=9dd69d08e58e';
export {projectUrl};

const pending='미고시';
const date=v=>formatValue(v,'date');
function el(tag,text,cls){
  const node=document.createElement(tag);
  if(text!=null)node.textContent=text;
  if(cls)node.className=cls;
  return node;
}
function link(url,title){
  try{if(new URL(url).protocol!=='https:')return null;}catch{return null;}
  const a=el('a',title,'source-link');a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a;
}
function field(list,label,value){
  const row=el('div'),v=value==null || value===''?pending:value;
  row.append(el('dt',label),el('dd',v,v===pending?'unverified':''));
  row.dataset.known=String(v!==pending);
  const firstMissing=list.querySelector('[data-known="false"]');
  list.insertBefore(row,v!==pending?firstMissing:null);
  return row;
}
function section(container,id,title){
  const card=el('section',null,'detail-section');card.id='detail-'+id;
  const heading=el('h3',title);heading.id=card.id+'-heading';card.setAttribute('aria-labelledby',heading.id);
  card.append(heading);container.append(card);return card;
}
const notice=(text)=>el('p',text,'notice');
export function showUnplacedProgram(pane,record){
  const card=section(pane,'unplaced-plan','건축 계획 원문');
  const stats=el('dl',null,'facts');
  field(stats,'계획 범위',record.scope);
  field(stats,'계획 세대수',formatValue(record.units,'세대'));
  field(stats,'계획 최고 층수',record.floors?record.floors+'층':null);
  if(record.building_count)field(stats,'계획 동 수',record.building_count+'동');
  if(record.height_m)field(stats,'계획 최고 높이',record.height_m+'m');
  card.append(stats,notice('이 계획의 3D 배치 보류 · '+record.reason));
  if(record.note)card.append(el('p',record.note));
  const proof=link(record.source_url,'계획 원문'+(record.source_as_of?' · '+date(record.source_as_of):''));
  if(proof)card.append(proof);
  for(const other of record.separate_scopes??[]){
    const facts=[other.units&&formatValue(other.units,'세대'),other.floors&&other.floors+'층'].filter(Boolean);
    const row=el('p',other.scope+' · '+facts.join(' · ')+' ');
    const ref=link(other.source_url,'구역 원문 · '+date(other.source_as_of));
    if(ref)row.append(ref);
    card.append(row);
  }
  const seen=new Set([record.source_url]);
  for(const [field,e] of Object.entries(record.field_evidence??{})){
    if(!e?.source_url || seen.has(e.source_url))continue;
    seen.add(e.source_url);
    const label={boundary_revision:'범위 변경 고시',review:'사업 추진 현황',site_area_m2:'면적 근거',floors:'층수 근거'}[field]??'관련 근거';
    const extra=link(e.source_url,label+(e.source_as_of?' · '+date(e.source_as_of):''));
    if(extra)card.append(el('br'),extra);
  }
  pane.prepend(card);
}
const listOf=v=>Array.isArray(v)?v:[];
function plannedZoningLabel(areas){
  const rows=listOf(areas).filter(a=>Number(a?.planned_sqm)>0).sort((a,b)=>b.planned_sqm-a.planned_sqm);
  if(!rows.length)return null;
  const top=rows[0];
  return top.label+' '+formatValue(top.planned_sqm,'㎡').split(' (')[0]+(rows.length>1?' 외 '+(rows.length-1)+'개 용도':'')+' (고시 계획안)';
}
export function boundaryLabel(boundary){
  if(!boundary)return null;
  if(boundary.reference_label)return boundary.reference_label;
  if(boundary.scope==='association_project_area')return '인가 고시도 참고 경계';
  if(boundary.scope==='management_plan_project_area')return '관리계획도 참고 경계';
  return boundary.boundary_status==='legal'?'법정 경계':'참고 경계';
}
const values=r=>({
  area:r.metrics?.area_sqm??r.area_sqm??r.project_area_m2??r.area_m2,
  planned:r.metrics?.planned_units??r.planned_units??r.planned_units_total,
  existing:r.metrics?.existing_units??r.existing_units,
  owners:r.metrics?.owner_count??r.owner_count
});

function citedField(grid,label,value,evidence){
  const row=field(grid,label,value);
  if(!evidence?.source_url || value===pending || value==null)return row;
  const page=evidence.source_page??evidence.pdf_page;
  const caption=[evidence.source_as_of && date(evidence.source_as_of),page && page+'쪽','근거'].filter(Boolean).join(' · ');
  const source=link(evidence.source_url,caption);
  if(source){
    source.title=[evidence.scope,evidence.note].filter(Boolean).join(' · ');
    row.append(source);
  }
  return row;
}

function comparablePlan(r,otherKey){
  const e=r.field_evidence??{},other=e['metrics.'+otherKey],plan=e['metrics.planned_units']??e.plan;
  if(!other && !e['metrics.planned_units'])return otherKey==='existing_units' || Boolean(e.metrics?.source_url && e.metrics.source_url===plan?.source_url);
  return Boolean(other?.source_url && other.source_url===plan?.source_url && other.source_as_of===plan?.source_as_of &&
    (!other.planned_units_in_source || other.planned_units_in_source===values(r).planned) && other.scope===plan.scope);
}

function cutoffLabel(r){
  if(r.rights_base_date??r.rights_cutoff_date)return date(r.rights_base_date??r.rights_cutoff_date);
  return r.rights_cutoff_history?.length?'범위별 기준 확인':pending;
}

function planLabel(e){
  if(!e?.kind)return null;
  if(/historical|이전|종전/.test(e.kind))return '이전 공개안';
  if(/draft|public_inspection|공람/.test(e.kind))return '주민공람안';
  if(e.kind==='management_plan_notice' || e.kind.includes('승인고시'))return '관리계획 고시';
  if(e.kind==='municipal_town_plan_profile')return '서울시 대상지 소개';
  if(e.kind==='integrated_review')return '통합심의안';
  return null;
}

function permitLabel(p){
  if(typeof p?.designated!=='boolean')return pending;
  if(!p.designated)return '미지정';
  if(p.designation_level==='legal_dong' && p.roads_only)return '법정동 내 도로 한정';
  return p.roads_only?'지정 · 도로 한정':'지정';
}

function regulationLabels(r,town){
  const child=r!==town;
  return {
    cutoff:cutoffLabel(r)===pending && child && cutoffLabel(town)!==pending?'상위 대상지 고시 있음':cutoffLabel(r),
    permit:permitLabel(r.land_transaction_permit)===pending && child && permitLabel(town.land_transaction_permit)!==pending?'상위 대상지 공고 있음':permitLabel(r.land_transaction_permit)
  };
}

function regulations(card,r,town,zone,boundary,cityRule,openTownRules){
  const facts=el('dl',null,'facts'),p=r.land_transaction_permit;
  const labels=regulationLabels(r,town);
  field(facts,'권리산정기준일',labels.cutoff);
  const evidence=r.field_evidence?.rights_cutoff_date;
  const proof=link(evidence?.source_url,evidence?.notice_number??'근거 고시 원문');
  const cutoff=field(facts,'권리산정 근거 고시',proof?.textContent??evidence?.notice_number);
  if(proof)cutoff.lastChild.replaceChildren(proof);
  field(facts,'토지거래허가구역',labels.permit);
  field(facts,'지정 기간',p?.start_date || p?.end_date?[p.start_date,p.end_date].map(date).join(' ~ '):null);
  field(facts,'지정 범위',p?.scope??(p?.roads_only?'지목이 도로인 토지':null));
  const permitProof=r.field_evidence?.land_transaction_permit;
  const url=link(permitProof?.source_document??permitProof?.source_url,p?.notice_number??permitProof?.notice_number??'지정 공고 원문');
  const permitRow=field(facts,'허가구역 근거 공고',url?.textContent??p?.notice_number);
  if(url)permitRow.lastChild.replaceChildren(url);
  const boundaryRow=field(facts,'구역 경계',boundaryLabel(boundary));
  if(boundary?.entity_type==='town'){
    const source=link(boundary.source_url,'서울시 경계 원자료');
    if(source)boundaryRow.lastChild.append(el('br'),source);
  }
  field(facts,'대표 위치',r.representative_point?(r.representative_point_evidence?.address??r.registered_address??town.address):null);
  card.append(facts);
  if(zone && openTownRules && (labels.cutoff!==cutoffLabel(r) || labels.permit!==permitLabel(p))){
    const box=notice('세부구역의 필지별 적용 범위는 상위 대상지 고시의 도면과 조서에서 확인할 수 있습니다.');
    const button=el('button',town.name+' 규제 근거 보기','source-link');
    button.type='button';button.addEventListener('click',openTownRules);
    box.append(el('br'),button);card.append(box);
  }
  if(boundary?.kind==='official_notice_drawing'){
    const box=notice('점선은 고시 도면의 구역선을 지도에 옮긴 것입니다. 개별 필지의 포함 여부는 원문에서 확인하세요.');
    const source=link(boundary.source_url,boundary.notice_number+' · 도면 '+boundary.pdf_page+'쪽');
    if(source)box.append(document.createElement('br'),source);
    card.append(box);
  }
  for(const h of listOf(r.rights_cutoff_history)){
    const box=notice([h.scope,date(h.date),h.status,h.condition].filter(Boolean).join(' · '));
    const source=link(h.evidence?.source_url,h.evidence?.notice_number??'근거 고시 원문');
    if(source)box.append(document.createElement('br'),source);
    card.append(box);
  }
  if(!zone && cityRule){
    const more=el('details',null,'city-road-rule');
    more.append(el('summary','서울 전역 도로 지정 공고'),notice(cityRule.scope+' · '+date(cityRule.start_date)+' ~ '+date(cityRule.end_date)));
    const a=link(cityRule.evidence?.source_url,cityRule.evidence?.notice_number);if(a)more.append(a);card.append(more);
  }
  if(r.field_evidence?.registered_address?.note)card.append(notice(r.field_evidence.registered_address.note));
  if(r.risk_info?.notes)card.append(notice(r.risk_info.notes));
}

function contractorField(grid,r,children){
  const confirmed=children.filter(child=>child.selected_contractor);
  if(!r.selected_contractor && confirmed.length){
    const names=[...new Set(confirmed.map(child=>child.selected_contractor.replace(/주식회사|㈜|\(주\)/g,'').trim()))];
    const row=field(grid,'세부 구역 시공사',names.join(' · '));
    row.append(el('small',children.length+'개 구역 중 '+confirmed.length+'곳 확인'));
    return;
  }
  const row=field(grid,children.length?'세부 구역 시공사':'시공사',r.selected_contractor);
  if(!r.selected_contractor){row.lastChild.classList.add('unverified');return;}
  const e=r.field_evidence?.selected_contractor;
  if(!e)return;
  const source=link(e.source_url,e.source_title??'시공사 확인 자료');
  if(e.selection_date)row.append(el('small','선정일 '+date(e.selection_date)));
  if(source)row.append(source);
}

function metrics(panel,r,children){
  const {area,existing,planned,owners}=values(r),m=r.metrics??{},e=r.field_evidence??{};
  const scale=section(panel,'scale','규모·세대'),grid=el('dl',null,'metrics');
  scale.append(grid);
  citedField(grid,'구역 면적',formatValue(area,'㎡'),e['metrics.area_sqm']??e.area_m2??e.project_area_m2);
  field(grid,'필지 수',formatValue(m.parcel_count??r.parcel_count,'필지'));
  citedField(grid,'기존 세대수',formatValue(existing,'세대'),e['metrics.existing_units']);
  const plan=citedField(grid,'계획 세대수',formatValue(planned,'세대'),e['metrics.planned_units']??e.plan);
  const kind=planLabel(e['metrics.planned_units']??e.plan);
  if(kind && !r.plan_scenario)plan.append(el('small',kind));
  if(r.plan_scenario)plan.append(el('small',r.plan_scenario));
  if(r.stage==='사업시행계획 폐지')plan.append(el('small','폐지 전 공표 수치'));
  if(comparablePlan(r,'existing_units') && Number.isFinite(existing)&&Number.isFinite(planned))plan.append(el('small',unitsChange(existing,planned)));
  citedField(grid,'토지등소유자 수',formatValue(owners,'명'),e['metrics.owner_count']);
  const ratio=m.planned_units_per_owner??(owners>0 && Number.isFinite(planned) && comparablePlan(r,'owner_count')?Number((planned/owners).toFixed(2)):null);
  field(grid,'소유자 1명당 계획 세대수',formatValue(ratio,'세대'));
  const allocation=r.housing_allocation??{},approved=r.approved_allocation??{},c=r.contract_scope??{};
  for(const [label,value] of [['조합원 분양',approved.member??allocation.members],['일반 분양',approved.general??allocation.general],['계획 임대',allocation.rental],['분양 합계',allocation.sale_total],['보류지',approved.reserve??allocation.reserve],['계약 당시 공사 규모',c.units]]){
    const key={'계획 임대':'rental','분양 합계':'sale_total'}[label];
    citedField(grid,label,formatValue(value,'세대'),e['housing_allocation.'+key]??e.housing_allocation);
  }
  contractorField(grid,r,children);
  const contract=e.selected_contractor??{};
  field(grid,contract.contract_date?'시공사 계약일':contract.source_as_of?'시공사 자료 기준일':'시공사 자료 확인일',date(contract.contract_date??contract.source_as_of??contract.checked_on));
  field(grid,'계획 자료 기준일',date(e.plan?.source_as_of));
  if(r.previous_plan)citedField(grid,'이전 계획',formatValue(r.previous_plan.planned_units_total,'세대'),r.previous_plan.evidence);
  const types=[...listOf(r.unit_types),...listOf(r.published_private_area_bands)];
  for(const a of types){
    if(!a || typeof a!=='object')continue;
    const surface=a.private_area_m2!=null?formatValue(Number(a.private_area_m2),'㎡'):a.privateAreaBandM2?a.privateAreaBandM2+'㎡':pending;
    field(grid,[a.type,surface].filter(Boolean).join(' · '),formatValue(a.units,'세대'));
  }
  if(!types.length)field(grid,'세부 주택형',typeof r.unit_types==='string'?r.unit_types:null);
  if(e.plan?.state?.includes('not_latest'))scale.append(notice('공개 당시의 계획값입니다. 최신 인가·분양계획과 차이가 있을 수 있습니다.'));
  if(e.plan?.scope)scale.append(notice([e.plan.scope,e.plan.note].filter(Boolean).join(' · ')));
  if(r.plan_review_note){
    const warning=notice(r.plan_review_note.note),ref=link(r.plan_review_note.source_url,'변경고시 확인');
    if(ref)warning.append(el('br'),ref);
    scale.append(warning);
  }
  for(const [key,record] of Object.entries(r.documented_allocation??{})){
    const label=key==='rental'?'임대':'분양';
    citedField(grid,'다른 공표안의 '+label,formatValue(record.value,'세대')+' (전체 '+formatValue(record.planned_units,'세대')+')',record.evidence);
  }
  if(r.published_program){
    const p=r.published_program;
    const description=[p.scope,formatValue(p.units,'세대'),p.floors && p.floors+'층',p.height_m && p.height_m+'m',p.building_count && p.building_count+'개 동'].filter(Boolean);
    citedField(grid,'별도 공표 계획',description.join(' · '),p);
  }

  const building=section(panel,'building','건축·용도'),facts=el('dl',null,'facts');
  building.append(facts);
  const aging=m.aging_ratio??r.aging_ratio,age=citedField(facts,'고시 당시 노후도',formatValue(aging,'%'),e['metrics.aging_ratio']);
  if(Number.isFinite(aging)&&aging>=0&&aging<=100){
    const meter=el('div',null,'aging-meter'),bar=el('progress');bar.max=100;bar.value=aging;bar.setAttribute('aria-label','노후도');
    meter.append(bar);age.querySelector('dd').append(meter,el('small','비교선 50.0%'));
  }
  field(facts,'국공유지 비율',formatValue(m.public_land_ratio??r.public_land_ratio,'%'));
  const zoning=r.zoning??{};
  field(facts,'현재 용도지역',zoning.before??zoning.observed?.names?.join(' · '));
  citedField(facts,zoning.plan_as_of?'고시 당시 계획 용도지역':'계획 용도지역',zoning.after??plannedZoningLabel(zoning.areas),e['zoning.areas']);
  field(facts,'종상향 계획',typeof zoning.upgrade_planned==='boolean'?(zoning.upgrade_planned?'있음':'없음'):null);
  for(const a of listOf(zoning.areas))field(facts,a.label,formatValue(a.before_sqm,'㎡')+' → '+formatValue(a.planned_sqm,'㎡'));
  field(facts,'용도지역 관찰 범위',zoning.observed?.names?.length?(zoning.observed.scope==='representative_point'?'대표 위치':'참고 외곽 내부'):null);
  field(facts,'계획 조건',zoning.condition??r.plan_scenario);
  for(const [label,value,unit,key] of [['최고 지상 층수',r.max_floors_above_ground??c.floors_above_ground,'층','max_floors_above_ground'],['지하 층수',r.floors_below_ground??c.floors_below_ground,'층','floors_below_ground'],['최고 높이',r.height_m,'m','height_m'],['건폐율',r.building_coverage_pct,'%','building_coverage_pct'],['용적률',r.floor_area_ratio_pct,'%','floor_area_ratio_pct'],['계획 동 수',r.building_count,'동','building_count']]){
    citedField(facts,label,(e[key]?.qualifier?e[key].qualifier+' ':'')+formatValue(value,unit),e[key]);
  }
}

function comparison(difference,count,unit){
  const label=difference===0?'같음':formatValue(Math.abs(difference),unit)+(difference<0?' 빠름':' 느림');
  return el('span','서울 수록 '+count+'곳 평균 대비 '+label,'benchmark '+(difference<0?'faster':difference>0?'slower':''));
}

function timeline(card,town,zone,snapshot,stats,intervals){
  const items=el('ol',null,'milestone-list');
  for(const step of intervals){
    const {event,label}=step,item=el('li'),head=el('div',null,'milestone-head');
    head.append(el('strong',event.stage),el('time',date(event.date)));
    item.append(head,el('span',label,'duration '+(label.includes('진행 중')?'in-progress':label===pending?'unverified':'')));
    if(event.scope)item.append(el('small',event.scope));
    const match=compareInterval(step,town,zone,stats.samples);
    if(match)item.append(comparison(match.difference,match.count,'일'));
    else if(!zone && event.stage==='대상지 선정' && step.next?.stage==='관리계획 승인고시' && stats.months.has(town.id) && stats.months.size>1){
      const months=stats.months.get(town.id),count=stats.months.size-1;
      const peerMean=(stats.mean*stats.months.size-months)/count;
      item.append(comparison(Math.round((months-peerMean)*10)/10,count,'개월'));
    }
    items.append(item);
  }
  card.append(items,el('small','경과일 기준 '+date(snapshot),'detail-caption'));
  if(!items.querySelector('.benchmark')){
    const hint=el('small','동일 구간 평균 비교 · '+pending,'detail-caption');
    hint.title='두 단계의 날짜와 비교할 다른 사업장의 소요 기간이 확인되면 표시합니다.';card.append(hint);
  }
  for(const n of zone?[]:listOf(town.management_plan_notices)){
    const count=Number.isInteger(n.zone_count)?' · 서울시 수록 '+formatValue(n.zone_count,'곳'):'';
    card.append(notice(n.site+' · '+date(n.notice_date)+' 관리계획 고시'+count));
  }
  if(!zone && town.selection_track)card.append(el('small','선정 방식 · '+town.selection_track,'detail-caption'));
  const e=zone?zone.field_evidence?.stage:town.field_evidence?.management_plan_stage;
  if(e?.source_as_of)card.append(el('small','추진 단계 자료 기준 '+date(e.source_as_of),'detail-caption'));
  if(e?.note){
    const item=notice(e.note),ref=link(e.source_url,e.notice_number??'단계 확인 원문');
    if(ref)item.append(el('br'),ref);
    card.append(item);
  }
  if(e?.association_site)card.append(el('small','인가 고시 지번 · '+e.association_site,'detail-caption'));
}

export function comparePlans(children){
  const known=children.filter(child=>{
    const n=values(child).planned;
    return Number.isSafeInteger(n) && n>=0;
  });
  const first=known[0],plan=first?.field_evidence?.plan;
  const samePlan=known.length===children.length && plan?.kind==='management_plan_notice' && !plan.state?.includes('not_latest') &&
    plan.source_url && plan.source_as_of && plan.notice_number && known.every(child=>{
      const evidence=child.field_evidence?.plan;
      return evidence?.kind===plan.kind && evidence.source_url===plan.source_url &&
        evidence.source_as_of===plan.source_as_of && evidence.notice_number===plan.notice_number &&
        evidence.table===plan.table && evidence.state===plan.state && child.plan_scenario===first.plan_scenario;
    });
  return {known:known.length,total:samePlan?known.reduce((sum,child)=>sum+values(child).planned,0):null};
}

function comparisonTable(town,children,zone,select,badge){
  const table=el('table',null,'zone-comparison');
  table.append(el('caption','세부구역 비교'));
  const headers=table.createTHead().insertRow();
  for(const title of ['구역','추진 단계','시공사','계획 세대수·기준일']){
    const th=el('th',title);th.scope='col';headers.append(th);
  }
  const body=table.createTBody();
  for(const child of children){
    const row=body.insertRow(),button=el('button',child.drawing_code??child.name);
    button.type='button';button.setAttribute('aria-label',child.name+' 지도에서 보기');
    if(child.id===zone?.id){
      row.className='is-current';button.setAttribute('aria-label',child.name+' 선택됨 · 지도에서 보기');
    }
    row.insertCell().append(button);
    const selectChild=()=>select(town.id,child.id,true);
    button.addEventListener('click',selectChild);
    row.addEventListener('click',event=>{if(!event.target.closest('button'))selectChild();});
    row.insertCell().append(child.stage?badge(child.stage,true):el('span',pending,'unverified'));
    row.insertCell().append(el('span',child.selected_contractor??pending,child.selected_contractor?'':'unverified'));
    const n=values(child).planned,asOf=child.field_evidence?.plan?.source_as_of;
    const origin=child.stage==='사업시행계획 폐지'?'폐지 전 계획':planLabel(child.field_evidence?.plan);
    row.insertCell().append(el('strong',formatValue(n,'세대')),el('small',[origin,asOf?date(asOf):'기준일 미고시'].filter(Boolean).join(' · ')));
  }
  return table;
}

function subAreas(panel,town,zone,children,boundaries,select,badge){
  if(!children.length){panel.append(notice(town.risk_info?.is_canceled?'세부 구역 미고시 · 대상지 선정 취소':'대상지 단위 추진 중 (세부 구역 미고시)'));return;}
  const ordered=[...children].sort((a,b)=>(a.drawing_code??a.name).localeCompare(b.drawing_code??b.name,'ko',{numeric:true}));
  panel.append(comparisonTable(town,ordered,zone,select,badge));
  const list=el('ul',null,'sub-area-cards');list.setAttribute('aria-label',town.name+' 세부 사업구역');
  for(const child of ordered){
    const item=el('li'),button=el('button'),head=el('span',null,'sub-card-head');
    button.type='button';button.dataset.zone=child.id;button.setAttribute('aria-label',child.name+' 상세 보기');
    if(zone?.id===child.id)button.setAttribute('aria-current','true');
    head.append(el('strong',child.name),child.stage?badge(child.stage,true):el('span',pending,'status-tag unverified'));
    if(child.drawing_code && !child.name.includes(child.drawing_code))head.firstChild.prepend(child.drawing_code+' · ');
    button.append(head);
    const sizes=values(child);
    const entries=[['대표 지번',child.registered_address],['계획',formatValue(sizes.planned,'세대')],['면적',formatValue(sizes.area,'㎡')],['시공사',child.selected_contractor],['지도 위치',boundaryLabel(boundaries.get(child.id))??(child.representative_point?'대표 지번 핀':null)]];
    for(const [label,value] of entries.sort((a,b)=>Number(!a[1]||a[1]===pending)-Number(!b[1]||b[1]===pending))){
      const line=el('span',null,'sub-card-field');line.append(el('span',label),el('span',value||pending,!value||value===pending?'unverified':null));button.append(line);
    }
    button.addEventListener('click',()=>select(town.id,child.id));item.append(button);list.append(item);
  }
  panel.append(list);
}

function publisher(url){
  const h=new URL(url).hostname;
  if(h==='cleanup.seoul.go.kr')return '정비사업 정보몽땅';
  if(h.endsWith('eum.go.kr'))return '토지이음 고시정보';
  if(h==='event.seoul.go.kr')return '서울시보';
  if(h==='data.seoul.go.kr')return '서울 열린데이터광장';
  if(h==='land.seoul.go.kr')return '서울 부동산정보광장';
  if(h.endsWith('seoul.go.kr'))return '서울특별시';
  if(h.endsWith('ycc.go.kr'))return '양천구의회';
  if(h.endsWith('data.go.kr'))return '공공데이터포털';
  return h;
}
export function reportIssueUrl(town,zone){
  const record=zone??town;
  const map=projectUrl(town,zone);
  const issue=new URL('https://github.com/kdkrkwhr/moatown-map/issues/new');
  const name=record.name.startsWith(town.district+' ')?record.name:town.district+' '+record.name;
  issue.searchParams.set('title','[정보 제보] '+name);
  const context=['대상지명: '+town.name,'자치구: '+town.district];
  if(town.id || town.matched_baseline_id)context.push('대상지 ID: '+(town.id??town.matched_baseline_id));
  else context.push('취소 이력 식별 주소: '+town.address_raw);
  if(zone)context.push('세부 구역명: '+zone.name,'세부 구역 ID: '+zone.id);
  context.push('지도: '+map.href,'','제보 내용 (오류 또는 현장 소식):','','근거 자료 또는 확인일:');
  issue.searchParams.set('body',context.join('\n'));
  return issue.href;
}

function sources(card,r,snapshot,boundary,events,registryUrl,reportUrl){
  const footer=el('footer',null,'detail-sources');
  const facts=el('dl',null,'facts'),docs=new Map(),refs=new Map();
  function add(url,title,asOf,collection=refs){
    if(!link(url,'원문'))return;
    if(!collection.has(url))collection.set(url,{name:title||publisher(url),asOf});
  }
  if(boundary?.kind==='official_notice_drawing')add(boundary.source_url,boundary.notice_number+' · 경계 도면 '+boundary.pdf_page+'쪽',boundary.source_as_of,docs);
  for(const item of listOf(r.official_links))add(item?.url,item?.title,item?.date,docs);
  for(const n of listOf(r.management_plan_notices)){
    add(n.notice_url??n.archive_url??n.source_url,n.notice_number??n.site+' 관리계획 자료',n.notice_date,docs);
    if(n.archive_url)add(n.archive_url,n.site+' 관리계획 자료',n.notice_date);
  }
  for(const [key,e] of Object.entries(r.field_evidence??{})){
    if(!e?.source_url)continue;
    const labels={plan:'사업 계획',stage:'추진 단계',metrics:'사업 규모',registered_address:'대표 지번',selected_contractor:'시공사',zoning:'용도지역',observed_zoning:'용도지역도'};
    add(e.source_url,e.source_title??e.notice_number??labels[key],e.source_as_of);
    if(key==='selected_contractor')for(const item of listOf(e.supporting_sources))add(item.url,item.title,null);
    if(e.notice_number)add(e.source_url,e.notice_number,e.source_as_of,docs);
  }
  for(const e of [r.representative_point_evidence,boundary,r.previous_plan?.evidence,...listOf(r.rights_cutoff_history).map(h=>h.evidence)])add(e?.source_url,e?.notice_number,e?.source_as_of);
  for(const e of events)add(e.source_url,e.stage+' 이력',null);
  for(const url of Object.values(r.sources??{}))add(url,null,r.source_as_of);
  const all=[...new Set([...docs.keys(),...refs.keys()])];
  field(facts,'자료 기준일',date(snapshot));
  field(facts,'원자료 기준일',date(r.source_as_of));
  field(facts,'데이터 출처',[...new Set(all.map(publisher))].join(' · ')||null);
  field(facts,'최종 확인일',date(r.last_verified_at??r.field_evidence?.identity?.checked_on??r.representative_point_evidence?.checked_on));
  footer.append(facts,el('h4','고시·공고 원문 링크'));
  function links(container,entries){
    for(const [url,v] of entries)container.append(link(url,v.name+(v.asOf?' · '+date(v.asOf):'')));
  }
  const box=el('div',null,'official-docs');links(box,docs);
  if(!docs.size)box.append(el('span',pending,'unverified'));
  footer.append(box);
  const projectUrl=r.sources?.projectOverview??r.sources?.project_overview;
  const registry=link(projectUrl, '정비사업 정보몽땅 · 사업개요')??link(registryUrl,'정비사업 정보몽땅 · 사업장 검색');
  if(registry)footer.append(registry);
  const more=el('details',null,'provenance');more.append(el('summary','항목별 근거 자료'));
  const other=el('div',null,'official-docs');links(other,refs);
  if(!refs.size)other.append(el('span',pending,'unverified'));more.append(other);footer.append(more);
  const report=link(reportUrl,'정보 수정 제보');report.classList.add('report-link');
  footer.append(report);card.append(footer);
}

function summary(town,zone,intervals,badge,copyLink,comparison){
  const r=zone??town,header=el('header',null,'project-summary');
  const identity=el('div',null,'summary-identity'),place=el('div'),title=el('h2',r.name);
  title.tabIndex=-1;
  place.append(el('span',zone?[town.district,town.name].join(' · '):town.district,'detail-district'),title);
  const copy=el('button',null,'copy-link');copy.type='button';copy.title='링크 복사';copy.setAttribute('aria-label',copy.title);
  copy.addEventListener('click',copyLink);
  identity.append(place,copy);header.append(identity);
  const stage=projectStage(town,zone);
  const badges=el('div',null,'summary-badges');
  const stageNode=stage?badge(stage):el('span','추진 단계 '+pending,'status-tag unverified');
  badges.append(stageNode);
  const rules=regulationLabels(r,town);
  const permit=el('span',null,'regulation-chip'+(rules.permit===pending?' unverified':''));
  permit.append('토지거래허가구역 ',el('b',rules.permit));badges.append(permit);
  header.append(badges);
  const stats=r.aging_reference,metricCards=el('div',null,'decision-metrics');
  const ageTip='수록된 건축물 연식 데이터 기반 참고 수치이며, 법적 노후·불량건축물 비율은 고시문을 확인하세요.';
  const rightsTip='이 날짜 이후 신축된 건축물은 분양권(입주권) 대신 현금청산 대상이 될 수 있습니다. 필지별 적용 범위와 예외는 해당 고시에서 확인하세요.';
  const ages=stats?stats.year+'년 기준 · 내부 '+countBuildings(stats.total)+' 중 사용승인 후 30년 이상으로 확인된 건물 '+countBuildings(stats.over_30)+'. 20년 이상 '+formatValue(stats.rate_20,'%')+' · 연식 미상 '+countBuildings(stats.unknown):'참고 경계와 건물 연식을 대조할 자료가 필요합니다.';
  function countBuildings(n){return formatValue(n,'동');}
  for(const [label,value,tip,note,proof] of [
    ['권리산정기준일',rules.cutoff,rightsTip,r.rights_notice_no??r.field_evidence?.rights_cutoff_date?.notice_number,r.field_evidence?.rights_cutoff_date?.source_url],
    ['참고 노후도 · 30년',Number.isFinite(r.aging_rate)?formatValue(r.aging_rate,'%'):'산출중',ageTip,ages,stats?.source_url]
  ]){
    const button=el('button');button.type='button';button.title=tip;button.setAttribute('aria-haspopup','dialog');
    button.append(el('small',label),el('strong',value));metricCards.append(button);
    button.addEventListener('click',()=>{
      const dialog=document.getElementById('metric-dialog');
      dialog.querySelector('h2').textContent=label+' · '+value;
      const body=dialog.querySelector('.metric-description');body.replaceChildren(el('p',tip));
      if(note)body.append(el('p',note));
      const ref=link(proof,'근거 자료 열기');if(ref)body.append(ref);
      dialog.showModal();
    });
  }
  header.append(metricCards);
  if(r.risk_info?.is_canceled===true)header.append(el('p','선정 취소·철회 · '+(r.risk_info.cancel_reason??'사유 미고시'),'cancel-notice'));
  const {area,planned,existing}=values(r);
  const current=intervals.find(step=>step.label.includes('진행 중'))??intervals.at(-1);
  const elapsed=current?.terminal?(intervals.at(-2)??current):current;
  const full=elapsed?.label??pending;
  const short=full.replace(/^현재 /,'').replace(/ 진행 중$| 소요 \(.*\)$/,'');
  const kpis=el('dl',null,'summary-kpis');
  for(const [label,value,note] of [
    ['총 면적',formatValue(area,'평')],[r.stage==='사업시행계획 폐지'?'폐지 전 계획 세대수':planned==null && comparison?.total!=null?'수록 구역 계획 합계':'계획 세대수',formatValue(planned??comparison?.total,'세대'),comparablePlan(r,'existing_units')&&Number.isFinite(existing)&&Number.isFinite(planned)?unitsChange(existing,planned):null],
    ['단계 경과일',short,full.includes('진행 중')?'진행 중':elapsed?.days!=null?'소요':null]
  ]){
    const card=el('div');card.append(el('dt',label),el('dd',value,value===pending?'unverified':null));
    if(note)card.append(el('small',note));kpis.append(card);
  }
  header.append(kpis);return header;
}

function detailTabs(container,children,designated){
  const nav=el('div',null,'detail-tabs'),buttons=[],panels={};
  nav.setAttribute('role','tablist');nav.setAttribute('aria-label','구역 상세 정보');
  container.append(nav);
  function activate(key){
    for(const button of buttons){
      const selected=button.dataset.tab===key;
      button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;
      panels[button.dataset.tab].hidden=!selected;
    }
    if(key==='areas'){
      const pane=panels.areas,selected=pane.querySelector('.sub-area-cards [aria-current="true"]');
      if(selected){
        const card=selected.getBoundingClientRect(),view=pane.getBoundingClientRect();
        if(card.top<view.top || card.height>view.height)pane.scrollTop+=card.top-view.top;
        else if(card.bottom>view.bottom)pane.scrollTop+=card.bottom-view.bottom;
      }
    }
  }
  for(const [key,label] of [['schedule','추진·일정'],['business','사업성·규제'],['areas','세부구역 ('+children.length+')']]){
    const button=el('button',label),panel=el('div',null,'detail-pane');
    button.type='button';button.id='tab-'+key;button.dataset.tab=key;
    button.setAttribute('role','tab');button.setAttribute('aria-controls','pane-'+key);
    if(key==='business' && designated){
      const dot=el('span',null,'permit-dot');dot.title='토지거래허가구역 지정';dot.setAttribute('aria-hidden','true');
      button.append(dot,el('span',' · 토지거래허가구역 지정','sr-only'));
    }
    panel.id='pane-'+key;panel.tabIndex=0;
    panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',button.id);
    panel.hidden=true;panels[key]=panel;
    button.addEventListener('click',()=>activate(key));
    button.addEventListener('keydown',event=>{
      const i=buttons.indexOf(button),n=buttons.length;
      const index={ArrowRight:(i+1)%n,ArrowLeft:(i+n-1)%n,Home:0,End:n-1}[event.key];
      if(index===undefined)return;
      event.preventDefault();buttons[index].focus();activate(buttons[index].dataset.tab);
    });
    buttons.push(button);nav.append(button);container.append(panel);
  }
  return {panels,activate};
}

export function renderProjectDetail(container,{town,zone,children,boundaries,snapshot,cityRule,registryUrl,stats,select,badge,copyLink,expandDetail,initialTab,openPilot,openPlan,openTownRules}){
  const r=zone??town,boundary=boundaries.get(r.id),intervals=projectIntervals(town,zone,snapshot);
  const comparison=!zone && children.length?comparePlans(children):null;
  const header=summary(town,zone,intervals,badge,copyLink,comparison);
  if(openPilot){
    const button=el('button','3D 보기','pilot-entry');
    button.type='button';button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls','pilot-viewer');
    button.addEventListener('click',openPilot);
    header.querySelector('.copy-link').before(button);
  }
  container.append(header);
  const {panels,activate}=detailTabs(container,children,r.land_transaction_permit?.designated===true);
  if(comparison){
    const cta=el('button',null,'compare-areas');cta.type='button';cta.setAttribute('aria-controls','pane-areas');
    cta.append(el('strong','세부구역 '+children.length+'곳 '+(children.length===1?'보기':'비교')),el('span','계획 세대수 '+comparison.known+'곳 확인'));
    cta.addEventListener('click',()=>{expandDetail?.();activate('areas');panels.areas.scrollTop=0;panels.areas.focus({preventScroll:true});});
    header.append(cta);
  }
  const steps=section(panels.schedule,'timeline','추진 타임라인');
  if(openPlan){
    const button=el('button','건축 후 예상 3D 보기 ›','pilot-text-button');
    button.type='button';button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls','pilot-viewer');
    button.onclick=openPlan;steps.append(button);
  }
  timeline(steps,town,zone,snapshot,stats,intervals);
  section(panels.schedule,'news','사업 소식').append(el('div',null,'related-news'));
  const records=section(panels.schedule,'sources','출처 및 기준일');
  sources(records,r,snapshot,boundary,intervals.map(step=>step.event),registryUrl,reportIssueUrl(town,zone));
  metrics(panels.business,r,zone?[]:children);
  regulations(section(panels.business,'regulation','거래·규제 상세'),r,town,zone,boundary,cityRule,openTownRules);
  subAreas(panels.areas,town,zone,children,boundaries,select,badge);
  activate(initialTab??(zone?'areas':'schedule'));
}
