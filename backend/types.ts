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
}
