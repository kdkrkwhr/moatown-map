import {projectUrl} from './project-url.mjs?v=d03b1c2de517';

export const sourceLabels={official:'공식 자료',media:'언론 보도'};

export async function loadNews(base,get=fetch){
  const results=await Promise.allSettled(Object.keys(sourceLabels).map(async type=>{
    const response=await get(new URL('./moatown-data/news/'+type+'.json',base),{cache:'no-cache'});
    if(!response.ok)throw Error('HTTP '+response.status);
    const data=await response.json();
    if(data.source_type!==type || !Array.isArray(data.items))throw Error('자료 형식 오류');
    return {date:data.collected_on,items:data.items.map(item=>({...item,type}))};
  }));
  const items=[],dates=[],failed=[];
  results.forEach((result,i)=>{
    if(result.status==='rejected'){failed.push(Object.keys(sourceLabels)[i]);return;}
    dates.push(result.value.date);items.push(...result.value.items);
  });
  items.sort((a,b)=>b.published_on.localeCompare(a.published_on));
  return {items,failed,date:dates.sort().at(-1)};
}

export function matchNews(items,{type='',district='',townId='',zoneId='',common=false}={},towns=new Map()){
  return items.filter(item=>{
    if(type && item.type!==type || common && item.classification!=='common')return false;
    if(!district && !townId && !zoneId)return true;
    return item.related_sites.some(site=>
      (!townId || site.town_id===townId) && (!zoneId || site.zone_id===zoneId) &&
      (!district || towns.get(site.town_id)?.district===district));
  });
}

function element(tag,text,cls){
  const node=document.createElement(tag);
  if(text!=null)node.textContent=text;
  if(cls)node.className=cls;
  return node;
}

export function newsCard(item,{towns,zones,compact=false}={}){
  const article=element('article',null,compact?'news-card compact':'news-card');
  article.id='story-'+item.id;
  const meta=element('div',null,'story-meta');
  const date=element('time',item.published_on.replaceAll('-','.'));date.dateTime=item.published_on;
  meta.append(element('span',sourceLabels[item.type],'source-tag '+item.type),date);
  if(!compact && item.classification==='common')meta.append(element('span','서울 공통','scope-tag'));
  const heading=element('h3'),link=element('a',item.title);
  if(/^https:\/\//i.test(item.url)){link.href=item.url;link.target='_blank';link.rel='noopener noreferrer';}
  link.append(element('span','↗','outbound'));link.lastChild.setAttribute('aria-hidden','true');
  heading.append(link);
  const credit=[item.source];
  if(!compact && item.notice_number){
    const fullNumber=/고시|공고/.test(item.notice_number);
    credit.push(fullNumber?item.notice_number:'공고 '+item.notice_number);
  }
  if(!compact && item.notice_on && item.notice_on!==item.published_on){
    credit.push((item.notice_number?.includes('고시')?'고시일 ':'공고일 ')+item.notice_on.replaceAll('-','.'));
  }
  article.append(meta,heading,element('p',credit.join(' · '),'publisher'));
  if(!compact && towns){
    const sites=element('div',null,'story-sites');
    for(const site of item.related_sites){
      const town=towns.get(site.town_id);
      if(!town)continue;
      const zone=zones?.get(site.zone_id);
      const verified=zone && zone.town_id===town.id;
      const target=element('a',town.district+' · '+(verified?zone.name:town.name));
      target.href=projectUrl(town,verified?zone:null).pathname;
      target.title='지도에서 '+target.textContent+' 보기';sites.append(target);
    }
    if(sites.childElementCount){
      sites.prepend(element('span','지도에서 보기','site-label'));
      article.append(sites);
    }
  }
  return article;
}
