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

export function mergeBuildingDetails(features,registry,heights,review){
  return features.map(feature=>{
    const p=feature.properties,details=registry?.records?.[p.id],extra=heights?.records?.[p.id];
    const check=review?.records?.[p.id];
    if(!details && !extra && !check)return feature;
    const properties={...p};
    for(const key of ['use','structure','basement_floors','approval_date','name','roof','roof_collected_on']){
      if(details?.[key]!=null)properties[key]=details[key];
    }
    if(properties.floors==null && Number.isInteger(extra?.floors) && extra.floors>0){
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

function showSimulation(panel,summaries,zoneId,design,publicSpace){
  const entries=zoneId?[summaries[zoneId]].filter(Boolean):Object.values(summaries);
  const total=entries.reduce((sum,s)=>sum+s.blocks,0);
  const occupied=entries.filter(s=>s.blocks);
  const card=el('section',null,'pilot-scenario');
  const s=zoneId && entries[0];
  const title=s?.sourceLayout?'조합 배치도 · 주거동 형태 '+count(total)+'개':
    design?'계획자료 반영 · 주거동 형태 '+count(total)+'개':'35m 간격 배치 · '+count(total)+'동';
  card.append(el('h3',title));
  if(s?.sourceLayout)card.append(el('p',['조합 공개안','최고 '+s.capFloors+'층',Number.isFinite(s.units)?count(s.units)+'세대':null].filter(Boolean).join(' · '),'pilot-plan-program'));
  if(occupied.length){
    const low=Math.min(...occupied.map(s=>s.minFloors)),high=Math.max(...occupied.map(s=>s.maxFloors));
    card.append(el('p',low+'~'+high+'층 · 추정 높이 '+low*3+'~'+high*3+'m'));
  }
  const basis={zone:'구역 심의안',town:'대상지 전체 계획',association:'조합 공개안',default:'자료 미확인 시 기본 가정'};
  if(!design && entries.length && entries.every(s=>Number.isInteger(s.units))){
    card.append(facts([['자료상 계획 세대수',count(entries.reduce((sum,s)=>sum+s.units,0))+'세대'],
      ['배치 예시 환산',count(entries.reduce((sum,s)=>sum+s.simulatedUnits,0))+'세대']]));
  }
  const basisText=s?basis[s.capSource]+' 최고 '+s.capFloors+'층':
    [...new Set(entries.map(entry=>basis[entry.capSource]+' 최고 '+entry.capFloors+'층'))].join(' · ');
  if(design){
    if(!s || s.sourceLayout)card.append(el('p','A3의 주거동 위치와 날개 방향은 조합 배치도에서 읽었습니다. 개별 높이·창호·조경은 시각화용 추정입니다.','pilot-meta'));
    if(!s || s.countRecord)card.append(el('p','A1은 시공사 선정 당시 제시한 동 수를 목표로 배치했습니다.','pilot-meta'));
    if(s && !s.countRecord && !s.sourceLayout)card.append(el('p','계획 세대수와 가로 방향을 반영해 배치한 예시입니다.','pilot-meta'));
    const info=el('details',null,'pilot-evidence');
    info.append(el('summary','배치와 추정 높이의 기준'),el('p','배치 상한 · '+basisText,'pilot-meta'),
      el('p','층수가 없는 동은 자료상 최고 층수의 70~100% 범위에서 높이를 달리하고, 층당 3m를 적용했습니다. 자동 배치에는 32 × 16m 동, 경계 여백 5m, 동간 간격 10m를 가정했습니다.','pilot-meta'));
    if(s?.overlayNote)info.append(el('p',s.overlayNote,'pilot-note'));
    card.append(info);
  }else{
    card.append(el('p','배치 상한 · '+basisText,'pilot-meta'),
      el('p','동 크기 42 × 14m · 경계에서 10m 이상 · 동 사이 35m 이상 · 층당 3m','pilot-meta'),
      el('p','층당 4세대를 가정해 계획 세대수를 동 수의 목표로 사용했습니다. 간격을 지킬 수 있는 동만 표시합니다.','pilot-meta'));
  }
  panel.append(card);
  if(design && zoneId){
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
        source(record.source_url,'계획 원문 ↗'));
      if(record.plan_url)row.append(source(record.plan_url,'조합 배치도 원문 ↗'));
      section.append(row);
    }
    panel.append(section);
  }
  if(publicSpace?.features.length){
    const places=el('details',null,'pilot-evidence');
    places.append(el('summary','고시 도면의 공공시설 '+publicSpace.features.length+'곳'));
    for(const {properties:p} of publicSpace.features){
      const measure=p.width_m?' · 폭 '+p.width_m+'m':p.notice_area_m2?' · '+count(p.notice_area_m2)+'㎡':'';
      places.append(source(p.source_url,p.name+measure+' ↗'));
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
  const config=manifest.pilot_3d,base=new URL('./moatown-data/',document.baseURI);
  const supports=id=>Boolean(config?.town_ids?.includes(id));
  let active=null;

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
    const supplemental=inside.find(f=>f.properties.map_floor_evidence)??[...data.byId.values()].find(f=>f.properties.map_floor_evidence);
    if(supplemental){
      const example=el('button','지도 층수로 높이를 보강한 건물 보기','pilot-text-button');
      example.type='button';example.onclick=()=>zoomToBuilding(supplemental);coverage.append(example);
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
      return;
    }
    if(!data){
      get('pilot-district').textContent=town.district+' · '+(mode==='plan'?'사업 계획':'현재 건물');
      return;
    }
    get('pilot-district').textContent=town.district+' · '+(mode==='current'?'건물 자료 '+date(data.asOf):'사업 계획');
    if(mode==='plan'){
      const zone=data.zoneMap.get(zoneId);
      if(data.designError)inspector.append(el('p','구역별 계획자료를 불러오지 못해 35m 간격 예시를 표시합니다.','pilot-note'));
      if(data.simulation)showSimulation(inspector,data.simulation.summaries,zoneId,active.placement==='design' && data.design,data.publicSpace);
      if(data.design && active.placement==='design' && !zone){
        const shortcuts=el('div',null,'pilot-plan-links');
        for(const z of data.zoneMap.values()){
          const s=data.simulation.summaries[z.id];
          if(!s?.sourceLayout && !s?.countRecord)continue;
          const button=el('button',z.name+' · '+(s.sourceLayout?'조합 배치도':'동수 근거')+' ›');
          button.type='button';button.onclick=()=>{selectZone(z.id);active.scene?.focusZone(z.id);};shortcuts.append(button);
        }
        inspector.append(shortcuts);
      }
      if(!(zone && active.placement==='design' && data.design?.zones[zoneId]?.records.length))
        showPlan(inspector,zone?data.plans.zones[zoneId]:data.plans.plan,zone?.name??town.name,Boolean(data.simulation));
      return;
    }
    if(building){
      const p=building.properties;
      const registryRows=active.detailKey?[['주용도',p.use],['구조',p.structure],['대장상 지붕',p.roof]]:[];
      inspector.append(el('h3',p.name||'선택한 건물'),facts([...registryRows,
        ['건물 높이',p.height_m==null?'미확인':count(p.height_m)+'m'],
        ['높이 근거',p.height_review?.decision==='use_registry_height'?'건축물대장 표제부':p.map_floor_evidence?'서울시 지도 층수 × 3m':p.height_source==='official'?'공식 자료':p.height_source==='estimated_from_floors'?'대장 지상층수 × 3m':'미확인'],
        [p.map_floor_evidence?'지도 표기 층수':'지상층수',p.floors==null?'미확인':p.floors+'층'],
        ...(active.detailKey?[['지하층수',p.basement_floors==null?null:p.basement_floors+'층']]:[]),
        p.approval_date?['사용승인일',date(p.approval_date)]:['사용승인연도',p.approval_year==null?'미확인':p.approval_year+'년'],
        ['위치',p.is_inside_town===true?'참고 외곽 내부':p.is_inside_town===false?'주변 150m':'참고 경계 걸침']]));
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
    placement.hidden=notice.hidden||!ready;
    for(const button of placement.querySelectorAll('button')){
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
    choice.parentElement.hidden=visual||Boolean(scene && choice.options.length<=1);
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
    if(mode==='plan')session.building=null;
    session.mode=mode;
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
    active.zoneId=zoneId||null;active.building=null;choice.value=zoneId||'';
    const url=new URL(location.href);
    if(zoneId)url.searchParams.set('zone',zoneId);else url.searchParams.delete('zone');
    history.replaceState(history.state,'',url);
    active.scene?.selectZone(active.zoneId);drawDetails();
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
      const [index,planBook,{createPilotScene}]=await Promise.all([fetchJson(indexUrl,signal,config.hashes.buildings),
        session.hasPlan?fetchJson(planUrl,signal,config.hashes.pilot_plans):null,import('./pilot-scene.mjs?v=eb5517265229')]);
      const entry=index.towns[town.id],plans=planBook?.towns[town.id];
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
      const [chunks,registry,heights,heightReview]=await Promise.all([
        Promise.all(entry.files.map(file=>fetchJson(new URL(file.path,indexUrl),signal,file.sha256))),
        session.detailKey?fetchDetails().catch(()=>null):null,
        session.heightsKey?fetchInput(session.heightsKey).catch(()=>null):null,
        config.height_review_town_ids?.includes(town.id)?fetchInput('building_height_review'):null]);
      if(active!==session)return;
      const features=mergeBuildingDetails(chunks.flatMap(chunk=>chunk.features),registry,heights,heightReview);
      const zoneMap=new Map((groups.get(town.id)??[]).map(z=>[z.id,z]));
      const outline=boundaries.features.find(f=>f.properties.entity_id===town.id);
      const areas=boundaries.features.filter(f=>zoneMap.has(f.properties.entity_id)).map(f=>{
        const z=zoneMap.get(f.properties.entity_id),record=plans?.zones[z.id];
        const label=[planValue(record,'floors'),planValue(record,'height_m')].filter(v=>v!=='미확인').join(' · ');
        return {...f,properties:{...f.properties,name:z.name,label:z.drawing_code??z.name,plan_label:label||'층수·높이 미확인'}};
      });
      const mappedZones=new Set(areas.map(f=>f.properties.entity_id));
      let simulation=null,design=null,publicSpace=null,designError=null;
      if(session.canSimulate){
        const [module,inputs]=await Promise.all([import('./pilot-simulation.mjs?v=eb5517265229'),
          Promise.all(['sinwol_design','sinwol_public_space','sinwol_layout'].map(fetchInput)).catch(error=>{designError=error;return null;})]);
        if(active!==session)return;
        const layout=inputs?.[2];
        design=inputs?.[0];publicSpace=inputs?.[1];
        if(!design)session.placement='spaced';
        const cache=new Map();
        session.simulate=key=>{
          if(!cache.has(key))cache.set(key,module.generateSimulation(areas,zoneMap,plans,{design:key==='design'?design:null,publicSpace,layout}));
          return cache.get(key);
        };
        simulation=session.simulate(session.placement);
      }
      session.data={zoneMap,plans,simulation,design,publicSpace,designError,registry,heights,heightReview,byId:new Map(features.map(f=>[f.properties.id,f])),summary:buildingSummary(features),
        asOf:entry.source_as_of??index.source_as_of,sourceUrl:entry.source_url??index.source_url};
      const sceneOptions={buildings:collection(features),town:outline,zones:collection(areas),publicSpace,existingDetail:Boolean(session.detailKey),
        ...(session.canSimulate?{initialBearing:18,initialPitch:42}:{}),
        onSelect:({kind,id})=>{
          if(active!==session)return;
          if(kind==='zone')selectZone(id);
          else if(kind==='building'){session.building=session.data.byId.get(id);drawDetails();}
        }};
      session.createScene=()=>createPilotScene(sceneBox,{...sceneOptions,simulation:session.data.simulation&&collection(session.data.simulation.features),selectedZoneId:session.zoneId});
      const scene=await session.createScene();
      if(active!==session){scene.destroy();return;}
      session.scene=scene;
      if(session.canSimulate && session.mode==='plan' && session.zoneId){
        scene.setMode('plan');scene.focusZone(session.zoneId);
      }
      choice.replaceChildren(new Option('대상지 전체',''));
      for(const z of [...zoneMap.values()].sort((a,b)=>a.name.localeCompare(b.name,'ko',{numeric:true}))){
        if(mappedZones.has(z.id))choice.add(new Option(z.name,z.id));
        else if(z.id===session.zoneId){
          const option=new Option(z.name+' · 경계 미수록',z.id);
          option.disabled=true;choice.add(option);
        }
      }
      choice.value=session.zoneId??'';
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
    active.controller.abort();active.scene?.destroy();active=null;
    dialog.close();sceneBox.replaceChildren();inspector.replaceChildren();choice.replaceChildren();figure.replaceChildren();dialog.dataset.ready='false';
    reference.querySelector('div').replaceChildren();
    delete reference.dataset.image;
  }
  function open(townId,zoneId,push=true){
    if(!supports(townId) || active)return;
    const url=new URL(location.href),requested=push?null:url.searchParams.get('mode');
    const layoutChoice=url.searchParams.get('layout');
    url.searchParams.delete('view');url.searchParams.delete('mode');url.searchParams.delete('layout');
    const hasIllustration=Boolean(config.visuals?.[townId]),canSimulate=config.simulation_town_ids?.includes(townId);
    const visualKey=config.visuals?.[townId]??(manifest.files.current_site_sources?'current_site_sources':null);
    const hasPlan=(config.plan_town_ids??config.town_ids).includes(townId);
    const mode=requested==='after' && hasPlan?'plan':requested==='visual' && hasIllustration?'visual':'current';
    const detailKey=config.current_details?.[townId];
    const session={town:townById.get(townId),zoneId,hasPlan,canSimulate,visualKey,detailKey,heightsKey:config.current_heights?.[townId],currentStyle:detailKey?'exterior':'age',
      placement:!push && layoutChoice==='spaced'?'spaced':'design',controller:new AbortController(),background:url.href};
    if(push){url.searchParams.set('view','3d');history.pushState({pilotViewer:true},'',url);}
    active=session;
    reference.open=window.matchMedia('(min-width: 800px)').matches;
    get('pilot-title').textContent=session.town.name;get('pilot-district').textContent=session.town.district+' · 3D 보기';
    modes.find(b=>b.dataset.pilotMode==='visual').hidden=!hasIllustration;
    const planButton=modes.find(b=>b.dataset.pilotMode==='plan');
    planButton.hidden=!hasPlan;planButton.textContent=canSimulate?'건축 후 가상 배치':'사업 계획';
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
    const params=new URLSearchParams(location.search);
    return params.get('town')===current.townId && params.get('zone')===(current.zoneId??null) && fromUrl(current);
  }
  get('pilot-back').onclick=back;
  dialog.addEventListener('cancel',event=>{event.preventDefault();back();});
  currentSwitch.onclick=event=>{
    const style=event.target.closest('button')?.dataset.currentStyle;
    if(!style||!active?.scene)return;
    active.currentStyle=style;renderMode();
  };
  choice.onchange=()=>{
    selectZone(choice.value);
    if(active?.scene && (active.mode==='current' || active.canSimulate && active.mode==='plan')){
      if(choice.value)active.scene?.focusZone(choice.value);else active.scene?.reset();
    }
  };
  placement.onclick=async event=>{
    const next=event.target.closest('button')?.dataset.placement,session=active;
    if(!next || !session?.scene || next===session.placement)return;
    const camera=session.scene.getCamera();
    session.placement=next;session.data.simulation=session.simulate(next);
    const url=new URL(location.href);
    if(next==='spaced')url.searchParams.set('layout',next);else url.searchParams.delete('layout');
    history.replaceState(history.state,'',url);
    session.scene.destroy();session.scene=null;session.loadingScene=true;renderMode();
    try{
      const scene=await session.createScene();
      if(active!==session){scene.destroy();return;}
      session.scene=scene;scene.restoreCamera(camera);
    }catch(error){session.sceneError=error;}
    finally{session.loadingScene=false;if(active===session)renderMode();}
  };
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
