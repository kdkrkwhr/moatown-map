import booleanPointInPolygon from './vendor/turf/boolean-point-in-polygon.mjs?v=ea63269c4509';
export function parseLot(value){
  const match=/^(?:서울(?:특별시|시)?\s+)?(?:([가-힣]+구)\s+)?([가-힣\d·.]+(?:동|가|로))\s+(산\s*)?(\d{1,4})(?:-(\d{1,4}))?(?:번지)?$/.exec(value.trim());
  if(!match || Number(match[4])===0)return null;
  return {district:match[1]??null,dong:match[2],lot:(match[3]?'산':'')+Number(match[4])+(Number(match[5])?'-'+Number(match[5]):'')};
}

export function matchingDistricts(index,key){
  return index.districts.filter(d=>(!key.district || d.name===key.district) && d.dongs.includes(key.dong));
}

// The 5 m tolerance uses local metre offsets. Turf handles holes and multipolygons.
export function positionInGeometry([lon,lat],geometry,margin=5){
  const polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.type==='MultiPolygon'?geometry.coordinates:[];
  const latitude=lat*Math.PI/180;
  const denominator=1-0.00669437999014*Math.sin(latitude)**2;
  const east=Math.PI/180*6378137*Math.cos(latitude)/Math.sqrt(denominator);
  const north=Math.PI/180*6378137*(1-0.00669437999014)/denominator**1.5;

  for(const polygon of polygons){

    for(const ring of polygon){
      for(let i=1;i<ring.length;i++){
        const [lonA,latA]=ring[i-1],[lonB,latB]=ring[i];
        const ax=(lonA-lon)*east,ay=(latA-lat)*north,dx=(lonB-lonA)*east,dy=(latB-latA)*north;
        const lengthSquared=dx*dx+dy*dy;
        const t=lengthSquared?Math.max(0,Math.min(1,-(ax*dx+ay*dy)/lengthSquared)):0;
        if(Math.hypot(ax+t*dx,ay+t*dy)<=margin)return 'near';

      }
    }

  }
  return polygons.length && booleanPointInPolygon([lon,lat],geometry)?'inside':'outside';
}

let postcodeReady;
function loadPostcode(){
  if(globalThis.kakao?.Postcode)return Promise.resolve();
  return postcodeReady ??=new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    function fail(){clearTimeout(timer);script.remove();postcodeReady=undefined;reject(Error('주소 검색 연결 실패'));}
    const timer=setTimeout(fail,12000);
    script.onload=()=>{if(globalThis.kakao?.Postcode){clearTimeout(timer);resolve();}else fail();};
    script.onerror=fail;script.src='https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
    document.head.append(script);
  });
}

export function geocodeSeoul(query,service=globalThis.naver?.maps?.Service){
  return new Promise((resolve,reject)=>{
    if(!service?.geocode){reject(Error('unavailable'));return;}
    const timer=setTimeout(()=>reject(Error('unavailable')),7000);
    service.geocode({query},(status,result)=>{
      clearTimeout(timer);
      if(status!==service.Status.OK){reject(Error('unavailable'));return;}
      const rows=result?.v2?.addresses??[];
      if(rows.length!==1 || (result?.v2?.meta?.totalCount??rows.length)!==1){resolve(null);return;}
      const row=rows[0],label=row.roadAddress||row.jibunAddress||'';
      const point=[Number.parseFloat(row.x),Number.parseFloat(row.y)];
      resolve(/^서울(?:특별시|시)?\s/.test(label) && point.every(Number.isFinite)?{label,point}:null);
    });
  });
}

