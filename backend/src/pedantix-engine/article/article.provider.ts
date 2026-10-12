import { Article } from './article';
import { ArticleCandidate } from './article-candidate';

export abstract class ArticleProvider {
  abstract getRandomArticleCandidates(): Promise<ArticleCandidate[]>;
  abstract getArticle(title: string): Promise<Article | null>;
}