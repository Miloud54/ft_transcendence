import { Injectable } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { Article } from './article';
import { ArticleProvider } from './article.provider';
import { ArticleCandidate } from './article-candidate';

interface WikipediaPageResponse {
  id: number;
  key: string;
  title: string;
  html: string;
  html_url?: string;
}

interface WikipediaRandomResponse {
  query?: {
    pages?: Record<
      string,
      {
        pageid: number;
        title: string;
        pageprops?: {
          disambiguation?: string;
        };
      }
    >;
  };
}

interface WikipediaPageviewsResponse {
    items?: {
        timestamp: string;
        views: number;
    }[];
}

@Injectable()
export class WikipediaProvider extends ArticleProvider {
    private readonly wikipediaApiUrl =
        'https://en.wikipedia.org/w/rest.php/v1';

    private readonly userAgent =
        'Transcendix/0.1 (42 project)';

    private readonly minParagraphs = 3;
    private readonly maxParagraphs = 12;

    async getArticle(title: string): Promise<Article | null> {
        const encodedTitle = encodeURIComponent(title.replace(/ /g, '_'));

        const response = await fetch(
            `${this.wikipediaApiUrl}/page/${encodedTitle}/with_html`,
            {
                headers: {
                    'User-Agent': this.userAgent,
                },
            },
        );

        if (response.status === 404) {
            return null;
        }

        if (!response.ok) {
            throw new Error(
                `Wikipedia API returned HTTP ${response.status}`,
            );
        }

        const data = (await response.json()) as WikipediaPageResponse;

        const paragraphs = this.extractParagraphs(data.html);

        if (paragraphs.length < this.minParagraphs) {
            return null;
        }

        return {
            id: data.id,
            url:
                data.html_url ??
                `https://en.wikipedia.org/wiki/${data.key}`,
            title: data.title,
            paragraphs: paragraphs.slice(0, this.maxParagraphs),
        };
    }

    private extractParagraphs(html: string): string[] {
        const $ = cheerio.load(html);
        const paragraphs: string[] = [];

        $('p, h2').each((_, element) => {
            if (element.tagName === 'h2') {
                return false;
            }

            const paragraph = $(element);

            if (
                paragraph.closest(
                    'table, figure, aside, nav, script, style',
                ).length > 0
            ) {
                return;
            }

            paragraph.find('sup.reference').remove();

            const text = paragraph
                .text()
                .replace(/\s+/g, ' ')
                .trim();

            if (text.length > 0) {
                paragraphs.push(text);
            }
        });

        return paragraphs;
    }

    async getAverageMonthlyPageviews(title: string): Promise<number> {
        const now = new Date();

        // Premier jour du mois courant : ce mois sera exclu.
        const endDate = new Date(
            Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
        );

        // Début de la période : 60 mois avant le mois courant.
        const startDate = new Date(
            Date.UTC(
                endDate.getUTCFullYear(),
                endDate.getUTCMonth() - 60,
                1,
            ),
        );

        const formatDate = (date: Date): string =>
            `${date.getUTCFullYear()}${String(
                date.getUTCMonth() + 1,
            ).padStart(2, '0')}01`;

        const start = formatDate(startDate);
        const end = formatDate(endDate);
        const encodedTitle = encodeURIComponent(title.replace(/ /g, '_'));

        const url =
            'https://wikimedia.org/api/rest_v1/metrics/pageviews/' +
            'per-article/en.wikipedia.org/all-access/user/' +
            `${encodedTitle}/monthly/${start}/${end}`;

        const response = await fetch(url, {
            headers: {
                'User-Agent': this.userAgent,
                Accept: 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(
                `Wikipedia Pageviews API returned HTTP ${response.status}`,
            );
        }

        const data = (await response.json()) as WikipediaPageviewsResponse;
        const totalViews = (data.items ?? []).reduce(
            (total, item) => total + item.views,
            0,
        );

        return totalViews / 60;
    }
        

    async getRandomArticleCandidate(): Promise<ArticleCandidate | null> {
        const url =
            'https://en.wikipedia.org/w/api.php' +
            '?action=query' +
            '&format=json' +
            '&generator=random' +
            '&grnnamespace=0' +
            '&grnfilterredir=nonredirects' +
            '&grnlimit=1' +
            '&prop=pageprops' +
            '&ppprop=disambiguation';

        const response = await fetch(url, {
            headers: {
                'User-Agent': this.userAgent,
            },
        });

        if (!response.ok) {
            throw new Error(
                `Wikipedia API returned HTTP ${response.status}`,
            );
        }

        const data = (await response.json()) as WikipediaRandomResponse;
        const pages = data.query?.pages;

        if (!pages) {
            return null;
        }

        const page = Object.values(pages)[0];

        if (!page) {
            return null;
        }

        return {
            id: page.pageid,
            title: page.title,
            isDisambiguation:
                page.pageprops !== undefined &&
                'disambiguation' in page.pageprops,
        };
    }

}

// on récupère le HTML de Wikipedia ;
// on parcourt les <p> et <h2> dans l'ordre ;
// le premier <h2> arrête l'extraction ;
// les références <sup class="reference"> sont supprimées ;
// les liens <a> sont conservés sous forme de leur texte grâce à .text() ;
// les tables, figures, etc. ne deviennent pas du contenu jouable ;
// les espaces sont normalisés ;
// moins de 3 paragraphes → article rejeté ;
// plus de 12 → on conserve les 12 premiers ;
// le titre n'est pas exposé autrement que dans l'objet Article côté backend ;
// le provider reste indépendant du reste du moteur.
