import express, { Request, Response } from 'express';
import admin from 'firebase-admin';
import cors from 'cors';
import dotenv from 'dotenv';

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Firebase Admin SDK
// Note: In production, you should use a service account key file
// For now, we'll initialize with default credentials
let firestore: admin.firestore.Firestore | null = null;
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
  });
}

export default app;
