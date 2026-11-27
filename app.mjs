import {projectUrl,renderProjectDetail,showUnplacedProgram,procedureScheduleLine} from './detail-view.mjs?v=f09d43984ad6';
import {durationSamples,elapsedMonths,formatValue,projectMetadata,contractorProcedure,procedureParticipants,procedureSchedule} from './detail-format.mjs?v=f09d43984ad6';
import {projectParams,setProjectPath} from './project-url.mjs?v=f09d43984ad6';
export {elapsedMonths};
import {loadMaps,createProjectMap} from './map-engine.mjs?v=f09d43984ad6';
export {showReferencePin} from './map-engine.mjs?v=f09d43984ad6';
import {loadNews,matchNews,newsCard,sourceLabels} from './news.mjs?v=f09d43984ad6';
import {searchProjects,managementFilters,progressFilters,recentProjectDates,contractorName,associationReviewKey} from './project-search.mjs?v=f09d43984ad6';
import {mountAddressLookup} from './address-reference.mjs?v=f09d43984ad6';
import {hasPublicLayout,mountPilotViewer} from './pilot-viewer.mjs?v=f09d43984ad6';
import {metricGlossary,translateStage} from './glossary-translator.mjs?v=f09d43984ad6';
import {decorativeEmoji,toolIcon} from './ui-icons.mjs?v=f09d43984ad6';
const mobileMapQuery='(max-width: 768px)';
function initialSheetHeight(selection,hasFilters,mobile){
  if(!mobile)return 1;
  if(selection.zoneId)return 1;
  if(selection.townId || selection.cancellation)return 0;
  return hasFilters?1:0;
}
function sheetLabel(selection,height,count){
  if(selection.townId || selection.zoneId || selection.cancellation)return height?'지도 보기':'상세 보기';
  return count?'대상지 목록 · '+count+'건':'대상지 목록';
}
function displaySheetHeight(height){
  const explorer=document.getElementById('explorer'),size=document.getElementById('sheet-size');
  explorer.classList.toggle('tall',height===2);
  explorer.classList.toggle('collapsed',height===0);
  document.getElementById('sheet-toggle').setAttribute('aria-expanded',String(height>0));
  size.setAttribute('aria-pressed',String(height===2));
  size.textContent=height===2?'기본 높이':'크게 보기';
}
export function filterTowns(towns, query, district) {
  return [...new Set(searchProjects(towns,new Map(),[],{query,district}).map(row=>row.town))];
}
export function resolveSelection(search, towns, zones) {
  const params=new URLSearchParams(search);
  const requestedTown=params.get('town');
  const zone=zones.get(params.get('zone'));
  const townId=towns.has(requestedTown) ? requestedTown :
    (!requestedTown && towns.has(zone?.town_id) ? zone.town_id : null);
  return {townId,zoneId:townId && zone?.town_id===townId ? zone.id : null};
}
export function pointLatLng(point) {
  if (point?.type!=='Point' || !Array.isArray(point.coordinates)) return null;
  const [lon,lat]=point.coordinates;
  return Number.isFinite(lon) && Number.isFinite(lat) && Math.abs(lat)<=90 && Math.abs(lon)<=180 ? [lat,lon] : null;
}
export async function loadSnapshot(base, get=fetch) {
  const manifestUrl=new URL('./moatown-data/latest.json',base);
  async function json(url){
    const response=await get(url,{cache:'no-cache'});
    if(!response.ok) throw Error(`HTTP ${response.status} ${url.pathname}`);
    return response.json();
  }
  const manifest=await json(manifestUrl);
  const [towns,zones,boundaries,excluded]=await Promise.all(['towns','zones','boundaries','excluded'].map(key=>{
    if(!manifest.files[key])return [];
    const url=new URL(manifest.files[key],manifestUrl),hash=manifest.pilot_3d?.hashes?.[key];
    if(hash)url.searchParams.set('v',hash.slice(0,12));
    return json(url);
  }));
  return {manifest,towns,zones,boundaries,excluded};
}

const el=(tag,text,cls)=>{
  const out=document.createElement(tag);
  if(text!==undefined) out.textContent=text;
  if(cls) out.className=cls;
  return out;
};
const unknown='미확인';
const shown=v=>v===null || v===undefined || v==='' ? unknown : String(v);

