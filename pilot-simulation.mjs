import booleanPointInPolygon from './vendor/turf/boolean-point-in-polygon.mjs?v=b081ee7adfd6';

const LENGTH = 42, WIDTH = 14, UNITS_PER_FLOOR = 4;
// Small margins keep the minimum distances intact after projection to WGS84.
const SETBACK = 10.1, SEPARATION = 35.1;
const DESIGN_SEPARATION = 10.1, DESIGN_SETBACK = 5.1;
const radians = Math.PI / 180;

function polygons(geometry) {
  if (geometry?.type === 'MultiPolygon') return geometry.coordinates;
  if (geometry?.type === 'Polygon') return [geometry.coordinates];
  return [];
}

function localFrame([lon, lat]) {
  const phi = lat * radians;
  const w = 1 - 0.00669437999014 * Math.sin(phi) ** 2;
  const east = radians * 6378137 * Math.cos(phi) / Math.sqrt(w);
  const north = radians * 6378137 * (1 - 0.00669437999014) / w ** 1.5;
  return {
    project: ([x, y]) => [(x - lon) * east, (y - lat) * north],
    unproject: ([x, y]) => [lon + x / east, lat + y / north],
  };
}

function axes(degrees) {
  const c = Math.cos(degrees * radians), s = Math.sin(degrees * radians);
  return {
    rotate: ([x, y]) => [x * c - y * s, x * s + y * c],
    unrotate: ([x, y]) => [x * c + y * s, -x * s + y * c],
  };
}

function bounds(points) {
  let left = Infinity, right = -Infinity, bottom = Infinity, top = -Infinity;
  for (const [x, y] of points) {
    left = Math.min(left, x); right = Math.max(right, x);
    bottom = Math.min(bottom, y); top = Math.max(top, y);
  }
  return [left, bottom, right, top];
}

function edges(rings) {
  return rings.flatMap(ring => ring.slice(1).map((b, i) => {
    const a = ring[i];
    return { a, b, box: bounds([a, b]) };
  }));
}

function nearBoxes(a, b, gap) {
  return a[2] + gap >= b[0] && b[2] + gap >= a[0] &&
    a[3] + gap >= b[1] && b[3] + gap >= a[1];
}

function side([x, y], [u, v], [p, q]) {
  return (u - x) * (q - y) - (v - y) * (p - x);
}

function distanceSquared([x, y], [u, v], [p, q]) {
  const dx = p - u, dy = q - v, length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((x - u) * dx + (y - v) * dy) / length)) : 0;
  return (u + t * dx - x) ** 2 + (v + t * dy - y) ** 2;
}

function nearEdges(edge, other, gap) {
  if (!nearBoxes(edge.box, other.box, gap)) return false;
  const { a, b } = edge, { a: p, b: q } = other;
  if (nearBoxes(edge.box, other.box, 0) && side(a, b, p) * side(a, b, q) <= 0 &&
      side(p, q, a) * side(p, q, b) <= 0) return true;
  const limit = gap ** 2;
  return distanceSquared(a, p, q) < limit || distanceSquared(b, p, q) < limit ||
    distanceSquared(p, a, b) < limit || distanceSquared(q, a, b) < limit;
}

function rectangle(x, y, orientation, length, width) {
  const a = length / 2, b = width / 2;
  const ring = [[-a, -b], [a, -b], [a, b], [-a, b]].map(([dx, dy]) =>
    orientation.rotate([x + dx, y + dy]));
  ring.push(ring[0]);
  return { ring, center: orientation.rotate([x, y]), box: bounds(ring), edges: edges([ring]) };
}

function fitsSite(block, site) {
  if (!booleanPointInPolygon(block.center, site.geometry)) return false;
  for (const space of site.reserved) {
    if (!nearBoxes(block.box, space.box, space.clearance)) continue;
    if (space.geometry && booleanPointInPolygon(block.center, space.geometry)) return false;
    if (booleanPointInPolygon(space.start, {type:'Polygon',coordinates:[block.ring]})) return false;
    if (space.edges.some(edge => block.edges.some(other => nearEdges(edge, other, space.clearance)))) return false;
  }
  // A hole may fall entirely inside the footprint without crossing a wall.
  if(site.geometry.coordinates.slice(1).some(ring=>booleanPointInPolygon(ring[0],{type:'Polygon',coordinates:[block.ring]})))return false;
  // A road notch can cross a footprint between two interior corners.
  return !site.edges.some(edge => nearBoxes(block.box, edge.box, site.setback) &&
    block.edges.some(other => nearEdges(edge, other, site.setback)));
}

