const collection=features=>({type:'FeatureCollection',features});
const count=value=>value.toLocaleString('ko-KR');
const date=value=>value?value.replaceAll('-','.'):'미확인';
const tierLabels={under_20:'20년 미만','20_to_29':'20~29년','30_plus':'30년 이상',unknown:'연도 미확인'};

export function buildingSummary(features){
  let inside=0,known=0,old=0,crossing=0;
  for(const {properties:p} of features){
    if(p.is_inside_town===null)crossing++;
    if(p.is_inside_town!==true)continue;
    inside++;
    if(p.approval_year==null)continue;
    known++;
    if(p.age_tier==='30_plus')old++;
  }
  return {inside,known,old,crossing,share:known?(old*100/known).toFixed(1)+'%':'산정 불가'};
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
  const config=manifest.pilot_3d,base=new URL('./moatown-data/',document.baseURI);
  const supports=id=>Boolean(config?.town_ids?.includes(id));
  let active=null;

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
      inspector.append(el('h3','선택한 건물'),facts([
        ['건물 높이',p.height_m==null?'미확인':count(p.height_m)+'m'],
        ['높이 근거',p.height_source==='official'?'공식 자료':p.height_source==='estimated_from_floors'?'층수 환산 높이':'미확인'],
        ['지상층수',p.floors==null?'미확인':p.floors+'층'],['사용승인연도',p.approval_year==null?'미확인':p.approval_year+'년'],
        ['위치',p.is_inside_town===true?'참고 외곽 내부':p.is_inside_town===false?'주변 150m':'참고 경계 걸침']]));
      const back=el('button','대상지 통계 보기','pilot-text-button');
      back.type='button';back.onclick=()=>{active.building=null;drawDetails();};inspector.append(back);
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
    reference.hidden=notice.hidden||!active.catalog;
    sceneBox.style.visibility=visual?'hidden':'';
    sceneBox.inert=visual;
    figure.hidden=!visual;
    get('pilot-tools').hidden=visual;
    get('pilot-gestures').hidden=visual;
    choice.parentElement.hidden=visual;
    choice.disabled=!ready;
    for(const button of get('pilot-tools').querySelectorAll('button'))button.disabled=!ready;
    status.hidden=ready;retry.hidden=!error;
    status.querySelector('span').textContent=error?'자료를 열 수 없습니다. '+error.message:visual?'공식 조감도 불러오는 중':'3D 자료 불러오는 중';
    if(!visual)scene?.setMode(mode);
    drawDetails();
  }
  function changeMode(mode){
    const session=active;
    if(!session)return;
    session.mode=mode;
    const url=new URL(location.href);
    if(mode==='current')url.searchParams.delete('mode');
    else url.searchParams.set('mode',mode==='plan'?'after':'visual');
    if(url.href!==location.href)history.replaceState(history.state,'',url);
    renderMode();
    if((mode==='visual'||(mode==='plan' && session.visualKey)) && !session.catalog && !session.loadingVisual && !session.visualError)loadVisual(session);
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
      if(catalog.town_id!==session.town.id || !catalog.views?.some(v=>v.image))throw Error('조감도 자료를 확인해 주세요.');
      session.catalog=catalog;
      if(active===session){
        const view=catalog.views.find(v=>v.image),img=el('img');
        img.src=new URL(view.image,document.baseURI).href;img.alt=view.alt;img.width=view.image_width;img.height=view.image_height;
        reference.querySelector('div').replaceChildren(img,el('p',view.publisher+' · '+date(view.source_as_of)),
          source(view.source_url,'서울시 원문 ↗'),document.createTextNode(' · '),source(view.license_url,'공공누리 제4유형'));
      }
    }catch(error){session.visualError=error;}
    finally{
      session.loadingVisual=false;
      if(active===session && session.mode!=='current')renderMode();
    }
  }
  async function start(session){
    session.loadingScene=true;
    const signal=session.controller.signal,town=session.town;
    try{
      const indexUrl=new URL(manifest.files.buildings,base),planUrl=new URL(manifest.files.pilot_plans,base);
      const [index,planBook,{createPilotScene}]=await Promise.all([fetchJson(indexUrl,signal,config.hashes.buildings),
        fetchJson(planUrl,signal,config.hashes.pilot_plans),import('./pilot-scene.mjs?v=744430b0c9fe')]);
      const entry=index.towns[town.id],plans=planBook.towns[town.id];
      const chunks=await Promise.all(entry.files.map(file=>fetchJson(new URL(file.path,indexUrl),signal,file.sha256)));
      if(active!==session)return;
      const features=chunks.flatMap(chunk=>chunk.features),zoneMap=new Map((groups.get(town.id)??[]).map(z=>[z.id,z]));
      const outline=boundaries.features.find(f=>f.properties.entity_id===town.id);
      const areas=boundaries.features.filter(f=>zoneMap.has(f.properties.entity_id)).map(f=>{
        const z=zoneMap.get(f.properties.entity_id),record=plans.zones[z.id];
        const label=[planValue(record,'floors'),planValue(record,'height_m')].filter(v=>v!=='미확인').join(' · ');
        return {...f,properties:{...f.properties,name:z.name,label:z.drawing_code??z.name,plan_label:label||'층수·높이 미확인'}};
      });
      let simulation=null,design=null,publicSpace=null,designError=null;
      if(session.canSimulate){
        const fetchInput=key=>fetchJson(new URL(manifest.files[key],base),signal,config.hashes[key]);
        const [module,inputs]=await Promise.all([import('./pilot-simulation.mjs?v=744430b0c9fe'),
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
      session.data={zoneMap,plans,simulation,design,publicSpace,designError,byId:new Map(features.map(f=>[f.properties.id,f])),summary:buildingSummary(features),
        asOf:entry.source_as_of??index.source_as_of,sourceUrl:entry.source_url??index.source_url};
      const sceneOptions={buildings:collection(features),town:outline,zones:collection(areas),publicSpace,
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
      for(const z of [...zoneMap.values()].sort((a,b)=>a.name.localeCompare(b.name,'ko',{numeric:true})))choice.add(new Option(z.name,z.id));
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
  }
  function open(townId,zoneId,push=true){
    if(!supports(townId) || active)return;
    const url=new URL(location.href),requested=push?null:url.searchParams.get('mode');
    const layoutChoice=url.searchParams.get('layout');
    url.searchParams.delete('view');url.searchParams.delete('mode');url.searchParams.delete('layout');
    const visualKey=config.visuals?.[townId],canSimulate=config.simulation_town_ids?.includes(townId);
    const mode=requested==='after'?'plan':requested==='visual' && visualKey?'visual':'current';
    const session={town:townById.get(townId),zoneId,canSimulate,visualKey,placement:!push && layoutChoice==='spaced'?'spaced':'design',controller:new AbortController(),background:url.href};
    if(push){url.searchParams.set('view','3d');history.pushState({pilotViewer:true},'',url);}
    active=session;
    reference.open=window.matchMedia('(min-width: 800px)').matches;
    get('pilot-title').textContent=session.town.name;get('pilot-district').textContent=session.town.district+' · 3D 보기';
    modes.find(b=>b.dataset.pilotMode==='visual').hidden=!visualKey;
    modes.find(b=>b.dataset.pilotMode==='plan').textContent=canSimulate?'건축 후 가상 배치':'사업 계획';
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
  choice.onchange=()=>{
    selectZone(choice.value);
    if(active?.canSimulate && active.mode==='plan'){
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
