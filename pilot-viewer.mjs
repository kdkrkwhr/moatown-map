import {projectParams,setProjectPath} from './project-url.mjs?v=208c3fc8754e';

const collection=features=>({type:'FeatureCollection',features});
const count=value=>value.toLocaleString('ko-KR');
const date=value=>value?value.replaceAll('-','.'):'미확인';
const tierLabels={under_20:'20년 미만','20_to_29':'20~29년','30_plus':'30년 이상',unknown:'연도 미확인'};

export function buildingSummary(features){
  let inside=0,known=0,old=0,crossing=0,official=0,estimated=0;
  for(const {properties:p} of features){
    if(p.height_source==='official')official++;
    if(p.height_source==='estimated_from_floors')estimated++;
    if(p.is_inside_town===null)crossing++;
    if(p.is_inside_town!==true)continue;
    inside++;
    if(p.approval_year==null)continue;
    known++;
    if(p.age_tier==='30_plus')old++;
  }
  return {inside,known,old,crossing,official,estimated,unknownHeight:features.length-official-estimated,
    total:features.length,share:known?(old*100/known).toFixed(1)+'%':'산정 불가'};
}

export function mergeBuildingDetails(features,registry,heights,review,registryHeights,snapshotDate){
  return features.map(feature=>{
    const p=feature.properties,details=registry?.records?.[p.id],extra=heights?.records?.[p.id];
    const check=review?.records?.[p.id];
    const measured=registryHeights?.records?.[p.id];
    if(!details && !extra && !check && !measured)return feature;
    const properties={...p};
    for(const key of ['use','structure','basement_floors','approval_date','name','roof','roof_collected_on']){
      if(details?.[key]!=null)properties[key]=details[key];
    }
    if(p.height_m==null && Number.isFinite(measured?.height_m) && measured.height_m>0
        && Number.isInteger(measured.floors) && measured.floors>0
        && (p.floors==null || p.floors===measured.floors) && (!extra || extra.floors===measured.floors)){
      properties.floors=measured.floors;
      properties.height_m=measured.height_m;
      properties.height_source='official';
      properties.registry_height_evidence=measured;
      const approved=Number(measured.approval_date?.slice(0,4)),asOf=Number(snapshotDate?.slice(0,4));
      if(properties.approval_year==null && approved>0 && asOf>=approved){
        properties.approval_date=measured.approval_date;
        properties.approval_year=approved;
        properties.age_years=asOf-approved;
        properties.age_tier=properties.age_years>=30?'30_plus':properties.age_years>=20?'20_to_29':'under_20';
      }
    }else if(properties.floors==null && Number.isInteger(extra?.floors) && extra.floors>0){
      properties.floors=extra.floors;
      if(properties.height_m==null){
        properties.height_m=extra.floors*3;
        properties.height_source='estimated_from_floors';
        properties.map_floor_evidence=extra;
      }
    }
    if(check && check.reported_height_m===p.height_m && check.floors===p.floors){
      properties.height_review=check;
      if(check.decision==='use_registry_height')properties.height_m=check.registry_height_m;
    }
    return {...feature,properties};
  });
}

function el(tag,text,cls){
  const element=document.createElement(tag);
  if(text!=null)element.textContent=text;
  if(cls)element.className=cls;
  return element;
}
function facts(items){
  const list=el('dl',null,'pilot-facts');
  for(const [key,value] of items){
    const field=el('div');field.append(el('dt',key),el('dd',value??'미확인'));list.append(field);
  }
  return list;
}
function source(url,label){
  if(!url || !url.startsWith('https://'))return el('span',label);
  const a=el('a',label);a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a;
}
function planValue(record,key){
  if(record?.labels?.[key])return record.labels[key];
  const value=record?.[key];
  if(!Number.isFinite(value))return '미확인';
  return count(value)+({floors:'층',height_m:'m',far_pct:'%'})[key];
}
function showPlan(panel,record,name,simulated=false){
  panel.append(el('h3',name),facts([['최고 지상층수',planValue(record,'floors')],['계획 높이',planValue(record,'height_m')],['용적률',planValue(record,'far_pct')]]));
  if(record){
    panel.append(el('p',[record.scope,record.kind,record.notice_number].filter(Boolean).join(' · '),'pilot-meta'),
      source(record.source_url,'계획 원문 · '+(record.source_as_of?date(record.source_as_of):'자료 기준일 미확인')+' ↗'));
    if(record.note)panel.append(el('p',record.note,'pilot-meta'));
    if(record.latest_approval_verified===false)panel.append(el('p','공개 사업개요에 기재된 계획입니다. 최신 인가 수치는 확인 중입니다.','pilot-meta'));
    const evidence=Object.entries(record.field_evidence??{}),history=record.history??[];
    if(evidence.length || history.length){
      const more=el('details',null,'pilot-evidence');more.append(el('summary','수치별 근거와 이전 계획'));
      for(const [key,e] of evidence){
        if(!e?.source_url)continue;
        const label={floors:'층수',height_m:'높이',far_pct:'용적률'}[key]??key;
        more.append(source(e.source_url,[label,e.kind,date(e.source_as_of),e.page].filter(Boolean).join(' · ')+' ↗'));
      }
      for(const previous of history){
        const labels=Object.values(previous.labels??{}).filter(Boolean);
        more.append(source(previous.source_url,[date(previous.source_as_of),previous.kind,...labels].filter(Boolean).join(' · ')+' ↗'));
        if(previous.note)more.append(el('p',previous.note,'pilot-meta'));
      }
      panel.append(more);
    }
  }else panel.append(el('p','이 구역의 계획 수치는 원문 확인 대기 중입니다.','pilot-meta'));
  if(!simulated)panel.append(el('p','색면은 사업구역의 참고 경계입니다. 개별 건물의 배치와 높이를 함께 확인한 도면은 아직 수록되지 않았습니다.','pilot-note'));
}

const planSourceNames={
  municipal_town_plan_profile:'서울시 대상지 기록',integrated_review:'서울시 통합심의 자료',historical_district_plan:'이전 자치구 계획',
  contractor_announcement:'시공사 발표',association_project_profile:'조합 공개 사업개요',district_project_profile:'자치구 사업 현황',
  approved_project_plan:'사업시행계획인가',construction_contract:'공사 도급계약',municipal_management_plan:'공개 관리계획',
  historical_management_plan:'이전 관리계획 고시',
};
function planRecordLink(record){
  const label=planSourceNames[record.kind]??(/[가-힣]/.test(record.kind??'')?record.kind:'공개 계획 원문');
  return source(record.source_url,label+' · '+(record.source_as_of?date(record.source_as_of):'원문 기준일 미표기')+' ↗');
}

export function hasPublicLayout(input,townId,zoneId){
  return Boolean(input?.association_zone_ids?.some(id=>!zoneId||id===zoneId||id===townId));
}

export function preferredPlacement(input,zoneId,requested,townId){
  const covered=hasPublicLayout(input,townId,zoneId);
  const modes=input?.modes??(input?.design?['design','spaced']:['spaced']);
  if(modes.includes(requested)&&(requested!=='association'||covered))return requested;
  if(covered)return 'association';
  return ['zones','design','town','spaced'].find(k=>modes.includes(k))??'association';
}

export function selectPublicLayout(layouts,townId,zoneId){
  return layouts.find(l=>l.zone_id===zoneId)??layouts.find(l=>l.zone_id===townId)??
    layouts.find(l=>l.buildings.some(b=>b.geographic_ring)||l.spaces?.some(s=>s.geographic_ring))??layouts[0];
}

function associationView(session){
  if(session?.placement!=='association'||session.mode!=='plan')return null;
  const layout=selectPublicLayout(session.data?.layouts??[],session.town.id,session.zoneId);
  if(!layout)return null;
  const mapped=layout.buildings.filter(b=>b.geographic_ring);
  const mappedSpaces=(layout.spaces??[]).filter(s=>s.geographic_ring);
  const frame=session.layoutFrame??(mapped.length||mappedSpaces.length?'map':'drawing');
  return {layout,frame,mapped,mappedSpaces};
}

