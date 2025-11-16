# Feissari Game

A Finnish face-to-face salesperson (feissari) simulator game where you compete against LLM-powered salesperson characters. Can you survive 3 minutes without losing all your money?

## Game Concept

- **Starting Budget**: €100 per player
- **Time Limit**: 3 minutes per game session
- **Objective**: Progress through as many feissari encounters as possible without running out of money
- **Gameplay**: Engage in text-based conversations with AI salespeople powered by Google Gemini, trying to resist their sales pitches

## Technology Stack

### Backend
- Node.js with Express (TypeScript)
- Firebase Firestore for data storage
- Google Gemini AI for dynamic conversations
- Vitest for testing

### Frontend
- Next.js 16 with React 19
- TypeScript
- Tailwind CSS
- Shadcn UI components

## Project Structure

```
feissari/
├── backend/          # Express.js API server
│   ├── index.ts      # Main server file
│   ├── types.ts      # TypeScript interfaces
│   ├── llmService.ts # Google Gemini integration
│   ├── seedFeissarit.ts # Database seeding script
│   └── ...
├── frontend/         # Next.js application
│   ├── app/          # Next.js app directory
│   ├── components/   # React components
│   └── lib/          # Utilities and context
└── requirements.md   # Detailed specifications
```

## Setup Instructions

### Prerequisites

1. Node.js (v14 or higher)
2. Firebase project with Firestore enabled
3. Google Gemini API key ([Get one here](https://aistudio.google.com/))

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
npm install
```

2. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your Firebase and Gemini API credentials
```

3. Seed the database with feissari characters:
```bash
npm run seed
```

4. Start the backend server:
```bash
npm run dev
```

The backend will run on `http://localhost:3001`

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
npm install
```

2. Configure environment variables (create `.env.local`):
```bash
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
```

3. Start the development server:
```bash
npm run dev
```

The frontend will run on `http://localhost:3000`

## Running the Game

1. Start both backend and frontend servers
2. Open your browser to `http://localhost:3000`
3. Enter your name to begin
4. Try to survive 3 minutes without losing all your money!

## API Documentation

See [backend/README.md](backend/README.md) for detailed API documentation.

## Development

### Running Tests

Backend tests:
```bash
cd backend
npm test
```

### Building for Production

Backend:
```bash
cd backend
npm run build
npm start
```

Frontend:
```bash
cd frontend
npm run build
npm start
```

## License

ISC
