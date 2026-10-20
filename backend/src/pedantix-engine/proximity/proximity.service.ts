import { Injectable } from '@nestjs/common';

import { ArticleIndex, BoardState } from '../matching/article-index';
import { STOPWORDS } from '../linguistics/stopwords';
import { VectorStoreService } from './vector-store.service';
import { toGrade } from './proximity.config';

const MAX_GUESS_CANDIDATES = 4;

@Injectable()
export class ProximityService {
  constructor(private readonly vectors: VectorStoreService) {}

  /**
   * Grades every hidden, gradable article word against the guess and stores
   * the best grade seen per word on the shared board.
   * Returns the best grade produced by this guess (0 = nothing colored).
   */
  grade(
    index: ArticleIndex,
    board: BoardState,
    normalizedGuess: string,
    guessLemmas: string[],
  ): number {
    if (!this.vectors.isReady) return 0;
    if (STOPWORDS.has(normalizedGuess) || /\d/.test(normalizedGuess)) return 0;

    const candidates = [normalizedGuess, ...guessLemmas]
      .filter((word, i, all) => all.indexOf(word) === i)
      .filter((word) => this.vectors.has(word))
      .slice(0, MAX_GUESS_CANDIDATES);
    if (candidates.length === 0) return 0;

    let best = 0;
    for (const [vectorWord, ids] of index.byVectorWord) {
      const hidden = ids.filter((id) => !board.revealed.has(id));
      if (hidden.length === 0) continue;

      let similarity = -1;
      for (const candidate of candidates) {
        const value = this.vectors.similarity(candidate, vectorWord);
        if (value !== null && value > similarity) similarity = value;
      }

      const grade = toGrade(similarity);
      if (grade === 0) continue;
      best = Math.max(best, grade);
      for (const id of hidden) {
        if (grade > (board.grades.get(id) ?? 0)) board.grades.set(id, grade);
      }
    }
    return best;
  }
}