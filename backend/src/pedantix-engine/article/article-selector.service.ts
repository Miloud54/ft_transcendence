import { Injectable } from '@nestjs/common';
import { Article } from './article';
import { ArticleProvider } from './article.provider';

const MIN_AVERAGE_MONTHLY_PAGEVIEWS = 10_000;

@Injectable()
export class ArticleSelectorService {
  constructor(
    private readonly articleProvider: ArticleProvider,
  ) {}

  async selectArticle(): Promise<Article> {
    while (true) {
      const candidate =
        await this.articleProvider.getRandomArticleCandidate();

      if (!candidate || candidate.isDisambiguation) {
        continue;
      }

      const averageMonthlyPageviews =
          await this.articleProvider.getAverageMonthlyPageviews(candidate.title);

      if (averageMonthlyPageviews < MIN_AVERAGE_MONTHLY_PAGEVIEWS) {
          continue;
      }

      const article =
        await this.articleProvider.getArticle(candidate.title);

      if (!article) {
        continue;
      }

      return article;
    }
  }
}
