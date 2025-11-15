import { Timestamp } from 'firebase-admin/firestore';

/**
 * Emote configuration for a feissari character
 */
export interface Emote {
  identifier: string;            // Unique identifier (e.g., "happy", "pushy", "disappointed")
  description: string;           // Instructions for LLM on when to use this emote
  assets: string[];              // Array of SVG asset URLs for animation
}

/**
 * Feissari (salesperson) character definition
 */
export interface Feissari {
  id: string;                    // Unique identifier for this feissari
  name: string;                  // Display name of the feissari
  roleInstruction: string;       // System prompt/instructions for LLM behavior
  emotes: Emote[];               // Available emotes for this character
}

/**
 * Game session document
 */
export interface Game {
  id: string;                    // Auto-generated unique game ID
  userId: string;                // Reference to user identifier (sessionId)
  createdAt: Timestamp;          // When the game was created
  currentFeissariId: string;     // ID of the currently active feissari
  isActive: boolean;             // Whether game is still playable
  threatLevel?: number;          // Accumulated threat level (starts at 0)
}

/**
 * Chat history entry (stored as subcollection under game)
 */
export interface ChatHistory {
  id: string;                    // Auto-generated unique chat ID
  feissariId: string;            // Which feissari this chat belongs to
  feissariName: string;          // Name of the feissari
  timestamp: Timestamp;          // When this message was sent
  userMessage: string | null;    // User's message (null for first interaction)
  aiMessage: string;             // AI response
  balanceBefore: number;         // Balance before this interaction
  balanceAfter: number;          // Balance after this interaction (if purchase made)
  emoteAssets: string[];         // Emote assets list returned by AI
  movedToNext: boolean;          // Whether this interaction ended the encounter
}

/**
 * LLM response structure
 */
export interface LLMResponse {
  message: string;               // AI's message to the user
  balance: number;               // Updated balance (after potential purchase)
  emote: string;                 // Emote identifier to use
  goToNext: boolean;             // Whether to move to next feissari
  quickActions: string[];        // Array of three short quick-action headers
  increaseThreatLevel: boolean;  // true if this interaction should increase stored threat level
}

/**
 * API request/response types
 */

export interface CreateGameRequest {
  userId: string;
}

export interface CreateGameResponse {
  gameId: string;
  createdAt: string;
  initialBalance: number;
}

export interface UpdateGameRequest {
  message: string | null;
}

export interface UpdateGameResponse {
  message: string;
  balance: number;
  emoteAssets: string[];
  goToNext: boolean;
  gameOver: boolean;
  feissariName: string;
  score?: number;                  // Score when game ends
  defeatedFeissari?: number;       // Number of feissari defeated
  nextFeissariMessage?: string;    // Next feissari's greeting when transitioning
  nextFeissariName?: string;       // Next feissari's name when transitioning
  nextFeissariEmoteAssets?: string[]; // Next feissari's emote assets when transitioning
  threatLevel: number;            // Current threat level
  quickActions: string[];
}

/**
 * Leaderboard entry document
 */
export interface LeaderboardEntry {
  id: string;                      // Auto-generated unique entry ID
  userId: string;                  // Reference to user identifier (sessionId)
  userName: string;                // User's display name
  gameId: string;                  // Reference to the game
  score: number;                   // Score: defeatedFeissari * finalBalance
  defeatedFeissari: number;        // Number of feissari defeated
  finalBalance: number;            // Final balance when game ended
  createdAt: Timestamp;            // When the entry was created
}

/**
 * API request/response types for leaderboard
 */

export interface CreateLeaderboardRequest {
  gameId: string;
}

export interface CreateLeaderboardResponse {
  entryId: string;
  score: number;
  defeatedFeissari: number;
  finalBalance: number;
}

export interface LeaderboardEntryResponse {
  userId: string;
  userName: string;
  score: number;
  defeatedFeissari: number;
  finalBalance: number;
  createdAt: string;
  rank?: number;                   // Position in leaderboard (1-indexed)
}

export interface TopLeaderboardResponse {
  entries: LeaderboardEntryResponse[];
  currentUserEntry?: LeaderboardEntryResponse;
  currentUserRank?: number;        // If user not in top 10, show their rank
}

export interface RecentLeaderboardResponse {
  entries: LeaderboardEntryResponse[];
  currentUserEntry?: LeaderboardEntryResponse;
  currentUserPosition?: number;    // How many more recent entries there are
}

export interface LeaderboardStatsResponse {
  totalGamesPlayed: number;
  tokenChurn: string;              // Formatted string (e.g., "€24.00")
}