function separated(block, others, gap) {
  return !others.some(other => nearBoxes(block.box, other.box, gap) &&
    block.edges.some(edge => other.edges.some(next => nearEdges(edge, next, gap))));
}

function reservedSpace(features, frame) {
  const reserved=[];
  for(const feature of features){
    const {geometry,properties}=feature;
    const lines=geometry.type==='LineString'?[geometry.coordinates]:
      geometry.type==='MultiLineString'?geometry.coordinates:[];
    const add=(rings,polygon,clearance)=>reserved.push({start:rings[0][0],box:bounds(rings.flat()),
      edges:edges(rings),geometry:polygon?{type:'Polygon',coordinates:rings}:null,clearance});
    for(const polygon of polygons(geometry))add(polygon.map(r=>r.map(frame.project)),true,.2);
    for(const line of lines)add([line.map(frame.project)],false,(properties.width_m??0)/2+.2);
  }
  return reserved;
}

// Spread a finite program over the usable site, including sites with long, narrow wings.
function spreadAcrossSite(layout,target) {
  if(layout.length<=target)return layout;
  const remaining=layout.slice(),chosen=[];
  const [left,bottom,right,top]=bounds(layout.map(block=>block.center));
  let next=[(left+right)/2,(bottom+top)/2];
  let distances=remaining.map(()=>Infinity);
  while(chosen.length<target){
    distances=remaining.map((block,i)=>Math.min(distances[i],(block.center[0]-next[0])**2+(block.center[1]-next[1])**2));
    const index=distances.indexOf(chosen.length?Math.max(...distances):Math.min(...distances));
    const [block]=remaining.splice(index,1);
    distances.splice(index,1);chosen.push(block);next=block.center;
  }
  return chosen;
}

function layoutSite(site, occupied, target, settings) {
  if (!target) return [];
  const {length,width,gap,angles}=settings;
  const rowPitch = width + gap + .1, pitch = length + gap + .1;
  const candidates = [];
  let best = [];
  // Try different street-grid directions and row offsets at each site. Blocks
  // within one lattice already meet the edge clearance by construction.
  for (const angle of angles) {
    const orientation = axes(angle);
    const [left, bottom, right, top] = bounds(site.geometry.coordinates[0].map(orientation.unrotate));
    for (let offsetY = 0; offsetY < 4; offsetY++) {
      for (let offsetX = 0; offsetX < 4; offsetX++) {
        const layout = [];
        for (let y = bottom + site.setback + width / 2 + rowPitch * offsetY / 4; y <= top - site.setback - width / 2; y += rowPitch) {
          for (let x = left + site.setback + length / 2 + pitch * offsetX / 4; x <= right - site.setback - length / 2; x += pitch) {
            const block = rectangle(x, y, orientation,length,width);
            if (fitsSite(block, site) && separated(block, occupied,gap)) layout.push(block);
          }
        }
        if (layout.length >= target) return settings.spread?spreadAcrossSite(layout,target):layout.slice(0,target);
        if (layout.length > best.length) best = layout;
        candidates.push(...layout);
      }
    }
  }
  // Fill remaining pockets with a rotated block when the regular rows miss one.
  const placed = [...best];
  for (const block of candidates) {
    if (separated(block, placed,gap)) placed.push(block);
    if (placed.length >= target) break;
  }
  return placed;
}

function floorCap(zone, town) {
  if (Number.isInteger(zone?.floors) && zone.floors > 0) return [zone.floors, 'zone'];
  if (Number.isInteger(town?.floors) && town.floors > 0) return [town.floors, 'town'];
  return [20, 'default'];
}

