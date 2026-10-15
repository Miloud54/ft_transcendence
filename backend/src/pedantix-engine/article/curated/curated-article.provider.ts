import { Injectable } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Article } from '../article';

@Injectable()
export class CuratedArticleProvider {
  private readonly libraryPath = resolve(
    process.cwd(),
    'src/pedantix-engine/article/curated/curated-articles.json',
  );

  async getRandomArticle(): Promise<Article> {
    const articles = await this.loadArticles();

    if (articles.length === 0) {
      throw new Error(
        'The curated article library is empty. ' +
          'Run the Wikipedia article collection script first.',
      );
    }

    const index = Math.floor(Math.random() * articles.length);
    return articles[index];
  }

  private async loadArticles(): Promise<Article[]> {
    let content: string;

    try {
      content = await readFile(this.libraryPath, 'utf8');
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : String(error);

      throw new Error(
        `Unable to read the curated article library at ` +
          `${this.libraryPath}: ${message}`,
      );
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error(
        `The curated article library contains invalid JSON: ` +
          this.libraryPath,
      );
    }

    if (!Array.isArray(parsed)) {
      throw new Error(
        'The curated article library must contain a JSON array.',
      );
    }

    const articles: Article[] = [];

    for (const item of parsed) {
      if (!this.isArticle(item)) {
        throw new Error(
          'The curated article library contains an invalid article. ' +
            'Expected an integer id, a title, a URL and at least ' +
            'three non-empty paragraphs.',
        );
      }

      articles.push(item);
    }

    return articles;
  }

  private isArticle(value: unknown): value is Article {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const article = value as Record<string, unknown>;

    return (
      typeof article.id === 'number' &&
      Number.isInteger(article.id) &&
      typeof article.title === 'string' &&
      article.title.trim().length > 0 &&
      typeof article.url === 'string' &&
      article.url.trim().length > 0 &&
      Array.isArray(article.paragraphs) &&
      article.paragraphs.length >= 3 &&
      article.paragraphs.every(
        (paragraph) =>
          typeof paragraph === 'string' && paragraph.trim().length > 0,
      )
    );
  }
}
