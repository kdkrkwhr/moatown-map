import test from 'node:test';
import assert from 'node:assert/strict';
import {groupMarkers} from '../marker-clusters.mjs';

const caption={left:-29,right:29,top:-34,bottom:0};
const point=(id,x,y)=>({id,x,y,box:caption,pin:id});
const ids=groups=>groups.map(g=>g.members.map(p=>p.id).sort()).sort();

test('coincident members remain individually addressable at every zoom',()=>{
  const points=[point('A1',0,0),point('A2',0,0),point('town',0,0)];
  assert.deepEqual(ids(groupMarkers(points)),[['A1','A2','town']]);
  assert.deepEqual(ids(groupMarkers(points.slice(1))),[['A2','town']]);
  assert.deepEqual(groupMarkers([]),[]);
});
test('zoom separates labels and panning preserves the groups',()=>{
  const points=[point('a',0,0),point('b',43,0),point('c',128,0)];
  assert.deepEqual(ids(groupMarkers(points)),[['a','b'],['c']]);
  assert.deepEqual(ids(groupMarkers(points.map(p=>({...p,x:p.x*2})))),[['a'],['b'],['c']]);
  assert.deepEqual(ids(groupMarkers(points.map(p=>({...p,x:p.x+140,y:p.y-80})))),[['a','b'],['c']]);
});
test('count buttons do not cover remaining captions, even in a dense grid',()=>{
  const points=Array.from({length:60},(_,i)=>point(String(i),i%10*37,Math.floor(i/10)*40));
  const groups=groupMarkers(points);
  assert.deepEqual(groups.flatMap(g=>g.members.map(p=>p.id)).sort(),points.map(p=>p.id).sort());
  for(const [i,a] of groups.entries())for(const b of groups.slice(i+1)){
    assert.ok(a.x+a.box.right<=b.x+b.box.left || b.x+b.box.right<=a.x+a.box.left ||
      a.y+a.box.bottom<=b.y+b.box.top || b.y+b.box.bottom<=a.y+a.box.top);
  }
});
