import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * In-memory word vectors (L2-normalized, so cosine similarity = dot product).
 * Files are produced by scripts/prepare-vectors.py:
 *   words.json  array of words, row order
 *   vectors.bin float32 little-endian, count x dim, row-major
 *   meta.json   { dim, count }
 *
 * If the files are missing the service stays "not ready": the game keeps
 * working (exact + inflected matching) but without proximity grades.
 */
@Injectable()
export class VectorStoreService implements OnModuleInit {
  private readonly logger = new Logger(VectorStoreService.name);
  private readonly rows = new Map<string, number>();
  private vectors = new Float32Array(0);
  private dim = 0;
  private ready = false;

  onModuleInit() {
    this.load(process.env.PEDANTIX_VECTORS_DIR ?? join(process.cwd(), 'data'));
  }

  load(dir: string): void {
    const wordsPath = join(dir, 'words.json');
    const vectorsPath = join(dir, 'vectors.bin');
    const metaPath = join(dir, 'meta.json');

    if (![wordsPath, vectorsPath, metaPath].every((path) => existsSync(path))) {
      this.logger.warn(
        `Word vectors not found in ${dir}: proximity grading is disabled.`,
      );
      return;
    }

    const words = JSON.parse(readFileSync(wordsPath, 'utf8')) as string[];
    const meta = JSON.parse(readFileSync(metaPath, 'utf8')) as {
      dim: number;
      count: number;
    };
    const buffer = readFileSync(vectorsPath);
    // Copy to get a 4-byte aligned ArrayBuffer (Buffer may be a pooled slice).
    const vectors = new Float32Array(
      buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength,
      ),
    );

    if (vectors.length !== meta.dim * words.length) {
      this.logger.error('Word vector files are inconsistent: ignoring them.');
      return;
    }

    this.dim = meta.dim;
    this.vectors = vectors;
    words.forEach((word, row) => this.rows.set(word, row));
    this.ready = true;
    this.logger.log(`Loaded ${words.length} word vectors (${meta.dim}d).`);
  }

  get isReady(): boolean {
    return this.ready;
  }

  has(word: string): boolean {
    return this.rows.has(word);
  }

  /** Cosine similarity, or null if either word is unknown. */
  similarity(a: string, b: string): number | null {
    const rowA = this.rows.get(a);
    const rowB = this.rows.get(b);
    if (rowA === undefined || rowB === undefined) return null;
    const offsetA = rowA * this.dim;
    const offsetB = rowB * this.dim;
    let dot = 0;
    for (let k = 0; k < this.dim; k++) {
      dot += this.vectors[offsetA + k] * this.vectors[offsetB + k];
    }
    return dot;
  }
}
