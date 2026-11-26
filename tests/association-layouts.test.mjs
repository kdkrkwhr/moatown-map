import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readdirSync,readFileSync} from 'node:fs';
import {buildExpandedLayouts,validateAssociationLayouts} from '../scripts/expanded-layouts.mjs';
import {buildDrawingModel,buildGeographicModel,pickSceneFeature,showTowerLabel} from '../pilot-scene.mjs';
import {hasPublicLayout,preferredPlacement,selectPublicLayout} from '../pilot-viewer.mjs';

const room=(x,y)=>[[x,y],[x+40,y],[x+40,y+12],[x+12,y+12],[x+12,y+24],[x,y+24],[x,y]];
const location=[[127,37.501],[127.0004,37.501],[127.0004,37.5011],[127,37.5011],[127,37.501]];
const layout={zone_id:'z',zone_name:'조합',source_url:'https://example.org/plan',image_url:'https://example.org/drawing',
  source_sha256:'f'.repeat(64),image_size:[800,400],checked_on:'2026-11-26',source_as_of:null,
  buildings:[{id:'a',label:'101동',ring:room(50,20),floors:12,geographic_ring:location},{id:'b',ring:room(99,86),floors:null}]};
const town={id:'t'},zone={id:'z',town_id:'t'};
const geo={type:'Polygon',coordinates:[[[126.999,37.5],[127.001,37.5],[127.001,37.502],[126.999,37.502],[126.999,37.5]]]};
const feature=id=>({type:'Feature',properties:{entity_id:id},geometry:geo});
const validate=l=>validateAssociationLayouts({town_id:'t',layouts:[l]},[zone]);

test('source-scoped drawings retain all corners, relative size, and orientation on a separate pixel plane',()=>{
  assert.deepEqual(validate(layout),[layout]);
  const model=buildDrawingModel(layout);
  assert.equal(model.perimeter,null);
  assert.equal(model.areas.length+model.blocks.length+model.spaces.length,0);
  const sourceOrigin=layout.buildings[0].ring[0],origin=model.towers[0].parts[0].rings[0][0];
  for(const [i,tower] of model.towers.entries()){
    assert.equal(tower.props.floors,layout.buildings[i].floors);
    assert.ok(tower.height>0);
    assert.equal(tower.parts[0].rings[0].length,layout.buildings[i].ring.length-1);
    for(const [j,[x,y]] of tower.parts[0].rings[0].entries()){
      assert.ok(Math.abs((x-origin[0])*model.pixelsPerUnit-(layout.buildings[i].ring[j][0]-sourceOrigin[0]))<1e-8);
      assert.ok(Math.abs((origin[1]-y)*model.pixelsPerUnit-(layout.buildings[i].ring[j][1]-sourceOrigin[1]))<1e-8);
    }
    assert.ok(tower.parts[0].indices.length>=3);
  }
});

test('the geographic scene uses only registered rings, including when a zone has no separate reference boundary',()=>{
  for(const areas of [[],[feature('z')]]){
    const scene=buildGeographicModel(feature('t'),areas,[],null,null,layout);
    assert.deepEqual(scene.towers.map(t=>t.id),['a']);
    const tower=scene.towers[0],ring=tower.parts[0].rings[0];
    assert.equal(ring.length,location.length-1);
    assert.ok(Math.abs(ring[1][0]-ring[0][0]-(location[1][0]-location[0][0])*111320*Math.cos(37.501*Math.PI/180))<.001);
    assert.equal(tower.height,36);
  }
});

test('drawings stand alone without a simulated program and deep links preserve explicit comparison modes',()=>{
  const scene=buildExpandedLayouts(town,[zone],new Map([['t',feature('t')]]),null,{}, {},null,[layout]);
  assert.deepEqual(scene.association_layouts,[layout]);
  assert.deepEqual(scene.modes,{});
  const input={modes:['association','town','zones'],association_zone_ids:['z']};
  assert.equal(preferredPlacement(input,null),'association');
  assert.equal(preferredPlacement(input,'z'),'association');
  assert.equal(preferredPlacement(input,'other'),'zones');
  assert.equal(preferredPlacement(input,'z','town'),'town');
  assert.equal(preferredPlacement(input,'other','association'),'zones');
  assert.equal(preferredPlacement({design:'key'},'z'),'design');
});

test('invalid source geometry, scope and floor assertions are rejected before publication',()=>{
  for(const edit of [{zone_id:'other'},{source_as_of:'unknown'},{source_sha256:''},{image_size:[4,4]},
    {buildings:[{...layout.buildings[0],ring:[[1,1],[2,2],[3,2]]}]},{buildings:[{...layout.buildings[0],floors:0}]}]){
    assert.throws(()=>validate({...layout,...edit}));
  }
});