function showAssociation(panel,session,view,switchFrame,showFacilities){
  const {layout,frame,mapped,mappedSpaces}=view,drawing=frame==='drawing',buildings=drawing?layout.buildings:mapped;
  const spaces=drawing?(layout.spaces??[]):mappedSpaces,kinds={park:'공원·녹지',playground:'놀이터',community:'시설',pedestrian:'보행공간',road:'도로'};
  const registered=Boolean(mapped.length||mappedSpaces.length);
  if(layout.zone_id===session.town.id)panel.append(el('p','자료 범위 · '+(session.zoneId?'선택한 세부구역의 상위 대상지 전체 통합 배치도':'대상지 전체 통합 배치도'),'pilot-note'));
  panel.append(el('h3',layout.zone_name+' · '+(drawing?'도면 좌표':'지도 좌표')),
    el('p',drawing?'원문에서 외곽을 확인한 주거동 '+buildings.length+'동 표시':
      '원문에서 옮긴 '+layout.buildings.length+'동 중 지도 위치를 대조한 '+mapped.length+'동 표시','pilot-denominator'),
    el('p',drawing?'원본 그림의 위치와 방향을 유지했습니다. '+(registered?'눈금은 원본 이미지의 픽셀입니다.':'지도상의 위치와 실제 축척은 미확인입니다.'):
      (mappedSpaces.length?'도면에서 위치를 대조한 공원·시설 '+mappedSpaces.length+'곳에 ‘배치도’를 표시했습니다.':'원문에서 지도 위치를 대조한 주거동의 외곽을 표시합니다.'),'pilot-meta'));
  if(registered){
    const toggle=el('button',drawing?'지도에서 확인된 '+mapped.length+'동'+(mappedSpaces.length?'과 시설 '+mappedSpaces.length+'곳':'')+' 보기 ›':'원본 도면의 '+layout.buildings.length+'동'+
      (layout.spaces?.length?'과 시설 '+layout.spaces.length+'곳':'')+' 보기 ›','pilot-text-button');
    toggle.type='button';toggle.onclick=()=>switchFrame(drawing?'map':'drawing');panel.append(toggle,el('br'));
  }
  const selected=buildings.find(b=>b.id===session.towerId);
  if(selected)panel.append(facts([['선택한 주거동',selected.label||selected.id],['도면 표기 최고 층수',selected.floors==null?'미확인':selected.floors+'층']]));
  const selectedSpace=spaces.find(s=>s.id===session.spaceId);
  if(selectedSpace)panel.append(facts([['도면에 표시된 명칭',selectedSpace.label],['시설 유형',kinds[selectedSpace.kind]]]));
  panel.append(source(layout.source_url,(layout.source_label||'사업계획 공개 자료')+' ↗'));
  if(layout.image_url!==layout.source_url)panel.append(el('br'),source(layout.image_url,'배치도 원본 열기 ↗'));
  if(layout.source_locator)panel.append(el('p',layout.source_locator,'pilot-meta'));
  panel.append(el('p',(layout.source_as_of?'자료 기준일 '+date(layout.source_as_of):'자료 기준일 미표기')+' · 확인일 '+date(layout.checked_on),'pilot-meta'));
  const registration=layout.registration;
  if(registered&&registration?.reference_url){
    const evidence=el('details',null,'pilot-evidence');
    evidence.append(el('summary','도면과 지도의 위치 대조'));
    const metrics=[['대조한 경계점',registration.control_count,'개'],['경계 간 거리 (95백분위)',registration.boundary_residual_p95_m,'m'],
      ['경계 간 최대 거리',registration.boundary_residual_max_m,'m']];
    evidence.append(facts(metrics.filter(([,n])=>Number.isFinite(n)).map(([label,n,unit])=>[label,count(n)+unit])),
      source(registration.reference_url,'대조한 경계 원자료 ↗'));
    panel.append(evidence);
  }
  const list=el('details',null,'pilot-evidence');
  list.append(el('summary','동별 최고 층수와 확대 보기'));
  const controls=el('div',null,'pilot-plan-links');
  for(const b of buildings){
    const button=el('button',(b.label||b.id)+' · '+(b.floors==null?'층수 미확인':'최고 '+b.floors+'층')+' ›');
    button.type='button';button.onclick=()=>session.scene?.focusBuilding(b.id);controls.append(button);
  }
  list.append(controls);if(buildings.length)panel.append(list);
  if(spaces.length){
    const list=el('details',null,'pilot-evidence'),controls=el('div',null,'pilot-plan-links');
    list.append(el('summary','공개 배치도의 공원·시설 '+spaces.length+'곳'));
    for(const s of spaces){
      const button=el('button',s.label+' ›');button.type='button';
      button.onclick=()=>session.scene?.focusSpace(s.id);controls.append(button);
    }
    list.append(el('p','원본 배치도에서 명칭과 외곽을 대조한 공간입니다. 색면이나 이름을 눌러 확인할 수 있습니다.','pilot-meta'),controls);
    panel.append(list);
  }
  const note=drawing?'이 화면은 가로·세로를 원본 픽셀로 표시합니다. 동별 층수를 확인한 곳은 층당 도면 내 주거동 배치 폭·깊이 중 긴 변의 0.8%, 미확인 동은 일괄 8%로 돌출했습니다.':
    '지도상의 높이는 도면에 표기된 층수에 층당 3m를 곱해 추정했습니다. 층수가 확인되지 않은 동은 식별을 위해 6m 높이로 표시합니다.';
  panel.append(el('p',note+' 동별 최고 층수를 적용한 모형은 날개별 단차를 단순화했습니다.','pilot-note'));
  if(drawing&&session.data.publicSpace?.features.length&&showFacilities){
    const button=el('button','도로·공원·시설 지도 보기 ›','pilot-text-button');
    button.type='button';button.onclick=showFacilities;panel.append(button);
  }
  showPublicSpaces(panel,session.data.publicSpace,'도시계획 자료의 도로·공원·시설');
}

