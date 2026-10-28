import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { LemmatizerService } from '../linguistics/lemmatizer.service';
import {
  ArticleIndex,
  ArticleIndexService,
  BoardState,
  createBoard,
} from '../matching/article-index';
import { ProximityService } from '../proximity/proximity.service';
import { VectorStoreService } from '../proximity/vector-store.service';
import { ArticleViewService } from '../article-view/article-view.service';
import { TokenizerService } from '../tokenizer/tokenizer.service';
import { GuessEngineService } from './guess-engine.service';

/** Tiny 3-d fixture: iron/metal close, banana far, dog elsewhere. */
function makeVectors(): VectorStoreService {
  const dir = mkdtempSync(join(tmpdir(), 'vec-'));
  const entries: Record<string, number[]> = {
    iron: [1, 0.1, 0],
    metal: [0.95, 0.2, 0],
    tower: [0.7, 0.7, 0],
    tall: [0.6, 0.8, 0],
    banana: [0, 0, 1],
    dog: [0, 1, 0.1],
    the: [0.3, 0.3, 0.3],
    is: [0.2, 0.2, 0.2],
    be: [0.2, 0.2, 0.2],
    are: [0.2, 0.2, 0.2],
    build: [0.5, 0.1, 0.5],
    run: [0, 0.5, 0.5],
    paris: [0.1, 0.1, 0.9],
  };
  const words = Object.keys(entries);
  const flat: number[] = [];
  for (const word of words) {
    const v = entries[word];
    const norm = Math.hypot(...v);
    flat.push(...v.map((x) => x / norm));
  }
  writeFileSync(join(dir, 'words.json'), JSON.stringify(words));
  writeFileSync(
    join(dir, 'vectors.bin'),
    Buffer.from(new Float32Array(flat).buffer),
  );
  writeFileSync(
    join(dir, 'meta.json'),
    JSON.stringify({ dim: 3, count: words.length }),
  );
  const store = new VectorStoreService();
  store.load(dir);
  return store;
}

