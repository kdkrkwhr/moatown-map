import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>JSON.parse(readFileSync(new URL('../moatown-data/'+path,import.meta.url),'utf8'));
const manifest=read('latest.json'),towns=read(manifest.files.towns);
test('reference ages use all inside buildings, retaining unknown years and separate official figures',()=>{
  const index=read(manifest.files.buildings).towns;
  for(const row of [...towns,...read(manifest.files.zones)]){
    const s=row.aging_reference;
    if(!s){assert.equal(row.aging_rate,null);continue;}
    if(index[row.id])assert.equal(s.total,index[row.id].stats.inside);
    assert.equal(s.total,s.known+s.unknown);
    assert.ok(s.over_30<=s.over_20 && s.over_20<=s.known);
    for(const age of [20,30])assert.equal(s['rate_'+age],s.known?Math.round(1000*s['over_'+age]/s.total)/10:null);
    assert.equal(row.aging_rate,s.rate_30);
  }
});
test('a single rights date has the same verified notice as the existing regulation data',()=>{
  for(const row of towns){
    assert.equal(row.rights_base_date,row.rights_cutoff_date??null);
    assert.equal(row.rights_notice_no,row.rights_base_date?row.field_evidence.rights_cutoff_date.notice_number:null);
  }
});
