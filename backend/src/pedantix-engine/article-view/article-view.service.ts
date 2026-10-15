import { Injectable } from '@nestjs/common';

import { ArticleTokenized, ArticleToken } from '../tokenizer/article-tokenized';

import { ArticleViewToken, InitialArticleView } from './initial-article-view';

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
