import { ArticleTokenized } from '../tokenizer/article-tokenized';
import { ArticleViewService } from './article-view.service';

describe('ArticleViewService', () => {
  let service: ArticleViewService;

  const article: ArticleTokenized = {
    articleId: 123,
    url: 'https://en.wikipedia.org/wiki/Jupiter',
    title: {
      tokens: [
        { text: 'Jupiter', type: 'word', length: 7 },
        { text: ' ', type: 'separator' },
        { text: 'Planet', type: 'word', length: 6 },
      ],
    },
    paragraphs: [
      {
        tokens: [
          { text: 'Jupiter', type: 'word', length: 7 },
          { text: ' ', type: 'separator' },
          { text: 'is', type: 'word', length: 2 },
          { text: ',', type: 'separator' },
          { text: ' ', type: 'separator' },
          { text: 'large', type: 'word', length: 5 },
          { text: '.', type: 'separator' },
        ],
      },
    ],
  };

  beforeEach(() => {
    service = new ArticleViewService();
  });

  it('should mask every word in the title', () => {
    const result = service.buildInitialView(article);

    expect(result.title.tokens).toEqual([
      { type: 'word', status: 'hidden', length: 7 },
      { type: 'separator', display: ' ' },
      { type: 'word', status: 'hidden', length: 6 },
    ]);
  });

  it('should mask every word in the paragraphs', () => {
    const result = service.buildInitialView(article);

    expect(result.paragraphs[0].tokens).toEqual([
      { type: 'word', status: 'hidden', length: 7 },
      { type: 'separator', display: ' ' },
      { type: 'word', status: 'hidden', length: 2 },
      { type: 'separator', display: ',' },
      { type: 'separator', display: ' ' },
      { type: 'word', status: 'hidden', length: 5 },
      { type: 'separator', display: '.' },
    ]);
  });

  it('should not expose hidden word text or display fields', () => {
    const result = service.buildInitialView(article);
    const tokens = [
      ...result.title.tokens,
      ...result.paragraphs.flatMap((paragraph) => paragraph.tokens),
    ];

    const hiddenWords = tokens.filter(
      (token) => token.type === 'word',
    );

    for (const token of hiddenWords) {
      expect(token).not.toHaveProperty('text');
      expect(token).not.toHaveProperty('display');
    }

    const serializedResult = JSON.stringify(result);

    expect(serializedResult).not.toContain('Jupiter');
    expect(serializedResult).not.toContain('Planet');
    expect(serializedResult).not.toContain('large');
  });

  it('should not expose internal article metadata', () => {
    const result = service.buildInitialView(article);

    expect(result).not.toHaveProperty('articleId');
    expect(result).not.toHaveProperty('url');
  });
});
