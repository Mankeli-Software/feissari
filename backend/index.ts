import express, { Request, Response } from 'express';
import admin from 'firebase-admin';
import cors from 'cors';
import dotenv from 'dotenv';
import { LLMService } from './llmService.js';
import {
  CreateGameRequest,
  CreateGameResponse,
  UpdateGameRequest,
  UpdateGameResponse,
  Game,
  Feissari,
  ChatHistory
} from './types.js';

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Constants
const INITIAL_BALANCE = 100;
const GAME_DURATION_MS = 3 * 60 * 1000; // 3 minutes

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Firebase Admin SDK
// Note: In production, you should use a service account key file
// For now, we'll initialize with default credentials
let firestore: admin.firestore.Firestore | null = null;
let llmService: LLMService | null = null;
// Load environment variables from .env if present
dotenv.config();

try {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (serviceAccountKey) {
    // The key can be provided either as raw JSON string or base64-encoded JSON.
    let serviceAccount: admin.ServiceAccount | undefined;

    try {
      // Try to parse as JSON directly
      serviceAccount = JSON.parse(serviceAccountKey) as admin.ServiceAccount;
    } catch (err) {
      try {
        // Fallback: treat as base64-encoded JSON
        const decoded = Buffer.from(serviceAccountKey, 'base64').toString('utf8');
        serviceAccount = JSON.parse(decoded) as admin.ServiceAccount;
      } catch (err2) {
        console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY as JSON or base64-encoded JSON');
        throw err2 || err;
      }
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
      // projectId will usually be inferred from the service account, but include if present
      projectId: (serviceAccount as any)?.project_id || projectId
    });
    firestore = admin.firestore();
    console.log('Firebase Admin SDK initialized using service account from FIREBASE_SERVICE_ACCOUNT_KEY (Firestore)');
  } else if (projectId) {
    // If only projectId is provided, fall back to application default credentials
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: projectId || undefined
    });
    firestore = admin.firestore();
    console.log('Firebase Admin SDK initialized using application default credentials (Firestore)');
  } else {
    console.log('Firebase not configured - FIREBASE_PROJECT_ID and/or FIREBASE_SERVICE_ACCOUNT_KEY not set');
    console.log('API endpoints will return errors without Firebase configuration');
  }
} catch (error) {
  console.error('Failed to initialize Firebase Admin SDK:', error);
  console.log('Server will run but Firebase operations will fail');
}

// Initialize LLM Service
try {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const llmModel = process.env.LLM_MODEL || 'gemini-2.0-flash-exp';
  
  if (geminiApiKey) {
    llmService = new LLMService(geminiApiKey, llmModel);
    console.log(`LLM Service initialized with model: ${llmModel}`);
  } else {
    console.log('LLM not configured - GEMINI_API_KEY not set');
    console.log('Game endpoints will return errors without LLM configuration');
  }
} catch (error) {
  console.error('Failed to initialize LLM Service:', error);
  console.log('Server will run but LLM operations will fail');
}

// Interface for user data
interface UserData {
  name: string;
  sessionId: string;
}

/**
 * POST /api/user
 * Save user name and session ID to Firebase
 * Body: { name: string, sessionId: string }
 */
