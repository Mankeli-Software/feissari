# Feissari Backend

A backend service for the Feissari game - a Finnish face-to-face salesperson simulator powered by Google Gemini AI.

## Features

- Express.js server with TypeScript
- Firebase Firestore for data persistence
- Google Gemini AI integration for dynamic conversations
- RESTful API endpoints for game and user management
- Comprehensive test suite with Vitest

## Prerequisites

- Node.js (v14 or higher)
- Firebase project with Firestore enabled
- Firebase service account credentials
- Google Gemini API key

## Installation

```bash
npm install
```

## Testing

Run unit tests:
```bash
npm test
```

Run tests in watch mode:
```bash
npm test:watch
```

Run tests with coverage:
```bash
npm test:coverage
```

The test suite includes comprehensive validation for all endpoints.

## Configuration

Copy `.env.example` to `.env` and configure:

```bash
# Firebase Configuration
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_SERVICE_ACCOUNT_KEY=your-service-account-key-json-or-base64

# Google Gemini API
GEMINI_API_KEY=your-gemini-api-key
LLM_MODEL=gemini-2.0-flash-exp

# Server
PORT=3001
NODE_ENV=development
```

## Database Setup

1. Set up Firebase and Gemini API credentials in `.env`
2. Seed the database with feissari characters:

```bash
npm run seed
```

This will populate the Firestore database with 5 unique feissari characters.

## Running the Server

Development mode (with ts-node):
```bash
npm run dev
```

Production mode:
```bash
npm run build
npm start
```

## API Endpoints

### Health Check
```
GET /health
```
Returns server health status.

### User Management

#### Save User
```
POST /api/user
Content-Type: application/json

{
  "name": "John Doe",
  "sessionId": "unique-session-id"
}
```
Saves a user's name associated with their session ID to Firestore.

#### Get User
```
GET /api/user/:sessionId
```
Retrieves a user's name by their session ID.

### Game Endpoints

#### Create Game
```
POST /api/game
Content-Type: application/json

{
  "userId": "session-id"
}
```
Creates a new game session and randomly assigns a feissari character.

**Response (201):**
```json
{
  "gameId": "unique-game-id",
  "createdAt": "2025-11-15T10:00:00.000Z",
  "initialBalance": 100
}
```

#### Update Game (Send Message)
```
PUT /api/game/:gameId
Content-Type: application/json

{
  "message": "No thanks, I'm not interested" or null
}
```
Sends a message in the game (or null to start the conversation) and receives AI response.

**Response (200):**
```json
{
  "message": "AI character response",
  "balance": 100,
  "emoteAssets": ["excited-1.svg", "excited-2.svg"],
  "goToNext": false,
  "gameOver": false,
  "feissariName": "Matti Myyjä"
}
```

## Game Rules

- **Starting Balance**: €100
- **Time Limit**: 3 minutes
- **Objective**: Survive without losing all your money
- **Gameplay**: Resist AI salespeople's pitches through conversation

## Error Handling

The API returns appropriate HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request (invalid input)
- `404` - Not Found
- `410` - Gone (game time expired)
- `503` - Service Unavailable (Firebase/LLM not configured)
- `500` - Internal Server Error

Error responses include descriptive messages:
```json
{
  "error": "Error description",
  "details": "Additional error details"
}
```

## Architecture

### Database Schema

- `/games/{game-id}` - Game sessions
- `/chatHistory/{game-id}/chats/{chat-id}` - Chat messages (subcollection)
- `/feissarit/{feissari-id}` - Salesperson characters
- `/users/{session-id}` - User profiles

See `requirements.md` for detailed schema documentation.
