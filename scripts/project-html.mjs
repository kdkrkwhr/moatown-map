import {formatValue,projectMetadata,projectStage,awardHistories,contractorProcedure,procedureParticipants,procedureSchedule} from '../detail-format.mjs';
import {projectUrl} from '../project-url.mjs';
import {translateStage} from '../glossary-translator.mjs';

const escape=value=>String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

function officialSources(record){
  const sources=new Map();
  function add(url,label){
    if(typeof url!=='string' || sources.has(url) || !URL.canParse(url))return;
    const source=new URL(url);
    if(source.protocol==='https:' && (/\.(?:go|seoul)\.kr$/.test(source.hostname) || ['dart.fss.or.kr','kind.krx.co.kr'].includes(source.hostname))){
      sources.set(url,label || source.hostname);
    }
  }
  const evidence=record.field_evidence??{};
  for(const e of [evidence.stage??evidence.stage_review,evidence.selected_contractor??evidence.contractor_review,evidence.management_plan_stage,evidence.identity,record.selection_evidence]){
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
  const contractor=record.field_evidence?.selected_contractor??record.field_evidence?.contractor_review;
  const contractorFact=(name,value,note,evidence)=>{
    const proof=evidence?.source_url;
    const source=proof?.startsWith('https://')?'<small><a href="'+escape(proof)+'">'+escape(evidence.source_title??'시공사 확인 근거')+'</a></small>':'';
    return '<div><dt>'+escape(name)+'</dt><dd>'+escape(value)+(note?'<small>'+escape(note)+'</small>':'')+source+'</dd></div>';
  };
  const procedure=contractorProcedure(record);
  const contractors=procedure
    ?'<div><dt>시공사 선정 절차</dt><dd>'+escape(procedure.stage)
      +[...procedureParticipants(procedure),procedureSchedule(procedure.schedule,null).label,'자료 확인 '+formatValue(procedure.checked_on,'date')].map(text=>'<small>'+escape(text)+'</small>').join('')
      +list(procedure.sources.map(s=>[s.url,s.title]))+'</dd></div>'
    :record.contractor_projects?.length
    ?record.contractor_projects.map(p=>contractorFact(p.project_name+' 시공사',p.selected_contractor,[p.registered_address,p.scope_note].filter(Boolean).join(' · '),p.field_evidence.selected_contractor)).join('')
    :zone||contractor?contractorFact('시공사',record.selected_contractor??(contractor?'선정 결과 미확인':'미고시'),contractor?.note,contractor):'';
  const links=zone?[[projectUrl(town,null,root).pathname,town.name]]:children.map(child=>[projectUrl(town,child,root).pathname,child.name]);
  const stageEvidence=record.field_evidence?.stage??record.field_evidence?.stage_review;
  const stageFact=zone && record.field_evidence?.stage;
  const stageDate=stageFact?.milestone_date??stageFact?.approval_date??stageFact?.review_date;
  const stageRef=stageEvidence?.source_url?.startsWith('https://')?list([[stageEvidence.source_url,'단계 확인 원문']]):'';
  const scoped=stageEvidence?.scoped_events??[];
  const owners=record.metrics?.owner_count;
  const ownerProof=record.field_evidence?.['metrics.owner_count'];
  const ownerScope=ownerProof?.display_scope?'<small>'+escape(ownerProof.display_scope)+'</small>':'';
  const ownerHtml=Number.isInteger(owners)?'<div><dt>토지등소유자 수</dt><dd>'+formatValue(owners,'명')+ownerScope+(ownerProof?.source_url?list([[ownerProof.source_url,'소유자 수 확인 근거']]):'')+'</dd></div>':'';
  const scopedHtml=scoped.map(e=>'<div><dt>'+escape(e.project_name)+'</dt><dd>'+escape(e.stage)+(e.date?' · '+escape(formatValue(e.date,'date')):'')+list([[e.source_url,'이력 원문']])+'</dd></div>').join('');
  const awardHtml=awardHistories(record).map(h=>'<div><dt>'+escape([h.scope,'시공사 선정·계약 이력'].filter(Boolean).join(' · '))+'</dt><dd>'+escape(h.company)+h.events.map(e=>'<small>'+escape(e.label+' · '+formatValue(e.date,'date'))+'</small>').join('')+list(h.sources.filter(s=>s.url).map(s=>[s.url,s.title]))+'</dd></div>').join('');
  const summary='<article class="published-project"><p>'+escape(zone?town.district+' · '+town.name:town.district)+'</p><h2>'+escape(record.name)+'</h2>'
    +'<dl class="facts"><div><dt>'+(zone?'추진 단계':'관리계획 단계')+'</dt><dd>'+escape(stage)+(term?'<small>'+escape(term.summary)+'</small>':'')+'</dd></div>'
    +(stageEvidence?.note?'<div><dt>'+(stageFact?'최근 확인된 행정 단계':'구역 대조 결과')+'</dt><dd>'+escape(stageEvidence.note)+(stageDate?'<small>'+escape((stageFact.milestone_label??stage)+' · '+formatValue(stageDate,'date'))+'</small>':'')+(stageEvidence.source_as_of?'<small>자료 기준 '+escape(formatValue(stageEvidence.source_as_of,'date'))+'</small>':'')+stageRef+'</dd></div>':'')
    +scopedHtml+contractors+awardHtml+ownerHtml
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