function floorProfile(count, cap, units) {
  // A stepped skyline descends toward the southern edge. Drop floors evenly
  // within the 70–100% band. Geometry, this band and 4-unit floors can keep
  // modeled capacity from matching the published target exactly.
  const minimum = Math.ceil(cap * .7);
  const floors = Array.from({ length: count }, (_, i) =>
    count === 1 ? cap : minimum + Math.round((cap - minimum) * i / (count - 1)));
  const demand = units == null ? Infinity : Math.ceil(units / UNITS_PER_FLOOR);
  let excess = floors.reduce((sum, n) => sum + n, 0) - demand;
  if (excess < 0 && demand <= count * cap) {
    for (let i = count - 1; i >= 0 && excess < 0; i--) {
      const extra = Math.min(-excess, cap - floors[i]);
      floors[i] += extra;
      excess += extra;
    }
  }
  while (excess > 0 && floors.some(n => n > minimum)) {
    for (let i = 0; i < count && excess > 0; i++) {
      if (floors[i] > minimum) { floors[i]--; excess--; }
    }
  }
  return floors;
}

export function generateSimulation(areas, zoneMap, plans, {design=null, program=design, publicSpace=null, layout=null, schematic=false}={}) {
  const features = [], summaries = {}, occupied = [];
  const ordered = areas.filter(area => polygons(area.geometry)[0]?.[0]?.length >= 4 &&
    zoneMap.has(area.properties.entity_id)).sort((a, b) => a.properties.entity_id.localeCompare(b.properties.entity_id));
  if (!ordered.length) return { features, summaries };
  const frame = localFrame(polygons(ordered[0].geometry)[0][0][0]);
  const traced=design?(layout?.features??[]):[];
  const reserved=reservedSpace([...(publicSpace?.features??[]),...traced],frame);
  const ordinaryAngles=Array.from({length:12},(_,i)=>i*15);
  // A traced layout supplies a local street-grid reference for the Sinwol design.
  const compact=Boolean(design);
  const settings={length:compact?32:LENGTH,width:compact?16:WIDTH,gap:compact?DESIGN_SEPARATION:SEPARATION,spread:schematic,
    angles:publicSpace && traced.length?[27,117,12,102,42,132,...ordinaryAngles]:ordinaryAngles};
  for (const area of ordered) {
    const zoneId = area.properties.entity_id, zone = zoneMap.get(zoneId);
    const schematicPlan=schematic?(plans.zones[zoneId]??(area.properties.entity_type==='town'?plans.plan:null)):null;
    const records=design?.zones[zoneId]?.records??[];
    const shapes=traced.filter(f=>f.properties.zone_id===zoneId && polygons(f.geometry).length);
    const association=shapes.length && records.find(r=>r.stage_kind==='association_plan');
    const wholePlan=plans?.plan;
    const sameDocument=schematicPlan?.source_as_of && schematicPlan.source_url===wholePlan?.source_url &&
      schematicPlan.source_as_of===wholePlan.source_as_of;
    const useTownCap=!schematic || !wholePlan?.scope_geometry_mismatch && (schematicPlan===wholePlan || sameDocument);
    const [capFloors, capSource] = association?.floors?[association.floors,'association']:floorCap(plans?.zones?.[zoneId],useTownCap?wholePlan:null);
    const countRecord=records.find(r=>Number.isInteger(r.building_count) && r.building_count>0);
    const publishedProgram=program?.zones[zoneId]?.records?.find(r=>['approved_project_plan','public_inspection'].includes(r.stage_kind));
    const sameProgram=countRecord!=null && publishedProgram===countRecord;
    const unitValue=association?.units??publishedProgram?.units??(schematicPlan?schematicPlan.units:zone.planned_units_total);
    const units = Number.isInteger(unitValue) && unitValue >= 0 ? unitValue : null;
    const planHeight=plans?.zones?.[zoneId]?.height_m??schematicPlan?.height_m;
    const usePlanHeight=(capSource==='zone'||schematicPlan===plans?.plan && capSource==='town') && Number.isFinite(planHeight) && planHeight>0;
    const metersFor=floors=>usePlanHeight?Number((planHeight*floors/capFloors).toFixed(2)):floors*3;
    if(shapes.length){
      const profile=floorProfile(shapes.length,capFloors,null);
      const heights=shapes.map(({properties:p},i)=>Math.min(p.drawing_max_floors??p.floors??profile[i],capFloors));
      const meters=heights.map(metersFor);
      shapes.forEach((shape,i)=>{
        const floors=heights[i];
        const drawn=shape.properties.drawing_max_floors??shape.properties.floors;
        features.push({...shape,properties:{...shape.properties,floors,height_m:meters[i],
          height_source:usePlanHeight?'scaled_from_plan_max_height':drawn?'estimated_from_floors':'simulated_from_floors'}});
      });
      summaries[zoneId]={blocks:shapes.length,minFloors:Math.min(...heights),maxFloors:Math.max(...heights),capFloors,
        minHeight:Math.min(...meters),maxHeight:Math.max(...meters),usePlanHeight,capSource,units,countRecord,
        overlayNote:layout.metadata?.zone_notes?.[zoneId]??layout.metadata?.overlay_check?.note,sourceLayout:true,simulatedUnits:null,
        layoutLabel:layout.metadata?.layout_label??'조합 배치도',layoutUrl:layout.metadata?.source_url,layoutDate:layout.metadata?.source_as_of,
        hasDrawingFloors:shapes.every(shape=>Number.isInteger(shape.properties.drawing_max_floors))};
      continue;
    }
    const publishedCount=countRecord?.building_count??schematicPlan?.building_count??null;
    const targetBlocks = publishedCount ?? (units == null ? null : Math.ceil(units / (capFloors * UNITS_PER_FLOOR)));
    const blocks = [];
    const dimensions=new Set();
    for (const polygon of polygons(area.geometry)) {
      const rings = polygon.map(ring => ring.map(frame.project));
      const site = { geometry: { type: 'Polygon', coordinates: rings }, edges: edges(rings), reserved,
        setback:compact?DESIGN_SETBACK:SETBACK };
      const remaining=(targetBlocks??Infinity)-blocks.length;
      let placed=layoutSite(site,occupied,remaining,settings);
      let dimensionsLabel='42×14m · 경계 10m · 동간 35m';
      const compactSettings={...settings,length:32,width:16,gap:DESIGN_SEPARATION};
      const compactSite={...site,setback:DESIGN_SETBACK};
      if(schematic && placed.length<remaining && (Number.isFinite(remaining)||!placed.length)){
        const alternate=layoutSite(compactSite,occupied,remaining,compactSettings);
        if(alternate.length>placed.length){placed=alternate;dimensionsLabel='32×16m · 경계 5m · 동간 10m';}
      }
      if(schematic && (publishedCount||!placed.length) && placed.length<remaining){
        // A smaller example footprint can fit a documented count on an irregular site.
        const alternate=layoutSite(compactSite,occupied,remaining,{...compactSettings,length:24,width:12});
        if(alternate.length>placed.length){placed=alternate;dimensionsLabel='24×12m · 경계 5m · 동간 10m';}
      }
      if(schematic && !placed.length && remaining>0 && units>0 && units<=80){
        placed=layoutSite({...site,setback:3.1},occupied,remaining,{...compactSettings,length:16,width:9});
        dimensionsLabel='16×9m · 경계 3m · 동간 10m';
      }
      if(schematic&&placed.length)dimensions.add(dimensionsLabel);
      occupied.push(...placed);
      blocks.push(...placed);
    }
    blocks.sort((a, b) => a.center[1] - b.center[1] || a.center[0] - b.center[0]);
    // Where the public plan specifies both count and skyline, the four-units-per-floor
    // assumption must not lower that documented maximum.
    const modelCap=schematic && capSource==='default' && units>0 && blocks.length?
      Math.min(capFloors,Math.ceil(units/(blocks.length*UNITS_PER_FLOOR))):capFloors;
    const heights = floorProfile(blocks.length, modelCap, sameProgram||schematic && publishedCount ? null : units);
    const meters=heights.map(metersFor);
    blocks.forEach((block, i) => {
      const id = 'sim-' + zoneId + '-' + (i + 1), floors = heights[i];
      features.push({ type: 'Feature', id, properties: { id, zone_id: zoneId, floors,
        height_m: meters[i], height_source: usePlanHeight?'scaled_from_plan_max_height':'simulated_from_floors' },
        geometry: { type: 'Polygon', coordinates: [block.ring.map(frame.unproject)] } });
    });
    summaries[zoneId] = { blocks: blocks.length, minFloors: heights.length ? Math.min(...heights) : null,
      minHeight:meters.length?Math.min(...meters):null,maxHeight:meters.length?Math.max(...meters):null,usePlanHeight,
      maxFloors: heights.length ? Math.max(...heights) : null, capFloors, capSource, units, targetBlocks,
      simulatedUnits: heights.reduce((sum, n) => sum + n * UNITS_PER_FLOOR, 0),countRecord,publishedCount,
      ...(schematic?{dimensions:[...dimensions]}:{}) };
  }
  return { features, summaries };
}
