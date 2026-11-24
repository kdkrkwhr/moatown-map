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

test('district, town and zone matches must belong to the same recorded site',()=>{
  const towns=new Map([['a',{district:'마포구'}],['b',{district:'강북구'}]]);
  const story={type:'official',classification:'project',related_sites:[{town_id:'a',zone_id:null},{town_id:'b',zone_id:'b1'}]};
  const common={type:'media',classification:'common',related_sites:[]};
  assert.deepEqual(matchNews([story,common],{townId:'a',zoneId:'b1'},towns),[]);
  assert.deepEqual(matchNews([story,common],{townId:'a',district:'강북구'},towns),[]);
  assert.deepEqual(matchNews([story,common],{townId:'b',zoneId:'b1'},towns),[story]);
  assert.deepEqual(matchNews([story,common],{common:true,type:'media'},towns),[common]);
});
