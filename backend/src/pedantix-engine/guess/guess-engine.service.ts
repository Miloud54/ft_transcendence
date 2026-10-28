import { Injectable } from '@nestjs/common';

import { ArticleIndex, BoardState } from '../matching/article-index';
import { LemmatizerService } from '../linguistics/lemmatizer.service';
import { normalizeText, WORD_PATTERN } from '../linguistics/normalizer';
import { ProximityService } from '../proximity/proximity.service';
import { VectorStoreService } from '../proximity/vector-store.service';
import { GuessOutcome } from './guess.types';

const MAX_GUESS_LENGTH = 100;

/**
 * Pure game logic for one guess on a shared board:
 *   1. normalize + validate
 *   2. reveal exact / inflected matches (lemma sets)
 *   3. grade proximity of the remaining hidden words
 *   4. detect title completion
 * It is synchronous on purpose: Node runs it atomically, so two simultaneous
 * guesses can never double-reveal or double-count.
 */
@Injectable()
export class GuessEngineService {
  constructor(
    private readonly lemmatizer: LemmatizerService,
    private readonly vectors: VectorStoreService,
    private readonly proximity: ProximityService,
  ) {}

  run(
    index: ArticleIndex,
    board: BoardState,
    rawGuess: string,
    guessed: Set<string> = board.guessed,
    titleRevealedIds?: Set<number>,
  ): GuessOutcome {
    const normalized = normalizeText(rawGuess);

    if (board.finished) return reject('GAME_FINISHED', normalized);
    if (normalized.length === 0) return reject('EMPTY', normalized);
    if (normalized.length > MAX_GUESS_LENGTH) {
      return reject('TOO_LONG', normalized);
    }

    // The full title is the only multi-word guess accepted.
    const isFullTitle =
      normalized.includes(' ') && normalized === index.normalizedTitle;
    if (normalized.includes(' ') && !isFullTitle) {
      return reject('SINGLE_WORD_ONLY', normalized);
    }
    if (guessed.has(normalized)) {
      return reject('ALREADY_GUESSED', normalized);
    }

    const lemmas = isFullTitle ? [] : this.lemmatizer.lemmas(normalized);

    if (!isFullTitle && !this.isValidWord(index, normalized, lemmas)) {
      return reject('NOT_A_WORD', normalized);
    }

    // --- reveal ---
    const matched = isFullTitle
      ? [...index.titleWordIds]
      : unique(lemmas.flatMap((lemma) => index.byLemma.get(lemma) ?? []));
    const revealsTitleWord = matched.some((id) =>
      index.titleWordIds.includes(id),
    );
    const foundInText = matched.length > 0;
    for (const id of matched) {
      if (index.titleWordIds.includes(id)) titleRevealedIds?.add(id);
    }

    let revealedCount = 0;
    for (const id of matched) {
      if (!board.revealed.has(id)) {
        board.revealed.add(id);
        board.grades.delete(id);
        revealedCount += 1;
      }
    }

    // --- proximity (only for what is still hidden) ---
    const bestGrade = isFullTitle
      ? 0
      : this.proximity.grade(index, board, normalized, lemmas);

    guessed.add(normalized);

    const titleFound =
      index.titleWordIds.length > 0 &&
      index.titleWordIds.every((id) => titleRevealedIds?.has(id));

    return {
      valid: true,
      normalized,
      revealedCount,
      foundInText,
      bestGrade,
      titleFound,
      revealsTitleWord,
    };
  }

  /** A guess is valid if the article contains it, the dictionary knows it, or it is a number. */
  private isValidWord(
    index: ArticleIndex,
    normalized: string,
    lemmas: string[],
  ): boolean {
    if (!WORD_PATTERN.test(normalized)) return false;
    if (index.normalizedForms.has(normalized)) return true;
    if (lemmas.some((lemma) => index.byLemma.has(lemma))) return true;
    // Numbers (years, quantities) are fair guesses even when absent from the text.
    if (/^\d{1,12}$/.test(normalized)) return true;
    if (this.vectors.isReady) {
      return lemmas.some((lemma) => this.vectors.has(lemma));
    }
    // Dev fallback without vector files: accept single letters and alphabetic words.
    return /^(?:\p{L}|\p{L}+(?:['-]\p{L}+)*)$/u.test(normalized);
  }
}

function reject(
  reason: Extract<GuessOutcome, { valid: false }>['reason'],
  normalized: string,
): GuessOutcome {
  return { valid: false, reason, normalized };
}

function unique(ids: number[]): number[] {
  return [...new Set(ids)];
}