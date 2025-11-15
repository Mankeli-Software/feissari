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
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  message: string;
  feissariName?: string;
  emoteAssets?: string[];
  balance?: number;
}

export interface GameState {
  gameId: string | null;
  balance: number;
  timeRemaining: number;
  isActive: boolean;
  messages: ChatMessage[];
  currentFeissariName: string;
  isLoading: boolean;
}
