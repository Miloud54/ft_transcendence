import { Test, TestingModule } from '@nestjs/testing';
import { Article } from './article';
import { ArticleProvider } from './article.provider';
import { ArticleSelectorService } from './article-selector.service';

describe('ArticleSelectorService', () => {
  let service: ArticleSelectorService;
  let articleProvider: {
    getRandomArticleCandidate: jest.Mock;
    getArticle: jest.Mock;
    getAverageMonthlyPageviews: jest.Mock;
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
      getRandomArticleCandidate: jest.fn(),
      getArticle: jest.fn(),
      getAverageMonthlyPageviews: jest.fn(),
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

  it('returns a valid popular English article', async () => {
    articleProvider.getRandomArticleCandidate.mockResolvedValue({
      id: 123,
      title: 'Jupiter',
      isDisambiguation: false,
    });
    articleProvider.getAverageMonthlyPageviews.mockResolvedValue(149_212);
    articleProvider.getArticle.mockResolvedValue(article);

    await expect(service.selectArticle()).resolves.toEqual(article);

    expect(
      articleProvider.getAverageMonthlyPageviews,
    ).toHaveBeenCalledWith('Jupiter');
    expect(articleProvider.getArticle).toHaveBeenCalledWith('Jupiter');
  });

  it('skips disambiguation candidates without checking their popularity', async () => {
    articleProvider.getRandomArticleCandidate
      .mockResolvedValueOnce({
        id: 1,
        title: 'Mercury',
        isDisambiguation: true,
      })
      .mockResolvedValueOnce({
        id: 123,
        title: 'Jupiter',
        isDisambiguation: false,
      });

    articleProvider.getAverageMonthlyPageviews.mockResolvedValue(149_212);
    articleProvider.getArticle.mockResolvedValue(article);

    await expect(service.selectArticle()).resolves.toEqual(article);

    expect(
      articleProvider.getRandomArticleCandidate,
    ).toHaveBeenCalledTimes(2);
    expect(
      articleProvider.getAverageMonthlyPageviews,
    ).toHaveBeenCalledTimes(1);
    expect(
      articleProvider.getAverageMonthlyPageviews,
    ).toHaveBeenCalledWith('Jupiter');
    expect(articleProvider.getArticle).toHaveBeenCalledTimes(1);
  });

  it('skips articles below the popularity threshold', async () => {
    articleProvider.getRandomArticleCandidate
      .mockResolvedValueOnce({
        id: 456,
        title: 'List of minor planets',
        isDisambiguation: false,
      })
      .mockResolvedValueOnce({
        id: 123,
        title: 'Jupiter',
        isDisambiguation: false,
      });

    articleProvider.getAverageMonthlyPageviews
      .mockResolvedValueOnce(5_824)
      .mockResolvedValueOnce(149_212);

    articleProvider.getArticle.mockResolvedValue(article);

    await expect(service.selectArticle()).resolves.toEqual(article);

    expect(
      articleProvider.getAverageMonthlyPageviews,
    ).toHaveBeenCalledTimes(2);
    expect(articleProvider.getArticle).toHaveBeenCalledTimes(1);
    expect(articleProvider.getArticle).toHaveBeenCalledWith('Jupiter');
  });

  it('accepts an article exactly at the popularity threshold', async () => {
    articleProvider.getRandomArticleCandidate.mockResolvedValue({
      id: 123,
      title: 'Jupiter',
      isDisambiguation: false,
    });
    articleProvider.getAverageMonthlyPageviews.mockResolvedValue(10_000);
    articleProvider.getArticle.mockResolvedValue(article);

    await expect(service.selectArticle()).resolves.toEqual(article);

    expect(articleProvider.getArticle).toHaveBeenCalledWith('Jupiter');
  });

  it('skips candidates for which no article can be retrieved', async () => {
    articleProvider.getRandomArticleCandidate
      .mockResolvedValueOnce({
        id: 999,
        title: 'Unavailable article',
        isDisambiguation: false,
      })
      .mockResolvedValueOnce({
        id: 123,
        title: 'Jupiter',
        isDisambiguation: false,
      });

    articleProvider.getAverageMonthlyPageviews.mockResolvedValue(149_212);
    articleProvider.getArticle
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(article);

    await expect(service.selectArticle()).resolves.toEqual(article);

    expect(
      articleProvider.getRandomArticleCandidate,
    ).toHaveBeenCalledTimes(2);
    expect(articleProvider.getArticle).toHaveBeenCalledTimes(2);
  });
});
