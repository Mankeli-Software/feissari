import express, { Request, Response } from 'express';
import admin from 'firebase-admin';
import cors from 'cors';
import dotenv from 'dotenv';
import { LLMService } from './llmService';
import {
  CreateGameRequest,
  CreateGameResponse,
  UpdateGameRequest,
  UpdateGameResponse,
  Game,
  Feissari,
  ChatHistory,
  LeaderboardEntry,
  CreateLeaderboardRequest,
  CreateLeaderboardResponse,
  TopLeaderboardResponse,
  RecentLeaderboardResponse,
  LeaderboardStatsResponse,
  LeaderboardEntryResponse
} from './types';

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
  
  if (geminiApiKey) {
    llmService = new LLMService(geminiApiKey);
    console.log(`LLM Service initialized`);
  } else {
    console.log('LLM not configured - GEMINI_API_KEY not set');
    console.log('Game endpoints will return errors without LLM configuration');
  }
} catch (error) {
  console.error('Failed to initialize LLM Service:', error);
  console.log('Server will run but LLM operations will fail');
}

/**
 * Helper function to calculate defeated feissari count from chat history
 * Counts unique feissariIds where movedToNext is true
 */
async function calculateDefeatedFeissari(gameId: string): Promise<number> {
  if (!firestore) return 0;

  const chatSnapshot = await firestore
    .collection('chatHistory')
    .doc(gameId)
    .collection('chats')
    .where('movedToNext', '==', true)
    .get();

  const uniqueFeissariIds = new Set<string>();
  chatSnapshot.docs.forEach(doc => {
    const data = doc.data();
    uniqueFeissariIds.add(data.feissariId);
  });

  return uniqueFeissariIds.size;
}

/**
 * Helper function to calculate score and game stats
 */
async function calculateGameScore(gameId: string, finalBalance: number): Promise<{ score: number; defeatedFeissari: number }> {
  const defeatedFeissari = await calculateDefeatedFeissari(gameId);
  const score = defeatedFeissari * finalBalance;
  console.log(`calculateGameScore: gameId=${gameId}, finalBalance=${finalBalance}, defeatedFeissari=${defeatedFeissari}, score=${score}`);
  return { score: score || 0, defeatedFeissari: defeatedFeissari || 0 };
}

/**
 * GET /api/leaderboard/last-game
 * Get the latest game statistics for the current user
 * Query params: userId (required) - session ID of the user
 * Returns: { gameId, score, defeatedFeissari, finalBalance, createdAt }
 */
