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

    it('extracts paragraphs before the first h2', async () => {
        fetchMock.mockResolvedValue({
            status: 200,
            ok: true,
            json: async () => ({
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
            json: async () => ({
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
            json: async () => ({
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

    it('returns a random article candidate', async () => {
      fetchMock.mockResolvedValue({
        status: 200,
        ok: true,
        json: async () => ({
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

      const candidate = await provider.getRandomArticleCandidate();

      expect(candidate).toEqual({
        id: 123,
        title: 'Jupiter',
        isDisambiguation: false,
      });
    });

    it('detects a disambiguation page', async () => {
      fetchMock.mockResolvedValue({
        status: 200,
        ok: true,
        json: async () => ({
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

      const candidate = await provider.getRandomArticleCandidate();

      expect(candidate).toEqual({
        id: 456,
        title: 'Mercury',
        isDisambiguation: true,
      });
    });

    it('returns null when Wikipedia returns no page', async () => {
      fetchMock.mockResolvedValue({
        status: 200,
        ok: true,
        json: async () => ({
          query: {},
        }),
      } as Response);

      const candidate = await provider.getRandomArticleCandidate();

      expect(candidate).toBeNull();
    });

    describe('getAverageMonthlyPageviews', () => {
        it('calculates the average over 60 complete months', async () => {
            jest.useFakeTimers();
            jest.setSystemTime(new Date('2026-10-10T12:00:00Z'));

            try {
                fetchMock.mockResolvedValue({
                    status: 200,
                    ok: true,
                    json: async () => ({
                        items: [
                            { timestamp: '2021100100', views: 600_000 },
                            { timestamp: '2021110100', views: 600_000 },
                            { timestamp: '2021120100', views: 600_000 },
                        ],
                    }),
                } as Response);

                const average =
                    await provider.getAverageMonthlyPageviews('Jupiter');

                // 1 800 000 vues / 60 mois = 30 000.
                expect(average).toBe(30_000);

                const requestedUrl = fetchMock.mock.calls[0][0] as string;

                expect(requestedUrl).toContain(
                    '/Jupiter/monthly/20211001/20261001',
                );

                expect(fetchMock).toHaveBeenCalledWith(
                    requestedUrl,
                    expect.objectContaining({
                        headers: expect.objectContaining({
                            'User-Agent': expect.any(String),
                            Accept: 'application/json',
                        }),
                    }),
                );
            } finally {
                jest.useRealTimers();
            }
        });

        it('encodes article titles in the Pageviews URL', async () => {
            fetchMock.mockResolvedValue({
                status: 200,
                ok: true,
                json: async () => ({
                    items: [{ timestamp: '2021100100', views: 600_000 }],
                }),
            } as Response);

            await provider.getAverageMonthlyPageviews('Albert Einstein');

            const requestedUrl = fetchMock.mock.calls[0][0] as string;

            expect(requestedUrl).toContain('Albert_Einstein');
        });

        it('throws when the Pageviews API returns an HTTP error', async () => {
            fetchMock.mockResolvedValue({
                status: 503,
                ok: false,
                json: async () => ({}),
            } as Response);

            await expect(
                provider.getAverageMonthlyPageviews('Jupiter'),
            ).rejects.toThrow(
                'Wikipedia Pageviews API returned HTTP 503',
            );
        });
    });


});
