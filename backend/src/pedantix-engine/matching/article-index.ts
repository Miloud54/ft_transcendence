import { Injectable } from '@nestjs/common';

import { ArticleTokenized, ArticleToken } from '../tokenizer/article-tokenized';
import { LemmatizerService } from '../linguistics/lemmatizer.service';
import { normalizeText } from '../linguistics/normalizer';
import { STOPWORDS } from '../linguistics/stopwords';
import { VectorStoreService } from '../proximity/vector-store.service';

export interface IndexedWord {
  /** Global word id: title words first, then paragraphs, in reading order. */
  id: number;
  /** -1 for the title, otherwise the paragraph index. */
  section: number;
  /** Index of the token inside its section. */
  tokenIndex: number;
  text: string;
  normalized: string;
  /** Candidate lemmas (always includes the normalized form). */
  lemmas: string[];
  /** Word used to look up the embedding, if any. */
  vectorWord: string | null;
  /** Eligible for proximity coloring. */
  gradable: boolean;
}

export interface ArticleIndex {
  words: IndexedWord[];
  titleWordIds: number[];
  /** lemma (or normalized form) -> word ids */
  byLemma: Map<string, number[]>;
  /** embedding word -> gradable word ids */
  byVectorWord: Map<string, number[]>;
  /** every normalized surface form of the article, used by validation */
  normalizedForms: Set<string>;
  /** normalized title words joined by a single space */
  normalizedTitle: string;
}

export interface BoardState {
  revealed: Set<number>;
  /** word id -> highest proximity grade received (1..4) */
  grades: Map<number, number>;
  /** word id -> the guess that produced the current best grade */
  bestGuesses: Map<number, string>;
  guessed: Set<string>;
  finished: boolean;
}

export function createBoard(): BoardState {
  return {
    revealed: new Set(),
    grades: new Map(),
    bestGuesses: new Map(),
    guessed: new Set(),
    finished: false,
  };
}

@Injectable()
export class ArticleIndexService {
  constructor(
    private readonly lemmatizer: LemmatizerService,
    private readonly vectors: VectorStoreService,
  ) {}

  build(article: ArticleTokenized): ArticleIndex {
    const index: ArticleIndex = {
      words: [],
      titleWordIds: [],
      byLemma: new Map(),
      byVectorWord: new Map(),
      normalizedForms: new Set(),
      normalizedTitle: '',
    };

    this.indexSection(index, -1, article.title.tokens);
    article.paragraphs.forEach((paragraph, section) =>
      this.indexSection(index, section, paragraph.tokens),
    );

    index.normalizedTitle = index.titleWordIds
      .map((id) => index.words[id].normalized)
      .join(' ');

    return index;
  }

  private indexSection(
    index: ArticleIndex,
    section: number,
    tokens: ArticleToken[],
  ) {
    tokens.forEach((token, tokenIndex) => {
      if (token.type !== 'word') return;

      const id = index.words.length;
      const normalized = normalizeText(token.text);
      const lemmas = this.lemmatizer.lemmas(normalized);
      const base = lemmas[1] ?? normalized; // possessive-stripped form
      const vectorWord =
        [base, ...lemmas].find((candidate) => this.vectors.has(candidate)) ??
        null;
      const gradable =
        vectorWord !== null && !STOPWORDS.has(base) && !/\d/.test(base);

      index.words.push({
        id,
        section,
        tokenIndex,
        text: token.text,
        normalized,
        lemmas,
        vectorWord,
        gradable,
      });

      if (section === -1) index.titleWordIds.push(id);
      index.normalizedForms.add(normalized);
      for (const lemma of lemmas) push(index.byLemma, lemma, id);
      if (gradable && vectorWord) push(index.byVectorWord, vectorWord, id);
    });
  }
}

function push(map: Map<string, number[]>, key: string, id: number) {
  const list = map.get(key);
  if (list) {
    if (list[list.length - 1] !== id) list.push(id);
  } else {
    map.set(key, [id]);
  }
}