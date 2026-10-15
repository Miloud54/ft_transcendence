import { WikipediaProvider } from './wikipedia.provider';

describe('WikipediaProvider', () => {
  let provider: WikipediaProvider;
  let fetchMock: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    provider = new WikipediaProvider();
    fetchMock = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getArticle', () => {
    it('extracts paragraphs before the first h2', async () => {
      fetchMock.mockResolvedValue({
        status: 200,
        ok: true,
        json: () =>
          Promise.resolve({
            id: 123,
            key: 'Jupiter',
            title: 'Jupiter',
            html: `
            <p>First paragraph with a <a href="/wiki/Test">link</a>.</p>
            <p>Second paragraph<sup class="reference">[1]</sup>.</p>
            <p>Third paragraph.</p>

            <h2>Name and symbol</h2>

            <p>This paragraph must not be included.</p>
          `,
          }),
      } as Response);

      const article = await provider.getArticle('Jupiter');

      expect(article).not.toBeNull();
      expect(article?.id).toBe(123);
      expect(article?.title).toBe('Jupiter');
      expect(article?.paragraphs).toEqual([
        'First paragraph with a link.',
        'Second paragraph.',
        'Third paragraph.',
      ]);
    });

    it('rejects an article with fewer than 3 paragraphs', async () => {
      fetchMock.mockResolvedValue({
        status: 200,
        ok: true,
        json: () =>
          Promise.resolve({
            id: 123,
            key: 'Test',
            title: 'Test',
            html: `
            <p>First paragraph.</p>
            <p>Second paragraph.</p>
            <h2>Section</h2>
          `,
          }),
      } as Response);

      const article = await provider.getArticle('Test');

      expect(article).toBeNull();
    });

    it('keeps only the first 12 paragraphs', async () => {
      const paragraphs = Array.from(
        { length: 14 },
        (_, index) => `<p>Paragraph ${index + 1}.</p>`,
      ).join('');

      fetchMock.mockResolvedValue({
        status: 200,
        ok: true,
        json: () =>
          Promise.resolve({
            id: 123,
            key: 'Test',
            title: 'Test',
            html: paragraphs,
          }),
      } as Response);

      const article = await provider.getArticle('Test');

      expect(article).not.toBeNull();
      expect(article?.paragraphs).toHaveLength(12);
      expect(article?.paragraphs[0]).toBe('Paragraph 1.');
      expect(article?.paragraphs[11]).toBe('Paragraph 12.');
    });

    it('passes the abort signal to fetch', async () => {
      const controller = new AbortController();

      fetchMock.mockResolvedValue({
        status: 200,
        ok: true,
        json: () =>
          Promise.resolve({
            id: 123,
            key: 'Jupiter',
            title: 'Jupiter',
            html: `
            <p>First paragraph.</p>
            <p>Second paragraph.</p>
            <p>Third paragraph.</p>
          `,
          }),
      } as Response);

      await provider.getArticle('Jupiter', controller.signal);

      expect(fetchMock).toHaveBeenCalledTimes(1);

      const requestOptions = fetchMock.mock.calls[0][1];

      expect(requestOptions?.signal).toBe(controller.signal);
    });
  });

  describe('getRandomArticleCandidates', () => {
    it('returns multiple random article candidates', async () => {
      fetchMock.mockResolvedValue({
        status: 200,
        ok: true,
        json: () =>
          Promise.resolve({
            query: {
              pages: {
                '123': {
                  pageid: 123,
                  ns: 0,
                  title: 'Jupiter',
                },
                '456': {
                  pageid: 456,
                  ns: 0,
                  title: 'Mars',
                },
              },
            },
          }),
      } as Response);

      const candidates = await provider.getRandomArticleCandidates();

      expect(candidates).toEqual([
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
    });

    it('detects disambiguation pages', async () => {
      fetchMock.mockResolvedValue({
        status: 200,
        ok: true,
        json: () =>
          Promise.resolve({
            query: {
              pages: {
                '456': {
                  pageid: 456,
                  ns: 0,
                  title: 'Mercury',
                  pageprops: {
                    disambiguation: '',
                  },
                },
              },
            },
          }),
      } as Response);

      const candidates = await provider.getRandomArticleCandidates();

      expect(candidates).toEqual([
        {
          id: 456,
          title: 'Mercury',
          isDisambiguation: true,
        },
      ]);
    });
    it('returns an empty array when Wikipedia returns no pages', async () => {
      fetchMock.mockResolvedValue({
        status: 200,
        ok: true,
        json: () =>
          Promise.resolve({
            query: {},
          }),
      } as Response);
      const candidates = await provider.getRandomArticleCandidates();
      expect(candidates).toEqual([]);
    });
    it('requests up to 10 candidates in one HTTP request', async () => {
      fetchMock.mockResolvedValue({
        status: 200,
        ok: true,
        json: () =>
          Promise.resolve({
            query: {
              pages: {
                '123': {
                  pageid: 123,
                  ns: 0,
                  title: 'Jupiter',
                },
              },
            },
          }),
      } as Response);
      await provider.getRandomArticleCandidates();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const requestedUrl = fetchMock.mock.calls[0][0] as string;
      expect(requestedUrl).toContain('grnminsize=50000');
      expect(requestedUrl).toContain('grnlimit=10');
    });
    it('passes the abort signal to fetch', async () => {
      const controller = new AbortController();

      fetchMock.mockResolvedValue({
        status: 200,
        ok: true,
        json: () =>
          Promise.resolve({
            query: {
              pages: {
                '123': {
                  pageid: 123,
                  ns: 0,
                  title: 'Jupiter',
                },
              },
            },
          }),
      } as Response);

      await provider.getRandomArticleCandidates(controller.signal);

      expect(fetchMock).toHaveBeenCalledTimes(1);

      const requestOptions = fetchMock.mock.calls[0][1];

      expect(requestOptions?.signal).toBe(controller.signal);
    });
  });
});
