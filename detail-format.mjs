const dayMs=86400000;
const monthsInDays=365.2425/12;
const missing='미고시';
const number=new Intl.NumberFormat('ko-KR',{maximumFractionDigits:4});
const percent=new Intl.NumberFormat('ko-KR',{minimumFractionDigits:1,maximumFractionDigits:1});
const approximate=new Intl.NumberFormat('ko-KR',{maximumFractionDigits:1});

export function projectStage(town,zone){
  return zone?zone.stage:town.management_plan_stage??(town.management_plan_notices?.length?'관리계획 승인고시':town.candidate_status??(town.selected_date?'대상지 선정':null));
}

export function projectMetadata(town,zone,snapshot){
  const site='서울 모아타운 현황지도';
  if(!town)return {title:site,description:'서울시 모아타운 선정 대상지와 공개 사업구역 자료를 지도에서 탐색하세요.'};
  const name=town.district+' '+town.name+' 모아타운'+(zone?' · '+zone.name:'');
  const stage=projectStage(town,zone)??'미확인';
  return {title:name+' 현황 | '+site,description:name+'의 '+(zone?'사업 추진 단계':'관리계획 단계')+'는 '+stage+'입니다. '+formatValue(snapshot,'date')+' 기준 사업 정보와 근거 자료를 확인하세요.'};
}

export function dayNumber(value){
  if(typeof value!=='string')return null;
  const iso=value.replaceAll('.','-');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(iso))return null;
  const time=Date.parse(iso+'T00:00:00Z');
  return Number.isFinite(time) && new Date(time).toISOString().slice(0,10)===iso?time/dayMs:null;
}

export function contractorProcedure(record){
  return record?.selected_contractor?null:record?.field_evidence?.contractor_review?.procedure??null;
}

export function awardHistories(record){
  const histories=[];
  for(const owner of [record,...(record.contractor_projects??[])]){
    const evidence=owner.field_evidence?.selected_contractor;
    if(!owner.selected_contractor || !evidence)continue;
    const events=[];
    if(evidence.selection_date)events.push({label:'시공사 선정',date:evidence.selection_date});
    if(evidence.contract_date)events.push({label:evidence.agreement_type??'시공사 계약',date:evidence.contract_date});
    if(!events.length)continue;
    const sources=[{url:evidence.source_url,title:evidence.source_title??'선정·계약 근거'},...(evidence.supporting_sources??[])];
    histories.push({company:owner.selected_contractor,scope:owner===record?null:owner.project_name,events,sources});
  }
  return histories;
}

export function procedureParticipants(procedure){
  if(!procedure.participants?.length)return ['참여 업체 미확인'];
  return procedure.participants.map(({role,names})=>role+' · '+(names?.join(', ')||'업체명 미확인'));
}

export function procedureSchedule(schedule,now=Date.now()){
  if(dayNumber(schedule?.date)===null)return {label:'다음 일정 미확인',cutoff:null};
  const clock=schedule.time;
  const cutoff=Date.parse(schedule.date+'T'+(clock??'00:00')+':00+09:00')+(clock?0:dayMs);
  const deadline=schedule.label+' '+formatValue(schedule.date,'date')+(clock?' '+clock:'');
  return {cutoff,label:deadline+(now===null?'':now>=cutoff?' · 결과 확인 중':' 예정')};
}

export function formatValue(value,unit=''){
  if(unit==='date'){
    if(dayNumber(value)!==null)return value.replaceAll('-','.');
    const month=/^(\d{4})[-.](0[1-9]|1[0-2])$/.exec(value??'');
    return month?month[1]+'년 '+Number(month[2])+'월 (일자 미고시)':missing;
  }
  if(!Number.isFinite(value))return missing;
  if(unit==='평')return number.format(Math.round(value/3.305785))+'평';
  if(unit==='㎡')return number.format(value)+'㎡ (약 '+number.format(Math.round(value/3.305785))+'평)';
  return (unit==='%'?percent:number).format(value)+unit;
}

export function unitsChange(existing,planned){
  if(!Number.isFinite(existing)||!Number.isFinite(planned))return missing;
  const delta=planned-existing;
  if(delta===0)return '(0세대 증감)';
  return '('+(delta>0?'+':'−')+formatValue(Math.abs(delta),'세대')+(delta>0?' 순증)':' 순감)');
}

export function intervalBadge(start,end,snapshot,{ongoing=false,terminal=false}={}){
  const first=dayNumber(start),last=dayNumber(end);
  if(first===null)return missing;
  if(last!==null && last>=first){
    const days=last-first;
    return formatValue(days,'일')+' 소요 (약 '+approximate.format(days/monthsInDays)+'개월)';
  }
  if(terminal)return '사업 종료';
  const asOf=dayNumber(snapshot);
  if(ongoing && !end && asOf!==null && asOf>=first)return '현재 '+formatValue(asOf-first+1,'일째')+' 진행 중';
  return missing;
}

export function elapsedMonths(start,end){
  const monthIndex=date=>{
    const match=/^(\d{4})-(0[1-9]|1[0-2])$/.exec(date);
    return match?Number(match[1])*12+Number(match[2]):NaN;
  };
  const duration=monthIndex(end)-monthIndex(start);
  return duration>=0?duration:null;
}

