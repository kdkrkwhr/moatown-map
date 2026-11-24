import {formatValue,unitsChange,projectEvents,intervalBadge} from './detail-format.mjs?v=detail-1';

const pending='확인 중';
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
  const row=el('div'),v=value??pending;
  row.append(el('dt',label),el('dd',v,[pending,'미고시','고시일 미확인'].includes(v)?'unverified':''));
  list.append(row);return row;
}
function section(container,id,title){
  const card=el('section',null,'detail-section');card.id='detail-'+id;
  const heading=el('h3',title);heading.id=card.id+'-heading';card.setAttribute('aria-labelledby',heading.id);
  card.append(heading);container.append(card);return card;
}
const notice=(text)=>el('p',text,'notice');
const listOf=v=>Array.isArray(v)?v:[];
function boundaryLabel(boundary){
  if(!boundary)return null;
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

function regulations(card,r,town,zone,boundary,cityRule,badge){
  const facts=el('dl',null,'facts'),p=r.land_transaction_permit,stage=zone?r.stage:r.management_plan_stage??(r.management_plan_notices?.length?'관리계획 승인고시':null);
  const state=field(facts,'추진 단계',stage);
  if(zone && stage)state.lastChild.replaceChildren(badge(stage));
  else state.lastChild.classList.add('status-tag');
  if(r.risk_info?.is_canceled===true)card.append(el('p',['선정 취소·철회',r.risk_info.cancel_reason].filter(Boolean).join(' · '),'cancel-notice'));
  field(facts,'권리산정기준일',date(r.rights_cutoff_date)).lastChild.classList.add('status-tag');
  field(facts,'토지거래허가구역',typeof p?.designated==='boolean'?(p.designated?'지정':'해제')+(p.scope?' · '+p.scope:''):null);
  if(p?.start_date || p?.end_date)field(facts,'지정 기간',[p.start_date,p.end_date].map(date).join(' ~ '));
  field(facts,'구역 경계',boundaryLabel(boundary));
  field(facts,'대표 위치',r.representative_point?(r.representative_point_evidence?.address??r.registered_address??town.address):null);
  card.append(facts);
  if(boundary?.kind==='official_notice_drawing'){
    const box=notice('점선은 고시 도면의 구역선을 지도에 옮긴 것입니다. 개별 필지의 포함 여부는 원문에서 확인하세요.');
    const source=link(boundary.source_url,boundary.notice_number+' · 도면 '+boundary.pdf_page+'쪽');
    if(source)box.append(document.createElement('br'),source);
    card.append(box);
  }
  for(const h of listOf(r.rights_cutoff_history))card.append(notice([h.scope,date(h.date),h.status,h.condition].filter(Boolean).join(' · ')));
  if(!zone && cityRule){
    const more=el('details',null,'city-road-rule');
    more.append(el('summary','서울 전역 도로 지정 공고'),notice(cityRule.scope+' · '+date(cityRule.start_date)+' ~ '+date(cityRule.end_date)));
    const a=link(cityRule.evidence?.source_url,cityRule.evidence?.notice_number);if(a)more.append(a);card.append(more);
  }
  if(r.risk_info?.notes)card.append(notice(r.risk_info.notes));
}

function contractorField(grid,r,children){
  const unknown='선정 자료 미확인';
  const confirmed=children.filter(child=>child.selected_contractor);
  if(!r.selected_contractor && confirmed.length){
    const names=[...new Set(confirmed.map(child=>child.selected_contractor.replace(/주식회사|㈜|\(주\)/g,'').trim()))];
    const row=field(grid,'세부 구역 시공사',names.join(' · '));
    row.append(el('small',children.length+'개 구역 중 '+confirmed.length+'곳 확인'));
    return;
  }
  const row=field(grid,children.length?'세부 구역 시공사':'시공사',r.selected_contractor??unknown);
  if(!r.selected_contractor){row.lastChild.classList.add('unverified');return;}
  const e=r.field_evidence?.selected_contractor;
  if(!e)return;
  const source=link(e.source_url,e.source_title??'시공사 확인 자료');
  if(e.selection_date)row.append(el('small','선정일 '+date(e.selection_date)));
  if(source)row.append(source);
}

function metrics(card,r,children){
  const {area,existing,planned,owners}=values(r),m=r.metrics??{},e=r.field_evidence??{};
  const grid=el('dl',null,'metrics');
  field(grid,'구역 면적',formatValue(area,'㎡'));
  const aging=m.aging_ratio??r.aging_ratio,age=field(grid,'노후도',formatValue(aging,'%'));
  if(Number.isFinite(aging)&&aging>=0&&aging<=100){
    const meter=el('div',null,'aging-meter'),bar=el('progress');bar.max=100;bar.value=aging;bar.setAttribute('aria-label','노후도');
    meter.append(bar);age.append(meter,el('small','비교선 50.0%'));
  }
  field(grid,'국공유지 비율',formatValue(m.public_land_ratio??r.public_land_ratio,'%'));
  field(grid,'필지 수',formatValue(m.parcel_count??r.parcel_count,'필지'));
  field(grid,'기존 세대수',formatValue(existing,'세대'));
  const plan=field(grid,'계획 세대수',formatValue(planned,'세대'));
  if(Number.isFinite(existing)&&Number.isFinite(planned))plan.append(el('small',unitsChange(existing,planned)));
  field(grid,'토지등소유자 수',formatValue(owners,'명'));
  const sameSource=e.metrics?.source_url && e.metrics.source_url===e.plan?.source_url;
  const ratio=m.planned_units_per_owner??(owners>0 && Number.isFinite(planned) && (sameSource || m.planned_units!=null)?Number((planned/owners).toFixed(2)):null);
  field(grid,'소유자 1명당 계획 세대수',formatValue(ratio,'세대'));
  const zoning=r.zoning??{};
  field(grid,'현재 용도지역',zoning.before??zoning.observed?.names?.join(' · '));
  field(grid,'계획 용도지역',zoning.after);
  contractorField(grid,r,children);
  field(grid,'계획 자료 기준일',date(e.plan?.source_as_of));
  card.append(grid);
  const extra=el('details',null,'detail-extra'),facts=el('dl',null,'facts');
  extra.append(el('summary','건축·분양 세부 지표'));
  const c=r.contract_scope??{},contract=e.selected_contractor??{};
  const details=[
    ['최고 지상 층수',r.max_floors_above_ground??c.floors_above_ground,'층'],['지하 층수',r.floors_below_ground??c.floors_below_ground,'층'],
    ['최고 높이',r.height_m,'m'],['건폐율',r.building_coverage_pct,'%'],['용적률',r.floor_area_ratio_pct,'%'],
    ['계획 임대',r.housing_allocation?.rental,'세대'],['분양 합계',r.housing_allocation?.sale_total,'세대'],
    ['조합원 분양',r.approved_allocation?.member??r.housing_allocation?.members,'세대'],['일반 분양',r.approved_allocation?.general??r.housing_allocation?.general,'세대'],
    ['보류지',r.approved_allocation?.reserve??r.housing_allocation?.reserve,'세대'],['계약 당시 공사 규모',c.units,'세대']
  ];
  for(const [name,n,unit] of details)field(facts,name,formatValue(n,unit));
  if(r.selected_contractor){
    const key=contract.contract_date?'시공사 계약일':contract.source_as_of?'시공사 자료 기준일':'시공사 자료 확인일';
    field(facts,key,date(contract.contract_date??contract.source_as_of??contract.checked_on));
  }
  for(const a of listOf(zoning.areas))field(facts,a.label,formatValue(a.before_sqm,'㎡')+' → '+formatValue(a.planned_sqm,'㎡'));
  if(zoning.observed?.names?.length)field(facts,'용도지역 관찰 범위',zoning.observed.scope==='representative_point'?'대표 위치':'참고 외곽 내부');
  field(facts,'계획 조건',zoning.condition??r.plan_scenario);
  const prior=r.previous_plan;
  if(prior)field(facts,'이전 계획',[prior.evidence?.source_as_of&&date(prior.evidence.source_as_of),formatValue(prior.planned_units_total,'세대')].filter(Boolean).join(' · '));
  if(e.plan?.state?.includes('not_latest'))extra.append(notice('공개 당시의 계획값입니다. 최신 인가·분양계획과 차이가 있을 수 있습니다.'));
  const types=[...listOf(r.unit_types),...listOf(r.published_private_area_bands)];
  for(const a of types){
    if(!a||typeof a!=='object')continue;
    const surface=a.private_area_m2!=null?formatValue(Number(a.private_area_m2),'㎡'):a.privateAreaBandM2+'㎡';
    field(facts,[a.type,surface].join(' · '),formatValue(a.units,'세대'));
  }
  if(!types.length)field(facts,'세부 주택형',typeof r.unit_types==='string'?r.unit_types:null);
  extra.append(facts);card.append(extra);
}

function timeline(card,town,zone,snapshot,stats){
  const events=projectEvents(town,zone),items=el('ol',null,'milestone-list');
  for(const [i,event] of events.entries()){
    const next=events[i+1],reached=next && (next.date || next.reached || next.completed || events.slice(i+2).some(e=>e.date));
    const terminal=!next && ((zone??town).risk_info?.is_canceled===true || /(?:준공|사업종료|취소|철회)/.test(event.stage));
    const value=intervalBadge(event.date,next?.date,snapshot,{ongoing:!reached,terminal});
    const item=el('li'),head=el('div',null,'milestone-head');
    head.append(el('strong',event.stage),el('time',event.date?date(event.date):'고시일 미확인'));
    item.append(head,el('span',value,'duration '+(value.includes('진행 중')?'in-progress':value==='고시일 미확인'?'unverified':'')));
    if(event.scope)item.append(el('small',event.scope));
    if(/^\d{4}-\d{2}$/.test(event.date??'') && /^\d{4}-\d{2}$/.test(next?.date??'')){
      const monthIndex=s=>Number(s.slice(0,4))*12+Number(s.slice(5));
      const months=monthIndex(next.date)-monthIndex(event.date);
      if(months>=0)item.append(el('small','공개 연월 간격 '+formatValue(months,'개월')));
    }
    items.append(item);
  }
  card.append(items,el('small','진행 기간 기준 '+date(snapshot),'detail-caption'));
  for(const n of zone?[]:listOf(town.management_plan_notices)){
    const count=Number.isInteger(n.zone_count)?' · 서울시 수록 '+formatValue(n.zone_count,'곳'):'';
    card.append(notice(n.site+' · '+date(n.notice_date)+' 관리계획 고시'+count));
  }
  if(!zone && stats.months.has(town.id)){
    const months=stats.months.get(town.id),mean=Number(stats.mean.toFixed(1));
    card.append(notice('선정월부터 승인고시월까지 '+months+'개월 · 수록 대상지 '+stats.months.size+'곳 평균 '+mean+'개월'));
  }
}

function subAreas(card,town,zone,children,boundaries,select,badge){
  const heading=el('h4','세부 사업구역');heading.id='sub-area-heading';card.append(heading);
  if(!children.length){card.append(notice(town.risk_info?.is_canceled?'세부 사업구역 분할 정보 미고시':'세부 사업구역 분할 정보 미고시 (대상지 단위 추진 중)'));return;}
  const list=el('ul',null,'sub-area-cards');list.setAttribute('aria-label',town.name+' 세부 사업구역');
  for(const child of [...children].sort((a,b)=>(a.drawing_code??a.name).localeCompare(b.drawing_code??b.name,'ko',{numeric:true}))){
    const item=el('li'),button=el('button'),head=el('span',null,'sub-card-head');
    button.type='button';button.dataset.zone=child.id;button.setAttribute('aria-label',child.name+' 상세 보기');
    if(zone?.id===child.id)button.setAttribute('aria-current','true');
    head.append(el('strong',child.drawing_code??child.name),badge(child.stage,true));
    const place=boundaryLabel(boundaries.get(child.id))??(child.representative_point?'대표 지번 핀':'위치 확인 중');
    const sizes=values(child);
    button.append(head,el('small',(child.registered_address??'지번 확인 중')+' · '+place),el('span','면적 '+formatValue(sizes.area,'㎡')+' · 계획 '+formatValue(sizes.planned,'세대'),'sub-card-metrics'));
    if(child.selected_contractor)button.append(el('span','시공사 '+child.selected_contractor,'sub-card-contractor'));
    button.addEventListener('click',()=>select(town.id,child.id));item.append(button);list.append(item);
  }
  card.append(list);
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
function sources(card,r,snapshot,boundary,events){
  const footer=el('footer',null,'detail-sources');footer.append(el('h4','출처 및 기준일'));
  const facts=el('dl',null,'facts'),docs=new Map(),refs=new Map();
  function add(url,title,asOf,collection=refs){
    if(!link(url,'원문'))return;
    if(!collection.has(url))collection.set(url,{name:title||publisher(url),asOf});
  }
  if(boundary?.kind==='official_notice_drawing')add(boundary.source_url,boundary.notice_number+' · 경계 도면 '+boundary.pdf_page+'쪽',boundary.source_as_of,docs);
  for(const item of listOf(r.official_links))add(item?.url,item?.title,item?.date,docs);
  for(const n of listOf(r.management_plan_notices))add(n.archive_url??n.source_url,n.notice_number??n.site+' 관리계획 자료',n.notice_date,docs);
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
  if(r.source_as_of)field(facts,'원자료 기준일',date(r.source_as_of));
  field(facts,'데이터 출처',[...new Set(all.map(publisher))].join(' · ')||null);
  field(facts,'최종 확인일',date(r.last_verified_at??r.field_evidence?.identity?.checked_on??r.representative_point_evidence?.checked_on));
  footer.append(facts,el('h4','고시·공고 원문 링크'));
  function links(container,entries){
    for(const [url,v] of entries)container.append(link(url,v.name+(v.asOf?' · '+date(v.asOf):'')));
  }
  const box=el('div',null,'official-docs');links(box,docs);
  if(!docs.size)box.append(el('span',pending,'unverified'));
  footer.append(box);
  const more=el('details',null,'provenance');more.append(el('summary','항목별 근거 자료'));
  const other=el('div',null,'official-docs');links(other,refs);
  if(!refs.size)other.append(el('span',pending,'unverified'));more.append(other);footer.append(more);card.append(footer);
}

export function renderProjectDetail(container,{town,zone,children,boundaries,snapshot,cityRule,stats,select,badge}){
  const r=zone??town,boundary=boundaries.get(r.id);
  const status=section(container,'status','규제·상태');
  regulations(status,r,town,zone,boundary,cityRule,badge);
  if(zone?.field_evidence?.stage?.source_as_of)status.append(notice('추진 단계 자료 기준 '+date(zone.field_evidence.stage.source_as_of)));
  if(zone?.field_evidence?.stage?.association_site)status.append(notice('인가 고시 지번 · '+zone.field_evidence.stage.association_site));
  if(r.field_evidence?.registered_address?.note)status.append(notice(r.field_evidence.registered_address.note));
  if(!zone){const facts=el('dl',null,'facts');field(facts,'선정 방식',town.selection_track);status.append(facts);}
  const size=section(container,'metrics','사업규모·사업성 지표');metrics(size,r,zone?[]:children);
  const steps=section(container,'timeline','추진 타임라인 및 소요 기간');timeline(steps,town,zone,snapshot,stats);
  const records=section(container,'records','세부 사업구역 및 출처');
  subAreas(records,town,zone,children,boundaries,select,badge);sources(records,r,snapshot,boundary,projectEvents(town,zone));
}
