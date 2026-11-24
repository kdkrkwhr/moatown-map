export function parseLot(value){
  const match=/^(?:(?:서울(?:특별시|시)?)\s+)?(?:([^\s]+구)\s+)?([^\s]+동)\s+(산\s*)?(\d+)(?:-(\d+))?(?:번지)?$/.exec(value.trim());
  if(!match || (match[1] && match[1]!=='마포구'))return null;
  return {dong:match[2],lot:(match[3]?'산':'')+Number(match[4])+(Number(match[5])?'-'+Number(match[5]):'')};
}

// Use local metre offsets for the boundary tolerance and ray crossings for polygon interiors.
export function positionInGeometry([lon,lat],geometry,margin=5){
  const polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.type==='MultiPolygon'?geometry.coordinates:[];
  const east=111320*Math.cos(lat*Math.PI/180),north=111320;
  let inside=false;
  for(const polygon of polygons){
    let within=false;
    for(const ring of polygon){
      for(let i=1;i<ring.length;i++){
        const [lonA,latA]=ring[i-1],[lonB,latB]=ring[i];
        const ax=(lonA-lon)*east,ay=(latA-lat)*north,dx=(lonB-lonA)*east,dy=(latB-latA)*north;
        const lengthSquared=dx*dx+dy*dy;
        const t=lengthSquared?Math.max(0,Math.min(1,-(ax*dx+ay*dy)/lengthSquared)):0;
        if(Math.hypot(ax+t*dx,ay+t*dy)<=margin)return 'near';
        if((latA>lat)!==(latB>lat) && lon<lonA+(lonB-lonA)*(lat-latA)/(latB-latA))within=!within;
      }
    }
    inside ||= within;
  }
  return inside?'inside':'outside';
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

export function mountAddressLookup(townById,boundaries,showPoint){
  const $=id=>document.getElementById(id);
  const dialog=$('address-dialog'),input=$('address-lot'),output=$('address-answer'),picker=$('address-picker'),locate=$('locate-lot');
  const shapes=boundaries.features.filter(f=>f.properties.entity_type==='town' && townById.get(f.properties.entity_id)?.district==='마포구');
  let indexPromise,version=0,result=null;
  function clear(){
    version++;result=null;locate.hidden=true;output.textContent='';picker.replaceChildren();
  }
  async function lookup(){
    clear();
    const id=version,key=parseLot(input.value);
    if(!key){output.textContent='마포구의 법정동과 지번을 입력해 주세요. 다른 자치구는 필지 좌표 미수록입니다.';return;}
    output.textContent='필지 좌표를 찾는 중입니다.';
    try{
      indexPromise ??=fetch(new URL('./moatown-data/addresses/mapo.json',import.meta.url)).then(r=>{
        if(!r.ok)throw Error('좌표 파일 오류');return r.json();
      }).catch(error=>{indexPromise=undefined;throw error;});
      const data=await indexPromise;
      if(id!==version)return;
      const point=data.points[key.dong]?.[key.lot];
      if(!point){output.textContent='이 지번의 필지 좌표가 수록되어 있지 않습니다.';return;}
      const hits=shapes.map(feature=>({feature,position:positionInGeometry(point,feature.geometry)})).filter(x=>x.position!=='outside');
      const label='마포구 '+key.dong+' '+key.lot;
      const note=hits.length?hits.map(({feature,position})=>townById.get(feature.properties.entity_id).name+' 참고 외곽 '+(position==='near'?'경계 부근(5m 이내)':'안')).join(' · '):
        shapes.length?'수록된 마포구 참고 외곽 밖':'대조할 참고 외곽 자료 없음';
      result={point,hits,label,note};
      output.textContent=label+'의 필지 대표점 · '+note;locate.hidden=!showPoint;
    }catch{if(id===version)output.textContent='좌표를 불러오지 못했습니다. 다시 조회해 주세요.';}
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
        if(!data.jibunAddress){clear();output.textContent='이 도로명주소에 대응하는 지번을 하나로 확인할 수 없습니다. 지번을 선택해 주세요.';return;}
        input.value=data.jibunAddress;lookup();
      }}).embed(picker);
    }catch{if(id===version)output.textContent='도로명주소 검색에 연결하지 못했습니다. 지번으로 조회할 수 있습니다.';}
  });
}
