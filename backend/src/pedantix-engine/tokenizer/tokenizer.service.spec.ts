import { TokenizerService } from './tokenizer.service';
import { Article } from '../article/article';

describe('TokenizerService', () => {
  let service: TokenizerService;

  const article: Article = {
    id: 123,
    url: 'https://en.wikipedia.org/wiki/Jupiter',
    title: 'Jupiter',
    paragraphs: [
      "Jupiter can't be seen clearly.",
      'It is a well-known planet with 42 moons.',
    ],
  };

  beforeEach(() => {
    service = new TokenizerService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should tokenize a simple word', () => {
    const result = service.tokenize({
      ...article,
      paragraphs: ['hello'],
    });

    expect(result.paragraphs[0].tokens).toEqual([
      { text: 'hello', type: 'word', length: 5 },
    ]);
  });

  it('should keep an English contraction as one word', () => {
    const result = service.tokenize({
      ...article,
      paragraphs: ["can't won't isn't"],
    });

    expect(result.paragraphs[0].tokens).toEqual([
      { text: "can't", type: 'word', length: 4 },
      { text: ' ', type: 'separator' },
      { text: "won't", type: 'word', length: 4 },
      { text: ' ', type: 'separator' },
      { text: "isn't", type: 'word', length: 4 },
    ]);
  });

  it('should support typographic apostrophes', () => {
    const result = service.tokenize({
      ...article,
      paragraphs: ['won’t'],
    });

    expect(result.paragraphs[0].tokens).toEqual([
      { text: 'won’t', type: 'word', length: 4 },
    ]);
  });

  it('should keep hyphenated words as one word', () => {
    const result = service.tokenize({
      ...article,
      paragraphs: ['mother-in-law well-known'],
    });

    expect(result.paragraphs[0].tokens).toEqual([
      { text: 'mother-in-law', type: 'word', length: 11 },
      { text: ' ', type: 'separator' },
      { text: 'well-known', type: 'word', length: 9 },
    ]);
  });

  it('should treat an em dash as a separator between words', () => {
    const result = service.tokenize({
      ...article,
      paragraphs: ['hello — world'],
    });

    expect(result.paragraphs[0].tokens).toEqual([
      { text: 'hello', type: 'word', length: 5 },
      { text: ' — ', type: 'separator' },
      { text: 'world', type: 'word', length: 5 },
    ]);
  });

  it('should tokenize numbers', () => {
    const result = service.tokenize({
      ...article,
      paragraphs: ['42'],
    });

    expect(result.paragraphs[0].tokens).toEqual([
      { text: '42', type: 'word', length: 2 },
    ]);
  });

  it('should preserve punctuation outside words', () => {
    const result = service.tokenize({
      ...article,
      paragraphs: ['Hello!'],
    });

    expect(result.paragraphs[0].tokens).toEqual([
      { text: 'Hello', type: 'word', length: 5 },
      { text: '!', type: 'separator' },
    ]);
  });

  it('should preserve multiple spaces', () => {
    const result = service.tokenize({
      ...article,
      paragraphs: ['hello  world'],
    });

    expect(result.paragraphs[0].tokens).toEqual([
      { text: 'hello', type: 'word', length: 5 },
      { text: '  ', type: 'separator' },
      { text: 'world', type: 'word', length: 5 },
    ]);
  });

  it('should preserve paragraph boundaries', () => {
    const result = service.tokenize({
      ...article,
      paragraphs: ['hello world', 'goodbye world'],
    });

    expect(result.paragraphs).toHaveLength(2);
    expect(result.paragraphs[0].tokens).toEqual([
      { text: 'hello', type: 'word', length: 5 },
      { text: ' ', type: 'separator' },
      { text: 'world', type: 'word', length: 5 },
    ]);
    expect(result.paragraphs[1].tokens).toEqual([
      { text: 'goodbye', type: 'word', length: 7 },
      { text: ' ', type: 'separator' },
      { text: 'world', type: 'word', length: 5 },
    ]);
  });

  it('should preserve article metadata', () => {
    const result = service.tokenize(article);

    expect(result.articleId).toBe(article.id);
    expect(result.url).toBe(article.url);
    expect(result.title).toBe(article.title);
  });

  it('should count letters and digits but not apostrophes or hyphens', () => {
    const result = service.tokenize({
      ...article,
      paragraphs: ["don't mother-in-law 42"],
    });

    const words = result.paragraphs[0].tokens.filter(
      (token) => token.type === 'word',
    );

    expect(words.map((word) => word.length)).toEqual([4, 11, 2]);
  });
});
