import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {searchProjects,progressFilters,recentProjectDates} from '../project-search.mjs';
import {planIntervals} from '../app.mjs';
import {contractorProcedure,procedureSchedule,procedureParticipants} from '../detail-format.mjs';
import {parseLot,positionInGeometry} from '../address-reference.mjs';

const read=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
const manifest=read('../moatown-data/latest.json');
const snapshot=key=>read('../moatown-data/'+manifest.files[key]);
const towns=snapshot('towns'),zones=snapshot('zones'),archive=snapshot('excluded');
const groups=new Map(towns.map(town=>[town.id,zones.filter(zone=>zone.town_id===town.id)]));
const search=options=>searchProjects(towns,groups,archive,options);

test('procedure results only contain documented, unawarded projects and preserve company roles',()=>{
  const pending=search({contractor:'pending'});
  assert.equal(pending.length,manifest.coverage.zones_with_contractor_procedure);
  assert.equal(pending.length,9);
  const awards=new Set(search({contractor:'all'}).map(r=>r.zone?.id));
  for(const {zone} of pending){
    const p=contractorProcedure(zone);
    assert.ok(!awards.has(zone.id) && p.stage && p.checked_on && p.sources.length);
    assert.ok(p.sources.every(s=>s.url.startsWith('https://') && s.title && s.as_of && s.evidence));
  }
  const [daerim]=search({contractor:'pending',district:'영등포구',query:'대우산업개발'});
  assert.deepEqual(procedureParticipants(contractorProcedure(daerim.zone)),['입찰 참여 · 두산건설, 대우산업개발']);
  const [hyeonjeo]=search({contractor:'pending',district:'서대문구',query:'동아건설산업'});
  const company='동아건설산업',promoted={...hyeonjeo.zone,selected_contractor:company};
  const filter=contractor=>searchProjects([hyeonjeo.town],new Map([[hyeonjeo.town.id,[promoted]]]),[],{contractor});
  assert.equal(contractorProcedure(promoted),null);
  assert.equal(filter('pending').length,0);
  assert.equal(filter(company)[0].zone.id,promoted.id);
});

test('contractor schedules use the advertised Korean time or the entire local calendar date',()=>{
  const deadline={label:'입찰 마감',date:'2026-11-30',time:'14:00'};
  const end=Date.parse('2026-11-30T05:00:00Z');
  assert.match(procedureSchedule(deadline,end-1).label,/14:00 예정$/);
  assert.match(procedureSchedule(deadline,end).label,/결과 확인 중$/);
  const vote={label:'선정총회',date:'2026-11-28',time:null};
  assert.match(procedureSchedule(vote,Date.parse('2026-11-28T14:59:59Z')).label,/28 예정$/);
  assert.match(procedureSchedule(vote,Date.parse('2026-11-28T15:00:00Z')).label,/결과 확인 중$/);
  assert.equal(procedureSchedule(vote,null).label,'선정총회 2026.11.28');
  assert.equal(procedureSchedule(null).label,'다음 일정 미확인');
});

test('contractor discovery lists each awarded zone or named association exactly once',()=>{
  const found=search({contractor:'all'});
  const assigned=zones.filter(z=>z.selected_contractor);
  const associations=[...towns,...zones].flatMap(t=>t.contractor_projects??[]);
  assert.deepEqual(found.filter(r=>r.zone && !r.association).map(r=>r.zone.id).sort(),assigned.map(z=>z.id).sort());
  assert.deepEqual(found.filter(r=>r.association).map(r=>r.association.project_name).sort(),associations.map(a=>a.project_name).sort());
  assert.equal(found.length,assigned.length+associations.length);
  assert.deepEqual(search({contractor:'all',plan:'canceled'}),[]);
  const byCompany=search({contractor:'동부건설',district:'금천구'});
  assert.equal(byCompany.filter(r=>r.town.name==='시흥3동 972' && r.association?.selected_contractor==='동부건설').length,3);
  assert.deepEqual(search({query:'금천구 동부건설'}),byCompany);
  assert.deepEqual(search({query:'디엘건설'}),search({contractor:'DL건설'}));
  assert.ok(search({contractor:'all',progress:'construction'}).every(r=>r.zone?.selected_contractor && r.zone.stage==='착공'));
});

