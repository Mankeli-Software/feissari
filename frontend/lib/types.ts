export interface CreateGameResponse {
  gameId: string;
  createdAt: string;
  initialBalance: number;
}

export interface UpdateGameResponse {
  message: string;
  balance: number;
  emoteAssets: string[];
  goToNext: boolean;
  gameOver: boolean;
  feissariName: string;
  score?: number;
  defeatedFeissari?: number;
  nextFeissariMessage?: string;
  nextFeissariName?: string;
  nextFeissariEmoteAssets?: string[];
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  message: string;
  feissariName?: string;
  emoteAssets?: string[];
  balance?: number;
  goToNext?: boolean;  // Indicates if this message caused moving to next feissari
}

export interface GameState {
  gameId: string | null;
  balance: number;
  timeRemaining: number;
  isActive: boolean;
  messages: ChatMessage[];
  currentFeissariName: string;
  isLoading: boolean;
  score?: number;
  defeatedFeissari?: number;
}

export interface LeaderboardEntryResponse {
  userId: string;
  userName: string;
  score: number;
  defeatedFeissari: number;
  finalBalance: number;
  createdAt: string;
  rank?: number;
}

export interface TopLeaderboardResponse {
  entries: LeaderboardEntryResponse[];
  currentUserEntry?: LeaderboardEntryResponse;
  currentUserRank?: number;
}

export interface RecentLeaderboardResponse {
  entries: LeaderboardEntryResponse[];
  currentUserEntry?: LeaderboardEntryResponse;
  currentUserPosition?: number;
}

export interface LeaderboardStatsResponse {
  totalGamesPlayed: number;
  tokenChurn: string;
}
