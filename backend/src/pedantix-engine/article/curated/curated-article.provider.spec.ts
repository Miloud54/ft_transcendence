import { CuratedArticleProvider } from './curated-article.provider';

describe('CuratedArticleProvider', () => {
  let provider: CuratedArticleProvider;

  beforeEach(() => {
    provider = new CuratedArticleProvider();
  });

  it('loads and returns a valid article from the real JSON library', async () => {
    const article = await provider.getRandomArticle();

    expect(article).toBeDefined();

    expect(Number.isInteger(article.id)).toBe(true);
    expect(article.title.trim().length).toBeGreaterThan(0);
    expect(article.url.trim().length).toBeGreaterThan(0);

    expect(article.paragraphs.length).toBeGreaterThanOrEqual(3);

    for (const paragraph of article.paragraphs) {
      expect(paragraph.trim().length).toBeGreaterThan(0);
    }
  });
});
