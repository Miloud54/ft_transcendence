import { mkdtempSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { writeCheatFile } from '../../../cheat/cheat-file';

const article = {
  id: 1,
  url: 'https://example.org/iron',
  title: 'Iron Tower',
  paragraphs: ['First paragraph.', 'Second paragraph.'],
};

describe('writeCheatFile', () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
  });

  it('does nothing unless PEDANTIX_CHEAT=true', async () => {
    delete process.env.PEDANTIX_CHEAT;
    const dir = join(mkdtempSync(join(tmpdir(), 'cheat-')), 'out');
    expect(await writeCheatFile('1', article, dir)).toBeNull();
    expect(existsSync(dir)).toBe(false);
  });

  it('never writes in production', async () => {
    process.env.PEDANTIX_CHEAT = 'true';
    process.env.NODE_ENV = 'production';
    const dir = join(mkdtempSync(join(tmpdir(), 'cheat-')), 'out');
    expect(await writeCheatFile('1', article, dir)).toBeNull();
  });

  it('writes the article as plain text, per game and as latest', async () => {
    process.env.PEDANTIX_CHEAT = 'true';
    process.env.NODE_ENV = 'development';
    const dir = join(mkdtempSync(join(tmpdir(), 'cheat-')), 'out');
    const file = await writeCheatFile('42', article, dir);
    expect(file).toBe(join(dir, 'game-42.txt'));
    const text = readFileSync(file as string, 'utf8');
    expect(text).toContain('Title: Iron Tower');
    expect(text).toContain('First paragraph.\n\nSecond paragraph.');
    expect(readFileSync(join(dir, 'latest.txt'), 'utf8')).toBe(text);
  });

  it('swallows write errors', async () => {
    process.env.PEDANTIX_CHEAT = 'true';
    process.env.NODE_ENV = 'development';
    // a directory nested under a regular file cannot be created (ENOTDIR)
    const blocker = join(mkdtempSync(join(tmpdir(), 'cheat-')), 'file');
    writeFileSync(blocker, 'x');
    expect(await writeCheatFile('1', article, join(blocker, 'sub'))).toBeNull();
  });
});