export function projectIntervals(town,zone,snapshot){
  const events=projectEvents(town,zone);
  return events.map((event,i)=>{
    const next=events[i+1];
    const reached=next && (next.date || next.reached || next.completed || events.slice(i+2).some(e=>e.date));
    const terminal=!next && ((zone??town).risk_info?.is_canceled===true || /준공|사업종료|취소|철회|폐지/.test(event.stage));
    let label=intervalBadge(event.date,next?.date,snapshot,{ongoing:!reached,terminal});
    const monthOf=date=>date?.length===7 || dayNumber(date)!==null?date.slice(0,7):null;
    if(label===missing && (event.date?.length===7 || next?.date?.length===7)){
      const months=elapsedMonths(monthOf(event.date),monthOf(next?.date));
      if(months!==null)label=formatValue(months,'개월')+' 소요 (공개 연월 기준)';
    }
    const start=dayNumber(event.date),end=dayNumber(next?.date);
    const days=start!==null && end!==null && end>=start?end-start:null;
    return {event,next,label,days,terminal};
  });
}

// Keep parent and child transitions in separate cohorts. Month-only dates
// cannot be used to measure an interval in days.
export function durationSamples(towns,zones,snapshot){
  const samples=new Map(),parents=new Map(towns.map(t=>[t.id,t]));
  function collect(town,zone){
    for(const {event,next,days} of projectIntervals(town,zone,snapshot)){
      if(days===null)continue;
      const key=JSON.stringify([zone?'zone':'town',event.stage,next.stage]);
      if(!samples.has(key))samples.set(key,new Map());
      samples.get(key).set((zone??town).id,days);
    }
  }
  for(const town of towns)collect(town,null);
  for(const zone of zones)if(parents.has(zone.town_id))collect(parents.get(zone.town_id),zone);
  return samples;
}

export function compareInterval({event,next,days},town,zone,samples){
  if(days===null || !next)return null;
  const cohort=samples.get(JSON.stringify([zone?'zone':'town',event.stage,next.stage]));
  const others=[...(cohort??[])].filter(([id])=>id!==(zone??town).id);
  if(!others.length)return null;
  const mean=others.reduce((sum,[,duration])=>sum+duration,0)/others.length;
  return {difference:Math.round(days-mean),count:others.length};
}

export function projectEvents(town,zone){
  const record=zone??town;
  if(Array.isArray(record.timeline) && record.timeline.some(e=>e?.stage))return record.timeline.filter(e=>e?.stage);
  const history=town.published_timeline;
  const shared=history?.events?.length && (!zone || history.zone_ids?.includes(zone.id));
  if(zone){
    const e=zone.field_evidence?.stage??{};
    const notice=['municipal_association_notice','district_association_notice'].includes(e.kind);
    const date=e.approval_date??e.review_date??e.milestone_date??(notice?e.source_as_of:null);
    const events=shared?history.events.map(v=>({stage:v.label,date:v.month,source_url:history.source_url})):[];
    if(!shared || date && String(date).slice(0,7)>String(events.at(-1)?.date).slice(0,7)){
      events.push({stage:e.milestone_label??((zone.stage??'사업 추진 단계')+(notice?' 고시':'')),date,source_url:e.source_url});
      if(e.approval_date && e.state==='approved_project_plan' && e.source_as_of && e.approval_date!==e.source_as_of)
        events.push({stage:'인가 고시',date:e.source_as_of,source_url:e.source_url});
    }
    return events;
  }
  const candidate=town.candidate_status && !town.selected_date;
  const events=[candidate?{stage:town.candidate_status,date:town.field_evidence?.candidate_status?.source_as_of,source_url:town.field_evidence?.candidate_status?.source_url}:{stage:'대상지 선정',date:town.selected_date_precision==='month'?town.selected_date?.slice(0,7):town.selected_date,source_url:town.sources?.[0]}];
  const notices=town.management_plan_notices??[];
  // Separate addresses in a joint notice do not form sequential milestones.
  if(notices.length===1)events.push({stage:notices[0].notice_kind==='변경'?'관리계획 변경고시':'관리계획 승인고시',date:notices[0].notice_date,source_url:notices[0].notice_url??notices[0].source_url});
  else if(notices.length && notices.every(n=>n.notice_date===notices[0].notice_date))events.push({stage:'관리계획 공동 승인고시',date:notices[0].notice_date,source_url:notices[0].source_url});
  else if(notices.length>1){
    const ordered=[...notices].sort((a,b)=>(a.notice_date??'').localeCompare(b.notice_date??''));
    const originals=ordered.filter(n=>n.notice_kind!=='변경'),changes=ordered.filter(n=>n.notice_kind==='변경');
    if(originals.length && originals.every(n=>n.notice_date && n.notice_date===ordered[0].notice_date) && changes.every(n=>n.notice_date>ordered[0].notice_date)){
      const dates=new Map();
      for(const n of ordered){
        if(!dates.has(n.notice_date))dates.set(n.notice_date,[]);
        dates.get(n.notice_date).push(n);
      }
      for(const [date,group] of dates){
        const n=group[0],stage=n.notice_kind==='변경'?'관리계획 변경고시':group.length>1?'관리계획 공동 승인고시':'관리계획 승인고시';
        events.push({stage,date,source_url:n.notice_url??n.source_url,scope:group.map(item=>item.site).filter(Boolean).join(' · ')});
      }
    }else events.push({stage:'관리계획 고시',date:null,reached:true,scope:'구역별 고시일은 각 고시 원문에서 확인하세요.'});
  }
  if(shared){
    for(const v of history.events)events.push({stage:v.label,date:v.month,source_url:history.source_url,scope:history.scope});
    if(events.every(e=>e.date))events.sort((a,b)=>a.date.localeCompare(b.date));
  }
  return events;
}