test('a townwide public PDF opens at town scope while each child deep link selects its own drawing',()=>{
  const whole={...layout,zone_id:'t',zone_name:'대상지 통합',image_url:'https://example.org/project.pdf#page=8'};
  assert.deepEqual(validate(whole),[whole]);
  assert.equal(selectPublicLayout([layout,whole],'t',null),whole);
  assert.equal(selectPublicLayout([whole,layout],'t','z'),layout);
  assert.equal(selectPublicLayout([layout,whole],'t','other'),whole);
  const input={modes:['association','zones','town'],association_zone_ids:['z','t']};
  assert.equal(hasPublicLayout(input,'t','other'),true);
  assert.equal(preferredPlacement(input,'other',null,'t'),'association');
  assert.equal(preferredPlacement(input,'other','zones','t'),'zones');
  assert.equal(preferredPlacement({...input,association_zone_ids:['z']},'other',null,'t'),'zones');
});

test('temporary building labels appear only on selection while documented identifiers remain available on the scene',()=>{
  for(const label of [null,'도면 주거동 1','도면 주거동 15']){
    assert.equal(showTowerLabel({label},false),false);
    assert.equal(showTowerLabel({label},true),true);
  }
  for(const label of ['101동','A동'])assert.equal(showTowerLabel({label},false),true);
});

test('only documented space polygons occupy the drawing, share the building pixel scale and can be picked',()=>{
  const park={id:'p',kind:'playground',label:'어린이놀이터',ring:room(220,60)};
  const withSpace={...layout,spaces:[park]};
  assert.deepEqual(validate(withSpace),[withSpace]);
  const model=buildDrawingModel(withSpace),space=model.spaces[0],tower=model.towers[0];
  assert.equal(space.kind,'playground');
  assert.equal(space.name,park.label);
  const ground=space.parts[0].rings[0][0],origin=tower.parts[0].rings[0][0];
  assert.ok(Math.abs((ground[0]-origin[0])*model.pixelsPerUnit-(park.ring[0][0]-layout.buildings[0].ring[0][0]))<1e-8);
  assert.ok(Math.abs((origin[1]-ground[1])*model.pixelsPerUnit-(park.ring[0][1]-layout.buildings[0].ring[0][1]))<1e-8);
  const [x,y]=space.parts[0].anchor;
  const camera={x,y,width:400,height:360,scale:1,cosB:1,sinB:0,cosP:.8,sinP:.6,plan:true};
  assert.equal(pickSceneFeature(camera,model,200,180),space);
  assert.equal(buildGeographicModel(feature('t'),[],[],null,null,withSpace).spaces.length,0);
  for(const edit of [{label:''},{kind:'imagined'},{id:'a'},{ring:room(950,30)}]){
    assert.throws(()=>validate({...layout,spaces:[{...park,...edit}]}));
  }
});

test('the map keeps the separate public-space layer and adds only georeferenced drawing facilities as selectable shapes',()=>{
  const local={id:'p',kind:'playground',label:'어린이놀이터',ring:room(220,60)};
  const mapped={...local,id:'m',geographic_ring:location.map(([x,y])=>[x+.0005,y])};
  const withSpaces={...layout,spaces:[mapped,local]};
  assert.deepEqual(validate(withSpaces),[withSpaces]);
  const independent={features:[{geometry:{type:'Point',coordinates:[127,37.501]},properties:{name:'공원 위치',kind:'park',location_only:true}}]};
  const scene=buildGeographicModel(feature('t'),[],[],null,independent,withSpaces);
  assert.deepEqual(scene.spaces.map(s=>s.name),['공원 위치','어린이놀이터']);
  assert.ok(scene.spaces[0].point);
  const source=scene.spaces[1];
  assert.equal(source.id,'m');assert.equal(source.fromLayout,true);
  const [x,y]=source.parts[0].anchor,camera={x,y,width:400,height:360,scale:1,cosB:1,sinB:0,cosP:.8,sinP:.6,plan:true};
  assert.equal(pickSceneFeature(camera,scene,200,180),source);
  assert.throws(()=>validate({...layout,spaces:[{...mapped,geographic_ring:room(999,899)}]}));
});

test('published drawing sources, indexed zones and scene contents agree',()=>{
  const root=new URL('../moatown-data/',import.meta.url),dir=new URL('plans/association-layouts/',root);
  const read=path=>JSON.parse(readFileSync(new URL(path,root)));
  const latest=read('latest.json'),zones=read(latest.files.zones);
  for(const file of existsSync(dir)?readdirSync(dir).filter(f=>f.endsWith('.json')):[]){
    const input=read('plans/association-layouts/'+file);
    const layouts=validateAssociationLayouts(input,zones),entry=latest.pilot_3d.simulation_inputs[input.town_id];
    assert.deepEqual(entry.association_zone_ids,layouts.map(l=>l.zone_id));
    assert.ok(entry.modes.includes('association'));
    if(entry.path)assert.deepEqual(read(entry.path).association_layouts,layouts);
    else assert.equal(entry.association_path,'plans/association-layouts/'+file);
  }
});
