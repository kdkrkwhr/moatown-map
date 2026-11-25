import earcut from './vendor/earcut-3.0.2/earcut.mjs?v=669df25d30a5';

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

function buildModel(town, zones, buildings) {
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
      kind, props, parts, code: next++, id: kind === 'building' ? props.id : props.entity_id,
      height: Number.isFinite(props.height_m) && props.height_m > 0 ? props.height_m : 0,
      anchor: parts.reduce((best, part) => part.area > best.area ? part : best).anchor,
    };
  }
  const perimeter = feature(town, 'town');
  const areas = zones.map(raw => feature(raw, 'zone')).filter(Boolean);
  const blocks = buildings.map(raw => feature(raw, 'building')).filter(Boolean);
  const focus = perimeter ? [perimeter] : areas.length ? areas : blocks;
  const focusPoints = focus.flatMap(item => item.parts.flatMap(part => part.rings[0]));
  return { perimeter, areas, blocks, focusPoints };
}

function material(current, plan, selected, { code = 0, hideInPlan = false, lift = 0 } = {}) {
  return { current, plan, selected, code, hideInPlan, lift,
    currentCss: cssColor(current), planCss: cssColor(plan), selectedCss: cssColor(selected) };
}

function geometry(model) {
  const surfaces = [];
  function add(rings, points, indices, paint, group) {
    surfaces.push({ rings, points, indices, paint, group });
  }
  function flat(part, z, paint, group) {
    const rings = part.rings.map(r => r.map(([x, y]) => [x, y, z]));
    add(rings, rings.flat(), part.indices, paint, group);
  }
  function quad(a, b, c, d, paint, group) {
    const points = [a, b, c, d];
    add([points], points, [0, 1, 2, 0, 2, 3], paint, group);
  }
  function edge(a, b, width, z, paint, group) {
    const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy);
    if (length < 1e-5) return;
    const nx = -dy / length * width / 2, ny = dx / length * width / 2;
    quad([a[0] + nx, a[1] + ny, z], [b[0] + nx, b[1] + ny, z],
      [b[0] - nx, b[1] - ny, z], [a[0] - nx, a[1] - ny, z], paint, group);
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
  const townFill = material(ground, rgb('#e0e8df'), ground);
  const townLine = material(rgb('#466d64'), rgb('#47776c'), rgb('#466d64'), { lift: 2.1 });
  for (const part of model.perimeter?.parts || []) flat(part, 0, townFill, 0);
  model.areas.forEach((zone, i) => {
    const fill = material(rgb('#e1e8db'), rgb(PLAN_COLORS[i % PLAN_COLORS.length]), selectedArea, { code: zone.code, lift: .4 });
    const border = material(rgb('#99b2a3'), rgb('#5a9084'), rgb('#176354'), { code: zone.code, lift: 1.4 });
    for (const part of zone.parts) {
      flat(part, 0, fill, 1);
      outline(part, 1.5, 0, border, 3);
    }
  });
  for (const part of model.perimeter?.parts || []) outline(part, 2.1, 0, townLine, 4, true);

  for (const block of model.blocks) {
    const tier = rgb(AGE_COLORS[block.props.age_tier] || AGE_COLORS.unknown);
    const context = rgb('#d1d9d4');
    const current = block.props.is_inside_town === false
      ? tier.map((channel, i) => channel * .34 + context[i] * .66) : tier;
    const selected = rgb('#37947d');
    const hideInPlan = block.props.is_inside_town !== false;
    const paint = (light, lift = 0) => material(shade(current, light), shade(context, .38 + light * .62), shade(selected, light),
      { code: block.code, hideInPlan, lift });
    const roof = paint(1.05, .18);
    const rim = paint(.78, .55);
    const footprint = material(shade(current, .71), rgb('#a7b5af'), selected, { code: block.code, hideInPlan, lift: .95 });
    for (const part of block.parts) {
      if (!block.height) { outline(part, 1.05, 0, footprint, 5); continue; }
      const z = block.height;
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
          // Diffuse incident light from the northwest; walls retain their world orientation on orbit.
          const sun = (-.58 * dy - .81 * dx) * orientation / length;
          quad([...a, 0], [...b, 0], [...b, z], [...a, z], paint(.74 + .15 * sun), 6);
        }
      }
      flat(part, z, roof, 6);
      outline(part, .30, z, rim, 6);
    }
  }
  return surfaces;
}

