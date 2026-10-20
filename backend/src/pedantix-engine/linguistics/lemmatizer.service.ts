import { Injectable } from '@nestjs/common';
import * as wink from 'wink-lemmatizer';

import { normalizeText } from './normalizer';

/** Forms wink-lemmatizer leaves untouched but that clearly belong to a lemma. */
const OVERRIDES: Readonly<Record<string, string>> = {
  being: 'be',
};

/**
 * Returns the *set of candidate lemmas* of a word.
 *
 * There is no part-of-speech tagging, so ambiguous forms keep every reading:
 * "saw" -> {saw, see}, "leaves" -> {leaves, leaf, leave}. Two words are
 * considered the same word when their candidate sets intersect.
 * The normalized word itself is always part of the result (first element).
 */
@Injectable()
export class LemmatizerService {
  private readonly cache = new Map<string, string[]>();

  lemmas(rawWord: string): string[] {
    const word = normalizeText(rawWord);
    const cached = this.cache.get(word);
    if (cached) return cached;

    const out = new Set<string>([word]);
    const base = this.stripPossessive(word);
    out.add(base);

    // Hyphenated compounds and numbers stay as they are.
    if (!base.includes('-') && !/\d/.test(base)) {
      out.add(wink.noun(base));
      out.add(wink.verb(base));
      out.add(wink.adjective(base));
      const override = OVERRIDES[base];
      if (override) out.add(override);
    }

    const result = [...out].filter((lemma) => lemma.length > 0);
    this.cache.set(word, result);
    return result;
  }

  /** "king's" -> "king", "kings'" -> "kings". */
  private stripPossessive(word: string): string {
    if (word.endsWith("'s")) return word.slice(0, -2) || word;
    if (word.endsWith("s'")) return word.slice(0, -1);
    return word;
  }
}