function showExpandedPlan(panel,session){
  const {expanded,simulation,zoneMap}=session.data;
  const whole=session.placement==='town',zoneId=whole?null:session.zoneId;
  const rows=Object.entries(simulation.summaries).filter(([id])=>!zoneId||id===zoneId);
  const section=el('section',null,'pilot-scenario');
  const countBlocks=rows.reduce((total,[,s])=>total+s.blocks,0);
  const scope=whole?'대상지 전체':zoneId?(zoneMap.get(zoneId)?.name??'선택 구역'):'세부구역 '+rows.filter(([,s])=>s.blocks).length+'곳';
  section.append(el('h3',scope+' · 예상 배치 '+count(countBlocks)+'동'));
  if(!rows.length)section.append(el('p','선택한 구역의 경계와 계획 수치를 대조하는 중입니다.','pilot-note'));
  if(whole)section.append(el('p',session.data.publicSpace?'주거동은 가상 배치입니다. 도로·공원·보행공간은 아래 원문에서 위치를 확인할 수 있습니다.':'대상지 전체 계획 규모를 참고 외곽 안에 배치했습니다. 도로·공원·존치 건물의 위치는 별도 반영하지 않았습니다.','pilot-meta'));
  if(!whole && !zoneId && zoneMap.size>rows.length)section.append(el('p','등록된 세부구역 '+zoneMap.size+'곳 중 경계와 계획 수치가 연결된 구역을 표시합니다.','pilot-meta'));
  for(const [id,s] of rows){
    const record=whole?expanded.plan:expanded.zones[id];
    const row=el('details',null,'pilot-evidence');
    row.open=rows.length===1;
    const historical=record.previous_geometry||record.kind?.startsWith('historical_');
    row.append(el('summary',(whole?session.town.name:zoneMap.get(id)?.name??record.scope)+' · '+s.blocks+'동 표시'+(historical?' · 이전 공개안':'')));
    if(record.scope)row.append(el('p','자료 범위 · '+record.scope,'pilot-meta'));
    const heights=s.capSource==='default'?'공개 층수 미확인 · 예시 상한 20층':
      (s.capSource==='town'?'대상지 전체':'세부구역')+' 계획 최고 '+s.capFloors+'층';
    row.append(facts([['계획 세대수',Number.isInteger(record.units)?count(record.units)+'세대':'미확인'],
      ['계획 동 수',s.publishedCount?s.publishedCount+'동':'미확인'],['층수 기준',heights],
      ['모형 높이',s.blocks?'약 '+Math.round(s.minHeight)+(Math.round(s.maxHeight)!==Math.round(s.minHeight)?'~'+Math.round(s.maxHeight):'')+'m':'—']]));
    if(s.publishedCount && s.publishedCount!==s.blocks)row.append(el('p','공개 계획은 '+s.publishedCount+'동입니다. 예시 동 크기와 간격으로 배치 가능한 '+s.blocks+'동을 표시했습니다.','pilot-note'));
    if(record.height_m>0)row.append(el('p','원문 최고 높이 '+record.height_m+'m','pilot-meta'));
    if(s.dimensions?.length)row.append(el('p','예시 동 크기와 간격 · '+s.dimensions.join(' / '),'pilot-meta'));
    row.append(planRecordLink(record));
    if(record.layout_url)row.append(el('br'),source(record.layout_url,'원문 배치도 ↗'));
    if(record.location_map_url)row.append(el('br'),source(record.location_map_url,'원문 위치도 ↗'));
    if(record.scope_evidence_url && record.scope_evidence_url!==record.source_url)
      row.append(el('br'),source(record.scope_evidence_url,'사업 범위 확인 자료 ↗'));
    const supply=record.separate_supply_record;
    if(supply?.source_url)row.append(el('br'),source(supply.source_url,'별도 대장 공급 규모 · '+count(supply.units)+'세대 ↗'));
    const fieldLinks=new Set([record.source_url]);
    for(const [field,e] of Object.entries(record.field_evidence??{})){
      if(!e?.source_url||fieldLinks.has(e.source_url))continue;
      fieldLinks.add(e.source_url);
      row.append(el('br'),source(e.source_url,({floors:'층수',height_m:'높이',units:'세대수'}[field]??'계획 수치')+' 근거 원문 ↗'));
    }
    if(Array.isArray(record.history))for(const past of record.history){
      if(past.source_url)row.append(el('br'),source(past.source_url,'이전 계획 · '+date(past.source_as_of)+' ↗'));
    }
    if(record.note)row.append(el('p',record.note,'pilot-meta'));
    const updated=whole?expanded.updated_town:expanded.updated_zones?.[id];
    if(updated){
      const latest=el('p',null,'pilot-note');
      latest.append('범위 변경 후 계획 · '+[updated.units&&count(updated.units)+'세대',updated.floors&&updated.floors+'층'].filter(Boolean).join(' · ')+' ',planRecordLink(updated));
      row.append(latest);
    }
    if(!whole && s.capSource==='town' && expanded.plan){
      row.append(el('br'),source(expanded.plan.source_url,'대상지 전체 층수 근거 · '+date(expanded.plan.source_as_of)+' ↗'));
      if(expanded.plan.note)row.append(el('p',expanded.plan.note,'pilot-meta'));
    }
    section.append(row);
  }
  if(!whole && !zoneId && expanded.plan)section.append(planRecordLink(expanded.plan));
  if(expanded.plan?.related_record){
    const extra=el('p',null,'pilot-meta');extra.append('함께 확인한 자료 · ',planRecordLink(expanded.plan.related_record));
    section.append(extra);
  }
  const unmapped=Object.entries(expanded.zones).filter(([id])=>!expanded.modes.zones?.summaries[id]?.blocks && (!zoneId||zoneId===id));
  if(unmapped.length){
    const more=el('details',null,'pilot-evidence');
    more.append(el('summary','배치 미표시 구역의 계획 자료 '+unmapped.length+'곳'));
    for(const [id,r] of unmapped){
      const row=el('p',null,'pilot-meta');
      row.append(el('strong',zoneMap.get(id)?.name??r.scope),document.createTextNode(' · '+
        [r.units&&count(r.units)+'세대',r.floors&&r.floors+'층',r.building_count&&r.building_count+'동'].filter(Boolean).join(' · ')+' '),planRecordLink(r));
      if(r.note)row.append(el('br'),document.createTextNode(r.note));
      more.append(row);
    }
    section.append(more);
  }
  const notes=el('details',null,'pilot-evidence');
  notes.append(el('summary','예상 배치 계산 기준'),el('p','공개 동 수를 우선합니다. 동 수가 없으면 계획 세대수와 층당 4세대를 기준으로 배치하며, 층수만 공개된 경우에는 경계 안에 들어가는 모형 수를 보여줍니다. 공개 최고 높이가 있으면 층수 비율로 환산하고 그 밖에는 층당 3m를 적용했습니다.','pilot-meta'));
  section.append(notes);panel.append(section);
}

