import { Injectable } from '@nestjs/common';

import { Article } from './article/article';
import { ArticleSelectorService } from './article/article-selector.service';
import { ArticleTokenized } from './tokenizer/article-tokenized';
import { TokenizerService } from './tokenizer/tokenizer.service';

interface PreparedGame {
  article: Article;
  tokenizedArticle: ArticleTokenized;
}

@Injectable()
export class PedantixEngineService {
  private readonly games = new Map<string, PreparedGame>();
  private readonly preparations = new Map<string, Promise<void>>();

  constructor(
    private readonly articleSelector: ArticleSelectorService,
    private readonly tokenizer: TokenizerService,
  ) {}

  async prepareGame(gameId: string): Promise<void> {
    if (this.games.has(gameId)) {
      return;
    }

    const existingPreparation = this.preparations.get(gameId);

    if (existingPreparation) {
      return existingPreparation;
    }

    const preparation = this.doPrepareGame(gameId);

    this.preparations.set(gameId, preparation);

    try {
      await preparation;
    } finally {
      this.preparations.delete(gameId);
    }
  }

  isGamePrepared(gameId: string): boolean {
    return this.games.has(gameId);
  }

  getTokenizedArticle(gameId: string): ArticleTokenized | undefined {
    return this.games.get(gameId)?.tokenizedArticle;
  }

  private async doPrepareGame(gameId: string): Promise<void> {
    const article = await this.articleSelector.selectArticle();
    const tokenizedArticle = this.tokenizer.tokenize(article);

    this.games.set(gameId, {
      article,
      tokenizedArticle,
    });
  }
}
