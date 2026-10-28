/** XP rules: every point scored is 1 XP, a win adds a bonus, a level is 500 XP. */
export const XP_WIN_BONUS = 100;
export const XP_PER_LEVEL = 500;

export function xpForGame(score: number, won: boolean): number {
  return score + (won ? XP_WIN_BONUS : 0);
}

export function levelForXp(xp: number): number {
  return Math.floor(xp / XP_PER_LEVEL) + 1;
}
