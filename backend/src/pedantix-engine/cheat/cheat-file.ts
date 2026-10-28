import { Logger } from '@nestjs/common';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { Article } from '../article/article';

const logger = new Logger('CheatFile');

/** Debug helper: enabled with PEDANTIX_CHEAT=true, never in production. */
export function isCheatEnabled(): boolean {
  return (
    process.env.PEDANTIX_CHEAT === 'true' &&
    process.env.NODE_ENV !== 'production'
  );
}

/**
 * Writes the secret article in plain text so you can test the game while
 * knowing the answer:
 *   <cheat dir>/game-<gameId>.txt   one file per game
 *   <cheat dir>/latest.txt          always the most recent game
 *
 * The directory is `backend/cheat/` (relative to the backend working
 * directory), or PEDANTIX_CHEAT_DIR if set. Never throws: a failure only logs
 * a warning so it can never break a game.
 */
export async function writeCheatFile(
  gameId: string,
  article: Article,
  dir: string = process.env.PEDANTIX_CHEAT_DIR ?? join(process.cwd(), 'cheat'),
): Promise<string | null> {
  if (!isCheatEnabled()) return null;

  const content = [
    `Title: ${article.title}`,
    `URL: ${article.url}`,
    `Game: ${gameId}`,
    '',
    ...article.paragraphs.flatMap((paragraph) => [paragraph, '']),
  ].join('\n');

  try {
    await mkdir(dir, { recursive: true });
    const file = join(dir, `game-${gameId}.txt`);
    await writeFile(file, content, 'utf8');
    await writeFile(join(dir, 'latest.txt'), content, 'utf8');
    logger.warn(`Cheat file written: ${file}`);
    return file;
  } catch (error) {
    logger.warn(`Could not write cheat file: ${String(error)}`);
    return null;
  }
}
