import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { VectorStoreService } from './vector-store.service';

const dir = process.env.PEDANTIX_VECTORS_DIR ?? join(process.cwd(), 'data');
const describeIfData = existsSync(join(dir, 'meta.json')) ? describe : describe.skip;

/**
 * Guards the committed files in backend/data/. They are generated together by
 * scripts/prepare-vectors.py and must never be edited separately: row i of
 * vectors.bin is the vector of words.json[i].
 */
describeIfData('backend/data vector files', () => {
  const words: string[] = JSON.parse(readFileSync(join(dir, 'words.json'), 'utf8'));
  const meta = JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8')) as {
    dim: number;
    count: number;
  };

  it('words.json, vectors.bin and meta.json describe the same vocabulary', () => {
    expect(words.length).toBe(meta.count);
    expect(statSync(join(dir, 'vectors.bin')).size).toBe(meta.count * meta.dim * 4);
  });

  it('has no duplicate words', () => {
    expect(new Set(words).size).toBe(words.length);
  });

  it('loads and gives sane similarities (rows are not shifted)', () => {
    const store = new VectorStoreService();
    store.load(dir);
    expect(store.isReady).toBe(true);
    const related = store.similarity('iron', 'metal') as number;
    const unrelated = store.similarity('iron', 'banana') as number;
    expect(related).toBeGreaterThan(unrelated);
    expect(related).toBeGreaterThan(0.5);
    expect(store.has('zzzzqq')).toBe(false);
  });
});