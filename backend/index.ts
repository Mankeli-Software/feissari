import express, { Request, Response } from 'express';
import admin from 'firebase-admin';
import cors from 'cors';

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Firebase Admin SDK
// Note: In production, you should use a service account key file
// For now, we'll initialize with default credentials
try {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    databaseURL: process.env.FIREBASE_DATABASE_URL
  });
} catch (error) {
  console.error('Failed to initialize Firebase Admin SDK:', error);
  console.log('Server will run but Firebase operations will fail without proper configuration');
}

const db = admin.database();

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

    // Save to Firebase Realtime Database
    const userRef = db.ref(`users/${sessionId}`);
    await userRef.set({
      name: name.trim(),
      timestamp: admin.database.ServerValue.TIMESTAMP
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

    // Fetch from Firebase Realtime Database
    const userRef = db.ref(`users/${sessionId}`);
    const snapshot = await userRef.get();

    if (!snapshot.exists()) {
      return res.status(404).json({ 
        error: 'User not found',
        sessionId 
      });
    }

    const userData = snapshot.val();
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

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', timestamp: Date.now() });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Backend server is running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`API endpoints:`);
  console.log(`  POST /api/user - Save user name and session ID`);
  console.log(`  GET /api/user/:sessionId - Get user name by session ID`);
});

export default app;
