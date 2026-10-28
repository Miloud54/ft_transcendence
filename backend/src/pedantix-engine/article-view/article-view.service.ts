import { Injectable } from '@nestjs/common';

import { ArticleTokenized, ArticleToken } from '../tokenizer/article-tokenized';
import { BoardState } from '../matching/article-index';

import { ArticleViewToken, InitialArticleView } from './initial-article-view';
import { BoardView, BoardViewToken } from './board-view';

@Injectable()
export class ArticleViewService {
  buildInitialView(article: ArticleTokenized): InitialArticleView {
    return {
      title: {
        tokens: article.title.tokens.map((token) => this.toPublicToken(token)),
      },
      paragraphs: article.paragraphs.map((paragraph) => ({
        tokens: paragraph.tokens.map((token) => this.toPublicToken(token)),
      })),
    };
  }

  /**
   * Current board view. Word ids are assigned in reading order (title, then
   * paragraphs), exactly like ArticleIndexService, so both stay aligned.
   * Hidden words only expose their length and, if close, a 1..4 grade.
   */
  buildBoardView(
    article: ArticleTokenized,
    board: BoardState,
    revealAll = false,
    titleRevealedIds?: Set<number>,
  ): BoardView {
    let nextId = 0;
    const convert = (
      token: ArticleToken,
      isTitle: boolean,
    ): BoardViewToken => {
      if (token.type === 'separator') {
        return { type: 'separator', display: token.text };
      }
      const id = nextId++;
      const length = token.length ?? 0;
      const titleRevealed =
        !isTitle || titleRevealedIds === undefined
          ? board.revealed.has(id)
          : titleRevealedIds.has(id);
      if (revealAll || titleRevealed) {
        return { type: 'word', status: 'revealed', length, display: token.text };
      }
      const grade = board.grades.get(id);
      if (!grade) {
        return { type: 'word', status: 'hidden', length };
      }
      const closestGuess = board.bestGuesses.get(id);
      return {
        type: 'word',
        status: 'hidden',
        length,
        grade,
        ...(closestGuess ? { closestGuess } : {}),
      };
    };

    return {
      title: { tokens: article.title.tokens.map((token) => convert(token, true)) },
      paragraphs: article.paragraphs.map((paragraph) => ({
        tokens: paragraph.tokens.map((token) => convert(token, false)),
      })),
    };
  }

  private toPublicToken(token: ArticleToken): ArticleViewToken {
    if (token.type === 'separator') {
      return {
        type: 'separator',
        display: token.text,
      };
    }

    return {
      type: 'word',
      status: 'hidden',
      length: token.length ?? 0,
    };
  }
}