function sourceLink(url,label='출처') {
  if(!url) return null;
  try { if(new URL(url).protocol!=='https:') return null; } catch { return null; }
  const link=el('a',label,'source-link');
  link.href=url; link.target='_blank'; link.rel='noopener noreferrer';link.append(toolIcon('external'));return link;
}
const displayDate=value=>formatValue(value,'date');
function showContractorMode(mode){
  document.getElementById('contractor-tools').hidden=!mode;
  document.getElementById('contractor-companies').hidden=mode==='pending';
  for(const button of document.querySelectorAll('#contractor-modes button')){
    button.setAttribute('aria-pressed',String(button.value===(mode==='pending'?'pending':'all')));
  }
}
const stages=[
  {label:'주민 찬반 재조사',short:'주민 찬반 재조사',ink:'#765341',fill:'#daba98',shape:'circle'},
  {label:'동의서 징구 예정',short:'동의서 징구 예정',ink:'#705e83',fill:'#cfc1de',shape:'circle'},
  {label:'조합창립총회 완료',short:'창립총회 완료',ink:'#593e96',fill:'#ab97d0',shape:'circle'},
  {label:'조합설립변경인가',short:'조합 변경인가',ink:'#573a88',fill:'#aa8cca',shape:'circle'},
  {label:'사업유형 검토 중',short:'방식 검토 중',ink:'#545d6e',fill:'#b3bcc9',shape:'circle'},
  {label:'조합설립 동의서 검인 전',short:'동의서 검인 전',ink:'#655483',fill:'#c4b7d1',shape:'circle'},
  {label:'주민동의 확보 중',short:'주민동의 확보',ink:'#67527d',fill:'#c9b5cd',shape:'circle'},
  {label:'조합설립인가 전 주민공람',short:'조합인가 전 공람',ink:'#634395',fill:'#ad93c9',shape:'circle'},
  {label:'조합설립 변경 추진 중',short:'조합 변경 추진',ink:'#59468a',fill:'#ab90ce',shape:'circle'},
  {label:'통합심의 신청',short:'통합심의 신청',ink:'#845820',fill:'#e9c08a',shape:'diamond'},
  {label:'동의서 징구',short:'동의서 징구',ink:'#66547b',fill:'#baabcd',shape:'circle'},
  {label:'조합설립인가 반려',short:'조합인가 반려',ink:'#924f6a',fill:'#d89aaf',shape:'diamond'},
  {label:'조합설립인가 취소',short:'조합인가 취소',ink:'#973952',fill:'#db9daa',shape:'diamond'},
  {label:'사업시행자 지정',short:'시행자 지정',ink:'#4a618e',fill:'#94aacf',shape:'circle'},
  {label:'조합설립 진행 중',short:'조합설립 중',ink:'#6746a3',fill:'#aa8bd9',shape:'circle'},
  {label:'조합설립인가',short:'조합설립인가',ink:'#523394',fill:'#9572ce',shape:'circle'},
  {label:'건축심의',short:'건축심의',ink:'#87582a',fill:'#e8bd87',shape:'diamond'},
  {label:'통합심의 완료',short:'통합심의 완료',ink:'#915421',fill:'#d5a369',shape:'diamond'},
  {label:'사업시행계획인가 진행 중',short:'사업인가 진행 중',ink:'#995117',fill:'#edac56',shape:'diamond'},
  {label:'사업시행계획인가',short:'사업인가 완료',ink:'#265d99',fill:'#80a9dd',shape:'triangle'},
  {label:'착공',short:'착공',ink:'#006e62',fill:'#4bb8a1',shape:'square'},
  {label:'철거신고',short:'철거신고',ink:'#286b78',fill:'#83bbc6',shape:'triangle'},
  {label:'사업시행계획 폐지',short:'시행계획 폐지',ink:'#98463e',fill:'#cf938b',shape:'square'},
  {label:'미확인',short:'미확인',ink:'#586474',fill:'#a4adb8',shape:'ring'}
].map(stage=>({...stage,description:translateStage(stage.label).detail}));
export function zoneStage(value){
  return stages.find(stage=>stage.label===value) ?? stages.at(-1);
}
function stageBadge(value,short=false){
  const stage=zoneStage(value);
  const badge=el('span',value==null?'확인 중':short?stage.short:shown(value),'stage-badge');
  badge.dataset.shape=stage.shape;
  badge.style.setProperty('--stage-ink',stage.ink);
  const term=translateStage(value);
  if(term){
    badge.title=term.summary;
    badge.classList.add('has-term-icon');
    badge.prepend(decorativeEmoji(term.emoji));
  }
  return badge;
}
export function planIntervals(towns){
  const months=new Map();
  for(const town of towns){
    const notices=town.management_plan_notices;
    if(notices?.length!==1 || notices[0].notice_kind==='변경' || !town.selected_date)continue;
    const duration=elapsedMonths(town.selected_date.slice(0,7),notices[0].notice_date?.slice(0,7));
    if(duration!==null)months.set(town.id,duration);
  }
  const mean=months.size?[...months.values()].reduce((a,b)=>a+b,0)/months.size:null;
  return {months,mean};
}

export function groupSubAreas(towns,zones){
  const byId=new Map(zones.map(z=>[z.id,z]));
  const groups=new Map(towns.map(t=>[t.id,new Set((t.sub_areas??[]).map(id=>byId.get(id)).filter(z=>z?.town_id===t.id))]));
  for(const zone of zones)groups.get(zone.town_id)?.add(zone);
  return new Map([...groups].map(([id,children])=>[id,[...children]]));
}

