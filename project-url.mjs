export function projectUrl(town,zone,root='https://moatownmap.com/'){
  const url=new URL(root);
  if(town?.id){
    if(town.district)url.searchParams.set('district',town.district);
    url.searchParams.set('town',town.id);
    if(zone)url.searchParams.set('zone',zone.id);
  }else if(town?.address_raw){
    url.searchParams.set('cancellation',town.address_raw);
  }
  return url;
}
