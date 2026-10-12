import { Test, TestingModule } from '@nestjs/testing';
import { Article } from './article';
import { ArticleProvider } from './article.provider';
import { ArticleSelectorService } from './article-selector.service';

describe('ArticleSelectorService', () => {
  let service: ArticleSelectorService;
  let articleProvider: {
    getRandomArticleCandidates: jest.Mock;
    getArticle: jest.Mock;
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

  beforeEach(async () => {
    articleProvider = {
      getRandomArticleCandidates: jest.fn(),
      getArticle: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticleSelectorService,
        {
          provide: ArticleProvider,
          useValue: articleProvider,
        },
      ],
    }).compile();

    service = module.get<ArticleSelectorService>(ArticleSelectorService);
  });

  it('returns the first playable article', async () => {
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

    articleProvider.getArticle
      .mockResolvedValueOnce(article);

    await expect(service.selectArticle()).resolves.toEqual(article);

    expect(
      articleProvider.getRandomArticleCandidates,
    ).toHaveBeenCalledTimes(1);

    expect(articleProvider.getArticle).toHaveBeenCalledTimes(1);
    expect(articleProvider.getArticle).toHaveBeenCalledWith('Jupiter');
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

    expect(
      articleProvider.getRandomArticleCandidates,
    ).toHaveBeenCalledTimes(1);

    expect(articleProvider.getArticle).toHaveBeenCalledTimes(1);
    expect(articleProvider.getArticle).toHaveBeenCalledWith('Jupiter');
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

    expect(
      articleProvider.getRandomArticleCandidates,
    ).toHaveBeenCalledTimes(1);

    expect(articleProvider.getArticle).toHaveBeenCalledTimes(2);

    expect(articleProvider.getArticle).toHaveBeenNthCalledWith(
      1,
      'Unavailable article',
    );

    expect(articleProvider.getArticle).toHaveBeenNthCalledWith(
      2,
      'Jupiter',
    );
  });

  it('throws when none of the candidates is playable', async () => {
    articleProvider.getRandomArticleCandidates.mockResolvedValue([
      {
        id: 999,
        title: 'Unavailable article',
        isDisambiguation: false,
      },
    ]);

    articleProvider.getArticle.mockResolvedValue(null);

    await expect(service.selectArticle()).rejects.toThrow(
      'Unable to find a playable article among the 10 candidates',
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

    await expect(service.selectArticle()).rejects.toThrow(
      'Unable to find a playable article among the 10 candidates',
    );

    expect(articleProvider.getArticle).not.toHaveBeenCalled();
  });
});
