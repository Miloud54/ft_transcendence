import { Injectable } from '@nestjs/common';
import { Article } from '../article/article';
import {
  ArticleToken,
  ArticleTokenized,
  TokenizedParagraph,
} from './article-tokenized';

@Injectable()
export class TokenizerService {
  tokenize(article: Article): ArticleTokenized {
    return {
      articleId: article.id,
      url: article.url,
      title: article.title,
      paragraphs: article.paragraphs.map((paragraph) =>
        this.tokenizeParagraph(paragraph),
      ),
    };
  }

  private tokenizeParagraph(paragraph: string): TokenizedParagraph {
    const tokens: ArticleToken[] = [];
    const parts = paragraph.match(
      /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+|-[\p{L}\p{N}]+)*/gu,
    );

    if (!parts) {
      return {
        tokens: paragraph
          ? [{ text: paragraph, type: 'separator' }]
          : [],
      };
    }

    let position = 0;

    for (const word of parts) {
      const wordPosition = paragraph.indexOf(word, position);

      if (wordPosition > position) {
        tokens.push({
          text: paragraph.slice(position, wordPosition),
          type: 'separator',
        });
      }

      tokens.push({
        text: word,
        type: 'word',
        length: [...word].filter(
          (character) =>
            /[\p{L}\p{N}]/u.test(character),
        ).length,
      });

      position = wordPosition + word.length;
    }

    if (position < paragraph.length) {
      tokens.push({
        text: paragraph.slice(position),
        type: 'separator',
      });
    }

    return { tokens };
  }
}
