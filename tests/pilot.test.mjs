import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {buildingSummary,mergeBuildingDetails} from '../pilot-viewer.mjs';

const root=new URL('../moatown-data/',import.meta.url);
const read=url=>JSON.parse(readFileSync(url,'utf8'));
const latest=read(new URL('latest.json',root));
const source=key=>new URL(latest.files[key],root);

test('pilot input versions and available towns match both published data catalogs',()=>{
  execFileSync(process.execPath,[fileURLToPath(new URL('../scripts/sync-pilot.mjs',import.meta.url)),'--check']);
  const referenceIds=read(source('boundaries')).features.filter(f=>f.properties.entity_type==='town').map(f=>f.properties.entity_id).sort();
  assert.deepEqual(latest.pilot_3d.town_ids,referenceIds);
  assert.deepEqual(latest.pilot_3d.plan_town_ids,Object.keys(read(source('pilot_plans')).towns).sort());
});

test('whole-town illustrations use the attributed original for each area and keep simulation scoped to Sinwol',()=>{
  const town='mt-202603-public-067';
  assert.deepEqual(latest.pilot_3d.simulation_town_ids,[town]);
  for(const [id,key] of Object.entries(latest.pilot_3d.visuals)){
    const catalog=read(source(key));
    assert.equal(catalog.town_id,id);
    for(const view of [catalog.current_view,catalog.views.find(v=>v.image)]){
      assert.ok(view.image && view.attribution && view.license_url && view.source_as_of);
      const bytes=readFileSync(new URL('../'+view.image,root));
      assert.equal(createHash('sha256').update(bytes).digest('hex'),view.image_sha256);
    }
  }
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

test('Sinwol links the existing-building register and the original before photo to their sources',()=>{
  const town='mt-202603-public-067';
  const config=latest.pilot_3d;
  assert.deepEqual(Object.keys(config.current_details).sort(),config.town_ids);
  const registry=read(source(config.current_details[town]));
  const buildings=read(new URL('buildings/'+town+'.geojson',root)).features;
  assert.deepEqual(Object.keys(registry.records).sort(),buildings.map(f=>f.properties.id).sort());
  const merged=mergeBuildingDetails(buildings,registry);
  assert.equal(merged.filter(f=>f.properties.use && f.properties.structure && f.properties.approval_date && f.properties.basement_floors!=null).length,995);
  assert.ok(merged.some(f=>f.properties.basement_floors===0));
  assert.equal(merged.filter(f=>f.properties.roof).length,924);
  assert.match(registry.roof_source.source_url,/OA-22424/);
  for(const {properties:p} of merged){
    if(p.approval_date)assert.equal(Number(p.approval_date.slice(0,4)),p.approval_year);
    if(p.roof)assert.match(p.roof_collected_on,/^\d{4}-\d{2}-\d{2}$/);
  }
  assert.equal(merged.filter(f=>f.properties.name).length,1);
  const photo=read(source(config.visuals[town])).current_view;
  assert.equal(photo.capture_date,null);
  assert.ok(photo.image_source_url.startsWith('https://news.seoul.go.kr/') && photo.attribution && photo.license_url);
  assert.equal(createHash('sha256').update(readFileSync(new URL('../'+photo.image,root))).digest('hex'),photo.image_sha256);
});

test('supplemental floor counts resolve only uniquely matched missing heights and preserve the published geometry',()=>{
  const town='mt-202603-public-067';
  const config=latest.pilot_3d;
  assert.deepEqual(Object.keys(config.current_heights).sort(),config.town_ids);
  const supplement=read(source(config.current_heights[town]));
  const buildings=read(new URL('buildings/'+town+'.geojson',root)).features;
  const merged=mergeBuildingDetails(buildings,null,supplement);
  const before=buildingSummary(buildings),after=buildingSummary(merged);
  assert.equal(before.unknownHeight,66);
  assert.equal(after.official,433);assert.equal(after.estimated,589);assert.equal(after.unknownHeight,39);
  assert.equal(after.known,before.known);
  for(const [index,feature] of merged.entries()){
    const original=buildings[index],record=supplement.records[original.properties.id];
    assert.equal(feature.geometry,original.geometry);
    if(!record){assert.equal(feature,original);continue;}
    assert.equal(original.properties.height_m,null);assert.equal(original.properties.floors,null);
    assert.equal(feature.properties.map_floor_evidence,record);
    assert.equal(feature.properties.height_m,record.floors*3);
    assert.equal(feature.properties.height_source,'estimated_from_floors');
    assert.equal(record.source_field,'flr_num');
    assert.match(record.source_record_date,/^\d{4}-\d{2}-\d{2}$/);
    assert.ok(record.overlap_iou>=0.9 && record.source_url.startsWith('https://'));
  }
  const official=buildings.find(f=>f.properties.height_source==='official');
  const stray={records:{[official.properties.id]:{floors:99}}};
  assert.deepEqual(mergeBuildingDetails([official],null,stray)[0].properties,official.properties);
});

test('every mapped town joins its own current register and supplementary heights across all chunks',()=>{
  const config=latest.pilot_3d,index=read(source('buildings'));
  const review=read(source('building_height_review'));
  const reviewedIds=new Set();
  for(const town of config.town_ids){
    const entry=index.towns[town];
    const buildings=entry.files.flatMap(f=>read(new URL(f.path,source('buildings'))).features);
    const registry=read(source(config.current_details[town]));
    const supplement=read(source(config.current_heights[town]));
    assert.equal(registry.town_id,town);assert.equal(supplement.town_id,town);
    if(registry.record_files){
      registry.records={};
      for(const f of registry.record_files){
        const content=readFileSync(new URL(f.path,source('buildings')),'utf8').replaceAll('\r\n','\n');
        assert.ok(f.bytes<=500000 && f.bytes===Buffer.byteLength(content));
        assert.equal(createHash('sha256').update(content).digest('hex'),f.sha256);
        const part=JSON.parse(content);
        assert.equal(part.town_id,town);assert.equal(Object.keys(part.records).length,f.count);
        Object.assign(registry.records,part.records);
      }
    }
    assert.deepEqual(Object.keys(registry.records).sort(),buildings.map(f=>f.properties.id).sort());
    assert.equal(registry.source_as_of,entry.source_as_of);
    const merged=mergeBuildingDetails(buildings,registry,supplement,review);
    const supplementalCount=Object.keys(supplement.records).length;
    const stats=buildingSummary(merged);
    assert.equal(stats.official,entry.stats.official_height);
    assert.equal(stats.estimated,entry.stats.estimated_height+supplementalCount);
    assert.equal(stats.unknownHeight,entry.stats.unknown_height-supplementalCount);
    for(const f of merged){
      const p=f.properties;
      if(p.approval_date)assert.equal(Number(p.approval_date.slice(0,4)),p.approval_year);
      if(p.roof)assert.match(p.roof_collected_on,/^\d{4}-\d{2}-\d{2}$/);
      if(p.height_review){
        const record=p.height_review;
        assert.ok(record.town_ids.includes(town) && config.height_review_town_ids.includes(town));
        reviewedIds.add(p.id);
        if(record.decision==='use_registry_height'){
          assert.equal(record.reported_height_m,13418);assert.equal(p.height_m,13.418);
          assert.ok(record.registry_serial && record.registry_collected_on);
        }else assert.equal(p.height_m,record.reported_height_m);
      }
      if(p.map_floor_evidence){
        assert.equal(p.height_m,p.floors*3);
        assert.ok(p.map_floor_evidence.overlap_iou>=0.9);
      }
    }
  }
  assert.deepEqual([...reviewedIds].sort(),Object.keys(review.records).sort());
});

test('official current site links belong to towns with an existing building scene',()=>{
  const links=read(source('current_site_sources'));
  assert.ok(Object.keys(links).length>0);
  for(const [id,link] of Object.entries(links)){
    assert.ok(latest.pilot_3d.town_ids.includes(id));assert.equal(latest.pilot_3d.visuals[id],undefined);
    assert.match(link.source_url,/^https:\/\/news\.seoul\.go\.kr\/citybuild\/archives\//);
    assert.ok(link.source_locator && link.source_address && link.source_as_of);
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