export function mount({manifest,towns,zones,boundaries,excluded=[]},sdk,mapSignal){
  const get=id=>document.getElementById(id);
  const list=get('town-list'),detail=get('town-detail'),search=get('search-input'),district=get('district-filter');
  const recentButton=get('recent-filter');
  const awardButton=get('contractor-toggle'),companySelect=get('contractor-company');
  let contractor='';
  const explorer=get('explorer'),sheet=get('sheet-toggle'),mapStatus=get('map-status');
  const mobile=matchMedia(mobileMapQuery);
  let unplacedPrograms;
  function loadUnplacedPrograms(){
    const path=manifest.files.unplaced_programs;
    if(!path)return Promise.resolve({});
    const url=new URL('./moatown-data/'+path,document.baseURI);
    url.searchParams.set('v',manifest.pilot_3d.hashes.unplaced_programs.slice(0,12));
    return unplacedPrograms??=fetch(url).then(response=>{
      if(!response.ok)throw Error('계획 자료를 불러올 수 없습니다.');
      return response.json();
    }).catch(()=>{unplacedPrograms=null;return {};});
  }
  const mapGuides=[...document.querySelectorAll('details.legend,details.stage-filters')];
  document.addEventListener('click',event=>{
    for(const guide of mapGuides)if(guide.open && !guide.contains(event.target))guide.open=false;
  });
  document.addEventListener('keydown',event=>{
    if(event.key!=='Escape')return;
    const guide=mapGuides.find(item=>item.open);
    if(guide){guide.open=false;guide.querySelector('summary').focus();}
  });
  const townById=new Map(towns.map(t=>[t.id,t]));
  const cancellations=new Map(excluded.map(r=>[r.address_raw,{
    ...r,name:r.name_raw,address:r.address_raw,management_plan_stage:'선정 취소',risk_info:{is_canceled:true},
    timeline:[{stage:'대상지 선정',date:r.selected_date},{stage:'선정 취소',date:r.cancellation_date,source_url:r.source_url}],
    sources:[r.source_url],official_links:[{title:'서울시 대상지 취소현황',url:r.source_url}]
  }]));
  const zoneById=new Map(zones.map(z=>[z.id,z]));
  const planStats=planIntervals(towns);
  planStats.samples=durationSamples(towns,zones,manifest.snapshot_date);
  let newsItems=[];
  const newsCounts=new Map();
  get('map-totals').textContent=new Set(towns.map(town=>town.district)).size+'개 자치구 · 선정 대상지 '+towns.length+'곳';
  const groups=groupSubAreas(towns,zones);
  function awardName(row){return contractorName((row.association??row.zone)?.selected_contractor);}
  const allCompanies=new Set([...zones,...[...towns,...zones].flatMap(r=>r.contractor_projects??[])].map(r=>contractorName(r.selected_contractor)).filter(Boolean));
  const pilot=mountPilotViewer({manifest,boundaries,townById,groups});
  const calendar=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'});
  let recentOnly=false,recentDay=calendar.format(Date.now());
  let recentDates=recentProjectDates(towns,groups,excluded,recentDay);
  const districtCounts=new Map();
  for(const town of towns) districtCounts.set(town.district,(districtCounts.get(town.district) ?? 0)+1);
  const districtStages=new Map();
  for(const zone of zones){
    const region=townById.get(zone.town_id)?.district;
    if(!region)continue;
    if(!districtStages.has(region))districtStages.set(region,new Map(stages.map(stage=>[stage,0])));
    const totals=districtStages.get(region),stage=zoneStage(zone.stage);
    totals.set(stage,(totals.get(stage) ?? 0)+1);
  }
  for(const stage of stages){

    const item=el('div');
    item.append(stageBadge(stage.label),el('span',translateStage(stage.label).summary));
    get('stage-definitions').append(item);
  }
  district.replaceChildren(new Option('서울 전체',''));
  for(const name of [...new Set([...districtCounts.keys(),...excluded.map(x=>x.district)])].sort((a,b)=>a.localeCompare(b,'ko'))){
    district.append(new Option(name,name));
  }
  const boundaryProps=new Map(boundaries.features.map(({properties:p})=>[p.entity_id,p]));
  let current,rows=[],visible=new Set(),visibleZones=new Set(),townHits=new Set(),map;
  const chosen={plan:'',progress:''};
  const choices={plan:managementFilters,progress:progressFilters};
  for(const [group,options] of Object.entries(choices)){
    get(group+'-chips').replaceChildren();
    for(const [key,label,short] of [['','전체'],...options]){
      const button=el('button',short ?? label);
      button.type='button';button.dataset.group=group;button.value=key;
      if(group==='progress' && key)button.replaceChildren(stageBadge(label,true));
      button.addEventListener('click',()=>{
        chosen[group]=key;
        if(group==='plan' && key==='canceled'){chosen.progress='';contractor='';}
        if(group==='progress' && key && chosen.plan==='canceled')chosen.plan='';
        updateFilters(false);
      });
      get(group+'-chips').append(button);
    }
  }
  const results=(company=contractor)=>searchProjects(towns,groups,excluded,{query:search.value,district:district.value,...chosen,contractor:company,recentDates:recentOnly?recentDates:null});
  const filtered=()=>Boolean(search.value.trim() || district.value || chosen.plan || chosen.progress || recentOnly || contractor);
  function readUrl(){
    const params=projectParams(new URL(location.href));
    recentOnly=params.get('recent')==='1';
    const company=contractorName(params.get('contractor'));
    contractor=company==='all'||company==='pending'||allCompanies.has(company)?company:'';
    search.value=params.get('q') ?? '';
    const region=params.get('district');
    district.value=region ?? '';
    for(const [key,options] of Object.entries(choices)){
      const value=params.get(key);
      chosen[key]=options.some(([code])=>code===value)?value:'';
    }
    if(chosen.plan==='canceled'){chosen.progress='';contractor='';}
    current=resolveSelection(params,townById,zoneById);
    const award=params.get('award');
    const zone=zoneById.get(current.zoneId);
    if(zone?.selected_contractor && (award==='1' || award==='procedure' || award && award===zone.project_name)){
      current.award='1';
      if(contractor==='pending')contractor='all';
    }
    else if(award==='procedure' && contractorProcedure(zone))current.award=award;
    else if((zone??townById.get(current.townId))?.contractor_projects?.some(p=>p.project_name===award))current.award=award;
    else if(!zone && award && current.townId){
      const matches=(groups.get(current.townId)??[]).filter(child=>
        (child.selected_contractor && child.project_name===award) || child.contractor_projects?.some(p=>p.project_name===award));
      if(matches.length===1){
        const child=matches[0];
        current.zoneId=child.id;
        current.award=child.selected_contractor && child.project_name===award?'1':award;
      }
    }
    if(!current.townId && cancellations.has(params.get('cancellation'))){
      current.cancellation=params.get('cancellation');chosen.plan='canceled';chosen.progress='';contractor='';
    }
    if(current.townId && !results().some(row=>row.town?.id===current.townId)){
      search.value='';district.value='';chosen.plan='';chosen.progress='';recentOnly=false;contractor='';
    }
  }
  readUrl();
  if(current.townId && location.pathname==='/'){
    const url=setProjectPath(new URL(location.href),townById.get(current.townId),zoneById.get(current.zoneId));
    history.replaceState(history.state,'',url);
  }
  function writeUrl(replace=false){
    const url=setProjectPath(new URL(location.href),townById.get(current.townId),zoneById.get(current.zoneId));
    url.searchParams.delete('view');
    url.searchParams.delete('mode');
    url.searchParams.delete('layout');
    for(const [key,value] of [['cancellation',current.cancellation],['q',search.value],['district',district.value],['recent',recentOnly?'1':''],['contractor',contractor],['award',current.award],...Object.entries(chosen)]){
      if(value)url.searchParams.set(key,value);else url.searchParams.delete(key);
    }
    if(url.href!==location.href) history[replace?'replaceState':'pushState'](null,'',url);
  }
  const sheetSize=get('sheet-size');
  function setSheetHeight(height){
    displaySheetHeight(height);
    updateSheetLabel();
    if(height && mobile.matches){
      const pane=get('pane-areas');
      const card=pane?.querySelector('[aria-current="true"]');
      if(card && !pane.hidden)pane.scrollTop+=card.getBoundingClientRect().top-pane.getBoundingClientRect().top-8;
    }
  }
  const currentHeight=()=>explorer.classList.contains('collapsed')?0:explorer.classList.contains('tall')?2:1;
  function updateSheetLabel(){
    get('sheet-label').textContent=sheetLabel(current,currentHeight(),rows.length);
  }
  function initialHeight(){
    if(mobile.matches && (current.award || contractor && !current.townId))return 2;
    return initialSheetHeight(current,filtered(),mobile.matches);
  }
  sheetSize.addEventListener('click',()=>setSheetHeight(currentHeight()===2?1:2));
  let dragStart=null,dragged=false;
  explorer.addEventListener('pointerdown',event=>{
    if(!event.isPrimary || event.button!==0)return;
    dragged=false;
    const handle=event.target.closest('.sheet-tools') || (mobile.matches && !currentHeight() && event.target.closest('.project-summary'));
    if(!handle || event.target.closest('button:not(#sheet-toggle),a,input'))return;
    dragStart=event.clientY;event.target.setPointerCapture(event.pointerId);
  });
  explorer.addEventListener('pointercancel',()=>{dragStart=null;dragged=false;});
  explorer.addEventListener('pointerup',event=>{
    if(dragStart===null)return;
    const distance=dragStart-event.clientY;
    dragStart=null;
    if(Math.abs(distance)<24)return;
    dragged=true;setSheetHeight(Math.max(0,Math.min(2,currentHeight()+Math.sign(distance))));
  });
  explorer.addEventListener('click',event=>{
    if(dragged && event.detail){dragged=false;event.preventDefault();event.stopPropagation();}
  },true);
  function toggleSheet(){
    const selected=current.townId || current.cancellation;
    setSheetHeight(currentHeight()?0:selected?2:1);
  }
  sheet.addEventListener('click',toggleSheet);
  explorer.addEventListener('click',event=>{
    if(event.target.matches('.sheet-tools'))toggleSheet();
  });
  setSheetHeight(initialHeight());
  mobile.addEventListener('change',()=>setSheetHeight(initialHeight()));
  function clearAddress(){map?.clearAddress();}
  function fitView(){map?.fit();}
  function renderLayers(){map?.render();}
  mountAddressLookup(townById,boundaries,result=>{
    if(mobile.matches)setSheetHeight(0);
    map?.showAddress(result);
  },()=>Boolean(map));
  function renderList(){
    const pendingMode=contractor==='pending';
    rows=results(pendingMode?'pending':contractor?'all':'');
    awardButton.setAttribute('aria-pressed',String(Boolean(contractor)));
    showContractorMode(contractor);
    get('results-title').textContent=pendingMode?'시공사 선정 절차 확인':contractor?'시공사 선정 완료':'검색 결과';
    if(contractor && !pendingMode){
      const counts=new Map();
      for(const row of rows){const name=awardName(row);counts.set(name,(counts.get(name)??0)+1);}
      if(contractor!=='all' && !counts.has(contractor))counts.set(contractor,0);
      const companies=[...counts].sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0],'ko'));
      companySelect.replaceChildren(new Option('전체 시공사 · '+rows.length+'건','all'),...companies.map(([name,count])=>new Option(name+' · '+count+'건',name)));
      companySelect.value=contractor;
      if(contractor!=='all')rows=rows.filter(row=>awardName(row)===contractor);
    }
    updateSheetLabel();
    recentButton.setAttribute('aria-pressed',String(recentOnly));
    visible=new Set(rows.filter(row=>row.town).map(row=>row.town.id));
    visibleZones=new Set(rows.filter(row=>row.zone).map(row=>row.zone.id));
    townHits=new Set(rows.filter(row=>row.town && (!row.zone || contractor && !row.zone.representative_point && !boundaryProps.has(row.zone.id))).map(row=>row.town.id));
    const canceled=rows.filter(row=>row.excluded).length;
    const townCount=rows.filter(row=>row.town && !row.zone && !row.association).length;
    const associationCount=rows.filter(row=>row.association).length;
    const zoneCount=rows.filter(row=>row.zone && !row.association).length;
    get('result-count').textContent=[townCount && '대상지 '+townCount+'곳',zoneCount && '구역 '+zoneCount+'곳',associationCount && '조합 '+associationCount+'곳',canceled && '취소 이력 '+canceled+'건'].filter(Boolean).join(' · ') || '0건';
    get('clear-filters').hidden=!filtered();
    const active=Object.values(chosen).filter(Boolean).length;
    const group=chosen.progress?'progress':'plan';
    const option=choices[group].find(([key])=>key===chosen[group]);
    get('filter-label').textContent=active===1?(option[2] ?? option[1]):active?'사업 단계 · '+active:'사업 단계';
    for(const button of get('stage-filter-box').querySelectorAll('[data-group]')){
      button.setAttribute('aria-pressed',String(chosen[button.dataset.group]===button.value));
    }
    const fragment=document.createDocumentFragment();
    for(const {town,zone,association,excluded:archived} of rows){
      const date=recentDates.get(association?associationReviewKey(zone??town,association):archived?.address_raw??zone?.id??town?.id);
      const badge=date?el('span','최근 갱신','recent-badge'):null;
      if(badge){
        badge.prepend(decorativeEmoji(metricGlossary.recent.emoji));
        badge.title=displayDate(date)+' · '+metricGlossary.recent.summary+(!zone && !association && town?' (세부구역 포함)':'');
      }
      if(archived){
        const entry=el('article',undefined,'archive-item');
        const button=el('button',archived.name_raw,'archive-detail');
        button.type='button';button.dataset.cancellation=archived.address_raw;
        button.addEventListener('click',()=>select(null,null,archived.address_raw));
        entry.append(button,el('small','대상지 취소 · '+displayDate(archived.cancellation_date)));
        if(badge)entry.append(badge);
        const link=sourceLink(archived.source_url,'취소 원문');if(link)entry.append(link);
        fragment.append(entry);continue;
      }
      const button=el('a',undefined,'town-item');
      const resultUrl=setProjectPath(new URL(location.href),town,zone);
      for(const key of ['award','view','mode','layout','cancellation'])resultUrl.searchParams.delete(key);
      const procedure=association?null:contractorProcedure(zone);
      const award=association?.project_name??(procedure?'procedure':contractor && zone?.selected_contractor?'1':'');
      if(award)resultUrl.searchParams.set('award',award);
      if(contractor)resultUrl.searchParams.set('contractor',contractor);
      button.href=resultUrl.pathname+resultUrl.search;button.dataset.town=town.id;
      if(association)button.dataset.association=association.project_name;
      button.addEventListener('click',event=>{
        if(event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)return;
        event.preventDefault();select(town.id,zone?.id??null,null,award?(zone?'business':'areas'):undefined,award);
      });
      const meta=el('span',undefined,'row-meta');
      meta.append(el('span',town.district,'district-name'));
      const simulation=manifest.pilot_3d?.simulation_inputs?.[town.id];
      const drawing=hasPublicLayout(simulation,town.id,zone?.id);
      if(pilot.supports(town.id))meta.append(el('span',drawing?'공개 배치도 3D':simulation?(zone&&!simulation.zone_ids.includes(zone.id)?'대상지 3D':'건축 후 3D'):'기존 건물 3D','pilot-list-label'));
      if(badge)meta.append(badge);
      if(zone || association){
        if(zone)button.dataset.zone=zone.id;
        meta.append(el('span',town.name));
        if(association && zone)meta.append(el('span',zone.name));
        button.append(el('strong',association?.project_name??zone.name),meta);
        const project=association??zone,company=contractorName(project.selected_contractor);
        if(company){
          const line=el('span',company,'contractor-line');
          line.prepend(el('small','시공사'));button.append(line);
        }
        if(association?.scope_note)button.append(el('small',association.scope_note,'location-note'));
        if(procedure){
          button.append(el('span',procedure.stage,'procedure-stage'));
          for(const text of procedureParticipants(procedure))button.append(el('span',text,'procedure-actors'));
          button.append(procedureScheduleLine(procedure),el('small','자료 확인 '+displayDate(procedure.checked_on),'location-note'));
          const card=el('article',null,'procedure-card');card.append(button);
          for(const proof of procedure.sources){
            const link=sourceLink(proof.url,proof.title);if(link)card.append(link);
          }
          fragment.append(card);continue;
        }
        if(association?.registered_address)button.append(el('small',association.registered_address,'location-note'));
        else if(zone)button.append(stageBadge(zone.stage));
        fragment.append(button);continue;
      }
      if(town.selected_date)meta.append(el('span',displayDate(town.selected_date)+' 선정'));
      const count=groups.get(town.id).length;
      if(count)meta.append(el('span','세부 '+count+'곳'));
      if(town.candidate_status || chosen.plan || search.value.trim())meta.append(el('span',town.management_plan_stage || (town.management_plan_notices?.length?'관리계획 승인고시':town.candidate_status??'관리계획 미확인')));
      const note=el('span',undefined,'row-news');
      note.dataset.newsTown=town.id;
      note.hidden=!newsCounts.has(town.id);
      if(!note.hidden)note.textContent='소식 '+newsCounts.get(town.id);
      meta.append(note);
      button.append(el('strong',town.name),meta);
      const names=[...new Set([...(groups.get(town.id)??[]),...(town.contractor_projects??[])].map(p=>contractorName(p.selected_contractor)).filter(Boolean))];
      if(names.length){
        const line=el('span',names.join(' · '),'contractor-line');
        line.prepend(el('small','개별 사업 시공사'));button.append(line);
      }
      if(!boundaryProps.has(town.id))button.append(el('span',town.representative_point?'대표 위치만 확인':'지도 위치 미확인','location-note'));
      fragment.append(button);
    }
    if(!rows.length){
      const note=el('div',undefined,'empty empty-search');
      const image=el('img');image.src='./assets/empty-search.svg?v=67579da3a801';image.alt='';image.width=112;image.height=70;
      note.append(image,el('strong',pendingMode?'이 조건에서 선정 절차가 확인된 구역이 없어요.':contractor?'이 조건에서 시공사가 확인된 사업이 없어요.':'검색 조건에 맞는 구역이 없어요.'),el('p','다른 검색어를 입력하거나 선택한 조건을 지워 보세요.'));
      const clear=el('button','검색 조건 지우기');
      clear.type='button';clear.addEventListener('click',reset);
      note.append(clear);fragment.append(note);
    }
    list.replaceChildren(fragment);
    list.scrollTop=0;
  }
  let toastTimer;
  async function copyLink(){
    writeUrl(true);
    const url=new URL(location.pathname+location.search+location.hash,projectUrl()).href,toast=get('share-status');
    let copied=false;
    try{await navigator.clipboard.writeText(url);copied=true;}catch{
      const previous=document.activeElement,input=el('textarea');
      input.className='sr-only';input.value=url;document.body.append(input);input.select();
      try{copied=document.execCommand('copy');}catch{}finally{input.remove();previous?.focus({preventScroll:true});}
    }
    clearTimeout(toastTimer);
    toast.textContent=copied?'링크가 복사되었습니다':'링크를 복사할 수 없습니다. 주소창에서 복사해 주세요.';
    toastTimer=setTimeout(()=>{toast.textContent='';},3200);
  }
  function renderPanel(initialTab){
    const town=townById.get(current.townId)??cancellations.get(current.cancellation),zone=zoneById.get(current.zoneId);
    const metadata=projectMetadata(town,zone,manifest.snapshot_date);
    document.title=metadata.title;
    get('heading-project').textContent=town?' · '+town.district+' '+town.name+(zone?' · '+zone.name:''):'';
    document.querySelector('meta[name="description"]').content=metadata.description;
    document.querySelector('meta[property="og:description"]').content=metadata.description;
    document.querySelector('.skip').href=location.pathname+location.search+'#explorer';
    const canonical=projectUrl(town,zone).href;
    document.querySelector('link[rel="canonical"]').href=canonical;
    document.querySelector('meta[property="og:url"]').content=canonical;
    document.querySelector('meta[property="og:title"]').content=document.title;
    get('list-view').hidden=Boolean(town);get('detail-view').hidden=!town;
    get('back-results').hidden=!town;
    updateSheetLabel();
    detail.replaceChildren();
    if(!town)return;
    const query=[district.value,search.value.trim()].filter(Boolean).join(' ');
    const direct=zone && visibleZones.has(zone.id);
    get('back-label').textContent=zone && !direct ? town.name : (query?query+' · ':'')+'검색 결과 '+rows.length+'건';
    const children=groups.get(town.id)??[];
    const simulation=manifest.pilot_3d?.simulation_inputs?.[town.id];
    const association=hasPublicLayout(simulation,town.id,zone?.id);
    renderProjectDetail(detail,{town,zone,children,boundaries:boundaryProps,snapshot:manifest.snapshot_date,cityRule:current.cancellation?null:manifest.seoul_road_permit,
      registryUrl:manifest.source_urls?.official_project_registry,stats:planStats,select:(townId,zoneId,preview)=>select(townId,zoneId,null,preview?undefined:'areas'),
      expandDetail:()=>{if(mobile.matches)setSheetHeight(2);},badge:stageBadge,copyLink,initialTab:initialTab??(current.award?(zone?'business':'areas'):undefined),award:current.award,
      openTownRules:zone?()=>select(town.id,null,null,'business'):null,
      association,openPilot:pilot.supports(town.id)?()=>pilot.open(town.id,zone?.id,true,association?'after':null):null,
      openPlan:simulation && (!zone||association||simulation.zone_ids.includes(zone.id))?
        ()=>pilot.open(town.id,zone?.id,true,'after'):null});
    renderRelatedNews();
    const pane=detail.querySelector('#pane-business'),id=(zone??town).id;
    if(id)loadUnplacedPrograms().then(records=>{
      if(pane?.isConnected && records[id])showUnplacedProgram(pane,records[id]);
    });
  }
  function renderRelatedNews(){
    const section=detail.querySelector('.related-news');
    if(!section)return;
    section.replaceChildren();
    const {townId,zoneId}=current;
    const townItems=townId?matchNews(newsItems,{townId}):[];
    const groups=zoneId?[
      ['이 구역 소식',matchNews(townItems,{townId,zoneId}),{town:townId,zone:zoneId}],
      ['상위 대상지 소식',townItems.filter(item=>item.related_sites.some(s=>s.town_id===townId && !s.zone_id)),{town:townId}]
    ]:[['이 대상지 소식',townItems,{town:townId}]];
    for(const [title,items,params] of groups){
      if(!items.length)continue;
      const head=el('div',undefined,'related-head'),more=el('a','소식 목록 →');
      more.href='./news.html?'+new URLSearchParams(params);
      head.append(el('h3',title),more);section.append(head);
      for(const item of items.slice(0,2))section.append(newsCard(item,{compact:true}));
    }
    if(!section.childElementCount)section.append(el('span','미고시','unverified'));
  }
  function select(townId,zoneId,cancellation=null,initialTab,award=''){
    clearAddress();
    current={townId,zoneId,cancellation,award};
    const preview=mobile.matches && (townId || cancellation) && !initialTab;
    setSheetHeight(preview?0:mobile.matches && (initialTab || contractor && !townId)?2:1);
    if(mobile.matches && (townId || cancellation))search.blur();
    writeUrl();renderPanel(initialTab);renderLayers();fitView();
    const focusTarget=award?detail.querySelector('.award-focus'):zoneId && !preview?detail.querySelector('#pane-areas [aria-current="true"]'):detail.querySelector('h2');
    focusTarget?.focus({preventScroll:true});
  }
  get('back-results').addEventListener('click',()=>{
    const {townId,zoneId,cancellation,award}=current;
    const direct=zoneId && visibleZones.has(zoneId);
    select(zoneId && !direct?townId:null,null,null,zoneId && !direct?'areas':undefined);
    if(cancellation){list.querySelector('[data-cancellation="'+CSS.escape(cancellation)+'"]')?.focus();return;}
    const owner=zoneId?'[data-zone="'+CSS.escape(zoneId)+'"]':'[data-town="'+CSS.escape(townId)+'"]';
    const association=award && list.querySelector(owner+'[data-association="'+CSS.escape(award)+'"]');
    const target=association || (zoneId && !direct?detail:list).querySelector(owner);
    target?.focus();
  });
  function updateFilters(replace=true){
    clearAddress();
    current={townId:null,zoneId:null};
    setSheetHeight(mobile.matches?(contractor?2:filtered()?1:0):1);writeUrl(replace);renderList();renderPanel();renderLayers();fitView();
  }
  function reset(){
    search.value='';district.value='';chosen.plan='';chosen.progress='';recentOnly=false;contractor='';
    get('stage-filter-box').open=false;updateFilters(false);
  }
  search.addEventListener('input',()=>updateFilters());
  search.addEventListener('focus',()=>{
    if(!mobile.matches)return;
    if(current.townId || current.cancellation)select(null,null);
    setSheetHeight(1);
  });
  search.addEventListener('keydown',event=>{
    if(event.key==='Enter' && !event.isComposing && mobile.matches){search.blur();setSheetHeight(1);}
  });
  recentButton.disabled=false;
  awardButton.disabled=false;companySelect.disabled=false;
  for(const button of get('contractor-modes').querySelectorAll('button')){
    button.disabled=false;
    button.addEventListener('click',()=>{contractor=button.value;updateFilters(false);});
  }
  awardButton.addEventListener('click',()=>{
    contractor=contractor?'':'all';
    if(contractor && chosen.plan==='canceled')chosen.plan='';
    updateFilters(false);
  });
  companySelect.addEventListener('change',()=>{contractor=companySelect.value;updateFilters(false);});
  recentButton.addEventListener('click',()=>{recentOnly=!recentOnly;updateFilters(false);});
  function refreshRecentDates(){
    const day=calendar.format(Date.now());
    if(day===recentDay)return;
    recentDay=day;recentDates=recentProjectDates(towns,groups,excluded,day);
    renderList();renderLayers();
  }
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshRecentDates();});
  window.addEventListener('focus',refreshRecentDates);
  const cutoffs=zones.map(zone=>procedureSchedule(contractorProcedure(zone)?.schedule).cutoff).filter(Number.isFinite);
  let scheduleTimer;
  function refreshSchedules(){
    clearTimeout(scheduleTimer);
    const now=Date.now();
    for(const line of document.querySelectorAll('.procedure-schedule[data-cutoff]')){
      line.textContent=line.dataset.schedule+(now>=Number(line.dataset.cutoff)?' · 결과 확인 중':' 예정');
    }
    const next=Math.min(...cutoffs.filter(time=>time>now));
    if(Number.isFinite(next))scheduleTimer=setTimeout(refreshSchedules,Math.min(next-now,2147483647));
  }
  refreshSchedules();
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshSchedules();});
  district.addEventListener('change',()=>updateFilters(false));
  get('clear-filters').addEventListener('click',reset);
  get('stage-filter-box').addEventListener('toggle',()=>{if(mobile.matches && get('stage-filter-box').open)setSheetHeight(2);});
  get('apply-stage').addEventListener('click',()=>{get('stage-filter-box').open=false;if(mobile.matches)setSheetHeight(1);get('stage-filter-box').querySelector('summary').focus();});
  get('reset-map').addEventListener('click',reset);
  window.addEventListener('popstate',()=>{
    if(pilot.restore(current))return;
    readUrl();setSheetHeight(initialHeight());renderList();renderPanel();
    try{
      clearAddress();map?.settings();renderLayers();fitView();
    }catch{
      mapStatus.textContent||='네이버 지도의 이전 화면을 복원할 수 없습니다.';
    }
    pilot.fromUrl(current);
  });
  const date=get('snapshot-date');
  date.dateTime=manifest.snapshot_date;date.textContent=displayDate(manifest.snapshot_date);
  get('coverage-note').textContent=displayDate(manifest.coverage.baseline_as_of)+' 선정 명부와 이후 확인한 변동을 반영했습니다. '+districtCounts.size+'개 자치구의 대상지 '+towns.length+'곳이 수록되어 있습니다.';
  renderList();renderPanel();renderLayers();fitView();
  pilot.fromUrl(current);
  loadNews(document.baseURI).then(({items})=>{
    newsItems=items;
    for(const item of items){
      for(const id of new Set(item.related_sites.map(site=>site.town_id)))newsCounts.set(id,(newsCounts.get(id) ?? 0)+1);
    }
    for(const note of list.querySelectorAll('[data-news-town]')){
      const count=newsCounts.get(note.dataset.newsTown);
      if(count){note.hidden=false;note.textContent='소식 '+count;}
    }
    renderRelatedNews();
    if(!items.length)return;
    const latest=items[0],brief=get('map-brief'),link=el('a',latest.title);
    link.href='./news.html#story-'+latest.id;
    const head=el('div',undefined,'brief-head');
    head.append(el('strong','최근 소식'),el('span',sourceLabels[latest.type]+' · '+displayDate(latest.published_on)));
    brief.append(head,link);brief.hidden=false;
  });
  sdk.then(maps=>{
    if(!maps || mapSignal?.aborted)return;
    mapSignal?.addEventListener('abort',()=>{map=null;},{once:true});
    map=createProjectMap(maps,get('map'),{townById,zoneById,boundaries,districtCounts,districtStages,zoneStage,signal:mapSignal,
      select(townId,zoneId){
        if(!contractor){select(townId,zoneId);return;}
        const projects=rows.filter(row=>row.town?.id===townId && row.association && (row.zone?.id??null)===(zoneId??null));
        const zone=zoneById.get(zoneId);
        const award=projects.length===1?projects[0].association.project_name:zone?.selected_contractor?'1':contractorProcedure(zone)?'procedure':'';
        select(townId,zoneId,null,zoneId?'business':'areas',award);
      },
      selectDistrict(name){search.value='';district.value=name;updateFilters(false);},
      view:()=>({current,rows,visible,visibleZones,townHits,contractor,filtered:filtered()})});
  }).catch(()=>{mapStatus.textContent='네이버 지도를 열 수 없습니다. 검색 결과와 구역 상세는 목록에서 확인하세요.';});
}
function placeMobileControls(){
  const get=id=>document.getElementById(id),mobile=matchMedia(mobileMapQuery);
  const search=get('project-search'),searchInput=get('search-input'),dock=get('map-search-dock');
  const options=get('map-options'),dialog=get('layer-dialog'),address=get('address-open'),back=get('back-results');
  const mapStage=document.querySelector('.map-stage');
  function place(){
    if(dialog.open)dialog.close();
    if(mobile.matches){
      document.querySelector('.sheet-tools').after(search);dock.append(get('layer-open'));
      options.append(address);dialog.append(options);document.querySelector('.sheet-tools').prepend(back);
      searchInput.placeholder='동네, 구역명, 시공사 검색';
    }else{
      document.querySelector('.results-head').before(search);search.querySelector('.filter-row').append(get('layer-open'));mapStage.append(options,address);
      get('detail-view').prepend(back);
      searchInput.placeholder='주소, 구역명, 단계, 시공사';
    }
  }
  mobile.addEventListener('change',place);place();
  get('layer-open').addEventListener('click',()=>dialog.showModal());
  get('layer-close').addEventListener('click',()=>dialog.close());
  options.addEventListener('click',event=>{
    if(dialog.open && event.target.closest('#address-open,#measure,#reset-map,#zoom-in,#zoom-out'))dialog.close();
  });
}
function prepareLoading(){
  const $=id=>document.getElementById(id);
  for(const slot of document.querySelectorAll('[data-tool-icon]'))slot.replaceWith(toolIcon(slot.dataset.toolIcon));
  const params=projectParams(new URL(location.href));
  placeMobileControls();
  $('search-input').value=params.get('q')??'';
  $('recent-filter').setAttribute('aria-pressed',String(params.get('recent')==='1'));
  const contractor=params.get('contractor');
  $('contractor-toggle').setAttribute('aria-pressed',String(Boolean(contractor)));
  showContractorMode(contractor);
  if(contractor && contractor!=='all' && contractor!=='pending')$('contractor-company').add(new Option(contractor,contractor,true,true));
  const region=params.get('district');
  if(region)$('district-filter').add(new Option(region,region,true,true));
  const selected=[];
  for(const [group,options] of [['plan',managementFilters],['progress',progressFilters]]){
    const active=options.find(([key])=>key===params.get(group));
    if(active)selected.push(active[2]??active[1]);
    for(const [key,label,short] of [['','전체'],...options]){
      const button=el('button',short??label);button.disabled=true;
      button.setAttribute('aria-pressed',String(key===(active?.[0]??'')));
      $(group+'-chips').append(button);
    }
  }
  if(selected.length)$('filter-label').textContent=selected.join(' · ');
  const selection={townId:params.get('town'),zoneId:params.get('zone'),cancellation:params.get('cancellation')};
  const isDetail=Boolean(selection.townId || selection.zoneId || selection.cancellation);
  const filtered=region || $('search-input').value.trim() || selected.length || params.get('recent')==='1' || contractor;
  const mobile=matchMedia(mobileMapQuery).matches;
  const height=mobile && (params.has('award') || contractor && !isDetail)?2:initialSheetHeight(selection,filtered,mobile);
  displaySheetHeight(height);
  $('sheet-label').textContent=sheetLabel(selection,height);
  $('back-results').hidden=!isDetail;
  $('detail-view').hidden=!isDetail;$('list-view').hidden=isDetail;
  $('search-input').disabled=$('district-filter').disabled=true;
  const guide=$('guide-dialog');
  $('guide-open').onclick=()=>guide.showModal();$('guide-close').onclick=()=>guide.close();
}
if(typeof document!=='undefined'){
  prepareLoading();
  const mapAccess=new AbortController();
  const sdk=loadMaps(()=>{
    mapAccess.abort();
    for(const button of document.querySelectorAll('[data-map-style],#cadastral,#measure,#zoom-in,#zoom-out'))button.disabled=true;
    document.getElementById('map-status').textContent='네이버 지도 인증을 확인할 수 없습니다. 목록에서 구역을 확인할 수 있습니다.';
  })
    .catch(()=>{document.getElementById('map-status').textContent='네이버 지도 연결에 실패했습니다. 목록에서 구역을 확인할 수 있습니다.';return null;});
  loadSnapshot(document.baseURI).then(data=>mount(data,sdk,mapAccess.signal)).catch(error=>{
    const published=document.querySelector('.published-project');
    document.getElementById('detail-view').hidden=!published;document.getElementById('list-view').hidden=Boolean(published);
    displaySheetHeight(1);document.getElementById('back-results').hidden=true;
    document.getElementById('sheet-label').textContent=sheetLabel({},1);
    document.getElementById('result-count').textContent='불러오기 실패';
    const message=el('div','지도 자료를 불러오지 못했습니다.','empty');
    const retry=el('button','다시 불러오기');retry.type='button';retry.onclick=()=>location.reload();message.append(retry);
    if(published)published.prepend(message);
    else document.getElementById('town-list').replaceChildren(message);
    console.error(error);
  }).finally(()=>{
    document.body.removeAttribute('data-loading');
    for(const id of ['town-list','town-detail'])document.getElementById(id).setAttribute('aria-busy','false');
    for(const id of ['search-input','district-filter'])document.getElementById(id).disabled=false;
  });
}
