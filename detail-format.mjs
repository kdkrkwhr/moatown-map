const dayMs=86400000;
const monthsInDays=365.2425/12;
const missing='확인 중';
const number=new Intl.NumberFormat('ko-KR',{maximumFractionDigits:4});
const percent=new Intl.NumberFormat('ko-KR',{minimumFractionDigits:1,maximumFractionDigits:1});
const approximate=new Intl.NumberFormat('ko-KR',{maximumFractionDigits:1});

function dayNumber(value){
  if(typeof value!=='string')return null;
  const iso=value.replaceAll('.','-');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(iso))return null;
  const time=Date.parse(iso+'T00:00:00Z');
  return Number.isFinite(time) && new Date(time).toISOString().slice(0,10)===iso?time/dayMs:null;
}

export function formatValue(value,unit=''){
  if(unit==='date'){
    if(dayNumber(value)!==null)return value.replaceAll('-','.');
    const month=/^(\d{4})[-.](0[1-9]|1[0-2])$/.exec(value??'');
    return month?month[1]+'년 '+Number(month[2])+'월 (일자 확인 중)':missing;
  }
  if(!Number.isFinite(value))return missing;
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
  if(first===null)return '고시일 미확인';
  if(last!==null && last>=first){
    const days=last-first;
    return formatValue(days,'일')+' 소요 (약 '+approximate.format(days/monthsInDays)+'개월)';
  }
  if(terminal)return '사업 종료';
  const asOf=dayNumber(snapshot);
  if(ongoing && !end && asOf!==null && asOf>=first)return '현재 '+formatValue(asOf-first+1,'일째')+' 진행 중';
  return '고시일 미확인';
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
      events.push({stage:(zone.stage??'사업 추진 단계')+(notice?' 고시':''),date,source_url:e.source_url});
      if(e.approval_date && e.state==='approved_project_plan' && e.source_as_of && e.approval_date!==e.source_as_of)
        events.push({stage:'인가 고시',date:e.source_as_of,source_url:e.source_url});
    }
    return events;
  }
  const events=[{stage:'대상지 선정',date:town.selected_date_precision==='month'?town.selected_date?.slice(0,7):town.selected_date,source_url:town.sources?.[0]}];
  const notices=town.management_plan_notices??[];
  // Separate addresses in a joint notice do not form sequential milestones.
  if(notices.length===1)events.push({stage:'관리계획 승인고시',date:notices[0].notice_date,source_url:notices[0].source_url});
  else if(notices.length && notices.every(n=>n.notice_date===notices[0].notice_date))events.push({stage:'관리계획 공동 승인고시',date:notices[0].notice_date,source_url:notices[0].source_url});
  if(shared){
    for(const v of history.events)events.push({stage:v.label,date:v.month,source_url:history.source_url,scope:history.scope});
    if(events.every(e=>e.date))events.sort((a,b)=>a.date.localeCompare(b.date));
  }
  return events;
}