describe('GuessEngineService', () => {
  const lemmatizer = new LemmatizerService();
  const vectors = makeVectors();
  const engine = new GuessEngineService(
    lemmatizer,
    vectors,
    new ProximityService(vectors),
  );
  const tokenized = new TokenizerService().tokenize({
    id: 1,
    url: '',
    title: 'Iron Tower',
    paragraphs: [
      'The tower is tall. Workers built the iron tower in Paris, and they run to the top.',
      'Is it metal? The towers are tall.',
    ],
  });

  let index: ArticleIndex;
  let board: BoardState;
  beforeEach(() => {
    index = new ArticleIndexService(lemmatizer, vectors).build(tokenized);
    board = createBoard();
  });

  const revealedTexts = () =>
    [...board.revealed].map((id) => index.words[id].text.toLowerCase());

  it('reveals every occurrence and inflection (tower -> towers)', () => {
    const outcome = engine.run(index, board, 'tower');
    expect(outcome).toMatchObject({ valid: true, revealedCount: 4 });
    expect(revealedTexts().sort()).toEqual([
      'tower',
      'tower',
      'tower',
      'towers',
    ]);
  });

  it('is -> reveals be/is/are in the text', () => {
    engine.run(index, board, 'be');
    expect(revealedTexts().sort()).toEqual(['are', 'is', 'is']);
  });

  it('finds irregular past forms (built via "build")', () => {
    engine.run(index, board, 'build');
    expect(revealedTexts()).toEqual(['built']);
  });

  it('is case and accent insensitive', () => {
    expect(engine.run(index, board, '  TÓWER ')).toMatchObject({ valid: true });
  });

  it('rejects gibberish, empty, multi-word and duplicates', () => {
    expect(engine.run(index, board, 'asdfghjk')).toMatchObject({
      reason: 'NOT_A_WORD',
    });
    expect(engine.run(index, board, '   ')).toMatchObject({ reason: 'EMPTY' });
    expect(engine.run(index, board, 'two words')).toMatchObject({
      reason: 'SINGLE_WORD_ONLY',
    });
    expect(engine.run(index, board, 'tower')).toMatchObject({ valid: true });
    expect(engine.run(index, board, 'Tower')).toMatchObject({
      reason: 'ALREADY_GUESSED',
    });
  });

  it('accepts numbers: reveals them when in the text, otherwise just no match', () => {
    const custom = new TokenizerService().tokenize({
      id: 3,
      url: '',
      title: 'Tower',
      paragraphs: ['Built in 1889, it is tall.'],
    });
    const idx = new ArticleIndexService(lemmatizer, vectors).build(custom);
    const b = createBoard();
    expect(engine.run(idx, b, '1889')).toMatchObject({
      valid: true,
      revealedCount: 1,
      bestGrade: 0,
    });
    expect(engine.run(idx, b, '1900')).toMatchObject({
      valid: true,
      revealedCount: 0,
      bestGrade: 0,
    });
    expect(engine.run(idx, b, '1900')).toMatchObject({
      reason: 'ALREADY_GUESSED',
    });
  });

  it('accepts proper nouns that only exist in the article', () => {
    const custom = new TokenizerService().tokenize({
      id: 2,
      url: '',
      title: 'Zorblax',
      paragraphs: ['Zorblax rules the iron tower.'],
    });
    const idx = new ArticleIndexService(lemmatizer, vectors).build(custom);
    expect(engine.run(idx, createBoard(), 'zorblax')).toMatchObject({
      valid: true,
      titleFound: true,
    });
  });

  it('accepts single-letter guesses when they appear in the article', () => {
    const custom = new TokenizerService().tokenize({
      id: 4,
      url: '',
      title: 'A',
      paragraphs: ['A simple letter.'],
    });
    const idx = new ArticleIndexService(lemmatizer, vectors).build(custom);
    expect(engine.run(idx, createBoard(), 'a')).toMatchObject({
      valid: true,
      revealedCount: 2,
    });
  });

  it('accepts possessive apostrophe forms such as "it\'s"', () => {
    const custom = new TokenizerService().tokenize({
      id: 5,
      url: '',
      title: 'Sentence',
      paragraphs: ["It's a small thing."],
    });
    const idx = new ArticleIndexService(lemmatizer, vectors).build(custom);
    expect(engine.run(idx, createBoard(), "it's")).toMatchObject({
      valid: true,
      revealedCount: 1,
    });
  });

  it('colors close words but never revealed or unrelated ones', () => {
    const outcome = engine.run(index, board, 'metal');
    expect(outcome).toMatchObject({ valid: true });
    if (!outcome.valid) return;
    // "metal" appears once -> revealed; "iron" is close -> graded
    const grades = Object.fromEntries(
      [...board.grades].map(([id, grade]) => [
        index.words[id].text.toLowerCase(),
        grade,
      ]),
    );
    expect(grades.iron).toBeGreaterThanOrEqual(3);
    expect(grades.paris).toBeUndefined();
    expect([...board.grades.keys()].some((id) => board.revealed.has(id))).toBe(
      false,
    );
  });

  it('never grades from a stopword guess', () => {
    const outcome = engine.run(index, board, 'the');
    expect(outcome).toMatchObject({ valid: true, bestGrade: 0 });
    expect(board.grades.size).toBe(0);
  });

  it('reports a word already revealed by another player as present in the text', () => {
    engine.run(index, board, 'the');
    const outcome = engine.run(index, board, 'the', new Set());

    expect(outcome).toMatchObject({
      valid: true,
      revealedCount: 0,
      foundInText: true,
      bestGrade: 0,
    });
  });

  it('keeps the best grade and clears it when the word gets revealed', () => {
    engine.run(index, board, 'metal');
    const ironIds = index.byLemma.get('iron') ?? [];
    expect(ironIds.every((id) => board.grades.has(id))).toBe(true);
    engine.run(index, board, 'iron');
    expect(
      ironIds.every((id) => !board.grades.has(id) && board.revealed.has(id)),
    ).toBe(true);
  });

  it('detects the title once every title word is revealed', () => {
    expect(engine.run(index, board, 'iron')).toMatchObject({
      titleFound: false,
    });
    expect(engine.run(index, board, 'tower')).toMatchObject({
      titleFound: true,
    });
    expect(board.finished).toBe(false);
    expect(engine.run(index, board, 'tall')).toMatchObject({ valid: true });
  });

  it('accepts the exact full title as one guess', () => {
    expect(engine.run(index, board, 'iron tower')).toMatchObject({
      valid: true,
      titleFound: true,
    });
  });

  it('board view stays aligned with the index', () => {
    engine.run(index, board, 'tower');
    const view = new ArticleViewService().buildBoardView(tokenized, board);
    const words = [view.title, ...view.paragraphs]
      .flatMap((section) => section.tokens)
      .filter((token) => token.type === 'word');
    expect(words).toHaveLength(index.words.length);
    words.forEach((token, id) => {
      expect(token.type === 'word' && token.status === 'revealed').toBe(
        board.revealed.has(id),
      );
    });
    // hidden words never leak their text
    expect(JSON.stringify(view)).not.toMatch(/Workers|Paris|metal/i);
  });

  it('works without vector files (no proximity, permissive validation)', () => {
    const noVectors = new VectorStoreService();
    const noProx = new GuessEngineService(
      lemmatizer,
      noVectors,
      new ProximityService(noVectors),
    );
    const idx = new ArticleIndexService(lemmatizer, noVectors).build(tokenized);
    const b = createBoard();
    expect(noProx.run(idx, b, 'tower')).toMatchObject({
      valid: true,
      bestGrade: 0,
    });
    expect(noProx.run(idx, b, 'qqq1')).toMatchObject({ reason: 'NOT_A_WORD' });
  });
});
