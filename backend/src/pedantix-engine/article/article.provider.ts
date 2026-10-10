import { Article } from './article';
import { ArticleCandidate } from './article-candidate';

export abstract class ArticleProvider {
  abstract getRandomArticleCandidate(): Promise<ArticleCandidate | null>;

  abstract getArticle(title: string): Promise<Article | null>;

  abstract getAverageMonthlyPageviews(title: string): Promise<number>;
}
