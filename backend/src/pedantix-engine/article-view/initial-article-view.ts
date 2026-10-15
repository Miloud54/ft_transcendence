export type ArticleTokenType = 'word' | 'separator';

export type ArticleTokenStatus = 'hidden' | 'revealed';

export interface HiddenWordToken {
  type: 'word';
  status: 'hidden';
  length: number;
}

export interface RevealedWordToken {
  type: 'word';
  status: 'revealed';
  length: number;
  display: string;
}

export interface ArticleSeparatorToken {
  type: 'separator';
  display: string;
}

export type ArticleWordToken = HiddenWordToken | RevealedWordToken;

export type ArticleViewToken = ArticleWordToken | ArticleSeparatorToken;

export interface ArticleViewParagraph {
  tokens: ArticleViewToken[];
}

export interface ArticleViewTitle {
  tokens: ArticleViewToken[];
}

export interface InitialArticleView {
  title: ArticleViewTitle;
  paragraphs: ArticleViewParagraph[];
}
