import { Test, TestingModule } from '@nestjs/testing';
import { Article } from './article';
import { ArticleProvider } from './article.provider';
import { ArticleSelectorService } from './article-selector.service';

describe('ArticleSelectorService', () => {
  let service: ArticleSelectorService;
  let articleProvider: {
    getRandomArticleCandidate: jest.Mock;
    getArticle: jest.Mock;
  };

  beforeEach(async () => {
    articleProvider = {
      getRandomArticleCandidate: jest.fn(),
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

    service = module.get<ArticleSelectorService>(
      ArticleSelectorService,
    );
  });

  it('returns a valid English article', async () => {
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

    articleProvider.getRandomArticleCandidate.mockResolvedValue({
      id: 123,
      title: 'Jupiter',
      isDisambiguation: false,
    });

    articleProvider.getArticle.mockResolvedValue(article);

    await expect(service.selectArticle()).resolves.toEqual(article);
  });

  it('skips disambiguation candidates', async () => {
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

    articleProvider.getArticle.mockResolvedValue(article);

    await expect(service.selectArticle()).resolves.toEqual(article);

    expect(
      articleProvider.getRandomArticleCandidate,
    ).toHaveBeenCalledTimes(2);

    expect(articleProvider.getArticle).toHaveBeenCalledTimes(1);
    expect(articleProvider.getArticle).toHaveBeenCalledWith('Jupiter');
  });

  it('skips candidates for which no article can be retrieved', async () => {
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

    articleProvider.getArticle
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(article);

    await expect(service.selectArticle()).resolves.toEqual(article);

    expect(articleProvider.getRandomArticleCandidate).toHaveBeenCalledTimes(
      2,
    );

    expect(articleProvider.getArticle).toHaveBeenCalledTimes(2);
  });
});