import {readFileSync,writeFileSync} from 'node:fs';

const manifestUrl=new URL('../moatown-data/latest.json',import.meta.url);
const readJson=url=>JSON.parse(readFileSync(url,'utf8'));
const {files}=readJson(manifestUrl);
const root='https://'+readFileSync(new URL('../CNAME',import.meta.url),'utf8').trim()+'/';
const urls=[root,root+'news.html'];
for(const town of readJson(new URL(files.towns,manifestUrl))){
  urls.push(root+'?'+new URLSearchParams({town:town.id}));
}
for(const zone of readJson(new URL(files.zones,manifestUrl))){
  urls.push(root+'?'+new URLSearchParams({town:zone.town_id,zone:zone.id}));
}
const entries=urls.map(url=>'  <url><loc>'+url.replaceAll('&','&amp;')+'</loc></url>');
const xml=['<?xml version="1.0" encoding="UTF-8"?>','<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',...entries,'</urlset>',''];
writeFileSync(new URL('../sitemap.xml',import.meta.url),xml.join('\n'));
writeFileSync(new URL('../robots.txt',import.meta.url),'User-agent: *\nAllow: /\n\nSitemap: '+root+'sitemap.xml\n');
