// Offsets are relative to the pin anchor. Captions sit above their point,
// while district labels and count buttons are centred on it.
const bubble={left:-25,right:25,top:-25,bottom:25};
function overlaps(a,b){
  const gap=4;
  return a.x+a.box.right+gap>b.x+b.box.left && b.x+b.box.right+gap>a.x+a.box.left &&
    a.y+a.box.bottom+gap>b.y+b.box.top && b.y+b.box.bottom+gap>a.y+a.box.top;
}
export function groupMarkers(points){
  const groups=[];
  for(const point of points){
    let group={...point,members:[point]};
    // Recheck after every merge: the new count button has a different footprint.
    for(let i=0;i<groups.length;){
      const other=groups[i];
      if(!overlaps(group,other)){i++;continue;}
      groups.splice(i,1);
      const members=group.members.concat(other.members);
      const x=members.reduce((sum,p)=>sum+p.x,0)/members.length;
      const y=members.reduce((sum,p)=>sum+p.y,0)/members.length;
      const distance=p=>(p.x-x)**2+(p.y-y)**2;
      const anchor=members.reduce((best,p)=>distance(p)<distance(best)?p:best);
      group={x:anchor.x,y:anchor.y,pin:anchor.pin,box:bubble,members};
      i=0;
    }
    groups.push(group);
  }
  return groups;
}

export function createMarkerClusters(m,map,container,{setVisible,choose,padding,measuring,measure}){
  const live=new Map();
  const dialog=document.getElementById('cluster-dialog');
  const list=document.getElementById('cluster-members'),heading=document.getElementById('cluster-heading');
  const zoom=document.getElementById('cluster-zoom');
  let boxes=new WeakMap(),opened;
  function open(entry,coord){
    if(measuring()){measure(coord??entry.pin.getPosition());return;}
    if(dialog.open)return;
    opened=entry;
    const members=entry.members.slice().sort((a,b)=>Number(b.selected)-Number(a.selected) || a.name.localeCompare(b.name,'ko'));
    heading.textContent=entry.title;
    list.replaceChildren();
    for(const member of members){
      const li=document.createElement('li'),button=document.createElement('button');
      button.type='button';
      if(member.selected)button.setAttribute('aria-current','true');
      const title=document.createElement('strong'),subtitle=document.createElement('small');
      title.textContent=member.name;subtitle.textContent=member.description;
      button.append(title,subtitle);li.append(button);list.append(li);
      button.onclick=()=>{dialog.close();choose(member);};
    }
    zoom.hidden=map.getZoom()>=21;
    dialog.showModal();
  }
  dialog.querySelector('.dialog-head button').onclick=()=>dialog.close();
  zoom.onclick=()=>{
    const points=opened.members.map(member=>member.pin.getPosition());
    dialog.close();map.fitBounds(points,{...padding(),maxZoom:Math.min(21,map.getZoom()+3)});
  };
  container.addEventListener('keydown',e=>{
    const entry=live.get(e.target.closest?.('.map-cluster')?.dataset.key);
    if(entry && (e.key==='Enter' || e.key===' ')){
      e.preventDefault();e.stopPropagation();open(entry);
    }
  },true);
  function measureLabels(candidates){
    const missing=candidates.filter(item=>!boxes.has(item.pin));
    if(!missing.length)return;
    const probe=document.createElement('div');
    probe.className='marker-measurements district-overview show-totals';probe.setAttribute('aria-hidden','true');
    const labels=missing.map(item=>item.pin.getIcon().content.cloneNode(true));
    probe.append(...labels);container.parentElement.append(probe);
    const origin=probe.getBoundingClientRect();
    labels.forEach((label,i)=>{
      const rect=label.getBoundingClientRect();
      boxes.set(missing[i].pin,{left:rect.left-origin.left,right:rect.right-origin.left,top:rect.top-origin.top,bottom:rect.bottom-origin.top});
    });
    probe.remove();
  }
  function render(candidates){
    const projection=map.getProjection();
    if(!projection)return;
    measureLabels(candidates);
    const points=candidates.map(item=>{
      const {x,y}=projection.fromCoordToOffset(item.pin.getPosition());
      return {...item,x,y,box:boxes.get(item.pin)};
    });
    const keep=new Set();
    for(const {pin,members} of groupMarkers(points)){
      const single=members.length===1;
      for(const member of members)setVisible(member.pin,single);
      if(single)continue;
      const key=members.map(p=>p.id).sort().join('|');
      keep.add(key);
      let entry=live.get(key);
      if(!entry){
        const button=document.createElement('button');
        button.type='button';button.className='map-cluster';button.dataset.key=key;
        button.setAttribute('aria-haspopup','dialog');
        const count=document.createElement('strong'),label=document.createElement('span');
        count.textContent=members.length;label.textContent=members[0].district?'자치구':'구역';
        button.append(count,label);
        const title=members[0].district?'자치구 '+members.length+'곳':'대상지·세부구역 '+members.length+'곳';
        button.setAttribute('aria-label',title+' 목록 열기');
        const marker=new m.Marker({position:pin.getPosition(),clickable:true,zIndex:151,title,icon:{content:button,anchor:new m.Point(0,0)}});
        entry={pin:marker,button,title,members};
        entry.listener=m.Event.addListener(marker,'click',e=>open(entry,e.coord));
        live.set(key,entry);
      }
      entry.members=members;
      entry.button.classList.toggle('has-selection',members.some(member=>member.selected));
      entry.pin.setPosition(pin.getPosition());setVisible(entry.pin,true);
    }
    for(const [key,entry] of live){
      if(keep.has(key))continue;
      m.Event.removeListener(entry.listener);entry.pin.setMap(null);live.delete(key);
    }
  }
  return {render,resetSizes(){boxes=new WeakMap();}};
}
