import {readFileSync,writeFileSync} from 'node:fs';
import {projectUrl} from '../project-url.mjs';

const manifestUrl=new URL('../moatown-data/latest.json',import.meta.url);
const readJson=url=>JSON.parse(readFileSync(url,'utf8'));
const {files}=readJson(manifestUrl);
const root='https://'+readFileSync(new URL('../CNAME',import.meta.url),'utf8').trim()+'/';
const urls=[root,root+'news.html'];
const towns=new Map();
for(const town of readJson(new URL(files.towns,manifestUrl))){
  if(!town.id || !town.district || towns.has(town.id))throw Error('대상지 ID·자치구 확인 필요 '+town.id);
  towns.set(town.id,town);
  urls.push(projectUrl(town,null,root).href);
}
for(const zone of readJson(new URL(files.zones,manifestUrl))){
  const town=towns.get(zone.town_id);
  if(!town || !zone.id)throw Error('세부구역 또는 상위 대상지 ID 확인 필요 '+zone.id);
  urls.push(projectUrl(town,zone,root).href);
}
const entries=urls.map(url=>'  <url><loc>'+url.replaceAll('&','&amp;')+'</loc></url>');
const xml=['<?xml version="1.0" encoding="UTF-8"?>','<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',...entries,'</urlset>',''];
writeFileSync(new URL('../sitemap.xml',import.meta.url),xml.join('\n'));
writeFileSync(new URL('../robots.txt',import.meta.url),'User-agent: *\nAllow: /\n\nSitemap: '+root+'sitemap.xml\n');
