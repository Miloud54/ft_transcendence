import { Article } from '../src/pedantix-engine/article/article';
export declare function isCheatEnabled(): boolean;
export declare function writeCheatFile(gameId: string, article: Article, dir?: string): Promise<string | null>;