app.post('/api/user', async (req: Request, res: Response) => {
  try {
    const { name, sessionId } = req.body as UserData;

    // Validation
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ 
        error: 'Invalid name: name is required and must be a non-empty string' 
      });
    }

    if (!sessionId || typeof sessionId !== 'string' || sessionId.trim() === '') {
      return res.status(400).json({ 
        error: 'Invalid sessionId: sessionId is required and must be a non-empty string' 
      });
    }

    if (!firestore) {
      return res.status(503).json({
        error: 'Firebase not configured',
        details: 'Set FIREBASE_PROJECT_ID or FIREBASE_SERVICE_ACCOUNT_KEY environment variable'
      });
    }

    // Save to Firestore
    const userDoc = firestore.collection('users').doc(sessionId);
    await userDoc.set({
      name: name.trim(),
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    return res.status(201).json({
      message: 'User saved successfully',
      sessionId,
      name: name.trim()
    });
  } catch (error) {
    console.error('Error saving user:', error);
    return res.status(500).json({ 
      error: 'Failed to save user data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/user/:sessionId
 * Fetch user name by session ID
 * Returns: { name: string, sessionId: string } or 404 if not found
 */
app.get('/api/user/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    // Validation
    if (!sessionId || sessionId.trim() === '') {
      return res.status(400).json({ 
        error: 'Invalid sessionId: sessionId is required' 
      });
    }

    if (!firestore) {
      return res.status(503).json({
        error: 'Firebase not configured',
        details: 'Set FIREBASE_PROJECT_ID or FIREBASE_SERVICE_ACCOUNT_KEY environment variable'
      });
    }

    // Fetch from Firestore
    const userDoc = await firestore.collection('users').doc(sessionId).get();

    if (!userDoc.exists) {
      return res.status(404).json({ 
        error: 'User not found',
        sessionId 
      });
    }

    const userData = userDoc.data() || {};
    return res.status(200).json({
      sessionId,
      name: userData.name,
      timestamp: userData.timestamp
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch user data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/game
 * Create a new game session
 * Body: { userId: string }
 */
app.post('/api/game', async (req: Request, res: Response) => {
  try {
    const { userId } = req.body as CreateGameRequest;

    // Validation
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      return res.status(400).json({
        error: 'Invalid userId: userId is required and must be a non-empty string'
      });
    }

    if (!firestore) {
      return res.status(503).json({
        error: 'Firebase not configured',
        details: 'Set FIREBASE_PROJECT_ID or FIREBASE_SERVICE_ACCOUNT_KEY environment variable'
      });
    }

    // Fetch all feissarit and randomly select one
    const feissaritSnapshot = await firestore.collection('feissarit').get();
    
    if (feissaritSnapshot.empty) {
      return res.status(500).json({
        error: 'No feissarit available',
        details: 'Please seed the database with feissari characters'
      });
    }

    const feissarit = feissaritSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const randomFeissari = feissarit[Math.floor(Math.random() * feissarit.length)];

    // Create new game document
    const gameRef = firestore.collection('games').doc();
    const gameData: Omit<Game, 'id'> = {
      userId: userId.trim(),
      createdAt: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp,
      currentFeissariId: randomFeissari.id,
      isActive: true
    };

    await gameRef.set(gameData);

    const response: CreateGameResponse = {
      gameId: gameRef.id,
      createdAt: new Date().toISOString(),
      initialBalance: INITIAL_BALANCE
    };

    return res.status(201).json(response);
  } catch (error) {
    console.error('Error creating game:', error);
    return res.status(500).json({
      error: 'Failed to create game',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PUT /api/game/:gameId
 * Main game loop - handle user messages and get AI responses
 * Body: { message: string | null }
 */
app.put('/api/game/:gameId', async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;
    const { message } = req.body as UpdateGameRequest;

    // Validation
    if (!gameId || gameId.trim() === '') {
      return res.status(400).json({
        error: 'Invalid gameId: gameId is required'
      });
    }

    if (message !== null && typeof message !== 'string') {
      return res.status(400).json({
        error: 'Invalid message: message must be a string or null'
      });
    }

    if (!firestore) {
      return res.status(503).json({
        error: 'Firebase not configured',
        details: 'Set FIREBASE_PROJECT_ID or FIREBASE_SERVICE_ACCOUNT_KEY environment variable'
      });
    }

    if (!llmService) {
      return res.status(503).json({
        error: 'LLM not configured',
        details: 'Set GEMINI_API_KEY environment variable'
      });
    }

    // Get game document
    const gameRef = firestore.collection('games').doc(gameId);
    const gameDoc = await gameRef.get();

    if (!gameDoc.exists) {
      return res.status(404).json({
        error: 'Game not found',
        gameId
      });
    }

    const game = { id: gameDoc.id, ...gameDoc.data() } as Game;

    // Check if game is still active
    if (!game.isActive) {
      return res.status(410).json({
        error: 'Game is no longer active',
        gameId
      });
    }

    // Check time limit
    const gameCreatedAt = game.createdAt.toDate();
    const elapsedTime = Date.now() - gameCreatedAt.getTime();
    const timeExpired = elapsedTime > GAME_DURATION_MS;

    if (timeExpired) {
      await gameRef.update({ isActive: false });
      
      // Get final balance
      const latestChatSnapshot = await firestore
        .collection('chatHistory')
        .doc(gameId)
        .collection('chats')
        .orderBy('timestamp', 'desc')
        .limit(1)
        .get();

      const finalBalance = latestChatSnapshot.empty 
        ? INITIAL_BALANCE 
        : latestChatSnapshot.docs[0].data().balanceAfter;

      const response: UpdateGameResponse = {
        message: 'Aika loppui! Peli päättyi.',
        balance: finalBalance,
        emoteAssets: [],
        goToNext: false,
        gameOver: true,
        feissariName: ''
      };

      return res.status(200).json(response);
    }

    // Get current balance from latest chat
    const latestChatSnapshot = await firestore
      .collection('chatHistory')
      .doc(gameId)
      .collection('chats')
      .orderBy('timestamp', 'desc')
      .limit(1)
      .get();

    const currentBalance = latestChatSnapshot.empty
      ? INITIAL_BALANCE
      : latestChatSnapshot.docs[0].data().balanceAfter;

    // Check if balance is depleted
    if (currentBalance <= 0) {
      await gameRef.update({ isActive: false });
      
      const response: UpdateGameResponse = {
        message: 'Rahasi loppuivat! Peli päättyi.',
        balance: 0,
        emoteAssets: [],
        goToNext: false,
        gameOver: true,
        feissariName: ''
      };

      return res.status(200).json(response);
    }

    // Get current feissari
    const feissariDoc = await firestore.collection('feissarit').doc(game.currentFeissariId).get();
    
    if (!feissariDoc.exists) {
      return res.status(500).json({
        error: 'Current feissari not found',
        details: 'Database inconsistency'
      });
    }

    const feissari = { id: feissariDoc.id, ...feissariDoc.data() } as Feissari;

    // Get chat history for current feissari
    const chatHistorySnapshot = await firestore
      .collection('chatHistory')
      .doc(gameId)
      .collection('chats')
      .where('feissariId', '==', game.currentFeissariId)
      .orderBy('timestamp', 'asc')
      .get();

    const chatHistory: ChatHistory[] = chatHistorySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as ChatHistory));

    // Get LLM response
    const llmResponse = await llmService.getResponse(
      feissari,
      currentBalance,
      chatHistory,
      message
    );

    // Get emote assets
    const emote = feissari.emotes.find(e => e.identifier === llmResponse.emote);
    const emoteAssets = emote ? emote.assets : [];

    // Store chat history
    const chatRef = firestore
      .collection('chatHistory')
      .doc(gameId)
      .collection('chats')
      .doc();

    const chatData: Omit<ChatHistory, 'id'> = {
      feissariId: game.currentFeissariId,
      feissariName: feissari.name,
      timestamp: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp,
      userMessage: message,
      aiMessage: llmResponse.message,
      balanceBefore: currentBalance,
      balanceAfter: llmResponse.balance,
      emoteAssets: emoteAssets,
      movedToNext: llmResponse.goToNext
    };

    await chatRef.set(chatData);

    // Handle moving to next feissari
    if (llmResponse.goToNext) {
      // Get all feissarit ordered by ID
      const allFeissaritSnapshot = await firestore
        .collection('feissarit')
        .orderBy(admin.firestore.FieldPath.documentId())
        .startAfter(game.currentFeissariId)
        .limit(1)
        .get();

      let nextFeissari;
      
      if (allFeissaritSnapshot.empty) {
        // Wrap around to the first feissari
        const firstFeissariSnapshot = await firestore
          .collection('feissarit')
          .orderBy(admin.firestore.FieldPath.documentId())
          .limit(1)
          .get();
        
        nextFeissari = firstFeissariSnapshot.docs[0];
      } else {
        nextFeissari = allFeissaritSnapshot.docs[0];
      }

      // Update game with next feissari
      await gameRef.update({
        currentFeissariId: nextFeissari.id
      });
    }

    // Check if balance is now depleted
    const gameOver = llmResponse.balance <= 0 || timeExpired;
    
    if (gameOver) {
      await gameRef.update({ isActive: false });
    }

    const response: UpdateGameResponse = {
      message: llmResponse.message,
      balance: llmResponse.balance,
      emoteAssets: emoteAssets,
      goToNext: llmResponse.goToNext,
      gameOver: gameOver,
      feissariName: feissari.name
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Error updating game:', error);
    return res.status(500).json({
      error: 'Failed to update game',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', timestamp: Date.now() });
});

// Start the server only if not in test mode
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Backend server is running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`API endpoints:`);
    console.log(`  POST /api/user - Save user name and session ID`);
    console.log(`  GET /api/user/:sessionId - Get user name by session ID`);
    console.log(`  POST /api/game - Create a new game session`);
    console.log(`  PUT /api/game/:gameId - Handle game interactions`);
  });
}

export default app;
