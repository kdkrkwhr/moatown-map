import {formatValue,projectMetadata,projectStage} from '../detail-format.mjs';
import {projectUrl} from '../project-url.mjs';
import {translateStage} from '../glossary-translator.mjs';

const escape=value=>String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

function officialSources(record){
  const sources=new Map();
  function add(url,label){
    if(typeof url!=='string' || sources.has(url) || !URL.canParse(url))return;
    const source=new URL(url);
    if(source.protocol==='https:' && /\.(?:go|seoul)\.kr$/.test(source.hostname)){
      sources.set(url,label || source.hostname);
    }
  }
  const evidence=record.field_evidence??{};
  for(const e of [evidence.stage,evidence.management_plan_stage,evidence.identity,record.selection_evidence]){
    if(e)add(e.source_url,e.notice_number??e.source_title);
  }
  for(const link of record.official_links??[])add(link.url,link.title);
  for(const notice of record.management_plan_notices??[])add(notice.notice_url??notice.archive_url,notice.notice_number);
  if(evidence.plan)add(evidence.plan.source_url,evidence.plan.notice_number??'공개 사업계획 자료');
  if(record.boundary_evidence)add(record.boundary_evidence.source_url,'참고 경계 자료');
  for(const url of Object.values(record.sources??{}))add(url);
  return [...sources].slice(0,4);
}

export function projectHtml(template,town,zone,children,snapshot,root){
  const record=zone??town,url=projectUrl(town,zone,root);
  const stage=projectStage(town,zone)??'미확인',term=translateStage(stage);
  const {title,description}=projectMetadata(town,zone,snapshot);
  const place=[town.district,town.name,...(zone?[zone.name]:[])].join(' · ');
  const sources=officialSources(record);
  const list=entries=>'<ul>'+entries.map(([href,label])=>'<li><a href="'+escape(href)+'">'+escape(label)+'</a></li>').join('')+'</ul>';
  const links=zone?[[projectUrl(town,null,root).pathname,town.name]]:children.map(child=>[projectUrl(town,child,root).pathname,child.name]);
  const summary='<article class="published-project"><p>'+escape(zone?town.district+' · '+town.name:town.district)+'</p><h2>'+escape(record.name)+'</h2>'
    +'<dl class="facts"><div><dt>'+(zone?'추진 단계':'관리계획 단계')+'</dt><dd>'+escape(stage)+(term?'<small>'+escape(term.summary)+'</small>':'')+'</dd></div>'
    +'<div><dt>대표 지번</dt><dd>'+escape(zone?zone.registered_address??'미확인':town.address??town.name)+'</dd></div>'
    +'<div><dt>자료 기준일</dt><dd><time datetime="'+escape(snapshot)+'">'+escape(formatValue(snapshot,'date'))+'</time></dd></div></dl>'
    +'<h3>공식 출처</h3>'+(sources.length?list(sources):'<p>구역별 원문 미확인</p>')
    +(links.length?'<h3>'+(zone?'상위 대상지':'세부 사업구역')+'</h3>'+list(links):'')+'</article>';
  return template
    .replace(/<title>[^<]*<\/title>/,()=>'<title>'+escape(title)+'</title>')
    .replace(/(<meta (?:name="description"|property="og:description") content=")[^"]*/g,(_,start)=>start+escape(description))
    .replace(/(<meta property="og:title" content=")[^"]*/,(_,start)=>start+escape(title))
    .replace(/(<link rel="canonical" href="|<meta property="og:url" content=")[^"]*/g,(_,start)=>start+escape(url.href))
    .replace('class="skip" href="#explorer"',()=> 'class="skip" href="'+url.pathname+'#explorer"')
    .replace('id="heading-project" class="sr-only">',()=> 'id="heading-project" class="sr-only"> · '+escape(place))
    .replace('id="list-view"','id="list-view" hidden')
    .replace('aria-label="선택 상세" hidden','aria-label="선택 상세"')
    .replace('<div class="skeleton detail-skeleton" aria-hidden="true"></div>',()=>summary)
    .replace('</head>','<noscript><style>.map-stage,.sheet-tools,#back-results,#guide-open,.top-meta{display:none!important}.workspace,#explorer,#panel-content,#detail-view,#town-detail{position:static!important;display:block!important;height:auto!important;max-height:none!important;overflow:visible!important;width:auto!important}body{display:block;height:auto}</style></noscript>\n</head>');
}
