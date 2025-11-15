# Feissari Game - Requirements & Implementation Plan

## Project Overview
A Finnish face-to-face salesperson (feissari) simulator game where users compete against LLM-powered salesperson characters. The objective is to have as many conversations as possible within a 3-minute time limit without losing all your money (starting budget: 100€).

## Game Concept
- **Initial Budget**: 100€ per player
- **Time Limit**: 3 minutes per game session
- **Objective**: Progress through as many feissari encounters as possible without running out of money
- **Gameplay**: Users engage in text-based conversations with AI salespeople, trying to resist their sales pitches

## Technical Architecture

### Technology Stack
**Backend:**
- Node.js with Express (TypeScript)
- Firebase Firestore for data storage
- LLM integration (needs to be added, Google Gemini)
- Existing setup: Firebase Admin SDK, CORS, dotenv

**Frontend:**
- Next.js 16 with React 19
- TypeScript
- Tailwind CSS
- Shadcn components

## Database Schema

### Collections

#### 1. `/games/{game-id}`
Stores individual game sessions.

```typescript
interface Game {
  id: string;                    // Auto-generated unique game ID
  userId: string;                // Reference to user identifier (sessionId)
  createdAt: Timestamp;          // When the game was created
  currentFeissariId: string;     // ID of the currently active feissari
  isActive: boolean;             // Whether game is still playable
}
```

#### 2. `/chatHistory/{game-id}/chats/{chat-id}`
Stores individual chat interactions as subcollection under each game. This structure allows for efficient querying by timestamp and easy retrieval of the latest balance.

```typescript
interface ChatHistory {
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
```

**Query Examples:**
- Get latest balance: Query `/chatHistory/{game-id}/chats` ordered by `timestamp` desc, limit 1
- Get chat history for current feissari: Query where `feissariId == currentFeissariId` ordered by `timestamp`
- Get all chats for a game: Query `/chatHistory/{game-id}/chats` ordered by `timestamp`

#### 3. `/feissarit/{feissari-id}`
Stores the salesperson character definitions.

```typescript
interface Feissari {
  id: string;                    // Unique identifier for this feissari
  name: string;                  // Display name of the feissari
  roleInstruction: string;       // System prompt/instructions for LLM behavior
  emotes: Emote[];               // Available emotes for this character
}

interface Emote {
  identifier: string;            // Unique identifier (e.g., "happy", "pushy", "disappointed")
  description: string;           // Instructions for LLM on when to use this emote
  assets: string[];              // Array of SVG asset URLs for animation
}
```

#### 4. `/users/{session-id}` (existing)
Already implemented - stores user names and session IDs.

```typescript
interface User {
  name: string;
  timestamp: Timestamp;
}
```

## API Endpoints

### 1. POST /game
**Purpose**: Create a new game session

**Request:**
```typescript
{
  userId: string;  // User identifier (sessionId)
}
```

**Response:**
```typescript
{
  gameId: string;     // Unique game ID
  createdAt: string;  // ISO timestamp
  initialBalance: number; // 100
}
```

**Implementation Steps:**
1. Validate userId parameter
2. Verify Firebase is configured
3. Fetch all feissarit and randomly select the first one
4. Create new game document in `/games` collection with:
   - Auto-generated unique ID
   - userId reference
   - Current timestamp
   - currentFeissariId: (first selected feissari ID)
   - isActive: true
5. Return game ID and metadata

**Error Handling:**
- 400: Invalid or missing userId
- 503: Firebase not configured
- 500: Database write failure

### 2. PUT /game/{game-id}
**Purpose**: Main game loop - handle user messages and get AI responses, reads the current balance from the latest chat response

**Request:**
```typescript
{
  message: string | null;  // User's message (null for game start)
}
```

**Response:**
```typescript
{
  message: string;    // AI character's response
  balance: number;    // Updated balance (after potential purchase)
  emoteAssets: string[];      // Emote assets list returned by AI
  goToNext: boolean;  // Whether to move to next feissari
  gameOver: boolean; // True if time limit exceeded or balance depleted
  feissariName: string; // Name of current feissari (for display)
}
```

**Implementation Steps:**

1. **Validate Request**
   - Check if game-id exists
   - Verify game is still active

2. **Check Time Limit**
   - Get game's createdAt timestamp
   - Calculate elapsed time
   - If > 3 minutes, set gameOver: true and isActive: false

3. **Get Current Balance**
   - Query `/chatHistory/{game-id}/chats` ordered by `timestamp` desc, limit 1
   - If no chat history exists, balance is 100 (initial)
   - Otherwise, use `balanceAfter` from the latest chat

4. **Determine Current Feissari**
   - Get currentFeissariId from game document
   - Fetch feissari details from `/feissarit/{currentFeissariId}`
   - If moving to next (handled in step 7), fetch all feissarit and select next

5. **Prepare LLM Request**
   - Get current feissari's roleInstruction and emotes
   - Get current balance from step 3
   - Query chat history for current feissari: `/chatHistory/{game-id}/chats` where `feissariId == currentFeissariId`
   - Build LLM prompt with:
     - System instruction: roleInstruction
     - Emote instructions: descriptions from emotes array
     - Context: user's message, current balance, chat history for this feissari
     - Output format requirements (JSON with message, balance, emote, goToNext)
   - If message is null, instruct LLM to start the encounter

6. **Call LLM API**
   - Send structured prompt
   - Parse response JSON containing:
     - message (string)
     - balance (number) - LLM decides if purchase was made
     - emote (string) - must match one of the identifier values
     - goToNext (boolean)