function makeCanvas() {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  return canvas;
}

function webglRenderer(canvas, surfaces) {
  const gl = canvas.getContext('webgl', { antialias: true, alpha: false, depth: true });
  if (!gl) return null;
  const vertex = `
    attribute vec3 a_pos, a_current, a_plan, a_selected, a_options;
    uniform vec2 u_center, u_scale, u_bearing, u_pitch, u_active;
    uniform float u_plan;
    varying vec3 v_color;
    void main(){
      vec2 d = a_pos.xy - u_center;
      float east = dot(d, u_bearing);
      float north = dot(d, vec2(-u_bearing.y, u_bearing.x));
      float up = north * u_pitch.x + a_pos.z * u_pitch.y;
      float depth = a_pos.z * u_pitch.x - north * u_pitch.y + a_options.z;
      gl_Position = vec4(east * u_scale.x, up * u_scale.y, -depth / 4096.0, 1.0);
      if (a_options.y > 0.5 && u_plan > 0.5) gl_Position = vec4(2.0,2.0,2.0,1.0);
      v_color = mix(a_current, a_plan, u_plan);
      if (a_options.x > 0.0 && (a_options.x == u_active.x || a_options.x == u_active.y)) v_color = a_selected;
    }`;
  const fragment = 'precision mediump float; varying vec3 v_color; void main(){gl_FragColor = vec4(v_color, 1.0);}';
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
  const stride = 15;
  const data = new Float32Array(count * stride);
  let offset = 0;
  for (const { indices, points, paint } of surfaces) {
    const style = [...paint.current, ...paint.plan, ...paint.selected, paint.code, Number(paint.hideInPlan), paint.lift];
    for (const index of indices) {
      data.set(points[index], offset);
      data.set(style, offset + 3);
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
  const uniforms = Object.fromEntries(['center', 'scale', 'bearing', 'pitch', 'active', 'plan']
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
      gl.drawArrays(gl.TRIANGLES, 0, count);
    },
    destroy() {
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
    return { ...face, center, depth: 0 };
  });
  return {
    draw(view) {
      ctx.setTransform(canvas.width / view.width, 0, 0, canvas.height / view.height, 0, 0);
      ctx.fillStyle = GROUND;
      ctx.fillRect(0, 0, view.width, view.height);
      for (const face of faces) {
        const [x, y, z] = face.center;
        face.depth = (view.sinB * x - view.cosB * y) * view.sinP + z * view.cosP + face.paint.lift;
      }
      faces.sort((a, b) => a.group - b.group || a.depth - b.depth);
      for (const { paint, rings } of faces) {
        if (view.plan && paint.hideInPlan) continue;
        const active = paint.code && (paint.code === view.zone || paint.code === view.building);
        ctx.fillStyle = active ? paint.selectedCss : view.plan ? paint.planCss : paint.currentCss;
        ctx.beginPath();
        for (const ring of rings) {
          for (let i = 0; i < ring.length; i++) {
            const [x, y] = screenPoint(view, ...ring[i]);
            if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
          }
          ctx.closePath();
        }
        ctx.fill('evenodd');
      }
    },
    destroy() {},
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
  const zoneAtPoint = () => model.areas.find(area => area.parts.some(part => contains(part, x, y)));
  if (view.plan) return zoneAtPoint();
  let best = -1, hit = null;
  for (const block of model.blocks) {
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
  return hit || zoneAtPoint();
}

const SCENE_STYLE = `
.pilot-world {position:relative;isolation:isolate;overflow:hidden;width:100%;height:100%;min-height:0;
  color:#24483e;background:#f1f3ef;touch-action:none;user-select:none;overscroll-behavior:contain;cursor:grab}
.pilot-world[data-dragging="true"] {cursor:grabbing}
.pilot-world canvas,.pilot-world-labels {position:absolute;inset:0;display:block;width:100%;height:100%}
.pilot-world-labels {pointer-events:none;overflow:hidden}
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

export async function createPilotScene(container, { buildings, town, zones, selectedZoneId = null, onSelect } = {}) {
  const model = buildModel(town, zones?.features || [], buildings?.features || []);
  let surfaces = geometry(model);
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
    renderer = canvasRenderer(canvas, surfaces || geometry(model));
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
  let activeZone = model.areas.find(zone => zone.id === selectedZoneId);
  const camera = { x: 0, y: 0, bearing: DEFAULT_BEARING, pitch: DEFAULT_PITCH, zoom: 1 };
  const cosDefault = Math.cos(DEFAULT_BEARING), sinDefault = Math.sin(DEFAULT_BEARING);
  const focusBox = extent(model.focusPoints.map(([x, y]) => [cosDefault * x + sinDefault * y, -sinDefault * x + cosDefault * y]));
  const defaultEast = (focusBox[0] + focusBox[2]) / 2, defaultNorth = (focusBox[1] + focusBox[3]) / 2;
  const home = { x: cosDefault * defaultEast - sinDefault * defaultNorth,
    y: sinDefault * defaultEast + cosDefault * defaultNorth };
  const spanX = Math.max(80, focusBox[2] - focusBox[0]);
  const spanY = Math.max(80, (focusBox[3] - focusBox[1]) * Math.cos(DEFAULT_PITCH));
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
      building: activeBuilding?.code || 0, plan: mode === 'plan',
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

  function choose(feature) {
    if (!feature) return;
    if (feature.kind === 'zone') { activeZone = feature; activeBuilding = null; }
    else activeBuilding = feature;
    schedule();
    onSelect?.({ kind: feature.kind, id: feature.id });
  }

  function placeLabels(v) {
    const taken = [];
    const ordered = [...labels].sort((a, b) => Number(b.zone === activeZone) - Number(a.zone === activeZone));
    for (const { zone, button, metrics } of ordered) {
      button.setAttribute('aria-pressed', String(zone === activeZone));
      metrics.hidden = !v.plan;
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
  }

  function render() {
    frame = 0;
    if (destroyed) return;
    const v = view(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(v.width * dpr)), h = Math.max(1, Math.round(v.height * dpr));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    host.dataset.mode = mode;
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
    Object.assign(camera, home, { zoom: 1, bearing: DEFAULT_BEARING, pitch: DEFAULT_PITCH });
    fittedScale = 0;
    schedule();
  }
  function panWorldAnchor(point, target) {
    const ground = groundPoint(view(), ...target);
    camera.x += point[0] - ground[0];
    camera.y += point[1] - ground[1];
  }
  function adjustZoom(delta, anchor) {
    const before = anchor && groundPoint(view(), ...anchor);
    camera.zoom = clamp(camera.zoom * 1.4 ** delta, .36, 12);
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
        camera.zoom = clamp(camera.zoom * after.distance / before.distance, .36, 12);
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
    selectZone(id) {
      activeZone = model.areas.find(zone => zone.id === id);
      activeBuilding = null;
      schedule();
    },
    rotate, zoom: adjustZoom, pitch, pan, reset,
    getCamera() {
      return { centerX: camera.x, centerY: camera.y, bearing: camera.bearing / DEG,
        pitch: camera.pitch / DEG, zoom: camera.zoom, pixelsPerMeter: view().scale };
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
