export type GuessRejection =
  | 'EMPTY'
  | 'TOO_LONG'
  | 'SINGLE_WORD_ONLY'
  | 'NOT_A_WORD'
  | 'ALREADY_GUESSED'
  | 'GAME_FINISHED';

export type GuessOutcome =
  | { valid: false; reason: GuessRejection; normalized: string }
  | {
      valid: true;
      normalized: string;
      /** tokens newly revealed by this guess (title + body) */
      revealedCount: number;
      /** true when the guessed word occurs in the article, even if already revealed */
      foundInText: boolean;
      /** best proximity grade produced (0 = nothing colored, 1..4) */
      bestGrade: number;
      /** true when this guess made the whole title visible */
      titleFound: boolean;
      /** true when this guess revealed at least one title word */
      revealsTitleWord: boolean;
    };