test('scoped awards link a named association to a zone without assigning its contractor to the whole zone',()=>{
  const expected=[
    ['석관1의2구역 조합','석관동 332-113','한화 건설부문'],
    ['면목역6의3구역 조합','면목동 66-28','호반건설'],
    ['상봉역4구역 조합','상봉동 304-4','우미건설']
  ];
  const scoped=search({contractor:'all'}).filter(r=>r.association && r.zone);
  assert.equal(scoped.length,manifest.coverage.association_contractor_records_within_zones);
  for(const [project_name,address,company] of expected){
    const matches=search({contractor:company,query:address});
    assert.equal(matches.length,1);
    const [{zone,town,association}]=matches;
    assert.equal(association.project_name,project_name);
    assert.ok(association.scope_note && association.field_evidence.selected_contractor.selection_date);
    assert.ok(!zone.selected_contractor);
    assert.ok(search({query:company}).some(row=>row.zone===zone && row.association===association));
    assert.deepEqual(search({query:project_name.replace(/(\d)의/,'$1-'),district:town.district}),matches);
    assert.deepEqual(search({contractor:'pending',query:project_name}),[]);
    const recentDates=recentProjectDates(towns,groups,archive,association.field_evidence.selected_contractor.checked_on);
    assert.deepEqual(search({query:address,contractor:company,recentDates}),matches);
  }
});

test('recency uses seven calendar dates, rolls child updates up to the parent and composes with filters',()=>{
  const town={id:'town',district:'양천구',name:'신월동',last_verified_at:'2026-11-17'};
  const child={id:'child',name:'A1',stage:'착공',timeline:[{stage:'착공',date:'2026-11-18'}]};
  const sibling={id:'sibling',name:'A2',stage:'착공',last_verified_at:'2026-11-25'};
  const children=new Map([[town.id,[child,sibling]]]);
  const other={id:'other',last_verified_at:'2026-11-24'};
  const invalid={id:'invalid',last_verified_at:'2026-11-31',selected_date:'2026-11',source_as_of:'2026-11-24'};
  const archived={address_raw:'취소 구역',cancellation_date:'2026-11-22'};
  const records=[town,other,invalid],dates=recentProjectDates(records,children,[archived],'2026-11-24');
  assert.deepEqual([...dates.entries()].sort(),[['child','2026-11-18'],['other','2026-11-24'],['town','2026-11-18'],['취소 구역','2026-11-22']].sort());
  const filter=options=>searchProjects(records,children,[archived],{recentDates:dates,...options});
  assert.deepEqual(filter({district:'양천구'}),[{town}]);
  assert.deepEqual(filter({progress:'construction',query:'신월동'}),[{town,zone:child}]);
  assert.deepEqual(filter({plan:'canceled'}),[{excluded:archived}]);
  assert.ok(!recentProjectDates(records,children,[],'2026-11-26').has(child.id));
});

test('combined search returns the matching zone without siblings or duplicate parent results',()=>{
  assert.deepEqual(search({query:'강북구  착공'}),search({district:'강북구',progress:'construction'}));
  assert.ok(search({query:'강북구 착공'}).every(row=>row.zone.stage==='착공'));
  assert.equal(search({progress:'construction',district:'없는구'}).length,0);
  for(const [progress,label] of progressFilters){
    assert.deepEqual(search({progress}).map(r=>r.zone.id).sort(),zones.filter(z=>(z.stage||'미확인')===label).map(z=>z.id).sort());
  }
  assert.deepEqual(search({query:'사업인가 완료'}),search({progress:'approved'}));
  assert.deepEqual(search({query:'강북구 착공 단계'}),search({district:'강북구',progress:'construction'}));
  assert.ok(search({query:'조합 설립'}).some(r=>r.zone?.stage==='조합설립인가'));
  assert.deepEqual(search({query:'관리계획 승인'}),search({plan:'approved'}));
  assert.ok(search({plan:'unknown',progress:'construction'}).every(({town,zone})=>!town.management_plan_stage && zone.stage==='착공'));
  assert.deepEqual(search({plan:'selected'}).map(row=>row.town.id),towns.filter(t=>!t.candidate_status || t.selected_date).map(t=>t.id));
});

