export type BoardViewToken =
  | { type: 'separator'; display: string }
  | { type: 'word'; status: 'hidden'; length: number; grade?: number }
  | { type: 'word'; status: 'revealed'; length: number; display: string };

export interface BoardView {
  title: { tokens: BoardViewToken[] };
  paragraphs: { tokens: BoardViewToken[] }[];
}