function showSimulation(panel,summaries,zoneId,design){
  const entries=zoneId?[summaries[zoneId]].filter(Boolean):Object.values(summaries);
  const total=entries.reduce((sum,s)=>sum+s.blocks,0);
  const occupied=entries.filter(s=>s.blocks);
  const card=el('section',null,'pilot-scenario');
  const s=zoneId && entries[0];
  const drawn=entries.filter(entry=>entry.sourceLayout);
  const allDrawn=drawn.length>0 && drawn.length===entries.length;
  const title=allDrawn?drawn[0].layoutLabel+' · 주거동 '+count(total)+'동':
    design?'계획자료 반영 · 주거동 형태 '+count(total)+'개':'35m 간격 배치 · '+count(total)+'동';
  card.append(el('h3',title));
  if(s?.sourceLayout)card.append(el('p',['구역 최고 '+s.capFloors+'층',Number.isFinite(s.units)?count(s.units)+'세대':null].filter(Boolean).join(' · '),'pilot-plan-program'));
  if(occupied.length){
    const low=Math.min(...occupied.map(s=>s.minFloors)),high=Math.max(...occupied.map(s=>s.maxFloors));
    const min=Math.min(...occupied.map(s=>s.minHeight)),max=Math.max(...occupied.map(s=>s.maxHeight));
    card.append(el('p',(low===high?low:low+'~'+high)+'층 · 추정 높이 '+(min===max?count(min):count(min)+'~'+count(max))+'m'));
  }
  const basis={zone:'세부구역 공개 계획',town:'대상지 전체 계획',association:'조합 공개안',default:'자료 미확인 시 기본 가정'};
  if(!design && entries.length && entries.every(s=>Number.isInteger(s.units))){
    card.append(facts([['자료상 계획 세대수',count(entries.reduce((sum,s)=>sum+s.units,0))+'세대'],
      ['배치 예시 환산',count(entries.reduce((sum,s)=>sum+s.simulatedUnits,0))+'세대']]));
  }
  const basisText=s?basis[s.capSource]+' 최고 '+s.capFloors+'층':
    [...new Set(entries.map(entry=>basis[entry.capSource]+' 최고 '+entry.capFloors+'층'))].join(' · ');
  const heightRule=occupied.some(entry=>entry.usePlanHeight)
    ?'구역 최고 높이가 공개된 곳은 동별 예시 층수에 비례해 높이를 환산했습니다. 최고 높이가 없는 곳은 층당 3m를 적용했습니다.'
    :'동별 예시 높이는 층당 3m로 환산했습니다.';
  if(design){
    if(drawn.length){
      const entry=drawn[0];
      card.append(el('p',count(drawn.reduce((sum,row)=>sum+row.blocks,0))+'개 주거동의 위치·방향·윤곽을 배치도에서 옮겼습니다. 창호·조경은 예시입니다.','pilot-meta'));
      if(entry.layoutUrl)card.append(source(entry.layoutUrl,entry.layoutLabel+(entry.layoutDate?' · '+date(entry.layoutDate):'')+' 원문 ↗'));
    }
    if(entries.some(entry=>!entry.sourceLayout && entry.countRecord))card.append(el('p','동 수가 공개된 구역은 해당 자료의 동 수를 목표로 배치했습니다.','pilot-meta'));
    if(entries.some(entry=>!entry.sourceLayout&&!entry.countRecord))card.append(el('p','동 수가 확인되지 않은 구역은 계획 세대수와 층당 4세대를 기준으로 동 수를 추정했습니다.','pilot-meta'));
    const info=el('details',null,'pilot-evidence');
    info.append(el('summary','배치와 추정 높이의 기준'),el('p','구역별 기준 · '+basisText,'pilot-meta'));
    if(drawn.some(entry=>entry.hasDrawingFloors))info.append(el('p','한 동 안에서 가장 높은 날개의 층수를 적용했습니다. 후속 공람에서 구역 최고 층수가 낮아진 경우에는 그 상한을 적용했습니다.','pilot-meta'));
    if(entries.some(entry=>!entry.hasDrawingFloors))info.append(el('p','동별 층수가 없는 곳은 최고 층수의 70~100%로 예시 층수를 정했습니다.','pilot-meta'));
    info.append(el('p',heightRule,'pilot-meta'));
    if(!allDrawn)info.append(el('p','자동 배치에는 32 × 16m 동, 경계 여백 5m, 동간 간격 10m를 가정했습니다.','pilot-meta'));
    for(const note of new Set(entries.map(entry=>entry.overlayNote).filter(Boolean)))info.append(el('p',note,'pilot-note'));
    card.append(info);
  }else{
    card.append(el('p','배치 상한 · '+basisText,'pilot-meta'),
      el('p','동 크기 42 × 14m · 경계에서 10m 이상 · 동 사이 35m 이상. '+heightRule,'pilot-meta'),
      el('p','층당 4세대를 가정해 계획 세대수를 동 수의 목표로 사용했습니다. 간격을 지킬 수 있는 동만 표시합니다.','pilot-meta'));
  }
  panel.append(card);
  if(design?.zones[zoneId]?.records?.length){
    const section=el('section',null,'pilot-source-card');
    section.append(el('h4','구역별 공개 계획'));
    const records=[...(design.zones[zoneId]?.records??[])];
    if(s?.sourceLayout)records.sort((a,b)=>Number(b.stage_kind==='association_plan')-Number(a.stage_kind==='association_plan'));
    for(const record of records){
      const row=el('details',null,'pilot-evidence');
      row.open=!section.querySelector('details');
      row.append(el('summary',record.stage+' · '+(record.source_as_of?date(record.source_as_of):'기준일 미표기')));
      const measures=[['공동주택',record.units,'세대'],['임대',record.rental_units,'세대'],['공개 동 수',record.building_count,'동'],['최고 지상층수',record.floors,'층'],
        ['지하층수',record.basement_floors,'층'],['건폐율',record.coverage_pct,'%'],['용적률',record.far_pct,'%'],
        ['건축면적',record.building_area_m2,'㎡'],['연면적',record.gross_floor_area_m2,'㎡']];
      row.append(facts(measures.filter(([,n])=>Number.isFinite(n)).map(([name,n,unit])=>[name,count(n)+unit])),
        source(record.source_url,(record.source_locator??'계획 원문')+' ↗'));
      if(record.plan_url)row.append(source(record.plan_url,'조합 배치도 원문 ↗'));
      section.append(row);
    }
    panel.append(section);
  }
}
function showPublicSpaces(panel,publicSpace,title='도로·공원·보행공간'){
  if(publicSpace?.features.length){
    const places=el('details',null,'pilot-evidence');
    places.append(el('summary',title+' · '+publicSpace.features.length+'개 항목'),
      el('p',publicSpace.source_label+' · '+date(publicSpace.source_as_of),'pilot-meta'));
    if(publicSpace.status)places.append(el('p',publicSpace.status,'pilot-meta'));
    for(const {properties:p,geometry} of publicSpace.features){
      const measure=p.width_m?' · 폭 '+p.width_m+'m':p.notice_area_m2?' · '+count(p.notice_area_m2)+'㎡':'';
      let label='';
      if(p.location_only)label=p.representative_lot?' · 대표 지번 '+p.representative_lot:' · 위치 기호';
      else if(p.evidence==='official_plan_drawing_traced' && geometry.type.endsWith('LineString'))label=' · 도면 중심선';
      const asOf=p.source_as_of && p.source_as_of!==publicSpace.source_as_of?' · '+date(p.source_as_of):'';
      const link=source(p.source_url,p.name+measure+label+asOf+' ↗');
      if(p.source_label)link.title=p.source_label;
      places.append(link);
    }
    panel.append(places);
  }
}

function showIllustration(figure,panel,catalog){
  const view=catalog.views.find(v=>v.image);
  if(!view)throw Error('표시할 조감도가 없습니다.');
  const imageUrl=new URL(view.image,document.baseURI);
  const original=document.createElement('a');
  original.href=imageUrl.href;original.target='_blank';original.rel='noopener';
  const img=el('img');img.alt=view.alt;img.src=imageUrl.href;
  original.append(img);
  const caption=el('figcaption',view.title+' · 이미지를 누르면 원본 크기로 열립니다.');
  figure.replaceChildren(original,caption);
  img.onerror=()=>{caption.replaceChildren(source(view.source_url,'서울시 원문에서 조감도 보기 ↗'));};
  panel.append(el('h3','서울시 공개 조감도'));
  for(const v of catalog.views){
    const item=el('section',null,'pilot-visual-source');
    item.append(el('h4',v.title),el('p',[v.stage,date(v.source_as_of)].join(' · '),'pilot-meta'),
      source(v.source_url,'서울시 원문 ↗'));
    if(v.document_url)item.append(el('br'),source(v.document_url,'조감도 PDF · '+v.page_label+' ↗'));
    if(v.image){
      item.append(el('p',v.attribution||v.publisher,'pilot-meta'),source(v.license_url,v.license));
    }
    panel.append(item);
  }
}

async function fetchJson(url,signal,hash){
  const target=new URL(url);
  if(hash)target.searchParams.set('v',hash.slice(0,12));
  const response=await fetch(target,{signal,cache:hash?'default':'no-cache'});
  if(!response.ok)throw Error('자료 요청 실패 ('+response.status+')');
  if(!hash)return response.json();
  const text=(await response.text()).replaceAll('\r\n','\n');
  if(globalThis.crypto?.subtle){
    const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)));
    const actual=Array.from(digest,n=>n.toString(16).padStart(2,'0')).join('');
    if(actual!==hash)throw Error('자료 버전이 일치하지 않습니다');
  }
  return JSON.parse(text);
}

