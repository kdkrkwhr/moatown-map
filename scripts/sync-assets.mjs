import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';

// Pages serves these HTML entry points and their local modules directly.
const root=new URL('../',import.meta.url);
const files=new Map();
const reference=/(["'])(\.\.?\/[^"'?#\s]+\.(?:mjs|css))(?:\?v=[\w.-]+)?\1/g;
const imageReference=/(["'])(\.\/assets\/[^"'?#\s]+\.(?:webp|svg))(?:\?v=[\w.-]+)?\1/g;
const imageVersions=new Map();
function versionImages(source,url){
  return source.replace(imageReference,(_,quote,relative)=>{
    const image=new URL(relative,url);
    if(!imageVersions.has(image.href)){
      const content=image.pathname.endsWith('.svg')?readFileSync(image,'utf8').replaceAll('\r\n','\n'):readFileSync(image);
      imageVersions.set(image.href,createHash('sha256').update(content).digest('hex').slice(0,12));
    }
    return quote+relative+'?v='+imageVersions.get(image.href)+quote;
  });
}
function visit(url){
  const path=url.href.slice(root.href.length);
  if(files.has(path))return;
  const source=readFileSync(url,'utf8');
  files.set(path,source);
  for(const [, ,relative] of source.matchAll(reference))visit(new URL(relative,url));
}
for(const page of ['index.html','news.html','qa.html'])visit(new URL(page,root));
const hash=createHash('sha256');
for(const path of [...files.keys()].sort()){
  const source=versionImages(files.get(path),new URL(path,root)).replace(reference,'$1$2$1').replaceAll('\r\n','\n');
  hash.update(path+'\0'+source+'\0');
}
const version=hash.digest('hex').slice(0,12);
const check=process.argv.includes('--check');
for(const [path,source] of files){
  const updated=versionImages(source,new URL(path,root)).replace(reference,'$1$2?v='+version+'$1');
  if(source===updated)continue;
  if(check){
    console.error(path+' 캐시 태그 갱신 필요 (node scripts/sync-assets.mjs)');
    process.exitCode=1;
  }else writeFileSync(new URL(path,root),updated);
}
