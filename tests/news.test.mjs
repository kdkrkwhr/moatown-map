import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadNews,matchNews} from '../news.mjs';

const base=new URL('../',import.meta.url);
const read=async url=>({ok:true,json:async()=>JSON.parse(await readFile(url,'utf8'))});

test('news retains its source and sorts by publication date across both feeds',async()=>{
  const {items,failed}=await loadNews(base,read);
  assert.deepEqual(failed,[]);
  assert.ok(items.every((item,i)=>!i || items[i-1].published_on>=item.published_on));
  for(const type of ['official','media']){
    const original=await (await read(new URL('moatown-data/news/'+type+'.json',base))).json();
    assert.deepEqual(new Set(matchNews(items,{type}).map(item=>item.id)),new Set(original.items.map(item=>item.id)));
  }
});

test('an unavailable news source leaves the other source usable',async()=>{
  const {items,failed}=await loadNews(base,url=>url.pathname.endsWith('media.json')?Promise.reject(Error('offline')):read(url));
  assert.deepEqual(failed,['media']);
  assert.ok(items.length>0 && items.every(item=>item.type==='official'));
});

test('published stories have unique sources and link to existing towns and their zones',async()=>{
  const manifestUrl=new URL('moatown-data/latest.json',base);
  const manifest=await (await read(manifestUrl)).json();
  const [towns,zones]=await Promise.all(['towns','zones'].map(async key=>
    (await read(new URL(manifest.files[key],manifestUrl))).json()));
  const townIds=new Set(towns.map(town=>town.id));
  const zoneParents=new Map(zones.map(zone=>[zone.id,zone.town_id]));
  const {items,failed}=await loadNews(base,read);
  assert.deepEqual(failed,[]);
  assert.equal(new Set(items.map(item=>item.id)).size,items.length);
  assert.equal(new Set(items.map(item=>item.url)).size,items.length);
  for(const item of items){
    assert.equal(new URL(item.url).protocol,'https:');
    assert.match(item.published_on,/^\d{4}-\d{2}-\d{2}$/);
    if(item.verified_on)assert.ok(item.verified_on>=item.published_on,item.id);
    assert.equal(item.classification,item.related_sites.length?'project':'common',item.id);
    for(const {town_id,zone_id} of item.related_sites){
      assert.ok(townIds.has(town_id),item.id);
      if(zone_id)assert.equal(zoneParents.get(zone_id),town_id,item.id);
    }
  }
});

test('district, town and zone matches must belong to the same recorded site',()=>{
  const towns=new Map([['a',{district:'마포구'}],['b',{district:'강북구'}]]);
  const story={type:'official',classification:'project',related_sites:[{town_id:'a',zone_id:null},{town_id:'b',zone_id:'b1'}]};
  const common={type:'media',classification:'common',related_sites:[]};
  assert.deepEqual(matchNews([story,common],{townId:'a',zoneId:'b1'},towns),[]);
  assert.deepEqual(matchNews([story,common],{townId:'a',district:'강북구'},towns),[]);
  assert.deepEqual(matchNews([story,common],{townId:'b',zoneId:'b1'},towns),[story]);
  assert.deepEqual(matchNews([story,common],{common:true,type:'media'},towns),[common]);
});
