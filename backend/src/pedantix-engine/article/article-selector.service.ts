import { Injectable } from '@nestjs/common';
import { Article } from './article';
import { ArticleProvider } from './article.provider';

@Injectable()
export class ArticleSelectorService {
  constructor(
    private readonly articleProvider: ArticleProvider,
  ) {}

  async selectArticle(): Promise<Article> {
    const candidates =
      await this.articleProvider.getRandomArticleCandidates();

    for (const candidate of candidates) {
      if (candidate.isDisambiguation) {
        continue;
      }

      const article =
        await this.articleProvider.getArticle(candidate.title);

      if (article) {
        return article;
      }
    }

    throw new Error(
      'Unable to find a playable article among the 10 candidates',
    );
  }
}
