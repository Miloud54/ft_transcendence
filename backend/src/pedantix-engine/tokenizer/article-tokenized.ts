export interface ArticleToken {
  text: string;
  type: 'word' | 'separator';
  length?: number;
}

export interface TokenizedText {
  tokens: ArticleToken[];
}

export type TokenizedParagraph = TokenizedText;

export interface ArticleTokenized {
  articleId: number;
  url: string;
  title: TokenizedText;
  paragraphs: TokenizedParagraph[];
}
