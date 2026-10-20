declare module 'wink-lemmatizer' {
  export function noun(word: string): string;
  export function verb(word: string): string;
  export function adjective(word: string): string;
  export function lemmatizeNoun(word: string): string;
  export function lemmatizeVerb(word: string): string;
  export function lemmatizeAdjective(word: string): string;
}
