export function projectUrl(town,zone,root='https://moatownmap.com/'){
  const url=new URL(root);
  if(town?.id){
    url.pathname='/towns/'+encodeURIComponent(town.id)+'/'+(zone?.id?encodeURIComponent(zone.id)+'/':'');
  }else if(town?.address_raw){
    url.searchParams.set('cancellation',town.address_raw);
  }
  return url;
}

// Old map links carry the selection in the query. Published detail pages use the path.
export function projectParams(url){
  const params=new URLSearchParams(url.search);
  const match=/^\/towns\/([\w-]+)(?:\/([\w-]+))?\/?$/.exec(url.pathname);
  if(match){
    params.set('town',match[1]);
    params.delete('zone');
    if(match[2])params.set('zone',match[2]);
  }
  return params;
}

export function setProjectPath(url,town,zone){
  url.pathname=projectUrl(town,zone).pathname;
  url.searchParams.delete('town');
  url.searchParams.delete('zone');
  return url;
}
