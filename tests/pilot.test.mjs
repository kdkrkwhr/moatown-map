import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {buildingSummary} from '../pilot-viewer.mjs';

const root=new URL('../moatown-data/',import.meta.url);
const read=url=>JSON.parse(readFileSync(url,'utf8'));
const latest=read(new URL('latest.json',root));
const source=key=>new URL(latest.files[key],root);

test('pilot input versions and available towns match both published data catalogs',()=>{
  execFileSync(process.execPath,[fileURLToPath(new URL('../scripts/sync-pilot.mjs',import.meta.url)),'--check']);
  assert.deepEqual(latest.pilot_3d.town_ids,['mt-202603-public-010','mt-202603-public-034','mt-202603-public-067']);
});

test('only Sinwol publishes simulated towers and an original, attributed whole-town illustration',()=>{
  const town='mt-202603-public-067';
  assert.deepEqual(latest.pilot_3d.simulation_town_ids,[town]);
  assert.deepEqual(Object.keys(latest.pilot_3d.visuals),[town]);
  const catalog=read(source(latest.pilot_3d.visuals[town]));
  assert.equal(catalog.town_id,town);
  const picture=catalog.views.find(v=>v.image);
  assert.equal(picture.zone_id,null);
  assert.ok(picture.attribution && picture.license_url && picture.source_as_of);
  const bytes=readFileSync(new URL('../'+picture.image,root));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),picture.image_sha256);
  assert.ok(catalog.views.some(v=>v.zone_id==='mz-plan-584443-a1' && v.document_url && v.page_label));
});

test('published pilot parts have unique complete buildings and reproducible coverage counts',()=>{
  const index=read(source('buildings'));
  for(const entry of Object.values(index.towns)){
    const ids=new Set(),all=[];
    for(const file of entry.files){
      const bytes=Buffer.from(readFileSync(new URL(file.path,source('buildings')),'utf8').replaceAll('\r\n','\n'));
      assert.equal(bytes.length,file.bytes);
      assert.ok(bytes.length<=500000);
      assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256);
      for(const f of JSON.parse(bytes).features){
        const p=f.properties;
        assert.ok(p.id && !ids.has(p.id));ids.add(p.id);
        assert.ok(['Polygon','MultiPolygon'].includes(f.geometry.type));
        if(p.height_m===null)assert.equal(p.height_source,null);
        else {
          assert.ok(p.height_m>0 && ['official','estimated_from_floors'].includes(p.height_source));
          if(p.height_source==='estimated_from_floors')assert.equal(p.height_m,p.floors*3);
        }
        if(p.approval_year===null)assert.equal(p.age_tier,'unknown');
        else{
          assert.equal(p.age_years,Number(latest.snapshot_date.slice(0,4))-p.approval_year);
          assert.equal(p.age_tier,p.age_years>=30?'30_plus':p.age_years>=20?'20_to_29':'under_20');
        }
        all.push(f);
      }
    }
    const summary=buildingSummary(all);
    assert.equal(createHash('sha256').update([...ids].sort().join('\n')).digest('hex'),entry.audit.matched_ids_sha256);
    assert.equal(ids.size,entry.stats.total);
    assert.ok(ids.size>0);assert.equal(summary.inside,entry.stats.inside);
    assert.equal(summary.known,entry.stats.inside_known_year);
    assert.equal(summary.old,entry.stats.inside_30_plus);
    assert.equal(summary.crossing,entry.stats.crossing);
    assert.equal(buildingSummary(all.filter(f=>f.properties.is_inside_town!==true)).share,'산정 불가');
  }
});

test('each of the pilot child records is tied to its own town and reference geometry',()=>{
  const zones=read(source('zones')),boundaries=read(source('boundaries')),book=read(source('pilot_plans'));
  const shapes=new Set(boundaries.features.map(f=>f.properties.entity_id));
  for(const [townId,value] of Object.entries(book.towns)){
    assert.ok(shapes.has(townId));
    const published=zones.filter(z=>z.town_id===townId).map(z=>z.id).sort();
    assert.deepEqual(Object.keys(value.zones).sort(),published);
    assert.ok(published.every(id=>shapes.has(id)));
    for(const [id,record] of Object.entries(value.zones)){
      if(!record?.derived_from)continue;
      const original=zones.find(z=>z.id===id);
      assert.equal(record.derived_from.id,id);
      for(const key of ['floors','height_m','far_pct'])assert.equal(record[key],original[record.derived_from[key]]);
      assert.equal(record.source_url,original.field_evidence.plan.source_url);
    }
    for(const record of [value.plan,...Object.values(value.zones)].filter(Boolean)){
      assert.match(record.source_url,/^https:\/\//);
      if(record.source_as_of!==null)assert.match(record.source_as_of,/^\d{4}-\d{2}-\d{2}$/);
      else assert.ok(record.status && record.latest_approval_verified===false);
    }
  }
});
