// Données de démo utilisées pour construire le front avant que l'API existe.
// Les formes sont pensées pour se rapprocher des futurs modèles Prisma (Users, Games, GamePlayers, UserStatistics, Friends).

export type MockUser = {
  id: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  status: "online" | "offline";
  xp: number;
  level: number;
};

export const currentUser: MockUser = {
  id: "u1",
  username: "Emilie",
  email: "emilie@student.42.fr",
  avatarUrl: null,
  status: "online",
  xp: 3120,
  level: 12,
};

export const mockStats = {
  gamesPlayed: 42,
  gamesPlayedTrend: "+12%",
  wins: 27,
  winsTrend: "+8%",
  averageScoreByDifficulty: [
    { label: "Froid", value: 0.2 },
    { label: "Tiede", value: 0.55 },
    { label: "Chaud", value: 0.9 },
  ],
  progression: [4, 6, 5, 8, 7, 9, 8, 10, 9, 11],
  distribution: { wins: 27, losses: 15 },
};

export type MockLobbyPlayer = {
  id: string;
  username: string;
  isReady: boolean;
  isHost: boolean;
};

export const mockLobbyPlayers: MockLobbyPlayer[] = [
  { id: "u1", username: "Emilie", isReady: true, isHost: true },
  { id: "u2", username: "Odile", isReady: false, isHost: false },
];

export type MockGuess = {
  word: string;
  count: number;
  found: boolean;
};

export const mockMaskedArticle: MockGuess[] = [
  { word: "Tour", count: 12, found: true },
  { word: "de", count: 8, found: false },
  { word: "1889", count: 3, found: false },
  { word: "est", count: 5, found: true },
  { word: "une", count: 4, found: false },
  { word: "tour", count: 6, found: true },
  { word: "de", count: 8, found: false },
  { word: "1330", count: 1, found: false },
  { word: "metres", count: 2, found: false },
  { word: "situee", count: 1, found: false },
  { word: "a", count: 20, found: false },
  { word: "Paris", count: 9, found: false },
];

export type MockAttempt = {
  rank: number;
  username: string;
  word: string;
  proximity: number;
};

export const mockLatestAttempts: MockAttempt[] = [
  { rank: 1, username: "Vous", word: "tour", proximity: 1000 },
  { rank: 2, username: "Odile", word: "metallique", proximity: 842 },
  { rank: 3, username: "Maria", word: "fer", proximity: 615 },
];

export type MockResultEntry = {
  rank: number;
  username: string;
  time: string;
};

export const mockResults: MockResultEntry[] = [
  { rank: 1, username: "Odile", time: "1:52" },
  { rank: 2, username: "Maria", time: "1:55" },
  { rank: 3, username: "Emilie", time: "1:57" },
];

export const mockWinnerArticleTitle = "Tour Eiffel";

export type MockFriend = {
  id: string;
  username: string;
  status: "online" | "offline";
};

export const mockFriends: MockFriend[] = [
  { id: "u2", username: "Odile", status: "online" },
  { id: "u3", username: "Maria", status: "offline" },
  { id: "u4", username: "Bru", status: "online" },
  { id: "u5", username: "Zoé", status: "online" },
];

export type MockLeaderboardEntry = {
  rank: number;
  username: string;
  level: number;
  wins: number;
};

export const mockLeaderboard: MockLeaderboardEntry[] = [
  { rank: 1, username: "Odile", level: 18, wins: 64 },
  { rank: 2, username: "Bru", level: 15, wins: 51 },
  { rank: 3, username: "Emilie", level: 12, wins: 27 },
  { rank: 4, username: "Maria", level: 9, wins: 19 },
  { rank: 5, username: "Zoé", level: 6, wins: 6 },
];

export type MockMatch = {
  id: string;
  articleTitle: string;
  result: "win" | "loss";
  playedAt: string;
  opponents: string[];
};

export const mockMatchHistory: MockMatch[] = [
  { id: "g1", articleTitle: "Tour Eiffel", result: "win", playedAt: "2026-08-27", opponents: ["Odile", "Maria"] },
  { id: "g2", articleTitle: "Napoleon Bonaparte", result: "loss", playedAt: "2026-08-25", opponents: ["Bru"] },
  { id: "g3", articleTitle: "Photosynthese", result: "win", playedAt: "2026-08-22", opponents: ["Odile", "Maria", "Bru", "Zoé"] },
];
