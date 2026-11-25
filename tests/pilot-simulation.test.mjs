import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import booleanPointInPolygon from '../vendor/turf/boolean-point-in-polygon.mjs';
import { generateSimulation } from '../pilot-simulation.mjs';

const dataRoot = new URL('../moatown-data/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('latest.json', dataRoot)));
const read = key => JSON.parse(readFileSync(new URL(manifest.files[key], dataRoot)));
const town = 'mt-202603-public-067';
const zones = new Map(read('zones').filter(z => z.town_id === town).map(z => [z.id, z]));
const areas = read('boundaries').features.filter(f => zones.has(f.properties.entity_id));
const plans = read('pilot_plans').towns[town];

// Independent WGS84 degree-length series for measuring distances near Sinwol.
const lon = 126.83, lat = 37.535, phi = lat * Math.PI / 180;
const north = 111132.92 - 559.82 * Math.cos(2 * phi) + 1.175 * Math.cos(4 * phi);
const east = 111412.84 * Math.cos(phi) - 93.5 * Math.cos(3 * phi) + .118 * Math.cos(5 * phi);
const meters = ([x, y]) => [(x - lon) * east, (y - lat) * north];
const degrees = ([x, y]) => [lon + x / east, lat + y / north];
const length = ([x, y], [u, v]) => Math.hypot(u - x, v - y);

function pointDistance(p, a, b) {
  const size = length(a, b);
  if (!size) return length(p, a);
  const t = ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / size ** 2;
  if (t <= 0) return length(p, a);
  if (t >= 1) return length(p, b);
  return Math.abs((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) / size;
}

function ringDistance(ring, other) {
  let nearest = Infinity;
  for (let i = 1; i < ring.length; i++) {
    const a = ring[i - 1], b = ring[i];
    for (let j = 1; j < other.length; j++) {
      const c = other[j - 1], d = other[j];
      const dx = b[0] - a[0], dy = b[1] - a[1], ex = d[0] - c[0], ey = d[1] - c[1];
      const det = dx * ey - dy * ex;
      if (det !== 0) {
        const t = ((c[0] - a[0]) * ey - (c[1] - a[1]) * ex) / det;
        const u = ((c[0] - a[0]) * dy - (c[1] - a[1]) * dx) / det;
        if (0 <= t && t <= 1 && 0 <= u && u <= 1) return 0;
      }
      nearest = Math.min(nearest, pointDistance(a, c, d), pointDistance(b, c, d),
        pointDistance(c, a, b), pointDistance(d, a, b));
    }
  }
  return nearest;
}

const result = generateSimulation(areas, zones, plans);
test('Sinwol uses separate district caps, unit targets and repeatable footprints', () => {
  assert.deepEqual(result, generateSimulation(areas.toReversed(), zones, plans));
  assert.equal(Object.keys(result.summaries).length, 4);
  assert.equal(new Set(result.features.map(f => f.id)).size, result.features.length);
  for (const [id, zone] of zones) {
    const summary = result.summaries[id];
    const blocks = result.features.filter(f => f.properties.zone_id === id);
    const first = zone.drawing_code === 'A1';
    assert.ok(blocks.length > 1);
    assert.equal(summary.blocks, blocks.length);
    assert.equal(summary.capFloors, first ? 13 : 15);
    assert.equal(summary.capSource, first ? 'zone' : 'town');
    assert.equal(summary.units, zone.planned_units_total);
    assert.equal(summary.targetBlocks, Math.ceil(summary.units / (summary.capFloors * 4)));
    const floors = blocks.map(f => f.properties.floors);
    assert.equal(summary.minFloors, Math.min(...floors));
    assert.equal(summary.maxFloors, Math.max(...floors));
    assert.ok(summary.minFloors < summary.maxFloors);
    assert.ok(summary.minFloors >= Math.ceil(summary.capFloors * .7));
    assert.ok(summary.maxFloors <= summary.capFloors);
    assert.equal(summary.simulatedUnits, floors.reduce((sum, value) => sum + value * 4, 0));
    for (const { id: buildingId, properties: p } of blocks) {
      assert.equal(p.id, buildingId);
      assert.equal(p.height_source, 'simulated_from_floors');
      assert.equal(p.height_m, p.floors * 3);
    }
  }
});

test('all 42 × 14 m footprints meet boundary and interbuilding clearances across the actual A1–A4 geometries', () => {
  const rings = result.features.map(f => f.geometry.coordinates[0].map(meters));
  for (const [i, feature] of result.features.entries()) {
    const area = areas.find(a => a.properties.entity_id === feature.properties.zone_id);
    const ring = rings[i];
    assert.deepEqual(ring[0], ring[4]);
    for (let j = 1; j < ring.length; j++) {
      assert.ok(Math.abs(length(ring[j], ring[j - 1]) - (j % 2 ? 42 : 14)) < .01);
      assert.ok(booleanPointInPolygon(feature.geometry.coordinates[0][j], area, { ignoreBoundary: true }));
    }
    for (const boundary of area.geometry.coordinates) {
      assert.ok(ringDistance(ring, boundary.map(meters)) >= 10, feature.id + ' setback');
    }
    for (const next of rings.slice(i + 1)) assert.ok(ringDistance(ring, next) >= 35, feature.id + ' spacing');
  }
});

function area(rings) {
  return { type: 'Feature', properties: { entity_id: 'site' },
    geometry: { type: 'Polygon', coordinates: rings.map(ring => ring.map(degrees)) } };
}

test('the design view preserves the independently measured A3 layout and dated A1 program',()=>{
  const design=read('sinwol_design'),layout=read('sinwol_layout'),publicSpace=read('sinwol_public_space');
  const scene=generateSimulation(areas,zones,plans,{design,publicSpace,layout});
  const a1=scene.summaries['mz-plan-584443-a1'],a3=scene.summaries['mz-plan-584443-a3'];
  assert.equal(a1.blocks,5);
  assert.equal(a1.countRecord.stage_kind,'contractor_selection');
  assert.equal(a1.capFloors,13);
  assert.equal(a3.units,642);
  assert.equal(a3.capFloors,14);
  assert.equal(a3.blocks,layout.features.length);
  assert.equal(a3.sourceLayout,true);
  for(const f of layout.features){
    assert.equal(f.properties.floors,null);
    assert.deepEqual(scene.features.find(g=>g.properties.id===f.properties.id)?.geometry,f.geometry);
  }
  for(const f of scene.features.filter(f=>f.properties.zone_id!=='mz-plan-584443-a3')){
    const ring=f.geometry.coordinates[0];
    for(const space of publicSpace.features){
      const polygon=space.geometry.type==='Polygon';
      const line=polygon?space.geometry.coordinates[0]:space.geometry.coordinates;
      assert.ok(ringDistance(ring.map(meters),line.map(meters))>(space.properties.width_m??0)/2);
      if(polygon)assert.ok(ring.every(p=>!booleanPointInPolygon(p,space)));
    }
  }
  const legacy=generateSimulation(areas,zones,plans,{publicSpace});
  assert.ok(legacy.features.length<scene.features.length);
  assert.ok(!legacy.summaries['mz-plan-584443-a3'].sourceLayout);
});
function simulate(site, units, plan = {}) {
  return generateSimulation([site], new Map([['site', { planned_units_total: units }]]), plan);
}
const square = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]];

