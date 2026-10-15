import { randomUUID } from 'node:crypto';
import {
  chown,
  readFile,
  rename,
  stat,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { Article } from '../src/pedantix-engine/article/article';
import { ArticleCandidate } from '../src/pedantix-engine/article/article-candidate';
import { WikipediaProvider } from '../src/pedantix-engine/article/wikipedia.provider';

const LIBRARY_PATH = resolve(
  process.cwd(),
  'src/pedantix-engine/article/curated/curated-articles.json',
);

const DEFAULT_TARGET = 10;
const DEFAULT_MAX_BATCHES = 3;
const MAX_TARGET = 100;
const MAX_BATCHES = 10;

function readBoundedInteger(
  variableName: string,
  defaultValue: number,
  maximum: number,
): number {
  const rawValue = process.env[variableName];

  if (rawValue === undefined || rawValue.trim() === '') {
    return defaultValue;
  }

  const value = Number(rawValue);

  if (
    !Number.isInteger(value) ||
    value < 1 ||
    value > maximum
  ) {
    throw new Error(
      `${variableName} must be an integer between 1 and ${maximum}.`,
    );
  }

  return value;
}

function normalizeTitle(title: string): string {
  return title
    .normalize('NFKC')
    .trim()
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('en-US');
}

function isArticle(value: unknown): value is Article {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const article = value as Record<string, unknown>;

  return (
    typeof article.id === 'number' &&
    Number.isInteger(article.id) &&
    typeof article.title === 'string' &&
    article.title.trim().length > 0 &&
    typeof article.url === 'string' &&
    article.url.trim().length > 0 &&
    Array.isArray(article.paragraphs) &&
    article.paragraphs.length >= 3 &&
    article.paragraphs.every(
      (paragraph) =>
        typeof paragraph === 'string' && paragraph.trim().length > 0,
    )
  );
}

function isRateLimitError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : String(error);

  return /\bHTTP\s+429\b/i.test(message);
}

async function loadLibrary(): Promise<Article[]> {
  let content: string;

  try {
    content = await readFile(LIBRARY_PATH, 'utf8');
  } catch (error: unknown) {
    const code =
      typeof error === 'object' &&
      error !== null &&
      'code' in error
        ? error.code
        : undefined;

    if (code === 'ENOENT') {
      console.log('No existing library found; starting with an empty one.');
      return [];
    }

    throw error;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(
      `Refusing to overwrite the library: invalid JSON in ${LIBRARY_PATH}`,
    );
  }

  if (!Array.isArray(parsed) || !parsed.every(isArticle)) {
    throw new Error(
      `Refusing to overwrite the library: invalid article data in ${LIBRARY_PATH}`,
    );
  }

  return parsed;
}

function isDuplicate(
  article: Article,
  knownIds: Set<number>,
  knownTitles: Set<string>,
): boolean {
  return (
    knownIds.has(article.id) ||
    knownTitles.has(normalizeTitle(article.title))
  );
}

function registerArticle(
  article: Article,
  knownIds: Set<number>,
  knownTitles: Set<string>,
): void {
  knownIds.add(article.id);
  knownTitles.add(normalizeTitle(article.title));
}

async function saveLibrary(articles: Article[]): Promise<void> {
  const temporaryPath = `${LIBRARY_PATH}.${randomUUID()}.tmp`;

  try {
    // Récupère le propriétaire actuel du fichier, s'il existe.
    let previousOwner: { uid: number; gid: number } | null = null;

    try {
      const currentStats = await stat(LIBRARY_PATH);

      previousOwner = {
        uid: currentStats.uid,
        gid: currentStats.gid,
      };
    } catch (error: unknown) {
      const code =
        typeof error === 'object' &&
        error !== null &&
        'code' in error
          ? error.code
          : undefined;

      if (code !== 'ENOENT') {
        throw error;
      }
    }

    // Écrit le nouveau contenu dans un fichier temporaire.
    await writeFile(
      temporaryPath,
      `${JSON.stringify(articles, null, 2)}\n`,
      { encoding: 'utf8', flag: 'wx' },
    );

    // Préserve le propriétaire et le groupe du fichier précédent.
    if (previousOwner !== null) {
      await chown(
        temporaryPath,
        previousOwner.uid,
        previousOwner.gid,
      );
    }

    // Remplace le fichier seulement lorsque le temporaire est prêt.
    await rename(temporaryPath, LIBRARY_PATH);
  } catch (error: unknown) {
    try {
      await unlink(temporaryPath);
    } catch {
      // Le fichier temporaire peut ne pas exister ou avoir déjà été renommé.
    }

    throw error;
  }
}

