import { Injectable } from '@nestjs/common';

import { Article } from '../article/article';
import {
  ArticleToken,
  ArticleTokenized,
  TokenizedParagraph,
  TokenizedText,
} from './article-tokenized';

@Injectable()
export class TokenizerService {
  tokenize(article: Article): ArticleTokenized {
    return {
      articleId: article.id,
      url: article.url,
      title: this.tokenizeText(article.title),
      paragraphs: article.paragraphs.map((paragraph) =>
        this.tokenizeParagraph(paragraph),
      ),
    };
  }

  private tokenizeParagraph(paragraph: string): TokenizedParagraph {
    return this.tokenizeText(paragraph);
  }

  private tokenizeText(text: string): TokenizedText {
    const tokens: ArticleToken[] = [];

    const parts = text.match(
      /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+|-[\p{L}\p{N}]+)*/gu,
    );

    if (!parts) {
      return {
        tokens: text
          ? [{ text, type: 'separator' }]
          : [],
      };
    }

    let position = 0;

    for (const word of parts) {
      const wordPosition = text.indexOf(word, position);

      if (wordPosition > position) {
        tokens.push({
          text: text.slice(position, wordPosition),
          type: 'separator',
        });
      }

      tokens.push({
        text: word,
        type: 'word',
        length: [...word].filter((character) =>
          /[\p{L}\p{N}]/u.test(character),
        ).length,
      });

      position = wordPosition + word.length;
    }

    if (position < text.length) {
      tokens.push({
        text: text.slice(position),
        type: 'separator',
      });
    }

    return { tokens };
  }
}
