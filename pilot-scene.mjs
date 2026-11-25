import earcut from './vendor/earcut-3.0.2/earcut.mjs?v=0de51c63d593';

const DEG = Math.PI / 180;
const GROUND = '#f1f3ef';
export const AGE_COLORS = Object.freeze({
  '30_plus': '#ce815e', '20_to_29': '#d4aa64', under_20: '#82ac98', unknown: '#adb9bf',
});
const PLAN_COLORS = ['#b7d9d1', '#c8ded1', '#b9d7da', '#d3e0cc', '#c7d8df'];
const DEFAULT_BEARING = -24 * DEG;
const DEFAULT_PITCH = 47 * DEG;
const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
const shade = (color, gain) => color.map(component => Math.min(1, component * gain));
const cssColor = color => 'rgb(' + color.map(c => Math.round(255 * c)).join(',') + ')';

function polygonRings(geometry) {
  if (geometry?.type === 'Polygon') return [geometry.coordinates];
  if (geometry?.type === 'MultiPolygon') return geometry.coordinates;
  return [];
}

function extent(points) {
  const box = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of points) {
    box[0] = Math.min(box[0], x);
    box[1] = Math.min(box[1], y);
    box[2] = Math.max(box[2], x);
    box[3] = Math.max(box[3], y);
  }
  return box;
}

function contains(part, x, y) {
  const [minX, minY, maxX, maxY] = part.bounds;
  if (x < minX || y < minY || x > maxX || y > maxY) return false;
  let inside = false;
  for (const ring of part.rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [a, b] = ring[i], [c, d] = ring[j];
      if ((b > y) !== (d > y) && x < (c - a) * (y - b) / (d - b) + a) inside = !inside;
    }
  }
  return inside;
}

function localPart(raw, project) {
  const rings = raw.map(ring => {
    const points = ring.map(project);
    // Normalize the duplicated closing vertex before triangulating roofs and walls.
    if (points.length && points[0][0] === points.at(-1)[0] && points[0][1] === points.at(-1)[1]) points.pop();
    return points;
  }).filter(ring => ring.length >= 3);
  if (!rings.length) return null;
  const points = rings.flat();
  let total = rings[0].length;
  const holes = rings.slice(1).map(ring => {
    const offset = total;
    total += ring.length;
    return offset;
  });
  const indices = earcut(points.flat(), holes, 2);
  const bounds = extent(rings[0]);
  const part = { rings, points, indices, bounds };
  let sum = 0, sumX = 0, sumY = 0, largest = 0, interior;
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = [points[indices[i]], points[indices[i + 1]], points[indices[i + 2]]];
    const area = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
    const x = (a[0] + b[0] + c[0]) / 3, y = (a[1] + b[1] + c[1]) / 3;
    sumX += x * area;
    sumY += y * area;
    sum += area;
    if (area > largest) { largest = area; interior = [x, y]; }
  }
  const center = [sumX / sum, sumY / sum];
  part.area = sum;
  part.anchor = sum && contains(part, ...center) ? center : interior || points[0];
  return part;
}

function buildModel(town, zones, buildings, simulation, publicSpace) {
  const candidates = [town, ...zones, ...buildings].filter(Boolean);
  const reference = candidates.find(item => polygonRings(item.geometry).length);
  if (!reference) throw new Error('표시할 건물 또는 참고 경계 도형이 없습니다.');
  const geoBox = extent(polygonRings(reference.geometry).flatMap(poly => poly[0]));
  const lon = (geoBox[0] + geoBox[2]) / 2, lat = (geoBox[1] + geoBox[3]) / 2;
  const east = 111320 * Math.cos(lat * DEG);
  const project = ([x, y]) => [(x - lon) * east, (y - lat) * 111132];
  let next = 1;
  function feature(raw, kind) {
    if (!raw) return null;
    const parts = polygonRings(raw.geometry).map(poly => localPart(poly, project)).filter(Boolean);
    if (!parts.length) return null;
    const props = raw.properties || {};
    return {
      kind, props, parts, code: next++, id: kind === 'building' || kind === 'tower' ? props.id : props.entity_id,
      height: Number.isFinite(props.height_m) && props.height_m > 0 ? props.height_m : 0,
      anchor: parts.reduce((best, part) => part.area > best.area ? part : best).anchor,
    };
  }
  const perimeter = feature(town, 'town');
  const areas = zones.map(raw => feature(raw, 'zone')).filter(Boolean);
  const blocks = buildings.map(raw => feature(raw, 'building')).filter(Boolean);
  const zonesById = new Map(areas.map(zone => [zone.id, zone]));
  const towers = [];
  const simulatedZones = new Set();
  for (const raw of simulation?.features || []) {
    const key=raw.properties?.zone_id;
    const zone=key===perimeter?.id?perimeter:zonesById.get(key);
    if (!zone) continue;
    const tower = feature(raw, 'tower');
    if (!tower?.height || !Number.isInteger(tower.props.floors) || tower.props.floors < 1) continue;
    tower.zone = zone;
    towers.push(tower);
    simulatedZones.add(zone);
  }
  const spaces = [];
  for (const raw of publicSpace?.features || []) {
    const { kind, name, width_m } = raw.properties || {};
    if (!['park', 'facility', 'road', 'walkway', 'playground', 'open_space', 'green'].includes(kind)) continue;
    const parts = polygonRings(raw.geometry).map(poly => localPart(poly, project)).filter(Boolean);
    const paths = raw.geometry?.type === 'LineString' ? [raw.geometry.coordinates]
      : raw.geometry?.type === 'MultiLineString' ? raw.geometry.coordinates : [];
    const lines = paths.map(path => path.map(project)).filter(path => path.length >= 2);
    if (parts.length || (['road', 'walkway'].includes(kind) && lines.length)) {
      spaces.push({ kind, name, parts, lines, width: Number.isFinite(width_m) && width_m > 0 ? width_m : null });
    }
  }
  const focus = perimeter ? [perimeter] : areas.length ? areas : blocks;
  const focusPoints = focus.flatMap(item => item.parts.flatMap(part => part.rings[0]));
  return { perimeter, areas, blocks, towers, spaces, simulatedZones, focusPoints };
}

function material(current, plan, selected, { code = 0, mode = null, lift = 0 } = {}) {
  return { current, plan, selected, code, mode, lift,
    currentCss: cssColor(current), planCss: cssColor(plan), selectedCss: cssColor(selected) };
}

