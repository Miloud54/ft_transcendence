import { Injectable } from '@nestjs/common';
import { Article } from './article';
import { ArticleProvider } from './article.provider';

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

      const article =
        await this.articleProvider.getArticle(candidate.title);

      if (!article) {
        continue;
      }

      return article;
    }
  }
}