import { Test, TestingModule } from '@nestjs/testing';

import { PedantixEngineService } from './pedantix-engine.service';
import { ArticleSelectorService } from './article/article-selector.service';
import { Article } from './article/article';
import { TokenizerService } from './tokenizer/tokenizer.service';
import { ArticleTokenized } from './tokenizer/article-tokenized';

describe('PedantixEngineService', () => {
  let service: PedantixEngineService;

  let articleSelector: {
    selectArticle: jest.Mock;
  };

  let tokenizer: {
    tokenize: jest.Mock;
  };

  const article: Article = {
    id: 123,
    url: 'https://en.wikipedia.org/wiki/Jupiter',
    title: 'Jupiter',
    paragraphs: [
      'Jupiter is the fifth planet from the Sun.',
      'It is the largest planet in the Solar System.',
      'Jupiter is a gas giant.',
    ],
  };

  const tokenizedArticle: ArticleTokenized = {
    articleId: 123,
    url: 'https://en.wikipedia.org/wiki/Jupiter',
    title: 'Jupiter',
    paragraphs: [
      {
        tokens: [
          { text: 'Jupiter', type: 'word', length: 7 },
          { text: ' ', type: 'separator' },
          { text: 'is', type: 'word', length: 2 },
        ],
      },
    ],
  };

  beforeEach(async () => {
    articleSelector = {
      selectArticle: jest.fn(),
    };

    tokenizer = {
      tokenize: jest.fn().mockReturnValue(tokenizedArticle),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PedantixEngineService,
        {
          provide: ArticleSelectorService,
          useValue: articleSelector,
        },
        {
          provide: TokenizerService,
          useValue: tokenizer,
        },
      ],
    }).compile();

    service = module.get<PedantixEngineService>(
      PedantixEngineService,
    );
  });

  it('prepares a game successfully', async () => {
    articleSelector.selectArticle.mockResolvedValue(article);

    await service.prepareGame('game-1');

    expect(articleSelector.selectArticle).toHaveBeenCalledTimes(1);
    expect(tokenizer.tokenize).toHaveBeenCalledWith(article);
    expect(service.isGamePrepared('game-1')).toBe(true);
    expect(service.getTokenizedArticle('game-1')).toEqual(
      tokenizedArticle,
    );
  });

  it('does not prepare an already prepared game twice', async () => {
    articleSelector.selectArticle.mockResolvedValue(article);

    await service.prepareGame('game-1');
    await service.prepareGame('game-1');

    expect(articleSelector.selectArticle).toHaveBeenCalledTimes(1);
    expect(tokenizer.tokenize).toHaveBeenCalledTimes(1);
  });

  it('shares an ongoing preparation for the same game', async () => {
    let resolveArticle!: (value: Article) => void;

    articleSelector.selectArticle.mockReturnValue(
      new Promise<Article>((resolve) => {
        resolveArticle = resolve;
      }),
    );

    const firstPreparation = service.prepareGame('game-1');
    const secondPreparation = service.prepareGame('game-1');

    expect(articleSelector.selectArticle).toHaveBeenCalledTimes(1);
    expect(service.isGamePrepared('game-1')).toBe(false);

    resolveArticle(article);

    await Promise.all([firstPreparation, secondPreparation]);

    expect(service.isGamePrepared('game-1')).toBe(true);
    expect(service.getTokenizedArticle('game-1')).toEqual(
      tokenizedArticle,
    );
    expect(articleSelector.selectArticle).toHaveBeenCalledTimes(1);
    expect(tokenizer.tokenize).toHaveBeenCalledTimes(1);
  });

  it('allows a new preparation attempt after an article selection failure', async () => {
    articleSelector.selectArticle
      .mockRejectedValueOnce(new Error('Article selection failed'))
      .mockResolvedValueOnce(article);

    await expect(service.prepareGame('game-1')).rejects.toThrow(
      'Article selection failed',
    );

    expect(service.isGamePrepared('game-1')).toBe(false);

    await service.prepareGame('game-1');

    expect(service.isGamePrepared('game-1')).toBe(true);
    expect(articleSelector.selectArticle).toHaveBeenCalledTimes(2);
    expect(tokenizer.tokenize).toHaveBeenCalledTimes(1);
  });

  it('does not prepare a game when tokenization fails', async () => {
    articleSelector.selectArticle.mockResolvedValue(article);
    tokenizer.tokenize.mockImplementation(() => {
      throw new Error('Tokenization failed');
    });

    await expect(service.prepareGame('game-1')).rejects.toThrow(
      'Tokenization failed',
    );

    expect(service.isGamePrepared('game-1')).toBe(false);
    expect(service.getTokenizedArticle('game-1')).toBeUndefined();
  });

  it('allows a new preparation attempt after a tokenization failure', async () => {
    articleSelector.selectArticle.mockResolvedValue(article);

    tokenizer.tokenize
      .mockImplementationOnce(() => {
        throw new Error('Tokenization failed');
      })
      .mockReturnValueOnce(tokenizedArticle);

    await expect(service.prepareGame('game-1')).rejects.toThrow(
      'Tokenization failed',
    );

    expect(service.isGamePrepared('game-1')).toBe(false);

    await service.prepareGame('game-1');

    expect(service.isGamePrepared('game-1')).toBe(true);
    expect(tokenizer.tokenize).toHaveBeenCalledTimes(2);
  });
});