function nearSegment(x, y, a, b, radius) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = clamp(((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return (x - a[0] - t * dx) ** 2 + (y - a[1] - t * dy) ** 2 < radius ** 2;
}

// Illustrative canopy symbols are limited to the supplied park interior.
function parkTrees(part, spaces, towers) {
  const [left, bottom, right, top] = part.bounds;
  const pitch = Math.max(9, Math.sqrt((right - left) * (top - bottom) / 34));
  const trees = [];
  const obstacles = [...spaces.filter(s => s.kind !== 'park').flatMap(s => s.parts), ...towers.flatMap(t => t.parts)];
  function nearRim(polygon, x, y, radius) {
    return polygon.rings.some(ring => ring.some((a, i) => nearSegment(x, y, a, ring[(i + 1) % ring.length], radius)));
  }
  function clear(x, y, radius) {
    if (!contains(part, x, y) || nearRim(part, x, y, radius)) return false;
    if (obstacles.some(p => {
      const [x0, y0, x1, y1] = p.bounds;
      return x >= x0 - radius && x <= x1 + radius && y >= y0 - radius && y <= y1 + radius &&
        (contains(p, x, y) || nearRim(p, x, y, radius));
    })) return false;
    return !spaces.some(s => s.lines.some(line => line.slice(1).some((b, i) =>
      nearSegment(x, y, line[i], b, radius + (s.width || (s.kind === 'road' ? 3 : 2)) / 2))));
  }
  let index = 0;
  for (let row = bottom + pitch * .42; row < top; row += pitch) {
    for (let col = left + pitch * .42; col < right; col += pitch) {
      index++;
      const x = col + .23 * pitch * Math.sin(index * 13.17), y = row + .26 * pitch * Math.sin(index * 5.31);
      const radius = 2.3 + .55 * Math.sin(index * 1.73);
      if (clear(x, y, radius)) trees.push({ x, y, radius, index });
    }
  }
  return trees;
}

// These palettes and window bays illustrate building types. The registry identifies
// use and load-bearing structure, while finish colours and roof shapes are unknown.
const EXISTING_WALLS = {
  old: ['#caab99', '#d9bdac', '#bb9585', '#ddcdb7', '#c9b8a4', '#d5c5ae'],
  recent: ['#e1dbce', '#d1c5b7', '#e6dfd2', '#c5c3ba', '#d9cbbb', '#d3cdc5'],
  work: ['#c9c9bf', '#ced1c6', '#c8c1b5', '#d9cfc0'],
};
// Muted greens and greys occur throughout the city's Sinwol overview photograph.
const EXISTING_CAPS = ['#a6aca2', '#91a99a', '#b4b5a9', '#8a9f94', '#aaa79e', '#bcb9ab',
  '#88a59c', '#a3a9a0', '#99b2a1', '#b4ad9e', '#9d9f97', '#a5aaa8'];
const TILE_CAPS = ['#847f78', '#a08b7e', '#8d8980', '#a58576'];
const SHEET_CAPS = ['#a4aaab', '#989f9c', '#adb1aa', '#a6a9a3'];
const BAY = { villa: 6, house: 7, apartment: 8, commercial: 9, shop: 10, service: 11, plain: 12, entry: 13,
  school: 14, assembly: 15 };

function existingAppearance(block) {
  const { use = '', structure = '', roof = '', age_tier, floors } = block.props;
  // Stable between chunks, input ordering, and scene rebuilds.
  let seed = 2166136261;
  for (const c of String(block.id)) seed = Math.imul(seed ^ c.charCodeAt(0), 16777619) >>> 0;
  const housing = /주택|아파트|기숙사/.test(use);
  const commercial = /근린생활|판매|업무시설|상가/.test(use);
  const service = /공장|창고|도매|운수시설|자동차관련/.test(use);
  const masonry = /벽돌|연와|조적|블록|시멘트블럭/.test(structure);
  let tile = BAY.plain, span = 4.0;
  if (service) { tile = BAY.service; span = 6.2; }
  else if (commercial) { tile = BAY.commercial; span = 5.4; }
  else if (/교육연구/.test(use)) { tile = BAY.school; span = 6.4; }
  else if (/종교|집회/.test(use)) { tile = BAY.assembly; span = 4.6; }
  else if (housing && (/아파트/.test(use) || (/공동주택/.test(use) && floors >= 7))) { tile = BAY.apartment; span = 6.8; }
  else if (housing && (/단독/.test(use) || masonry)) { tile = BAY.house; span = 5.7; }
  else if (housing) { tile = BAY.villa; span = 6.0; }
  const palette = service ? EXISTING_WALLS.work : age_tier === '30_plus' ? EXISTING_WALLS.old : EXISTING_WALLS.recent;
  const caps = /기와/.test(roof) ? TILE_CAPS : /슬레이트|강판|철판|금속/.test(roof) ? SHEET_CAPS : EXISTING_CAPS;
  const context = rgb('#d9dad0');
  const color = hex => rgb(hex).map((c, i) => block.props.is_inside_town === false ? c * .79 + context[i] * .21 : c);
  return { tile, span, housing, commercial: commercial && !service, floors: Number.isInteger(floors) && floors > 0 ? floors : 0,
    wall: color(palette[seed % palette.length]), cap: color(caps[(seed >>> 12) % caps.length]) };
}

function geometry(model, existingDetail, partialPlan) {
  const surfaces = [];
  function add(rings, points, indices, paint, group, facade) {
    const face = { rings, points, indices, paint, group, facade };
    surfaces.push(face);
    return face;
  }
  function flat(part, z, paint, group) {
    const rings = part.rings.map(r => r.map(([x, y]) => [x, y, z]));
    add(rings, rings.flat(), part.indices, paint, group);
  }
  function quad(a, b, c, d, paint, group, facade) {
    const points = [a, b, c, d];
    return add([points], points, [0, 1, 2, 0, 2, 3], paint, group, facade);
  }
  function edge(a, b, width, z, paint, group) {
    const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy);
    if (length < 1e-5) return;
    const nx = -dy / length * width / 2, ny = dx / length * width / 2;
    const face = quad([a[0] + nx, a[1] + ny, z], [b[0] + nx, b[1] + ny, z],
      [b[0] - nx, b[1] - ny, z], [a[0] - nx, a[1] - ny, z], paint, group);
    if (group === 6) face.rimWidth = width;
  }
  function outline(part, width, z, paint, group, dashed = false) {
    for (const ring of part.rings) {
      let distance = 0;
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length];
        if (!dashed) { edge(a, b, width, z, paint, group); continue; }
        const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy);
        for (let dash = -(distance % 10); dash < length; dash += 10) {
          const start = Math.max(dash, 0), end = Math.min(dash + 7, length);
          if (end > start) edge([a[0] + dx * start / length, a[1] + dy * start / length],
            [a[0] + dx * end / length, a[1] + dy * end / length], width, z, paint, group);
        }
        distance += length;
      }
    }
  }

  const ground = rgb('#e6ebe2'), selectedArea = rgb('#90c6b9');
  const wholePlan=model.simulatedZones.has(model.perimeter);
  const modeledParts=partialPlan?[...model.simulatedZones].flatMap(area=>area.parts):[];
  const townFill = material(ground, rgb(wholePlan?'#deebd9':'#e0e8df'), ground);
  const townLine = material(rgb('#466d64'), rgb('#47776c'), rgb('#466d64'), { lift: 2.1 });
  for (const part of model.perimeter?.parts || []) flat(part, 0, townFill, 0);
  model.areas.forEach((zone, i) => {
    const hasTowers = model.simulatedZones.has(zone);
    const planFill = hasTowers ? '#e4e6d7' : PLAN_COLORS[i % PLAN_COLORS.length];
    const fill = material(rgb('#e1e8db'), rgb(planFill), selectedArea, { code: zone.code, lift: .4, mode: hasTowers||wholePlan ? 'current' : null });
    const planSurface = hasTowers && material(rgb(planFill), rgb(planFill), rgb('#d0ded0'), { code: zone.code, lift: .4, mode: 'plan' });
    const border = material(rgb('#99b2a3'), rgb('#5a9084'), rgb('#176354'), { code: zone.code, lift: 1.4,mode:wholePlan?'current':null });
    for (const part of zone.parts) {
      flat(part, 0, fill, 1);
      if (planSurface) flat(part, 0, planSurface, 1);
      outline(part, 1.5, 0, border, 3);
    }
  });
  for (const part of model.perimeter?.parts || []) outline(part, 2.1, 0, townLine, 4, true);

  function planPaint(hex, lift = 0) {
    const color = rgb(hex);
    return material(color, color, color, { mode: 'plan', lift });
  }
  const lawn = planPaint('#b7cf92', .55), lawnEdge = planPaint('#86a674', .63);
  const civicSite = planPaint('#d8c4cc', .57), civicEdge = planPaint('#af919c', .64);
  const roadBed = planPaint('#dad9cf', .73), asphalt = planPaint('#a8b1af', .81);
  const walkBed = planPaint('#b99b79', .88), paving = planPaint('#ead2ac', .94);
  for (const space of model.spaces) {
    const park = space.kind === 'park' || space.kind === 'green', facility = space.kind === 'facility', road = space.kind === 'road';
    const fill = park ? lawn : facility ? civicSite : road ? asphalt : space.kind==='playground'?planPaint('#e8ad86',.94):paving;
    const rim = park ? lawnEdge : facility ? civicEdge : road ? roadBed : walkBed;
    for (const part of space.parts) {
      flat(part, 0, fill, 2);
      outline(part, park ? 1.2 : .8, 0, material(rim.plan, rim.plan, rim.plan,
        { mode: 'plan', lift: fill.lift + .04 }), 2);
    }
    for (const line of space.lines) {
      // Unspecified widths are narrow cartographic strokes.
      const width = space.width || (road ? 3 : 2);
      const normals = line.slice(1).map(([x, y], i) => {
        const dx = x - line[i][0], dy = y - line[i][1], length = Math.hypot(dx, dy) || 1;
        return [-dy / length, dx / length];
      });
      const strip = (size, paint) => {
        const vertices = line.map(([x, y], i) => {
          const a = normals[Math.max(0, i - 1)], b = normals[Math.min(normals.length - 1, i)];
          const half = size / (2 * Math.max(.5, 1 + a[0] * b[0] + a[1] * b[1]));
          const nx = (a[0] + b[0]) * half, ny = (a[1] + b[1]) * half;
          return [[x + nx, y + ny, 0], [x - nx, y - ny, 0]];
        });
        for (let i = 1; i < vertices.length; i++) {
          quad(vertices[i - 1][0], vertices[i][0], vertices[i][1], vertices[i - 1][1], paint, 2);
        }
      };
      strip(width, rim);
      strip(width * (road ? .79 : .83), fill);
    }
  }
  const trunk = planPaint('#88795c');
  const foliage = ['#749963', '#89a861', '#608b68'].map(hex =>
    [.81, .92, 1, 1.08, 1.14, 1.02].map(gain => {
      const c = shade(rgb(hex), gain);
      return material(c, c, c, { mode: 'plan' });
    }));
  for (const space of model.spaces.filter(s => s.kind === 'park')) {
    for (const part of space.parts) {
      for (const { x, y, radius, index } of parkTrees(part, model.spaces, model.towers)) {
        const z = radius * 1.5, top = z + radius, tier = foliage[index % foliage.length];
        quad([x - .26, y, 0], [x + .26, y, 0], [x + .26, y, z], [x - .26, y, z], trunk, 6);
        quad([x, y - .26, 0], [x, y + .26, 0], [x, y + .26, z], [x, y - .26, z], trunk, 6);
        const crown = tier.map((_, i) => {
          const angle = (i + .23) * 2 * Math.PI / tier.length;
          return [x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, z];
        });
        for (let i = 0; i < crown.length; i++) {
          const a = crown[i], b = crown[(i + 1) % crown.length];
          const upper = [a, b, [x - .15 * radius, y + .20 * radius, top]];
          const lower = [b, a, [x, y, z - radius * .7]];
          add([upper], upper, [0, 1, 2], tier[i], 6);
          add([lower], lower, [0, 1, 2], tier[0], 6);
        }
      }
    }
  }

  const shadows = ['#c5cbbf', '#d2d6cc'].map(hex => {
    const color = rgb(hex);
    return material(color, color, color, { mode: 'exterior', lift: .65 });
  });
  for (const block of model.blocks) {
    const exterior = existingDetail && existingAppearance(block);
    const tier = rgb(AGE_COLORS[block.props.age_tier] || AGE_COLORS.unknown);
    const context = rgb('#d1d9d4');
    const current = block.props.is_inside_town === false
      ? tier.map((channel, i) => channel * .34 + context[i] * .66) : tier;
    const selected = rgb('#37947d');
    const insidePlan=partialPlan?modeledParts.some(part=>contains(part,...block.anchor)):block.props.is_inside_town!==false;
    const mode=insidePlan?'current':null;
    const paint = (light, lift = 0, finish) => {
      const p = material(shade(current, light), shade(context, .38 + light * .62), shade(selected, light),
        { code: block.code, mode, lift });
      if (finish) { p.exterior = finish; p.exteriorCss = cssColor(finish); }
      return p;
    };
    const roof = paint(1.05, .18, exterior && exterior.cap);
    const rim = paint(.78, .55, exterior && shade(exterior.wall, 1.09));
    const footprint = material(shade(current, .71), rgb('#a7b5af'), selected, { code: block.code, mode, lift: .95 });
    for (const part of block.parts) {
      if (!block.height) {
        if (existingDetail) {
          const fill = rgb('#ccd4d6');
          flat(part, 0, material(fill, fill, selected, { code: block.code, mode: 'exterior', lift: .7 }), 5);
        }
        outline(part, 1.05, 0, footprint, 5);
        continue;
      }
      const z = block.height;
      const perimeter = part.rings[0];
      const shadow = shadows[Number(block.props.is_inside_town === false)];
      const cast = ([x, y]) => [x + z * .23, y - z * .17, 0];
      let shadowFace;
      if (exterior) {
        const rings = part.rings.map(ring => ring.map(cast));
        shadowFace = add(rings, rings.flat(), [...part.indices], shadow, 2);
        // The projected roof and side strips form one filled silhouette per building.
        shadowFace.nonzero = true;
      }
      let frontage = -1, longest = 0;
      if (exterior?.floors) {
        for (let i = 0; i < perimeter.length; i++) {
          const a = perimeter[i], b = perimeter[(i + 1) % perimeter.length];
          const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
          if (length > longest) { longest = length; frontage = i; }
        }
      }
      walls(part, (a, b, sun, nx, ny, length) => {
        if (shadowFace && nx * .23 - ny * .17 < 0) {
          const strip = [[...a, 0], [...b, 0], cast(b), cast(a)], i = shadowFace.points.length;
          shadowFace.rings.push(strip);
          shadowFace.points.push(...strip);
          shadowFace.indices.push(i, i + 1, i + 2, i, i + 2, i + 3);
        }
        // Six lighting steps per palette colour bound the Canvas pattern cache.
        const finish = exterior && shade(exterior.wall, .79 + .045 * Math.round((sun + 1) * 2.5));
        const wall = paint(.74 + .15 * sun, 0, finish);
        let facade;
        if (exterior?.floors && length >= 3) {
          const tile = length < 4.1 ? BAY.plain : exterior.tile;
          const columns = Math.max(1, Math.round(length / exterior.span));
          const front = a === perimeter[frontage] && length >= 4.1;
          facade = { tile, columns, repeats: exterior.floors, nx, ny, floorHeight: z / exterior.floors,
            distantCss: cssColor(shade(finish, exterior.commercial ? .77 : exterior.housing ? .86 : .91)) };
          // Use one illustrated entrance on one broad wall. Only known retail-type
          // uses get display windows. The location is schematic, as is the facade.
          if (front && (exterior.commercial || exterior.housing)) facade.base = exterior.commercial ? BAY.shop : BAY.entry;
        }
        const face = quad([...a, 0], [...b, 0], [...b, z], [...a, z], wall, 6, facade);
        face.normal = { nx, ny };
      });
      flat(part, z, roof, 6);
      outline(part, .30, z, rim, 6);
    }
  }

  for (const [towerIndex, tower] of model.towers.entries()) {
    const paints = new Map();
    function finish(hex, gain = 1, lift = 0) {
      const key = [hex, gain, lift].join('/');
      if (!paints.has(key)) {
        const color = shade(rgb(hex), gain);
        paints.set(key, material(color, color, color.map((c, i) => c * [.98, 1, .98][i]),
          { code: tower.zone.code, mode: 'plan', lift }));
      }
      return paints.get(key);
    }
    const roof = finish(['#c1c6bb', '#c6c5b9', '#b9c4be'][towerIndex % 3], 1, .04), rim = finish('#faf4e5', 1, .12);
    const shadow = finish('#b4bdaa', 1, .48);
    const z = tower.height, floors = tower.props.floors, podium = z / floors;
    const accent = ['#b77858', '#6c8b81', '#a88962', '#7c91a0'][towerIndex % 4];
    for (const part of tower.parts) {
      const castX = z * .23, castY = -z * .16;
      const shadowRings = part.rings.map(ring => ring.map(([x, y]) => [x + castX, y + castY, 0]));
      add(shadowRings, shadowRings.flat(), part.indices, shadow, 2);
      let longest = 0, roofAxis;
      walls(part, (a, b, sun, nx, ny, length) => {
        const ux = (b[0] - a[0]) / length, uy = (b[1] - a[1]) / length;
        if (length > longest) { longest = length; roofAxis = [ux, uy]; }
        quad([...a, 0], [...b, 0], [b[0] + castX, b[1] + castY, 0], [a[0] + castX, a[1] + castY, 0], shadow, 2);
        const light = .86 + .13 * sun;
        const point = (t, depth, h) => [a[0] + ux * length * t + nx * depth, a[1] + uy * length * t + ny * depth, h];
        const wall = (start, end, depth, low, high, paint, tile, repeats = floors - 1) => {
          if (low >= high) return;
          quad(point(start, depth, low), point(end, depth, low), point(end, depth, high), point(start, depth, high),
            paint, 6, tile === undefined ? null : { tile, repeats, nx, ny });
        };
        const shell = finish('#fffaf1', light);
        // A stone plinth carries the entrance; the upper floor slabs follow the modeled floor count.
        const endWall = length < 21;
        const wings = Math.ceil(length / 51);
        for (let wing = 0; wing < wings; wing++) wall(wing / wings, (wing + 1) / wings, 0, 0, podium, shell, endWall ? 4 : 3, 1);
        if (length < 4) {
          wall(0, 1, 0, podium, z, shell);
        } else if (endWall && length > 16.8) {
          wall(0, .46, 0, podium, z, shell, 0);
          wall(.46, .51, 0, podium, z, finish(accent, light));
          wall(.51, 1, 0, podium, z, shell, 1);
        } else if (endWall) {
          wall(0, 1, 0, podium, z, shell, 2);
          wall(.10, .17, .08, podium, z - .45, finish(accent, light));
        } else {
          const bays = [[0, .075, 0, 4], [.075, .263, -.35, 0], [.263, .437, 0, 1],
            [.437, .563, -.8, 5], [.563, .737, 0, 1], [.737, .925, -.35, 0], [.925, 1, 0, 4]];
          for (let wing = 0; wing < wings; wing++) {
            const along = t => (wing + t) / wings;
            let previous = 0;
            for (const [start, end, depth, tile] of bays) {
              if (depth !== previous && floors > 1) {
                quad(point(along(start), previous, podium), point(along(start), depth, podium), point(along(start), depth, z),
                  point(along(start), previous, z), finish('#b8bbad', light), 6);
              }
              wall(along(start), along(end), depth, podium, z, tile === 5 ? finish('#e2ece6', light) : shell, tile);
              previous = depth;
            }
            wall(along(.405), along(.437), .08, podium, z, finish(accent, light));
            wall(along(.563), along(.595), .08, podium, z, finish(accent, light));
            quad(point(along(.408), -.8, podium), point(along(.592), -.8, podium),
              point(along(.592), .7, podium), point(along(.408), .7, podium), finish('#777e71'), 6);
          }
        }
        wall(0, 1, .04, z - .46, z, finish('#f6f0de', light));
      });
      flat(part, z, roof, 6);
      outline(part, .65, z, rim, 6);
      if (!roofAxis) continue;
      const [cx, cy] = part.anchor, [ux, uy] = roofAxis;
      function roofBox(offset, side, length, width, height, body, cap) {
        const corners = [[-1,-1],[1,-1],[1,1],[-1,1]].map(([sx, sy]) => {
          const u = offset + sx * length / 2, v = side + sy * width / 2;
          return [cx + ux * u - uy * v, cy + uy * u + ux * v];
        });
        if (!corners.every(([x, y]) => contains(part, x, y))) return;
        const lid = corners.map(([x, y]) => [x, y, z + height]);
        walls({ rings: [corners] }, (a, b, sun) =>
          quad([...a, z], [...b, z], [...b, z + height], [...a, z + height], finish(body, .86 + .13 * sun), 6));
        quad(...lid, finish(cap), 6);
      }
      roofBox((towerIndex % 3 - 1) * longest * .12, .6, 7.2, 4.1, 1.9, '#b0aaa0', '#f6eddb');
      roofBox(-longest * .27, -.6, 3.1, 1.6, .8, '#747f79', '#93a69e');
      roofBox(longest * .27, -.6, 3.1, 1.6, .8, '#747f79', '#93a69e');
    }
  }
  return surfaces;
}

