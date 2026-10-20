import { Injectable } from '@nestjs/common';

import { Article } from './article/article';
import { ArticleSelectorService } from './article/article-selector.service';
import { ArticleTokenized } from './tokenizer/article-tokenized';
import { TokenizerService } from './tokenizer/tokenizer.service';
import { ArticleViewService } from './article-view/article-view.service';
import { InitialArticleView } from './article-view/initial-article-view';
import { BoardView } from './article-view/board-view';
import {
  ArticleIndex,
  ArticleIndexService,
  BoardState,
  createBoard,
} from './matching/article-index';
import { GuessEngineService } from './guess/guess-engine.service';
import { GuessOutcome } from './guess/guess.types';

interface PreparedGame {
  article: Article;
  tokenizedArticle: ArticleTokenized;
  index: ArticleIndex;
  /** One board per game, shared by every player of the room. */
  board: BoardState;
}

@Injectable()
export class PedantixEngineService {
  private readonly games = new Map<string, PreparedGame>();
  private readonly preparations = new Map<string, Promise<void>>();

  constructor(
    private readonly articleSelector: ArticleSelectorService,
    private readonly tokenizer: TokenizerService,
    private readonly articleView: ArticleViewService,
    private readonly articleIndex: ArticleIndexService,
    private readonly guessEngine: GuessEngineService,
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

  getArticleTitle(gameId: string): string | undefined {
    return this.games.get(gameId)?.article.title;
  }

  getInitialArticleView(gameId: string): InitialArticleView | undefined {
    const tokenizedArticle = this.games.get(gameId)?.tokenizedArticle;

    if (!tokenizedArticle) {
      return undefined;
    }

    return this.articleView.buildInitialView(tokenizedArticle);
  }

  /** Current shared board (reveals + proximity grades). */
  getArticleView(gameId: string): BoardView | undefined {
    const game = this.games.get(gameId);
    if (!game) return undefined;
    return this.articleView.buildBoardView(game.tokenizedArticle, game.board);
  }

  /** Whole article uncovered, used once the game is finished. */
  getRevealedArticleView(gameId: string): BoardView | undefined {
    const game = this.games.get(gameId);
    if (!game) return undefined;
    return this.articleView.buildBoardView(
      game.tokenizedArticle,
      game.board,
      true,
    );
  }

  /** Applies one guess to the shared board. Synchronous, hence race-free. */
  applyGuess(gameId: string, rawGuess: string): GuessOutcome | undefined {
    const game = this.games.get(gameId);
    if (!game) return undefined;
    return this.guessEngine.run(game.index, game.board, rawGuess);
  }

  releaseGame(gameId: string): void {
    this.games.delete(gameId);
  }

  private async doPrepareGame(gameId: string): Promise<void> {
    const article = await this.articleSelector.selectArticle();
    const tokenizedArticle = this.tokenizer.tokenize(article);
    const index = this.articleIndex.build(tokenizedArticle);

    this.games.set(gameId, {
      article,
      tokenizedArticle,
      index,
      board: createBoard(),
    });
  }
}