test('a small hole and a narrow concave notch both exclude otherwise fitting rectangles', () => {
  const outer = square(0, 0, 64, 36);
  assert.equal(simulate(area([outer]), 50).features.length, 1);
  assert.equal(simulate(area([outer, square(21, 15, 2, 2).reverse()]), 50).features.length, 0);
  const notch = [[0, 0], [21, 0], [21, 20], [23, 20], [23, 0], [64, 0], [64, 36], [0, 36], [0, 0]];
  assert.equal(simulate(area([notch]), 50).features.length, 0);
});

test('published units affect massing and zero, partial and missing plans have distinct behavior', () => {
  const site = area([square(0, 0, 360, 250)]);
  const none = simulate(site, 0);
  assert.equal(none.features.length, 0);
  assert.equal(none.summaries.site.minFloors, null);
  const small = simulate(site, 8), larger = simulate(site, 319);
  assert.equal(small.summaries.site.capSource, 'default');
  assert.equal(small.summaries.site.capFloors, 20);
  assert.equal(small.features.length, 1);
  assert.equal(small.features[0].properties.floors, 14);
  assert.equal(small.summaries.site.simulatedUnits, 56);
  assert.equal(larger.features.length, 4);
  assert.equal(larger.summaries.site.simulatedUnits, 320);
  assert.equal(simulate(site, 40, { plan: { floors: 10 } }).summaries.site.capSource, 'town');
  const missing = simulate(area([square(0, 0, 64, 36)]), null);
  assert.equal(missing.summaries.site.units, null);
  assert.equal(missing.summaries.site.targetBlocks, null);
  assert.equal(missing.summaries.site.blocks, 1);
});