async function collect(): Promise<void> {
  const target = readBoundedInteger(
    'COLLECT_TARGET',
    DEFAULT_TARGET,
    MAX_TARGET,
  );

  const maxBatches = readBoundedInteger(
    'COLLECT_MAX_BATCHES',
    DEFAULT_MAX_BATCHES,
    MAX_BATCHES,
  );

  const existingArticles = await loadLibrary();
  const knownIds = new Set(existingArticles.map((article) => article.id));
  const knownTitles = new Set(
    existingArticles.map((article) => normalizeTitle(article.title)),
  );

  const newArticles: Article[] = [];
  const wikipedia = new WikipediaProvider();

  console.log(`Library currently contains ${existingArticles.length} articles.`);
  console.log(`Collection target: ${target} new articles.`);
  console.log(`Maximum candidate batches: ${maxBatches}.`);

  let rateLimited = false;

  for (
    let batchNumber = 1;
    batchNumber <= maxBatches && newArticles.length < target;
    batchNumber += 1
  ) {
    let candidates: ArticleCandidate[];

    console.log(`\nBatch ${batchNumber}/${maxBatches}: fetching candidates...`);

    try {
      candidates = await wikipedia.getRandomArticleCandidates();
    } catch (error: unknown) {
      console.error(
        'Unable to fetch Wikipedia candidates:',
        error instanceof Error ? error.message : error,
      );

      if (isRateLimitError(error)) {
        console.error('HTTP 429 detected. Stopping collection immediately.');
        rateLimited = true;
        break;
      }

      // Pas de nouvelle requête de candidats après une erreur réseau/API.
      break;
    }

    if (candidates.length === 0) {
      console.log('Wikipedia returned no candidates for this batch.');
      continue;
    }

    for (const candidate of candidates) {
      if (newArticles.length >= target) {
        break;
      }

      if (candidate.isDisambiguation) {
        console.log(`Skipping disambiguation: ${candidate.title}`);
        continue;
      }

      if (
        knownIds.has(candidate.id) ||
        knownTitles.has(normalizeTitle(candidate.title))
      ) {
        console.log(`Skipping existing article: ${candidate.title}`);
        continue;
      }

      let article: Article | null;

      try {
        article = await wikipedia.getArticle(candidate.title);
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : String(error);

        console.error(`Failed to fetch "${candidate.title}": ${message}`);

        if (isRateLimitError(error)) {
          console.error('HTTP 429 detected. Stopping collection immediately.');
          rateLimited = true;
          break;
        }

        // Erreur sur cet article : passer au candidat suivant.
        continue;
      }

      if (article === null) {
        console.log(`Article rejected by existing validation: ${candidate.title}`);
        continue;
      }

      // Défense supplémentaire : l'API peut renvoyer un titre ou un ID différent.
      if (isDuplicate(article, knownIds, knownTitles)) {
        console.log(`Skipping duplicate article: ${article.title}`);
        continue;
      }

      registerArticle(article, knownIds, knownTitles);
      newArticles.push(article);

      console.log(
        `Added ${newArticles.length}/${target}: ${article.title} ` +
          `(${article.paragraphs.length} paragraphs)`,
      );
    }

    if (rateLimited) {
      break;
    }
  }

  if (newArticles.length === 0) {
    console.log('\nNo new articles collected. The existing library is unchanged.');

    if (rateLimited) {
      console.log('Collection stopped because Wikipedia returned HTTP 429.');
    }

    return;
  }

  const mergedArticles = [...existingArticles, ...newArticles];

  // Le répertoire existe normalement déjà, mais on le vérifie avant l'écriture.
  await import('node:fs/promises').then(({ mkdir }) =>
    mkdir(dirname(LIBRARY_PATH), { recursive: true }),
  );

  await saveLibrary(mergedArticles);

  console.log('\nCollection finished.');
  console.log(`New articles added: ${newArticles.length}`);
  console.log(`Previous library size: ${existingArticles.length}`);
  console.log(`New library size: ${mergedArticles.length}`);
  console.log(`Library saved to: ${LIBRARY_PATH}`);

  if (rateLimited) {
    console.log('Note: collection ended early because of HTTP 429.');
  }
}

collect().catch((error: unknown) => {
  console.error(
    'Article collection failed:',
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
});