function walls(part, draw) {
  for (const [ringIndex, ring] of part.rings.entries()) {
    let signed = 0;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      signed += a[0] * b[1] - a[1] * b[0];
    }
    const orientation = (signed >= 0 ? 1 : -1) * (ringIndex ? -1 : 1);
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy);
      if (length < .001) continue;
      // Fixed northwest lighting keeps the appearance consistent as the camera rotates.
      draw(a, b, (-.58 * dy - .81 * dx) * orientation / length,
        dy * orientation / length, -dx * orientation / length, length);
    }
  }
}

function makeCanvas() {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  return canvas;
}

const TILE_WIDTH = 128, TILE_HEIGHT = 64, ATLAS_TILES = 16;
// Each atlas tile is one architectural bay over one floor. Both renderers repeat
// the same elevation in building space, including when the view rotates or tilts.
function facadeAtlas() {
  const sheet = document.createElement('canvas');
  sheet.width = TILE_WIDTH * ATLAS_TILES;
  sheet.height = TILE_HEIGHT;
  const ctx = sheet.getContext('2d');
  function rect(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }
  function glass(x, y, w, h, panes) {
    rect(x - 2, y - 2, w + 4, h + 4, '#a5ada6');
    rect(x, y, w, h, '#516972');
    rect(x + 1, y + 2, w - 2, h * .52, '#79949b');
    rect(x + 1, y + 2 + h * .52, w - 2, h * .38, '#94a8a7');
    for (let i = 1; i < panes; i++) rect(x + i * w / panes - 1, y, 2, h, '#d0d4c8');
    rect(x, y, w, 2, '#455961');
  }
  for (let tile = 0; tile < 6; tile++) {
    ctx.save();
    ctx.translate(tile * TILE_WIDTH, 0);
    rect(0, 0, 128, 64, '#efeade');
    if (tile === 0) {
      rect(4, 5, 120, 52, '#9ba29b');
      glass(10, 10, 108, 41, 4);
      rect(5, 38, 118, 3, '#e7e6d8');
      rect(6, 41, 116, 11, '#a5b8b6');
      for (const x of [7, 43, 82, 119]) rect(x, 40, 2, 13, '#d9dfd2');
      rect(3, 53, 122, 7, '#f5f1e5');
      rect(4, 60, 120, 4, '#9b9e92');
    } else if (tile === 1) {
      glass(10, 11, 43, 34, 2);
      glass(76, 11, 40, 34, 2);
      rect(8, 46, 48, 3, '#bcbeb0');
      rect(73, 46, 46, 3, '#bcbeb0');
      rect(63, 0, 1, 64, '#d6d4c7');
    } else if (tile === 2) {
      rect(18, 0, 15, 64, '#d4ccb8');
      rect(78, 0, 25, 64, '#dfded1');
      glass(81, 14, 18, 27, 2);
      rect(0, 57, 128, 1, '#d6d2c3');
    } else if (tile === 3) {
      rect(0, 0, 128, 64, '#b9b5a6');
      rect(0, 0, 128, 9, '#dbd7c9');
      for (const x of [6, 25, 43, 59, 78, 98, 115]) glass(x, 14, 8, 42, 1);
      rect(0, 58, 128, 6, '#939c91');
    } else if (tile === 4) {
      rect(0, 0, 128, 64, '#e3ddcd');
      rect(0, 58, 128, 2, '#cac8ba');
    } else {
      rect(0, 0, 128, 64, '#899895');
      rect(0, 0, 18, 64, '#b9b9a8');
      rect(110, 0, 18, 64, '#dedbcb');
      glass(28, 6, 71, 41, 2);
      rect(17, 52, 94, 4, '#bfc8bb');
    }
    ctx.restore();
  }
  for (const tile of Object.values(BAY)) {
    ctx.save();
    ctx.translate(tile * TILE_WIDTH, 0);
    rect(0, 0, 128, 64, '#fcf9f1');
    if (tile === BAY.house) {
      glass(12, 13, 45, 31, 2);
      glass(80, 16, 30, 27, 2);
      rect(9, 45, 51, 3, '#e4ded0');
      rect(77, 44, 36, 3, '#e4ded0');
    } else if (tile === BAY.villa || tile === BAY.apartment) {
      const apartment = tile === BAY.apartment;
      glass(8, 10, apartment ? 85 : 65, 35, apartment ? 4 : 3);
      glass(apartment ? 106 : 88, 14, apartment ? 14 : 27, 27, 2);
      rect(5, 38, apartment ? 92 : 72, 12, '#acbbb8');
      rect(4, 36, apartment ? 94 : 74, 3, '#e6e9e2');
      for (const x of apartment ? [8, 35, 64, 92] : [8, 39, 72]) rect(x, 39, 2, 12, '#d6dcd2');
      rect(3, 51, apartment ? 96 : 76, 4, '#eee8da');
      rect(3, 55, apartment ? 96 : 76, 2, '#b7b6a8');
    } else if (tile === BAY.commercial) {
      glass(7, 11, 112, 36, 4);
      rect(4, 49, 119, 4, '#dcd8cc');
    } else if (tile === BAY.shop) {
      rect(0, 3, 128, 13, '#a3b2ac');
      rect(0, 15, 128, 4, '#738783');
      glass(5, 22, 77, 35, 2);
      glass(92, 20, 29, 41, 1);
      rect(94, 44, 2, 10, '#d0d7cf');
      rect(0, 61, 128, 3, '#a7a99f');
    } else if (tile === BAY.service) {
      for (let x = 3; x < 128; x += 14) rect(x, 0, 2, 64, '#dfdfd5');
      glass(13, 11, 100, 16, 4);
    } else if (tile === BAY.school) {
      glass(8, 10, 112, 34, 5);
      rect(8, 23, 112, 2, '#c5cdc6');
      rect(4, 45, 120, 4, '#d9d9cd');
    } else if (tile === BAY.assembly) {
      for (const x of [24, 55, 86]) {
        rect(x - 4, 6, 23, 48, '#d6d2c5');
        glass(x, 9, 15, 40, 1);
      }
    } else if (tile === BAY.entry) {
      glass(9, 13, 47, 28, 2);
      rect(74, 13, 37, 50, '#adb1a5');
      glass(79, 17, 26, 44, 2);
      rect(69, 10, 47, 4, '#e5e2d5');
      rect(72, 61, 41, 3, '#bdbdb0');
    } else {
      glass(34, 15, 55, 29, 2);
    }
    ctx.restore();
  }
  return sheet;
}

