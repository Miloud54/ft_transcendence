/**
 * Cosine-similarity thresholds for grades 1..4 (grade 0 = not colored).
 * Tuned for GloVe 6B 100d, post-processed by scripts/prepare-vectors.py (see scripts/inspect-proximity.ts). If you switch to
 * another vector set, re-run the inspection script and adjust these.
 */
export const GRADE_THRESHOLDS: readonly number[] = [0.4, 0.5, 0.6, 0.72];

export function toGrade(similarity: number): number {
  let grade = 0;
  for (const threshold of GRADE_THRESHOLDS) {
    if (similarity >= threshold) grade += 1;
  }
  return grade;
}
