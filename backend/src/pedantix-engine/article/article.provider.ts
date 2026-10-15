import { Article } from './article';
import { ArticleCandidate } from './article-candidate';

export abstract class ArticleProvider {
  abstract getRandomArticleCandidates(
    signal?: AbortSignal,
  ): Promise<ArticleCandidate[]>;

  abstract getArticle(
    title: string,
    signal?: AbortSignal,
  ): Promise<Article | null>;
}