export function mountPilotViewer({manifest,boundaries,townById,groups}){
  const get=id=>document.getElementById(id),dialog=get('pilot-viewer'),sceneBox=get('pilot-scene');
  const inspector=get('pilot-inspector'),choice=get('pilot-zone'),status=get('pilot-loading');
  const modes=[...dialog.querySelectorAll('[data-pilot-mode]')],retry=status.querySelector('button');
  const figure=get('pilot-illustration'),notice=get('pilot-simulation-notice');
  const reference=get('pilot-reference'),placement=get('pilot-placement');
  const currentSwitch=get('pilot-current-style');
  const frame=get('pilot-frame'),fullscreen=get('pilot-fullscreen');
  const info=get('pilot-info'),infoToggle=get('pilot-info-toggle');
  const config=manifest.pilot_3d,base=new URL('./moatown-data/',document.baseURI);
  const supports=id=>Boolean(config?.town_ids?.includes(id));
  let active=null;

  function showInfo(visible){
    info.hidden=!visible;
    infoToggle.setAttribute('aria-expanded',String(visible));
  }
  function setExpanded(expanded){
    dialog.classList.toggle('is-expanded',expanded);
    const label=expanded?'전체화면 종료':'전체화면';
    fullscreen.querySelector('span').textContent=label;
    fullscreen.setAttribute('aria-label',label);fullscreen.title=label;
    infoToggle.hidden=!expanded;
    showInfo(!expanded);
  }
  function exitExpanded(){
    setExpanded(false);
    if(document.fullscreenElement===frame){
      document.exitFullscreen().catch(()=>{
        if(active && document.fullscreenElement===frame)setExpanded(true);
      });
    }
  }
  fullscreen.onclick=()=>{
    if(dialog.classList.contains('is-expanded')){exitExpanded();return;}
    setExpanded(true);
    // A modal dialog cannot enter native fullscreen itself. Its contents can.
    // The viewport layout also works when a browser declines the request.
    if(document.fullscreenEnabled && frame.requestFullscreen && !document.fullscreenElement){
      frame.requestFullscreen({navigationUI:'hide'}).catch(()=>{});
    }
  };
  frame.addEventListener('fullscreenchange',()=>{
    if(document.fullscreenElement===frame){
      if(!active || !dialog.classList.contains('is-expanded'))exitExpanded();
    }else{
      setExpanded(false);
    }
  });
  infoToggle.onclick=()=>showInfo(info.hidden);

  function showReference(mode,catalog){
    const current=mode==='current';
    const view=current?catalog?.current_view:catalog?.views.find(v=>v.image);
    reference.hidden=mode==='visual'||!view;
    const key=view?.image||view?.source_url;
    if(reference.hidden || reference.dataset.image===key)return;
    reference.dataset.image=key;
    reference.querySelector('summary').textContent=current?'서울시 정비 전 현황 함께 보기':'대상지 전체 조감도 함께 보기';
    if(!view.image){
      reference.querySelector('div').replaceChildren(source(view.source_url,view.title+' ↗'),
        el('p',view.publisher+' · 게시물 기준 '+date(view.source_as_of)));
      return;
    }
    const img=el('img'),full=el('a');
    img.loading='lazy';img.decoding='async';
    img.src=new URL(view.image,document.baseURI).href;img.alt=view.alt;img.width=view.image_width;img.height=view.image_height;
    full.href=img.src;full.target='_blank';full.rel='noopener';full.setAttribute('aria-label',view.title+' 원본 크기로 보기');full.append(img);
    const caption=current?'게시물 수정 '+date(view.source_as_of)+' · '+(view.capture_date?'촬영 '+date(view.capture_date):'촬영일 미표기'):date(view.source_as_of);
    reference.querySelector('div').replaceChildren(full,el('p',(view.attribution||view.publisher)+' · '+caption),
      source(view.source_url,'서울시 원문 ↗'),document.createTextNode(' · '),source(view.license_url,view.license));
  }

  function zoomToBuilding(feature){
    if(!active?.scene)return;
    active.scene.focusBuilding(feature.properties.id);
    active.building=feature;drawDetails();
  }

  function showExistingOverview(data){
    const s=data.summary;
    inspector.append(el('h3','기존 건물 외관'),el('p',date(data.asOf)+' 자료 · 대상지와 주변 150m · '+count(s.total)+'동','pilot-denominator'),
      el('p','건물을 누르면 용도·층수·사용승인일을 볼 수 있습니다. 창문 배치와 외장 색상은 건물 유형에 따른 예시입니다.','pilot-note'));
    const timeline=active.town.published_timeline;
    const construction=timeline?.events?.find(e=>e.label==='착공 행사');
    if(construction)inspector.append(source(timeline.source_url,'정비 전 건물 기록 · '+date(construction.month)+' 착공 행사 ↗'));
    if(data.boundary?.reference_label)inspector.append(source(data.boundary.source_url,
      data.boundary.reference_label+' · '+date(data.boundary.source_as_of)+' ↗'));
    const examples=el('div',null,'pilot-plan-links');
    const inside=[...data.byId.values()].filter(f=>f.properties.is_inside_town===true);
    const named=inside.find(f=>f.properties.name);
    const add=(feature,label)=>{
      if(!feature)return;
      const button=el('button',label+' ›');button.type='button';button.onclick=()=>zoomToBuilding(feature);
      examples.append(button);
    };
    for(const use of ['단독주택','공동주택']){
      const example=inside.find(f=>f.properties.use===use && f.properties.height_source==='official' && f.properties.floors>1 && f!==named);
      add(example,use+' 한 동 확대');
    }
    if(named)add(named,named.properties.name+' 확대');
    inspector.append(examples);
    const coverage=el('details',null,'pilot-evidence');
    coverage.append(el('summary','높이 자료 확보 현황'),facts([['공식 높이',count(s.official)+'동'],
      ['층수 × 3m 환산',count(s.estimated)+'동'],['높이 미확인 · 평면 표시',count(s.unknownHeight)+'동']]));
    const all=[...data.byId.values()];
    const measured=all.find(f=>f.properties.registry_height_evidence);
    if(measured){
      const example=el('button','건축물대장 높이를 확인한 건물 보기','pilot-text-button');
      example.type='button';example.onclick=()=>zoomToBuilding(measured);coverage.append(example);
    }
    for(const [field,label] of [['flr_num','수치지도'],['gro_flo_co','도로명주소 자료']]){
      const hasSource=f=>f.properties.map_floor_evidence?.source_field===field;
      const supplemental=inside.find(hasSource)??all.find(hasSource);
      if(supplemental){
        const example=el('button',label+' 층수로 높이를 보강한 건물 보기','pilot-text-button');
        example.type='button';example.onclick=()=>zoomToBuilding(supplemental);coverage.append(example);
      }
    }
    const withoutHeight=inside.find(f=>f.properties.height_m==null)??all.find(f=>f.properties.height_m==null);
    if(withoutHeight){
      const example=el('button','높이 미확인 건물의 외곽 보기','pilot-text-button');
      example.type='button';example.onclick=()=>zoomToBuilding(withoutHeight);coverage.append(example);
    }
    inspector.append(coverage);
  }

  function drawDetails(){
    if(!active)return;
    const {data,zoneId,building,mode,town}=active;
    inspector.replaceChildren();
    if(mode==='visual'){
      get('pilot-district').textContent=town.district+' · 공식 조감도';
      if(active.catalog)showIllustration(figure,inspector,active.catalog);
      if(active.catalog && active.canSimulate){
        const button=el('button','건축 후 3D 배치 보기 ›','pilot-text-button');
        button.type='button';button.onclick=()=>changeMode('plan');inspector.prepend(button);
      }
      return;
    }
    if(!data){
      get('pilot-district').textContent=town.district+' · '+(mode==='plan'?'사업 계획':'현재 건물');
      return;
    }
    get('pilot-district').textContent=town.district+' · '+(mode==='current'?'건물 자료 '+date(data.asOf):'사업 계획');
    if(mode==='plan'){
      const view=associationView(active);
      if(view){
        const fallback=active.fallbackPlacement;
        showAssociation(inspector,active,view,frame=>{
          active.layoutFrame=frame;active.towerId=null;active.spaceId=null;updateScene();renderMode();
        },fallback?()=>selectPlacement(fallback):null);
        return;
      }
      if(data.expanded){showExpandedPlan(inspector,active);showPublicSpaces(inspector,data.publicSpace);return;}
      const zone=data.zoneMap.get(zoneId);
      if(data.designError)inspector.append(el('p','구역별 계획자료를 불러오지 못해 35m 간격 예시를 표시합니다.','pilot-note'));
      const hasZoneSimulation=Boolean(zoneId?data.simulation?.summaries[zoneId]?.blocks:data.simulation?.features.length);
      if(hasZoneSimulation)showSimulation(inspector,data.simulation.summaries,zoneId,active.placement==='design'?data.design:null);
      showPublicSpaces(inspector,data.publicSpace);
      if(data.design && active.placement==='design' && !zone){
        const shortcuts=el('div',null,'pilot-plan-links');
        for(const z of data.zoneMap.values()){
          const s=data.simulation.summaries[z.id];
          if(!s?.sourceLayout && !s?.countRecord)continue;
          const button=el('button',z.name+' · '+(s.layoutLabel??'공개 동 수')+' ›');
          button.type='button';button.onclick=()=>{selectZone(z.id);active.scene?.focusZone(z.id);};shortcuts.append(button);
        }
        inspector.append(shortcuts);
      }
      if(!(active.placement==='design' && data.simulation?.summaries[zoneId]?.capSource==='association'))
        showPlan(inspector,zone?data.plans.zones[zoneId]:data.plans.plan,zone?.name??town.name,hasZoneSimulation);
      return;
    }
    if(building){
      const p=building.properties;
      const floorSource=p.map_floor_evidence?.source_field==='gro_flo_co'?'도로명주소 건물 지상층수':'서울시 수치지도 층수';
      const registryRows=active.detailKey?[['주용도',p.use],['구조',p.structure],['대장상 지붕',p.roof]]:[];
      inspector.append(el('h3',p.name||'선택한 건물'),facts([...registryRows,
        ['건물 높이',p.height_m==null?'미확인':count(p.height_m)+'m'],
        ['높이 근거',p.registry_height_evidence || p.height_review?.decision==='use_registry_height'?'건축물대장 표제부':p.map_floor_evidence?floorSource+' × 3m':p.height_source==='official'?'공식 자료':p.height_source==='estimated_from_floors'?'대장 지상층수 × 3m':'미확인'],
        [p.map_floor_evidence?'지도 표기 층수':'지상층수',p.floors==null?'미확인':p.floors+'층'],
        ...(active.detailKey?[['지하층수',p.basement_floors==null?null:p.basement_floors+'층']]:[]),
        p.approval_date?['사용승인일',date(p.approval_date)]:['사용승인연도',p.approval_year==null?'미확인':p.approval_year+'년'],
        ['위치',p.is_inside_town===true?'참고 외곽 내부':p.is_inside_town===false?'주변 150m':'참고 경계 걸침']]));
      if(p.height_m==null)inspector.append(el('p','높이와 층수를 확인하지 못해 기록된 외곽을 평면으로 표시합니다.','pilot-note'));
      if(p.registry_height_evidence){
        const row=p.registry_height_evidence;
        inspector.append(source(row.source_url,'표제부 높이 · 자료 수집일 '+date(row.registry_collected_on)+' ↗'));
      }
      if(p.roof)inspector.append(source(data.registry.roof_source.source_url,'건축물대장 표제부 · 지붕 자료 수집일 '+date(p.roof_collected_on)+' ↗'));
      if(p.height_review){
        const check=p.height_review;
        const note=check.decision==='use_registry_height'?'공간자료에는 '+count(check.reported_height_m)+'m로 기록되어 같은 건물의 표제부 높이를 적용했습니다.':
          check.decision==='sources_agree'?'층수 대비 높이 차이가 커서 건축물대장을 대조했습니다. 두 자료의 높이가 일치합니다.':
          '층수 대비 높이 차이가 큽니다. 같은 건물의 표제부 높이를 확인할 때까지 공간자료 값을 표시합니다.';
        inspector.append(el('p',note,'pilot-note'));
        if(check.registry_collected_on)inspector.append(source(data.heightReview.registry_url,'표제부 높이 · 자료 수집일 '+date(check.registry_collected_on)+' ↗'));
      }
      if(active.detailKey){
        const zoom=el('button','이 건물 확대','pilot-text-button');zoom.type='button';
        zoom.onclick=()=>zoomToBuilding(building);inspector.append(zoom);
      }
      if(p.map_floor_evidence){
        const evidence=p.map_floor_evidence;
        inspector.append(source(evidence.source_url??data.heights.source_url,'보충 층수 원자료 ↗'),
          el('p','원자료 기록일 '+date(evidence.source_record_date)+' · 조회 '+date(data.heights.checked_on),'pilot-meta'));
      }
      const back=el('button',active.detailKey?'대상지 전체 보기':'대상지 통계 보기','pilot-text-button');
      back.type='button';back.onclick=()=>{
        active.building=null;active.scene.selectZone(active.zoneId);
        if(active.detailKey)active.scene.reset();
        drawDetails();
      };inspector.append(back);
    }else if(active.detailKey && active.currentStyle==='exterior'){
      showExistingOverview(data);
    }else{
      const s=data.summary;
      inspector.append(el('h3','대상지 전체 · 30년 이상 건물 비율'),el('strong',s.share,'pilot-stat'),
        el('p','연도 확인 '+count(s.known)+'동 중 '+count(s.old)+'동','pilot-denominator'),
        el('small','대상지 내부 '+count(s.inside)+'동 · 연도 미확인 '+count(s.inside-s.known)+'동','pilot-meta'));
      const legend=el('ul',null,'pilot-key');
      for(const [key,label] of Object.entries(tierLabels)){
        const li=el('li',label);li.dataset.tier=key;legend.append(li);
      }
      inspector.append(legend);
    }
    if(active.detailKey && !data.registry)inspector.append(el('p','건축물 상세 자료를 불러올 수 없습니다.','pilot-note'));
    if(active.heightsKey && !data.heights)inspector.append(el('p','보충 층수 자료를 불러올 수 없습니다.','pilot-note'));
    inspector.append(source(data.sourceUrl,'건물 원자료 ↗'),el('p','건물 자료 기준일 '+date(data.asOf),'pilot-meta'));
  }
  function renderMode(){
    const {mode,scene,canSimulate}=active,visual=mode==='visual';
    const ready=visual?Boolean(active.catalog):Boolean(scene);
    const error=visual?active.visualError:active.sceneError;
    dialog.dataset.ready=String(ready);dialog.dataset.mode=mode;
    for(const button of modes)button.setAttribute('aria-pressed',String(button.dataset.pilotMode===mode));
    notice.hidden=mode!=='plan'||!canSimulate;
    const summaries=Object.values(active.data?.simulation?.summaries??{});
    const drawn=active.placement==='design' && summaries.length>0 && summaries.every(s=>s.sourceLayout);
    const expanded=active.data?.expanded;
    const earlier=expanded&&(active.placement==='town'?expanded.plan?.previous_geometry:
      active.zoneId?expanded.updated_zones?.[active.zoneId]:Object.keys(expanded.updated_zones??{}).length);
    const association=associationView(active);
    notice.textContent=association?(association.layout.zone_id===active.town.id?'대상지 전체 통합 배치도':'공개 배치도에서 확인한 주거동')+
      (association.frame==='drawing'?' · 원본 도면의 픽셀 좌표이며 높이는 참고용입니다.':' · 지도에 맞춘 외곽이며 높이는 참고용입니다.'):
      expanded?(active.placement==='town'?'대상지 전체':'세부구역')+' 참고 경계 안의 가상 배치입니다. 동 위치·높이·외관은 예시입니다.'+
      (earlier?' 범위가 변경된 곳은 수록 경계에 맞는 이전 공개안을 표시합니다.':'')+
      (summaries.some(s=>s.capSource==='default')?' 공개 층수가 없는 곳은 20층 상한을 가정했습니다.':''):
      drawn?'공식 배치도에서 옮긴 주거동 위치와 윤곽입니다. 높이와 외관은 공개 계획을 바탕으로 추정했습니다.':
      '※ 본 3D 단지 배치는 계획 최고 층수·면적을 바탕으로 자동 생성된 참고용 시뮬레이션이며, 실제 건축 설계와 다릅니다.';
    const available=active.data?.placements??[];
    placement.hidden=notice.hidden||!ready||available.length<2;
    for(const button of placement.querySelectorAll('button')){
      button.hidden=!available.includes(button.dataset.placement);
      button.setAttribute('aria-pressed',String(active.placement===button.dataset.placement));
      button.disabled=button.dataset.placement==='design'&&!active.data?.design;
    }
    currentSwitch.hidden=mode!=='current'||!active.detailKey||!ready;
    for(const button of currentSwitch.querySelectorAll('button'))button.setAttribute('aria-pressed',String(active.currentStyle===button.dataset.currentStyle));
    showReference(mode,active.catalog);
    sceneBox.style.visibility=visual?'hidden':'';
    sceneBox.inert=visual;
    figure.hidden=!visual;
    get('pilot-tools').hidden=visual;
    get('pilot-gestures').hidden=visual;
    if(active.data){
      const key=association?'association':'map';
      if(choice.dataset.kind!==key){
        choice.replaceChildren();
        if(association)for(const l of active.data.layouts)choice.add(new Option(l.zone_name,l.zone_id));
        else{
          choice.add(new Option('대상지 전체',''));
          for(const z of [...active.data.zoneMap.values()].sort((a,b)=>a.name.localeCompare(b.name,'ko',{numeric:true}))){
            const mapped=active.data.mappedZones.has(z.id);
            if(!mapped && z.id!==active.zoneId)continue;
            const option=new Option(z.name+(mapped?'':' · 경계 미수록'),z.id);
            option.disabled=!mapped;choice.add(option);
          }
        }
        choice.dataset.kind=key;
      }
      choice.value=association?association.layout.zone_id:active.zoneId??'';
    }
    choice.parentElement.hidden=visual||(mode==='plan' && active.placement==='town')||Boolean(scene && choice.options.length<=1);
    choice.disabled=!ready;
    for(const button of get('pilot-tools').querySelectorAll('button'))button.disabled=!ready;
    status.hidden=ready;retry.hidden=!error;
    status.querySelector('span').textContent=error?'자료를 열 수 없습니다. '+error.message:visual?'공식 조감도 불러오는 중':'3D 자료 불러오는 중';
    if(!visual){
      scene?.setMode(mode);
      if(active.detailKey)scene?.setCurrentStyle(active.currentStyle);
    }
    drawDetails();
  }
  function changeMode(mode){
    const session=active;
    if(!session)return;
    if(mode==='plan'){
      session.building=null;
      session.placement=preferredPlacement(config.simulation_inputs?.[session.town.id],session.zoneId,session.explicitPlacement,session.town.id);
      if(session.data&&!session.data.placements.includes(session.placement))session.placement=session.fallbackPlacement;
    }
    session.mode=mode;
    updateScene();
    const url=new URL(location.href);
    if(mode==='current')url.searchParams.delete('mode');
    else url.searchParams.set('mode',mode==='plan'?'after':'visual');
    if(url.href!==location.href)history.replaceState(history.state,'',url);
    renderMode();
    if(session.visualKey && !session.catalog && !session.loadingVisual && !session.visualError)loadVisual(session);
    if(mode!=='visual' && !session.scene && !session.loadingScene && !session.sceneError)start(session);
  }
  function selectZone(zoneId){
    if(!active?.data)return;
    if(zoneId===active.town.id)zoneId=null;
    active.zoneId=zoneId||null;active.building=null;choice.value=zoneId||'';
    const url=new URL(location.href);
    setProjectPath(url,active.town,zoneId?{id:zoneId}:null);
    history.replaceState(history.state,'',url);
    active.towerId=null;active.spaceId=null;active.layoutFrame=null;
    if(associationView(active)){updateScene();renderMode();}
    else{active.scene?.selectZone(active.zoneId);drawDetails();}
  }
  function updateScene(){
    const session=active;
    if(!session?.createScene||session.mode==='visual')return;
    const view=associationView(session);
    const basePlacement=session.placement==='association'?session.fallbackPlacement:session.placement;
    const key=view?[view.layout.zone_id,view.frame].join('/'):'map/'+basePlacement;
    if(key===session.sceneKey && session.scene)return;
    const camera=!view&&session.sceneKey?.startsWith('map/')?session.scene?.getCamera():null;
    session.scene?.destroy();session.scene=null;
    session.sceneKey=key;session.sceneError=null;
    try{
      session.data.simulation=view?null:session.simulate?.(basePlacement);
      session.scene=session.createScene(view);
      session.scene.setMode(session.mode);
      if(camera)session.scene.restoreCamera(camera);
      else if(!view && session.mode==='plan' && session.zoneId && basePlacement!=='town')session.scene.focusZone(session.zoneId);
    }catch(error){session.sceneError=error;}
  }
  async function loadVisual(session){
    session.loadingVisual=true;
    try{
      const key=session.visualKey;
      const catalog=await fetchJson(new URL(manifest.files[key],base),session.controller.signal,config.hashes[key]);
      if(key==='current_site_sources'){
        session.catalog={current_view:catalog[session.town.id],views:[]};
      }else{
        if(catalog.town_id!==session.town.id || !catalog.views?.some(v=>v.image))throw Error('조감도 자료를 확인해 주세요.');
        session.catalog=catalog;
      }
    }catch(error){session.visualError=error;}
    finally{
      session.loadingVisual=false;
      if(active===session)renderMode();
    }
  }
  async function start(session){
    session.loadingScene=true;
    const signal=session.controller.signal,town=session.town;
    try{
      const fetchInput=key=>fetchJson(new URL(manifest.files[key],base),signal,config.hashes[key]);
      const indexUrl=new URL(manifest.files.buildings,base),planUrl=new URL(manifest.files.pilot_plans,base);
      const inputsForTown=config.simulation_inputs?.[town.id];
      const [index,planBook,{createPilotScene},expanded,pilotAssociations]=await Promise.all([fetchJson(indexUrl,signal,config.hashes.buildings),
        session.hasPlan && !inputsForTown?.path?fetchJson(planUrl,signal,config.hashes.pilot_plans):null,import('./pilot-scene.mjs?v=208c3fc8754e'),
        inputsForTown?.path?fetchJson(new URL(inputsForTown.path,base),signal,inputsForTown.sha256):null,
        inputsForTown?.association_path?fetchJson(new URL(inputsForTown.association_path,base),signal,inputsForTown.association_sha256):null]);
      if(expanded && expanded.town_id!==town.id)throw Error('예상 배치의 대상지 ID가 다릅니다.');
      const entry=index.towns[town.id],plans=expanded??planBook?.towns[town.id];
      async function fetchDetails(){
        const book=await fetchInput(session.detailKey);
        if(book.town_id!==town.id)throw Error('건물 상세 자료 대상지 불일치');
        if(!book.record_files)return book;
        const parts=await Promise.all(book.record_files.map(file=>fetchJson(new URL(file.path,indexUrl),signal,file.sha256)));
        const records={};
        for(const part of parts){
          if(part.town_id!==town.id)throw Error('분할 건물 자료 대상지 불일치');
          Object.assign(records,part.records);
        }
        if(Object.keys(records).length!==entry.stats.total)throw Error('분할 건물 상세 자료 누락');
        return {...book,records};
      }
      const [chunks,registry,heights,heightReview,registryHeights]=await Promise.all([
        Promise.all(entry.files.map(file=>fetchJson(new URL(file.path,indexUrl),signal,file.sha256))),
        session.detailKey?fetchDetails().catch(()=>null):null,
        session.heightsKey?fetchInput(session.heightsKey).catch(()=>null):null,
        config.height_review_town_ids?.includes(town.id)?fetchInput('building_height_review'):null,
        config.registry_height_town_ids?.includes(town.id)?fetchInput('registry_heights'):null]);
      if(active!==session)return;
      const features=mergeBuildingDetails(chunks.flatMap(chunk=>chunk.features),registry,heights,heightReview,registryHeights,manifest.snapshot_date);
      const zoneMap=new Map((groups.get(town.id)??[]).map(z=>[z.id,z]));
      const outline=boundaries.features.find(f=>f.properties.entity_id===town.id);
      const areas=boundaries.features.filter(f=>zoneMap.has(f.properties.entity_id)).map(f=>{
        const z=zoneMap.get(f.properties.entity_id),record=plans?.zones[z.id];
        const label=[planValue(record,'floors'),planValue(record,'height_m')].filter(v=>v!=='미확인').join(' · ');
        return {...f,properties:{...f.properties,name:z.name,label:z.drawing_code??z.name,plan_label:label||'층수·높이 미확인'}};
      });
      const mappedZones=new Set(areas.map(f=>f.properties.entity_id));
      let design=null,publicSpace=null,designError=null;
      const layouts=expanded?.association_layouts??pilotAssociations?.layouts??[];
      let placements=[];
      if(expanded){
        publicSpace=expanded.public_space??null;
        placements=Object.keys(expanded.modes);
        session.simulate=key=>expanded.modes[key];
      }else if(session.canSimulate){
        const modelAreas=areas.filter(a=>inputsForTown.zone_ids.includes(a.properties.entity_id));
        const [module,inputs]=await Promise.all([import('./pilot-simulation.mjs?v=208c3fc8754e'),
          Promise.all([inputsForTown.design,inputsForTown.public_space,inputsForTown.layout].map(key=>key?fetchInput(key):null)).catch(error=>{designError=error;return null;})]);
        if(active!==session)return;
        const layout=inputs?.[2];
        design=inputs?.[0];publicSpace=inputs?.[1];
        placements=design?['design','spaced']:['spaced'];
        const cache=new Map();
        session.simulate=key=>{
          if(!cache.has(key))cache.set(key,module.generateSimulation(modelAreas,zoneMap,plans,{design:key==='design'?design:null,program:design,publicSpace,layout}));
          return cache.get(key);
        };
      }
      session.fallbackPlacement=['zones','design','town','spaced'].find(k=>placements.includes(k));
      if(layouts.length)placements.unshift('association');
      if(!placements.includes(session.placement))session.placement=session.fallbackPlacement;
      session.data={zoneMap,mappedZones,layouts,placements,plans,simulation:null,expanded,design,publicSpace,designError,registry,heights,heightReview,byId:new Map(features.map(f=>[f.properties.id,f])),summary:buildingSummary(features),
        asOf:entry.source_as_of??index.source_as_of,sourceUrl:entry.source_url??index.source_url,boundary:outline?.properties};
      const sceneOptions={buildings:collection(features),town:outline,zones:collection(areas),publicSpace,existingDetail:Boolean(session.detailKey),
        partialPlan:Boolean(expanded),...(session.canSimulate?{initialBearing:18,initialPitch:42}:{}),
        onSelect:({kind,id})=>{
          if(active!==session)return;
          if(dialog.classList.contains('is-expanded'))showInfo(true);
          if(kind==='zone')selectZone(id);
          else if(kind==='tower'){session.towerId=id;session.spaceId=null;drawDetails();}
          else if(kind==='space'){session.spaceId=id;session.towerId=null;drawDetails();}
          else if(kind==='building'){session.building=session.data.byId.get(id);drawDetails();}
        }};
      session.createScene=view=>createPilotScene(sceneBox,{...sceneOptions,
        ...(view?{associationLayout:view.layout,drawingFrame:view.frame==='drawing',initialBearing:0,partialPlan:true}:
          {simulation:session.data.simulation&&collection(session.data.simulation.features)}),selectedZoneId:session.zoneId});
      updateScene();
    }catch(error){
      if(signal.aborted || session!==active)return;
      session.sceneError=error;
    }finally{
      session.loadingScene=false;
      if(active===session && session.mode!=='visual')renderMode();
    }
  }
  function close(){
    if(!active)return;
    exitExpanded();
    active.controller.abort();active.scene?.destroy();active=null;
    dialog.close();sceneBox.replaceChildren();inspector.replaceChildren();choice.replaceChildren();figure.replaceChildren();dialog.dataset.ready='false';
    reference.querySelector('div').replaceChildren();
    delete reference.dataset.image;
    delete choice.dataset.kind;
  }
  function open(townId,zoneId,push=true,initialMode=null){
    if(!supports(townId) || active)return;
    const url=new URL(location.href),requested=push?initialMode:url.searchParams.get('mode');
    const layoutChoice=url.searchParams.get('layout');
    url.searchParams.delete('view');url.searchParams.delete('mode');url.searchParams.delete('layout');
    const hasIllustration=Boolean(config.visuals?.[townId]),canSimulate=config.simulation_town_ids?.includes(townId);
    const visualKey=config.visuals?.[townId]??(manifest.files.current_site_sources?'current_site_sources':null);
    const hasPlan=(config.plan_town_ids??config.town_ids).includes(townId);
    const mode=requested==='after' && hasPlan?'plan':requested==='visual' && hasIllustration?'visual':'current';
    const detailKey=config.current_details?.[townId];
    const session={town:townById.get(townId),zoneId,hasPlan,canSimulate,visualKey,detailKey,heightsKey:config.current_heights?.[townId],currentStyle:detailKey?'exterior':'age',
      placement:preferredPlacement(config.simulation_inputs?.[townId],zoneId,!push&&layoutChoice,townId),explicitPlacement:!push&&layoutChoice,
      controller:new AbortController(),background:url.href};
    if(push){url.searchParams.set('view','3d');history.pushState({pilotViewer:true},'',url);}
    active=session;
    reference.open=window.matchMedia('(min-width: 800px)').matches;
    get('pilot-title').textContent=session.town.name;get('pilot-district').textContent=session.town.district+' · 3D 보기';
    modes.find(b=>b.dataset.pilotMode==='visual').hidden=!hasIllustration;
    const planButton=modes.find(b=>b.dataset.pilotMode==='plan');
    planButton.hidden=!hasPlan;planButton.textContent=canSimulate?'건축 후 3D':'사업 계획';
    planButton.parentElement.hidden=!hasPlan && !hasIllustration;
    dialog.showModal();changeMode(mode);
  }
  function back(){
    if(!active || active.closing)return;
    if(history.state?.pilotViewer){active.closing=true;history.back();return;}
    history.replaceState(null,'',active.background);close();
  }
  function fromUrl(current){
    if(new URL(location.href).searchParams.get('view')!=='3d' || !supports(current.townId))return false;
    open(current.townId,current.zoneId,false);return true;
  }
  function restore(current){
    if(active){const same=active.background===location.href;close();return same;}
    const params=projectParams(new URL(location.href));
    return params.get('town')===current.townId && params.get('zone')===(current.zoneId??null) && fromUrl(current);
  }
  get('pilot-back').onclick=back;
  dialog.addEventListener('cancel',event=>{
    event.preventDefault();
    if(dialog.classList.contains('is-expanded'))exitExpanded();else back();
  });
  currentSwitch.onclick=event=>{
    const style=event.target.closest('button')?.dataset.currentStyle;
    if(!style||!active?.scene)return;
    active.currentStyle=style;renderMode();
  };
  choice.onchange=()=>{
    selectZone(choice.value);
    if(active?.scene && !associationView(active) && (active.mode==='current' || active.canSimulate && active.mode==='plan')){
      if(choice.value)active.scene?.focusZone(choice.value);else active.scene?.reset();
    }
  };
  function selectPlacement(next){
    const session=active;
    if(!next || !session?.scene || next===session.placement)return;
    session.placement=next;session.explicitPlacement=next;session.towerId=null;session.spaceId=null;session.layoutFrame=null;
    const url=new URL(location.href);
    url.searchParams.set('layout',next);
    if(next==='town')session.zoneId=null;
    if(next==='association'&&session.zoneId){
      const scope=associationView(session).layout.zone_id;
      if(scope!==session.town.id)session.zoneId=scope;
    }
    setProjectPath(url,session.town,session.zoneId?{id:session.zoneId}:null);
    history.replaceState(history.state,'',url);
    updateScene();renderMode();
  }
  placement.onclick=event=>selectPlacement(event.target.closest('button')?.dataset.placement);
  for(const button of modes)button.onclick=()=>changeMode(button.dataset.pilotMode);
  get('pilot-tools').onclick=event=>{
    const action=event.target.closest('[data-camera]')?.dataset.camera,scene=active?.scene;
    if(!scene || !action)return;
    if(action==='reset')scene.reset();
    else if(action==='in'||action==='out')scene.zoom(action==='in'?1:-1);
    else scene.rotate(action==='left'?-20:20);
  };
  retry.onclick=()=>{
    if(!active)return;
    if(active.mode==='visual')active.visualError=null;
    else active.sceneError=null;
    changeMode(active.mode);
  };
  return {open,supports,fromUrl,restore};
}
