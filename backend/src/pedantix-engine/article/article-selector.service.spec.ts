import { Test, TestingModule } from '@nestjs/testing';

import { Article } from './article';
import { ArticleProvider } from './article.provider';
import { CuratedArticleProvider } from './curated/curated-article.provider';
import { ArticleSelectorService } from './article-selector.service';

describe('ArticleSelectorService', () => {
  let service: ArticleSelectorService;

  let articleProvider: {
    getRandomArticleCandidates: jest.Mock;
    getArticle: jest.Mock;
  };

  let curatedArticleProvider: {
    getRandomArticle: jest.Mock;
  };

  const article: Article = {
    id: 123,
    url: 'https://en.wikipedia.org/wiki/Jupiter',
    title: 'Jupiter',
    paragraphs: [
      'Jupiter is the fifth planet from the Sun and the largest in the Solar System.',
      'It is a gas giant with a mass more than two and a half times that of all other planets combined.',
      'Jupiter has been known since ancient times and is visible to the naked eye.',
    ],
  };

  const curatedArticle: Article = {
    id: 456,
    url: 'https://en.wikipedia.org/wiki/Mars',
    title: 'Mars',
    paragraphs: [
      'Mars is the fourth planet from the Sun.',
      'Mars is a terrestrial planet with a thin atmosphere.',
      'Mars has two small moons, Phobos and Deimos.',
    ],
  };

  beforeEach(async () => {
    jest.useRealTimers();

    articleProvider = {
      getRandomArticleCandidates: jest.fn(),
      getArticle: jest.fn(),
    };

    curatedArticleProvider = {
      getRandomArticle: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticleSelectorService,
        {
          provide: ArticleProvider,
          useValue: articleProvider,
        },
        {
          provide: CuratedArticleProvider,
          useValue: curatedArticleProvider,
        },
      ],
    }).compile();

    service = module.get<ArticleSelectorService>(
      ArticleSelectorService,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns the first playable Wikipedia article', async () => {
    articleProvider.getRandomArticleCandidates.mockResolvedValue([
      {
        id: 123,
        title: 'Jupiter',
        isDisambiguation: false,
      },
      {
        id: 456,
        title: 'Mars',
        isDisambiguation: false,
      },
    ]);

    articleProvider.getArticle.mockResolvedValueOnce(article);

    await expect(service.selectArticle()).resolves.toEqual(article);

    expect(
      articleProvider.getRandomArticleCandidates,
    ).toHaveBeenCalledTimes(1);

    expect(articleProvider.getArticle).toHaveBeenCalledTimes(1);
    expect(articleProvider.getArticle).toHaveBeenCalledWith(
      'Jupiter',
      expect.any(AbortSignal),
    );

    expect(
      curatedArticleProvider.getRandomArticle,
    ).not.toHaveBeenCalled();
  });

  it('skips disambiguation candidates', async () => {
    articleProvider.getRandomArticleCandidates.mockResolvedValue([
      {
        id: 1,
        title: 'Mercury',
        isDisambiguation: true,
      },
      {
        id: 123,
        title: 'Jupiter',
        isDisambiguation: false,
      },
    ]);

    articleProvider.getArticle.mockResolvedValue(article);

    await expect(service.selectArticle()).resolves.toEqual(article);

    expect(articleProvider.getArticle).toHaveBeenCalledTimes(1);
    expect(articleProvider.getArticle).toHaveBeenCalledWith(
      'Jupiter',
      expect.any(AbortSignal),
    );
  });

  it('skips candidates for which no article can be retrieved', async () => {
    articleProvider.getRandomArticleCandidates.mockResolvedValue([
      {
        id: 999,
        title: 'Unavailable article',
        isDisambiguation: false,
      },
      {
        id: 123,
        title: 'Jupiter',
        isDisambiguation: false,
      },
    ]);

    articleProvider.getArticle
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(article);

    await expect(service.selectArticle()).resolves.toEqual(article);

    expect(articleProvider.getArticle).toHaveBeenCalledTimes(2);

    expect(articleProvider.getArticle).toHaveBeenNthCalledWith(
      1,
      'Unavailable article',
      expect.any(AbortSignal),
    );

    expect(articleProvider.getArticle).toHaveBeenNthCalledWith(
      2,
      'Jupiter',
      expect.any(AbortSignal),
    );
  });

  it('falls back to the curated library when no Wikipedia candidate is playable', async () => {
    articleProvider.getRandomArticleCandidates.mockResolvedValue([
      {
        id: 999,
        title: 'Unavailable article',
        isDisambiguation: false,
      },
    ]);

    articleProvider.getArticle.mockResolvedValue(null);

    curatedArticleProvider.getRandomArticle.mockResolvedValue(
      curatedArticle,
    );

    await expect(service.selectArticle()).resolves.toEqual(
      curatedArticle,
    );

    expect(
      curatedArticleProvider.getRandomArticle,
    ).toHaveBeenCalledTimes(1);
  });

  it('falls back to the curated library when Wikipedia fails', async () => {
    articleProvider.getRandomArticleCandidates.mockRejectedValue(
      new Error('Wikipedia API returned HTTP 429'),
    );

    curatedArticleProvider.getRandomArticle.mockResolvedValue(
      curatedArticle,
    );

    await expect(service.selectArticle()).resolves.toEqual(
      curatedArticle,
    );

    expect(
      curatedArticleProvider.getRandomArticle,
    ).toHaveBeenCalledTimes(1);
  });

  it('aborts the Wikipedia request and falls back when the timeout expires', async () => {
    jest.useFakeTimers();

    let capturedSignal: AbortSignal | undefined;

    articleProvider.getRandomArticleCandidates.mockImplementation(
      (signal?: AbortSignal) => {
        capturedSignal = signal;

        return new Promise(() => {});
      },
    );

    curatedArticleProvider.getRandomArticle.mockResolvedValue(
      curatedArticle,
    );

    const selectionPromise = service.selectArticle();

    // Laisse selectArticle démarrer et transmettre son signal.
    await Promise.resolve();

    expect(capturedSignal).toBeDefined();
    expect(capturedSignal?.aborted).toBe(false);

    // Le délai global de Wikipedia est de 5 secondes.
    await jest.advanceTimersByTimeAsync(5000);

    await expect(selectionPromise).resolves.toEqual(curatedArticle);

    // Le contrôleur doit avoir annulé la tentative Wikipedia.
    expect(capturedSignal?.aborted).toBe(true);

    expect(
      curatedArticleProvider.getRandomArticle,
    ).toHaveBeenCalledTimes(1);
  });

  it('throws an explicit error when Wikipedia and the curated library fail', async () => {
    articleProvider.getRandomArticleCandidates.mockRejectedValue(
      new Error('Wikipedia API returned HTTP 429'),
    );

    curatedArticleProvider.getRandomArticle.mockRejectedValue(
      new Error('Curated article library is empty'),
    );

    await expect(service.selectArticle()).rejects.toThrow(
      'Unable to select an article from Wikipedia or the curated library',
    );
  });

  it('does not request content for disambiguation pages', async () => {
    articleProvider.getRandomArticleCandidates.mockResolvedValue([
      {
        id: 1,
        title: 'Mercury',
        isDisambiguation: true,
      },
    ]);

    curatedArticleProvider.getRandomArticle.mockResolvedValue(
      curatedArticle,
    );

    await expect(service.selectArticle()).resolves.toEqual(
      curatedArticle,
    );

    expect(articleProvider.getArticle).not.toHaveBeenCalled();
  });
});
