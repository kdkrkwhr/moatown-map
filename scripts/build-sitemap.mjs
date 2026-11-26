import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {projectUrl} from '../project-url.mjs';
import {projectHtml} from './project-html.mjs';

const manifestUrl=new URL('../moatown-data/latest.json',import.meta.url);
const readJson=url=>JSON.parse(readFileSync(url,'utf8'));
const {files,snapshot_date}=readJson(manifestUrl);
const template=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const root='https://'+readFileSync(new URL('../CNAME',import.meta.url),'utf8').trim()+'/';
const urls=[root,root+'news.html',root+'qa.html'];
const towns=new Map();
const children=new Map();
for(const town of readJson(new URL(files.towns,manifestUrl))){
  if(!/^[\w-]+$/.test(town.id??'') || !town.district || towns.has(town.id))throw Error('대상지 ID·자치구 확인 필요 '+town.id);
  towns.set(town.id,town);
  children.set(town.id,[]);
}
for(const zone of readJson(new URL(files.zones,manifestUrl))){
  const town=towns.get(zone.town_id);
  if(!town || !/^[\w-]+$/.test(zone.id??''))throw Error('세부구역 또는 상위 대상지 ID 확인 필요 '+zone.id);
  children.get(town.id).push(zone);
}
for(const town of towns.values()){
 const zones=children.get(town.id);
 for(const zone of [null,...zones]){
  const url=projectUrl(town,zone,root);
  const dir=new URL('..'+url.pathname,import.meta.url);
  mkdirSync(dir,{recursive:true});
  writeFileSync(new URL('index.html',dir),projectHtml(template,town,zone,zones,snapshot_date,root));
  urls.push(url.href);
 }
}
const entries=urls.map(url=>'  <url><loc>'+url.replaceAll('&','&amp;')+'</loc></url>');
const xml=['<?xml version="1.0" encoding="UTF-8"?>','<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',...entries,'</urlset>',''];
writeFileSync(new URL('../sitemap.xml',import.meta.url),xml.join('\n'));
writeFileSync(new URL('../robots.txt',import.meta.url),'User-agent: *\nAllow: /\n\nSitemap: '+root+'sitemap.xml\n');