7. **Process Response**
   - Validate LLM response format
   - Verify emote identifier matches available emotes
   - Get emote assets from feissari definition based on returned identifier
   - Create new chat document in `/chatHistory/{game-id}/chats/`:
     - feissariId: current feissari ID
     - feissariName: current feissari name
     - timestamp: server timestamp
     - userMessage: from request
     - aiMessage: from LLM
     - balanceBefore: balance from step 3
     - balanceAfter: balance from LLM response
     - emoteAssets: assets array from feissari emote definition
     - movedToNext: goToNext from LLM
   - If goToNext is true:
     - Fetch all feissarit ordered by document ID
     - Find next feissari after current one (startAfter currentFeissariId)
     - If no feissari found (reached end), query from beginning and take first
     - Update game document:
       - Update currentFeissariId to next feissari
   - Check if balance <= 0, if so set isActive: false
   - If time expired (from step 2), set isActive: false

8. **Return Response**
   - Send LLM's message, new balance (balanceAfter), emoteAssets, goToNext flag
   - Include gameOver flag (true if balance <= 0 or time expired)
   - Include feissariName for UI display

**Error Handling:**
- 400: Invalid game ID or parameters
- 404: Game not found
- 410: Game time limit exceeded (3 minutes)
- 503: Firebase or LLM service unavailable
- 500: Processing error

**LLM Integration Notes:**
- Need to add LLM API client (Google Gemini)
- Store API key in environment variables
- Implement retry logic for API failures
- Set reasonable token limits for responses

## LLM Prompt Engineering

### System Prompt Structure
```
You are playing the role of a Finnish face-to-face salesperson (feissari) named {name}.

{roleInstruction}

IMPORTANT: You can sell products/services to the user, which will deduct money from their balance. 
Current balance: {balance}€

Available emotes and when to use them:
{emotes.map(e => `- ${e.identifier}: ${e.description}`).join('\n')}

You must respond in valid JSON format:
{
  "message": "your response to the user",
  "balance": number (current balance minus any purchase, or unchanged),
  "emote": "identifier" (must be one of the available emotes),
  "goToNext": boolean (true if conversation ends - either sale made or you give up)
}

If this is the first interaction (no user message), start the conversation as your character would approach someone.
```

### Example Feissari Character
```typescript
{
  name: "Matti Myyjä",
  roleInstruction: "You are an overly enthusiastic door-to-door vacuum cleaner salesman. You're pushy but friendly, and you have a hard time taking 'no' for an answer. You sell vacuum cleaners for prices ranging from 150€ to 500€ depending on the model. You use lots of Finnish colloquialisms and try to build rapport quickly. You'll give up after 5-6 rejections.",
  emotes: [
    {
      identifier: "excited",
      description: "Use when starting conversation or showing a product feature",
      assets: ["excited-1.svg", "excited-2.svg", "excited-3.svg"]
    },
    {
      identifier: "pushy",
      description: "Use when trying to overcome objections or being persistent",
      assets: ["pushy-1.svg", "pushy-2.svg"]
    },
    {
      identifier: "disappointed",
      description: "Use when giving up or accepting defeat",
      assets: ["disappointed-1.svg", "disappointed-2.svg"]
    },
    {
      identifier: "celebrating",
      description: "Use when successfully making a sale",
      assets: ["celebrating-1.svg", "celebrating-2.svg", "celebrating-3.svg"]
    }
  ]
}
```

## Implementation Phases

### Phase 1: Backend Core (Priority: High)
- [ ] Add LLM client library (Google Gemini)
- [ ] Create LLM service module with prompt building
- [ ] Implement POST /game endpoint
- [ ] Implement PUT /game/{game-id} endpoint with full game logic
- [ ] Create seed data script for feissarit collection
- [ ] Add environment variables for LLM API keys
- [ ] Write unit tests for game logic
- [ ] Write integration tests for API endpoints

### Phase 2: Frontend Integration (Priority: High)
- [ ] Create game state management (React Context)
- [ ] Build game start screen (existing start-screen.tsx can be adapted)
- [ ] Create chat interface component
- [ ] Implement message display with emote animations
- [ ] Add timer display (3-minute countdown)
- [ ] Add balance display
- [ ] Handle game over states
- [ ] Connect to backend API endpoints
- [ ] Add error handling and loading states

### Phase 3: Polish & Enhancement (Priority: Medium)
- [ ] Add sound effects (optional)
- [ ] Implement leaderboard (count of conversations survived * money left)
- [ ] Improve LLM prompt engineering for better responses
- [ ] Add typing indicators during AI response generation

## Technical Considerations

### Error Recovery
- Store partial game state before LLM call
- Implement retry logic for transient failures
- Allow users to continue game after connection issues
- Graceful degradation if LLM is unavailable

## Environment Variables Needed

```bash
# Existing
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_SERVICE_ACCOUNT_KEY=your-service-account-key-json

# New - to be added
GEMINI_API_KEY=your-gemini-api-key
LLM_MODEL=gemini-2.5-flash

```

## Testing Strategy

### Integration Tests
- POST /game creates valid game
- PUT /game/{id} full conversation flow
- Time limit enforcement
- Balance deduction logic
- Game over conditions

## Security Considerations
- Validate all user inputs
- Sanitize LLM outputs before storing
- Don't expose LLM API keys in frontend
- Validate game ownership before allowing updates
- Implement CSRF protection if needed

## Open Questions
1. Do we want to persist chat history permanently or clean up old games? Answer: Persist
2. Should balance be validated server-side only or also sent from client?
Answer: Server-side only, sent to client only for displaying to user
3. Do we need user authentication or is sessionId sufficient?
Answer: SessionId is sufficient