test('unrecorded zone stages, unrecorded management plans and cancellation history retain their scope',()=>{
  assert.equal(search({plan:'unknown'}).length,towns.filter(t=>!t.management_plan_stage&&!t.management_plan_notices?.length).length);
  assert.ok(search({plan:'unknown'}).every(row=>!row.zone && row.town));
  assert.ok(search({progress:'unknown'}).every(row=>row.zone && (!row.zone.stage || row.zone.stage==='미확인')));
  assert.deepEqual(search({plan:'canceled'}),search({query:'취소'}));
  assert.equal(search({plan:'canceled'}).length,11);
  assert.ok(search({plan:'canceled',district:'중구'}).every(row=>row.excluded?.district==='중구' && !row.town));
});

test('published management intervals only compare a single dated notice to its own selection month',()=>{
  const stats=planIntervals(towns);
  const eligible=towns.filter(t=>t.selected_date && t.management_plan_notices?.length===1 &&
    t.management_plan_notices[0].notice_kind!=='변경' && t.management_plan_notices[0].notice_date.slice(0,7)>=t.selected_date.slice(0,7));
  assert.deepEqual([...stats.months.keys()],eligible.map(t=>t.id));
  const fixture=[{id:'a',selected_date:'2024-10',management_plan_notices:[{notice_date:'2025-04-02'}]},
    {id:'b',selected_date:'2025-01',management_plan_notices:[{notice_date:'2025-03-18'}]}];
  assert.equal(planIntervals(fixture).mean,4);
  const amended=towns.find(t=>t.name==='수유동 52-1');
  assert.equal(amended.management_plan_notices[0].notice_kind,'변경');
  assert.ok(!stats.months.has(amended.id));
  assert.ok(!stats.months.has(towns.find(t=>t.management_plan_notices?.length===2).id));
  assert.deepEqual(planIntervals([{id:'a',selected_date:'2024-01',management_plan_notices:[{notice_date:'2023-12-31'}]}]),{months:new Map(),mean:null});
});

test('parcel lookup distinguishes a representative point, holes, nearby edges and uncovered lots',()=>{
  const index=read('../moatown-data/addresses/mapo.json');
  assert.equal(Object.values(index.points).reduce((n,entries)=>n+Object.keys(entries).length,0),41156);
  assert.deepEqual(parseLot('서울특별시 마포구 망원동 456-6'),{district:'마포구',dong:'망원동',lot:'456-6'});
  assert.deepEqual(parseLot('성산동 산 12-0'),{district:null,dong:'성산동',lot:'산12'});
  assert.deepEqual(parseLot('서울 강남구 대치동 2'),{district:'강남구',dong:'대치동',lot:'2'});
  const reference=towns.find(t=>t.name==='망원동 456-6');
  const feature=snapshot('boundaries').features.find(f=>f.properties.entity_id===reference.id);
  assert.equal(positionInGeometry(index.points['망원동']['456-6'],feature.geometry),'inside');
  const ring=(a,b)=>[[a,a],[b,a],[b,b],[a,b],[a,a]];
  const polygon={type:'MultiPolygon',coordinates:[[ring(0,1),ring(.3,.4)],[ring(2,3)]]};
  assert.equal(positionInGeometry([.35,.35],polygon),'outside');
  assert.equal(positionInGeometry([2.5,2.5],polygon),'inside');
  assert.equal(positionInGeometry([0.00001,.5],polygon),'near');
  assert.equal(positionInGeometry([-1,.5],polygon),'outside');
});
