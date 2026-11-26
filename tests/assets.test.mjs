import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

test('public pages and nested browser imports use the release hash of their current sources',()=>{
  execFileSync(process.execPath,[fileURLToPath(new URL('../scripts/sync-assets.mjs',import.meta.url)),'--check']);
});

test('public pages and the crawler entry point use the HTTPS custom domain',()=>{
  const root=new URL('../',import.meta.url);
  const read=path=>readFileSync(new URL(path,root),'utf8');
  assert.equal(read('CNAME').trim(),'moatownmap.com');
  const site='https://moatownmap.com/';
  assert.equal(read('robots.txt').replaceAll('\r\n','\n'),'User-agent: *\nAllow: /\n\nSitemap: '+site+'sitemap.xml\n');
  for(const [file,path] of [['index.html',''],['news.html','news.html'],['qa.html','qa.html']]){
    const html=read(file);
    assert.match(html,/<title>[^<]+<\/title>/);
    for(const attribute of ['name="description"','property="og:title"','property="og:description"']){
      assert.match(html,new RegExp('<meta '+attribute+' content="[^"]+"'));
    }
    assert.ok(html.includes('<link rel="canonical" href="'+site+path+'">'));
    assert.ok(html.includes('<meta property="og:url" content="'+site+path+'">'));
    const image=new URL(html.match(/<meta property="og:image" content="([^"]+)"/)[1]);
    assert.equal(image.origin+'/',site);
    assert.ok(readFileSync(new URL(image.pathname.slice(1),root)).length>0);
  }
});