export function mountAddressLookup(townById,boundaries,showPoint,mapAvailable=()=>Boolean(showPoint)){
  const $=id=>document.getElementById(id);
  const dialog=$('address-dialog'),input=$('address-lot'),output=$('address-answer'),picker=$('address-picker'),locate=$('locate-lot');
  const shapes=boundaries.features.filter(f=>f.properties.entity_type==='town' && townById.has(f.properties.entity_id));
  let version=0,result=null;
  const cache=new Map();
  function loadFile(name){
    if(!cache.has(name)){
      const request=fetch(new URL('./moatown-data/addresses/'+name,import.meta.url)).then(r=>{
        if(!r.ok)throw Error('좌표 파일 오류');
        return r.json();
      }).catch(error=>{cache.delete(name);throw error;});
      cache.set(name,request);
    }
    return cache.get(name);
  }
  function clear(){
    version++;result=null;locate.hidden=true;output.textContent='';picker.replaceChildren();
  }
  function display(point,label,kind){
    const hits=shapes.map(feature=>({feature,position:positionInGeometry(point,feature.geometry)})).filter(x=>x.position!=='outside');
    const note=hits.length?hits.map(({feature,position})=>townById.get(feature.properties.entity_id).name+' 참고 외곽 '+(position==='near'?'경계 5m 이내 · 고시 확인 필요':'안')).join(' · '):
      shapes.length?'수록된 서울 참고 외곽 밖 · 외곽 미수록 대상지는 판정 보류':'대조할 참고 외곽 자료 없음';
    result={point,hits,label,note};
    output.textContent=label+' · '+kind+' · '+note;locate.hidden=!mapAvailable();
  }
  async function lookup(){
    clear();
    const id=version,query=input.value.trim(),key=parseLot(query);
    if(!query || !/\d/.test(query)){output.textContent='동과 지번 또는 도로명과 건물번호를 입력해 주세요.';return;}
    const explicitRegion=/^(?:서울(?:특별시|시)?\s+|[^\s]+구\s+)/.test(query);
    output.textContent='주소 좌표를 조회하고 있습니다.';
    if(key){
      try{
        const options=matchingDistricts(await loadFile('index.json'),key);
        if(id!==version)return;
        if(options.length>1){output.textContent='같은 이름의 법정동이 있습니다. 자치구를 입력해 주세요. '+options.map(d=>d.name).join(' · ');return;}
        const district=options[0];
        if(district){
          const data=await loadFile(district.file);
          if(id!==version)return;
          const point=data.points[key.dong]?.[key.lot];
          if(point){display(point,district.name+' '+key.dong+' '+key.lot,'필지 내부 대표점');return;}
        }
        if(id!==version)return;
        output.textContent='필지 색인에서 이 지번을 확인하지 못했습니다. 법정동과 번지를 확인하거나 도로명주소 찾기를 이용하세요.';return;
      }catch{if(id===version)output.textContent='필지 색인을 불러오지 못했습니다. 잠시 후 다시 조회해 주세요.';return;}
    }
    if(!explicitRegion){output.textContent='자치구와 도로명·건물번호 또는 법정동·지번을 입력해 주세요.';return;}
    try{
      const address=await geocodeSeoul(query.startsWith('서울')?query:'서울특별시 '+query);
      if(id!==version)return;
      if(address)display(address.point,address.label,'주소 좌표');
      else output.textContent='하나의 서울 주소로 확인되지 않았습니다. 자치구와 번지를 확인해 주세요.';
    }catch{
      if(id===version)output.textContent='도로명 좌표 서비스에 연결할 수 없습니다. 서울 25개 구의 법정동과 지번으로 조회할 수 있습니다.';
    }
  }
  $('address-open').addEventListener('click',()=>{dialog.showModal();input.focus();});
  $('address-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',clear);
  input.addEventListener('input',clear);
  $('address-form').addEventListener('submit',event=>{event.preventDefault();lookup();});
  locate.addEventListener('click',()=>{if(result && showPoint){showPoint(result);dialog.close();}});
  $('address-road').addEventListener('click',async()=>{
    clear();
    const id=version;
    output.textContent='도로명주소 검색을 여는 중입니다.';
    try{
      await loadPostcode();if(id!==version || !dialog.open)return;
      output.textContent='';
      new globalThis.kakao.Postcode({width:'100%',height:'100%',oncomplete(data){
        if(id!==version || !dialog.open)return;
        if(!/^서울(?:특별시|시)?$/.test(data.sido)){clear();output.textContent='서울특별시의 주소를 선택해 주세요.';return;}
        const address=data.userSelectedType==='J'?data.jibunAddress:data.roadAddress;
        input.value=address||data.address||'';
        const jibun=data.jibunAddress||data.autoJibunAddress;
        if(jibun && parseLot(jibun))input.value=jibun;
        lookup();
      }}).embed(picker);
    }catch{if(id===version)output.textContent='도로명주소 검색에 연결하지 못했습니다. 지번으로 조회할 수 있습니다.';}
  });
}
