import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';

// Both HTML pages and their local module graphs are served as plain files by Pages.
const root=new URL('../',import.meta.url);
const files=new Map();
const reference=/(["'])(\.\.?\/[^"'?#\s]+\.(?:mjs|css))(?:\?v=[\w.-]+)?\1/g;
function visit(url){
  const path=url.href.slice(root.href.length);
  if(files.has(path))return;
  const source=readFileSync(url,'utf8');
  files.set(path,source);
  for(const [, ,relative] of source.matchAll(reference))visit(new URL(relative,url));
}
for(const page of ['index.html','news.html'])visit(new URL(page,root));
const hash=createHash('sha256');
for(const path of [...files.keys()].sort()){
  const source=files.get(path).replace(reference,'$1$2$1').replaceAll('\r\n','\n');
  hash.update(path+'\0'+source+'\0');
}
const version=hash.digest('hex').slice(0,12);
const check=process.argv.includes('--check');
for(const [path,source] of files){
  const updated=source.replace(reference,'$1$2?v='+version+'$1');
  if(source===updated)continue;
  if(check){
    console.error(path+' 캐시 태그 갱신 필요 (node scripts/sync-assets.mjs)');
    process.exitCode=1;
  }else writeFileSync(new URL(path,root),updated);
}
