import { Injectable } from '@nestjs/common';

import { Article } from './article';
import { ArticleProvider } from './article.provider';
import { CuratedArticleProvider } from './curated/curated-article.provider';

const WIKIPEDIA_TIMEOUT_MS = 5000;

@Injectable()
export class ArticleSelectorService {
  constructor(
    private readonly articleProvider: ArticleProvider,
    private readonly curatedArticleProvider: CuratedArticleProvider,
  ) {}

  async selectArticle(): Promise<Article> {
    const controller = new AbortController();

    let timeout: ReturnType<typeof setTimeout> | undefined;

    try {
      const wikipediaAttempt = this.selectWikipediaArticle(controller.signal);

      const timeoutPromise = new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          controller.abort();

          reject(
            new Error(
              `Wikipedia article selection timed out after ${WIKIPEDIA_TIMEOUT_MS} ms`,
            ),
          );
        }, WIKIPEDIA_TIMEOUT_MS);
      });

      return await Promise.race([wikipediaAttempt, timeoutPromise]);
    } catch {
      controller.abort();

      try {
        return await this.curatedArticleProvider.getRandomArticle();
      } catch {
        throw new Error(
          'Unable to select an article from Wikipedia or the curated library',
        );
      }
    } finally {
      if (timeout !== undefined) {
        clearTimeout(timeout);
      }
    }
  }

  private async selectWikipediaArticle(signal: AbortSignal): Promise<Article> {
    const candidates =
      await this.articleProvider.getRandomArticleCandidates(signal);

    for (const candidate of candidates) {
      if (signal.aborted) {
        throw new Error('Wikipedia article selection was aborted');
      }

      if (candidate.isDisambiguation) {
        continue;
      }

      const article = await this.articleProvider.getArticle(
        candidate.title,
        signal,
      );

      if (article) {
        return article;
      }
    }

    throw new Error(
      'Unable to find a playable article among the 10 candidates',
    );
  }
}
