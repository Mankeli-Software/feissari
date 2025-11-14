# Feissari Backend

A basic Express.js backend service for the Feissari game with Firebase integration.

## Features

- Express.js server with TypeScript
- Firebase Realtime Database integration
- CORS enabled for frontend communication
- RESTful API endpoints for user management

## Prerequisites

- Node.js (v14 or higher)
- Firebase project with Realtime Database enabled
- Firebase service account credentials (for production)

## Installation

```bash
npm install
```

## Configuration

Set the following environment variables:

- `PORT` - Server port (default: 3001)
- `FIREBASE_DATABASE_URL` - Firebase Realtime Database URL
- Firebase credentials should be configured via Application Default Credentials or service account key

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

### Save User
```
POST /api/user
Content-Type: application/json

{
  "name": "John Doe",
  "sessionId": "unique-session-id"
}
```
Saves a user's name associated with their session ID to Firebase.

**Response (201):**
```json
{
  "message": "User saved successfully",
  "sessionId": "unique-session-id",
  "name": "John Doe"
}
```

### Get User
```
GET /api/user/:sessionId
```
Retrieves a user's name by their session ID.

**Response (200):**
```json
{
  "sessionId": "unique-session-id",
  "name": "John Doe",
  "timestamp": 1699999999999
}
```

**Response (404):**
```json
{
  "error": "User not found",
  "sessionId": "unknown-session-id"
}
```

## Error Handling

The API returns appropriate HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request (invalid input)
- `404` - Not Found
- `500` - Internal Server Error

Error responses include descriptive messages:
```json
{
  "error": "Error description",
  "details": "Additional error details"
}
```
