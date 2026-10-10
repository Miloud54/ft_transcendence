export interface ArticleToken {
  text: string;
  type: 'word' | 'separator';
  length?: number;
}

export interface TokenizedParagraph {
  tokens: ArticleToken[];
}

export interface ArticleTokenized {
  articleId: number;
  url: string;
  title: string;
  paragraphs: TokenizedParagraph[];
}
