import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { GameResult, GameStatus } from 'generated/prisma';
import { ArticleViewService } from 'src/pedantix-engine/article-view/article-view.service';
import { GuessEngineService } from 'src/pedantix-engine/guess/guess-engine.service';
import { LemmatizerService } from 'src/pedantix-engine/linguistics/lemmatizer.service';
import { ArticleIndexService } from 'src/pedantix-engine/matching/article-index';
import { PedantixEngineService } from 'src/pedantix-engine/pedantix-engine.service';
import { ProximityService } from 'src/pedantix-engine/proximity/proximity.service';
import { VectorStoreService } from 'src/pedantix-engine/proximity/vector-store.service';
import { TokenizerService } from 'src/pedantix-engine/tokenizer/tokenizer.service';
import { GameService, SCORE_PER_WORD, SCORE_TITLE } from './game.service';

function makeVectors() {
  const dir = mkdtempSync(join(tmpdir(), 'vec-'));
  const entries: Record<string, number[]> = {
    iron: [1, 0.1, 0],
    metal: [0.95, 0.2, 0],
    tower: [0.7, 0.7, 0],
    banana: [0, 0, 1],
  };
  const words = Object.keys(entries);
  const flat = words.flatMap((w) => {
    const n = Math.hypot(...entries[w]);
    return entries[w].map((x) => x / n);
  });
  writeFileSync(join(dir, 'words.json'), JSON.stringify(words));
  writeFileSync(join(dir, 'vectors.bin'), Buffer.from(new Float32Array(flat).buffer));
  writeFileSync(join(dir, 'meta.json'), JSON.stringify({ dim: 3, count: words.length }));
  const store = new VectorStoreService();
  store.load(dir);
  return store;
}

describe('GameService (shared board)', () => {
  const lemmatizer = new LemmatizerService();
  const vectors = makeVectors();
  let service: GameService;
  let db: { game: any; players: any[]; updates: any[]; gameUpdate: any };

  beforeEach(async () => {
    db = {
      game: { game_id: 1n, room_id: 7n, status: GameStatus.RUNNING },
      players: [
        { game_id: 1n, user_id: 10n },
        { game_id: 1n, user_id: 11n },
      ],
      updates: [],
      gameUpdate: null,
    };
    const prisma: any = {
      game: {
        findUnique: async () => db.game,
        updateMany: async ({ data }: any) => {
          db.gameUpdate = data;
          db.game = { ...db.game, status: data.status };
          return { count: 1 };
        },
      },
      gamePlayer: {
        findUnique: async ({ where }: any) =>
          db.players.find((p) => p.user_id === where.game_id_user_id.user_id) ?? null,
        findMany: async () => db.players,
        update: async (args: any) => db.updates.push(args),
      },
      room: { update: async () => ({}) },
      roomPlayer: { findMany: async () => [] },
      $transaction: async (fn: any) => fn(prisma),
    };
    const engine = new PedantixEngineService(
      {
        selectArticle: async () => ({
          id: 1, url: '', title: 'Iron Tower',
          paragraphs: ['The tower is made of iron. A tall tower. Not a banana.'],
        }),
      } as any,
      new TokenizerService(),
      new ArticleViewService(),
      new ArticleIndexService(lemmatizer, vectors),
      new GuessEngineService(lemmatizer, vectors, new ProximityService(vectors)),
    );
    await engine.prepareGame('1');
    service = new GameService(
      prisma,
      engine,
      { setPresence: async () => undefined } as any,
      { broadcastPresence: () => undefined } as any,
    );
    jest.useFakeTimers({ doNotFake: ['nextTick'] });
  });
  afterEach(() => jest.useRealTimers());

  const later = () => jest.advanceTimersByTime(1000);

  it('shares reveals between players and scores 30 per found word', async () => {
    const first = await service.submitGuess('1', '10', 'tower');
    expect(first).toMatchObject({ valid: true, score: SCORE_PER_WORD, revealedCount: 3 });

    const state = await service.getState('1');
    const revealed = state.article!.paragraphs[0].tokens.filter(
      (t) => t.type === 'word' && t.status === 'revealed',
    );
    expect(revealed).toHaveLength(2); // both body occurrences, visible to everybody
    expect(state.scores).toEqual({ '10': SCORE_PER_WORD });
  });

  it('grades close hidden words on the shared board', async () => {
    await service.submitGuess('1', '10', 'metal');
    const state = await service.getState('1');
    const hiddenIron = state.article!.paragraphs[0].tokens.find(
      (t) => t.type === 'word' && t.status === 'hidden' && t.grade,
    );
    expect(hiddenIron).toBeDefined();
  });

  it('rejects invalid guesses without scoring them', async () => {
    const bad = await service.submitGuess('1', '10', 'zzzzqq');
    expect(bad).toMatchObject({ valid: false, reason: 'NOT_A_WORD', score: 0 });
    later();
    await service.submitGuess('1', '10', 'iron');
    later();
    const dup = await service.submitGuess('1', '11', 'iron');
    expect(dup).toMatchObject({ valid: false, reason: 'ALREADY_GUESSED' });
    expect((await service.getState('1')).attempts).toEqual({ '10': 1 });
  });

  it('throttles guess spam', async () => {
    await service.submitGuess('1', '10', 'iron');
    const spam = await service.submitGuess('1', '10', 'tower');
    expect(spam).toMatchObject({ valid: false, reason: 'TOO_FAST' });
  });

  it('keeps the game open for five minutes after the title is found', async () => {
    await service.submitGuess('1', '10', 'iron'); // +30 for player 10
    await service.submitGuess('1', '11', 'tower'); // +30, completes title: +500
    let state = await service.getState('1');

    expect(state.status).toBe('running');
    expect(state.graceRemaining).toBe(300);
    expect(state.scores).toEqual({ '10': SCORE_PER_WORD, '11': SCORE_PER_WORD + SCORE_TITLE });

    await service.submitGuess('1', '10', 'banana');
    await jest.advanceTimersByTimeAsync(5 * 60_000);
    state = await service.getState('1');

    expect(state.status).toBe('finished');
    expect(state.winnerId).toBe('11');
    // finished game exposes the fully revealed article
    const hidden = state.article!.paragraphs[0].tokens.filter(
      (t) => t.type === 'word' && t.status === 'hidden',
    );
    expect(hidden).toHaveLength(0);

    const saved = Object.fromEntries(
      db.updates.map((u) => [u.where.game_id_user_id.user_id.toString(), u.data]),
    );
    expect(saved['11']).toEqual({ result: GameResult.WIN, score: 530, rank: 1 });
    expect(saved['10']).toEqual({ result: GameResult.LOSS, score: 30, rank: 2 });
    expect(db.gameUpdate.article_title).toBe('Iron Tower');
    expect(db.gameUpdate.ended_at).toBeInstanceOf(Date);
  });

  it('rejects guesses once the game is finished', async () => {
    await service.submitGuess('1', '10', 'iron tower');
    expect((await service.getState('1')).status).toBe('running');
    await jest.advanceTimersByTimeAsync(5 * 60_000);
    await expect(service.submitGuess('1', '11', 'banana')).rejects.toThrow('not running');
  });
});
