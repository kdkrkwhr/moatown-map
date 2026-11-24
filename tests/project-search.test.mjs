import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {searchProjects,progressFilters} from '../project-search.mjs';
import {planIntervals} from '../app.mjs';
import {parseLot,positionInGeometry} from '../address-reference.mjs';

const read=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
const manifest=read('../moatown-data/latest.json');
const snapshot=key=>read('../moatown-data/'+manifest.files[key]);
const towns=snapshot('towns'),zones=snapshot('zones'),archive=snapshot('excluded');
const groups=new Map(towns.map(town=>[town.id,zones.filter(zone=>zone.town_id===town.id)]));
const search=options=>searchProjects(towns,groups,archive,options);

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
  assert.equal(search({plan:'selected'}).length,towns.length);
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
  assert.equal(stats.months.size,56);
  assert.equal(Math.round(stats.mean*10)/10,23.9);
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
