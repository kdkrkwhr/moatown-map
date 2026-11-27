import {loadNews,matchNews,newsCard,sourceLabels} from './news.mjs?v=fd958c8cd39e';

const get=id=>document.getElementById(id);
async function catalog(){
  const manifestUrl=new URL('./moatown-data/latest.json',document.baseURI);
  async function read(url){
    const response=await fetch(url,{cache:'no-cache'});
    if(!response.ok)throw Error('HTTP '+response.status);
    return response.json();
  }
  const manifest=await read(manifestUrl);
  return Promise.all(['towns','zones'].map(async key=>{
    const records=await read(new URL(manifest.files[key],manifestUrl));
    return new Map(records.map(record=>[record.id,record]));
  }));
}

const [feed,places]=await Promise.all([loadNews(document.baseURI),catalog().catch(()=>null)]);
const [towns,zones]=places ?? [new Map(),new Map()];
const linkedDistricts=new Set(feed.items.flatMap(item=>item.related_sites.map(site=>towns.get(site.town_id)?.district)).filter(Boolean));
const region=get('news-region'),controls=[...document.querySelectorAll('[data-source]')];
for(const name of [...linkedDistricts].sort((a,b)=>a.localeCompare(b,'ko')))region.add(new Option(name,name));
if(feed.date){
  get('news-date').textContent=feed.date.replaceAll('-','.');get('news-date').dateTime=feed.date;
}else get('news-date').textContent='미확인';
const warnings=feed.failed.map(type=>sourceLabels[type]+'를 불러오지 못했습니다.');
if(!places)warnings.push('관련 대상지 정보를 불러오지 못했습니다.');
if(warnings.length){
  const warning=get('news-warning');warning.hidden=false;warning.append(warnings.join(' ')+' ');
  const retry=document.createElement('button');retry.textContent='다시 불러오기';retry.onclick=()=>location.reload();
  warning.append(retry);
}

function changeFilters(updates){
  const url=new URL(location.href);
  for(const [key,value] of Object.entries(updates)){
    if(value)url.searchParams.set(key,value);else url.searchParams.delete(key);
  }
  url.hash='';
  if(url.href!==location.href)history.pushState(null,'',url);
  render();
}
function render(){
  const params=new URLSearchParams(location.search);
  const type=Object.hasOwn(sourceLabels,params.get('source'))?params.get('source'):'';
  const townId=params.get('town') || '',zoneId=params.get('zone') || '';
  const targetTown=towns.get(townId),targetZone=zones.get(zoneId);
  region.value=Array.from(region.options).some(o=>o.value===params.get('area'))?params.get('area'):'';
  const scope=get('site-scope');scope.hidden=!(townId || zoneId);scope.replaceChildren();
  if(!scope.hidden){
    const label=document.createElement('strong');
    label.textContent=(targetZone?.name ?? targetTown?.name ?? '선택한 대상지')+' 관련 소식';
    const clear=document.createElement('button');clear.textContent='지역 범위 해제 ×';
    clear.onclick=()=>{changeFilters({town:'',zone:''});controls[0].focus();};
    scope.append(label,clear);
  }
  const filtered=matchNews(feed.items,{townId,zoneId,common:region.value==='common',district:region.value==='common'?'':region.value},towns);
  for(const control of controls){
    const source=control.dataset.source;
    control.setAttribute('aria-pressed',String(source===type));
    control.querySelector('b').textContent=source?filtered.filter(item=>item.type===source).length:filtered.length;
  }
  const items=type?filtered.filter(item=>item.type===type):filtered;
  get('news-count').textContent=items.length+'건';
  const list=get('news-list');
  list.replaceChildren(...items.map(item=>newsCard(item,{towns,zones})));
  if(!items.length){
    const empty=document.createElement('p');empty.className='news-empty';
    empty.textContent=feed.failed.length===2?'소식을 표시할 수 없습니다.':'이 조건에 등록된 소식이 없습니다.';
    list.append(empty);
    if(type || region.value || townId || zoneId){
      const clear=document.createElement('button');clear.textContent='전체 소식 보기';
      clear.onclick=()=>{changeFilters({source:'',area:'',town:'',zone:''});controls[0].focus();};empty.append(clear);
    }
  }
}
controls.forEach(button=>button.addEventListener('click',()=>changeFilters({source:button.dataset.source})));
region.addEventListener('change',()=>changeFilters({area:region.value,town:'',zone:''}));
window.addEventListener('popstate',render);
render();
if(location.hash.startsWith('#story-'))document.getElementById(location.hash.slice(1))?.scrollIntoView();