app.get('/api/leaderboard/last-game', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId || req.headers['x-user-id'];
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid userId (sessionId) in query or header' });
    }
    if (!firestore) {
      return res.status(503).json({
        error: 'Firebase not configured',
        details: 'Set FIREBASE_PROJECT_ID or FIREBASE_SERVICE_ACCOUNT_KEY environment variable'
      });
    }
    // Get the most recent leaderboard entry for this user
    const snapshot = await firestore
      .collection('leaderboard')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();
    if (snapshot.empty) {
      return res.status(404).json({ error: 'No game stats found for user' });
    }
    const data = snapshot.docs[0].data();
    return res.status(200).json({
      gameId: data.gameId,
      score: data.score,
      defeatedFeissari: data.defeatedFeissari,
      finalBalance: data.finalBalance,
      createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching last game stats:', error);
    return res.status(500).json({
      error: 'Failed to fetch last game stats',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

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

      console.log(`Time expired for game ${gameId}. Latest chat empty: ${latestChatSnapshot.empty}, finalBalance: ${finalBalance}`);

      // Calculate score and defeated feissari
      const { score, defeatedFeissari } = await calculateGameScore(gameId, finalBalance);
      
      console.log(`Calculated score for game ${gameId}: defeatedFeissari=${defeatedFeissari}, finalBalance=${finalBalance}, score=${score}`);

      // Save to leaderboard
      try {
        const userDoc = await firestore.collection('users').doc(game.userId).get();
        const userName = userDoc.exists ? (userDoc.data()?.name || 'Anonymous') : 'Anonymous';
        
        const existingEntrySnapshot = await firestore
          .collection('leaderboard')
          .where('gameId', '==', gameId)
          .limit(1)
          .get();
        
        if (existingEntrySnapshot.empty) {
          const leaderboardRef = firestore.collection('leaderboard').doc();
          const leaderboardData = {
            userId: game.userId,
            userName: userName,
            gameId: gameId,
            score: score,
            defeatedFeissari: defeatedFeissari,
            finalBalance: finalBalance,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          };
          
          console.log(`About to save leaderboard entry:`, leaderboardData);
          await leaderboardRef.set(leaderboardData);
          console.log(`Leaderboard entry created for game ${gameId}: score=${score}, defeatedFeissari=${defeatedFeissari}, finalBalance=${finalBalance}`);
        } else {
          console.log(`Leaderboard entry already exists for game ${gameId}`);
        }
      } catch (leaderboardError) {
        console.error('Error saving to leaderboard (time expired):', leaderboardError);
      }

      const response: UpdateGameResponse = {
        message: 'Aika loppui! Peli päättyi.',
        balance: finalBalance,
        emoteAssets: [],
        goToNext: false,
        gameOver: true,
        feissariName: '',
        score: score,
        defeatedFeissari: defeatedFeissari
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
      
      // Calculate score and defeated feissari
      const { score, defeatedFeissari } = await calculateGameScore(gameId, 0);

      // Save to leaderboard
      try {
        const userDoc = await firestore.collection('users').doc(game.userId).get();
        const userName = userDoc.exists ? (userDoc.data()?.name || 'Anonymous') : 'Anonymous';
        
        const existingEntrySnapshot = await firestore
          .collection('leaderboard')
          .where('gameId', '==', gameId)
          .limit(1)
          .get();
        
        if (existingEntrySnapshot.empty) {
          const leaderboardRef = firestore.collection('leaderboard').doc();
          const leaderboardData = {
            userId: game.userId,
            userName: userName,
            gameId: gameId,
            score: score,
            defeatedFeissari: defeatedFeissari,
            finalBalance: 0,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          };
          
          await leaderboardRef.set(leaderboardData);
          console.log(`Leaderboard entry created for game ${gameId}: score=${score}, defeatedFeissari=${defeatedFeissari}, finalBalance=0`);
        } else {
          console.log(`Leaderboard entry already exists for game ${gameId}`);
        }
      } catch (leaderboardError) {
        console.error('Error saving to leaderboard (balance depleted):', leaderboardError);
      }

      const response: UpdateGameResponse = {
        message: 'Rahasi loppuivat! Peli päättyi.',
        balance: 0,
        emoteAssets: [],
        goToNext: false,
        gameOver: true,
        feissariName: '',
        score: score,
        defeatedFeissari: defeatedFeissari
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

    // Validate that the feissari has required fields
    if (!feissari.emotes || !Array.isArray(feissari.emotes)) {
      console.error('Feissari missing emotes field:', feissariDoc.id, 'Using empty array as fallback');
      feissari.emotes = [];
    }

    // Handle null message: verify that the last chat had goToNext: true (client requesting new feissari greeting)
    if (message === null) {
      // Get the last chat entry overall (from any feissari)
      const allChatsSnapshot = await firestore
        .collection('chatHistory')
        .doc(gameId)
        .collection('chats')
        .orderBy('timestamp', 'desc')
        .limit(1)
        .get();

      // For first request, allChatsSnapshot will be empty (no prior messages)
      // For subsequent requests, verify that the last chat had movedToNext: true
      if (!allChatsSnapshot.empty) {
        const lastChat = allChatsSnapshot.docs[0].data();
        if (!lastChat.movedToNext) {
          return res.status(400).json({
            error: 'Invalid request: null message can only be sent after a feissari has been defeated',
            details: 'Last chat entry did not have movedToNext: true'
          });
        }
      }
    }

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
    const emote = feissari.emotes?.find(e => e.identifier === llmResponse.emote);
    const emoteAssets = emote?.assets || [];

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

    // Check if balance is now depleted or time expired
    const balanceDepletedNow = llmResponse.balance <= 0;
    const gameOver = balanceDepletedNow || timeExpired;
    
    console.log(`Game state: gameId=${gameId}, balanceDepletedNow=${balanceDepletedNow}, timeExpired=${timeExpired}, gameOver=${gameOver}`);
    
    // Always calculate defeated feissari count for live display
    const defeatedFeissari = await calculateDefeatedFeissari(gameId);
    
    // Calculate score - if balance just depleted, use the balance from before this transaction
    let score: number | undefined;
    if (gameOver) {
      if (balanceDepletedNow) {
        // Balance just became 0, use the balance from BEFORE this transaction
        score = defeatedFeissari * currentBalance;
        console.log(`Game over (balance depleted): defeatedFeissari=${defeatedFeissari}, currentBalance=${currentBalance}, score=${score}`);
      } else {
        // Game ended for other reasons (shouldn't happen as timeExpired returns early)
        score = defeatedFeissari * llmResponse.balance;
        console.log(`Game over (other reason): defeatedFeissari=${defeatedFeissari}, llmResponse.balance=${llmResponse.balance}, score=${score}`);
      }
    }
    
    if (gameOver) {
      await gameRef.update({ isActive: false });
      
      // Automatically save to leaderboard when game ends
      try {
        // Get user name
        const userDoc = await firestore.collection('users').doc(game.userId).get();
        const userName = userDoc.exists ? (userDoc.data()?.name || 'Anonymous') : 'Anonymous';
        
        // Check if entry already exists for this game
        const existingEntrySnapshot = await firestore
          .collection('leaderboard')
          .where('gameId', '==', gameId)
          .limit(1)
          .get();
        
        // Only create if doesn't exist
        if (existingEntrySnapshot.empty) {
          const leaderboardRef = firestore.collection('leaderboard').doc();
          const leaderboardData = {
            userId: game.userId,
            userName: userName,
            gameId: gameId,
            score: score || 0,
            defeatedFeissari: defeatedFeissari,
            finalBalance: llmResponse.balance,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          };
          
          await leaderboardRef.set(leaderboardData);
          console.log(`Leaderboard entry created for game ${gameId}: score=${score}, defeatedFeissari=${defeatedFeissari}, finalBalance=${llmResponse.balance}`);
        } else {
          console.log(`Leaderboard entry already exists for game ${gameId}`);
        }
      } catch (leaderboardError) {
        // Log error but don't fail the game update
        console.error('Error saving to leaderboard (main flow):', leaderboardError);
      }
    }

    const response: UpdateGameResponse = {
      message: llmResponse.message, // Keep the old feissari's message
      balance: llmResponse.balance,
      emoteAssets: emoteAssets, // Keep the old feissari's emote
      goToNext: llmResponse.goToNext,
      gameOver: gameOver,
      feissariName: feissari.name, // Keep the old feissari's name
      score: score,
      defeatedFeissari: defeatedFeissari,
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

/**
 * POST /api/leaderboard
 * Save game score to leaderboard
 * Body: { gameId: string }
 */
app.post('/api/leaderboard', async (req: Request, res: Response) => {
  try {
    const { gameId } = req.body as CreateLeaderboardRequest;

    // Validation
    if (!gameId || typeof gameId !== 'string' || gameId.trim() === '') {
      return res.status(400).json({
        error: 'Invalid gameId: gameId is required and must be a non-empty string'
      });
    }

    if (!firestore) {
      return res.status(503).json({
        error: 'Firebase not configured',
        details: 'Set FIREBASE_PROJECT_ID or FIREBASE_SERVICE_ACCOUNT_KEY environment variable'
      });
    }

    // Get game document
    const gameDoc = await firestore.collection('games').doc(gameId).get();

    if (!gameDoc.exists) {
      return res.status(404).json({
        error: 'Game not found',
        gameId
      });
    }

    const game = { id: gameDoc.id, ...gameDoc.data() } as Game;

    // Get user name
    const userDoc = await firestore.collection('users').doc(game.userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({
        error: 'User not found',
        userId: game.userId
      });
    }

    const userData = userDoc.data();
    const userName = userData?.name || 'Anonymous';

    // Get final balance from latest chat
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

    // Calculate score and defeated feissari
    const { score, defeatedFeissari } = await calculateGameScore(gameId, finalBalance);

    // Check if entry already exists for this game
    const existingEntrySnapshot = await firestore
      .collection('leaderboard')
      .where('gameId', '==', gameId)
      .limit(1)
      .get();

    if (!existingEntrySnapshot.empty) {
      // Return existing entry
      const existingEntry = existingEntrySnapshot.docs[0];
      const response: CreateLeaderboardResponse = {
        entryId: existingEntry.id,
        score: score,
        defeatedFeissari: defeatedFeissari,
        finalBalance: finalBalance
      };
      return res.status(200).json(response);
    }

    // Create new leaderboard entry
    const leaderboardRef = firestore.collection('leaderboard').doc();
    const leaderboardData: Omit<LeaderboardEntry, 'id'> = {
      userId: game.userId,
      userName: userName,
      gameId: gameId,
      score: score,
      defeatedFeissari: defeatedFeissari,
      finalBalance: finalBalance,
      createdAt: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp
    };

    await leaderboardRef.set(leaderboardData);

    const response: CreateLeaderboardResponse = {
      entryId: leaderboardRef.id,
      score: score,
      defeatedFeissari: defeatedFeissari,
      finalBalance: finalBalance
    };

    return res.status(201).json(response);
  } catch (error) {
    console.error('Error creating leaderboard entry:', error);
    return res.status(500).json({
      error: 'Failed to create leaderboard entry',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/leaderboard/top
 * Get top 10 all-time highest scores
 * Query params: userId (optional) - to include current user's entry if not in top 10
 */
app.get('/api/leaderboard/top', async (req: Request, res: Response) => {
  try {
    const { userId } = req.query;

    if (!firestore) {
      return res.status(503).json({
        error: 'Firebase not configured',
        details: 'Set FIREBASE_PROJECT_ID or FIREBASE_SERVICE_ACCOUNT_KEY environment variable'
      });
    }

    // Get top 10 scores
    const topScoresSnapshot = await firestore
      .collection('leaderboard')
      .orderBy('score', 'desc')
      .limit(10)
      .get();

    const entries: LeaderboardEntryResponse[] = topScoresSnapshot.docs.map((doc, index) => {
      const data = doc.data();
      return {
        userId: data.userId,
        userName: data.userName,
        score: data.score,
        defeatedFeissari: data.defeatedFeissari,
        finalBalance: data.finalBalance,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        rank: index + 1
      };
    });

    // Check if current user is in top 10
    let currentUserEntry: LeaderboardEntryResponse | undefined;
    let currentUserRank: number | undefined;

    if (userId && typeof userId === 'string') {
      const userInTop10 = entries.find(entry => entry.userId === userId);
      
      if (userInTop10) {
        currentUserEntry = userInTop10;
      } else {
        // Get user's best score
        const userBestScoreSnapshot = await firestore
          .collection('leaderboard')
          .where('userId', '==', userId)
          .orderBy('score', 'desc')
          .limit(1)
          .get();

        if (!userBestScoreSnapshot.empty) {
          const data = userBestScoreSnapshot.docs[0].data();
          currentUserEntry = {
            userId: data.userId,
            userName: data.userName,
            score: data.score,
            defeatedFeissari: data.defeatedFeissari,
            finalBalance: data.finalBalance,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString()
          };

          // Calculate rank (how many scores are better)
          const betterScoresSnapshot = await firestore
            .collection('leaderboard')
            .where('score', '>', data.score)
            .get();
          
          currentUserRank = betterScoresSnapshot.size + 1;
        }
      }
    }

    const response: TopLeaderboardResponse = {
      entries,
      currentUserEntry,
      currentUserRank
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching top leaderboard:', error);
    return res.status(500).json({
      error: 'Failed to fetch top leaderboard',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/leaderboard/recent
 * Get 10 most recent entries to the leaderboard
 * Query params: userId (optional) - to include current user's recent entry if not in top 10
 */
app.get('/api/leaderboard/recent', async (req: Request, res: Response) => {
  try {
    const { userId } = req.query;

    if (!firestore) {
      return res.status(503).json({
        error: 'Firebase not configured',
        details: 'Set FIREBASE_PROJECT_ID or FIREBASE_SERVICE_ACCOUNT_KEY environment variable'
      });
    }

    // Get 10 most recent entries
    const recentEntriesSnapshot = await firestore
      .collection('leaderboard')
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();

    const entries: LeaderboardEntryResponse[] = recentEntriesSnapshot.docs.map((doc, index) => {
      const data = doc.data();
      return {
        userId: data.userId,
        userName: data.userName,
        score: data.score,
        defeatedFeissari: data.defeatedFeissari,
        finalBalance: data.finalBalance,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        rank: index + 1
      };
    });

    // Check if current user is in recent 10
    let currentUserEntry: LeaderboardEntryResponse | undefined;
    let currentUserPosition: number | undefined;

    if (userId && typeof userId === 'string') {
      const userInRecent = entries.find(entry => entry.userId === userId);
      
      if (userInRecent) {
        currentUserEntry = userInRecent;
      } else {
        // Get user's most recent score
        const userRecentScoreSnapshot = await firestore
          .collection('leaderboard')
          .where('userId', '==', userId)
          .orderBy('createdAt', 'desc')
          .limit(1)
          .get();

        if (!userRecentScoreSnapshot.empty) {
          const data = userRecentScoreSnapshot.docs[0].data();
          const userCreatedAt = data.createdAt?.toDate?.() || new Date();
          
          currentUserEntry = {
            userId: data.userId,
            userName: data.userName,
            score: data.score,
            defeatedFeissari: data.defeatedFeissari,
            finalBalance: data.finalBalance,
            createdAt: userCreatedAt.toISOString()
          };

          // Calculate position (how many more recent entries there are)
          const moreRecentSnapshot = await firestore
            .collection('leaderboard')
            .where('createdAt', '>', admin.firestore.Timestamp.fromDate(userCreatedAt))
            .get();
          
          currentUserPosition = moreRecentSnapshot.size + 1;
        }
      }
    }

    const response: RecentLeaderboardResponse = {
      entries,
      currentUserEntry,
      currentUserPosition
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching recent leaderboard:', error);
    return res.status(500).json({
      error: 'Failed to fetch recent leaderboard',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/leaderboard/stats
 * Get leaderboard statistics (total games played and token churn)
 */
app.get('/api/leaderboard/stats', async (req: Request, res: Response) => {
  try {
    if (!firestore) {
      return res.status(503).json({
        error: 'Firebase not configured',
        details: 'Set FIREBASE_PROJECT_ID or FIREBASE_SERVICE_ACCOUNT_KEY environment variable'
      });
    }

    // Count total entries in leaderboard
    const leaderboardSnapshot = await firestore.collection('leaderboard').count().get();
    const totalGamesPlayed = leaderboardSnapshot.data().count;

    // Calculate token churn (games * 0.08€)
    const tokenChurn = (totalGamesPlayed * 0.08).toFixed(2);

    const response: LeaderboardStatsResponse = {
      totalGamesPlayed,
      tokenChurn: `€${tokenChurn}`
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching leaderboard stats:', error);
    return res.status(500).json({
      error: 'Failed to fetch leaderboard stats',
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
    console.log(`  POST /api/leaderboard - Save game score to leaderboard`);
    console.log(`  GET /api/leaderboard/top - Get top 10 all-time highest scores`);
    console.log(`  GET /api/leaderboard/recent - Get 10 most recent entries`);
    console.log(`  GET /api/leaderboard/stats - Get leaderboard statistics`);
  });
}

export default app;