function webglRenderer(canvas, surfaces) {
  const gl = canvas.getContext('webgl', { antialias: true, alpha: false, depth: true });
  if (!gl) return null;
  const vertex = `
    attribute vec3 a_pos, a_current, a_plan, a_selected, a_options, a_uv, a_exterior;
    uniform vec2 u_center, u_scale, u_bearing, u_pitch, u_active;
    uniform float u_plan, u_exterior;
    varying vec3 v_color, v_uv;
    void main(){
      vec2 d = a_pos.xy - u_center;
      float east = dot(d, u_bearing);
      float north = dot(d, vec2(-u_bearing.y, u_bearing.x));
      float up = north * u_pitch.x + a_pos.z * u_pitch.y;
      float depth = a_pos.z * u_pitch.x - north * u_pitch.y + a_options.z;
      gl_Position = vec4(east * u_scale.x, up * u_scale.y, -depth / 4096.0, 1.0);
      if ((a_options.y < -0.5 && u_plan > 0.5) || (a_options.y > 0.5 && u_plan < 0.5) ||
          (a_options.y < -1.5 && u_exterior < 0.5))
        gl_Position = vec4(2.0,2.0,2.0,1.0);
      v_color = mix(mix(a_current, a_exterior, u_exterior), a_plan, u_plan);
      v_uv = a_uv;
      if (a_uv.z >= 6.0 && u_exterior < 0.5) v_uv.z = -1.0;
      if (a_options.x > 0.0 && (a_options.x == u_active.x || a_options.x == u_active.y)) {
        float tint = u_exterior > .5 && a_options.x == u_active.y && a_options.z < .4 ? .22 : 1.0;
        v_color = mix(v_color, a_selected, tint);
      }
    }`;
  const fragment = `precision mediump float;
    varying vec3 v_color, v_uv;
    uniform sampler2D u_sheet;
    void main(){
      vec3 color = v_color;
      if (v_uv.z >= 0.0) {
        float tile = floor(v_uv.z + .5);
        float u = v_uv.x;
        if (tile >= 6.0) {
          float ground = floor(tile / 16.0);
          tile = mod(tile, 16.0);
          if (v_uv.y < 1.0 && (ground == ${BAY.shop}.0 || (ground == ${BAY.entry}.0 && u < 1.0))) tile = ground;
          u = fract(u);
        }
        vec2 uv = vec2((tile + clamp(u, .012, .988)) / ${ATLAS_TILES}.0, v_uv.y);
        color *= texture2D(u_sheet, uv).rgb;
      }
      gl_FragColor = vec4(color, 1.0);
    }`;
  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error('3D 셰이더 초기화 실패');
    return shader;
  }
  const program = gl.createProgram();
  const shaders = [compile(gl.VERTEX_SHADER, vertex), compile(gl.FRAGMENT_SHADER, fragment)];
  shaders.forEach(shader => gl.attachShader(program, shader));
  gl.linkProgram(program);
  shaders.forEach(shader => gl.deleteShader(shader));
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('3D 프로그램 초기화 실패');
  gl.useProgram(program);
  const count = surfaces.reduce((n, face) => n + face.indices.length, 0);
  const textured = surfaces.some(face => face.facade);
  const existingDetail = surfaces.some(face => face.paint.exterior);
  const stride = 15 + (textured ? 3 : 0) + (existingDetail ? 3 : 0);
  const data = new Float32Array(count * stride);
  let offset = 0;
  for (const { indices, points, paint, facade } of surfaces) {
    const mode = paint.mode === 'exterior' ? -2 : paint.mode === 'current' ? -1 : paint.mode === 'plan' ? 1 : 0;
    const style = [...paint.current, ...paint.plan, ...paint.selected, paint.code, mode, paint.lift];
    for (const index of indices) {
      data.set(points[index], offset);
      data.set(style, offset + 3);
      if (textured) {
        if (facade) {
          data[offset + 15] = index === 1 || index === 2 ? facade.columns || 1 : 0;
          data[offset + 16] = index >= 2 ? facade.repeats : 0;
        }
        data[offset + 17] = facade ? facade.tile + (facade.base || 0) * ATLAS_TILES : -1;
      }
      if (existingDetail) data.set(paint.exterior || paint.current, offset + stride - 3);
      offset += stride;
    }
  }
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  ['pos', 'current', 'plan', 'selected', 'options'].forEach((name, i) => {
    const index = gl.getAttribLocation(program, 'a_' + name);
    gl.enableVertexAttribArray(index);
    gl.vertexAttribPointer(index, 3, gl.FLOAT, false, stride * 4, i * 12);
  });
  const uv = gl.getAttribLocation(program, 'a_uv');
  if (textured) {
    gl.enableVertexAttribArray(uv);
    gl.vertexAttribPointer(uv, 3, gl.FLOAT, false, stride * 4, 60);
  } else gl.vertexAttrib3f(uv, 0, 0, -1);
  if (existingDetail) {
    const index = gl.getAttribLocation(program, 'a_exterior');
    gl.enableVertexAttribArray(index);
    gl.vertexAttribPointer(index, 3, gl.FLOAT, false, stride * 4, (stride - 3) * 4);
  }
  const sheet = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, sheet);
  if (textured) {
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, facadeAtlas());
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  } else {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  }
  const uniforms = Object.fromEntries(['center', 'scale', 'bearing', 'pitch', 'active', 'plan', 'exterior']
    .map(name => [name, gl.getUniformLocation(program, 'u_' + name)]));
  gl.clearColor(...rgb(GROUND), 1);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  return {
    draw(view) {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.uniform2f(uniforms.center, view.x, view.y);
      gl.uniform2f(uniforms.scale, 2 * view.scale / view.width, 2 * view.scale / view.height);
      gl.uniform2f(uniforms.bearing, view.cosB, view.sinB);
      gl.uniform2f(uniforms.pitch, view.cosP, view.sinP);
      gl.uniform2f(uniforms.active, view.zone, view.building);
      gl.uniform1f(uniforms.plan, Number(view.plan));
      gl.uniform1f(uniforms.exterior, Number(view.exterior && !view.plan && existingDetail));
      gl.drawArrays(gl.TRIANGLES, 0, count);
    },
    destroy() {
      gl.deleteTexture(sheet);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}

// Canvas uses the identical metric mesh on devices without a working WebGL context.
function canvasRenderer(canvas, surfaces) {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('이 브라우저에서 3D 장면을 표시할 수 없습니다.');
  const faces = surfaces.map(face => {
    const count = face.points.length;
    const center = [0, 0, 0];
    for (const p of face.points) {
      center[0] += p[0] / count;
      center[1] += p[1] / count;
      center[2] += p[2] / count;
    }
    const radius = face.points.reduce((limit, p) =>
      Math.max(limit, Math.abs(p[0] - center[0]) + Math.abs(p[1] - center[1]) + Math.abs(p[2] - center[2])), 0);
    return { ...face, center, radius, depth: 0 };
  });
  const modeFaces = ['current', 'plan', 'exterior'].map(mode => faces.filter(f =>
    !f.paint.mode || f.paint.mode === mode || (mode === 'exterior' && f.paint.mode === 'current')));
  const tiles = new Map();
  let sheet;
  function facadePattern(tile, tint) {
    const key = tile + tint;
    if (!tiles.has(key)) {
      sheet ||= facadeAtlas();
      const swatch = document.createElement('canvas');
      swatch.width = TILE_WIDTH;
      swatch.height = TILE_HEIGHT;
      const color = swatch.getContext('2d');
      color.drawImage(sheet, tile * TILE_WIDTH, 0, TILE_WIDTH, TILE_HEIGHT, 0, 0, TILE_WIDTH, TILE_HEIGHT);
      color.globalCompositeOperation = 'multiply';
      color.fillStyle = tint;
      color.fillRect(0, 0, TILE_WIDTH, TILE_HEIGHT);
      tiles.set(key, ctx.createPattern(swatch, 'repeat'));
    }
    return tiles.get(key);
  }
  return {
    draw(view) {
      ctx.setTransform(canvas.width / view.width, 0, 0, canvas.height / view.height, 0, 0);
      ctx.fillStyle = GROUND;
      ctx.fillRect(0, 0, view.width, view.height);
      const visible = [];
      const exterior = view.exterior && !view.plan;
      for (const face of modeFaces[view.plan ? 1 : exterior ? 2 : 0]) {
        const normal = face.normal || face.facade;
        if (normal && normal.nx * view.sinB - normal.ny * view.cosB <= 0) continue;
        if (face.rimWidth && face.rimWidth * view.scale * canvas.width / view.width < .65) continue;
        const [x, y, z] = face.center;
        const [sx, sy] = screenPoint(view, x, y, z);
        const margin = face.radius * view.scale;
        if (sx < -margin || sx > view.width + margin || sy < -margin || sy > view.height + margin) continue;
        face.depth = (view.sinB * x - view.cosB * y) * view.sinP + z * view.cosP + face.paint.lift;
        visible.push(face);
      }
      visible.sort((a, b) => a.group - b.group || (a.group === 2 && a.paint.lift - b.paint.lift) || a.depth - b.depth);
      const verticalPixels = view.scale * view.sinP * canvas.height / view.height;
      for (const { paint, rings, facade, nonzero } of visible) {
        const active = paint.code && (paint.code === view.zone || paint.code === view.building);
        let color = view.plan ? paint.planCss : (exterior && paint.exteriorCss) || paint.currentCss;
        if (active) color = exterior && paint.exterior && paint.code === view.building && paint.lift < .4
          ? cssColor(paint.exterior.map((c, i) => c * .78 + paint.selected[i] * .22)) : paint.selectedCss;
        // Rows below two physical pixels resolve to their average tone at town scale.
        if (facade && exterior && !active && facade.floorHeight * verticalPixels < 2) color = facade.distantCss;
        else if (facade && (facade.tile < BAY.villa || exterior)) {
          const ring = rings[0];
          const [l, t] = screenPoint(view, ...ring[3]), [r, tr] = screenPoint(view, ...ring[2]);
          const [, b] = screenPoint(view, ...ring[0]), height = TILE_HEIGHT * facade.repeats;
          const width = TILE_WIDTH * (facade.columns || 1);
          ctx.save();
          ctx.transform((r - l) / width, (tr - t) / width, 0, (b - t) / height, l, t);
          ctx.fillStyle = facadePattern(facade.tile, color);
          ctx.fillRect(0, 0, width, height);
          if (facade.base) {
            ctx.fillStyle = facadePattern(facade.base, color);
            ctx.fillRect(0, height - TILE_HEIGHT, facade.base === BAY.entry ? TILE_WIDTH : width, TILE_HEIGHT);
          }
          ctx.restore();
          continue;
        }
        ctx.fillStyle = color;
        ctx.beginPath();
        for (const ring of rings) {
          for (let i = 0; i < ring.length; i++) {
            const [x, y] = screenPoint(view, ...ring[i]);
            if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
          }
          ctx.closePath();
        }
        if (rings.length > 1 && !nonzero) ctx.fill('evenodd'); else ctx.fill();
      }
    },
    destroy() { tiles.clear(); },
  };
}

function screenPoint(v, x, y, z = 0) {
  const dx = x - v.x, dy = y - v.y;
  return [v.width / 2 + (v.cosB * dx + v.sinB * dy) * v.scale,
    v.height / 2 - ((-v.sinB * dx + v.cosB * dy) * v.cosP + z * v.sinP) * v.scale];
}

function groundPoint(v, x, y) {
  const east = (x - v.width / 2) / v.scale;
  const north = (v.height / 2 - y) / (v.scale * v.cosP);
  return [v.x + v.cosB * east - v.sinB * north, v.y + v.sinB * east + v.cosB * north];
}

// An orthographic ray is a segment on the ground between z=0 and each roof height.
// The largest intersected z is the visible surface, including a courtyard's inner wall.
function pick(view, model, sx, sy) {
  const [x, y] = groundPoint(view, sx, sy);
  const zoneAtPoint = () => view.plan && model.simulatedZones.has(model.perimeter)?null:
    model.areas.find(area => area.parts.some(part => contains(part, x, y)));
  let best = -1, hit = null;
  for (const block of view.plan ? model.towers : model.blocks) {
    const distance = block.height * view.sinP / view.cosP;
    const dx = view.sinB * distance, dy = -view.cosB * distance;
    for (const part of block.parts) {
      const [minX, minY, maxX, maxY] = part.bounds;
      if (Math.max(x, x + dx) < minX || Math.min(x, x + dx) > maxX ||
          Math.max(y, y + dy) < minY || Math.min(y, y + dy) > maxY) continue;
      if (contains(part, x + dx, y + dy)) {
        if (block.height > best) { best = block.height; hit = block; }
        continue;
      }
      for (const ring of part.rings) {
        for (let i = 0; i < ring.length; i++) {
          const a = ring[i], b = ring[(i + 1) % ring.length];
          const ex = b[0] - a[0], ey = b[1] - a[1], det = dx * ey - dy * ex;
          if (Math.abs(det) < 1e-9) continue;
          const ax = a[0] - x, ay = a[1] - y;
          const t = (ax * ey - ay * ex) / det, u = (ax * dy - ay * dx) / det;
          if (t >= 0 && t <= 1 && u >= 0 && u <= 1 && t * block.height > best) {
            best = t * block.height;
            hit = block;
          }
        }
      }
    }
  }
  return hit?.zone || hit || zoneAtPoint();
}

const SCENE_STYLE = `
.pilot-world {position:relative;isolation:isolate;overflow:hidden;width:100%;height:100%;min-height:0;
  color:#24483e;background:#f1f3ef;touch-action:none;user-select:none;overscroll-behavior:contain;cursor:grab}
.pilot-world[data-dragging="true"] {cursor:grabbing}
.pilot-world canvas,.pilot-world-labels {position:absolute;inset:0;display:block;width:100%;height:100%}
.pilot-world-labels {pointer-events:none;overflow:hidden}
.pilot-space-label {position:absolute;top:0;left:0;pointer-events:none;color:#425344;
  font-family:inherit;font-size:10px;font-weight:650;line-height:1.3;white-space:nowrap;
  text-shadow:-1px -1px 1px #f7f7eb,1px 1px 1px #f7f7eb,1px -1px 1px #f7f7eb,-1px 1px 1px #f7f7eb}
.pilot-world-label {position:absolute;left:0;top:0;display:grid;place-items:center;gap:1px;pointer-events:auto;
  min-height:24px;max-width:145px;margin:0;padding:3px 8px;border:1px solid #a0b2a9;border-radius:5px;
  background:#ffffffed;color:#314d42;box-shadow:0 1px 4px #1b45371a;font:inherit;line-height:1.25;white-space:nowrap;
  font-size:11px;font-weight:700;cursor:pointer;letter-spacing:-.025em}
.pilot-world-label::before {content:'';position:absolute;inset:-7px -4px}
.pilot-world-label[aria-pressed="true"] {z-index:2;background:#175b4e;color:#fff;border-color:#104e42}
.pilot-world-label[hidden] {display:none}
.pilot-world-label span {max-width:100%;overflow:hidden;text-overflow:ellipsis}
.pilot-world-label small {font-size:10px;font-weight:550;color:#486458}
.pilot-world-label[aria-pressed="true"] small {color:#e5f4eb}
.pilot-world[data-mode="plan"] .pilot-world-label {padding:5px 8px}
.pilot-world-measure {position:absolute;left:13px;bottom:10px;display:flex;align-items:flex-end;gap:11px;pointer-events:none;
  color:#3a5449;text-shadow:0 1px 2px #fff;font-variant-numeric:tabular-nums}
.pilot-world-north,.pilot-world-scale {display:grid;justify-items:center;gap:2px;font-family:inherit;font-size:10px;line-height:1.15;font-weight:700}
.pilot-world-north i {position:relative;display:block;width:12px;height:16px;transform-origin:50% 55%}
.pilot-world-north i::before,.pilot-world-north i::after {content:"";position:absolute;inset:0;background:#36584c;clip-path:polygon(50% 0,50% 74%,8% 100%)}
.pilot-world-north i::after {background:#83a494;clip-path:polygon(50% 0,92% 100%,50% 74%)}
.pilot-world-scale i {display:block;height:5px;border:1.5px solid currentColor;border-top:0}
`;

function labelText(props) {
  if (props.plan_label) return props.plan_label;
  const fields = [];
  if (Number.isFinite(props.max_floors_above_ground)) fields.push(props.max_floors_above_ground + '층');
  if (Number.isFinite(props.height_m)) fields.push(props.height_m + 'm');
  return fields.length ? fields.join(' · ') : '층수·높이 미확인';
}

export async function createPilotScene(container, { buildings, town, zones, simulation, publicSpace,
  initialBearing, initialPitch, selectedZoneId = null, existingDetail = false, partialPlan=false, onSelect } = {}) {
  const model = buildModel(town, zones?.features || [], buildings?.features || [], simulation, publicSpace);
  let surfaces = geometry(model, existingDetail, partialPlan);
  const host = document.createElement('div');
  host.className = 'pilot-world';
  host.tabIndex = 0;
  host.setAttribute('role', 'group');
  host.setAttribute('aria-label', '3D 지도. 방향키로 이동, Q와 E로 회전, Shift와 위아래 방향키로 기울기, 더하기와 빼기로 확대·축소, Home으로 초기화.');
  const style = document.createElement('style');
  style.textContent = SCENE_STYLE;
  let canvas = makeCanvas();
  const overlay = document.createElement('div');
  overlay.className = 'pilot-world-labels';
  const measure = document.createElement('div');
  measure.className = 'pilot-world-measure';
  measure.setAttribute('aria-hidden', 'true');
  measure.innerHTML = '<span class="pilot-world-north"><b>N</b><i></i></span><span class="pilot-world-scale"><span></span><i></i></span>';
  const north = measure.querySelector('.pilot-world-north i');
  const scaleText = measure.querySelector('.pilot-world-scale span');
  const scaleLine = measure.querySelector('.pilot-world-scale i');
  host.append(style, canvas, overlay, measure);
  container.append(host);

  let renderer;
  function startCanvas() {
    const next = makeCanvas();
    canvas.replaceWith(next);
    canvas = next;
    renderer = canvasRenderer(canvas, surfaces || geometry(model, existingDetail, partialPlan));
    host.dataset.renderer = 'canvas';
  }
  try {
    try { renderer = webglRenderer(canvas, surfaces); }
    catch { renderer = null; }
    if (!renderer) startCanvas();
    else host.dataset.renderer = 'webgl';
    surfaces = null;
  } catch (error) {
    host.remove();
    throw error;
  }

  let frame = 0, destroyed = false, mode = 'current', activeBuilding = null;
  let currentStyle = existingDetail ? 'exterior' : 'age';
  const maxZoom = existingDetail ? 32 : 12;
  let activeZone = model.areas.find(zone => zone.id === selectedZoneId);
  const bearing = Number.isFinite(initialBearing) ? initialBearing * DEG : DEFAULT_BEARING;
  const tilt = Number.isFinite(initialPitch) ? clamp(initialPitch, 10, 74) * DEG : DEFAULT_PITCH;
  const camera = { x: 0, y: 0, bearing, pitch: tilt, zoom: 1 };
  const cosDefault = Math.cos(bearing), sinDefault = Math.sin(bearing);
  const focusBox = extent(model.focusPoints.map(([x, y]) => [cosDefault * x + sinDefault * y, -sinDefault * x + cosDefault * y]));
  const defaultEast = (focusBox[0] + focusBox[2]) / 2, defaultNorth = (focusBox[1] + focusBox[3]) / 2;
  const home = { x: cosDefault * defaultEast - sinDefault * defaultNorth,
    y: sinDefault * defaultEast + cosDefault * defaultNorth };
  const spanX = Math.max(80, focusBox[2] - focusBox[0]);
  const spanY = Math.max(80, (focusBox[3] - focusBox[1]) * Math.cos(tilt));
  let fittedScale = 0;
  Object.assign(camera, home);
  const abort = new AbortController();
  const options = { signal: abort.signal };

  function view() {
    const width = Math.max(1, host.clientWidth), height = Math.max(1, host.clientHeight);
    const fit = Math.min(width * .82 / spanX, height * .74 / spanY);
    // Mobile detail panels can change height between modes. Keep metres per pixel stable.
    if (!fittedScale && width > 1 && height > 1) fittedScale = fit;
    return {
      ...camera, width, height, scale: (fittedScale || fit) * camera.zoom, cosB: Math.cos(camera.bearing), sinB: Math.sin(camera.bearing),
      cosP: Math.cos(camera.pitch), sinP: Math.sin(camera.pitch), zone: activeZone?.code || 0,
      building: activeBuilding?.code || 0, plan: mode === 'plan', exterior: currentStyle === 'exterior',
    };
  }
  const labels = model.areas.map(zone => {
    const button = document.createElement('button');
    button.className = 'pilot-world-label';
    button.type = 'button';
    button.dataset.zoneId = zone.id;
    const title = document.createElement('span'), metrics = document.createElement('small');
    const n = zone.props;
    const short = n.source_label?.match(/A\d+|(?:\d+)구역/i)?.[0];
    title.textContent = n.label || n.name || short || n.source_label || '세부구역';
    metrics.textContent = labelText(n);
    button.title = title.textContent;
    button.append(title, metrics);
    button.addEventListener('click', () => choose(zone), options);
    overlay.append(button);
    return { zone, button, metrics };
  });
  const spaceLabels = [];
  const named = model.spaces.filter(s => s.name);
  const park = named.filter(s => s.kind === 'park').sort((a, b) =>
    Math.max(...b.parts.map(p => p.area)) - Math.max(...a.parts.map(p => p.area)))[0];
  const facility = named.find(s => s.kind === 'facility');
  const axis = named.filter(s => s.kind === 'road' || s.kind === 'walkway').sort((a, b) => (b.width || 0) - (a.width || 0))[0];
  for (const space of [park, facility, axis].filter(Boolean)) {
    const node = document.createElement('span');
    node.className = 'pilot-space-label';
    node.textContent = space.name;
    const part = space.parts.reduce((best, p) => !best || p.area > best.area ? p : best, null);
    let at = part?.anchor;
    if (!at) {
      const line = space.lines[0];
      const lengths = line.slice(1).map((b, i) => Math.hypot(b[0] - line[i][0], b[1] - line[i][1]));
      let left = lengths.reduce((sum, n) => sum + n, 0) / 2;
      for (let i = 0; i < lengths.length; i++) {
        if (left <= lengths[i]) {
          const t = lengths[i] ? left / lengths[i] : 0;
          at = line[i].map((value, k) => value + t * (line[i + 1][k] - value));
          break;
        }
        left -= lengths[i];
      }
    }
    if (at) { overlay.append(node); spaceLabels.push({ node, at, part }); }
  }

  function choose(feature) {
    if (!feature) return;
    if (feature.kind === 'town') return;
    if (feature.kind === 'zone') { activeZone = feature; activeBuilding = null; }
    else activeBuilding = feature;
    schedule();
    onSelect?.({ kind: feature.kind, id: feature.id });
  }

  function placeLabels(v) {
    const taken = [];
    const ordered = [...labels].sort((a, b) => Number(b.zone === activeZone) - Number(a.zone === activeZone));
    for (const { zone, button, metrics } of ordered) {
      if(v.plan && model.simulatedZones.has(model.perimeter)){button.hidden=true;continue;}
      button.setAttribute('aria-pressed', String(zone === activeZone));
      metrics.hidden = !v.plan || model.simulatedZones.has(zone);
      button.hidden = false;
      const [x, y] = screenPoint(v, ...zone.anchor);
      const w = button.offsetWidth, h = button.offsetHeight;
      // Compact offsets prevent adjacent districts' names from obscuring one another.
      const positions = [[0, 0], [0, -h * .85], [0, h * .85], [-w * .55, 0], [w * .55, 0]];
      let position;
      for (const [ox, oy] of positions) {
        const l = Math.round(x - w / 2 + ox), t = Math.round(y - h / 2 + oy);
        if (l < 2 || t < 2 || l + w > v.width - 2 || t + h > v.height - 2) continue;
        if (taken.some(box => l < box[2] + 2 && l + w + 2 > box[0] && t < box[3] + 2 && t + h + 2 > box[1])) continue;
        position = [l, t, l + w, t + h];
        break;
      }
      if (position) {
        button.style.transform = 'translate(' + position[0] + 'px,' + position[1] + 'px)';
        taken.push(position);
      } else button.hidden = true;
    }
    for (const { node, at, part } of spaceLabels) {
      node.hidden = !v.plan;
      if (node.hidden) continue;
      const [x, y] = screenPoint(v, ...at), w = node.offsetWidth, h = node.offsetHeight;
      node.hidden = true;
      const offsets = part ? [[0, 0], [0, h], [0, -h], [-w / 4, 0], [w / 4, 0]] : [[0, 0]];
      for (const [dx, dy] of offsets) {
        const l = Math.round(x + dx - w / 2), t = Math.round(y + dy - h / 2);
        if (part && !contains(part, ...groundPoint(v, x + dx, y + dy))) continue;
        if (l < 4 || t < 4 || l + w + 4 > v.width || t + h + 4 > v.height ||
            taken.some(b => l < b[2] + 3 && l + w + 3 > b[0] && t < b[3] + 3 && t + h + 3 > b[1])) continue;
        node.hidden = false;
        node.style.transform = 'translate(' + l + 'px,' + t + 'px)';
        taken.push([l, t, l + w, t + h]);
        break;
      }
    }
  }

  function render() {
    frame = 0;
    if (destroyed) return;
    const v = view(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(v.width * dpr)), h = Math.max(1, Math.round(v.height * dpr));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    host.dataset.mode = mode;
    host.dataset.currentStyle = currentStyle;
    renderer.draw(v);
    placeLabels(v);
    north.style.transform = 'rotate(' + Math.atan2(v.sinB, v.cosB * v.cosP) + 'rad)';
    const limit = 70 / v.scale;
    const decade = 10 ** Math.floor(Math.log10(limit));
    const multiple = limit / decade >= 5 ? 5 : limit / decade >= 2 ? 2 : 1;
    const meters = decade * multiple;
    scaleText.textContent = (meters >= 1000 ? meters / 1000 + ' km' : +meters.toFixed(2) + ' m');
    scaleLine.style.width = Math.round(meters * v.scale) + 'px';
  }
  function schedule() {
    if (!frame && !destroyed) frame = requestAnimationFrame(render);
  }
  function reset() {
    Object.assign(camera, home, { zoom: 1, bearing, pitch: tilt });
    fittedScale = 0;
    schedule();
  }
  function frameFeatures(features, minimumWidth, minimumHeight) {
    const v = view(), points = [];
    for (const feature of features) {
      const height = feature.kind === 'zone' ? 0 : feature.height + (v.plan ? 2 : 0);
      for (const part of feature.parts) {
        for (const [x, y] of part.rings[0]) {
          const east = v.cosB * x + v.sinB * y, north = (-v.sinB * x + v.cosB * y) * v.cosP;
          points.push([east, north + height * v.sinP]);
          if (features.length === 1 && feature.kind === 'building') points.push([east, north]);
        }
      }
    }
    const [left, bottom, right, top] = extent(points);
    const east = (left + right) / 2, north = (top + bottom) / (2 * v.cosP);
    camera.x = v.cosB * east - v.sinB * north;
    camera.y = v.sinB * east + v.cosB * north;
    const targetScale = .80 * Math.min(v.width / Math.max(minimumWidth, right - left), v.height / Math.max(minimumHeight, top - bottom));
    camera.zoom = clamp(targetScale / (v.scale / camera.zoom), .36, maxZoom);
    schedule();
  }
  function focusZone(id) {
    const zone = model.areas.find(area => area.id === id);
    if (!zone) return;
    const structures = mode === 'plan' ? model.towers.filter(t => t.zone === zone)
      : model.blocks.filter(b => zone.parts.some(part => contains(part, ...b.anchor)));
    frameFeatures([zone, ...structures], 1, 1);
  }
  function focusBuilding(id) {
    if (!existingDetail || mode !== 'current') return;
    const block = model.blocks.find(b => b.id === id);
    if (!block) return;
    frameFeatures([block], 40, 30);
    choose(block);
  }
  function panWorldAnchor(point, target) {
    const ground = groundPoint(view(), ...target);
    camera.x += point[0] - ground[0];
    camera.y += point[1] - ground[1];
  }
  function adjustZoom(delta, anchor) {
    const before = anchor && groundPoint(view(), ...anchor);
    camera.zoom = clamp(camera.zoom * 1.4 ** delta, .36, maxZoom);
    if (before) panWorldAnchor(before, anchor);
    schedule();
  }
  function rotate(degrees) {
    camera.bearing = (camera.bearing + degrees * DEG) % (2 * Math.PI);
    schedule();
  }
  function pitch(degrees) {
    camera.pitch = clamp(camera.pitch + degrees * DEG, 10 * DEG, 74 * DEG);
    schedule();
  }
  function pan(dx, dy) {
    const v = view();
    panWorldAnchor([v.x, v.y], [v.width / 2 + dx, v.height / 2 + dy]);
    schedule();
  }

  const pointers = new Map();
  let multi = false;
  const xy = event => {
    const rect = host.getBoundingClientRect();
    return [event.clientX - rect.left, event.clientY - rect.top];
  };
  function pair() {
    const [a, b] = [...pointers.values()].map(p => p.at);
    return { center: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
      angle: Math.atan2(b[1] - a[1], b[0] - a[0]), distance: Math.hypot(b[0] - a[0], b[1] - a[1]) };
  }
  host.addEventListener('pointerdown', event => {
    if (event.target.closest('button') || (event.button !== 0 && event.button !== 2)) return;
    const at = xy(event);
    pointers.set(event.pointerId, { start: at, at, moved: false, orbit: event.shiftKey || event.button === 2 });
    if (pointers.size > 1) multi = true;
    host.setPointerCapture(event.pointerId);
    host.focus({ preventScroll: true });
    host.dataset.dragging = 'true';
  }, options);
  host.addEventListener('pointermove', event => {
    const pointer = pointers.get(event.pointerId);
    if (!pointer) return;
    const next = xy(event), was = pointer.at;
    const before = pointers.size === 2 && pair();
    pointer.at = next;
    pointer.moved ||= Math.hypot(next[0] - pointer.start[0], next[1] - pointer.start[1]) > 4;
    if (pointers.size === 2) {
      const after = pair(), anchor = groundPoint(view(), ...before.center);
      if (before.distance > 4 && after.distance > 4) {
        camera.zoom = clamp(camera.zoom * after.distance / before.distance, .36, maxZoom);
        camera.bearing += after.angle - before.angle;
      }
      camera.pitch = clamp(camera.pitch + (after.center[1] - before.center[1]) * .18 * DEG, 10 * DEG, 74 * DEG);
      panWorldAnchor(anchor, after.center);
      schedule();
    } else if (pointers.size === 1 && pointer.moved) {
      if (pointer.orbit) {
        rotate((next[0] - was[0]) * .45);
        pitch((next[1] - was[1]) * .28);
      } else pan(next[0] - was[0], next[1] - was[1]);
    }
  }, options);
  function finishPointer(event, canceled) {
    const pointer = pointers.get(event.pointerId);
    if (!pointer) return;
    pointers.delete(event.pointerId);
    if (!canceled && !multi && !pointer.orbit && !pointer.moved) choose(pick(view(), model, ...xy(event)));
    if (!pointers.size) {
      multi = false;
      delete host.dataset.dragging;
    }
  }
  host.addEventListener('pointerup', event => finishPointer(event, false), options);
  host.addEventListener('pointercancel', event => finishPointer(event, true), options);
  host.addEventListener('lostpointercapture', event => finishPointer(event, true), options);
  host.addEventListener('contextmenu', event => event.preventDefault(), options);
  host.addEventListener('wheel', event => {
    event.preventDefault();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? host.clientHeight : 1;
    adjustZoom(clamp(-event.deltaY * unit / 190, -2, 2), xy(event));
  }, { ...options, passive: false });
  host.addEventListener('keydown', event => {
    if (event.target !== host || event.metaKey || event.ctrlKey || event.altKey) return;
    switch (event.key.toLowerCase()) {
      case '+': case '=': adjustZoom(1); break;
      case '-': adjustZoom(-1); break;
      case 'q': rotate(-15); break;
      case 'e': rotate(15); break;
      case 'arrowleft': event.shiftKey ? rotate(-10) : pan(32, 0); break;
      case 'arrowright': event.shiftKey ? rotate(10) : pan(-32, 0); break;
      case 'arrowup': event.shiftKey ? pitch(5) : pan(0, 32); break;
      case 'arrowdown': event.shiftKey ? pitch(-5) : pan(0, -32); break;
      case 'home': reset(); break;
      default: return;
    }
    event.preventDefault();
  }, options);
  if (host.dataset.renderer === 'webgl') {
    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      startCanvas();
      schedule();
    }, options);
  }
  const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
  resize?.observe(host);
  window.addEventListener('resize', schedule, options);
  render();
  return {
    setMode(next) {
      if (next !== 'current' && next !== 'plan') return;
      mode = next;
      if (mode === 'plan') activeBuilding = null;
      schedule();
    },
    setCurrentStyle(next) {
      if (!existingDetail || (next !== 'exterior' && next !== 'age') || currentStyle === next) return;
      currentStyle = next;
      schedule();
    },
    selectZone(id) {
      activeZone = model.areas.find(zone => zone.id === id);
      activeBuilding = null;
      schedule();
    },
    rotate, zoom: adjustZoom, pitch, pan, reset, focusZone, focusBuilding,
    getCamera() {
      return { centerX: camera.x, centerY: camera.y, bearing: camera.bearing / DEG,
        pitch: camera.pitch / DEG, zoom: camera.zoom, pixelsPerMeter: view().scale };
    },
    restoreCamera(snapshot) {
      if (!snapshot || ![snapshot.centerX, snapshot.centerY, snapshot.bearing, snapshot.pitch, snapshot.zoom].every(Number.isFinite)) return;
      camera.x = snapshot.centerX;
      camera.y = snapshot.centerY;
      camera.bearing = snapshot.bearing * DEG;
      camera.pitch = clamp(snapshot.pitch, 10, 74) * DEG;
      camera.zoom = clamp(snapshot.zoom, .36, maxZoom);
      if (Number.isFinite(snapshot.pixelsPerMeter) && snapshot.pixelsPerMeter > 0) fittedScale = snapshot.pixelsPerMeter / camera.zoom;
      schedule();
    },
    destroy() {
      destroyed = true;
      abort.abort();
      resize?.disconnect();
      if (frame) cancelAnimationFrame(frame);
      renderer.destroy();
      host.remove();
    },
  };
}
