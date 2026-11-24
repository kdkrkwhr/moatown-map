import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

test('both pages and nested browser imports use the release hash of their current sources',()=>{
  execFileSync(process.execPath,[fileURLToPath(new URL('../scripts/sync-assets.mjs',import.meta.url)),'--check']);
});
